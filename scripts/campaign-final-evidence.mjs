#!/usr/bin/env node
/**
 * Campaign final-gate browser evidence collector.
 * Executes extended capability operations and records causal consequences.
 */
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CAMPAIGN_EVIDENCE_PORT ?? 4193);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "artifacts/collaborative-daw-campaign/evidence");

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch { /* retry */ }
    await delay(200);
  }
  return false;
}

const dev = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});
let devLog = "";
dev.stdout?.on("data", (chunk) => { devLog += String(chunk); });
dev.stderr?.on("data", (chunk) => { devLog += String(chunk); });
const shutdown = () => { if (!dev.killed) dev.kill("SIGTERM"); };
process.on("exit", shutdown);

const baseUrl = process.env.CAMPAIGN_BASE_URL ?? `http://localhost:${PORT}/`;
if (!(await waitForServer(baseUrl))) {
  shutdown();
  throw new Error(`dev server not ready at ${baseUrl}\n${devLog.slice(-2000)}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));

const evidence = { baseUrl, pageErrors, scenarios: {}, lifecycle: {}, timestamp: new Date().toISOString() };

try {
  await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });
  await delay(500);

  evidence.scenarios.currentSongSixCapability = await page.evaluate(() => {
    const session = window.__echlubDemoController?.runtime?.session;
    const view = session?.performanceConfig?.views?.find((v) => v.id === "current-song-performance");
    return {
      activeViewId: session?.performanceConfig.activeViewId,
      capabilityCount: view?.capabilityIds.length ?? 0,
      capabilityIds: view?.capabilityIds ?? [],
      participantCount: session?.participants.length ?? 0,
      packId: session?.packId,
    };
  });

  await page.$eval("#speed-control", (input) => {
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click("#start-button");
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.transportState === "started"
      || window.__echlubDemoController?.runtime.act !== "production",
    { timeout: 20000 },
  );

  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "canonicalPlayback",
    { timeout: 90000 },
  );

  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.transportState === "started",
    { timeout: 10000 },
  );
  await page.click("#pause-button");
  await page.waitForFunction(() => window.__echlubDevSnapshot?.transportState === "paused", { timeout: 5000 });
  await page.click("#pause-button");
  await page.waitForFunction(() => window.__echlubDevSnapshot?.transportState === "started", { timeout: 5000 });
  evidence.lifecycle.pauseResume = { paused: true, resumed: true };

  await page.click("#skip-performance");
  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "livePerformance",
    { timeout: 15000 },
  );
  await delay(400);

  const resolutionCountBefore = await page.evaluate(() =>
    window.__echlubDevSnapshot.materialResolutionLog.length,
  );

  const lowEndPrivateCue = await page.evaluate(() => {
    const result = window.__echlubDemoController.executeCapabilityOperation("cap-lowend", "privateCue");
    if (!result) return null;
    const draft = window.__echlubState.drafts[result.context.draftId];
    return {
      operation: result.operation,
      capabilityId: result.context.capabilityId,
      participantId: result.context.participantId,
      trackId: result.context.trackId,
      draftId: result.context.draftId,
      draftStatus: draft?.status,
      beforeRevision: result.beforeRevision,
      afterRevision: result.afterRevision,
      materialRef: result.materialRef,
      cueStarted: result.cueStarted,
    };
  });

  await page.waitForFunction(
    (draftId) => window.__echlubDevSnapshot.materialResolutionLog.some(
      (r) => r.act === "livePerformance" && r.consumer === "cue" && r.draftId === draftId,
    ),
    { timeout: 8000 },
    lowEndPrivateCue?.draftId,
  );

  const lowEndCueResolution = await page.evaluate((draftId) => {
    const resolution = [...window.__echlubDevSnapshot.materialResolutionLog].reverse().find(
      (r) => r.act === "livePerformance" && r.consumer === "cue" && r.draftId === draftId,
    );
    return {
      resolution,
      cueActive: window.__echlubDevSnapshot.cueActive,
      cueCompletion: window.__echlubDevSnapshot.cueCompletionLog.find(
        (r) => r.act === "livePerformance" && r.draftId === draftId,
      ),
    };
  }, lowEndPrivateCue?.draftId);

  const harmonyRevision = await page.evaluate(() => {
    const beforeRev = window.__echlubDemoController.runtime.lastCapabilityOperation?.afterRevision;
    const result = window.__echlubDemoController.executeCapabilityOperation("cap-harmony", "revision");
    if (!result) return null;
    const draft = window.__echlubState.drafts[result.context.draftId];
    const repinned = result.repinnedSceneRefs[0];
    return {
      operation: result.operation,
      capabilityId: result.context.capabilityId,
      participantId: result.context.participantId,
      trackId: result.context.trackId,
      draftId: result.context.draftId,
      draftStatus: draft?.status,
      beforeRevision: result.beforeRevision,
      afterRevision: result.afterRevision,
      revisionIncreased: result.afterRevision > result.beforeRevision,
      fingerprintChanged: result.afterFingerprint !== result.beforeFingerprint,
      repinnedScene: repinned ? { sceneId: repinned.sceneId, layer: repinned.layer, fingerprint: repinned.fingerprint } : null,
      chordCount: draft?.harmonyChords?.length ?? 0,
      priorOperationRevision: beforeRev,
    };
  });

  const harmonyMaterialResolution = await page.evaluate((draftId) => {
    const bankVersion = window.__echlubDevSnapshot.materialBankVersion;
    const resolution = [...window.__echlubDevSnapshot.materialResolutionLog].reverse().find(
      (r) => r.draftId === draftId && r.revision > 0,
    );
    return { bankVersion, resolution };
  }, harmonyRevision?.draftId);

  const resolutionCountAfter = await page.evaluate(() =>
    window.__echlubDevSnapshot.materialResolutionLog.length,
  );

  evidence.scenarios.extendedCapabilityOperations = {
    lowEndPrivateCue,
    lowEndCueResolution,
    harmonyRevision,
    harmonyMaterialResolution,
    materialResolutionDelta: resolutionCountAfter - resolutionCountBefore,
    usedPackDraftNotPlaceholder: lowEndPrivateCue?.draftId
      ? !["bass-main", "bass-alt"].includes(lowEndPrivateCue.draftId)
      : false,
  };

  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "comparison",
    { timeout: 120000 },
  );

  evidence.lifecycle.fullFlow = await page.evaluate(() => ({
    act: window.__echlubDemoController.runtime.act,
    comparisonVisible: Boolean(document.querySelector("#comparison-stage")),
    topologyVisible: Boolean(document.querySelector("#topology-stage")),
    missingMaterials: window.__echlubDevSnapshot?.missingMaterialLog?.length ?? -1,
  }));

  await page.click("#skip-playback");
  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "canonicalPlayback"
      && window.__echlubDevSnapshot?.transportState === "started",
    { timeout: 10000 },
  );

  const resBefore = await page.evaluate(() =>
    window.__echlubDevSnapshot.materialResolutionLog.filter(
      (r) => r.act === "canonicalPlayback" && r.consumer === "canonical",
    ).length,
  );
  await page.click("#restart-button");
  await page.waitForFunction(
    (before) => window.__echlubDevSnapshot.materialResolutionLog.filter(
      (r) => r.act === "canonicalPlayback" && r.consumer === "canonical",
    ).length > before && window.__echlubDevSnapshot.transportState === "started",
    { timeout: 10000 },
    resBefore,
  );
  const resBefore2 = await page.evaluate(() =>
    window.__echlubDevSnapshot.materialResolutionLog.filter(
      (r) => r.act === "canonicalPlayback" && r.consumer === "canonical",
    ).length,
  );
  await page.click("#restart-button");
  await page.waitForFunction(
    (before) => window.__echlubDevSnapshot.materialResolutionLog.filter(
      (r) => r.act === "canonicalPlayback" && r.consumer === "canonical",
    ).length > before && window.__echlubDevSnapshot.transportState === "started",
    { timeout: 10000 },
    resBefore2,
  );

  evidence.lifecycle.canonicalDoubleRestart = {
    firstRestartOk: true,
    secondRestartOk: true,
    transportState: await page.evaluate(() => window.__echlubDevSnapshot.transportState),
  };

  evidence.pageErrors = pageErrors;
  const ops = evidence.scenarios.extendedCapabilityOperations;
  evidence.ok = Boolean(
    evidence.scenarios.currentSongSixCapability.capabilityCount === 6
      && ops.lowEndPrivateCue?.capabilityId === "cap-lowend"
      && ops.lowEndPrivateCue?.participantId
      && ops.lowEndPrivateCue?.trackId
      && ops.lowEndPrivateCue?.draftId
      && ops.lowEndPrivateCue?.draftStatus === "preview"
      && ops.lowEndPrivateCue?.cueStarted
      && ops.lowEndCueResolution?.resolution
      && ops.harmonyRevision?.capabilityId === "cap-harmony"
      && ops.harmonyRevision?.revisionIncreased
      && ops.harmonyRevision?.fingerprintChanged
      && ops.harmonyRevision?.repinnedScene
      && ops.usedPackDraftNotPlaceholder
      && ops.materialResolutionDelta > 0
      && evidence.lifecycle.pauseResume.paused
      && evidence.lifecycle.pauseResume.resumed
      && evidence.lifecycle.fullFlow.missingMaterials === 0
      && evidence.lifecycle.canonicalDoubleRestart.secondRestartOk
      && pageErrors.length === 0,
  );
} finally {
  await browser.close();
  shutdown();
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "campaign-final-evidence.json"), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
process.exit(evidence.ok ? 0 : 1);
