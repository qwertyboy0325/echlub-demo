#!/usr/bin/env node
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CAMPAIGN_SCREENSHOT_PORT ?? 4194);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "artifacts/collaborative-daw-campaign/evidence/screenshots");

const CAPTURES = [
  { file: "01-production-session-view.png", act: "production", waitMs: 3500 },
  { file: "02-canonical-arrangement-view.png", act: "canonicalPlayback", waitMs: 2500 },
  { file: "03-live-lowend-act.png", capability: "cap-lowend", waitMs: 1200 },
  { file: "04-live-harmony-act.png", capability: "cap-harmony", waitMs: 1200 },
  { file: "05-comparison.png", act: "comparison", waitMs: 1000 },
];

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
const log = [];

await page.goto(process.env.CAMPAIGN_BASE_URL ?? `http://localhost:${PORT}/`, {
  waitUntil: "networkidle0",
  timeout: 30000,
});
await page.click("#record-mode-button");
await delay(250);
await page.$eval("#speed-control", (input) => {
  input.value = "8";
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.click("#start-button");

for (const cap of CAPTURES) {
  if (cap.act === "production") {
    await page.waitForFunction(
      () => window.__echlubDemoController?.runtime.act === "production",
      { timeout: 10000 },
    );
    await delay(cap.waitMs);
  } else if (cap.act === "canonicalPlayback") {
    await page.waitForFunction(
      () => window.__echlubDemoController?.runtime.act === "canonicalPlayback",
      { timeout: 120000 },
    );
    await delay(cap.waitMs);
  } else if (cap.capability) {
    await page.waitForFunction(
      (capabilityId) => window.__echlubDemoController?.runtime.act === "livePerformance"
        && document.querySelector("#performance-overlay")?.getAttribute("data-active-capability") === capabilityId,
      { timeout: 120000 },
      cap.capability,
    ).catch(async () => {
      await page.waitForFunction(
        (capabilityId) => window.__echlubDemoController?.runtime?.capabilityOperationLog?.some(
          (op) => op.context.capabilityId === capabilityId,
        ),
        { timeout: 120000 },
        cap.capability,
      );
    });
    await delay(cap.waitMs);
  } else if (cap.act === "comparison") {
    await page.waitForFunction(
      () => window.__echlubDemoController?.runtime.act === "comparison",
      { timeout: 240000 },
    );
    await delay(cap.waitMs);
  }
  const path = join(outDir, cap.file);
  await page.screenshot({ path, fullPage: false });
  const meta = await page.evaluate(() => ({
    act: window.__echlubDemoController?.runtime.act,
    activeCapability: document.querySelector("#performance-overlay")?.getAttribute("data-active-capability"),
    capabilityCount: document.querySelector("#performance-overlay")?.getAttribute("data-capability-count"),
    recordingMode: document.querySelector(".app-shell")?.classList.contains("recording-mode"),
    viewport: { width: window.innerWidth, height: window.innerHeight },
  }));
  log.push({ file: cap.file, ...meta });
}

writeFileSync(join(outDir, "screenshot-log.json"), JSON.stringify(log, null, 2));
await browser.close();
console.log(JSON.stringify({ ok: log.length === CAPTURES.length, captures: log }, null, 2));
