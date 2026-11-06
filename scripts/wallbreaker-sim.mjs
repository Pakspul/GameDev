#!/usr/bin/env node
// Wallbreaker pacing check: an autopilot plays Classic from level 1 (headless, the real engine)
// and prints how long each level took, its stars and what it paid, with a running total against
// the shop's prices. Use it when tuning src/config.js, next to a real playtest on a phone.
//
//   npm run wallbreaker:sim               levels 1–30
//   npm run wallbreaker:sim -- 60 run     levels 1–60 of a random Run world
import { makeEngine, autoplay } from "../tests/wallbreaker/autopilot.mjs";
import { generate, CLASSIC_SEED } from "../games/wallbreaker/src/levels.js";
import { MODES, buildMods } from "../games/wallbreaker/src/modes.js";
import { levelPay, cosmetics } from "../games/wallbreaker/src/economy.js";
import { CONFIG } from "../games/wallbreaker/src/config.js";
import { freshSeed, seedToCode } from "../games/wallbreaker/src/rng.js";

const N = Number(process.argv[2]) || 30;
const world = process.argv[3] === "run" ? freshSeed() : CLASSIC_SEED;
console.log(world === CLASSIC_SEED ? "Classic world" : `Run world ${seedToCode(world)}`);
const boosts = Object.entries(CONFIG.boosts.items).map(([id, b]) => [id, b.price]).sort((a, b) => a[1] - b[1]);
const cos = cosmetics().filter((c) => c.price).sort((a, b) => a.price - b.price);
let total = 0, time = 0;
const firsts = new Map();
console.log("level  kind   time  par  lost  stars  bricks  pay  total");
for (let n = 1; n <= N; n++) {
  const e = makeEngine({ level: generate(world, n), rules: MODES.classic, mods: buildMods("classic").mods, lives: 99 });
  autoplay(e, { limit: 900 });
  const stars = e.stars();
  const pay = levelPay({ mode: "classic", level: n, brickCredits: e.brickCredits, stars });
  total += pay.total;
  time += e.playTime;
  for (const [what, price] of [["first boost", boosts[0][1]], ["first cosmetic", cos[0].price], ["dearest cosmetic", cos.at(-1).price]]) {
    if (!firsts.has(what) && total >= price) firsts.set(what, `level ${n} (${Math.round(time / 60)} min of play)`);
  }
  console.log([n, e.level.kind, Math.round(e.playTime) + "s", Math.round(e.par), e.ballsLost, stars, e.brickCredits.toFixed(1), pay.total, total].map((v) => String(v).padStart(5)).join("  ") + (e.result && e.result.cleared ? "" : "  NOT CLEARED"));
}
console.log(`\nAverage ${(time / N / 60).toFixed(1)} min per level, ${(total / N).toFixed(0)} credits per level.`);
for (const [k, v] of firsts) console.log(`Affordable: ${k} at ${v}`);
