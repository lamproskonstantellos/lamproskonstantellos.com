"use strict";

// End-to-end smoke: drive the REAL site in a real Chromium — the one layer
// the node tests cannot see. Catches runtime-only regressions: hydration
// mismatches (React logs them as console errors), broken client-side
// navigation, head-sync drift, and the no-JS (SSR) reading experience.
//
// Browser resolution: PW_EXECUTABLE, then the local Playwright container
// install, then the system Chrome the GitHub runner ships. With no browser
// available every test SKIPS locally (a contributor's machine without Chrome
// must not fail `npm test`) but FAILS in CI (process.env.CI) — a silent CI
// skip would drop this whole layer without anyone noticing.

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

// On a contributor's machine a missing browser downgrades the suite to a
// skip. In CI it must be a hard FAILURE: the runner is expected to always
// have a browser, so a skip there would mean the resolution above silently
// rotted (a renamed runner image path) and the e2e layer stopped running —
// exactly the kind of quiet coverage loss this throw makes loud.
if (process.env.CI && !EXECUTABLE) {
  throw new Error(
    "CI has no Chromium/Chrome for the e2e suite — fix the browser resolution " +
      "in findBrowser() or set PW_EXECUTABLE; do NOT let e2e silently skip in CI."
  );
}

const skip = EXECUTABLE ? false : "no Chromium/Chrome available (set PW_EXECUTABLE)";

let browser = null;
let base;

before(async () => {
  ({ base } = await start());
  if (EXECUTABLE) {
    const { chromium } = require("playwright-core");
    try {
      browser = await chromium.launch({ executablePath: EXECUTABLE });
    } catch (e) {
      // A present-but-broken local browser (missing shared libs, sandbox
      // refusal) downgrades to per-test skips — same posture as "no browser".
      // CI keeps the hard failure: there the launch is expected to work.
      if (process.env.CI) throw e;
      console.warn(`e2e: browser launch failed, skipping suite — ${e.message}`);
      browser = null;
    }
  }
});
after(async () => {
  try {
    if (browser) await browser.close();
  } finally {
    // The server must stop even if the browser refuses to close — a leaked
    // listener keeps the node:test process alive past the timeout.
    await stop();
  }
});

// Runtime counterpart of `skip` for the launch-failure case: `skip` is
// evaluated when the file loads, before before() has tried to launch.
function launchFailed(t) {
  if (!EXECUTABLE || browser) return false;
  t.skip("browser failed to launch");
  return true;
}

// Collect console errors/warnings and page crashes — a hydration mismatch
// surfaces here and nowhere else. `allow404` is opt-in for the unknown-route
// test only, whose own DOCUMENT is the one expected "Failed to load
// resource" entry; on every other page a 404 console error means a missing
// bundle/font/variant, exactly what this gate exists to catch (a global
// filter silently waived all of those).
function watch(page, { allow404 = false } = {}) {
  const problems = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (allow404 && /the server responded with a status of 404/.test(m.text())) return;
    problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e}`));
  return problems;
}

test("home hydrates cleanly and navigates to an article and back", { skip }, async (t) => {
  if (launchFailed(t)) return;
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const problems = watch(page);

  await page.goto(base + "/", { waitUntil: "networkidle" });
  assert.match(await page.textContent("h1"), /Electrical & Computer Engineer/);

  // Client-side navigation: card click → article, with the head kept in sync.
  // The head is rewritten by a React effect that runs after the DOM commit,
  // so the .article-body selector alone can win the race against it — poll
  // the head state instead of asserting a single snapshot.
  await page.click(".news-card");
  await page.waitForSelector(".article-body");
  await page.waitForFunction(() =>
    /\/news\/[a-z0-9-]+$/.test(
      document.querySelector('link[rel="canonical"]')?.href || ""
    )
  );
  await page.waitForFunction(() => {
    const og = document.querySelector('meta[property="og:title"]')?.content;
    const h1 = document.querySelector("h1")?.textContent?.trim();
    return Boolean(og) && og === h1;
  });

  // Browser Back: home restored, canonical restored (same effect-race note).
  await page.goBack();
  await page.waitForSelector(".hero");
  await page.waitForFunction(() =>
    /\/$/.test(document.querySelector('link[rel="canonical"]')?.href || "")
  );

  assert.deepEqual(problems, [], "no console errors (a hydration mismatch would log here)");
  await page.context().close();
});

test("unknown route renders the friendly 404 with noindex", { skip }, async (t) => {
  if (launchFailed(t)) return;
  const page = await (await browser.newContext()).newPage();
  const problems = watch(page, { allow404: true });
  const res = await page.goto(base + "/this-route-does-not-exist", { waitUntil: "networkidle" });
  assert.equal(res.status(), 404);
  assert.equal(await page.textContent("h1"), "Page not found");
  assert.equal(await page.getAttribute('meta[name="robots"]', "content"), "noindex,follow");
  assert.deepEqual(problems, [], "no console errors on the 404 page");
  await page.context().close();
});

test("the site is fully readable with JavaScript disabled (SSR)", { skip }, async (t) => {
  if (launchFailed(t)) return;
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
