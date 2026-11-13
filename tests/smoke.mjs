#!/usr/bin/env node
// Smoke test: opens the hub and every game in a real (headless) Chromium at a phone-sized
// viewport, taps the screen, and fails if anything goes wrong:
//   - a JavaScript error or console.error
//   - a missing file (404)
//   - ANY request to the internet (the app must work in airplane mode)
//   - a game that doesn't render a canvas
//   - a missing translation (every page runs once per language; see shared/js/i18n.js)
//   - a game without the shared back button and menu (shared/js/gamenav.js), or without its keep-screen-on switch
// Screenshots land in test-results/ so you can eyeball every game in a few seconds.
//
//   npm test            tests dist/ (run `npm run build` first; `npm test` does it for you)
//   npm test -- --src   tests the source folders directly
import { createRequire } from "node:module";
import { mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../scripts/serve.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.argv.includes("--src") ? ROOT : join(ROOT, "dist");
const OUT = join(ROOT, "test-results");
if (!existsSync(join(DIR, "index.html"))) {
  console.error(`No build found in ${DIR}. Run: npm run build`);
  process.exit(1);
}

const server = await startServer({ dir: DIR, port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${server.address().port}/`;
await mkdir(OUT, { recursive: true });

// SwiftShader = software WebGL, so this also works on CI machines without a GPU.
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const LANGS = ["en", "nl"];
const contexts = {};
for (const lang of LANGS) {
  contexts[lang] = await browser.newContext({ ...devices["Pixel 7"] });
  // The language the player picked on the hub, as i18n.js stores it.
  await contexts[lang].addInitScript((l) => { try { localStorage.setItem("honest-arcade.lang", l); } catch (e) {} }, lang);
}

const slugs = (await readdir(join(DIR, "games"), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
const pages = [{ name: "hub", path: "index.html" }, ...slugs.map((s) => ({ name: s, path: `games/${s}/index.html` }))];
let failures = 0;

for (const lang of LANGS) for (const { name, path } of pages) {
  const problems = [];
  const page = await contexts[lang].newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "blob:" || url.protocol === "data:" || url.origin === new URL(base).origin) return route.continue();
    problems.push(`network request to the internet: ${url.href}`);
    return route.abort();
  });
  page.on("pageerror", (e) => problems.push(`JS error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
    if (m.type() === "warning" && m.text().startsWith("i18n:")) problems.push(m.text());
  });
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForTimeout(2500); // let the level generate and the first frames render
  const i18n = await page.evaluate(() => (window.I18n ? { lang: I18n.lang, missing: I18n.missing() } : null));
  if (!i18n) problems.push("shared/js/i18n.js is not loaded");
  else {
    if (i18n.lang !== lang) problems.push(`page is in "${i18n.lang}", expected "${lang}"`);
    for (const m of i18n.missing) problems.push(`no translation for ${m}`);
  }

  if (name === "hub") {
    // Every card must point at a real game page.
    const hrefs = await page.$$eval("a.card", (as) => as.map((a) => a.getAttribute("href")));
    if (hrefs.length !== slugs.length) problems.push(`hub lists ${hrefs.length} games, games/ has ${slugs.length}`);
    for (const h of hrefs) {
      const r = await page.request.get(base + h);
      if (!r.ok()) problems.push(`hub link broken: ${h} (${r.status()})`);
    }
    // The menu opens with the version in it, and each of its links opens its own box.
    await page.click("#menu-btn");
    if (!(await page.$eval("#menu", (d) => d.open && /\d/.test(document.getElementById("version").textContent))))
      problems.push("menu doesn't open, or shows no version");
    await page.keyboard.press("Escape");
    for (const id of await page.$$eval("#menu [data-opens]", (bs) => bs.map((b) => b.dataset.opens))) {
      await page.click("#menu-btn");
      await page.waitForTimeout(300);
      await page.click(`#menu [data-opens="${id}"]`);
      if (!(await page.$eval(`#${id}`, (d) => d.open))) problems.push(`menu link "${id}" doesn't open its box`);
      await page.keyboard.press("Escape");
    }
  } else {
    const canvas = await page.$$eval("canvas", (cs) => cs.some((c) => c.width > 0 && c.height > 0));
    if (!canvas) problems.push("no visible canvas rendered");
    // Every game has the shared way out (shared/js/gamenav.js): back top left, the menu drawer top right.
    const nav = await page.evaluate(() => {
      const shown = (s) => { const e = document.querySelector(s); const r = e && e.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0; };
      const out = { back: shown(".gnav-back"), menu: shown(".gnav-menu") };
      if (out.menu) {
        document.querySelector(".gnav-menu").click();
        out.opens = document.querySelector(".gnav-drawer").open;
        document.querySelector(".gnav-drawer").close();
      }
      return out;
    });
    if (!nav.back) problems.push("no back button (top left, shared/js/gamenav.js)");
    if (!nav.menu) problems.push("no menu button (top right, shared/js/gamenav.js)");
    else if (!nav.opens) problems.push("the menu button doesn't open the menu drawer");
    if (nav.menu && nav.awake === false) problems.push("no keep-screen-on switch in the menu drawer (shared/js/gamenav.js)");
    if (nav.awake && !nav.awakeOn) problems.push("keep screen on isn't on by default");
    if (nav.awake && !nav.awakeOff) problems.push("the keep-screen-on switch doesn't switch off and remember it");
    // A tap in the middle of the screen: whatever it hits, it must not throw.
    await page.touchscreen.tap(206, 460);
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: join(OUT, `${name}-${lang}.png`) });
  await page.close();
  if (problems.length) {
    failures++;
    console.log(`✗ ${name} (${lang})`);
    for (const p of [...new Set(problems)]) console.log(`    ${p}`);
  } else console.log(`✓ ${name} (${lang})`);
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} page(s) failed.` : `\nAll ${pages.length} pages OK in ${LANGS.join(" and ")} — screenshots in test-results/`);
process.exit(failures ? 1 : 0);
