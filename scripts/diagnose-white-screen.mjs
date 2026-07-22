#!/usr/bin/env node
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.argv[2] ?? "http://localhost:4180/";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];
const networkFailures = [];

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(err.stack ?? String(err)));
page.on("requestfailed", (req) => {
  networkFailures.push({
    url: req.url(),
    failure: req.failure()?.errorText ?? "unknown",
  });
});
page.on("response", (res) => {
  if (res.status() >= 400) {
    networkFailures.push({
      url: res.url(),
      status: res.status(),
      contentType: res.headers()["content-type"] ?? "",
    });
  }
});

await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

const observation = await page.evaluate(() => ({
  readyState: document.readyState,
  href: document.location.href,
  appExists: Boolean(document.querySelector("#app")),
  startButtonExists: Boolean(document.querySelector("#start-button")),
  brainWindowCount: document.querySelectorAll(".brain-window").length,
  sceneTitle: document.querySelector("#scene-title")?.textContent ?? null,
  bodyTextLength: document.body.innerText.length,
  bodyHtml: document.body.innerHTML.slice(0, 500),
  bg: getComputedStyle(document.body).backgroundColor,
}));

const out = { url: URL, observation, consoleErrors, pageErrors, networkFailures };
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(
  observation.startButtonExists && observation.brainWindowCount === 4 ? 0 : 1,
);
