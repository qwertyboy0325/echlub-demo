#!/usr/bin/env node
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.BROWSER_LOAD_PORT ?? 4183);

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // retry
    }
    await delay(200);
  }
  return false;
}

const dev = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], {
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
page.on("pageerror", (err) => pageErrors.push(String(err)));

await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });
const initial = await page.evaluate(() => ({
  appExists: Boolean(document.querySelector("#app")),
  startButtonExists: Boolean(document.querySelector("#start-button")),
  brainWindowCount: document.querySelectorAll(".brain-window").length,
  sceneTitle: document.querySelector("#scene-title")?.textContent ?? "",
  bodyTextLength: document.body.innerText.length,
}));

const mainRes = await page.goto(`${baseUrl}src/main.ts`, { waitUntil: "networkidle0" });
const mainStatus = mainRes?.status() ?? 0;

await page.goto(baseUrl, { waitUntil: "networkidle0" });
await page.click("#start-button");
await delay(2000);
const afterStart = await page.evaluate(() => document.querySelector("#position")?.textContent?.trim() ?? "");

await page.click("#restart-button");
await delay(1000);
const afterRestart = await page.evaluate(() => ({
  startButtonExists: Boolean(document.querySelector("#start-button")),
  brainWindowCount: document.querySelectorAll(".brain-window").length,
}));

await browser.close();
shutdown();

const ok = initial.appExists
  && initial.startButtonExists
  && initial.brainWindowCount === 4
  && initial.sceneTitle.length > 0
  && initial.bodyTextLength > 0
  && mainStatus < 400
  && pageErrors.length === 0
  && afterStart.length > 0
  && afterRestart.startButtonExists
  && afterRestart.brainWindowCount === 4;

console.log(JSON.stringify({ ok, baseUrl, initial, mainStatus, afterStart, afterRestart, pageErrors }, null, 2));
process.exit(ok ? 0 : 1);
