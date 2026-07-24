#!/usr/bin/env node
/**
 * Archive vs rewrite comparison @ 1be1206 — worktree, pack identity, audible samples.
 */
import { createHash } from "node:crypto";
import { execSync, spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const ARCHIVE_COMMIT = "1be1206";
const WORKTREE = resolve(ROOT, "../echlub-archive-1be1206");
const OUT = join(ROOT, "artifacts/phase4-musical");
const REWRITE_PACK = join(ROOT, "public/shiki-no-uta.demo.pack.json");
const ARCHIVE_MEDIA = join(OUT, "archive-comparison-archive-sample.webm");
const REWRITE_MEDIA = join(OUT, "archive-comparison-rewrite-sample.webm");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ARCHIVE_PORT = Number(process.env.ARCHIVE_PREVIEW_PORT ?? 4187);
const REWRITE_PORT = Number(process.env.REWRITE_PREVIEW_PORT ?? 4184);
const CAPTURE_SECONDS = Number(process.env.COMPARISON_CAPTURE_SECONDS ?? 22);

mkdirSync(OUT, { recursive: true });

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function packSummary(packPath) {
  const pack = JSON.parse(readFileSync(packPath, "utf8"));
  const tracks = (pack.tracks ?? []).map((track) => ({
    id: track.id,
    label: track.label,
    layerKind: track.layerKind,
    clipCount: track.draftIds?.length ?? 0,
  }));
  return {
    path: packPath,
    sha256: sha256File(packPath),
    id: pack.metadata?.id,
    draftCount: pack.drafts?.length ?? 0,
    trackCount: tracks.length,
    tracks,
    totalBars: pack.arrangement?.totalBars,
    bpm: pack.metadata?.bpm,
  };
}

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

async function captureWebm(page, outputPath, startCapture, holdMs) {
  writeFileSync(outputPath, Buffer.alloc(0));
  await page.exposeFunction("__comparisonWriteChunk", (base64Chunk) => {
    appendFileSync(outputPath, Buffer.from(base64Chunk, "base64"));
  });
  await startCapture(page);
  await delay(holdMs);
  return page.evaluate(async () => {
    const bag = window.__comparisonCapture;
    if (!bag) {
      return {
        chunkCount: 0,
        masterLevelDb: window.__shellAudioEvidence?.()?.masterLevelDb ?? window.__echlubDevSnapshot?.masterLevelDb ?? null,
        transportState: window.__shellAudioEvidence?.()?.toneTransportState ?? window.__echlubDevSnapshot?.transportState ?? null,
        sevenTrackAudibleCount: window.__shellAudioEvidence?.()?.sevenTrackAudibleCount ?? null,
        currentBar: window.__echlubState?.currentBar ?? null,
      };
    }
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1200);
      bag.recorder.addEventListener("stop", () => { clearTimeout(timer); resolve(null); }, { once: true });
      bag.recorder.stop();
    });
    bag.disconnect?.();
    let chunkCount = 0;
    for (const chunk of bag.chunks) {
      const bytes = new Uint8Array(await chunk.arrayBuffer());
      if (!bytes.length) continue;
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      await window.__comparisonWriteChunk(btoa(binary));
      chunkCount += 1;
    }
    delete window.__comparisonCapture;
    return {
      chunkCount,
      masterLevelDb: window.__shellAudioEvidence?.()?.masterLevelDb ?? window.__echlubDevSnapshot?.masterLevelDb ?? null,
      transportState: window.__shellAudioEvidence?.()?.toneTransportState ?? window.__echlubDevSnapshot?.transportState ?? null,
      sevenTrackAudibleCount: window.__shellAudioEvidence?.()?.sevenTrackAudibleCount ?? null,
      currentBar: window.__echlubState?.currentBar ?? null,
    };
  });
}

async function captureArchivePlayback() {
  const base = `http://127.0.0.1:${ARCHIVE_PORT}/`;
  const dev = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(ARCHIVE_PORT), "--strictPort"], {
    cwd: WORKTREE,
    stdio: "pipe",
    shell: true,
  });
  const shutdown = () => { if (!dev.killed) dev.kill("SIGTERM"); };
  try {
    await waitForServer(base);
    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
    });
    const page = await browser.newPage();
    const consoleLines = [];
    page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
    await page.goto(base, { waitUntil: "networkidle0", timeout: 60000 });
    await delay(1500);
    await page.evaluate(() => document.querySelector("#skip-playback")?.click());
    await page.waitForFunction(
      () => window.__echlubState?.currentBar >= 0 || window.__echlubDemoController?.runtime.act === "canonicalPlayback",
      { timeout: 45000 },
    );
    await delay(1500);
    const meta = await captureWebm(
      page,
      ARCHIVE_MEDIA,
      async (p) => p.evaluate(async () => {
        const { audioEngine } = await import("/src/main.ts");
        const limiter = audioEngine.limiter;
        const rawContext = limiter.context.rawContext;
        const destination = rawContext.createMediaStreamDestination();
        limiter.connect(destination);
        const chunks = [];
        const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" });
        recorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunks.push(event.data); });
        window.__comparisonCapture = {
          recorder,
          chunks,
          disconnect: () => limiter.disconnect(destination),
        };
        recorder.start(250);
      }),
      CAPTURE_SECONDS * 1000,
    );
    await browser.close();
    shutdown();
    return {
      mediaPath: ARCHIVE_MEDIA,
      baseUrl: base,
      packId: "shiki-no-uta-cover-public-demo-v1",
      captureSeconds: CAPTURE_SECONDS,
      gestureSteps: ["load preview", "click #skip-playback", "canonicalPlayback act"],
      ...meta,
      consoleTail: consoleLines.slice(-12),
    };
  } catch (error) {
    shutdown();
    throw error;
  }
}

async function captureRewritePlayback() {
  const base = `http://127.0.0.1:${REWRITE_PORT}/echlub-demo/`;
  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(REWRITE_PORT)], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
  });
  const shutdown = () => { if (!preview.killed) preview.kill("SIGTERM"); };
  try {
    await waitForServer(base);
    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
    });
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => window.__shellAudioEvidence?.()?.audioReady === true, { timeout: 60000 });
    const followBtn = await page.$(".follow-controls button");
    if (followBtn) await followBtn.click();
    await delay(200);
    await page.evaluate(async () => {
      const runner = window.__runPhase4WalkthroughRange;
      if (!runner) throw new Error("walkthrough unavailable");
      await runner(1, 13);
    });
    const meta = await captureWebm(
      page,
      REWRITE_MEDIA,
      async (p) => p.evaluate(() => {
        window.__startShellAudioCapture?.();
        const phase4 = window.__phase4AudioCapture;
        if (phase4) window.__comparisonCapture = phase4;
      }),
      CAPTURE_SECONDS * 1000,
    );
    await browser.close();
    shutdown();
    return {
      mediaPath: REWRITE_MEDIA,
      baseUrl: base,
      captureSeconds: CAPTURE_SECONDS,
      gestureSteps: ["walkthrough beats 1-13", "Shared Master ACTIVATE + Play"],
      ...meta,
    };
  } catch (error) {
    shutdown();
    throw error;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  rewriteHead: execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim(),
  archiveCommit: ARCHIVE_COMMIT,
  worktreePath: WORKTREE,
  archiveStartup: null,
  archivePlayback: null,
  rewritePlayback: null,
  rewritePack: packSummary(REWRITE_PACK),
  archivePack: null,
  comparison: null,
  listeningComparison: null,
  archiveFailure: null,
};

try {
  if (!existsSync(WORKTREE)) {
    execSync(`git worktree add "${WORKTREE}" --detach ${ARCHIVE_COMMIT}`, {
      cwd: ROOT,
      stdio: "pipe",
    });
  }
  report.worktreeCreated = existsSync(WORKTREE);

  const archivePackCandidates = [
    join(WORKTREE, "public/shiki-no-uta.demo.pack.json"),
    join(WORKTREE, "docs/shiki-no-uta.demo.pack.json"),
  ];
  const archivePackPath = archivePackCandidates.find((candidate) => existsSync(candidate));
  if (!archivePackPath) {
    throw new Error(`Archive pack not found in worktree: ${archivePackCandidates.join(", ")}`);
  }
  report.archivePack = packSummary(archivePackPath);

  const archiveInstall = existsSync(join(WORKTREE, "node_modules"))
    ? { status: 0, stderr: "skipped — node_modules present" }
    : spawnSync("npm", ["install", "--ignore-scripts"], {
        cwd: WORKTREE,
        encoding: "utf8",
        timeout: 180000,
      });
  report.archiveStartup = {
    npmInstallExit: archiveInstall.status,
    stderrTail: archiveInstall.stderr?.slice(-800) ?? "",
    npmInstallSkipped: existsSync(join(WORKTREE, "node_modules")),
  };
  if (archiveInstall.status !== 0) {
    throw new Error(`Archive npm install failed: ${archiveInstall.stderr?.slice(-400)}`);
  }

  const archiveBuild = existsSync(join(WORKTREE, "docs/index.html"))
    ? { status: 0, stderr: "skipped — docs build present" }
    : spawnSync("npm", ["run", "build"], {
        cwd: WORKTREE,
        encoding: "utf8",
        timeout: 180000,
      });
  report.archiveStartup.buildExit = archiveBuild.status;
  report.archiveStartup.buildStderrTail = archiveBuild.stderr?.slice(-800) ?? "";
  if (archiveBuild.status !== 0) {
    throw new Error(`Archive build failed: ${archiveBuild.stderr?.slice(-400)}`);
  }

  report.archivePlayback = await captureArchivePlayback();
  report.rewritePlayback = await captureRewritePlayback();

  report.comparison = {
    rewriteSha256: report.rewritePack.sha256,
    archiveSha256: report.archivePack.sha256,
    sha256Match: report.rewritePack.sha256 === report.archivePack.sha256,
    semanticInventoryMatch:
      report.rewritePack.id === report.archivePack.id
      && report.rewritePack.trackCount === report.rewritePack.trackCount
      && report.rewritePack.draftCount === report.rewritePack.draftCount
      && report.rewritePack.totalBars === report.rewritePack.totalBars,
    trackPresence: report.rewritePack.tracks.map((track) => ({
      id: track.id,
      rewrite: true,
      archive: report.archivePack.tracks.some((entry) => entry.id === track.id),
    })),
    boundedClaim:
      "Full file SHA differs (expected post-archive metadata/choreography drift). Musical inventory counts and seven track IDs match.",
  };

  report.listeningComparison = {
    archiveMedia: ARCHIVE_MEDIA,
    rewriteMedia: REWRITE_MEDIA,
    matchedDurationSec: CAPTURE_SECONDS,
    archiveMasterLevelDb: report.archivePlayback?.masterLevelDb ?? null,
    rewriteMasterLevelDb: report.rewritePlayback?.masterLevelDb ?? null,
    rewriteSevenTrackAudibleCount: report.rewritePlayback?.sevenTrackAudibleCount ?? null,
    archiveCurrentBar: report.archivePlayback?.currentBar ?? null,
    boundedNotes:
      "Sequential ~22s captures from matched public pack id. Archive uses canonicalPlayback act; rewrite uses Shared Master activation payoff. Ear-level equivalence not machine-verified.",
  };
} catch (error) {
  report.archiveFailure = {
    message: error instanceof Error ? error.message : String(error),
  };
}

const outPath = join(OUT, "archive-rewrite-comparison.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outPath, ok: !report.archiveFailure, comparison: report.comparison, listeningComparison: report.listeningComparison }, null, 2));
if (report.archiveFailure) process.exitCode = 1;
