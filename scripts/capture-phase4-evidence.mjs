#!/usr/bin/env node
/**
 * Phase 4 musical evidence capture — extends shell visual capture with
 * domain event trace, private-pack exclusion, and walkthrough manifest.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
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
const shellAssertions = readFileSync("artifacts/shell-ready/viewport-assertions.json", "utf8");

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
    screenshots1440: readdirSync("artifacts/shell-ready").filter((f) => f.includes("1440")),
    screenshots1280: readdirSync("artifacts/shell-ready").filter((f) => f.includes("1280")),
  },
  tests: {
    shellMusicalIntegration: "src/validation/shellMusicalIntegration.test.ts",
    shikiPublicPack: "src/validation/shikiPublicPack.test.ts",
  },
  walkthrough: "src/shell/presenterWalkthrough.ts",
  runtimePlayback: {
    archiveA_B: "NOT EXECUTED — requires manual archive checkout @ 1be1206",
    rewritePlayback: "IMPLEMENTED — shellAudioAdapter + public pack fetch",
    restart: "IMPLEMENTED — RESTART_SESSION command",
  },
  grokCritique: "research/phase4-grok-cold-viewer-critique.md",
};

writeFileSync(join(OUT, "phase4-evidence-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(OUT, "observation-log.md"), `# Phase 4 Observation Log

- Git HEAD: \`${HEAD}\`
- Public pack SHA-256: \`${packSha}\`
- Shell viewport assertions: present (${JSON.parse(shellAssertions).length} checks)
- Private pack in docs build: ${distPrivate.length === 0 ? "CLEAN" : distPrivate.join(", ")}
- Audio adapter: \`src/shell/audio/shellAudioAdapter.ts\`
- Musical domain: \`src/shell/domain/musicalDomain.ts\`
- Archive A/B playback: not executed this session (Step 1 gate)
`);

console.log(`Phase 4 manifest → ${OUT}/phase4-evidence-manifest.json`);
