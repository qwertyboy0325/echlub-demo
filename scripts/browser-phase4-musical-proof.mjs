#!/usr/bin/env node
/**
 * Phase 4 musical runtime proof — lifecycle, dock round-trip, restart sparse state.
 * Targets preview server @ localhost:4173/echlub-demo/ (npm run build && npm run preview).
 */
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PHASE4_PORT ?? 4173);
const BASE = process.env.PHASE4_BASE_URL ?? `http://127.0.0.1:${PORT}/echlub-demo/`;
const OUT = "artifacts/phase4-musical";

mkdirSync(OUT, { recursive: true });

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* retry */ }
    await delay(400);
  }
  throw new Error(`Server not ready: ${url}`);
}

const preview = process.env.PHASE4_SKIP_PREVIEW
  ? null
  : spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
    });
const shutdown = () => { if (preview && !preview.killed) preview.kill("SIGTERM"); };
process.on("exit", shutdown);

await waitForServer(BASE);

async function clickNav(page, index) {
  await page.$$eval(".room-nav button", (buttons, i) => buttons[i]?.click(), index);
  await delay(250);
}

async function runBeatRange(page, fromBeat, toBeat) {
  return page.evaluate(
    async (range) => {
      const runner = window.__runPhase4WalkthroughRange;
      if (!runner) throw new Error("__runPhase4WalkthroughRange unavailable");
      return runner(range.from, range.to);
    },
    { from: fromBeat, to: toBeat },
  );
}

async function evidence(page) {
  return page.evaluate(() => window.__shellAudioEvidence?.() ?? null);
}

async function shellSnapshot(page) {
  return page.evaluate(() => ({
    exchangeCount: document.querySelectorAll(".exchange-row").length,
    activeSlot: document.querySelector(".arrangement-drop-target--active")?.textContent?.trim() ?? null,
    transportLabel: document.querySelector(".transport-bar span")?.textContent?.trim() ?? null,
  }));
}

try {
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
});

const page = await browser.newPage();
const consoleLines = [];
const pageErrors = [];
page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => pageErrors.push(String(err)));

await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
await delay(1500);

const followBtn = await page.$(".follow-controls button");
if (followBtn) await followBtn.click();
await delay(300);

const bootEvidence = await evidence(page);
const walkthroughLabels = [];
walkthroughLabels.push(...(await runBeatRange(page, 1, 9)));
await delay(400);

const dockEvidence = await evidence(page);
const dockDisplay = await page.evaluate(() => {
  const slot = document.querySelector('.dock-slot[data-slot-index="0"] .dock-slot-value');
  return slot ? Number(slot.textContent) : null;
});

walkthroughLabels.push(...(await runBeatRange(page, 10, 13)));
await delay(400);
await page.evaluate(() => {
  document.querySelector(".transport-bar button")?.click();
});
await delay(1200);
const playingEvidence = await evidence(page);

walkthroughLabels.push(...(await runBeatRange(page, 14, 17)));
await delay(600);
const postRestartEvidence = await evidence(page);
const postRestartShell = await shellSnapshot(page);

await browser.close();

const capture = {
  capturedAt: new Date().toISOString(),
  baseUrl: BASE,
  bootEvidence,
  dockEvidence,
  dockDisplayAtBeat9: dockDisplay,
  postRestartEvidence,
  postRestartShell,
  playingEvidence,
  walkthroughLabels,
  pageErrors,
  consoleTail: consoleLines.slice(-24),
  checks: {
    packLoaded: bootEvidence?.packLoaded === true,
    audioReady: bootEvidence?.audioReady === true,
    transportStarted: playingEvidence?.toneTransportState === "started",
    masterDraftActive: Boolean(playingEvidence?.activeMasterDraftId),
    sevenTrackAudible:
      typeof playingEvidence?.sevenTrackAudibleCount === "number"
      && playingEvidence.sevenTrackAudibleCount >= 7,
    activeMasterTracks:
      Array.isArray(playingEvidence?.activeMasterTracks)
      && playingEvidence.activeMasterTracks.length >= 3,
    masterLayersHydrated: Boolean(
      playingEvidence?.sevenTrackAudibleCount && playingEvidence.sevenTrackAudibleCount >= 7,
    ),
    dockRoundTrip:
      dockDisplay === 72
      && typeof dockEvidence?.mixFilter === "number"
      && Math.abs(dockEvidence.mixFilter - (200 + 0.72 * 7800)) < 50,
    restartSparse: postRestartShell.exchangeCount === 0,
    restartEpochReset: typeof postRestartEvidence?.restartEpoch === "number" && postRestartEvidence.restartEpoch >= 1,
    noPageErrors: pageErrors.length === 0,
  },
};

writeFileSync(join(OUT, "browser-console-capture.json"), JSON.stringify(capture, null, 2));
console.log(JSON.stringify(capture.checks, null, 2));
const failed = Object.entries(capture.checks).filter(([, v]) => !v);
if (failed.length) {
  console.error("Phase 4 browser checks failed:", failed.map(([k]) => k).join(", "));
  process.exitCode = 1;
}
} finally {
  shutdown();
}
