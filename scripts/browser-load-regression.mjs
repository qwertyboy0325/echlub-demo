#!/usr/bin/env node
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.BROWSER_LOAD_PORT ?? 4183);

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
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));

await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });
const initial = await page.evaluate(() => ({
  appExists: Boolean(document.querySelector(".app-root")),
  presenterNav: Boolean(document.querySelector(".presenter-nav")),
  roomNavCount: document.querySelectorAll(".room-nav button").length,
  focusShell: Boolean(document.querySelector(".focus-shell")),
  presenceRail: Boolean(document.querySelector(".presence-rail")),
  exchangeOrToggle: Boolean(document.querySelector(".exchange-panel--rail") || document.querySelector(".exchange-toggle")),
  bodyTextLength: document.body.innerText.length,
}));

const mainRes = await page.goto(`${baseUrl}src/main.tsx`, { waitUntil: "networkidle0" });
const mainStatus = mainRes?.status() ?? 0;

await page.goto(baseUrl, { waitUntil: "networkidle0" });
await page.$$eval(".room-nav button", (buttons, i) => buttons[i].click(), 1);
await delay(400);
const participant = await page.evaluate(() => ({
  participantRoom: Boolean(document.querySelector(".room--participant")),
  tabCount: document.querySelectorAll(".participant-tabs [role='tab']").length,
}));

await page.$$eval(".room-nav button", (buttons, i) => buttons[i].click(), 2);
await delay(400);
const mixer = await page.evaluate(() => ({
  mixerRoom: Boolean(document.querySelector(".room--mixer")),
  dockSlots: document.querySelectorAll(".dock-slot").length,
}));

await browser.close();
shutdown();

const ok = initial.appExists
  && initial.presenterNav
  && initial.roomNavCount === 3
  && initial.focusShell
  && initial.presenceRail
  && initial.exchangeOrToggle
  && initial.bodyTextLength > 0
  && mainStatus < 400
  && pageErrors.length === 0
  && participant.participantRoom
  && participant.tabCount === 5
  && mixer.mixerRoom
  && mixer.dockSlots >= 6;

console.log(JSON.stringify({ ok, baseUrl, initial, mainStatus, participant, mixer, pageErrors }, null, 2));
process.exit(ok ? 0 : 1);
