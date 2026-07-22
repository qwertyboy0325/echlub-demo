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
const artifactDir = join(root, "artifacts/production-to-performance-r3/live-authority-final");

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
    productionSlot: Boolean(document.querySelector("#production-slot")),
    demoController: Boolean(window.__echlubDemoController),
  }));

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
    return { ref, resolution };
  });

  // Canonical identity has been observed; enter Live without waiting for the full film.
  await page.click("#skip-performance");
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.liveMutationLog.some((record) => record.eventId === "e03b"),
    { timeout: 12000 },
  );
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.materialResolutionLog.some(
      (record) => record.act === "livePerformance"
        && record.consumer === "cue"
        && record.draftId === "memory-opening",
    ),
    { timeout: 12000 },
  );
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.materialResolutionLog.some(
      (record) => record.act === "livePerformance"
        && record.consumer === "live"
        && record.sceneId === "opening"
        && record.layer === "melody"
        && record.draftId === "memory-opening",
    ),
    { timeout: 25000 },
  );

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
    const liveMasterResolution = snapshot.materialResolutionLog.find(
      (record) => record.act === "livePerformance"
        && record.consumer === "live"
        && record.sceneId === "opening"
        && record.layer === "melody"
        && record.draftId === "memory-opening",
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

  // Separate transition guard: an owned Production Cue cannot survive Canonical entry.
  await page.click("#skip-production");
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
  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "canonicalPlayback",
    { timeout: 5000 },
  );
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
  await page.waitForFunction(
    (before) => window.__echlubDevSnapshot.materialResolutionLog.filter(
      (record) => record.act === "canonicalPlayback" && record.consumer === "canonical",
    ).length > before,
    { timeout: 8000 },
    canonicalResolutionCountBeforeRestart,
  );
  const canonicalRestart = await page.evaluate(() => ({
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
