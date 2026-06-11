"use strict";

// Accessibility: lock the WCAG 2.1 SC 1.4.3 contrast fixes by computing the
// ratio from the actual stylesheet, plus a few structural a11y guarantees.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const CSS = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const HTML = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

function luminance(hex) {
  const c = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const [r, g, b] = ch.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const L1 = luminance(a), L2 = luminance(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
function cssVar(name) {
  return CSS.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))[1];
}

const BG = cssVar("--bg");
const SURFACE = cssVar("--surface");

test("body text colors meet WCAG AA (4.5:1) on their backgrounds", () => {
  const pairs = [
    ["--ink", BG],
    ["--ink-soft", BG],
    ["--muted", BG],
    ["--muted", SURFACE],
    ["--muted-2", BG],
    ["--muted-2", SURFACE],
    ["--accent", SURFACE],
    ["--accent", BG],
  ];
  for (const [varName, bg] of pairs) {
    const r = ratio(cssVar(varName), bg);
    assert.ok(r >= 4.5, `${varName} on ${bg} is ${r.toFixed(2)}:1 (needs 4.5:1)`);
  }
});

test("award badge text meets WCAG AA on its badge background", () => {
  const color = CSS.match(/\.pub-award\s*\{[^}]*?color:\s*(#[0-9a-fA-F]{6})/s)[1];
  const r = ratio(color, "#fdf8ee");
  assert.ok(r >= 4.5, `award text is ${r.toFixed(2)}:1 (needs 4.5:1)`);
});

test("structural a11y guarantees", () => {
  assert.match(HTML, /<html lang="en">/, "lang attribute");
  assert.match(HTML, /class="skip-link" href="#main-content"/, "skip link");
  assert.match(CSS, /:focus-visible\s*\{/, "focus-visible styling");
  assert.match(CSS, /prefers-reduced-motion/, "reduced-motion support");
  assert.match(CSS, /#main-content:focus\s*\{\s*outline:\s*none/, "route-change focus target");
});
