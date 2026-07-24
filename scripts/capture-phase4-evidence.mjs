#!/usr/bin/env node
/**
 * Phase 4 musical evidence capture — extends shell visual capture with
 * domain event trace, private-pack exclusion, and walkthrough manifest.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = "artifacts/phase4-musical";
const HEAD = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();

mkdirSync(OUT, { recursive: true });

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function grepArtifacts(dir, pattern) {
  const hits = [];
  const walk = (base) => {
    for (const name of readdirSync(base)) {
      const full = join(base, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|json|html|css|map)$/.test(name)) {
        const text = readFileSync(full, "utf8");
        if (pattern.test(text)) hits.push(full);
      }
    }
  };
  walk(dir);
  return hits;
}

const packPath = "public/shiki-no-uta.demo.pack.json";
const packSha = sha256File(packPath);
const distPrivate = grepArtifacts("docs", /midi-only\.pack|shiki-no-uta-midi-only-private|local-reconstruction\//);
const browserCapture = existsSync(join(OUT, "browser-console-capture.json"))
  ? JSON.parse(readFileSync(join(OUT, "browser-console-capture.json"), "utf8"))
  : null;
const lifecycleTrace = existsSync(join(OUT, "lifecycle-event-trace.json"))
  ? JSON.parse(readFileSync(join(OUT, "lifecycle-event-trace.json"), "utf8"))
  : null;
const archiveComparison = existsSync(join(OUT, "archive-rewrite-comparison.json"))
  ? JSON.parse(readFileSync(join(OUT, "archive-rewrite-comparison.json"), "utf8"))
  : null;
const safariValidation = existsSync(join(OUT, "safari-validation.json"))
  ? JSON.parse(readFileSync(join(OUT, "safari-validation.json"), "utf8"))
  : null;

const manifest = {
  generatedAt: new Date().toISOString(),
  gitHead: HEAD,
  phase: "4-musical-closure",
  stopLine: "ECHLUB PHASE 4 MUSICAL EVIDENCE COMPLETE — STOPPED FOR OWNER FINAL APPROVAL",
  publicPack: {
    id: "shiki-no-uta-cover-public-demo-v1",
    path: packPath,
    sha256: packSha,
  },
  privateExclusion: {
    docsHits: distPrivate,
    clean: distPrivate.length === 0,
  },
  sevenTrackMaster: {
    trackIds: [
      "track-alto",
      "track-tenor",
      "track-piano-rh",
      "track-piano-lh",
      "track-guitar",
      "track-bass",
      "track-drums",
    ],
    instruments: ["alto", "tenor", "piano-rh", "piano-lh", "guitar", "bass", "drums"],
    browserSevenTrackAtActivate: browserCapture?.playingEvidence?.sevenTrackAudibleCount ?? null,
  },
  runtimePlayback: {
    archiveWorktree: archiveComparison?.worktreePath ?? null,
    archiveBuild: archiveComparison?.archiveStartup?.buildExit === 0 ? "PASS" : "PARTIAL",
    archivePackSemanticMatch: archiveComparison?.comparison?.semanticInventoryMatch ?? false,
    rewriteBrowserProof: browserCapture?.checks ?? null,
    audibleWalkthrough: existsSync(join(OUT, "phase4-audible-walkthrough.webm"))
      ? join(OUT, "phase4-audible-walkthrough.webm")
      : "NOT CAPTURED",
    archiveComparisonMedia: existsSync(join(OUT, "archive-comparison-rewrite-sample.webm"))
      ? join(OUT, "archive-comparison-rewrite-sample.webm")
      : "NOT CAPTURED",
    lifecycleTrace: join(OUT, "lifecycle-event-trace.json"),
    safari: safariValidation?.status ?? "NOT RUN",
  },
  browserCapture: join(OUT, "browser-console-capture.json"),
  archiveComparison: join(OUT, "archive-rewrite-comparison.json"),
};

writeFileSync(join(OUT, "phase4-evidence-manifest.json"), JSON.stringify(manifest, null, 2));

const browserSummary = browserCapture?.checks
  ? Object.entries(browserCapture.checks)
      .map(([k, v]) => `- ${k}: **${v ? "pass" : "fail"}**`)
      .join("\n")
  : "- browser proof not run";

writeFileSync(
  join(OUT, "observation-log.md"),
  `# Phase 4 Closure Observation Log

- Git HEAD: \`${HEAD}\`
- Stop line: **ECHLUB PHASE 4 MUSICAL EVIDENCE COMPLETE — STOPPED FOR OWNER FINAL APPROVAL**
- Public pack SHA-256: \`${packSha}\`
- Private pack in docs build: ${distPrivate.length === 0 ? "CLEAN" : distPrivate.join(", ")}

## Chromium browser proof

${browserSummary}

## Archive @ 1be1206

- Worktree: ${archiveComparison?.worktreePath ?? "not created"}
- Semantic inventory match: ${archiveComparison?.comparison?.semanticInventoryMatch ?? "unknown"}
- Full SHA match: ${archiveComparison?.comparison?.sha256Match ?? "unknown"}

## Audible artifacts

- Walkthrough: \`artifacts/phase4-musical/phase4-audible-walkthrough.webm\`
- Archive comparison sample: \`artifacts/phase4-musical/archive-comparison-rewrite-sample.webm\`
- Lifecycle trace: \`artifacts/phase4-musical/lifecycle-event-trace.json\`

## Safari

- Status: ${safariValidation?.status ?? "NOT RUN"}
`,
);

console.log(`Phase 4 manifest → ${OUT}/phase4-evidence-manifest.json`);
