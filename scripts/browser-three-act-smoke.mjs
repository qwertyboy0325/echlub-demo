#!/usr/bin/env node
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.BROWSER_LOAD_PORT ?? 4185);

async function waitForServer(url, timeoutMs = 45000) {
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

const dev = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});
const shutdown = () => { if (!dev.killed) dev.kill("SIGTERM"); };
process.on("exit", shutdown);

const baseUrl = `http://127.0.0.1:${PORT}/`;
if (!(await waitForServer(baseUrl))) {
  shutdown();
  throw new Error("dev server not ready");
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));

await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });

const followBtn = await page.$(".follow-controls button");
if (followBtn) await followBtn.click();
await delay(200);

await page.$$eval(".room-nav button", (buttons, i) => buttons[i].click(), 1);
await delay(300);
const followLocked = await page.evaluate(() => Boolean(document.querySelector(".follow-chip--locked")));

await page.$$eval(".room-nav button", (buttons, i) => buttons[i].click(), 0);
await delay(300);
await page.$$eval(".exchange-actions button", (buttons) => {
  for (const b of buttons) {
    if (b.textContent === "Ready") b.click();
  }
});
await delay(200);

const stageControls = await page.evaluate(() => ({
  stageButton: Boolean(document.querySelector(".arrangement-lane button")),
  activateOnlyGlobal: !document.querySelector(".room--participant .arrangement-lane"),
}));

await page.$$eval(".room-nav button", (buttons, i) => buttons[i].click(), 1);
await delay(200);
const noStageInParticipant = await page.evaluate(() => !document.querySelector(".arrangement-lane"));

await browser.close();
shutdown();

const ok = followLocked
  && stageControls.stageButton
  && stageControls.activateOnlyGlobal
  && noStageInParticipant
  && pageErrors.length === 0;

console.log(JSON.stringify({
  ok,
  followLocked,
  stageControls,
  noStageInParticipant,
  pageErrors,
  note: "Phase 3A shell smoke — three-act demo deferred to Phase 4",
}, null, 2));
process.exit(ok ? 0 : 1);
