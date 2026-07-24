#!/usr/bin/env node
/**
 * Phase 4 audible walkthrough — records master-limiter tap during presenter beats 1–17
 * plus restart/replay payoff holds (target 2–4 min wall time with audible master sections).
 */
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PHASE4_PORT ?? 4183);
const BASE = process.env.PHASE4_BASE_URL ?? `http://127.0.0.1:${PORT}/echlub-demo/`;
const OUT = "artifacts/phase4-musical";
const AUDIO_OUT = join(OUT, "phase4-audible-walkthrough.webm");
const TRACE_OUT = join(OUT, "lifecycle-event-trace.json");
const RESTART_TRACE_OUT = join(OUT, "restart-replay-trace.json");

const HOLD = {
  previewMs: Number(process.env.PHASE4_HOLD_PREVIEW_MS ?? 14000),
  masterPayoffMs: Number(process.env.PHASE4_HOLD_MASTER_MS ?? 52000),
  overlayMs: Number(process.env.PHASE4_HOLD_OVERLAY_MS ?? 10000),
  replayPayoffMs: Number(process.env.PHASE4_HOLD_REPLAY_MS ?? 28000),
};

mkdirSync(OUT, { recursive: true });

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* retry */ }
    await delay(400);
  }
  throw new Error(`Server not ready: ${url}`);
}

async function runBeatRange(page, fromBeat, toBeat) {
  return page.evaluate(
    async (range) => {
      const runner = window.__runPhase4WalkthroughRange;
      if (!runner) throw new Error("__runPhase4WalkthroughRange unavailable");
      return runner(range.from, range.to);
    },
    { from: fromBeat, to: toBeat },
  );
}

async function shellEvidence(page) {
  return page.evaluate(() => window.__shellAudioEvidence?.() ?? null);
}

async function dispatchCommands(page, commands) {
  return page.evaluate((cmds) => {
    const store = window.__shellStore;
    if (!store?.dispatch) throw new Error("__shellStore.dispatch unavailable");
    for (const command of cmds) store.dispatch(command);
  }, commands);
}

async function startAudioCapture(page) {
  await page.evaluate(async () => {
    if (window.__phase4AudioCapture) return;
    const start = window.__startShellAudioCapture;
    if (start) {
      start();
      return;
    }
    const evidence = window.__shellAudioEvidence?.();
    if (!evidence?.engineExists) throw new Error("AudioEngine not ready for inline capture");
    const Tone = await import("/node_modules/tone/build/esm/index.js").catch(() => null);
    const rawContext = Tone?.getContext?.()?.rawContext ?? new AudioContext();
    const destination = rawContext.createMediaStreamDestination();
    const engine = window.__shellAudioEngine;
    const disconnect = engine?.connectMasterTap?.(destination) ?? (() => {});
    const chunks = [];
    const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    window.__phase4AudioCapture = { recorder, chunks, disconnect };
    recorder.start(250);
  });
}

async function stopAudioCapture(page) {
  return page.evaluate(async () => {
    const bag = window.__phase4AudioCapture;
    if (!bag) return { chunkCount: 0, evidence: window.__shellAudioEvidence?.() ?? null };
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      bag.recorder.addEventListener("stop", () => { clearTimeout(timer); resolve(null); }, { once: true });
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

const preview = process.env.PHASE4_SKIP_PREVIEW
  ? null
  : spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
    });
const shutdown = () => { if (preview && !preview.killed) preview.kill("SIGTERM"); };
process.on("exit", shutdown);

try {
  await waitForServer(BASE);
  writeFileSync(AUDIO_OUT, Buffer.alloc(0));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 300000,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  await page.exposeFunction("__phase4WriteAudioChunk", (base64Chunk) => {
    appendFileSync(AUDIO_OUT, Buffer.from(base64Chunk, "base64"));
  });

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction(() => window.__shellAudioEvidence?.()?.audioReady === true, { timeout: 60000 });
  await delay(500);

  await startAudioCapture(page);

  const followBtn = await page.$(".follow-controls button");
  if (followBtn) await followBtn.click();
  await delay(200);

  const walkthroughLabels = [];
  const traceEvents = [];

  walkthroughLabels.push(...(await runBeatRange(page, 1, 9)));
  traceEvents.push({ phase: "preview-device-dock", evidence: await shellEvidence(page) });
  await delay(HOLD.previewMs);

  walkthroughLabels.push(...(await runBeatRange(page, 10, 13)));
  traceEvents.push({ phase: "activate-shared-master", evidence: await shellEvidence(page) });
  await delay(HOLD.masterPayoffMs);

  walkthroughLabels.push(...(await runBeatRange(page, 14, 16)));
  traceEvents.push({ phase: "overlay-capture-delay", evidence: await shellEvidence(page) });
  await delay(HOLD.overlayMs);

  walkthroughLabels.push(...(await runBeatRange(page, 17, 17)));
  const postRestartSparse = await shellEvidence(page);
  traceEvents.push({ phase: "restart-sparse", evidence: postRestartSparse });

  await dispatchCommands(page, [
    { type: "SHARE_CLIP" },
    { type: "SELECT_PARTICIPANT", participantId: "p2" },
    { type: "FORK_CLIP", clipId: "c1" },
    { type: "SUBMIT_REVIEW", clipId: "c2" },
    { type: "SELECT_PARTICIPANT", participantId: "p1" },
    { type: "REVISE_CLIP", clipId: "c2" },
    { type: "MARK_READY", clipId: "c2" },
    { type: "STAGE_CLIP", clipId: "c2", slotId: "s1" },
    { type: "ACTIVATE_SLOT", slotId: "s1" },
    { type: "TOGGLE_TRANSPORT" },
  ]);
  await delay(400);
  const postReactivate = await shellEvidence(page);
  traceEvents.push({ phase: "reactivate-play", evidence: postReactivate });
  await delay(HOLD.replayPayoffMs);
  const postReplay = await shellEvidence(page);
  traceEvents.push({ phase: "replay-payoff", evidence: postReplay });

  const capture = await stopAudioCapture(page);

  const restartTrace = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE,
    sequence: [
      "activate+Play (beat 13)",
      "RESTART_SESSION (beat 17)",
      "sparse restore",
      "share→fork→stage→ACTIVATE_SLOT+Play",
      "replay payoff hold",
    ],
    postRestartSparse: {
      exchangeCount: postRestartSparse?.exchangeRevisions?.length ?? null,
      restartEpoch: postRestartSparse?.restartEpoch ?? null,
      transportPlaying: postRestartSparse?.transportPlaying ?? null,
      sevenTrackAudibleCount: postRestartSparse?.sevenTrackAudibleCount ?? null,
      playbackGeneration: postRestartSparse?.playbackGeneration ?? null,
    },
    postReactivate: {
      activeMasterDraftId: postReactivate?.activeMasterDraftId ?? null,
      sevenTrackAudibleCount: postReactivate?.sevenTrackAudibleCount ?? null,
      playbackGeneration: postReactivate?.playbackGeneration ?? null,
      masterStepCount: postReactivate?.masterStepCount ?? null,
      transportPlaying: postReactivate?.transportPlaying ?? null,
    },
    postReplay: {
      sevenTrackAudibleCount: postReplay?.sevenTrackAudibleCount ?? null,
      playbackGeneration: postReplay?.playbackGeneration ?? null,
      masterStepCount: postReplay?.masterStepCount ?? null,
      masterLevelDb: postReplay?.masterLevelDb ?? null,
      doubledNotesSuspected:
        typeof postReactivate?.masterStepCount === "number"
        && typeof postReplay?.masterStepCount === "number"
        && postReplay.masterStepCount > postReactivate.masterStepCount + 8,
    },
    traceEvents,
  };
  writeFileSync(RESTART_TRACE_OUT, JSON.stringify(restartTrace, null, 2));

  writeFileSync(
    TRACE_OUT,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        baseUrl: BASE,
        walkthroughLabels,
        pageErrors,
        audioFile: AUDIO_OUT,
        audioByteLength: statSync(AUDIO_OUT).size,
        chunkCount: capture.chunkCount,
        holdMs: HOLD,
        runtimeEvidence: capture.evidence,
        traceEvents: traceEvents.map((entry) => ({
          phase: entry.phase,
          sevenTrackAudibleCount: entry.evidence?.sevenTrackAudibleCount ?? null,
          masterLevelDb: entry.evidence?.masterLevelDb ?? null,
          playbackGeneration: entry.evidence?.playbackGeneration ?? null,
        })),
      },
      null,
      2,
    ),
  );

  await browser.close();
  const audioByteLength = statSync(AUDIO_OUT).size;
  console.log(JSON.stringify({
    audioOut: AUDIO_OUT,
    traceOut: TRACE_OUT,
    restartTraceOut: RESTART_TRACE_OUT,
    audioByteLength,
    chunkCount: capture.chunkCount,
    sevenTrackAudibleCount: capture.evidence?.sevenTrackAudibleCount,
    masterLevelDb: capture.evidence?.masterLevelDb,
    pageErrors: pageErrors.length,
    holdMsTotal: HOLD.previewMs + HOLD.masterPayoffMs + HOLD.overlayMs + HOLD.replayPayoffMs,
  }, null, 2));
  if (pageErrors.length || audioByteLength < 32768) process.exitCode = 1;
} finally {
  shutdown();
}
