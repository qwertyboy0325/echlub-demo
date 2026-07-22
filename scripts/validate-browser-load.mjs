#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REQUIRED = [
  { path: "/", label: "HTML" },
  { path: "/@vite/client", label: "Vite client" },
  { path: "/src/main.ts", label: "main.ts" },
];

async function fetchStatus(url) {
  const res = await fetch(url, { redirect: "follow" });
  return { url, ok: res.ok, status: res.status };
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await delay(250);
  }
  return false;
}

const dev = spawn("npm", ["run", "dev"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "0" },
});

let devOutput = "";
dev.stdout.on("data", (chunk) => { devOutput += chunk.toString(); });
dev.stderr.on("data", (chunk) => { devOutput += chunk.toString(); });

const shutdown = () => {
  if (!dev.killed) dev.kill("SIGTERM");
};

process.on("exit", shutdown);
process.on("SIGINT", () => { shutdown(); process.exit(130); });

const ready = await waitForServer();
if (!ready) {
  shutdown();
  console.error(JSON.stringify({
    ok: false,
    command: "npm run dev",
    port: PORT,
    baseUrl: BASE_URL,
    error: "dev server did not become ready",
    devOutput,
  }, null, 2));
  process.exit(1);
}

const networkFailures = [];
const checks = [];

for (const item of REQUIRED) {
  const result = await fetchStatus(`${BASE_URL.replace(/\/$/, "")}${item.path}`);
  checks.push({ ...item, ...result });
  if (!result.ok) networkFailures.push({ ...item, status: result.status });
}

let startButtonExists = false;
const browserConsoleErrors = [];
try {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") browserConsoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => browserConsoleErrors.push(String(err)));
  await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30000 });
  startButtonExists = await page.$("#start-button") !== null;
  await browser.close();
} catch (error) {
  networkFailures.push({ label: "browser bootstrap", error: String(error) });
}

const report = {
  ok: networkFailures.length === 0 && startButtonExists,
  command: "npm run dev",
  port: PORT,
  baseUrl: BASE_URL,
  checks,
  startButtonExists,
  networkFailures,
  browserConsoleErrors,
  note: "Run Cursor Browser against this base URL for live runtime evidence.",
};

shutdown();
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
