#!/usr/bin/env node
import puppeteer from "puppeteer-core";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.argv[2] ?? "http://localhost:4180/";
const OUT = process.argv[3] ?? "artifacts/four-brain-round2/white-screen-root-cause/01-rendered-page.png";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForSelector("#start-button");
await page.screenshot({ path: join(process.cwd(), OUT), fullPage: true });
await browser.close();
