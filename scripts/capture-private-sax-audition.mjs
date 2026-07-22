#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const packPath = resolve(process.env.PACK_PATH ?? "local-reconstruction/shiki-no-uta.score-concept.pack.json");
const outputPath = resolve(process.env.OUTPUT_PATH ?? "local-reconstruction/audio-analysis/browser-sax-reconstruction.webm");
const captureStartBar = Number(process.env.CAPTURE_START_BAR ?? 47);
const captureEndBar = Number(process.env.CAPTURE_END_BAR ?? 56);
const captureSpeed = Number(process.env.CAPTURE_SPEED ?? 1);
const captureTimeoutMs = Math.max(
  90000,
  Math.ceil((captureEndBar - captureStartBar + 2) * 4 * 60 / 89.5 / captureSpeed * 1500),
);
await access(packPath);

const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.SAX_CAPTURE_PORT ?? 4188);
const baseUrl = `http://localhost:${port}/`;
const dev = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], { stdio: "ignore" });
const shutdown = () => { if (!dev.killed) dev.kill("SIGTERM"); };
process.on("exit", shutdown);

for (let attempt = 0; attempt < 75; attempt += 1) {
  try {
    if ((await fetch(baseUrl)).ok) break;
  } catch { /* retry */ }
  if (attempt === 74) throw new Error("dev server not ready");
  await delay(200);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", async (error) => {
  const position = await page.evaluate(() => {
    const state = window.__echlubState;
    return state ? `${state.currentBar}:${state.currentBeat}:${state.currentSixteenth}` : "-1:-1:-1";
  }).catch(() => "-1:-1:-1");
  pageErrors.push(`position ${position}: ${error.stack ?? String(error)}`);
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });
  const input = await page.$("#pack-file-input");
  if (!input) throw new Error("pack file input not found");
  await input.uploadFile(packPath);
  await page.waitForFunction(() => document.querySelector("#pack-import-status")?.textContent?.includes("local only"));

  await page.$eval("#speed-control", (element) => {
    element.value = "8";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if (captureStartBar === 0) {
    await page.$eval("#speed-control", (element, speed) => {
      element.value = String(speed);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, captureSpeed);
  }
  await page.click("#skip-playback");
  await page.waitForFunction(() => window.__echlubDemoController?.runtime.act === "canonicalPlayback");
  await page.waitForFunction((bar) => (window.__echlubState?.currentBar ?? -1) >= bar, { timeout: 45000 }, captureStartBar);
  await page.$eval("#speed-control", (element, speed) => {
    element.value = String(speed);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, captureSpeed);

  await page.evaluate(async () => {
    const { audioEngine } = await import("/src/main.ts");
    const limiter = audioEngine.limiter;
    const rawContext = limiter.context.rawContext;
    const destination = rawContext.createMediaStreamDestination();
    limiter.connect(destination);
    const chunks = [];
    const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunks.push(event.data); });
    window.__saxCapture = { recorder, chunks, destination, limiter };
    recorder.start(250);
  });

  try {
    await page.waitForFunction(
      (bar) => (window.__echlubState?.currentBar ?? -1) >= bar,
      { timeout: captureTimeoutMs },
      captureEndBar,
    );
  } catch (error) {
    const stalledAtBar = await page.evaluate(() => window.__echlubState?.currentBar ?? -1).catch(() => -1);
    console.error(JSON.stringify({ stalledAtBar, pageErrors, captureTimeoutMs }, null, 2));
    throw error;
  }
  const result = await page.evaluate(async () => {
    const capture = window.__saxCapture;
    const stopped = new Promise((resolveStopped) => capture.recorder.addEventListener("stop", resolveStopped, { once: true }));
    capture.recorder.stop();
    await stopped;
    capture.limiter.disconnect(capture.destination);
    const blob = new Blob(capture.chunks, { type: "audio/webm;codecs=opus" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return {
      base64: btoa(binary),
      bar: window.__echlubState?.currentBar,
      masterLevelDb: window.__echlubDevSnapshot?.masterLevelDb,
      missingMaterialCount: window.__echlubDevSnapshot?.missingMaterialLog.length,
    };
  });
  await writeFile(outputPath, Buffer.from(result.base64, "base64"));
  console.log(JSON.stringify({ outputPath, ...result, base64: undefined, pageErrors }, null, 2));
  if (pageErrors.length || result.missingMaterialCount !== 0) process.exitCode = 1;
} finally {
  await browser.close();
  shutdown();
}
