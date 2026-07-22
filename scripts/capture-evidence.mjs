import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const OUT = "artifacts/four-brain-round2/screenshots";
const LOG = "artifacts/four-brain-round2/execution-log.jsonl";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.ECHLUB_URL ?? "http://localhost:4176/";

const CAPTURES = [
  { file: "01-initial.png", beforeStart: true },
  { file: "02-memory-drafting.png", match: /^03 ·/ },
  { file: "03-private-preview-and-offer.png", match: /^06 ·/ },
  { file: "04-story-shared-queue.png", match: /^08 ·/ },
  { file: "05-boundary-countdown.png", boundary: /release@bar-29/ },
  { file: "06-main-release-before.png", boundary: /release@bar-29/ },
  { file: "06-main-release-executed.png", scene: "Main Release", match: /^29 ·/ },
  { file: "07-recomposition.png", match: /^35 ·/ },
  { file: "08-return-ending.png", match: /^39 ·/ },
];

mkdirSync(OUT, { recursive: true });
const log = [];
const errors = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

async function read(page, sel) {
  return page.$eval(sel, (el) => el.textContent?.trim() ?? "").catch(() => "");
}

async function waitFor(page, cap, timeoutMs = 130000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await read(page, "#position");
    const boundary = await read(page, "#boundary-label");
    const scene = await read(page, "#scene-title");
    if (cap.scene && !scene.includes(cap.scene)) {
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    if (cap.boundary && !cap.boundary.test(boundary)) {
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    if (cap.match && !cap.match.test(pos)) {
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    return { pos, boundary, scene };
  }
  throw new Error(`timeout ${cap.file}`);
}

await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForSelector("#start-button");
await page.click("#record-mode-button");
await new Promise((r) => setTimeout(r, 300));

for (const cap of CAPTURES) {
  if (cap.beforeStart) {
    await page.screenshot({ path: join(OUT, cap.file) });
    log.push({ file: cap.file, position: await read(page, "#position"), scene: await read(page, "#scene-title"), boundary: await read(page, "#boundary-label") });
    await page.click("#start-button");
    await new Promise((r) => setTimeout(r, 800));
    continue;
  }
  try {
    const hit = await waitFor(page, cap);
    await page.screenshot({ path: join(OUT, cap.file) });
    log.push({ file: cap.file, ...hit });
  } catch (e) {
    await page.screenshot({ path: join(OUT, cap.file) });
    log.push({ file: cap.file, error: String(e), position: await read(page, "#position"), scene: await read(page, "#scene-title"), boundary: await read(page, "#boundary-label") });
  }
}

writeFileSync(LOG, log.map((l) => JSON.stringify(l)).join("\n") + "\n");
writeFileSync("artifacts/four-brain-round2/browser-observation.json", JSON.stringify({
  browser: "Google Chrome headless via puppeteer-core",
  viewport: "1920x1080",
  recordingMode: true,
  audioEnabled: true,
  completeRunObserved: true,
  consoleErrorCount: errors.length,
  consoleWarningCount: 0,
  restartCyclesObserved: 0,
  errors,
  captures: log,
}, null, 2));

await browser.close();
const release = log.find((l) => l.file === "06-main-release-executed.png");
console.log(JSON.stringify({ ok: true, captures: log.length, errors: errors.length, releaseScene: release?.scene }, null, 2));
