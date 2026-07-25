#!/usr/bin/env node
/**
 * WP5.5 — Phase 5 A/V narrative capture (live-collab mode).
 *
 * Video: puppeteer JPEG screencast frames → ffmpeg VP9
 * Audio: master-limiter MediaRecorder tap (phase4 pattern)
 * Output: artifacts/phase5-demo/phase5-narrative-walkthrough.mp4 (QuickTime/VLC)
 *         artifacts/phase5-demo/phase5-narrative-walkthrough.webm (VP9/Opus archive)
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
  renameSync,
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
const OUTPUT = join(OUT, "phase5-narrative-walkthrough.mp4");
const OUTPUT_WEBM = join(OUT, "phase5-narrative-walkthrough.webm");
const TRACE_OUT = join(OUT, "lane-accumulation-trace.json");
const MANIFEST_OUT = join(OUT, "manifest.json");
const FRAMES_RUN_ID = `${Date.now()}-${process.pid}`;
const FRAMES_DIR = join(OUT, `.screencast-frames-${FRAMES_RUN_ID}`);
const AUDIO_CAPTURE = join(OUT, `.phase5-audio-capture-${FRAMES_RUN_ID}.webm`);

const FRAME_INTERVAL_MS = Number(process.env.PHASE5_FRAME_MS ?? 200);
const FRAME_FPS = 1000 / FRAME_INTERVAL_MS;
const HEADLESS = process.env.HEADLESS !== "0";

/** Aligns with PHASE5_WALKTHROUGH in src/shell/presenterWalkthrough.ts (36 beats). */
const PHASE5_BEAT = {
  /** Last scripted action before payoff holds (Mei · Horns desk delay throw). */
  PRE_PAYOFF_MAX: 30,
  /** Hold lead-a payoff — empty commands, waitUntilBar: 12, afterBar: 2. */
  PAYOFF_HOLD: 31,
  /** Seven-lane payoff · 7/7 hold — waitUntilBar: 20, afterBar: 2. */
  SEVEN_LANE_HOLD: 32,
  /** Perform shared master — transport hold, no new launch. */
  PERFORM: 33,
  /** Recall prior material into a new structural role. */
  RECALL: 34,
  /** Promote fork lineage to master take before restart. */
  PROMOTE: 35,
  /** Restart sparse global — RESTART_SESSION. */
  RESTART: 36,
};

/** Scripted walkthrough stops before transport-synced payoff holds; external holds substitute beats 28–29. */
const WALKTHROUGH_MAX_BEAT = Number(process.env.PHASE5_MAX_BEAT ?? PHASE5_BEAT.PRE_PAYOFF_MAX);
const PAYOFF_HOLD_MS = Number(process.env.PHASE5_HOLD_PAYOFF_MS ?? 48000);
const POST_FORK_HOLD_MS = Number(process.env.PHASE5_HOLD_POST_FORK_MS ?? 24000);
const POST_RESTART_HOLD_MS = Number(process.env.PHASE5_HOLD_RESTART_MS ?? 6000);
const RESTART_BEAT = Number(process.env.PHASE5_RESTART_BEAT ?? PHASE5_BEAT.RESTART);

const HOLD = {
  payoffMs: PAYOFF_HOLD_MS,
  postForkMs: POST_FORK_HOLD_MS,
  postRestartMs: POST_RESTART_HOLD_MS,
};


const VALIDATE_ONLY = process.argv.includes("--validate");

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function validatePhase5Demo() {
  const errors = [];
  const report = { ok: true, checks: {} };

  const requireFile = (rel, label) => {
    try {
      const st = statSync(rel);
      if (st.size < 1024) errors.push(`${label} too small (${st.size} bytes): ${rel}`);
      report.checks[label] = { path: rel, bytes: st.size };
      return true;
    } catch {
      errors.push(`missing ${label}: ${rel}`);
      return false;
    }
  };

  if (!requireFile(OUTPUT, "narrativeMp4")) {
    report.ok = false;
    console.error(JSON.stringify({ ...report, errors }, null, 2));
    process.exit(1);
  }

  const probe = await ffprobeJson(OUTPUT);
  const videoStream = probe.streams?.find((s) => s.codec_type === "video") ?? null;
  const audioStream = probe.streams?.find((s) => s.codec_type === "audio") ?? null;
  const durationSec = Number(probe.format?.duration ?? 0);
  report.checks.ffprobeMp4 = {
    durationSec,
    hasVideo: Boolean(videoStream),
    hasAudio: Boolean(audioStream),
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
  };
  if (!videoStream || !audioStream) errors.push("mp4 missing video or audio stream");
  if (durationSec < 20) errors.push(`mp4 duration too short: ${durationSec}s`);
  if (videoStream?.codec_name !== "h264") errors.push(`expected h264 video, got ${videoStream?.codec_name}`);

  const mp4Sha = sha256File(OUTPUT);
  report.checks.sha256 = { narrativeMp4: mp4Sha };

  if (requireFile(OUTPUT_WEBM, "narrativeWebm")) {
    report.checks.sha256.narrativeWebm = sha256File(OUTPUT_WEBM);
  }

  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_OUT, "utf8"));
    report.checks.manifest = MANIFEST_OUT;
    const expectedMp4 = manifest.sha256?.narrativeMp4;
    if (expectedMp4 && expectedMp4 !== mp4Sha) {
      errors.push("manifest sha256.narrativeMp4 mismatch");
    }
    const expectedWebm = manifest.sha256?.narrativeWebm;
    const actualWebm = report.checks.sha256.narrativeWebm;
    if (expectedWebm && actualWebm && expectedWebm !== actualWebm) {
      errors.push("manifest sha256.narrativeWebm mismatch");
    }
    if (!manifest.outputs?.narrativeMp4) {
      report.checks.manifestNote = "manifest lacks outputs.narrativeMp4 (re-capture or hand-edit manifest)";
    }
  } catch {
    report.checks.manifestNote = "no manifest.json";
  }

  if (errors.length) {
    report.ok = false;
    report.errors = errors;
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(report, null, 2));
}

if (VALIDATE_ONLY) {
  await validatePhase5Demo();
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
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
    OUTPUT,
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
    OUTPUT_WEBM,
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
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.exposeFunction("__phase4WriteAudioChunk", (base64Chunk) => {
    appendFileSync(AUDIO_CAPTURE, Buffer.from(base64Chunk, "base64"));
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

  const walkthroughLabels = await runWalkthroughUntil(page, WALKTHROUGH_MAX_BEAT);
  laneTrace.push(
    summarizeEvidence(await shellEvidence(page), `post-beat-${WALKTHROUGH_MAX_BEAT}-pre-payoff`),
  );

  const payoffEnd = Date.now() + PAYOFF_HOLD_MS;
  while (Date.now() < payoffEnd) {
    laneTrace.push(summarizeEvidence(await shellEvidence(page), `beat-${PHASE5_BEAT.PAYOFF_HOLD}-payoff-hold`));
    await delay(4000);
  }

  const sevenLaneHoldEnd = Date.now() + POST_FORK_HOLD_MS;
  while (Date.now() < sevenLaneHoldEnd) {
    laneTrace.push(summarizeEvidence(await shellEvidence(page), `beat-${PHASE5_BEAT.SEVEN_LANE_HOLD}-seven-lane-hold`));
    await delay(4000);
  }

  const closingLabels = await runWalkthroughRange(page, PHASE5_BEAT.PERFORM, PHASE5_BEAT.PROMOTE);
  const restartLabels = await runWalkthroughRange(page, RESTART_BEAT, RESTART_BEAT);
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
  const audioByteLength = statSync(AUDIO_CAPTURE).size;
  if (audioByteLength < 32768) {
    throw new Error(`Audio capture too small (${audioByteLength} bytes) — likely silent webm`);
  }
  rmSync(AUDIO_ONLY, { force: true });
  renameSync(AUDIO_CAPTURE, AUDIO_ONLY);
  await muxAv();
  rmSync(FRAMES_DIR, { recursive: true, force: true });

  const probe = await ffprobeJson(OUTPUT);
  const videoStream = probe.streams?.find((s) => s.codec_type === "video") ?? null;
  const audioStream = probe.streams?.find((s) => s.codec_type === "audio") ?? null;
  const durationSec = Number(probe.format?.duration ?? 0);

  const head = gitHead();
  const traceDoc = {
    capturedAt: new Date().toISOString(),
    gitHead: head,
    baseUrl: BASE,
    walkthroughLabels,
    closingLabels,
    restartLabels,
    phase5BeatAlignment: PHASE5_BEAT,
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
      narrativeMp4: OUTPUT,
      narrativeWebm: OUTPUT_WEBM,
      laneTrace: TRACE_OUT,
      videoOnly: VIDEO_ONLY,
      audioOnly: AUDIO_ONLY,
    },
    sha256: {
      narrativeMp4: createHash("sha256").update(readFileSync(OUTPUT)).digest("hex"),
      narrativeWebm: createHash("sha256").update(readFileSync(OUTPUT_WEBM)).digest("hex"),
    },
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
