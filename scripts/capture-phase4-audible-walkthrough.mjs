#!/usr/bin/env node
/**
 * Phase 4 audible walkthrough — records master-limiter tap during presenter beats 1–17.
 */
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PHASE4_PORT ?? 4173);
const BASE = process.env.PHASE4_BASE_URL ?? `http://127.0.0.1:${PORT}/echlub-demo/`;
const OUT = "artifacts/phase4-musical";
const AUDIO_OUT = join(OUT, "phase4-audible-walkthrough.webm");
const TRACE_OUT = join(OUT, "lifecycle-event-trace.json");

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

const preview = process.env.PHASE4_SKIP_PREVIEW
  ? null
  : spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
    });
const shutdown = () => { if (preview && !preview.killed) preview.kill("SIGTERM"); };
process.on("exit", shutdown);

try {
  await waitForServer(BASE);
  writeFileSync(AUDIO_OUT, Buffer.alloc(0));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 120000,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  await page.exposeFunction("__phase4WriteAudioChunk", (base64Chunk) => {
    appendFileSync(AUDIO_OUT, Buffer.from(base64Chunk, "base64"));
  });

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction(() => window.__shellAudioEvidence?.()?.audioReady === true, { timeout: 60000 });
  await delay(500);

  await page.evaluate(() => window.__startShellAudioCapture?.());

  const followBtn = await page.$(".follow-controls button");
  if (followBtn) await followBtn.click();
  await delay(200);

  const walkthroughLabels = [];
  walkthroughLabels.push(...(await runBeatRange(page, 1, 9)));
  await delay(300);
  walkthroughLabels.push(...(await runBeatRange(page, 10, 13)));
  await delay(300);
  await page.evaluate(() => document.querySelector(".transport-bar button")?.click());
  await delay(2500);
  walkthroughLabels.push(...(await runBeatRange(page, 14, 17)));
  await delay(800);

  const capture = await page.evaluate(async () => {
    const bag = window.__phase4AudioCapture;
    if (!bag) return { chunkCount: 0, evidence: window.__shellAudioEvidence?.() ?? null };
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      bag.recorder.addEventListener("stop", () => { clearTimeout(timer); resolve(null); }, { once: true });
      bag.recorder.stop();
    });
    bag.disconnect();
    let chunkCount = 0;
    for (const chunk of bag.chunks) {
      const bytes = new Uint8Array(await chunk.arrayBuffer());
      if (!bytes.length) continue;
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      await window.__phase4WriteAudioChunk(btoa(binary));
      chunkCount += 1;
    }
    delete window.__phase4AudioCapture;
    return { chunkCount, evidence: window.__shellAudioEvidence?.() ?? null };
  });

  writeFileSync(
    TRACE_OUT,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        baseUrl: BASE,
        walkthroughLabels,
        pageErrors,
        audioFile: AUDIO_OUT,
        audioByteLength: statSync(AUDIO_OUT).size,
        chunkCount: capture.chunkCount,
        runtimeEvidence: capture.evidence,
      },
      null,
      2,
    ),
  );

  await browser.close();
  const audioByteLength = statSync(AUDIO_OUT).size;
  console.log(JSON.stringify({
    audioOut: AUDIO_OUT,
    traceOut: TRACE_OUT,
    audioByteLength,
    chunkCount: capture.chunkCount,
    sevenTrackAudibleCount: capture.evidence?.sevenTrackAudibleCount,
    masterLevelDb: capture.evidence?.masterLevelDb,
    pageErrors: pageErrors.length,
  }, null, 2));
  if (pageErrors.length || audioByteLength < 4096) process.exitCode = 1;
} finally {
  shutdown();
}
