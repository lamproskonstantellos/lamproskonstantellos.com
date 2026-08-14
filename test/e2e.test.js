"use strict";

// End-to-end smoke: drive the REAL site in a real Chromium — the one layer
// the node tests cannot see. Catches runtime-only regressions: hydration
// mismatches (React logs them as console errors), broken client-side
// navigation, head-sync drift, and the no-JS (SSR) reading experience.
//
// Browser resolution: PW_EXECUTABLE, then the local Playwright container
// install, then the system Chrome the GitHub runner ships. With no browser
// available every test SKIPS (a contributor's machine without Chrome must
// not fail `npm test`); CI always has one, so the suite is enforced there.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { start, stop } = require("./helper");

function findBrowser() {
  if (process.env.PW_EXECUTABLE && fs.existsSync(process.env.PW_EXECUTABLE)) {
    return process.env.PW_EXECUTABLE;
  }
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const entry of fs.readdirSync(pwRoot)) {
      if (entry.startsWith("chromium_headless_shell-")) {
        const p = `${pwRoot}/${entry}/chrome-linux/headless_shell`;
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {
    /* no local Playwright install */
  }
  for (const p of [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const EXECUTABLE = findBrowser();
const skip = EXECUTABLE ? false : "no Chromium/Chrome available (set PW_EXECUTABLE)";

let browser = null;
let base;

before(async () => {
  ({ base } = await start());
  if (EXECUTABLE) {
    const { chromium } = require("playwright-core");
    browser = await chromium.launch({ executablePath: EXECUTABLE });
  }
});
after(async () => {
  if (browser) await browser.close();
  await stop();
});

// Collect console errors/warnings and page crashes — a hydration mismatch
// surfaces here and nowhere else. The 404 page's own document status is the
// one expected "Failed to load resource" entry.
function watch(page) {
  const problems = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (/the server responded with a status of 404/.test(m.text())) return;
    problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e}`));
  return problems;
}

test("home hydrates cleanly and navigates to an article and back", { skip }, async () => {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const problems = watch(page);

  await page.goto(base + "/", { waitUntil: "networkidle" });
  assert.match(await page.textContent("h1"), /Electrical & Computer Engineer/);

  // Client-side navigation: card click → article, with the head kept in sync.
  await page.click(".news-card");
  await page.waitForSelector(".article-body");
  const articleCanonical = await page.getAttribute('link[rel="canonical"]', "href");
  assert.match(articleCanonical, /\/news\/[a-z0-9-]+$/, "canonical must follow SPA navigation");
  const ogTitle = await page.getAttribute('meta[property="og:title"]', "content");
  assert.equal(ogTitle, (await page.textContent("h1")).trim(), "og:title must follow SPA navigation");

  // Browser Back: home restored, canonical restored.
  await page.goBack();
  await page.waitForSelector(".hero");
  assert.match(
    await page.getAttribute('link[rel="canonical"]', "href"),
    /\/$/,
    "canonical must be restored on Back"
  );

  assert.deepEqual(problems, [], "no console errors (a hydration mismatch would log here)");
  await page.context().close();
});

test("unknown route renders the friendly 404 with noindex", { skip }, async () => {
  const page = await (await browser.newContext()).newPage();
  const problems = watch(page);
  const res = await page.goto(base + "/this-route-does-not-exist", { waitUntil: "networkidle" });
  assert.equal(res.status(), 404);
  assert.equal(await page.textContent("h1"), "Page not found");
  assert.equal(await page.getAttribute('meta[name="robots"]', "content"), "noindex,follow");
  assert.deepEqual(problems, [], "no console errors on the 404 page");
  await page.context().close();
});

test("the site is fully readable with JavaScript disabled (SSR)", { skip }, async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();

  await page.goto(base + "/news", { waitUntil: "load" });
  assert.equal((await page.textContent("h1")).trim(), "News");
  assert.ok((await page.$$(".news-card")).length >= 1, "news cards must render without JS");

  // Links are real hrefs — a JS-off visitor can navigate.
  await page.click(".news-card");
  await page.waitForSelector(".article-body");
  assert.ok((await page.textContent(".article-body")).length > 200, "article body readable without JS");

  await ctx.close();
});
