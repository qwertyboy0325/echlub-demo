#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const packPath = process.env.PACK_PATH ? resolve(process.env.PACK_PATH) : "";
if (!packPath) throw new Error("PACK_PATH must point to an owner-local reconstruction pack");
await access(packPath);

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.BROWSER_LOAD_PORT ?? 4187);
const baseUrl = `http://localhost:${PORT}/`;

async function waitForServer(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(baseUrl)).ok) return true;
    } catch { /* retry */ }
    await delay(200);
  }
  return false;
}

const dev = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
});
const shutdown = () => { if (!dev.killed) dev.kill("SIGTERM"); };
process.on("exit", shutdown);

if (!(await waitForServer())) {
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
  const input = await page.$("#pack-file-input");
  if (!input) throw new Error("pack file input not found");
  await input.uploadFile(packPath);
  await page.waitForFunction(
    () => document.querySelector("#pack-import-status")?.textContent?.includes("local only"),
    { timeout: 10000 },
  );

  const evidence = await page.evaluate(() => {
    const runtime = window.__echlubDemoController.runtime;
    return {
      packId: runtime.pack.metadata.id,
      source: runtime.pack.metadata.source,
      bpmLabel: document.querySelector("#bpm-label")?.textContent?.trim(),
      barsLabel: document.querySelector("#total-bars-label")?.textContent?.trim(),
      packLabel: document.querySelector("#pack-label")?.textContent?.trim(),
      importStatus: document.querySelector("#pack-import-status")?.textContent?.trim(),
      arrangementBars: runtime.session.arrangement.totalBars,
      soundDesignMatches: JSON.stringify(window.__echlubDevSnapshot.soundDesign) === JSON.stringify(runtime.pack.soundDesign),
      tempoMapMatches: JSON.stringify(window.__echlubDevSnapshot.tempoMap) === JSON.stringify(runtime.pack.tempoMap),
      tempoBoundaryTarget: runtime.pack.tempoMap.at(-1),
      validationTargetBar: runtime.pack.sections.find((section) => section.id === "recompose")?.startBar
        ?? runtime.pack.sections.at(-1)?.startBar
        ?? 0,
      delayFeedback: window.__echlubDevSnapshot.soundDesign.master.delayFeedback,
      bassOscillator: window.__echlubDevSnapshot.soundDesign.bass.oscillator,
      pageErrors: [],
    };
  });
  await page.$eval("#speed-control", (input) => {
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const validateFullFlow = process.env.VALIDATE_FULL_FLOW === "1";
  await page.click(validateFullFlow ? "#start-button" : "#skip-playback");
  await page.waitForFunction(
    (targetBar) => window.__echlubDemoController.runtime.act === "canonicalPlayback"
      && (window.__echlubState?.currentBar ?? -1) >= targetBar,
    { timeout: 60000 },
    evidence.validationTargetBar,
  );
  evidence.tempoBoundary = await page.evaluate(() => ({
    bar: window.__echlubState.currentBar,
    baseBpm: window.__echlubDevSnapshot.currentBaseBpm,
    playingSceneId: window.__echlubDevSnapshot.playingSceneId,
    materialResolutionCount: window.__echlubDevSnapshot.materialResolutionLog.length,
    missingMaterialCount: window.__echlubDevSnapshot.missingMaterialLog.length,
    resolvedDraftIds: [...new Set(window.__echlubDevSnapshot.materialResolutionLog.map((entry) => entry.draftId))],
    masterLevelDb: window.__echlubDevSnapshot.masterLevelDb,
  }));
  evidence.tempoBoundary.masterLevelDb = await page.evaluate(async () => {
    let peak = Number.NEGATIVE_INFINITY;
    for (let sample = 0; sample < 12; sample += 1) {
      peak = Math.max(peak, window.__echlubDevSnapshot.masterLevelDb);
      await new Promise((resolveSample) => setTimeout(resolveSample, 50));
    }
    return peak;
  });
  const expectedStackDraftIds = await page.evaluate(() => [...new Set(
    Object.values(window.__echlubDemoController.runtime.pack.sceneLayerStacks ?? {})
      .flatMap((stacks) => Object.values(stacks).flat()),
  )]);
  evidence.stackDraftIds = expectedStackDraftIds;
  evidence.stackDraftsResolved = expectedStackDraftIds.every((draftId) => evidence.tempoBoundary.resolvedDraftIds.includes(draftId));
  if (process.env.VALIDATE_CANONICAL_END === "1") {
    await page.waitForFunction(
      () => window.__echlubDevSnapshot.transportState === "stopped"
        || (window.__echlubState?.currentBar ?? 0) > 240,
      { timeout: 45000 },
    );
    evidence.canonicalEnd = await page.evaluate(() => ({
      bar: window.__echlubState.currentBar,
      transportState: window.__echlubDevSnapshot.transportState,
      playingSceneId: window.__echlubDevSnapshot.playingSceneId,
      masterStepCount: window.__echlubDevSnapshot.masterStepCount,
      runtimeAct: window.__echlubDemoController.runtime.act,
      startButton: document.querySelector("#start-button")?.textContent?.trim(),
    }));
  }
  if (validateFullFlow) {
    await page.waitForFunction(
      () => window.__echlubDemoController.runtime.act === "livePerformance"
        && window.__echlubDevSnapshot.transportState === "started"
        && window.__echlubDevSnapshot.masterStepCount > 0,
      { timeout: 45000 },
    );
    evidence.fullFlowTransition = await page.evaluate(() => ({
      bar: window.__echlubState.currentBar,
      transportState: window.__echlubDevSnapshot.transportState,
      masterStepCount: window.__echlubDevSnapshot.masterStepCount,
      runtimeAct: window.__echlubDemoController.runtime.act,
      startButton: document.querySelector("#start-button")?.textContent?.trim(),
    }));
  }
  evidence.pageErrors = pageErrors;
  evidence.ok = evidence.source === "local-private"
    && evidence.soundDesignMatches
    && evidence.tempoMapMatches
    && evidence.arrangementBars > 0
    && evidence.tempoBoundary.baseBpm === evidence.tempoBoundaryTarget.bpm
    && evidence.tempoBoundary.materialResolutionCount > 0
    && evidence.tempoBoundary.missingMaterialCount === 0
    && Number.isFinite(evidence.tempoBoundary.masterLevelDb)
    && evidence.tempoBoundary.masterLevelDb > -14
    && evidence.tempoBoundary.masterLevelDb <= 0
    && evidence.stackDraftsResolved
    && (!evidence.canonicalEnd
      || (evidence.canonicalEnd.transportState === "stopped"
        && evidence.canonicalEnd.bar === evidence.arrangementBars))
    && (!validateFullFlow
      || (evidence.fullFlowTransition?.runtimeAct === "livePerformance"
        && evidence.fullFlowTransition.transportState === "started"
        && evidence.fullFlowTransition.masterStepCount > 0))
    && pageErrors.length === 0;
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.ok) process.exitCode = 1;
} finally {
  await browser.close();
  shutdown();
}
