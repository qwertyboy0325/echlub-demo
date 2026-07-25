#!/usr/bin/env node
/**
 * WP5.5 — Phase 5 A/V narrative capture (live-collab mode).
 *
 * Video: puppeteer JPEG screencast frames → ffmpeg VP9
 * Audio: master-limiter MediaRecorder tap (phase4 pattern)
 * Output: artifacts/phase5-demo/phase5-narrative-walkthrough.webm
 *
 * Server: attaches to existing http://127.0.0.1:4173/ when reachable, else spawns
 * `npm run dev:live-collab`. Set PHASE5_ATTACH_ONLY=1 to require an existing server.
 *
 * Headless Chrome is used by default (--autoplay-policy=no-user-gesture-required). Foreground
 * capture (HEADLESS=0) may yield slightly different WebAudio timing; both should be audible.
 */
import { createHash } from "node:crypto";
import { execSync, spawn } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PHASE5_PORT ?? 4173);
const BASE = process.env.PHASE5_BASE_URL ?? `http://127.0.0.1:${PORT}/`;
const OUT = "artifacts/phase5-demo";
const VIDEO_ONLY = join(OUT, "phase5-narrative-video-only.webm");
const AUDIO_ONLY = join(OUT, "phase5-narrative-audio-only.webm");
const OUTPUT = join(OUT, "phase5-narrative-walkthrough.webm");
const TRACE_OUT = join(OUT, "lane-accumulation-trace.json");
const MANIFEST_OUT = join(OUT, "manifest.json");
const FRAMES_DIR = join(OUT, ".screencast-frames");

const FRAME_INTERVAL_MS = Number(process.env.PHASE5_FRAME_MS ?? 200);
const FRAME_FPS = 1000 / FRAME_INTERVAL_MS;
const PAYOFF_HOLD_MS = Number(process.env.PHASE5_HOLD_PAYOFF_MS ?? 48000);
const POST_RESTART_HOLD_MS = Number(process.env.PHASE5_HOLD_RESTART_MS ?? 6000);
const HEADLESS = process.env.HEADLESS !== "0";

const HOLD = { payoffMs: PAYOFF_HOLD_MS, postRestartMs: POST_RESTART_HOLD_MS };

mkdirSync(OUT, { recursive: true });
rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

function gitHead() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function waitForServer(url, timeoutMs = 60000) {
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

async function serverReachable(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout || stderr);
      else reject(new Error(`${cmd} exit ${code}: ${stderr.slice(-600)}`));
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

async function shellEvidence(page) {
  return page.evaluate(() => window.__shellAudioEvidence?.() ?? null);
}

function summarizeEvidence(evidence, label) {
  if (!evidence) return { label, missing: true };
  const activeSlots = evidence.activeSlots ?? [];
  const inventory = evidence.sevenTrackMasterInventory ?? [];
  return {
    label,
    capturedAt: evidence.capturedAt ?? new Date().toISOString(),
    activeLaneCount: activeSlots.length,
    activeSlots,
    sevenTrackAudibleCount: evidence.sevenTrackAudibleCount ?? null,
    transportPlaying: evidence.transportPlaying ?? null,
    masterLevelDb: evidence.masterLevelDb ?? null,
    playbackGeneration: evidence.playbackGeneration ?? null,
    audibleTracks: inventory.filter((t) => t.audibleInPayoff).map((t) => t.trackId),
  };
}

async function startAudioCapture(page) {
  await page.evaluate(async () => {
    if (window.__phase4AudioCapture) return;
    const start = window.__startShellAudioCapture;
    if (start) {
      start();
      return;
    }
    throw new Error("Audio capture hooks unavailable");
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
  if (frameCount < 8) throw new Error(`Too few screencast frames: ${frameCount}`);
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

async function muxAv() {
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
    OUTPUT,
  ]);
}

async function runWalkthroughUntil(page, maxBeat) {
  return page.evaluate(async (beat) => {
    if (typeof window.__runPhase5WalkthroughUntil === "function") {
      return window.__runPhase5WalkthroughUntil(beat);
    }
    const runner = window.__runPhase5Walkthrough;
    if (!runner) throw new Error("__runPhase5Walkthrough unavailable");
    return runner();
  }, maxBeat);
}

async function runWalkthroughRange(page, fromBeat, toBeat) {
  return page.evaluate(
    async (range) => {
      const runner = window.__runPhase5WalkthroughRange;
      if (!runner) throw new Error("__runPhase5WalkthroughRange unavailable");
      return runner(range.from, range.to);
    },
    { from: fromBeat, to: toBeat },
  );
}

let preview = null;
const attachOnly = process.env.PHASE5_ATTACH_ONLY === "1";
const alreadyUp = await serverReachable(BASE);

if (!alreadyUp) {
  if (attachOnly) {
    throw new Error(`PHASE5_ATTACH_ONLY=1 but server not reachable at ${BASE}`);
  }
  preview = spawn("npm", ["run", "dev:live-collab", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
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

const pageErrors = [];
const laneTrace = [];
let captureMeta = {
  headless: HEADLESS,
  baseUrl: BASE,
  serverAttached: alreadyUp,
  frameIntervalMs: FRAME_INTERVAL_MS,
  holdMs: HOLD,
};

try {
  await waitForServer(BASE);
  writeFileSync(AUDIO_ONLY, Buffer.alloc(0));

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
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.exposeFunction("__phase4WriteAudioChunk", (base64Chunk) => {
    appendFileSync(AUDIO_ONLY, Buffer.from(base64Chunk, "base64"));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 90000 });
  await page.waitForFunction(() => window.__shellAudioEvidence?.()?.audioReady === true, { timeout: 90000 });
  await page.waitForFunction(
    () => typeof window.__runPhase5WalkthroughUntil === "function" || typeof window.__runPhase5Walkthrough === "function",
    { timeout: 30000 },
  );

  const followBtn = await page.$(".follow-controls button");
  if (followBtn) await followBtn.click();
  await delay(300);

  laneTrace.push(summarizeEvidence(await shellEvidence(page), "pre-walkthrough-sparse"));

  await startAudioCapture(page);
  const frames = createFrameRecorder(page);
  const frameLoop = frames.startLoop();

  const walkthroughLabels = await runWalkthroughUntil(page, 14);
  laneTrace.push(summarizeEvidence(await shellEvidence(page), "post-beat-14-payoff-start"));

  const payoffEnd = Date.now() + PAYOFF_HOLD_MS;
  while (Date.now() < payoffEnd) {
    laneTrace.push(summarizeEvidence(await shellEvidence(page), "payoff-hold"));
    await delay(4000);
  }

  const restartLabels = await runWalkthroughRange(page, 15, 15);
  laneTrace.push(summarizeEvidence(await shellEvidence(page), "post-restart-sparse"));
  await delay(POST_RESTART_HOLD_MS);
  laneTrace.push(summarizeEvidence(await shellEvidence(page), "post-restart-hold"));

  frames.stop();
  await frameLoop.catch(() => {});

  const audioCapture = await stopAudioCapture(page);
  await browser.close();

  const frameCount = readdirSync(FRAMES_DIR).filter((f) => f.startsWith("frame-") && f.endsWith(".jpg")).length;
  captureMeta.frameCount = frameCount;

  await encodeVideo(frameCount);
  const audioByteLength = statSync(AUDIO_ONLY).size;
  if (audioByteLength < 32768) {
    throw new Error(`Audio capture too small (${audioByteLength} bytes) — likely silent webm`);
  }
  await muxAv();
  rmSync(FRAMES_DIR, { recursive: true, force: true });

  const probe = await ffprobeJson(OUTPUT);
  const videoStream = probe.streams?.find((s) => s.codec_type === "video") ?? null;
  const audioStream = probe.streams?.find((s) => s.codec_type === "audio") ?? null;
  const durationSec = Number(probe.format?.duration ?? 0);

  const head = gitHead();
  const outputSha = createHash("sha256").update(readFileSync(OUTPUT)).digest("hex");

  const traceDoc = {
    capturedAt: new Date().toISOString(),
    gitHead: head,
    baseUrl: BASE,
    walkthroughLabels,
    restartLabels,
    holdMs: HOLD,
    pageErrors,
    audioByteLength,
    chunkCount: audioCapture.chunkCount,
    runtimeEvidence: summarizeEvidence(audioCapture.evidence, "final-audio-stop"),
    laneSnapshots: laneTrace,
  };
  writeFileSync(TRACE_OUT, JSON.stringify(traceDoc, null, 2));

  const manifest = {
    capturedAt: traceDoc.capturedAt,
    gitHead: head,
    baseUrl: BASE,
    headless: HEADLESS,
    serverAttached: alreadyUp,
    outputs: {
      narrativeWebm: OUTPUT,
      laneTrace: TRACE_OUT,
      videoOnly: VIDEO_ONLY,
      audioOnly: AUDIO_ONLY,
    },
    sha256: { narrativeWebm: outputSha },
    ffprobe: {
      durationSec,
      hasVideo: Boolean(videoStream),
      hasAudio: Boolean(audioStream),
      videoCodec: videoStream?.codec_name ?? null,
      audioCodec: audioStream?.codec_name ?? null,
      width: videoStream?.width ?? null,
      height: videoStream?.height ?? null,
    },
    captureMeta,
    walkthroughBeatCount: walkthroughLabels.length,
    maxActiveLanes: laneTrace.reduce((max, snap) => Math.max(max, snap.activeLaneCount ?? 0), 0) || null,
    maxAudibleLanes:
      laneTrace.reduce((max, snap) => Math.max(max, snap.sevenTrackAudibleCount ?? 0), 0) || null,
  };
  writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify(manifest, null, 2));

  if (pageErrors.length || !audioStream || durationSec < 20) process.exitCode = 1;
} finally {
  shutdown();
}
