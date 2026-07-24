#!/usr/bin/env node
/**
 * Safari Phase 4 smoke — uses WebKit if available on owner macOS.
 */
import { spawnSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const OUT = "artifacts/phase4-musical";
const BASE = process.env.PHASE4_BASE_URL ?? "http://127.0.0.1:4173/echlub-demo/";
mkdirSync(OUT, { recursive: true });

const osVersion = spawnSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).stdout.trim();
const safariApp = "/Applications/Safari.app/Contents/MacOS/Safari";
const webkitCandidates = [
  process.env.WEBKIT_EXECUTABLE,
  "/Applications/Xcode.app/Contents/Developer/usr/bin/safaridriver",
].filter(Boolean);

const report = {
  capturedAt: new Date().toISOString(),
  browser: "Safari/WebKit",
  osVersion,
  baseUrl: BASE,
  status: "BLOCKED",
  reason: "Puppeteer WebKit executable not configured — manual Safari validation required on owner macOS",
  manualChecklist: [
    "gesture unlock on Play",
    "Preview workspace cue",
    "7-track master after ACTIVATE + Play",
    "Devices param + Dock bidirectional sync",
    "RESTART_SESSION sparse restore + replay",
  ],
  webkitCandidates,
};

async function tryWebkit() {
  const executablePath = process.env.WEBKIT_PATH
    ?? "/System/Library/Frameworks/WebKit.framework/Versions/A/XPCServices/com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent";
  if (!process.env.WEBKIT_PATH) return null;
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
  await delay(1000);
  const evidence = await page.evaluate(() => window.__shellAudioEvidence?.() ?? null);
  await browser.close();
  return evidence;
}

try {
  const evidence = await tryWebkit();
  if (evidence) {
    report.status = "OBSERVED";
    report.evidence = evidence;
    report.reason = null;
  }
} catch (error) {
  report.attemptError = error instanceof Error ? error.message : String(error);
}

report.safariInstalled = spawnSync("test", ["-x", safariApp]).status === 0;
writeFileSync(join(OUT, "safari-validation.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, out: join(OUT, "safari-validation.json") }, null, 2));
