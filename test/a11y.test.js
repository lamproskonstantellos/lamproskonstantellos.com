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
  // The badge colors are theme tokens now; check the light pair here (the
  // dark pair is covered by the dark-palette test below).
  const r = ratio(cssVar("--award-ink"), cssVar("--award-bg"));
  assert.ok(r >= 4.5, `award text is ${r.toFixed(2)}:1 (needs 4.5:1)`);
});

// ---- Dark theme: the token overrides must hold the same AA ratios ----------

function darkVar(name) {
  // The dark palette lives in the prefers-color-scheme block at the end of
  // the stylesheet; scope the lookup there so the light :root values (which
  // appear first) don't shadow it.
  const block = CSS.match(/@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*$/)[0];
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `dark theme does not redefine ${name}`);
  return m[1];
}

test("dark palette meets WCAG AA on its backgrounds", () => {
  const DARK_BG = darkVar("--bg");
  const DARK_SURFACE = darkVar("--surface");
  const pairs = [
    [darkVar("--ink"), DARK_BG],
    [darkVar("--ink-soft"), DARK_BG],
    [darkVar("--muted"), DARK_BG],
    [darkVar("--muted"), DARK_SURFACE],
    [darkVar("--muted-2"), DARK_BG],
    [darkVar("--muted-2"), DARK_SURFACE],
    [darkVar("--accent"), DARK_BG],
    [darkVar("--accent"), DARK_SURFACE],
    [darkVar("--award-ink"), darkVar("--award-bg")],
    [darkVar("--solid-ink"), darkVar("--solid-bg")],
  ];
  for (const [fg, bg] of pairs) {
    const r = ratio(fg, bg);
    assert.ok(r >= 4.5, `dark ${fg} on ${bg} is ${r.toFixed(2)}:1 (needs 4.5:1)`);
  }
  // The /publications year label renders at 42px/700 — large-scale text (3:1).
  const year = ratio(darkVar("--year-ink"), DARK_BG);
  assert.ok(year >= 3, `dark year label is ${year.toFixed(2)}:1 (needs 3:1)`);
});

test("structural a11y guarantees", () => {
  assert.match(HTML, /<html lang="en">/, "lang attribute");
  assert.match(HTML, /class="skip-link" href="#main-content"/, "skip link");
  assert.match(CSS, /:focus-visible\s*\{/, "focus-visible styling");
  assert.match(CSS, /prefers-reduced-motion/, "reduced-motion support");
  assert.match(CSS, /#main-content:focus\s*\{\s*outline:\s*none/, "route-change focus target");
});

test("no content is gated behind entrance-reveal machinery", () => {
  // The entrance-reveal system was removed outright: nothing may reintroduce
  // opacity/observer gating that could hide content (reveal classes in
  // components, or data-reveal hooks) without also restoring its safeguards.
  const componentDir = path.join(__dirname, "../components");
  for (const f of fs.readdirSync(componentDir)) {
    const src = fs.readFileSync(path.join(componentDir, f), "utf8");
    assert.ok(!src.includes("data-reveal"), `${f} reintroduces data-reveal gating`);
    assert.ok(!/className=\{?[^}\n]*\breveal\b/.test(src), `${f} reintroduces a reveal class`);
  }
});
