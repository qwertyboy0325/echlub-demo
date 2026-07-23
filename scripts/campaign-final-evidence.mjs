#!/usr/bin/env node
/**
 * Campaign final-gate browser evidence collector.
 * Waits for scripted capability choreography during automatic live performance.
 */
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
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
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));

const evidence = { baseUrl, pageErrors, scenarios: {}, lifecycle: {}, timestamp: new Date().toISOString() };

function readBuildAssets() {
  const htmlPath = join(root, "docs/index.html");
  if (!existsSync(htmlPath)) return null;
  const html = readFileSync(htmlPath, "utf8");
  const jsMatch = html.match(/assets\/(index-[^"]+\.js)/);
  const cssMatch = html.match(/assets\/(index-[^"]+\.css)/);
  const jsFile = jsMatch?.[1];
  const cssFile = cssMatch?.[1];
  return {
    jsBundle: jsFile ? `docs/assets/${jsFile}` : null,
    cssBundle: cssFile ? `docs/assets/${cssFile}` : null,
    htmlReferencesJs: jsFile ? existsSync(join(root, "docs/assets", jsFile)) : false,
    htmlReferencesCss: cssFile ? existsSync(join(root, "docs/assets", cssFile)) : false,
  };
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });
  await delay(500);
  await page.click("#record-mode-button");
  await delay(250);

  const screenshotDir = join(outDir, "screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const screenshotLog = [];

  async function clickControl(selector) {
    const ok = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    }, selector);
    if (!ok) throw new Error(`Missing control: ${selector}`);
  }

  async function captureShot(file, note) {
    const shotPath = join(screenshotDir, file);
    await page.screenshot({ path: shotPath, fullPage: false });
    const meta = await page.evaluate(() => ({
      act: window.__echlubDemoController?.runtime.act,
      activeCapability: document.querySelector("#performance-overlay")?.getAttribute("data-active-capability"),
      capabilityCount: document.querySelector("#performance-overlay")?.getAttribute("data-capability-count"),
      recordingMode: document.querySelector(".app-shell")?.classList.contains("recording-mode"),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    }));
    screenshotLog.push({ file, note, ...meta });
  }

  async function collectViewportVisibility(scope = "all") {
    return page.evaluate((scopeName) => {
      function rect(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
          bottom: Math.round(r.bottom),
          right: Math.round(r.right),
        };
      }
      function isVisibleInViewport(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return (
          r.width > 0
          && r.height > 0
          && r.bottom > 0
          && r.right > 0
          && r.top < window.innerHeight
          && r.left < window.innerWidth
        );
      }
      const lowEndPanel = document.querySelector('[data-capability-stage="cap-lowend"]');
      const lowEndTarget = document.querySelector('[data-capability-stage="cap-lowend"] [data-target="lowend-private-cue"]');
      const harmonyPanel = document.querySelector('[data-capability-stage="cap-harmony"]');
      const harmonyTarget = document.querySelector('[data-capability-stage="cap-harmony"] [data-target="harmony-voice"]');
      const comparisonStage = document.querySelector("#comparison-stage");
      const comparisonCanonical = document.querySelector(".comparison-canonical");
      const comparisonLive = document.querySelector(".comparison-live");
      const payload = {
        scope: scopeName,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        lowEndPanel: { visible: isVisibleInViewport(lowEndPanel), rect: rect(lowEndPanel) },
        lowEndOperationTarget: { visible: isVisibleInViewport(lowEndTarget), rect: rect(lowEndTarget) },
        harmonyPanel: { visible: isVisibleInViewport(harmonyPanel), rect: rect(harmonyPanel) },
        harmonyOperationTarget: { visible: isVisibleInViewport(harmonyTarget), rect: rect(harmonyTarget) },
        comparisonStage: { visible: isVisibleInViewport(comparisonStage), rect: rect(comparisonStage) },
        comparisonCanonicalCard: { visible: isVisibleInViewport(comparisonCanonical), rect: rect(comparisonCanonical) },
        comparisonLiveCard: { visible: isVisibleInViewport(comparisonLive), rect: rect(comparisonLive) },
      };
      return payload;
    }, scope);
  }

  evidence.scenarios.currentSongSixCapability = await page.evaluate(() => {
    const session = window.__echlubDemoController?.runtime?.session;
    const view = session?.performanceConfig?.views?.find((v) => v.id === "current-song-performance");
    return {
      activeViewId: session?.performanceConfig.activeViewId,
      capabilityCount: view?.capabilityIds.length ?? 0,
      capabilityIds: view?.capabilityIds ?? [],
      participantCount: session?.participants.length ?? 0,
      packId: session?.packId,
      prototypePresetNote: "Six-capability view is the current-song prototype preset, not a generic topology engine.",
    };
  });

  evidence.scenarios.scriptedLiveChoreography = await page.evaluate(() => {
    const script = window.__echlubDemoController?.runtime?.pack?.livePerformanceChoreography ?? [];
    return script
      .filter((e) => e.action === "capability")
      .map((e) => ({
        id: e.id,
        at: e.at,
        capabilityId: e.capabilityId,
        capabilityOperation: e.capabilityOperation,
        label: e.label,
      }));
  });

  await page.$eval("#speed-control", (input) => {
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click("#start-button");
  await delay(1500);
  await captureShot("01-production-session-view.png", "production session grid");

  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "canonicalPlayback",
    { timeout: 120000 },
  );
  await delay(2000);
  await captureShot("02-canonical-arrangement-view.png", "canonical arrangement");

  await page.waitForFunction(
    () => window.__echlubDevSnapshot?.transportState === "started",
    { timeout: 10000 },
  );
  await clickControl("#pause-button");
  await page.waitForFunction(() => window.__echlubDevSnapshot?.transportState === "paused", { timeout: 5000 });
  await clickControl("#pause-button");
  await page.waitForFunction(() => window.__echlubDevSnapshot?.transportState === "started", { timeout: 5000 });
  evidence.lifecycle.pauseResume = { paused: true, resumed: true };

  await clickControl("#skip-performance");
  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime.act === "livePerformance",
    { timeout: 15000 },
  );

  const resolutionCountBefore = await page.evaluate(() =>
    window.__echlubDevSnapshot.materialResolutionLog.length,
  );

  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime?.capabilityOperationLog?.some(
      (op) => op.context.capabilityId === "cap-lowend" && op.operation === "privateCue",
    ),
    { timeout: 90000 },
  );
  await delay(300);
  await captureShot("03-live-lowend-act.png", "scripted low end private cue");
  evidence.scenarios.viewportAtLowEnd = await collectViewportVisibility("lowend");

  const lowEndPrivateCue = await page.evaluate(() => {
    const result = window.__echlubDemoController.runtime.capabilityOperationLog.find(
      (op) => op.context.capabilityId === "cap-lowend" && op.operation === "privateCue",
    );
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
      scriptedEventId: "cap-lowend-cue",
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
      audibleConsequence: Boolean(resolution),
    };
  }, lowEndPrivateCue?.draftId);

  await page.waitForFunction(
    () => window.__echlubDemoController?.runtime?.capabilityOperationLog?.some(
      (op) => op.context.capabilityId === "cap-harmony" && op.operation === "revision",
    ),
    { timeout: 90000 },
  );
  await delay(300);
  await captureShot("04-live-harmony-act.png", "scripted harmony revision");
  evidence.scenarios.viewportAtHarmony = await collectViewportVisibility("harmony");

  const harmonyRevision = await page.evaluate(() => {
    const result = window.__echlubDemoController.runtime.capabilityOperationLog.find(
      (op) => op.context.capabilityId === "cap-harmony" && op.operation === "revision",
    );
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
      repinnedScene: repinned ? { sceneId: repinned.sceneId, layer: repinned.layer, revision: repinned.revision, fingerprint: repinned.fingerprint } : null,
      repinCompleted: result.repinnedSceneRefs.length > 0,
      materialPublished: Boolean(result.materialRef),
      materialRef: result.materialRef,
      chordCount: draft?.harmonyChords?.length ?? 0,
      scriptedEventId: "cap-harmony-revise",
    };
  });

  await page.waitForFunction(
    (draftId, revision) => window.__echlubDevSnapshot.materialResolutionLog.some(
      (r) => r.draftId === draftId && r.revision === revision && r.act === "livePerformance",
    ),
    { timeout: 12000 },
    harmonyRevision?.draftId,
    harmonyRevision?.afterRevision,
  ).catch(() => null);

  const harmonyMaterialResolution = await page.evaluate((draftId, revision) => {
    const resolution = [...window.__echlubDevSnapshot.materialResolutionLog].reverse().find(
      (r) => r.draftId === draftId && r.revision === revision && r.act === "livePerformance",
    );
    return {
      bankVersion: window.__echlubDevSnapshot.materialBankVersion,
      resolution,
      materialResolved: Boolean(resolution),
      revisionMatchesOperation: resolution?.revision === revision,
      audibleConsequence: Boolean(
        window.__echlubDevSnapshot.cueCompletionLog.some(
          (r) => r.act === "livePerformance" && r.draftId === draftId && r.revision === revision,
        ),
      ),
    };
  }, harmonyRevision?.draftId, harmonyRevision?.afterRevision);

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
    { timeout: 180000 },
  );
  await delay(1000);
  await captureShot("05-comparison.png", "canonical vs live comparison");
  evidence.scenarios.viewportAtComparison = await collectViewportVisibility("comparison");

  evidence.screenshots = screenshotLog;

  evidence.lifecycle.fullFlow = await page.evaluate(() => ({
    act: window.__echlubDemoController.runtime.act,
    comparisonVisible: Boolean(document.querySelector("#comparison-stage")),
    topologyVisible: Boolean(document.querySelector("#topology-stage")),
    missingMaterials: window.__echlubDevSnapshot?.missingMaterialLog?.length ?? -1,
  }));

  await clickControl("#skip-playback");
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
  await clickControl("#restart-button");
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
  await clickControl("#restart-button");
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

  evidence.buildAssets = readBuildAssets();
  evidence.gitHead = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  evidence.pageErrors = pageErrors;
  const ops = evidence.scenarios.extendedCapabilityOperations;
  const vpLow = evidence.scenarios.viewportAtLowEnd;
  const vpHarmony = evidence.scenarios.viewportAtHarmony;
  const vpCompare = evidence.scenarios.viewportAtComparison;
  evidence.ok = Boolean(
    evidence.scenarios.currentSongSixCapability.capabilityCount === 6
      && evidence.scenarios.scriptedLiveChoreography.length === 2
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
      && ops.harmonyRevision?.repinCompleted
      && ops.harmonyRevision?.materialPublished
      && ops.harmonyMaterialResolution?.materialResolved
      && ops.harmonyMaterialResolution?.revisionMatchesOperation
      && ops.usedPackDraftNotPlaceholder
      && ops.materialResolutionDelta > 0
      && vpLow?.lowEndPanel?.visible
      && vpLow?.lowEndOperationTarget?.visible
      && vpHarmony?.harmonyPanel?.visible
      && vpHarmony?.harmonyOperationTarget?.visible
      && vpCompare?.comparisonStage?.visible
      && vpCompare?.comparisonCanonicalCard?.visible
      && vpCompare?.comparisonLiveCard?.visible
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
