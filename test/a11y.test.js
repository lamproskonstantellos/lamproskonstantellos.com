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

// Footer text sits on the solid navy --ink background and is written as
// translucent white (rgba). Composite each rgba over the navy, then check the
// ratio — the plain hex path above cannot see these. .footer-col-title was
// 4.30:1 at alpha 0.45 (SC 1.4.3 fail) before it was lifted.
function composite(rgba, bgHex) {
  const [r, g, b, a] = rgba;
  const bg = bgHex.replace("#", "");
  const [br, bg_, bb] = [0, 2, 4].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const mix = (fg, back) => Math.round(fg * a + back * (1 - a));
  const hex = (n) => n.toString(16).padStart(2, "0");
  return "#" + hex(mix(r, br)) + hex(mix(g, bg_)) + hex(mix(b, bb));
}
function ruleColorRgba(selector) {
  const block = CSS.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`, "s"))[0];
  const m = block.match(/color:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

test("footer text (rgba on navy) meets WCAG AA", () => {
  const INK = cssVar("--ink"); // the .site-footer background
  // The only footer heading text; regressing its alpha must fail the suite.
  const pairs = [
    [".footer-col-title", 4.5],
    [".footer-role", 4.5],
    [".footer-tagline", 4.5],
  ];
  for (const [sel, min] of pairs) {
    const r = ratio(composite(ruleColorRgba(sel), INK), INK);
    assert.ok(r >= min, `${sel} is ${r.toFixed(2)}:1 on ${INK} (needs ${min}:1)`);
  }
});

test("award badge text meets WCAG AA on its badge background", () => {
  const block = CSS.match(/\.pub-award\s*\{[^}]*\}/s)[0];
  const color = block.match(/color:\s*(#[0-9a-fA-F]{6})/)[1];
  // The badge now carries a soft warm-cream fill; check the text against it.
  const bg = block.match(/background:\s*(#[0-9a-fA-F]{6})/)[1];
  const r = ratio(color, bg);
  assert.ok(r >= 4.5, `award text is ${r.toFixed(2)}:1 on ${bg} (needs 4.5:1)`);
});

test("structural a11y guarantees", () => {
  assert.match(HTML, /<html lang="en">/, "lang attribute");
  assert.match(HTML, /class="skip-link" href="#main-content"/, "skip link");
  assert.match(CSS, /:focus-visible\s*\{/, "focus-visible styling");
  assert.match(CSS, /prefers-reduced-motion/, "reduced-motion support");
  assert.match(CSS, /#main-content:focus\s*\{\s*outline:\s*none/, "route-change focus target");
});
