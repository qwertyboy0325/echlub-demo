#!/usr/bin/env node
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.BROWSER_LOAD_PORT ?? 4185);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = join(root, "artifacts/codex-campaign/runtime");

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch { /* retry */ }
    await delay(200);
  }
  return false;
}

function jsonl(records) {
  return records.length ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n` : "";
}

const dev = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});
const shutdown = () => { if (!dev.killed) dev.kill("SIGTERM"); };
process.on("exit", shutdown);

const baseUrl = `http://localhost:${PORT}/`;
if (!(await waitForServer(baseUrl))) {
  shutdown();
  throw new Error("dev server not ready");
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });

  const initial = await page.evaluate(() => ({
    startExists: Boolean(document.querySelector("#start-button")),
    productionSlot: Boolean(document.querySelector("#daw-workspace") || document.querySelector("#session-view")),
    demoController: Boolean(window.__echlubDemoController),
  }));

  await page.$eval("#speed-control", (input) => {
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Run the real Production Act. No skip control is used before the Production Cue.
  await page.click("#start-button");
  await page.waitForFunction(
    () => (window.__echlubDemoController?.runtime.productionActionIndex ?? 0) >= 1,
    { timeout: 15000 },
  );

  const productionMutation = await page.evaluate(() => {
    const runtime = window.__echlubDemoController.runtime;
    const draft = runtime.session.drafts["memory-opening"];
    return {
      act: runtime.act,
      actionIndex: runtime.productionActionIndex,
      revision: draft.revision,
      noteCount: draft.notes?.length ?? 0,
    };
  });

  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.materialResolutionLog.some(
      (record) => record.act === "production"
        && record.consumer === "cue"
        && record.draftId === "memory-opening",
    ),
    { timeout: 15000 },
  );
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.cueCompletionLog.some(
      (record) => record.act === "production"
        && record.draftId === "memory-opening"
        && record.cueNoteCount > 0,
    ),
    { timeout: 15000 },
  );

  const productionCue = await page.evaluate(() => {
    const snapshot = window.__echlubDevSnapshot;
    return {
      resolution: snapshot.materialResolutionLog.find(
        (record) => record.act === "production"
          && record.consumer === "cue"
          && record.draftId === "memory-opening",
      ),
      completion: snapshot.cueCompletionLog.find(
        (record) => record.act === "production" && record.draftId === "memory-opening",
      ),
      survivingScheduleCount: snapshot.cueScheduleCount,
    };
  });

  // Production completes naturally; Canonical begins from its frozen snapshot.
  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "canonicalPlayback",
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.materialResolutionLog.some(
      (record) => record.act === "canonicalPlayback"
        && record.consumer === "canonical"
        && record.draftId === "memory-opening"
        && record.sceneId === "opening"
        && record.layer === "melody",
    ),
    { timeout: 10000 },
  );

  const canonical = await page.evaluate(() => {
    const runtime = window.__echlubDemoController.runtime;
    const ref = runtime.canonicalSnapshot.scenes.find((scene) => scene.id === "opening").layers.melody;
    const resolution = window.__echlubDevSnapshot.materialResolutionLog.find(
      (record) => record.act === "canonicalPlayback"
        && record.consumer === "canonical"
        && record.sceneId === "opening"
        && record.layer === "melody"
        && record.draftId === "memory-opening",
    );
    return {
      ref,
      resolution,
      totalBars: runtime.canonicalSnapshot.arrangement.totalBars,
      sceneOrder: runtime.canonicalSnapshot.arrangement.scenes
        .map((scene) => `${scene.sceneId}@${scene.startBar}`),
    };
  });

  // Canonical identity has been observed; enter Live without waiting for the full film.
  await page.click("#skip-performance");
  try {
    await page.waitForFunction(
      () => window.__echlubDevSnapshot?.liveMutationLog.some((record) => record.eventId === "e03b"),
      { timeout: 12000 },
    );
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      act: window.__echlubDemoController.runtime.act,
      bar: window.__echlubState.currentBar,
      transportState: window.__echlubDevSnapshot.transportState,
      liveMutationIds: window.__echlubDevSnapshot.liveMutationLog.map((record) => record.eventId),
      pageErrors: [],
    }));
    diagnostic.pageErrors = pageErrors;
    throw new Error(`Live mutation timeout: ${JSON.stringify(diagnostic)}\n${String(error)}`);
  }
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.materialResolutionLog.some(
      (record) => record.act === "livePerformance"
        && record.consumer === "cue"
        && record.draftId === "memory-opening",
    ),
    { timeout: 12000 },
  );
  try {
    await page.waitForFunction(
      () => {
        const runtime = window.__echlubDemoController?.runtime;
        const openingRef = runtime?.session.scenes
          .find((scene) => scene.id === "opening")?.layers.melody;
        return openingRef && window.__echlubDevSnapshot?.materialResolutionLog.some(
          (record) => record.act === "livePerformance"
            && record.consumer === "live"
            && record.sceneId === "opening"
            && record.layer === "melody"
            && record.draftId === openingRef.draftId
            && record.revision === openingRef.revision
            && record.fingerprint === openingRef.fingerprint,
        );
      },
      { timeout: 25000 },
    );
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      act: window.__echlubDemoController?.runtime.act,
      bar: window.__echlubState?.currentBar,
      transportState: window.__echlubDevSnapshot?.transportState,
      playingSceneId: window.__echlubDevSnapshot?.playingSceneId,
      totalBars: window.__echlubDemoController?.runtime.session.arrangement.totalBars,
      arrangement: window.__echlubDemoController?.runtime.session.arrangement.scenes,
      pending: window.__echlubDemoController?.runtime.session.liveStructure.pending,
      resolutions: window.__echlubDevSnapshot?.materialResolutionLog.slice(-12),
      missing: window.__echlubDevSnapshot?.missingMaterialLog,
    }));
    console.error("LIVE_OPENING_TIMEOUT", JSON.stringify({ diagnostic, pageErrors }, null, 2));
    throw error;
  }

  const runtimeEvidence = await page.evaluate(() => {
    const runtime = window.__echlubDemoController.runtime;
    const snapshot = window.__echlubDevSnapshot;
    const openingRef = runtime.session.scenes.find((scene) => scene.id === "opening").layers.melody;
    const e03 = snapshot.liveMutationLog.find((record) => record.eventId === "e03");
    const e03b = snapshot.liveMutationLog.find((record) => record.eventId === "e03b");
    const liveCueResolution = snapshot.materialResolutionLog.find(
      (record) => record.act === "livePerformance"
        && record.consumer === "cue"
        && record.draftId === "memory-opening",
    );
    const liveMasterResolution = [...snapshot.materialResolutionLog].reverse().find(
      (record) => record.act === "livePerformance"
        && record.consumer === "live"
        && record.sceneId === "opening"
        && record.layer === "melody"
        && record.draftId === openingRef.draftId
        && record.revision === openingRef.revision
        && record.fingerprint === openingRef.fingerprint,
    );
    const comparison = snapshot.getComparisonPreview();
    const comparisonDelta = comparison.sameIdContentChanges.find(
      (change) => change.sceneId === "opening"
        && change.layer === "melody"
        && change.draftId === "memory-opening",
    );
    return {
      liveMutation: { e03, e03b, openingRef },
      liveCueResolution,
      liveMasterResolution,
      comparisonDelta,
      comparisonChangedFx: comparison.changedFx,
      scheduleOwner: runtime.scheduleRegistry.owner,
      liveScheduleCount: runtime.scheduleRegistry.liveScriptIds.length,
      canonicalScheduleCount: runtime.scheduleRegistry.canonicalPlaybackIds.length,
      expectedLiveScheduleCount: window.__echlubExpectedScriptScheduleCount,
      materialResolutionLog: [...snapshot.materialResolutionLog],
      missingMaterialLog: [...snapshot.missingMaterialLog],
      liveMutationLog: [...snapshot.liveMutationLog],
    };
  });

  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "comparison",
    { timeout: 60000 },
  );
  const completedLiveTake = await page.evaluate(() => {
    const runtime = window.__echlubDemoController.runtime;
    const comparison = window.__echlubDevSnapshot.getComparisonPreview();
    return {
      totalBars: runtime.session.arrangement.totalBars,
      sceneOrder: runtime.session.arrangement.scenes.map((ref) => `${ref.sceneId}@${ref.startBar}`),
      pendingStructuralCount: runtime.session.liveStructure.pending.length,
      appliedStructural: runtime.session.liveStructure.applied.map((entry) => ({ ...entry })),
      structuralChanges: comparison.structuralChanges,
      canonicalTotalBars: comparison.canonicalTotalBars,
      liveTotalBars: comparison.liveTotalBars,
      jamMemoryCount: window.__echlubState.history.length,
      missingMaterialCount: window.__echlubDevSnapshot.missingMaterialLog.length,
      comparisonVisible: Boolean(document.querySelector("#comparison-stage")),
      topologyVisible: Boolean(document.querySelector("#topology-stage")),
      scheduleOwner: runtime.scheduleRegistry.owner,
      liveScheduleCount: runtime.scheduleRegistry.liveScriptIds.length,
    };
  });

  // Separate transition guard: an owned Production Cue cannot survive Canonical entry.
  await page.click("#skip-production");
  await page.waitForFunction(
    () => window.__echlubDemoController.runtime.act === "production"
      && window.__echlubDemoController.runtime.session.productionComplete === false
      && window.__echlubDevSnapshot.transportState === "stopped",
    { timeout: 5000 },
  );
  const productionSkipReset = await page.evaluate(() => ({
    act: window.__echlubDemoController.runtime.act,
    productionComplete: window.__echlubDemoController.runtime.session.productionComplete,
    activeSceneId: window.__echlubState.activeSceneId,
    queueCount: window.__echlubState.queue.length,
    jamMemoryCount: window.__echlubState.history.length,
    playingSceneId: window.__echlubDevSnapshot.playingSceneId,
    cueScheduleCount: window.__echlubDevSnapshot.cueScheduleCount,
  }));
  await page.evaluate(() => window.__echlubDevSnapshot.triggerCuePreview("memory-opening"));
  await page.waitForFunction(() => window.__echlubDevSnapshot?.cueActive === true, { timeout: 3000 });
  await page.click("#skip-playback");
  try {
    await page.waitForFunction(
      () => window.__echlubDemoController?.runtime.act === "canonicalPlayback"
        && window.__echlubDemoController.runtime.scheduleRegistry.canonicalPlaybackIds.length > 0
        && window.__echlubDevSnapshot.transportState === "started",
      { timeout: 5000 },
    );
  } catch (error) {
    console.error("CANONICAL_SKIP_TIMEOUT", JSON.stringify(await page.evaluate(() => ({
      act: window.__echlubDemoController.runtime.act,
      transportState: window.__echlubDevSnapshot.transportState,
      owner: window.__echlubDemoController.runtime.scheduleRegistry.owner,
      schedules: window.__echlubDemoController.runtime.scheduleRegistry.canonicalPlaybackIds.length,
      cueActive: window.__echlubDevSnapshot.cueActive,
      masterStepCount: window.__echlubDevSnapshot.masterStepCount,
      currentBar: window.__echlubState.currentBar,
      totalBars: window.__echlubDemoController.runtime.session.arrangement.totalBars,
      resolutions: window.__echlubDevSnapshot.materialResolutionLog.filter(
        (record) => record.act === "canonicalPlayback" && record.consumer === "canonical",
      ).length,
    })), null, 2));
    console.error("PAGE_ERRORS", JSON.stringify(pageErrors));
    throw error;
  }
  const actTransitionCueCleanup = await page.evaluate(() => ({
    cueActive: window.__echlubDevSnapshot.cueActive,
    cueScheduleCount: window.__echlubDevSnapshot.cueScheduleCount,
    act: window.__echlubDemoController.runtime.act,
  }));
  const canonicalResolutionCountBeforeRestart = await page.evaluate(() =>
    window.__echlubDevSnapshot.materialResolutionLog.filter(
      (record) => record.act === "canonicalPlayback" && record.consumer === "canonical",
    ).length,
  );
  await page.click("#restart-button");
  try {
    await page.waitForFunction(
      (before) => window.__echlubDevSnapshot.materialResolutionLog.filter(
        (record) => record.act === "canonicalPlayback" && record.consumer === "canonical",
      ).length > before && window.__echlubDevSnapshot.transportState === "started",
      { timeout: 8000 },
      canonicalResolutionCountBeforeRestart,
    );
  } catch (error) {
    console.error("CANONICAL_RESTART_TIMEOUT", JSON.stringify(await page.evaluate(() => ({
      act: window.__echlubDemoController.runtime.act,
      transportState: window.__echlubDevSnapshot.transportState,
      owner: window.__echlubDemoController.runtime.scheduleRegistry.owner,
      schedules: window.__echlubDemoController.runtime.scheduleRegistry.canonicalPlaybackIds.length,
      resolutions: window.__echlubDevSnapshot.materialResolutionLog.filter(
        (record) => record.act === "canonicalPlayback" && record.consumer === "canonical",
      ).length,
      pageText: document.querySelector("#start-button")?.textContent,
    })), null, 2));
    throw error;
  }
  const canonicalRestart = await page.evaluate(() => ({
    act: window.__echlubDemoController.runtime.act,
    scheduleOwner: window.__echlubDemoController.runtime.scheduleRegistry.owner,
    canonicalScheduleCount: window.__echlubDemoController.runtime.scheduleRegistry.canonicalPlaybackIds.length,
    transportState: window.__echlubDevSnapshot.transportState,
  }));
  const canonicalResolutionCountBeforeSecondRestart = await page.evaluate(() =>
    window.__echlubDevSnapshot.materialResolutionLog.filter(
      (record) => record.act === "canonicalPlayback" && record.consumer === "canonical",
    ).length,
  );
  await page.click("#restart-button");
  await page.waitForFunction(
    (before) => window.__echlubDevSnapshot.materialResolutionLog.filter(
      (record) => record.act === "canonicalPlayback" && record.consumer === "canonical",
    ).length > before && window.__echlubDevSnapshot.transportState === "started",
    { timeout: 8000 },
    canonicalResolutionCountBeforeSecondRestart,
  );
  const canonicalSecondRestart = await page.evaluate(() => ({
    act: window.__echlubDemoController.runtime.act,
    scheduleOwner: window.__echlubDemoController.runtime.scheduleRegistry.owner,
    canonicalScheduleCount: window.__echlubDemoController.runtime.scheduleRegistry.canonicalPlaybackIds.length,
    transportState: window.__echlubDevSnapshot.transportState,
  }));

  const refsMatch = (resolution, ref) => Boolean(
    resolution
      && ref
      && resolution.draftId === ref.draftId
      && resolution.revision === ref.revision
      && resolution.fingerprint === ref.fingerprint,
  );

  const result = {
    ok: false,
    productionMutation,
    productionCueResolution: productionCue.resolution,
    productionCueCompletion: productionCue.completion,
    canonicalMaterialResolution: canonical.resolution,
    liveMutation: runtimeEvidence.liveMutation,
    liveCueResolution: runtimeEvidence.liveCueResolution,
    liveMasterResolution: runtimeEvidence.liveMasterResolution,
    comparisonDelta: runtimeEvidence.comparisonDelta,
    missingMaterialCount: runtimeEvidence.missingMaterialLog.length,
    pageErrors,
    scheduleIsolation: {
      owner: runtimeEvidence.scheduleOwner,
      liveScheduleCount: runtimeEvidence.liveScheduleCount,
      canonicalScheduleCount: runtimeEvidence.canonicalScheduleCount,
      expectedLiveScheduleCount: runtimeEvidence.expectedLiveScheduleCount,
    },
    productionSkipReset,
    actTransitionCueCleanup,
    canonicalRestart,
    canonicalSecondRestart,
    completedLiveTake,
  };

  result.ok = Boolean(
    initial.startExists
      && initial.productionSlot
      && initial.demoController
      && productionMutation.act === "production"
      && productionMutation.revision > 0
      && productionCue.resolution
      && productionCue.completion?.act === "production"
      && productionCue.completion?.transportStartedByCue === true
      && productionCue.completion?.masterSceneBefore === "idle"
      && productionCue.completion?.masterSceneDuring === "idle"
      && productionCue.completion?.cueNoteCount > 0
      && productionCue.survivingScheduleCount === 0
      && refsMatch(canonical.resolution, canonical.ref)
      && runtimeEvidence.liveMutation.e03?.afterRevision === canonical.ref.revision + 1
      && runtimeEvidence.liveMutation.e03b?.afterRevision === canonical.ref.revision + 2
      && runtimeEvidence.liveMutation.openingRef.revision > canonical.ref.revision
      && runtimeEvidence.liveMutation.openingRef.fingerprint !== canonical.ref.fingerprint
      && refsMatch(runtimeEvidence.liveCueResolution, runtimeEvidence.liveMutation.openingRef)
      && refsMatch(runtimeEvidence.liveMasterResolution, runtimeEvidence.liveMutation.openingRef)
      && runtimeEvidence.comparisonDelta?.canonicalFingerprint === canonical.ref.fingerprint
      && runtimeEvidence.comparisonDelta?.liveFingerprint === runtimeEvidence.liveMutation.openingRef.fingerprint
      && runtimeEvidence.missingMaterialLog.length === 0
      && runtimeEvidence.scheduleOwner === "live"
      && runtimeEvidence.liveScheduleCount === runtimeEvidence.expectedLiveScheduleCount
      && runtimeEvidence.canonicalScheduleCount === 0
      && productionSkipReset.act === "production"
      && productionSkipReset.productionComplete === false
      && productionSkipReset.activeSceneId === "idle"
      && productionSkipReset.queueCount === 0
      && productionSkipReset.jamMemoryCount === 0
      && productionSkipReset.playingSceneId === "idle"
      && productionSkipReset.cueScheduleCount === 0
      && actTransitionCueCleanup.act === "canonicalPlayback"
      && actTransitionCueCleanup.cueActive === false
      && actTransitionCueCleanup.cueScheduleCount === 0
      && canonicalRestart.act === "canonicalPlayback"
      && canonicalRestart.scheduleOwner === "canonical"
      && canonicalRestart.canonicalScheduleCount > 0
      && canonicalRestart.transportState === "started"
      && canonicalSecondRestart.act === "canonicalPlayback"
      && canonicalSecondRestart.scheduleOwner === "canonical"
      && canonicalSecondRestart.canonicalScheduleCount > 0
      && canonicalSecondRestart.transportState === "started"
      && completedLiveTake.canonicalTotalBars > 0
      && completedLiveTake.canonicalTotalBars === canonical.totalBars
      && completedLiveTake.liveTotalBars > completedLiveTake.canonicalTotalBars
      && completedLiveTake.totalBars === completedLiveTake.liveTotalBars
      && completedLiveTake.pendingStructuralCount === 0
      && completedLiveTake.appliedStructural.length > 0
      && completedLiveTake.appliedStructural.length === completedLiveTake.structuralChanges.length
      && completedLiveTake.jamMemoryCount > 0
      && completedLiveTake.missingMaterialCount === 0
      && completedLiveTake.comparisonVisible
      && completedLiveTake.topologyVisible
      && completedLiveTake.scheduleOwner === "none"
      && completedLiveTake.liveScheduleCount === 0
      && pageErrors.length === 0
  );

  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    join(artifactDir, "browser-causal-chain-observation.json"),
    JSON.stringify(result, null, 2),
  );
  writeFileSync(
    join(artifactDir, "material-resolution-log.jsonl"),
    jsonl(runtimeEvidence.materialResolutionLog),
  );
  writeFileSync(
    join(artifactDir, "missing-material-log.jsonl"),
    jsonl(runtimeEvidence.missingMaterialLog),
  );
  writeFileSync(
    join(artifactDir, "live-mutation-log.jsonl"),
    jsonl(runtimeEvidence.liveMutationLog),
  );

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await browser.close();
  shutdown();
}
