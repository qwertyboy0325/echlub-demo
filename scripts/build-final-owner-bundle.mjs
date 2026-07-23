#!/usr/bin/env node
import { spawnSync, execSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  copyFileSync,
  cpSync,
  readFileSync,
  existsSync,
  rmSync,
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

function assertBundleIntegrity(expectedHead) {
  const bundleHead = readFileSync(join(staging, "head.txt"), "utf8").trim();
  if (bundleHead !== expectedHead) {
    throw new Error(`bundle head.txt mismatch: expected ${expectedHead}, got ${bundleHead}`);
  }
  const commits = readFileSync(join(staging, "commits.txt"), "utf8");
  const headShort = expectedHead.slice(0, 7);
  if (!commits.includes(headShort)) {
    throw new Error(`commits.txt does not include bundle HEAD ${headShort}`);
  }
  const patch = readFileSync(join(staging, "diff/aggregate.patch"), "utf8");
  for (const needle of [
    "cap-lowend-cue",
    "cap-harmony-revise",
    "capability-dock-recording",
    "docs/index.html",
    "daw-live-dock",
  ]) {
    if (!patch.includes(needle)) {
      throw new Error(`aggregate.patch missing expected content: ${needle}`);
    }
  }
  const buildLog = readFileSync(join(staging, "validation/build.txt"), "utf8");
  const jsMatch = buildLog.match(/docs\/assets\/index-[^.]+\.js/);
  const cssMatch = buildLog.match(/docs\/assets\/index-[^.]+\.css/);
  if (!jsMatch || !cssMatch) {
    throw new Error("build.txt missing current docs asset names");
  }
  const html = readFileSync(join(root, "docs/index.html"), "utf8");
  if (!html.includes(jsMatch[0].split("/").pop()) || !html.includes(cssMatch[0].split("/").pop())) {
    throw new Error("docs/index.html does not reference current build assets");
  }
}

const porcelain = execSync("git status --porcelain", { encoding: "utf8" }).trim();
const dirty = porcelain
  ? porcelain.split("\n").filter((line) => line.trim() && !/^\?\? \.cursor\//.test(line.trim()))
  : [];
if (dirty.length) {
  throw new Error(`Working tree must be clean before bundle generation:\n${dirty.join("\n")}`);
}

const expectedHead = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();

if (existsSync(staging)) {
  rmSync(staging, { recursive: true, force: true });
}
mkdirSync(staging, { recursive: true });
mkdirSync(join(staging, "diff"), { recursive: true });
mkdirSync(join(staging, "validation"), { recursive: true });
mkdirSync(join(staging, "evidence"), { recursive: true });

const base = "d30d73d";
writeFileSync(join(staging, "branch.txt"), execSync("git branch --show-current", { encoding: "utf8" }));
writeFileSync(join(staging, "head.txt"), `${expectedHead}\n`);
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

const validationDir = join(staging, "validation");
run("npm", ["run", "typecheck"], join(validationDir, "typecheck.txt"));
run("npm", ["run", "test"], join(validationDir, "test.txt"));
run("npm", ["run", "build"], join(validationDir, "build.txt"));
run("npm", ["run", "validate:browser"], join(validationDir, "validate-browser.txt"));
writeFileSync(join(validationDir, "git-diff-check.txt"), execSync("git diff --check", { encoding: "utf8" }));
writeFileSync(join(validationDir, "git-status-porcelain.txt"), execSync("git status --porcelain", { encoding: "utf8" }));

run("node", ["scripts/campaign-final-evidence.mjs"], join(validationDir, "campaign-final-evidence-run.txt"));

for (const name of ["campaign-final-evidence.json", "topology-scenarios.json"]) {
  const src = join(campaignDir, "evidence", name);
  if (existsSync(src)) copyFileSync(src, join(staging, "evidence", name));
}
const screenshotSrc = join(campaignDir, "evidence/screenshots");
if (existsSync(screenshotSrc)) {
  cpSync(screenshotSrc, join(staging, "evidence/screenshots"), { recursive: true });
}

assertBundleIntegrity(expectedHead);

const sourceDir = join(staging, "source");
mkdirSync(sourceDir, { recursive: true });
for (const rel of [
  "src/style.css",
  "src/ui/appShell.ts",
  "src/ui/performanceOverlay.ts",
  "src/types.ts",
  "src/choreographyScript.ts",
  "src/presentation.ts",
  "src/uiTargets.ts",
  "src/demo/liveMutations.ts",
  "src/domain/capabilityOperations.ts",
  "src/demo/capabilityLiveOperations.ts",
  "src/capabilityUiTargets.ts",
  "src/ui/liveCapabilityWorkspaces.ts",
  "src/demo/demoController.ts",
  "src/demo/demoRuntime.ts",
  "src/main.ts",
  "scripts/campaign-final-evidence.mjs",
  "scripts/build-final-owner-bundle.mjs",
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
console.log(`HEAD ${expectedHead}`);
console.log(digest);
