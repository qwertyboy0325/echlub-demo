import puppeteer from "puppeteer-core";
import { mkdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

const OUT = "artifacts/shell-ready";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.ECHLUB_SHELL_PORT ?? 4178);
const BASE_PATH = process.env.ECHLUB_SHELL_BASE ?? "/echlub-demo/";
const BASE = `http://127.0.0.1:${PORT}${BASE_PATH.replace(/\/$/, "")}/`;

mkdirSync(OUT, { recursive: true });

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await wait(400);
  }
  throw new Error(`Server not ready: ${url}`);
}

async function clickNav(page, index) {
  await page.$$eval(".room-nav button", (buttons, i) => buttons[i].click(), index);
}

const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
  cwd: process.cwd(),
  stdio: "pipe",
  shell: true,
});

try {
  await waitForServer(BASE);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector(".app-root");
  await page.screenshot({ path: join(OUT, "global-studio-1440.png") });

  await clickNav(page, 1);
  await wait(500);
  await page.screenshot({ path: join(OUT, "participant-create-1440.png") });

  await clickNav(page, 2);
  await wait(500);
  await page.screenshot({ path: join(OUT, "mixer-dock-1440.png") });

  await page.setViewport({ width: 1280, height: 720 });
  await clickNav(page, 0);
  await wait(400);
  await page.screenshot({ path: join(OUT, "global-studio-1280x720.png") });

  const toggle = await page.$(".exchange-toggle");
  if (toggle) {
    await toggle.click();
    await wait(300);
    await page.screenshot({ path: join(OUT, "exchange-drawer-1280.png") });
  }

  await page.setViewport({ width: 1440, height: 900 });
  const followBtn = await page.$(".follow-controls button");
  if (followBtn) await followBtn.click();
  await wait(200);
  await clickNav(page, 1);
  await wait(300);
  await page.screenshot({ path: join(OUT, "follow-lock-sequence.png") });

  await clickNav(page, 0);
  await wait(300);
  await page.$$eval(".exchange-actions button", (buttons) => {
    for (const b of buttons) {
      if (b.textContent === "Ready") b.click();
    }
  });
  await wait(200);
  const stageBtn = await page.$(".arrangement-lane button");
  if (stageBtn) await stageBtn.click();
  await wait(200);
  await page.screenshot({ path: join(OUT, "stage-activate-global-only.png") });

  await clickNav(page, 1);
  await wait(300);
  await clickNav(page, 2);
  await wait(300);
  await clickNav(page, 0);
  await page.screenshot({ path: join(OUT, "shell-walkthrough-end.png") });

  await browser.close();

  if (errors.length) console.warn("Console errors:", errors.slice(0, 8));
  console.log(`Shell evidence captured in ${OUT}`);
} finally {
  preview.kill("SIGTERM");
}
