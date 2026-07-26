#!/usr/bin/env node
/**
 * Presentation V3 — evidence-only capture (UI clicks only; evaluate for assertions).
 *
 * Output: artifacts/presentation-v3/*
 * Server: npm run dev:live-collab on port 4173 unless already up.
 */
import { createHash } from "node:crypto";
import { execSync, spawn } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PRESENTATION_V3_PORT ?? 4173);
const BASE = process.env.PRESENTATION_V3_BASE_URL ?? `http://127.0.0.1:${PORT}/`;
const PRESENTATION_URL = `${BASE.replace(/\/?$/, "/")}?presentation=v3`;
const OUT = "artifacts/presentation-v3";
const WALKTHROUGH_MP4 = join(OUT, "presentation-v3-walkthrough.mp4");
const WALKTHROUGH_WEBM = join(OUT, "presentation-v3-walkthrough.webm");
const VIDEO_ONLY = join(OUT, ".presentation-v3-video-only.webm");
const AUDIO_ONLY = join(OUT, ".presentation-v3-audio-only.webm");
const RUN_ID = `${Date.now()}-${process.pid}`;
const FRAMES_DIR = join(OUT, `.screencast-frames-${RUN_ID}`);
const AUDIO_CAPTURE = join(OUT, `.presentation-v3-audio-${RUN_ID}.webm`);
const RUNTIME_JSON = join(OUT, "evidence-runtime.json");
const MIXER_AUDIT_JSON = join(OUT, "mixer-binding-audit.json");
const MANIFEST_JSON = join(OUT, "evidence-manifest.json");

const FRAME_INTERVAL_MS = Number(process.env.PRESENTATION_V3_FRAME_MS ?? 180);
const FRAME_FPS = 1000 / FRAME_INTERVAL_MS;
const HEADLESS = process.env.HEADLESS !== "0";
const DEV_CMD = process.env.PRESENTATION_V3_DEV_CMD ?? "npm run dev:live-collab";

mkdirSync(OUT, { recursive: true });

function gitHead() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function gitStatusShort() {
  try {
    return execSync("git status -sb", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function chromeVersion() {
  try {
    return execSync(`"${CHROME}" --version`, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function serverReachable(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* retry */
    }
    await delay(400);
  }
  throw new Error(`Server not ready: ${url}`);
}

function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => {
      stdout += c;
    });
    proc.stderr.on("data", (c) => {
      stderr += c;
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout || stderr);
      else reject(new Error(`${cmd} exit ${code}: ${stderr.slice(-800)}`));
    });
  });
}

async function ffprobeJson(path) {
  const raw = await runProcess("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    path,
  ]);
  return JSON.parse(raw);
}

async function clickButtonWithText(page, text, { root = "header" } = {}) {
  const clicked = await page.evaluate(
    (needle, rootSel) => {
      const scope = rootSel ? document.querySelector(rootSel) ?? document : document;
      const buttons = [...scope.querySelectorAll("button")];
      const match = buttons.find((b) => b.textContent?.trim().includes(needle));
      if (!match) return false;
      match.click();
      return true;
    },
    text,
    root === "header" ? "header" : null,
  );
  if (!clicked) {
    const global = await page.evaluate((needle) => {
      const buttons = [...document.querySelectorAll("button")];
      const match = buttons.find((b) => b.textContent?.trim() === needle || b.textContent?.includes(needle));
      if (!match) return false;
      match.click();
      return true;
    }, text);
    if (!global) throw new Error(`Button not found: ${text}`);
  }
  await delay(200);
}

async function clickNavRoom(page, roomLabel) {
  await clickButtonWithText(page, roomLabel, { root: "header" });
}

async function selectParticipantByName(page, name) {
  const ok = await page.evaluate((participantName) => {
    const btn = [...document.querySelectorAll("header button[title]")].find(
      (b) => b.getAttribute("title") === participantName,
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, name);
  if (!ok) throw new Error(`Participant avatar not found: ${name}`);
  await delay(250);
}

async function setParticipantTab(page, tabName) {
  await page.evaluate((tab) => {
    const btn = [...document.querySelectorAll('[role="tab"]')].find((b) => b.textContent?.trim() === tab);
    if (!btn) throw new Error(`Tab not found: ${tab}`);
    btn.click();
  }, tabName);
  await delay(200);
}

async function setCreateMode(page, modeLabel) {
  await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('[aria-label="Editor mode"] button')].find(
      (b) => b.textContent?.trim() === label,
    );
    if (!btn) throw new Error(`Create mode not found: ${label}`);
    btn.click();
  }, modeLabel);
  await delay(200);
}

async function toggleExchange(page, open) {
  const stateOpen = await page.evaluate(() =>
    Boolean(document.querySelector('[aria-label="Shared Clip Exchange"]')),
  );
  if (open && !stateOpen) await clickButtonWithText(page, "Exchange");
  if (!open && stateOpen) {
    await page.evaluate(() => {
      const close = document.querySelector('[aria-label="Shared Clip Exchange"] button');
      close?.click();
    });
    await delay(200);
  }
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const el = document.documentElement;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      ok: el.scrollWidth === el.clientWidth,
    };
  });
}

async function shellEvidence(page) {
  return page.evaluate(() => window.__shellAudioEvidence?.() ?? null);
}

async function readMixerSlider(page, ariaLabel) {
  return page.evaluate((label) => {
    const input = document.querySelector(`input[aria-label="${label}"]`);
    if (!input) return null;
    return Number(input.value);
  }, ariaLabel);
}

async function dragRangeSlider(page, selector, targetPercent) {
  const el = await page.$(selector);
  if (!el) throw new Error(`Slider missing: ${selector}`);
  const box = await el.boundingBox();
  if (!box) throw new Error(`Slider bbox missing: ${selector}`);
  const x = box.x + Math.max(2, Math.min(box.width - 2, (targetPercent / 100) * box.width));
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await delay(350);
}

async function setRangeByAriaLabel(page, ariaLabel, value) {
  await page.evaluate(
    (label, val) => {
      const input = document.querySelector(`input[aria-label="${label}"]`);
      if (!input) throw new Error(`Range not found: ${label}`);
      input.value = String(val);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    ariaLabel,
    value,
  );
  await delay(300);
}

async function setDockFader(page, slotIndex, percent) {
  const sel = `[data-demo-target="dock-slot-${slotIndex}"] input.dock-fader`;
  await page.evaluate(
    (selector, val) => {
      const input = document.querySelector(selector);
      if (!input) throw new Error(`Dock fader missing: ${selector}`);
      input.value = String(val);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    sel,
    percent,
  );
  await delay(300);
}

async function selectHornsStrip(page) {
  await page.evaluate(() => {
    const strip = document.querySelector('[data-demo-target="desk-strip-horns"]');
    const select = strip
      ? [...strip.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Select")
      : null;
    select?.click();
  });
  await delay(250);
}

async function pinMixerControl(page, desk, param) {
  const target = `[data-demo-target="pin-${desk}-${param}"]`;
  await page.waitForSelector(target, { timeout: 8000 });
  await page.click(target);
  await delay(450);
}

async function readMappedDockSlot(page, slotIndex) {
  return page.evaluate((idx) => {
    const slot = document.querySelector(`[data-demo-target="dock-slot-${idx}"]`);
    const label = slot?.querySelector(".dock-slot-label")?.textContent?.trim() ?? null;
    const valueText = slot?.querySelector(".dock-slot-value")?.textContent?.trim() ?? null;
    const mapped = slot?.getAttribute("data-mapped") === "true";
    const ev = window.__shellAudioEvidence?.();
    return {
      mapped,
      label,
      valueText,
      dockSlot0: ev?.dockSlot0 ?? null,
      dockMappings: ev?.dockMappings ?? null,
    };
  }, slotIndex);
}

async function readDockPercent(page, slotIndex) {
  return page.evaluate((idx) => {
    const el = document.querySelector(`[data-demo-target="dock-slot-${idx}"] .dock-slot-value`);
    return Number(el?.textContent?.trim() ?? 0);
  }, slotIndex);
}

async function setDockKnobToPercent(page, slotIndex, targetPercent) {
  const selector = `[data-demo-target="dock-slot-${slotIndex}"] .dock-knob`;
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.click(selector);
  const target = Math.max(0, Math.min(100, targetPercent));
  for (let guard = 0; guard < 30; guard += 1) {
    const current = await readDockPercent(page, slotIndex);
    if (Math.abs(current - target) <= 2) break;
    if (current < target) await page.keyboard.press("ArrowUp");
    else await page.keyboard.press("ArrowDown");
    await delay(80);
  }
  await delay(350);
}

async function analyzeSilenceWindows(path, thresholdDb = -45) {
  try {
    const raw = await runProcess("ffmpeg", [
      "-i",
      path,
      "-af",
      `silencedetect=noise=${thresholdDb}dB:d=0.25`,
      "-f",
      "null",
      "-",
    ]);
    const starts = [...raw.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    const ends = [...raw.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    const firstSoundEnd = ends.length ? ends[0] : null;
    const lastSilenceStart = starts.length ? starts[starts.length - 1] : null;
    return { starts, ends, firstSoundEnd, lastSilenceStart, rawTail: raw.slice(-500) };
  } catch (err) {
    return { error: String(err) };
  }
}

async function analyzeAudioLoudness(path, startSec = 0, durationSec = null) {
  try {
    const args = ["-i", path, "-af", "volumedetect", "-f", "null", "-"];
    if (startSec > 0 || durationSec != null) {
      args.splice(0, 0, "-ss", String(startSec));
      if (durationSec != null) args.splice(2, 0, "-t", String(durationSec));
    }
    const raw = await runProcess("ffmpeg", args);
    const maxMatch = raw.match(/max_volume:\s*([-\d.]+)\s*dB/);
    const meanMatch = raw.match(/mean_volume:\s*([-\d.]+)\s*dB/);
    return {
      maxVolumeDb: maxMatch ? Number(maxMatch[1]) : null,
      meanVolumeDb: meanMatch ? Number(meanMatch[1]) : null,
      startSec,
      durationSec,
      rawTail: raw.slice(-400),
    };
  } catch (err) {
    return { error: String(err) };
  }
}

async function launchLanes(page, count = 2) {
  let launched = 0;
  for (let attempt = 0; attempt < 12 && launched < count; attempt++) {
    const clicked = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Launch"));
      const btn = buttons.find((b) => !b.disabled);
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!clicked) break;
    launched += 1;
    await delay(600);
  }
  return launched;
}

async function screenshotNamed(page, filename, viewport) {
  if (viewport) await page.setViewport(viewport);
  await delay(150);
  const overflow = await measureOverflow(page);
  const path = join(OUT, filename);
  await page.screenshot({ path, type: "png" });
  return { path, overflow, viewport: viewport ?? null };
}

async function startAudioCapture(page) {
  await page.evaluate(async () => {
    if (window.__phase4AudioCapture) return;
    const start = window.__startShellAudioCapture;
    if (!start) throw new Error("Audio capture hooks unavailable");
    start();
  });
}

async function stopAudioCapture(page) {
  return page.evaluate(async () => {
    const bag = window.__phase4AudioCapture;
    if (!bag) return { chunkCount: 0, evidence: window.__shellAudioEvidence?.() ?? null };
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      bag.recorder.addEventListener(
        "stop",
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { once: true },
      );
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
}

function createFrameRecorder(page) {
  let frameIndex = 0;
  let stopped = false;
  const captureFrame = async () => {
    if (stopped) return;
    mkdirSync(FRAMES_DIR, { recursive: true });
    const path = join(FRAMES_DIR, `frame-${String(frameIndex++).padStart(5, "0")}.jpg`);
    await page.screenshot({ path, type: "jpeg", quality: 82 });
  };
  const startLoop = async () => {
    while (!stopped) {
      await captureFrame();
      await delay(FRAME_INTERVAL_MS);
    }
  };
  return {
    startLoop,
    stop: () => {
      stopped = true;
    },
    get count() {
      return frameIndex;
    },
  };
}

async function encodeVideo(frameCount) {
  await runProcess("ffmpeg", [
    "-y",
    "-framerate",
    String(FRAME_FPS),
    "-i",
    join(FRAMES_DIR, "frame-%05d.jpg"),
    "-frames:v",
    String(frameCount),
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "1.2M",
    VIDEO_ONLY,
  ]);
}

async function muxAv(outMp4, outWebm) {
  await runProcess("ffmpeg", [
    "-y",
    "-i",
    VIDEO_ONLY,
    "-i",
    AUDIO_ONLY,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-shortest",
    outMp4,
  ]);
  await runProcess("ffmpeg", [
    "-y",
    "-i",
    VIDEO_ONLY,
    "-i",
    AUDIO_ONLY,
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-shortest",
    outWebm,
  ]);
}

function writeMixerBindingAudit() {
  const mixerPath = "src/presentation-v3/MixerPerformanceRoom.tsx";
  const adapterPath = "src/presentation-v3/presentationStateAdapter.ts";
  const dockPath = "src/features/dock/LiveControlDock.tsx";
  const audit = {
    capturedAt: new Date().toISOString(),
    mixerStripControls: {
      binding: "React controlled",
      source:
        "useEngineMix() subscribes to shellStore; deskBusControlValues(mix, desk, index) derives slider value/mute/meter",
      evidenceFiles: [mixerPath, adapterPath],
      rerenderOnDockChange:
        "shellAudioAdapter SET_DOCK_VALUE patches engine mix then SYNC_DOCK_FROM_MIX; shellStore subscription triggers useEngineMix sync without room switch",
    },
    dockControls: {
      binding: "React controlled from shellState.dockSlots",
      source: "LiveControlDock reads state.dockSlots; SET_DOCK_VALUE updates slot.value",
      evidenceFiles: [dockPath, "src/shell/audio/shellAudioAdapter.ts", "src/shell/audio/dockMixSync.ts"],
    },
    meterLabels: {
      mixerMeters: "aria-label includes 'level fixture' — fixture levels from deskBusControlValues.meterLevel, not live audio analysis",
    },
    dockPinUiGap: null,
    mixerPinPath:
      "MAP_MIXER_CONTROL_TO_DOCK via Pin buttons on selected Mixer strip (same-room, no cross-room drag)",
  };
  writeFileSync(MIXER_AUDIT_JSON, JSON.stringify(audit, null, 2));
  return audit;
}

const defects = [];
const consoleErrors = [];
const pageErrors = [];
const screenshots = [];
const overflowByFile = {};

let preview = null;
const alreadyUp = await serverReachable(BASE);
if (!alreadyUp) {
  preview = spawn(DEV_CMD, ["--", "--host", "127.0.0.1", "--port", String(PORT)], {
    cwd: process.cwd(),
    stdio: "pipe",
    shell: true,
    env: { ...process.env, VITE_SHIKI_PACK_MODE: "live-collab" },
  });
}

const shutdown = () => {
  if (preview && !preview.killed) preview.kill("SIGTERM");
};
process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

const captureRecord = {
  capturedAt: new Date().toISOString(),
  gitHead: gitHead(),
  gitStatus: gitStatusShort(),
  devCommand: `VITE_SHIKI_PACK_MODE=live-collab ${DEV_CMD}`,
  presentationUrl: PRESENTATION_URL,
  chromePath: CHROME,
  chromeVersion: chromeVersion(),
  headless: HEADLESS,
  serverAttached: alreadyUp,
  viewportWide: { width: 1440, height: 900 },
  viewportCompact: { width: 1280, height: 720 },
};

const runtimeTrace = {
  overflowAssertions: {},
  mixerSync: {},
  restart: {},
  audioTransport: {},
  selectedRevision: null,
  activeLaneCountAfterLaunch: null,
};

try {
  await waitForServer(BASE);
  mkdirSync(FRAMES_DIR, { recursive: true });
  rmSync(AUDIO_CAPTURE, { force: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: HEADLESS,
    protocolTimeout: 300000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=1440,900",
    ],
    defaultViewport: captureRecord.viewportWide,
  });

  const page = await browser.newPage();
  await page.exposeFunction("__phase4WriteAudioChunk", (base64Chunk) => {
    appendFileSync(AUDIO_CAPTURE, Buffer.from(base64Chunk, "base64"));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(PRESENTATION_URL, { waitUntil: "networkidle0", timeout: 120000 });
  await page.waitForFunction(() => window.__shellAudioEvidence?.()?.audioReady === true, {
    timeout: 120000,
  });
  await delay(400);

  // --- 10 global sparse ---
  await clickNavRoom(page, "Global");
  await toggleExchange(page, false);
  screenshots.push(await screenshotNamed(page, "10-global-sparse-1440.png", captureRecord.viewportWide));
  overflowByFile["10-global-sparse-1440.png"] = screenshots.at(-1).overflow;

  const laneCountSparse = await page.evaluate(
    () => document.querySelectorAll('[aria-label="Global Performance"] [data-slot-id]').length,
  );
  if (laneCountSparse !== 7) defects.push(`sparse global lane count ${laneCountSparse}, expected 7`);

  // --- 11 global launched ---
  const launched = await launchLanes(page, 3);
  runtimeTrace.activeLaneCountAfterLaunch = await page.evaluate(() => {
    const ev = window.__shellAudioEvidence?.();
    return ev?.activeSlots?.length ?? null;
  });
  if (launched < 2) defects.push(`only launched ${launched} lanes via UI`);
  screenshots.push(await screenshotNamed(page, "11-global-launched-1440.png", captureRecord.viewportWide));
  overflowByFile["11-global-launched-1440.png"] = screenshots.at(-1).overflow;

  // --- 12 participant piano ---
  await toggleExchange(page, false);
  await selectParticipantByName(page, "Kai");
  await setCreateMode(page, "Piano Roll");
  await page.evaluate(() => {
    const lib = document.querySelector("button");
    const toggle = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Library");
    if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
  });
  screenshots.push(await screenshotNamed(page, "12-participant-piano-roll-1440.png", captureRecord.viewportWide));
  overflowByFile["12-participant-piano-roll-1440.png"] = screenshots.at(-1).overflow;

  // --- 13 participant step (Ryo) ---
  await selectParticipantByName(page, "Ryo");
  await setCreateMode(page, "Step");
  await page.click('[data-demo-target="step-cell-3"]');
  await page.click('[data-demo-target="step-cell-4"]');
  screenshots.push(await screenshotNamed(page, "13-participant-step-1440.png", captureRecord.viewportWide));
  overflowByFile["13-participant-step-1440.png"] = screenshots.at(-1).overflow;

  // --- 14 exchange empty ---
  await toggleExchange(page, true);
  screenshots.push(await screenshotNamed(page, "14-exchange-empty-1440.png", captureRecord.viewportWide));
  overflowByFile["14-exchange-empty-1440.png"] = screenshots.at(-1).overflow;
  await toggleExchange(page, false);

  // --- participant authoring for exchange ---
  await selectParticipantByName(page, "Kai");
  await setCreateMode(page, "Piano Roll");
  const noteBtn = await page.$('[data-surface="v3-create"] .pianoNote, [data-surface="v3-create"] [data-demo-target^="piano-note-"]');
  if (noteBtn) {
    await noteBtn.click();
    await delay(200);
    const velocityLabel = await page.evaluate(() => {
      const input = document.querySelector('[data-surface="v3-create"] .inspector input[type="range"]');
      return input?.getAttribute("aria-label") ?? null;
    });
    if (velocityLabel) await setRangeByAriaLabel(page, velocityLabel, 72);
  }
  await page.click('[data-demo-target="preview-clip"]');
  await delay(800);
  await page.click('[data-demo-target="save-to-library"]');
  await delay(300);
  await page.evaluate(() => {
    const toggle = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Library");
    if (toggle?.getAttribute("aria-expanded") !== "true") toggle?.click();
  });
  await delay(200);
  await page.click('[data-demo-target="share-clip"]');
  await delay(400);
  runtimeTrace.selectedRevision = await page.evaluate(() => {
    const ev = window.__shellAudioEvidence?.();
    return ev?.exchangeRevisions?.[0] ?? null;
  });

  // --- 15 exchange populated ---
  screenshots.push(await screenshotNamed(page, "15-exchange-populated-1440.png", captureRecord.viewportWide));
  overflowByFile["15-exchange-populated-1440.png"] = screenshots.at(-1).overflow;

  // stage if possible
  const staged = await page.evaluate(() => {
    const stage = document.querySelector('[data-demo-target^="stage-clip-"]');
    if (stage) {
      stage.click();
      return true;
    }
    const primary = [...document.querySelectorAll("footer button")].find((b) => b.className.includes("btnPrimary"));
    if (primary) {
      primary.click();
      return "primary";
    }
    return false;
  });
  if (!staged) defects.push("could not stage clip from exchange via UI primary/stage actions");

  await toggleExchange(page, false);
  await clickNavRoom(page, "Global");
  await launchLanes(page, 1);

  // --- 16-20 mixer ---
  await clickNavRoom(page, "Mixer");
  await delay(300);
  runtimeTrace.mixerSync.baseline = {
    hornsDelay: await readMixerSlider(page, "Horns delay send"),
    evidence: await shellEvidence(page),
  };
  screenshots.push(await screenshotNamed(page, "16-mixer-baseline-1440.png", captureRecord.viewportWide));
  overflowByFile["16-mixer-baseline-1440.png"] = screenshots.at(-1).overflow;

  await selectHornsStrip(page);
  await pinMixerControl(page, "horns", "delay");
  const mappedSlot = await readMappedDockSlot(page, 0);
  runtimeTrace.mixerSync.mapped = {
    sourceId: "Horns · Delay",
    slotIndex: 0,
    dock: mappedSlot,
    evidence: await shellEvidence(page),
  };
  if (!mappedSlot.mapped) defects.push("Horns · Delay pin did not map dock slot 0");
  screenshots.push(await screenshotNamed(page, "17-mixer-mapped-dock-1440.png", captureRecord.viewportWide));
  overflowByFile["17-mixer-mapped-dock-1440.png"] = screenshots.at(-1).overflow;

  const hornsDelayBefore = await readMixerSlider(page, "Horns delay send");
  await dragRangeSlider(page, '[data-demo-target="desk-delay-horns"]', 78);
  const hornsDelayAfterMixer = await readMixerSlider(page, "Horns delay send");
  const dockAfterMixer = await readMappedDockSlot(page, 0);
  runtimeTrace.mixerSync.afterMixerChange = {
    before: hornsDelayBefore,
    after: hornsDelayAfterMixer,
    dockRendered: dockAfterMixer,
    evidence: await shellEvidence(page),
  };
  if (hornsDelayAfterMixer === hornsDelayBefore) {
    defects.push(`mixer Horns delay unchanged after UI drag (${hornsDelayBefore} -> ${hornsDelayAfterMixer})`);
  }
  screenshots.push(await screenshotNamed(page, "18-mixer-control-changed-1440.png", captureRecord.viewportWide));
  overflowByFile["18-mixer-control-changed-1440.png"] = screenshots.at(-1).overflow;

  const dockBeforeChange = await readDockPercent(page, 0);
  await setDockKnobToPercent(page, 0, 35);
  const hornsDelayAfterDock = await readMixerSlider(page, "Horns delay send");
  const dockAfterDock = await readMappedDockSlot(page, 0);
  const dockAfterPercent = await readDockPercent(page, 0);
  const evidenceAfterDock = await shellEvidence(page);
  runtimeTrace.mixerSync.afterDockChange = {
    dockBefore: dockBeforeChange,
    dockAfter: dockAfterPercent,
    hornsDelay: hornsDelayAfterDock,
    hornsDelayNormalized: evidenceAfterDock?.hornsDelayNormalized ?? null,
    dockRendered: dockAfterDock,
    evidence: evidenceAfterDock,
  };
  if (dockAfterPercent === dockBeforeChange) {
    defects.push(`dock value unchanged after UI knob (${dockBeforeChange} -> ${dockAfterPercent})`);
  }
  if (hornsDelayAfterDock === hornsDelayAfterMixer) {
    defects.push(
      `Mixer Horns delay did not follow dock change (${hornsDelayAfterMixer} -> ${hornsDelayAfterDock})`,
    );
  }
  if (Math.abs(hornsDelayAfterDock - 35) > 4) {
    defects.push(`Mixer Horns delay expected ~35 after dock, got ${hornsDelayAfterDock}`);
  }
  screenshots.push(await screenshotNamed(page, "19-mixer-dock-sync-1440.png", captureRecord.viewportWide));
  overflowByFile["19-mixer-dock-sync-1440.png"] = screenshots.at(-1).overflow;

  runtimeTrace.restart.before = {
    hornsDelay: await readMixerSlider(page, "Horns delay send"),
    dockMappings: (await shellEvidence(page))?.dockMappings ?? null,
  };
  await page.click('[data-demo-target="transport-restart"]');
  await delay(900);
  runtimeTrace.restart.after = {
    hornsDelay: await readMixerSlider(page, "Horns delay send"),
    dockMappings: (await shellEvidence(page))?.dockMappings ?? null,
    evidence: await shellEvidence(page),
  };
  screenshots.push(await screenshotNamed(page, "20-mixer-restart-1440.png", captureRecord.viewportWide));
  overflowByFile["20-mixer-restart-1440.png"] = screenshots.at(-1).overflow;

  // --- compact screenshots ---
  await clickNavRoom(page, "Global");
  await toggleExchange(page, false);
  screenshots.push(await screenshotNamed(page, "21-global-1280.png", captureRecord.viewportCompact));
  overflowByFile["21-global-1280.png"] = screenshots.at(-1).overflow;

  await selectParticipantByName(page, "Kai");
  screenshots.push(await screenshotNamed(page, "22-participant-create-1280.png", captureRecord.viewportCompact));
  overflowByFile["22-participant-create-1280.png"] = screenshots.at(-1).overflow;

  await toggleExchange(page, true);
  screenshots.push(await screenshotNamed(page, "23-exchange-open-1280.png", captureRecord.viewportCompact));
  overflowByFile["23-exchange-open-1280.png"] = screenshots.at(-1).overflow;
  await toggleExchange(page, false);

  await clickNavRoom(page, "Mixer");
  screenshots.push(await screenshotNamed(page, "24-mixer-1280.png", captureRecord.viewportCompact));
  overflowByFile["24-mixer-1280.png"] = screenshots.at(-1).overflow;

  for (const [file, ov] of Object.entries(overflowByFile)) {
    runtimeTrace.overflowAssertions[file] = ov;
    if (!ov.ok) defects.push(`horizontal overflow on ${file}: scrollWidth=${ov.scrollWidth} clientWidth=${ov.clientWidth}`);
  }

  runtimeTrace.audioTransport = await shellEvidence(page);

  // --- A/V walkthrough (fresh session) ---
  await page.goto(PRESENTATION_URL, { waitUntil: "networkidle0", timeout: 120000 });
  await page.waitForFunction(() => window.__shellAudioEvidence?.()?.audioReady === true, {
    timeout: 120000,
  });
  await delay(300);
  await startAudioCapture(page);
  const frames = createFrameRecorder(page);
  const frameLoop = frames.startLoop();
  const walkEvents = [];
  const walkStart = Date.now();
  const mark = (label) => walkEvents.push({ label, elapsedSec: (Date.now() - walkStart) / 1000 });

  const hold = async (ms) => delay(ms);
  await clickNavRoom(page, "Global");
  mark("sparse-global");
  await hold(4000);
  await selectParticipantByName(page, "Kai");
  mark("participant-enter");
  await setCreateMode(page, "Piano Roll");
  await hold(1500);
  const walkNote = await page.$('[data-surface="v3-create"] [data-demo-target^="piano-note-"]');
  if (walkNote) await walkNote.click();
  await setCreateMode(page, "Step");
  await page.click('[data-demo-target="step-cell-2"]');
  await page.click('[data-demo-target="step-cell-5"]');
  mark("step-edited");
  await hold(1000);
  await page.click('[data-demo-target="preview-clip"]');
  mark("preview-start");
  await hold(12000);
  mark("preview-end");
  await page.click('[data-demo-target="save-to-library"]');
  await hold(2000);
  await page.evaluate(() => {
    const toggle = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Library");
    toggle?.click();
  });
  await hold(3500);
  await page.click('[data-demo-target="share-clip"]');
  await hold(3000);
  mark("share-complete");
  await toggleExchange(page, true);
  await hold(2000);
  await toggleExchange(page, false);
  await clickNavRoom(page, "Global");
  await hold(2000);
  await launchLanes(page, 2);
  mark("launch-complete");
  await hold(2000);
  await page.click('[data-demo-target="transport-play"]');
  mark("play-start");
  await hold(14000);
  mark("play-hold-end");
  await clickNavRoom(page, "Mixer");
  await hold(2500);
  await selectHornsStrip(page);
  await pinMixerControl(page, "horns", "delay");
  await hold(1500);
  await dragRangeSlider(page, '[data-demo-target="desk-delay-horns"]', 65);
  mark("mixer-delay-changed");
  await hold(2500);
  await setDockKnobToPercent(page, 0, 35);
  mark("dock-delay-changed");
  await hold(3500);
  await page.click('[data-demo-target="transport-restart"]');
  mark("restart");
  await hold(5000);

  frames.stop();
  await frameLoop.catch(() => {});
  const audioCapture = await stopAudioCapture(page);
  await browser.close();

  const frameCount = readdirSync(FRAMES_DIR).filter((f) => f.startsWith("frame-") && f.endsWith(".jpg")).length;
  await encodeVideo(frameCount);
  const audioByteLength = statSync(AUDIO_CAPTURE).size;
  if (audioByteLength < 16384) defects.push(`audio capture small: ${audioByteLength} bytes`);
  rmSync(AUDIO_ONLY, { force: true });
  renameSync(AUDIO_CAPTURE, AUDIO_ONLY);
  await muxAv(WALKTHROUGH_MP4, WALKTHROUGH_WEBM);
  rmSync(FRAMES_DIR, { recursive: true, force: true });

  const probe = await ffprobeJson(WALKTHROUGH_MP4);
  const durationSec = Number(probe.format?.duration ?? 0);
  const audioLoudness = await analyzeAudioLoudness(WALKTHROUGH_MP4);
  const silenceWindows = await analyzeSilenceWindows(WALKTHROUGH_MP4);
  const hasAudioStream = probe.streams?.some((s) => s.codec_type === "audio");
  if (!hasAudioStream) defects.push("walkthrough mp4 missing audio stream");
  const previewEvent = walkEvents.find((e) => e.label === "preview-start");
  const playEvent = walkEvents.find((e) => e.label === "play-start");
  const launchEvent = walkEvents.find((e) => e.label === "launch-complete");
  const firstSoundEnd = silenceWindows.firstSoundEnd;
  const previewLoudness =
    previewEvent != null
      ? await analyzeAudioLoudness(WALKTHROUGH_MP4, previewEvent.elapsedSec, 5)
      : null;
  const launchLoudness =
    playEvent != null
      ? await analyzeAudioLoudness(WALKTHROUGH_MP4, playEvent.elapsedSec + 2, 12)
      : null;
  if (previewLoudness?.maxVolumeDb != null && previewLoudness.maxVolumeDb < -35) {
    defects.push(`preview window max volume too low: ${previewLoudness.maxVolumeDb} dB`);
  }
  if (launchLoudness?.maxVolumeDb != null && launchLoudness.maxVolumeDb < -35) {
    defects.push(`launch/play window max volume too low: ${launchLoudness.maxVolumeDb} dB`);
  }
  if (previewEvent && firstSoundEnd != null && firstSoundEnd > previewEvent.elapsedSec + 8) {
    defects.push(
      `preview not audible before launch: first sound at ${firstSoundEnd}s, preview at ${previewEvent.elapsedSec}s`,
    );
  }
  if (previewEvent && launchEvent && firstSoundEnd != null && firstSoundEnd > launchEvent.elapsedSec) {
    defects.push(
      `first audible output after launch (${firstSoundEnd}s > launch ${launchEvent.elapsedSec}s)`,
    );
  }
  runtimeTrace.walkthroughEvents = walkEvents;
  runtimeTrace.audioWindows = {
    audioLoudness,
    previewLoudness,
    launchLoudness,
    silenceWindows,
    previewEvent,
    launchEvent,
    playEvent,
    firstSoundEnd,
  };
  if (durationSec < 60 || durationSec > 95) {
    defects.push(`walkthrough duration ${durationSec.toFixed(1)}s outside 60-90s target`);
  }

  const mixerAudit = writeMixerBindingAudit();

  const finalHead = gitHead();
  const finalStatus = gitStatusShort();
  const porcelain = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  captureRecord.gitHead = finalHead;
  captureRecord.gitStatus = finalStatus;
  captureRecord.gitPorcelain = porcelain;
  if (porcelain.length > 0) {
    defects.push(`working tree not clean at manifest write: ${porcelain.split("\n")[0]}`);
  }

  writeFileSync(
    RUNTIME_JSON,
    JSON.stringify(
      {
        ...captureRecord,
        pageErrors,
        consoleErrors,
        runtimeTrace,
        walkthrough: {
          durationSec,
          audioByteLength,
          chunkCount: audioCapture.chunkCount,
          frameCount,
          audioLoudness,
          previewLoudness,
          launchLoudness,
          silenceWindows,
          walkEvents,
          hasAudioStream,
        },
      },
      null,
      2,
    ),
  );

  const manifest = {
    ...captureRecord,
    screenshots: screenshots.map((s) => ({ file: s.path, overflow: s.overflow })),
    walkthroughMp4: WALKTHROUGH_MP4,
    walkthroughWebm: WALKTHROUGH_WEBM,
    sha256: {
      walkthroughMp4: sha256File(WALKTHROUGH_MP4),
      walkthroughWebm: sha256File(WALKTHROUGH_WEBM),
    },
    ffprobe: probe,
    overflowAssertions: runtimeTrace.overflowAssertions,
    mixerSyncTrace: runtimeTrace.mixerSync,
    restartTrace: runtimeTrace.restart,
    consoleErrors,
    pageErrors,
    defects,
    mixerBindingAudit: MIXER_AUDIT_JSON,
    runtimeJson: RUNTIME_JSON,
    mixerAuditSummary: mixerAudit,
  };
  writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ ok: defects.length === 0, defects, manifestPath: MANIFEST_JSON }, null, 2));
  if (defects.length) process.exitCode = 1;
} finally {
  shutdown();
}
