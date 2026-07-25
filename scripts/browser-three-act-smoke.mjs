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

async function clickRoomNav(page, index) {
  await page.$$eval(".room-nav button", (buttons, i) => buttons[i].click(), index);
  await delay(300);
}

async function clickExchangeCta(page, labelSubstring) {
  const buttons = await page.$$(".exchange-room-cta button");
  for (const btn of buttons) {
    const label = await page.evaluate((el) => el.textContent?.trim() ?? "", btn);
    if (!label.includes(labelSubstring)) continue;
    const disabled = await page.evaluate(
      (el) => el.disabled || el.getAttribute("aria-disabled") === "true",
      btn,
    );
    if (disabled) throw new Error(`Exchange CTA disabled: ${labelSubstring}`);
    await btn.click();
    await delay(200);
    return;
  }
  throw new Error(`Exchange CTA unavailable: ${labelSubstring}`);
}

async function clickRowWithChip(page, chipClass, innerSelector) {
  const clicked = await page.evaluate(
    ({ chip, sel }) => {
      const row = [...document.querySelectorAll(".exchange-row")].find((r) => r.querySelector(`.${chip}`));
      const target = row?.querySelector(sel);
      if (!target) return false;
      target.click();
      return true;
    },
    { chip: chipClass, sel: innerSelector },
  );
  if (!clicked) throw new Error(`Row action missing: ${chipClass} ${innerSelector}`);
  await delay(200);
}

/** Phase 4 sparse state: seed a Ready clip via Participant Share → Fork → Review → Ready. */
async function seedReadyClipViaUi(page) {
  await clickRoomNav(page, 1);

  if (await page.$(".exchange-row .chip-ready")) {
    await clickRowWithChip(page, "chip-ready", ".exchange-row-head");
    return;
  }

  if (!(await page.$(".exchange-row"))) {
    await clickExchangeCta(page, "Share revision");
  }

  if (await page.$(".exchange-row .chip-available")) {
    await clickRowWithChip(page, "chip-available", ".exchange-primary-action");
  }

  if (await page.$(".exchange-row .chip-progress")) {
    await clickExchangeCta(page, "Submit for review");
  }

  if (await page.$(".exchange-row .chip-review")) {
    await clickRowWithChip(page, "chip-review", ".exchange-primary-action");
  }

  if (!(await page.$(".exchange-row .chip-ready"))) {
    throw new Error("Failed to seed Ready clip via UI");
  }
  await clickRowWithChip(page, "chip-ready", ".exchange-row-head");
}

async function selectReadyExchangeRow(page) {
  if (await page.$(".exchange-row .chip-ready")) {
    await clickRowWithChip(page, "chip-ready", ".exchange-row-head");
    return true;
  }
  const first = await page.$(".exchange-row");
  if (first) {
    await first.click();
    await delay(100);
    return true;
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

await clickRoomNav(page, 1);
const followLocked = await page.evaluate(() => Boolean(document.querySelector(".follow-chip--locked")));

await seedReadyClipViaUi(page);

await clickRoomNav(page, 0);
const selectedRow = await selectReadyExchangeRow(page);
if (!selectedRow) throw new Error("No exchange row to select for stage test");

const stageControls = await page.evaluate(() => ({
  stageButton: Boolean(document.querySelector(".arrangement-drop-target--empty .stage-btn")),
  activateOnlyGlobal: !document.querySelector(".room--participant .arrangement-drop-target"),
}));

await clickRoomNav(page, 1);
const noStageInParticipant = await page.evaluate(() => !document.querySelector(".arrangement-drop-target"));

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
  note: "Phase 4 shell smoke — sparse exchange seeded via Share revision flow",
}, null, 2));
process.exit(ok ? 0 : 1);
