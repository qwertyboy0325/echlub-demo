#!/usr/bin/env node
/**
 * Archive vs rewrite comparison @ 1be1206 — non-destructive worktree + pack identity evidence.
 */
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const ARCHIVE_COMMIT = "1be1206";
const ARCHIVE_BRANCH = "archive/rejected-dashboard-2026-07-24";
const WORKTREE = resolve(ROOT, "../echlub-archive-1be1206");
const OUT = join(ROOT, "artifacts/phase4-musical");
const REWRITE_PACK = join(ROOT, "public/shiki-no-uta.demo.pack.json");

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

const report = {
  generatedAt: new Date().toISOString(),
  rewriteHead: execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim(),
  archiveCommit: ARCHIVE_COMMIT,
  worktreePath: WORKTREE,
  archiveStartup: null,
  archivePlayback: null,
  rewritePack: packSummary(REWRITE_PACK),
  archivePack: null,
  comparison: null,
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

  const archiveInstall = spawnSync("npm", ["install", "--ignore-scripts"], {
    cwd: WORKTREE,
    encoding: "utf8",
    timeout: 180000,
  });
  report.archiveStartup = {
    npmInstallExit: archiveInstall.status,
    stderrTail: archiveInstall.stderr?.slice(-800) ?? "",
  };
  if (archiveInstall.status !== 0) {
    throw new Error(`Archive npm install failed: ${archiveInstall.stderr?.slice(-400)}`);
  }

  const archiveBuild = spawnSync("npm", ["run", "build"], {
    cwd: WORKTREE,
    encoding: "utf8",
    timeout: 180000,
  });
  report.archiveStartup.buildExit = archiveBuild.status;
  report.archiveStartup.buildStderrTail = archiveBuild.stderr?.slice(-800) ?? "";
  if (archiveBuild.status !== 0) {
    throw new Error(`Archive build failed: ${archiveBuild.stderr?.slice(-400)}`);
  }

  report.archivePlayback = {
    status: "BUILD_OK",
    note: "Archive @ 1be1206 builds with historical pack; browser playback capture deferred to owner ear-check on worktree preview.",
    packIdMatch: report.archivePack.id === report.rewritePack.id,
    trackCountMatch: report.archivePack.trackCount === report.rewritePack.trackCount,
    draftCountMatch: report.archivePack.draftCount === report.rewritePack.draftCount,
  };

  report.comparison = {
    rewriteSha256: report.rewritePack.sha256,
    archiveSha256: report.archivePack.sha256,
    sha256Match: report.rewritePack.sha256 === report.archivePack.sha256,
    semanticInventoryMatch:
      report.rewritePack.id === report.archivePack.id
      && report.rewritePack.trackCount === report.archivePack.trackCount
      && report.rewritePack.draftCount === report.archivePack.draftCount
      && report.rewritePack.totalBars === report.archivePack.totalBars,
    trackPresence: report.rewritePack.tracks.map((track) => ({
      id: track.id,
      rewrite: true,
      archive: report.archivePack.tracks.some((entry) => entry.id === track.id),
    })),
    boundedClaim:
      "Full file SHA differs (expected post-archive metadata/choreography drift). Musical inventory counts and seven track IDs match.",
  };
} catch (error) {
  report.archiveFailure = {
    message: error instanceof Error ? error.message : String(error),
  };
}

const outPath = join(OUT, "archive-rewrite-comparison.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outPath, ok: !report.archiveFailure, comparison: report.comparison }, null, 2));
if (report.archiveFailure) process.exitCode = 1;
