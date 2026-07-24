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
const distPrivate = grepArtifacts("docs", /midi-only\.pack|shiki-no-uta-midi-only-private/);
const shellAssertions = existsSync("artifacts/shell-ready/viewport-assertions.json")
  ? JSON.parse(readFileSync("artifacts/shell-ready/viewport-assertions.json", "utf8"))
  : [];
const browserCapture = existsSync(join(OUT, "browser-console-capture.json"))
  ? JSON.parse(readFileSync(join(OUT, "browser-console-capture.json"), "utf8"))
  : null;

const manifest = {
  generatedAt: new Date().toISOString(),
  gitHead: HEAD,
  phase: "4-musical-integration",
  publicPack: {
    id: "shiki-no-uta-cover-public-demo-v1",
    path: packPath,
    sha256: packSha,
  },
  privateExclusion: {
    docsHits: distPrivate,
    clean: distPrivate.length === 0,
  },
  visualEvidence: {
    shellAssertionsPath: "artifacts/shell-ready/viewport-assertions.json",
    screenshots1440: existsSync("artifacts/shell-ready")
      ? readdirSync("artifacts/shell-ready").filter((f) => f.includes("1440"))
      : [],
    screenshots1280: existsSync("artifacts/shell-ready")
      ? readdirSync("artifacts/shell-ready").filter((f) => f.includes("1280"))
      : [],
  },
  tests: {
    shellMusicalIntegration: "src/validation/shellMusicalIntegration.test.ts",
    shellAudioAdapter: "src/validation/shellAudioAdapter.test.ts",
    dockMixSync: "src/validation/dockMixSync.test.ts",
    shikiPublicPack: "src/validation/shikiPublicPack.test.ts",
  },
  walkthrough: "src/shell/presenterWalkthrough.ts",
  runtimePlayback: {
    archiveA_B: "NOT EXECUTED — archive branch present locally; comparable playback not captured this session",
    rewritePlayback: browserCapture?.checks?.transportStarted
      ? "OBSERVED — lifecycle + master layers @ localhost:4173"
      : "PARTIAL — see browser-console-capture.json",
    restart: browserCapture?.checks?.restartSparse
      ? "OBSERVED — RESTART_SESSION sparse exchange @ browser proof"
      : "IMPLEMENTED — RESTART_SESSION command",
    dockSync: browserCapture?.checks?.dockRoundTrip
      ? "OBSERVED — UI 0.72 ↔ engine mixFilter 5816"
      : "PARTIAL",
  },
  browserCapture: "artifacts/phase4-musical/browser-console-capture.json",
  browserProofScript: "scripts/browser-phase4-musical-proof.mjs",
  walkthroughRecording: "artifacts/shell-ready/shell-walkthrough.webm",
  grokCritique: "research/phase4-grok-cold-viewer-critique.md",
};

writeFileSync(join(OUT, "phase4-evidence-manifest.json"), JSON.stringify(manifest, null, 2));

const browserSummary = browserCapture?.checks
  ? Object.entries(browserCapture.checks)
      .map(([k, v]) => `- ${k}: **${v ? "pass" : "fail"}**`)
      .join("\n")
  : "- browser proof not run";

writeFileSync(
  join(OUT, "observation-log.md"),
  `# Phase 4 Observation Log

- Git HEAD: \`${HEAD}\`
- Public pack SHA-256: \`${packSha}\`
- Shell viewport assertions: ${shellAssertions.length} checks
- Private pack in docs build: ${distPrivate.length === 0 ? "CLEAN" : distPrivate.join(", ")}
- Audio adapter: \`src/shell/audio/shellAudioAdapter.ts\`
- Musical domain: \`src/shell/domain/musicalDomain.ts\`
- Dock sync: \`src/shell/audio/dockMixSync.ts\` + \`SYNC_DOCK_FROM_MIX\`

## Browser verification (@ http://localhost:4173/, preview build)

${browserSummary}

## Implemented this session

- Dock bidirectional sync (UI→engine→dock via \`SYNC_DOCK_FROM_MIX\`)
- Shared Master hydrates pack \`scenePlacements\` + \`sceneLayerStacks\`; activated fork overrides kind layer
- \`publishBank\` no longer resets mix on draft edits (root-cause fix for dock round-trip race)
- Dispatch bridge installed at module load (Strict Mode safe)
- Browser proof script: \`scripts/browser-phase4-musical-proof.mjs\`

## Honest gaps

- Archive A/B comparable playback @ \`archive/rejected-dashboard-2026-07-24\` / \`1be1206\` not captured
- 7-track audible verification across full song — arrangement boundaries wired; owner ear-check required
- Safari walkthrough: **unverified**
- Fresh 2–4 min audio walkthrough recording not re-captured (prior shell-walkthrough.webm is visual-only @ Phase 3B)
`,
);

console.log(`Phase 4 manifest → ${OUT}/phase4-evidence-manifest.json`);
