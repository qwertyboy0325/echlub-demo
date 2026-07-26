#!/usr/bin/env node
/**
 * Presentation V3 — formal choreography A/V capture.
 *
 * Output: artifacts/presentation-v3-choreography/*
 * URL: ?presentation=v3&choreography=1
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
const PRESENTATION_URL = `${BASE.replace(/\/?$/, "/")}?presentation=v3&choreography=1`;
const OUT = "artifacts/presentation-v3-choreography";
const MP4 = join(OUT, "presentation-v3-choreography.mp4");
const WEBM = join(OUT, "presentation-v3-choreography.webm");
const VIDEO_ONLY = join(OUT, ".presentation-v3-choreography-video-only.webm");
const AUDIO_ONLY = join(OUT, ".presentation-v3-choreography-audio-only.webm");
const RUN_ID = `${Date.now()}-${process.pid}`;
const FRAMES_DIR = join(OUT, `.screencast-frames-${RUN_ID}`);
const AUDIO_CAPTURE = join(OUT, `.presentation-v3-choreography-audio-${RUN_ID}.webm`);
const MANIFEST = join(OUT, "evidence-manifest.json");
const ACTION_TRACE = join(OUT, "action-trace.json");
const FOLLOW_LOCK_TRACE = join(OUT, "follow-lock-trace.json");

const FRAME_INTERVAL_MS = Number(process.env.PRESENTATION_V3_FRAME_MS ?? 180);
const FRAME_FPS = 1000 / FRAME_INTERVAL_MS;
const HEADLESS = process.env.HEADLESS !== "0";
const DEV_CMD = process.env.PRESENTATION_V3_DEV_CMD ?? "npm run dev:live-collab";
const FORMAL_MODE = process.env.PRESENTATION_V3_FORMAL !== "0";
const DURATION_MIN_SEC = 240;
const DURATION_MAX_SEC = 300;

const VIEWPORT_WIDE = { width: 1440, height: 900 };
const VIEWPORT_COMPACT = { width: 1280, height: 720 };

/** Beat hooks for screenshot polling during __runV3PresentationDemo. */
const SCREENSHOT_BEAT_HOOKS = [
  { beatId: "b03-kai-piano-edit", base: "02-participant-edit" },
  { beatId: "b07-ryo-step-revision", base: "03-exchange-lifecycle" },
  { beatId: "b09-stage-lanes", base: "04-stage" },
  { beatId: "b10-launch-piano", base: "05-launch-armed" },
  { beatId: "b15-payoff-hold", base: "06-payoff" },
  { beatId: "b16-mixer-map", base: "07-mixer-mapped" },
  { beatId: "b17-mixer-to-dock", base: "08-mixer-to-dock" },
  { beatId: "b18-dock-to-mixer", base: "09-dock-to-mixer" },
  { beatId: "b21-restart", base: "10-restart-sparse" },
];

/** Segment loudness windows keyed to demo beats (seconds from action trace when available). */
const LOUDNESS_SEGMENT_BEATS = [
  { beatId: "b04-kai-preview", label: "preview", durationSec: 6 },
  { beatId: "b10-launch-piano", label: "launch", durationSec: 10 },
  { beatId: "b15-payoff-hold", label: "payoff", durationSec: 12 },
];

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

function gitPorcelain() {
  try {
    return execSync("git status --porcelain", { encoding: "utf8" }).trim();
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

async function waitForServer(url, timeoutMs = 180000) {
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

async function presenterEvidence(page) {
  return page.evaluate(() => window.__v3PresenterEvidence?.() ?? null);
}

async function actionTrace(page) {
  return page.evaluate(() => window.__v3ActionTrace?.() ?? null);
}

async function screenshotNamed(page, filename, viewport) {
  if (viewport) await page.setViewport(viewport);
  await delay(150);
  const overflow = await measureOverflow(page);
  const path = join(OUT, filename);
  await page.screenshot({ path, type: "png" });
  return { file: filename, path, overflow, viewport: viewport ?? null };
}

async function screenshotDual(page, baseName, screenshots, overflowByFile) {
  const wide = await screenshotNamed(page, `${baseName}-1440.png`, VIEWPORT_WIDE);
  screenshots.push(wide);
  overflowByFile[wide.file] = wide.overflow;
  const compact = await screenshotNamed(page, `${baseName}-1280.png`, VIEWPORT_COMPACT);
  screenshots.push(compact);
  overflowByFile[compact.file] = compact.overflow;
  await page.setViewport(VIEWPORT_WIDE);
  await delay(100);
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
    return {
      starts,
      ends,
      firstSoundEnd: ends.length ? ends[0] : null,
      lastSilenceStart: starts.length ? starts[starts.length - 1] : null,
      rawTail: raw.slice(-500),
    };
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

function beatStartSec(beatTrace, beatId) {
  const beat = beatTrace?.find((b) => b.beatId === beatId);
  return beat ? beat.startMs / 1000 : null;
}

async function pollBeatScreenshots(page, screenshots, overflowByFile, capturedBeats, stopSignal) {
  while (!stopSignal.done) {
    const ev = await presenterEvidence(page);
    const beatId = ev?.currentBeatId;
    if (beatId) {
      for (const hook of SCREENSHOT_BEAT_HOOKS) {
        if (hook.beatId !== beatId || capturedBeats.has(hook.beatId)) continue;
        capturedBeats.add(hook.beatId);
        await delay(350);
        await screenshotDual(page, hook.base, screenshots, overflowByFile);
      }
    }
    await delay(200);
  }
}

const defects = [];
const consoleErrors = [];
const pageErrors = [];
const screenshots = [];
const overflowByFile = {};

let preview = null;
const attachExisting =
  process.env.PRESENTATION_V3_ATTACH === "1" && (await serverReachable(BASE));
const alreadyUp = attachExisting;
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
  formalMode: FORMAL_MODE,
  serverAttached: alreadyUp,
  viewportWide: VIEWPORT_WIDE,
  viewportCompact: VIEWPORT_COMPACT,
};

try {
  await waitForServer(BASE);
  mkdirSync(FRAMES_DIR, { recursive: true });
  rmSync(AUDIO_CAPTURE, { force: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: HEADLESS,
    protocolTimeout: 900000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=1440,900",
    ],
    defaultViewport: VIEWPORT_WIDE,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(900000);
  page.setDefaultNavigationTimeout(120000);
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
  await page.waitForFunction(() => typeof window.__runV3PresentationDemo === "function", {
    timeout: 60000,
  });
  await delay(400);

  // --- sparse global before demo ---
  await screenshotDual(page, "01-global-sparse", screenshots, overflowByFile);

  await startAudioCapture(page);
  const frames = createFrameRecorder(page);
  const frameLoop = frames.startLoop();

  const capturedBeats = new Set();
  const pollStop = { done: false };
  const pollTask = pollBeatScreenshots(page, screenshots, overflowByFile, capturedBeats, pollStop);

  const demoStart = Date.now();
  let demoLabels = [];
  let demoError = null;
  try {
    demoLabels = await page.evaluate(async () => window.__runV3PresentationDemo());
  } catch (err) {
    demoError = String(err);
    defects.push(`demo execution failed: ${demoError}`);
  } finally {
    pollStop.done = true;
    await pollTask.catch(() => {});
  }
  const demoElapsedSec = (Date.now() - demoStart) / 1000;

  for (const hook of SCREENSHOT_BEAT_HOOKS) {
    if (!capturedBeats.has(hook.beatId)) {
      defects.push(`screenshot beat not captured: ${hook.beatId} (${hook.base})`);
    }
  }

  frames.stop();
  await frameLoop.catch(() => {});
  const audioCapture = await stopAudioCapture(page);

  let presenterSnap = await presenterEvidence(page);
  let traceDoc = await actionTrace(page);
  writeFileSync(ACTION_TRACE, JSON.stringify(traceDoc ?? {}, null, 2));

  const followLockDoc = await page.evaluate(async () => window.__runV3FollowLockProbe());
  writeFileSync(FOLLOW_LOCK_TRACE, JSON.stringify(followLockDoc ?? {}, null, 2));

  await browser.close();

  const frameCount = readdirSync(FRAMES_DIR).filter((f) => f.startsWith("frame-") && f.endsWith(".jpg")).length;
  await encodeVideo(frameCount);
  const audioByteLength = statSync(AUDIO_CAPTURE).size;
  if (audioByteLength < 16384) defects.push(`audio capture small: ${audioByteLength} bytes`);
  rmSync(AUDIO_ONLY, { force: true });
  renameSync(AUDIO_CAPTURE, AUDIO_ONLY);
  await muxAv(MP4, WEBM);
  rmSync(FRAMES_DIR, { recursive: true, force: true });

  const probe = await ffprobeJson(MP4);
  const durationSec = Number(probe.format?.duration ?? 0);
  const hasVideoStream = probe.streams?.some((s) => s.codec_type === "video") ?? false;
  const hasAudioStream = probe.streams?.some((s) => s.codec_type === "audio") ?? false;
  if (!hasVideoStream) defects.push("mp4 missing video stream");
  if (!hasAudioStream) defects.push("mp4 missing audio stream");
  if (durationSec < DURATION_MIN_SEC || durationSec > DURATION_MAX_SEC) {
    defects.push(
      `duration ${durationSec.toFixed(1)}s outside ${DURATION_MIN_SEC}-${DURATION_MAX_SEC}s target`,
    );
  }

  const audioLoudness = await analyzeAudioLoudness(MP4);
  const silenceWindows = await analyzeSilenceWindows(MP4);
  const segmentLoudness = {};
  for (const seg of LOUDNESS_SEGMENT_BEATS) {
    const startSec = beatStartSec(traceDoc?.beatTrace, seg.beatId);
    segmentLoudness[seg.label] = {
      beatId: seg.beatId,
      startSec,
      ...(startSec != null
        ? await analyzeAudioLoudness(MP4, startSec, seg.durationSec)
        : { skipped: true, reason: "beat not in trace" }),
    };
    if (segmentLoudness[seg.label].maxVolumeDb != null) {
      const minDb = seg.label === "preview" ? -42 : seg.label === "launch" ? -40 : -35;
      if (segmentLoudness[seg.label].maxVolumeDb < minDb) {
        defects.push(
          `${seg.label} segment max volume too low: ${segmentLoudness[seg.label].maxVolumeDb} dB`,
        );
      }
    }
  }

  presenterSnap = presenterSnap ?? {};
  const beatCount = presenterSnap.completedBeatIds?.length ?? demoLabels.length;
  const targetFailures = presenterSnap.targetFailures ?? [];
  if (targetFailures.length > 0) {
    defects.push(
      `target failures (${targetFailures.length}): ${targetFailures
        .slice(0, 3)
        .map((f) => `${f.beatId}/${f.key}`)
        .join(", ")}`,
    );
  }

  for (const [file, ov] of Object.entries(overflowByFile)) {
    if (!ov.ok) {
      defects.push(
        `horizontal overflow on ${file}: scrollWidth=${ov.scrollWidth} clientWidth=${ov.clientWidth}`,
      );
    }
  }

  const finalHead = gitHead();
  const porcelain = gitPorcelain();
  captureRecord.gitHead = finalHead;
  captureRecord.gitStatus = gitStatusShort();
  captureRecord.gitPorcelain = porcelain;
  if (porcelain.length > 0) {
    defects.push(`working tree not clean at manifest write: ${porcelain.split("\n")[0]}`);
  }

  const manifest = {
    ...captureRecord,
    durationSec,
    demoElapsedSec,
    beatCount,
    demoLabels,
    demoError,
    presenterEvidence: presenterSnap,
    targetFailureCount: targetFailures.length,
    screenshots: screenshots.map((s) => ({ file: s.file, overflow: s.overflow })),
    choreographyMp4: MP4,
    choreographyWebm: WEBM,
    actionTrace: ACTION_TRACE,
    followLockTrace: FOLLOW_LOCK_TRACE,
    sha256: {
      choreographyMp4: sha256File(MP4),
      choreographyWebm: sha256File(WEBM),
    },
    ffprobe: probe,
    overflowAssertions: overflowByFile,
    audio: {
      byteLength: audioByteLength,
      chunkCount: audioCapture.chunkCount,
      loudness: audioLoudness,
      segmentLoudness,
      silenceWindows,
    },
    capture: {
      frameCount,
      frameIntervalMs: FRAME_INTERVAL_MS,
      capturedBeatIds: [...capturedBeats],
    },
    consoleErrors,
    pageErrors,
    defects,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({ ok: defects.length === 0, defects, manifestPath: MANIFEST }, null, 2));
  if (FORMAL_MODE && defects.length) process.exitCode = 1;
} finally {
  shutdown();
}
