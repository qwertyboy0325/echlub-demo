#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const OUT_DIR = "artifacts/four-brain-round2/live-runtime-gate";
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CUE_POSITION_RE = /^06 ·/;

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await delay(250);
  }
  return false;
}

async function readPosition(page) {
  return page.$eval("#position", (el) => el.textContent?.trim() ?? "");
}

async function waitForPosition(page, match, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await readPosition(page);
    if (match.test(pos)) return pos;
    await delay(250);
  }
  throw new Error(`timeout waiting for position ${match}`);
}

async function collectSnapshot(page) {
  return page.evaluate(() => ({
    executionLog: {
      run: window.__echlubExecutionLog?.run,
      transactions: window.__echlubExecutionLog?.transactions ?? [],
      cues: window.__echlubExecutionLog?.cues ?? [],
      restartPhases: window.__echlubExecutionLog?.restartPhases ?? [],
      exportJsonl: window.__echlubExecutionLog?.exportJsonl?.() ?? "",
    },
    state: {
      activeSceneId: window.__echlubState?.activeSceneId,
      queue: window.__echlubState?.queue ?? [],
      history: window.__echlubState?.history ?? [],
      currentBar: window.__echlubState?.currentBar,
      previewBrain: window.__echlubState?.previewBrain,
    },
    instrumentation: window.__echlubInstrumentation?.snapshot?.({
      queue: window.__echlubState?.queue ?? [],
      history: window.__echlubState?.history ?? [],
      mix: window.__echlubState?.mix ?? { filter: 0, delayWet: 0, faders: {} },
    }),
    expectedScriptScheduleCount: window.__echlubExpectedScriptScheduleCount,
    position: document.querySelector("#position")?.textContent?.trim() ?? "",
    sceneTitle: document.querySelector("#scene-title")?.textContent?.trim() ?? "",
  }));
}

const dev = spawn("npm", ["run", "dev"], { stdio: ["ignore", "pipe", "pipe"] });
const shutdown = () => { if (!dev.killed) dev.kill("SIGTERM"); };
process.on("exit", shutdown);
process.on("SIGINT", () => { shutdown(); process.exit(130); });

if (!(await waitForServer())) {
  shutdown();
  throw new Error("dev server not ready");
}

const consoleErrors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForSelector("#start-button");

const runSnapshots = [];

await page.click("#start-button");
await delay(800);

for (let cycle = 1; cycle <= 3; cycle += 1) {
  const pos = await waitForPosition(page, CUE_POSITION_RE);
  const snapshot = await collectSnapshot(page);
  runSnapshots.push({ cycle, milestone: "private-cue-or-later", position: pos, snapshot });
  await page.click("#restart-button");
  await delay(800);
}

let releaseSnapshot = null;
try {
  await waitForPosition(page, /^29 ·/);
  releaseSnapshot = await collectSnapshot(page);
} catch (error) {
  releaseSnapshot = { error: String(error), position: await readPosition(page) };
}

const finalSnapshot = await collectSnapshot(page);
mkdirSync(OUT_DIR, { recursive: true });

const browserObservation = {
  command: "node scripts/collect-live-runtime.mjs",
  port: PORT,
  baseUrl: BASE_URL,
  runSnapshots,
  releaseSnapshot,
  finalSnapshot,
  consoleErrors,
  collectedAt: new Date().toISOString(),
};

writeFileSync(join(OUT_DIR, "browser-live-observation.json"), JSON.stringify(browserObservation, null, 2));
writeFileSync(join(OUT_DIR, "live-execution-log.jsonl"), finalSnapshot.executionLog.exportJsonl);
writeFileSync(
  join(OUT_DIR, "restart-phase-records.jsonl"),
  finalSnapshot.executionLog.restartPhases.map((r) => JSON.stringify(r)).join("\n") + (finalSnapshot.executionLog.restartPhases.length ? "\n" : ""),
);

await browser.close();
shutdown();
console.log(JSON.stringify({
  ok: consoleErrors.length === 0,
  restartPhases: finalSnapshot.executionLog.restartPhases.length,
  cueRecords: finalSnapshot.executionLog.cues.length,
  consoleErrors: consoleErrors.length,
}, null, 2));
