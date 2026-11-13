#!/usr/bin/env node
// End-to-end test of Crystal Reels in a real (headless) phone-sized browser: first launch, a spin, the
// controls in each state, slam stop, turbo, autoplay, every feature, resuming after the app was closed,
// the refill offer, the rules screen, Dutch, and a clean console. Screenshots go to test-results/.
//
//   node tests/slots/e2e.mjs
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../../scripts/serve.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "test-results");
await mkdir(OUT, { recursive: true });

const server = await startServer({ dir: ROOT, port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${server.address().port}/games/crystal-reels/index.html`;
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (cond, msg) => { if (cond) console.log("  ✓ " + msg); else { failures++; console.log("  ✗ " + msg); } };

async function newPage(lang = "en", storageState) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], storageState });
  await ctx.addInitScript((l) => { try { if (!localStorage.getItem("honest-arcade.lang")) localStorage.setItem("honest-arcade.lang", l); } catch (e) {} }, lang);
  const page = await ctx.newPage();
  page.problems = [];
  page.on("pageerror", (e) => page.problems.push("JS error: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || (m.type() === "warning" && m.text().startsWith("i18n:"))) page.problems.push(m.type() + ": " + m.text()); });
  await page.route("**/*", (route) => (new URL(route.request().url()).origin === new URL(base).origin || route.request().url().startsWith("data:") ? route.continue() : (page.problems.push("network: " + route.request().url()), route.abort())));
  return page;
}
const state = (page) => page.evaluate(() => document.querySelector(".machine") && document.querySelector(".machine").dataset.state);
const app = (page, fn, arg) => page.evaluate(fn, arg);

/** Dismiss whatever the game shows (announcements, choices, summaries, picks) until the machine is idle again. */
async function playOut(page, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (const sel of [".announce", ".choice-card", ".modal .btn.primary", ".celebrate"]) { const el = await page.$(sel); if (el) await el.click({ timeout: 500 }).catch(() => {}); }
    const tiles = await page.$$(".pick-tile:not(:disabled)");
    if (tiles.length) await tiles[0].click({ timeout: 500 }).catch(() => {});
    if ((await state(page)) === "idle" && !(await page.$(".modal, .announce, .celebrate"))) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function start(page, { machine = 0, level = null, balance = null } = {}) {
  await page.goto(base + "?debug=1");
  await page.waitForSelector(".modal .btn.primary");
  await page.click(".modal .btn.primary");
  if (level) await app(page, (xp) => { const a = window.slotsApp; a.profile.xp = xp; a.openLobby(); }, level);
  await page.waitForSelector(".tile");
  await page.click(`.tile >> nth=${machine}`);
  await page.waitForSelector(".machine .spin-btn");
  await page.waitForTimeout(600);
  await page.waitForFunction(() => window.slotsDebug);
  if (balance !== null) await app(page, (b) => { const a = window.slotsApp; a.profile.balance = b; a.screen.refresh(); a.screen.updateControls(); }, balance);
}

// ---- 1. first launch, lobby, a spin, the controls ------------------------------------------------------------------
console.log("First launch and a spin");
let page = await newPage();
await page.goto(base + "?debug=1");
await page.waitForSelector(".modal");
check((await page.textContent(".modal")).includes("Play money only"), "FAIR-07: the first screen says it is play money only");
await page.screenshot({ path: join(OUT, "slots-welcome.png") });
await page.click(".modal .btn.primary");
await page.waitForSelector(".tile");
check((await page.$$(".tile")).length === 2, "the lobby shows both machines");
check((await page.$$(".tile.locked")).length === 1, "the second machine is locked until a level");
check(await page.evaluate(() => document.querySelector(".bonus-card.ready") !== null), "the free coin bonus is ready to collect");
check((await page.$$(".mission")).length === 3, "three daily missions are shown");
await page.screenshot({ path: join(OUT, "slots-lobby.png") });
await page.click(".tile >> nth=0");
await page.waitForSelector(".machine .spin-btn");
await page.waitForTimeout(700);
check((await page.$$(".jp")).length === 4, "all four jackpots are shown above the reels");
check((await page.$$(".reel")).length === 5 && (await page.$$(".reel .cell")).length === 25, "a 5-reel grid is on screen");
const before = await app(page, () => window.slotsApp.profile.balance);
await page.evaluate(() => { const a = window.slotsApp; a.screen.turbo = false; });
await page.click(".spin-btn");
await page.waitForTimeout(150);
check((await state(page)) === "spinning", "REEL-01: the reels are moving right after the tap");
check(await page.evaluate(() => document.querySelector(".bet-box .round-btn").disabled && document.querySelector(".topbar .gnav-back").disabled), "REEL-01: bet controls and navigation are disabled while spinning");
check(await app(page, (b) => window.slotsApp.profile.balance === b - 40, before), "the bet is deducted at the tap");
await page.screenshot({ path: join(OUT, "slots-spinning.png") });
await page.click(".spin-btn"); // slam stop
const t0 = Date.now();
await page.waitForFunction(() => document.querySelector(".machine").dataset.state !== "spinning" && document.querySelector(".machine").dataset.state !== "stopping", null, { timeout: 5000 });
check(Date.now() - t0 < 1500, "REEL-04: tapping Spin again stops all reels at once");
await playOut(page);
check((await state(page)) === "idle", "the spin ends back in Idle");
await page.screenshot({ path: join(OUT, "slots-after-spin.png") });
const same = await app(page, () => { const a = window.slotsApp, o = a.screen.lastWin; return !o || o.features.length > 0 || JSON.stringify(o.stops) === JSON.stringify(a.screen.reels.pos.map((p) => Math.round(p))); });
check(same, "the reels show exactly the stops the engine decided");

// turbo: a spin takes at most 0.8 s to stop
await page.click(".pill-btn.toggle");
const tt = Date.now();
await page.click(".spin-btn");
await page.waitForFunction(() => !document.querySelector(".reels").classList.contains("is-spinning"), null, { timeout: 3000 });
check(Date.now() - tt <= 900, `REEL-04: a turbo spin stops within 0.8 s (${Date.now() - tt} ms incl. page overhead)`);
await playOut(page);

// autoplay never changes the bet and stops after the chosen number
const betBefore = await app(page, () => window.slotsApp.screen.bet);
await app(page, () => window.slotsDebug.setSpeed(8));
await page.click(".pill-btn:has-text('Auto')");
await page.click(".chip >> text=10");
await page.waitForFunction(() => !window.slotsApp.screen.auto.active && window.slotsApp.screen.sm.state === "idle", null, { timeout: 90000 });
check((await app(page, () => window.slotsApp.screen.bet)) === betBefore, "REEL-05: autoplay never changes the bet");
check((await app(page, () => window.slotsApp.profile.totals.spins)) >= 11, "REEL-05: autoplay ran its spins");
check(page.problems.length === 0, "no console errors or network requests" + (page.problems.length ? ": " + page.problems.join(" | ") : ""));
await page.context().close();

// ---- 2. rules, settings, profile ----------------------------------------------------------------------------------------
console.log("Rules, settings, profile");
page = await newPage();
await start(page);
// Rules, settings and profile sit in the menu drawer (top right), shared with every game (shared/js/gamenav.js).
const fromMenu = async (label) => { await page.click(".gnav-menu"); await page.click(`.gnav-item >> text=${label}`); };
await fromMenu("Rules");
await page.waitForSelector(".info");
await page.click(".tab >> text=Features");
let text = await page.textContent(".modal");
check(text.includes("97.50%"), "MATH-06: the rules show the RTP from the config");
check(/5[,.]000×/.test(text), "MATH-05: the rules state the max win cap");
await page.click(".tab >> text=Lines");
check((await page.$$(".mini-wrap")).length === 20, "PAY-01: every payline is drawn on a mini grid");
await page.click(".tab >> text=Paytable");
const payBefore = await page.textContent(".pay-grid");
await page.click(".info-bet .round-btn >> nth=1");
check((await page.textContent(".pay-grid")) !== payBefore, "MATH-06: paytable amounts update when the bet changes");
await page.screenshot({ path: join(OUT, "slots-rules.png") });
await page.click("[aria-label='Close']");
await fromMenu("Settings");
await page.waitForSelector(".settings");
check((await page.$$(".settings input[type=range]")).length === 2, "PERS-04: music and sound volume sliders exist");
await page.screenshot({ path: join(OUT, "slots-settings.png") });
await page.click("[aria-label='Close']");
await page.click(".gnav-back");
await page.waitForSelector(".tile");
await fromMenu("Profile");
await page.waitForSelector(".profile");
check((await page.$$(".ach")).length === 9, "PROG-05: achievements are listed");
await page.screenshot({ path: join(OUT, "slots-profile.png") });
check(page.problems.length === 0, "no console errors" + page.problems.join(" | "));
await page.context().close();

// ---- 3. the features -----------------------------------------------------------------------------------------------------
async function feature(machine, type, shot, extra) {
  console.log(`Feature: ${type} on machine ${machine + 1}`);
  const p = await newPage();
  await start(p, { machine, level: machine ? 5000 : null, balance: 5000000 });
  await app(p, () => { window.slotsApp.screen.turbo = true; window.slotsDebug.setSpeed(6); });
  const b0 = await app(p, () => window.slotsApp.profile.balance);
  await p.evaluate((t) => window.slotsDebug.forceFeature(t), type);
  await p.click(".spin-btn");
  let seen = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    if (await p.$(".hud:not([hidden]) .hud-item, .pick")) { if (!seen) { seen = true; await p.waitForTimeout(500); await p.screenshot({ path: join(OUT, `slots-${shot}.png`) }); if (extra) await extra(p); } }
    if (await playOut(p, 1500)) break;
  }
  check(seen, `the ${type} feature screen appeared`);
  check((await state(p)) === "idle", `${type} ends back in Idle`);
  const after = await app(p, () => ({ b: window.slotsApp.profile.balance, st: window.slotsApp.screen.session.state }));
  check(after.st.feature === null && after.st.queue.length === 0 && after.st.pending === null, `${type}: nothing is left pending`);
  check(p.problems.length === 0, "no console errors" + p.problems.join(" | "));
  await p.context().close();
  return after.b - b0;
}
await feature(0, "freeSpins", "freespins");
await feature(0, "holdSpin", "holdspin");
await feature(1, "freeSpins", "choice-fs");
await feature(1, "pick", "pick");

// ---- 4. resume after the app was closed (PERS-02) -------------------------------------------------------------------------------
console.log("Resume after an interruption");
page = await newPage();
await start(page);
await app(page, () => window.slotsDebug.forceStops([3, 7, 11, 2, 9]));
const b1 = await app(page, () => window.slotsApp.profile.balance);
await app(page, () => window.slotsApp.screen.turbo = false);
await page.click(".spin-btn");
await page.waitForTimeout(250);
const saved = await page.evaluate(() => {
  const read = (i) => { try { const w = JSON.parse(localStorage.getItem(`honest-arcade.slots.save.${i}`)); return { seq: w.seq, data: JSON.parse(w.data) }; } catch (e) { return null; } };
  const s = [read(0), read(1)].filter(Boolean).sort((a, b) => b.seq - a.seq)[0].data;
  return { pending: s.machines["crystal-fortune"].state.pending, balance: s.balance };
});
check(saved.pending && saved.pending.outcome.stops.join() === "3,7,11,2,9", "the outcome is saved the moment the reels start");
check(saved.balance === b1 - 40, "and so is the deducted bet");
const storage = await page.context().storageState();
await page.context().close(); // the app is killed mid-spin
page = await newPage("en", storage);
await page.goto(base + "?debug=1");
await page.waitForSelector(".machine .spin-btn");
await playOut(page, 20000);
const resumed = await app(page, () => ({ b: window.slotsApp.profile.balance, st: window.slotsApp.screen.session.state }));
check(resumed.st.pending === null, "the interrupted spin was resolved on relaunch");
check(resumed.b === b1 - 40 + saved.pending.outcome.totalWin, "with the same outcome (no re-roll): the balance matches the saved win");
check(page.problems.length === 0, "no console errors" + page.problems.join(" | "));
await page.context().close();

// ---- 5. low balance, refill ------------------------------------------------------------------------------------------------------
console.log("Refill");
page = await newPage();
await start(page, { balance: 5 });
await page.click(".spin-btn", { force: true }).catch(() => {});
check(await app(page, () => window.slotsApp.screen.sm.state) === "idle" && (await page.$eval(".spin-btn", (b) => b.disabled)), "REEL-01: Spin is disabled when the balance is below the bet");
await page.evaluate(() => window.slotsApp.screen.lowBalance());
await page.waitForSelector(".refill");
check(!(await page.textContent(".modal")).toLowerCase().match(/\bbuy\b|price|[$€£]/) && (await page.$$(".modal button")).length === 2, "ECO-04: the refill screen has no purchase offer (only Close and the free refill)");
await page.screenshot({ path: join(OUT, "slots-refill.png") });
await page.click(".modal .btn.primary");
check((await app(page, () => window.slotsApp.profile.balance)) >= 10000, "the free refill is paid out");
await page.context().close();

// ---- 6. a small phone: everything fits, dialogs scroll, unlimited autoplay, export ------------------------------------------------
console.log("Small phone (320 x 568)");
page = await newPage();
await start(page, { level: 12000, balance: 29980 }); // level 23
await page.setViewportSize({ width: 320, height: 568 });
await page.waitForTimeout(500);
await page.evaluate(() => { const d = document.getElementById("debug-btn"); if (d) d.remove(); }); // the development-only button sits on Max bet
const fit = await page.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const rects = [...document.querySelectorAll(".controls button, .topbar button, .balance")].map((b) => b.getBoundingClientRect());
  return { noScroll: document.documentElement.scrollWidth <= W, inside: rects.every((r) => r.left >= -0.5 && r.right <= W + 0.5), small: [...document.querySelectorAll(".controls button")].every((b) => b.getBoundingClientRect().height >= 43.5) };
});
check(fit.noScroll && fit.inside, "NFR-06: Turbo, Auto, Max bet, the spin button and the top bar all fit a 320 px screen");
check(fit.small, "NFR-07: every control is at least 44 px tall");
await page.screenshot({ path: join(OUT, "slots-machine-small.png") });
const dialog = (open) => app(page, (o) => {
  window.slotsApp[o.fn](...(o.screen ? [window.slotsApp.screen] : []));
  return new Promise((resolve) => setTimeout(() => {
    const card = document.querySelector(".modal-card:last-child") || document.querySelector(".modal-card"), body = card.querySelector(".modal-body"), r = card.getBoundingClientRect();
    const scrollable = body.scrollHeight > body.clientHeight + 1;
    body.scrollTop = 1e5;
    resolve({ fits: r.top >= 0 && r.bottom <= innerHeight + 0.5, scrollable, reachesEnd: !scrollable || body.scrollTop + body.clientHeight >= body.scrollHeight - 1 });
  }, 400));
}, open);
const closeAll = async () => { await page.evaluate(() => document.querySelectorAll(".modal .icon-btn").forEach((b) => b.click())); await page.waitForTimeout(350); };
for (const [name, o] of [["rules", { fn: "showInfo", screen: true }], ["settings", { fn: "showSettings" }], ["profile", { fn: "showProfile" }]]) {
  const d = await dialog(o);
  check(d.fits && d.reachesEnd, `the ${name} dialog fits the screen${d.scrollable ? " and scrolls to its end" : ""}`);
  await closeAll();
}
// Max bet stays within 2 % of the balance (ECO-08); a bet that is a big share of it is flagged (ECO-09)
await page.click(".pill-row .pill-btn >> nth=0");
check((await app(page, () => window.slotsApp.screen.bet)) === 400, "ECO-08: Max bet with 29,980 coins picks 400, not the highest unlocked bet");
await app(page, () => { const s = window.slotsApp.screen; window.slotsApp.profile.balance = 5000; s.session.setBet(1000); s.refresh(); });
check(await app(page, () => document.querySelector(".bet-label").classList.contains("risky")), "ECO-09: a bet of 20 % of the balance is flagged");
await app(page, () => { const s = window.slotsApp.screen; window.slotsApp.profile.balance = 200000; s.session.setBet(20); s.refresh(); s.updateControls(); });
// unlimited autoplay
await page.click(".pill-row .pill-btn >> nth=2");
check((await page.$$(".auto-modal .chip")).length === 5 && (await page.textContent(".auto-modal .chip-inf")) === "∞", "autoplay offers 10 / 25 / 50 / 100 and ∞");
const chipsFit = await page.evaluate(() => { const c = document.querySelector(".auto-modal"), r = c.getBoundingClientRect(); return [...c.querySelectorAll(".chip")].every((b) => b.getBoundingClientRect().right <= r.right + 0.5); });
check(chipsFit, "all autoplay choices fit on one row");
await page.click(".chip-inf");
await app(page, () => { window.slotsDebug.setSpeed(8); window.slotsApp.screen.turbo = true; });
await page.waitForFunction(() => window.slotsApp.profile.totals.spins >= 12 || !window.slotsApp.screen.auto.active, null, { timeout: 90000 });
const inf = await app(page, () => ({ active: window.slotsApp.screen.auto.active, label: document.querySelector(".auto-label").textContent, spins: window.slotsApp.profile.totals.spins }));
check(inf.active ? inf.label.includes("∞") : inf.spins >= 1, "unlimited autoplay keeps going and shows ∞ (it only stops by itself for a feature)");
await app(page, () => window.slotsApp.screen.stopAuto(true));
await playOut(page);
// export
await app(page, () => window.slotsApp.showSettings());
await page.click(".settings .field .pill-btn");
await page.waitForSelector(".export-box");
const exp = await app(page, () => { try { const j = JSON.parse(document.querySelector(".export-box").value); return { level: j.summary.level, has: !!j.profile && !!j.exportedAt && "returnPercent" in j.summary }; } catch (e) { return null; } });
check(exp && exp.level >= 1 && exp.has, "the exported profile is valid JSON with a summary");
await page.screenshot({ path: join(OUT, "slots-export.png") });
check(!!(await page.$(".export-actions .btn.primary")), "there is a Copy button");
check(page.problems.length === 0, "no console errors" + page.problems.join(" | "));
await page.context().close();

// ---- 7. Dutch ------------------------------------------------------------------------------------------------------------------------
console.log("Dutch");
page = await newPage("nl");
await start(page);
check((await page.textContent(".bet-box")).includes("Inzet"), "NFR-10: the machine screen is in Dutch");
await page.screenshot({ path: join(OUT, "slots-machine-nl.png") });
check(page.problems.length === 0, "no missing translations" + page.problems.join(" | "));
await page.context().close();

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll Crystal Reels end-to-end checks passed.");
process.exit(failures ? 1 : 0);
