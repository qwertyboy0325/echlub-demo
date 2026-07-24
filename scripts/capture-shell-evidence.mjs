import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

const OUT = "artifacts/shell-ready";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.ECHLUB_SHELL_PORT ?? 4178);
const BASE_PATH = process.env.ECHLUB_SHELL_BASE ?? "/echlub-demo/";
const BASE = `http://127.0.0.1:${PORT}${BASE_PATH.replace(/\/$/, "")}/`;
const RECORD = process.env.ECHLUB_SHELL_RECORD === "1";
const RECORD_OUT = join(OUT, "shell-walkthrough.webm");
const FRAMES_DIR = join(OUT, ".screencast-frames");
const ERROR_LOG = join(OUT, "capture-console-errors.json");
const FRAME_INTERVAL_MS = 250;
const FRAME_FPS = 4;

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

async function clickParticipantTab(page, label) {
  const clicked = await page.$$eval(".participant-tabs [role='tab']", (tabs, text) => {
    for (const t of tabs) {
      if (t.textContent?.trim() === text) {
        t.click();
        return true;
      }
    }
    return false;
  }, label);
  if (!clicked) throw new Error(`Participant tab not found: ${label}`);
  await wait(300);
}

async function assertDevicesTabActive(page) {
  const active = await page.$eval(
    ".participant-tabs [role='tab'][aria-selected='true']",
    (el) => el.textContent?.trim() ?? "",
  );
  if (active !== "Devices") throw new Error(`Expected Devices tab active, got: ${active}`);
  const hasRack = await page.$(".devices-panel .device-rack");
  if (!hasRack) throw new Error("Devices panel rack not visible");
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "pipe" });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk; });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`));
    });
  });
}

function createFrameRecorder(page) {
  rmSync(FRAMES_DIR, { recursive: true, force: true });
  mkdirSync(FRAMES_DIR, { recursive: true });
  let frameIndex = 0;

  return async function captureFrame() {
    const path = join(FRAMES_DIR, `frame-${String(frameIndex++).padStart(5, "0")}.jpg`);
    await page.screenshot({ path, type: "jpeg", quality: 82 });
  };
}

async function hold(page, captureFrame, shotMs, recordMs) {
  if (!RECORD) {
    await wait(shotMs);
    return;
  }
  const end = Date.now() + recordMs;
  while (Date.now() < end) {
    await captureFrame();
    await wait(FRAME_INTERVAL_MS);
  }
}

async function encodeScreencast(frameCount) {
  if (frameCount < 8) {
    throw new Error(`Walkthrough recording produced too few frames: ${frameCount}`);
  }
  await runFfmpeg([
    "-y",
    "-framerate", String(FRAME_FPS),
    "-i", join(FRAMES_DIR, "frame-%05d.jpg"),
    "-frames:v", String(frameCount),
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuv420p",
    "-b:v", "1M",
    RECORD_OUT,
  ]);
  rmSync(FRAMES_DIR, { recursive: true, force: true });
}

const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
  cwd: process.cwd(),
  stdio: "pipe",
  shell: true,
});

const captureMeta = { recording: false, recordingError: null, frameCount: 0, durationTargetSec: "45-90" };

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
  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: e.message }));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push({ type: "console", message: m.text() });
  });

  const captureFrame = RECORD ? createFrameRecorder(page) : null;
  const pause = (shotMs, recordMs) => hold(page, captureFrame, shotMs, recordMs);

  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector(".app-root");
  if (captureFrame) await captureFrame();
  await pause(500, 3000);
  await page.screenshot({ path: join(OUT, "global-studio-1440.png") });

  await clickNav(page, 1);
  await pause(400, 2500);
  await page.screenshot({ path: join(OUT, "participant-create-1440.png") });

  await clickParticipantTab(page, "Devices");
  await assertDevicesTabActive(page);
  await pause(500, 3500);
  await page.screenshot({ path: join(OUT, "participant-devices-1440.png") });

  await clickParticipantTab(page, "Automation");
  await pause(400, 2500);
  await page.screenshot({ path: join(OUT, "participant-automation-1440.png") });

  await clickNav(page, 2);
  await pause(500, 3500);
  await page.screenshot({ path: join(OUT, "mixer-dock-1440.png") });
  await page.screenshot({ path: join(OUT, "dock-8-slots-1440.png") });

  await clickNav(page, 0);
  await pause(400, 2500);
  await page.screenshot({ path: join(OUT, "lifecycle-states-1440.png") });
  await page.screenshot({ path: join(OUT, "exchange-card-states-1440.png") });

  await page.setViewport({ width: 1280, height: 720 });
  await clickNav(page, 0);
  await pause(400, 3000);
  await page.screenshot({ path: join(OUT, "global-studio-1280x720.png") });

  const toggle = await page.$(".exchange-toggle");
  if (toggle) {
    await toggle.click();
    await pause(300, 4000);
    await page.screenshot({ path: join(OUT, "exchange-drawer-1280.png") });
  }

  await page.setViewport({ width: 1440, height: 900 });
  const followBtn = await page.$(".follow-controls button");
  if (followBtn) await followBtn.click();
  await pause(200, 3000);
  await clickNav(page, 1);
  await pause(300, 4000);
  await page.screenshot({ path: join(OUT, "follow-lock-sequence.png") });

  await clickNav(page, 0);
  await pause(300, 2000);
  await page.click(".exchange-row[data-clip-id='c4']");
  await pause(200, 2000);
  const stageBtn = await page.$(".arrangement-drop-target--empty .stage-btn");
  if (stageBtn) await stageBtn.click();
  await pause(300, 4000);
  await page.screenshot({ path: join(OUT, "stage-activate-global-only.png") });

  await page.$$eval(".arrangement-drop-target--staged button", (buttons) => {
    for (const b of buttons) {
      if (b.textContent?.includes("Activate")) b.click();
    }
  });
  await pause(300, 3500);
  await page.screenshot({ path: join(OUT, "preview-vs-active-1440.png") });

  await clickNav(page, 1);
  await pause(300, 2500);
  await page.screenshot({ path: join(OUT, "room-cta-participant-1440.png") });

  await clickNav(page, 2);
  await pause(300, 2500);
  await page.screenshot({ path: join(OUT, "room-cta-mixer-1440.png") });

  await clickNav(page, 0);
  await pause(300, 2000);
  await page.screenshot({ path: join(OUT, "room-cta-global-1440.png") });

  await clickNav(page, 2);
  await page.click(".dock-mode-btn--capture");
  await page.$eval(".dock-knob", (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.$eval(".dock-fader", (el) => {
    el.value = "85";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await pause(400, 5000);
  await page.screenshot({ path: join(OUT, "source-to-dock-mapping-1440.png") });

  await clickNav(page, 0);
  await pause(300, 3000);
  await clickNav(page, 1);
  await pause(300, 2500);
  await clickNav(page, 2);
  await pause(300, 3000);
  await clickNav(page, 0);
  await pause(300, 4000);
  await page.screenshot({ path: join(OUT, "shell-walkthrough-end.png") });

  if (captureFrame) {
    const count = readdirSync(FRAMES_DIR).filter((f) => f.startsWith("frame-") && f.endsWith(".jpg")).length;
    captureMeta.frameCount = count;
    try {
      await encodeScreencast(count);
      captureMeta.recording = true;
      captureMeta.durationSec = Math.round(count / FRAME_FPS);
      console.log(`Recording saved: ${RECORD_OUT} (${count} frames, ~${captureMeta.durationSec}s)`);
    } catch (e) {
      captureMeta.recordingError = e.message;
      console.warn("Recording encode failed:", e.message);
    }
  }

  await browser.close();

  writeFileSync(ERROR_LOG, JSON.stringify({ errors, captureMeta }, null, 2));

  if (errors.length) {
    console.warn("Console errors:", errors.slice(0, 8));
    process.exitCode = 1;
  }
  console.log(`Shell evidence captured in ${OUT}`);
} finally {
  preview.kill("SIGTERM");
}
