#!/usr/bin/env node
/**
 * Campaign final-gate browser evidence collector.
 * Records topology scenarios, lifecycle (pause/resume/restart), and material health.
 */
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CAMPAIGN_EVIDENCE_PORT ?? 4192);
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

  evidence.scenarios.currentSongSixCapability = await page.evaluate(() => {
    const session = window.__echlubDemoController?.runtime?.session;
    const view = session?.performanceConfig?.views?.find((v) => v.id === "current-song-performance");
    return {
      activeViewId: session?.performanceConfig.activeViewId,
      capabilityCount: view?.capabilityIds.length ?? 0,
      capabilityIds: view?.capabilityIds ?? [],
      participantCount: session?.participants.length ?? 0,
    };
  });

  evidence.scenarios.legacyFourCapability = await page.evaluate(() => {
    const session = window.__echlubDemoController.runtime.session;
    const legacy = session.performanceConfig.views.find((v) => v.legacyPreset === "four-capability");
    session.performanceConfig.activeViewId = legacy.id;
    const view = session.performanceConfig.views.find((v) => v.id === legacy.id);
    return {
      activeViewId: session.performanceConfig.activeViewId,
      capabilityCount: view?.capabilityIds.length,
      capabilityIds: view?.capabilityIds,
      participantCountUnchanged: session.participants.length,
    };
  });

  await page.evaluate(() => {
    const session = window.__echlubDemoController.runtime.session;
    const current = session.performanceConfig.views.find((v) => v.id === "current-song-performance");
    if (current) session.performanceConfig.activeViewId = current.id;
  });

  evidence.scenarios.topologyAssignments = await page.evaluate(() => {
    const session = window.__echlubDemoController.runtime.session;
    const config = session.performanceConfig;
    const multiTrackWs = session.workspaces
      .slice()
      .sort((a, b) => b.trackIds.length - a.trackIds.length)[0];
    const rhythmShared = config.assignments.filter((a) => a.capabilityId === "cap-rhythm");
    const rhythmParticipants = [...new Set(rhythmShared.map((a) => a.participantId))];
    const byParticipant = config.assignments.reduce((acc, a) => {
      (acc[a.participantId] ??= new Set()).add(a.capabilityId);
      return acc;
    }, {});
    const multiCap = Object.entries(byParticipant).find(([, caps]) => caps.size > 1);
    return {
      multiTrackWorkspace: multiTrackWs ? { id: multiTrackWs.id, trackCount: multiTrackWs.trackIds.length, participantId: multiTrackWs.participantId } : null,
      rhythmSharedParticipantCount: rhythmParticipants.length,
      rhythmParticipantIds: rhythmParticipants,
      participantWithMultipleCapabilities: multiCap
        ? { participantId: multiCap[0], capabilityIds: [...multiCap[1]] }
        : null,
    };
  });

  await page.$eval("#speed-control", (input) => {
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click("#start-button");
  await page.waitForFunction(
    () => (window.__echlubDemoController?.runtime.productionActionIndex ?? 0) >= 1,
    { timeout: 15000 },
  );

  evidence.lifecycle.productionStarted = await page.evaluate(() => ({
    act: window.__echlubDemoController.runtime.act,
    actionIndex: window.__echlubDemoController.runtime.productionActionIndex,
    missingMaterials: window.__echlubDevSnapshot?.missingMaterialLog?.length ?? -1,
  }));

  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "canonicalPlayback",
    { timeout: 90000 },
  );

  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.transportState === "started",
    { timeout: 10000 },
  );
  await page.click("#pause-button");
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.transportState === "paused",
    { timeout: 5000 },
  );
  const paused = true;
  await page.click("#pause-button");
  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.transportState === "started",
    { timeout: 5000 },
  );
  const resumed = true;
  evidence.lifecycle.pauseResume = { paused, resumed };

  evidence.lifecycle.productionComplete = await page.evaluate(() => {
    const session = window.__echlubDemoController.runtime.session;
    const bass = window.__echlubState.drafts["bass-main"] ?? session.drafts["bass-main"];
    const harmony = window.__echlubState.drafts["story-opening"] ?? session.drafts["story-opening"];
    return {
      productionComplete: session.productionComplete,
      bassNoteCount: bass?.notes?.length ?? 0,
      harmonyChordCount: harmony?.harmonyChords?.length ?? 0,
      missingMaterials: window.__echlubDevSnapshot?.missingMaterialLog?.length ?? -1,
    };
  });

  await page.click("#skip-performance");
  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "livePerformance",
    { timeout: 15000 },
  );
  await delay(500);

  evidence.scenarios.liveCapabilityPanels = await page.evaluate(() => {
    const overlay = document.querySelector("#performance-overlay");
    const lowend = document.querySelector("[data-capability-workspace=\"cap-lowend\"]");
    const harmony = document.querySelector("[data-capability-workspace=\"cap-harmony\"]");
    const legacyBrainPanels = document.querySelectorAll("[data-brain] .brain-workspace").length;
    const extendedPanels = document.querySelectorAll("[data-capability]:not([data-brain]) .capability-workspace").length;
    return {
      overlayVisible: Boolean(overlay),
      capabilityCount: overlay?.getAttribute("data-capability-count"),
      lowEndOperational: Boolean(lowend?.querySelector(".piano-note")),
      lowEndNoteCount: lowend?.querySelectorAll(".piano-note").length ?? 0,
      harmonyOperational: Boolean(harmony?.querySelector(".chord-block")),
      harmonyChordBlockCount: harmony?.querySelectorAll(".chord-block").length ?? 0,
      legacyBrainPanels,
      extendedCapabilityPanels: extendedPanels,
    };
  });

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
  evidence.ok = Boolean(
    evidence.scenarios.currentSongSixCapability.capabilityCount === 6
      && evidence.scenarios.legacyFourCapability.capabilityCount === 4
      && evidence.scenarios.topologyAssignments.rhythmSharedParticipantCount >= 2
      && evidence.scenarios.topologyAssignments.multiTrackWorkspace?.trackCount > 1
      && evidence.scenarios.topologyAssignments.participantWithMultipleCapabilities?.capabilityIds.length >= 2
      && evidence.lifecycle.productionComplete.harmonyChordCount > 0
      && evidence.scenarios.liveCapabilityPanels.lowEndNoteCount > 0
      && evidence.scenarios.liveCapabilityPanels.lowEndOperational
      && evidence.scenarios.liveCapabilityPanels.harmonyOperational
      && evidence.lifecycle.pauseResume.paused
      && evidence.lifecycle.pauseResume.resumed
      && evidence.lifecycle.fullFlow.missingMaterials === 0
      && evidence.lifecycle.productionComplete.missingMaterials === 0
      && evidence.lifecycle.canonicalDoubleRestart.secondRestartOk
      && evidence.lifecycle.fullFlow.comparisonVisible
      && evidence.lifecycle.fullFlow.topologyVisible
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
