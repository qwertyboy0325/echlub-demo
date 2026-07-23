#!/usr/bin/env node
import { spawnSync, execSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  copyFileSync,
  cpSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const campaignDir = join(root, "artifacts/collaborative-daw-campaign");
const staging = join(campaignDir, "bundle-staging");
const zipPath = join(campaignDir, "final-owner-review-bundle.zip");
const shaPath = join(campaignDir, "final-owner-review-bundle.sha256");

function run(cmd, args, outFile) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (outFile) writeFileSync(outFile, text);
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${text}`);
  return text;
}

mkdirSync(staging, { recursive: true });
mkdirSync(join(staging, "diff"), { recursive: true });
mkdirSync(join(staging, "validation"), { recursive: true });
mkdirSync(join(staging, "evidence"), { recursive: true });

const base = "d30d73d";
writeFileSync(join(staging, "branch.txt"), execSync("git branch --show-current", { encoding: "utf8" }));
writeFileSync(join(staging, "head.txt"), execSync("git rev-parse HEAD", { encoding: "utf8" }));
writeFileSync(join(staging, "commits.txt"), execSync(`git log --oneline ${base}..HEAD`, { encoding: "utf8" }));
writeFileSync(join(staging, "diff/aggregate.patch"), execSync(`git diff ${base}..HEAD`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }));

for (const name of [
  "campaign-ledger.md",
  "grok-product-critique.md",
  "sol-medium-semantic-audit.md",
  "final-owner-report.md",
  "known-limitations.md",
  "recording-instructions.md",
]) {
  const src = join(campaignDir, name);
  if (existsSync(src)) copyFileSync(src, join(staging, name));
}

for (const name of ["campaign-final-evidence.json", "topology-scenarios.json"]) {
  const src = join(campaignDir, "evidence", name);
  if (existsSync(src)) copyFileSync(src, join(staging, "evidence", name));
}

const validationDir = join(staging, "validation");
run("npm", ["run", "typecheck"], join(validationDir, "typecheck.txt"));
run("npm", ["run", "test"], join(validationDir, "test.txt"));
run("npm", ["run", "build"], join(validationDir, "build.txt"));
run("npm", ["run", "validate:browser"], join(validationDir, "validate-browser.txt"));
writeFileSync(join(validationDir, "git-diff-check.txt"), execSync("git diff --check", { encoding: "utf8" }));

run("node", ["scripts/campaign-final-evidence.mjs"], join(validationDir, "campaign-final-evidence-run.txt"));
for (const name of ["campaign-final-evidence.json", "topology-scenarios.json"]) {
  const src = join(campaignDir, "evidence", name);
  if (existsSync(src)) copyFileSync(src, join(staging, "evidence", name));
}

const sourceDir = join(staging, "source");
mkdirSync(sourceDir, { recursive: true });
for (const rel of [
  "src/style.css",
  "src/domain/capabilityOperations.ts",
  "src/demo/capabilityLiveOperations.ts",
  "src/capabilityUiTargets.ts",
  "src/ui/liveCapabilityWorkspaces.ts",
  "src/demo/demoController.ts",
  "src/demo/demoRuntime.ts",
  "src/main.ts",
  "scripts/campaign-final-evidence.mjs",
  "src/validation/capabilityOperations.test.ts",
]) {
  const src = join(root, rel);
  if (existsSync(src)) {
    const dest = join(sourceDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

execSync(`rm -f "${zipPath}"`, { shell: true });
execSync(`cd "${campaignDir}" && zip -r final-owner-review-bundle.zip bundle-staging`, { stdio: "inherit" });
const digest = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
writeFileSync(shaPath, `${digest}  final-owner-review-bundle.zip\n`);
console.log(`Wrote ${zipPath}`);
console.log(`Wrote ${shaPath}`);
console.log(digest);
