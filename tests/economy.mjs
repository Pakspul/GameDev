#!/usr/bin/env node
// Checks every game's currency against the shared rules in docs/ECONOMY.md, without a browser:
//   1. the rules themselves (shared/js/economy.js) do the sums the doc describes;
//   2. each games/<name>/economy.js follows them: rewards grow with the tier in sensible steps,
//      every item is a known kind of help, and every price really is "N levels of this tier";
//   3. each such game loads the shared rules before its own numbers, and both before game.js.
//
//   node tests/economy.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = readFileSync(join(ROOT, "shared/js/economy.js"), "utf8");
let failures = 0;
const fail = (msg) => { failures++; console.log("✗ " + msg); };
const eq = (got, want, what) => { if (got !== want) fail(`${what}: got ${got}, want ${want}`); };

// Load shared/js/economy.js plus any extra files into a fresh global scope, like a page does.
function load(...files) {
  const ctx = vm.createContext({});
  vm.runInContext(SHARED, ctx, { filename: "shared/js/economy.js" });
  for (const f of files) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  return ctx;
}

// 1. The rules.
{
  const { Economy } = load();
  const E = Economy.register("test", { rewards: { easy: 24, medium: 45, hard: 75 }, anchor: "medium", items: { hint: "peek", bolt: "boost", hammer: "heavy", skip: "skip" } });
  eq(E.price("hint", "hard"), 40, "peek = half a level (37.5, tidied)");
  eq(E.price("hint", "hard", 3), 40, "a peek does not get dearer when repeated");
  eq(E.price("hint", "easy"), 12, "small prices are whole numbers, not multiples of 5");
  eq(E.price("bolt", "hard"), 150, "boost = two levels");
  eq(E.price("bolt", "hard", 1), 300, "the second boost in a level costs double");
  eq(E.price("hammer", "medium"), 135, "heavy = three levels");
  eq(E.price("skip", "hard", 2), 375, "skip = five levels, never escalates");
  eq(E.levelPay("hard", 3, 0), 75, "a first 3-star clear pays the full reward");
  eq(E.levelPay("hard", 2, 0), 50, "2 stars pays two thirds");
  eq(E.levelPay("hard", 3, 2), 25, "improving 2 → 3 stars pays the difference");
  eq(E.levelPay("hard", 2, 3), 0, "a worse replay pays nothing");
  eq(E.levelPay("hard", 3, 3), 0, "an equal replay pays nothing");
  eq(E.dailyPay("hard", 3, 0, 1), 150, "a daily pays twice a level");
  eq(E.dailyPay("hard", 3, 0, 4), 150 + 3 * 15, "+10% per streak day after the first");
  eq(E.dailyPay("hard", 3, 0, 30), 150 + 5 * 15, "streak bonus stops at +50%");
  eq(E.dailyPay("hard", 3, 2, 30), 50, "improving a daily pays the new stars, no second streak bonus");
  eq(E.start, 90, "a new player starts with one boost at the anchor tier");
  eq(Economy.helped(3, true), 2, "help costs a star");
  eq(Economy.helped(1, true), 1, "but never below 1");
  eq(Economy.helped(3, false), 3, "no help, no loss");
}

// 2 + 3. Every game with an economy.js.
const games = readdirSync(join(ROOT, "games"), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(ROOT, "games", d.name, "economy.js"))).map((d) => d.name);
if (!games.length) fail("no games/*/economy.js found");
for (const g of games) {
  const before = failures;
  const extra = g === "outbound" ? ["games/outbound/levels.js"] : [];
  const ctx = load(...extra, `games/${g}/economy.js`);
  const E = ctx.Economy.games[g];
  if (!E) { fail(`${g}: economy.js does not call Economy.register("${g}", ...)`); continue; }

  const tiers = Object.keys(E.rewards);
  const inTracks = E.tracks.flat();
  for (const t of tiers) if (inTracks.filter((x) => x === t).length !== 1) fail(`${g}: tier ${t} must be in exactly one track`);
  for (const t of inTracks) if (!(t in E.rewards)) fail(`${g}: track lists unknown tier ${t}`);
  // Harder tiers pay more, in steps that roughly follow how much longer a level takes.
  for (const track of E.tracks) for (let i = 1; i < track.length; i++) {
    const r = E.rewards[track[i]] / E.rewards[track[i - 1]];
    if (!(r >= 1.25 && r <= 2.1)) fail(`${g}: ${track[i - 1]} → ${track[i]} pays ×${r.toFixed(2)}; keep each step between ×1.25 and ×2.1`);
  }
  if (!(E.anchor in E.rewards)) fail(`${g}: anchor tier ${E.anchor} has no reward`);
  // Every price is its multiple of the tier's reward, give or take rounding.
  for (const item in E.items) {
    const kind = E.items[item];
    if (!(kind in ctx.Economy.KIND)) { fail(`${g}: item ${item} has unknown kind "${kind}"`); continue; }
    for (const t of tiers) {
      const want = ctx.Economy.KIND[kind] * E.rewards[t], got = E.price(item, t);
      if (want >= 5 && Math.abs(got / want - 1) > 0.15) fail(`${g}: ${item} on ${t} costs ${got}, should be about ${want}`);
    }
  }
  if (g === "outbound") {
    const all = Object.assign({}, ctx.OutboundGen.TIERS, ctx.OutboundGen3D.TIERS, ctx.OutboundShapes.TIERS);
    for (const t in all) if (!(t in E.rewards)) fail(`outbound: tier ${t} has no reward`);
    for (const t of tiers) if (!(t in all)) fail(`outbound: reward for tier ${t}, which doesn't exist`);
  }
  // The page must load the rules, then the game's numbers, then the game.
  const html = readFileSync(join(ROOT, "games", g, "index.html"), "utf8");
  const at = (src) => html.indexOf(`<script src="${src}"></script>`);
  const a = at("../../shared/js/economy.js"), b = at("economy.js"), c = at("game.js");
  if (a < 0 || b < 0 || !(a < b && b < c)) fail(`${g}: index.html must load ../../shared/js/economy.js, then economy.js, then game.js`);
  if (failures === before) console.log(`✓ ${g}: ${tiers.length} tiers, ${Object.keys(E.items).length} kinds of help, starts with ${E.start}`);
}

console.log(failures ? `\n${failures} economy check(s) failed.` : "\nEconomy OK.");
process.exit(failures ? 1 : 0);
