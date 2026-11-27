// Every board in Bubbleworks: Levels (numbered, the same for everyone), the daily level (one per date),
// Classic's stages and Endless' first rows. Seeded, so level N is always the same board.
//
// A level is kept only when the autoplayer (src/bot.js) finishes it; its shot budget is what the
// autoplayer needed, with room to spare. A board it can't finish is made again with a new salt.
//
// FROZEN once released: changing anything here (or in rng.js) changes the levels, and players' stars
// would point at other boards. tests/bubbleworks/rules.test.mjs fingerprints the first levels.
import { CONFIG, stepTable } from "./config.js";
import { Grid, floating, group, NORMAL, STONE, ICE } from "./grid.js";
import { Game } from "./engine.js";
import { rng, hash32 } from "./rng.js";
import { autoplay } from "./bot.js";
import { SOLVED } from "./levels.gen.js";

const LEVEL_SEED = 0xb0bb1e;
export const CLASSIC_SEED = 0xc1a551c;

/** Which tier of the arcade's economy (../economy.js) a level belongs to. */
export function tierOf(n) { return n <= 15 ? "easy" : n <= 40 ? "medium" : n <= 80 ? "hard" : "expert"; }

/** When each thing first shows up in Levels. */
export const INTRO = { rescue: 6, collect: 11, stone: 8, ice: 14, bomb: 3, prism: 5, laser: 9, comet: 12, blackhole: 18 };

/** A board: `rows` rows filled in a shape, colours in clusters (so groups form), sometimes mirrored. */
function layout(rand, rows, colours, { cluster = 0.45, shape = "full", holes = 0, mirror = false, cap = 6 } = {}) {
  const g = new Grid(0);
  for (let r = 0; r < rows; r++) {
    const w = g.width(r);
    for (let c = 0; c < w; c++) {
      if (!inShape(shape, r, c, rows, w)) continue;
      if (holes && r > 1 && rand.chance(holes)) continue;
      g.set(r, c, { c: 0, k: NORMAL });
    }
  }
  for (let r = 0; r < rows; r++) {
    const w = g.width(r), half = mirror ? Math.ceil(w / 2) : w;
    for (let c = 0; c < half; c++) {
      const b = g.get(r, c);
      if (!b) continue;
      const near = g.neighbours(r, c).filter(([a, k]) => (a < r || (a === r && k < c)) && g.get(a, k)).map(([a, k]) => g.get(a, k));
      b.c = near.length && rand.chance(cluster) ? near[rand.int(near.length)].c : rand.int(colours);
    }
    if (mirror) for (let c = half; c < w; c++) { const b = g.get(r, c), m = g.get(r, w - 1 - c); if (b && m) b.c = m.c; }
  }
  breakGroups(g, rand, colours, cap, mirror);
  for (const [r, c] of floating(g)) g.set(r, c, null);
  g.trim();
  return g;
}

/** No same-colour group bigger than `cap`: one big group would clear half the board in one shot.
 *  A cell of a group that's too big gets another colour (and its mirror twin too). */
function breakGroups(g, rand, colours, cap, mirror) {
  for (let pass = 0; pass < 60; pass++) {
    let changed = false;
    const seen = new Set();
    for (const [r, c] of g.all()) {
      if (seen.has(r * 16 + c)) continue;
      const grp = group(g, r, c);
      for (const [a, k] of grp) seen.add(a * 16 + k);
      if (grp.length <= cap) continue;
      const [a, k] = grp[rand.int(grp.length)], col = (g.get(a, k).c + 1 + rand.int(colours - 1)) % colours;
      g.get(a, k).c = col;
      const twin = mirror && g.get(a, g.width(a) - 1 - k);
      if (twin) twin.c = col;
      changed = true;
    }
    if (!changed) return;
  }
}

// Shapes only open up in the bottom rows, so on a tall level (which scrolls) there is never a gap that
// leads up into rows that are out of view.
function inShape(shape, r, c, rows, w) {
  const mid = (w - 1) / 2, depth = rows - r; // depth: 1 for the bottom row
  switch (shape) {
    case "vee": return depth > 8 || Math.abs(c - mid) <= mid - Math.floor((9 - depth) / 2); // narrows towards the bottom
    case "pillars": return depth > 6 || Math.floor((c + (r & 1)) / 2) % 2 === 0;
    case "arch": return depth > 6 || Math.abs(c - mid) >= Math.min(mid - 1, 7 - depth); // a hole in the middle
    case "wave": return depth > 3 || (Math.floor(c / 3) + r) % 2 === 0;
    default: return true;
  }
}
const SHAPES = ["full", "vee", "pillars", "arch", "wave"];

/** Mark bubbles in place: `n` cells from `pick` (a list of [r, c]) get `fn(bubble)`. */
function sprinkle(rand, cells, n, fn) {
  const pool = cells.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const [r, c, b] = pool.splice(rand.int(pool.length), 1)[0];
    fn(b, r, c);
  }
}

/** The recipe for level n (or the daily, which uses a level's recipe with its own seed). */
function recipe(n, rand) {
  const colours = n <= 4 ? 3 : n <= 15 ? 4 : n <= 40 ? 5 : 6;
  const rows = Math.min(24, 5 + Math.floor(n / 3) + rand.int(3));
  let goal = "top";
  if (n === INTRO.rescue) goal = "rescue";
  else if (n === INTRO.collect) goal = "collect";
  else if (n > INTRO.rescue) {
    const pool = ["top", "rescue"];
    if (n > INTRO.collect) pool.push("collect");
    goal = pool[rand.int(pool.length)];
  }
  const unlocked = ["bomb", "prism", "laser", "comet", "blackhole"].filter((p) => n >= INTRO[p]);
  return {
    colours, rows, goal,
    shape: n < 4 ? "full" : SHAPES[rand.int(SHAPES.length)],
    mirror: rand.chance(0.5),
    cluster: n <= 10 ? 0.55 : 0.45,
    holes: n > 20 && rand.chance(0.3) ? 0.08 : 0,
    stones: n === INTRO.stone ? 3 : n > INTRO.stone && rand.chance(0.5) ? 2 + rand.int(Math.min(6, 1 + Math.floor(n / 15))) : 0,
    ice: n === INTRO.ice ? 4 : n > INTRO.ice && rand.chance(0.4) ? 3 + rand.int(Math.min(8, 2 + Math.floor(n / 12))) : 0,
    // The first level with a new power always has that one; after that, any power that's unlocked.
    powers: unlocked.length ? Math.min(3, 1 + Math.floor(n / 20)) : 0,
    newPower: unlocked.find((p) => INTRO[p] === n) || null,
    unlocked,
  };
}

function build(seed, spec) {
  const rand = rng(seed);
  const g = layout(rand, spec.rows, spec.colours, spec);
  const cells = () => g.all().filter(([, , b]) => b.k === NORMAL && !b.p && !b.crit);
  sprinkle(rand, cells().filter(([r]) => r > 0), spec.stones, (b) => { b.k = STONE; b.c = -1; });
  sprinkle(rand, cells().filter(([r]) => r > 0), spec.ice, (b) => { b.k = ICE; });
  const goal = { type: spec.goal };
  if (spec.goal === "rescue") {
    // The creatures sit in the top third, so you have to dig up to them.
    const top = Math.max(1, Math.ceil((g.lowest() + 1) / 3));
    sprinkle(rand, cells().filter(([r]) => r < top), Math.min(5, 2 + Math.floor(spec.rows / 6)), (b) => { b.crit = true; });
  }
  let powers = spec.powers;
  if (spec.newPower) { sprinkle(rand, cells().filter(([r]) => r >= Math.max(0, g.lowest() - 4)), 1, (b) => { b.p = spec.newPower; }); powers--; }
  if (powers > 0) sprinkle(rand, cells(), powers, (b) => { b.p = spec.unlocked[rand.int(spec.unlocked.length)]; });
  if (spec.goal === "collect") {
    const counts = g.colours();
    let colour = 0, most = -1;
    for (const [c, k] of counts) if (k > most) { most = k; colour = c; }
    goal.colour = colour;
    goal.n = Math.max(6, Math.round(most * 0.7));
  }
  return { grid: g, goal };
}

const cache = new Map();

/** Level n: { n, tier, grid (a fresh copy every call), colours, goal, shots, botShots, seed }.
 *  The first levels' autoplayer results are stored in levels.gen.js (npm run bubbleworks:levels), so
 *  starting a level is instant and every device gets exactly the same budget. */
export function makeLevel(n) {
  if (!cache.has(n)) cache.set(n, makeFrom(hash32(LEVEL_SEED, n), n, SOLVED[n - 1]));
  return fresh(cache.get(n), { n, tier: tierOf(n) });
}

/** Level n worked out from scratch (the autoplayer runs), ignoring levels.gen.js. For the tools and tests. */
export function solveLevel(n) { return makeFrom(hash32(LEVEL_SEED, n), n); }

/** The daily level for a date ("2026-11-27"): a level from the middle of the game, built from the date. */
export function makeDaily(date) {
  const k = "daily:" + date;
  if (!cache.has(k)) {
    const seed = hash32("bubbleworks-daily", date);
    cache.set(k, makeFrom(seed, 25 + (seed % 30)));
  }
  return fresh(cache.get(k), { n: 0, daily: date, tier: "hard" });
}

/** Build a level; `known` = [salt, botShots] skips the autoplayer. */
function makeFrom(seed, n, known) {
  for (let salt = known ? known[0] : 0; ; salt++) {
    const s = hash32(seed, salt);
    const spec = recipe(n, rng(hash32(s, 1)));
    const { grid, goal } = build(s, spec);
    let botShots;
    if (known) botShots = known[1];
    else {
      const bot = autoplay(new Game({ mode: "levels", grid: grid.clone(), colours: spec.colours, seed: hash32(s, 2), goal }), CONFIG.levels.maxBotShots);
      // Not finished, or finished too fast to be a real level: make it again (up to 20 times).
      if ((bot.status !== "won" || bot.shots < minShots(n)) && salt < 20) continue;
      botShots = bot.shots;
    }
    const shots = Math.ceil(botShots * stepTable(CONFIG.levels.slack, n)) + CONFIG.levels.extra;
    return { seed: s, salt, grid, goal, colours: spec.colours, shots, botShots, newPower: spec.newPower };
  }
}

/** Fewer shots than this for the autoplayer, and a level is too easy to keep. */
function minShots(n) { return n < 4 ? 1 : Math.min(14, 4 + Math.floor(n / 6)); }

function fresh(l, extra) { return { ...l, ...extra, grid: l.grid.clone(), goal: { ...l.goal } }; }

/** A new game of level n (or of the daily, given a daily level). */
export function levelGame(level) {
  return new Game({ mode: "levels", grid: level.grid.clone(), colours: level.colours, seed: hash32(level.seed, 2), goal: level.goal, shots: level.shots });
}

/** Classic stage s: the same boards in every run (the deal differs). */
export function classicStage(s) {
  const rand = rng(hash32(CLASSIC_SEED, s));
  const colours = Math.min(6, 3 + Math.floor((s - 1) / 2));
  const rows = Math.min(9, 4 + Math.ceil(s / 2));
  const g = layout(rand, rows, colours, { cluster: 0.5, shape: s < 3 ? "full" : SHAPES[rand.int(SHAPES.length)], mirror: rand.chance(0.6) });
  const cells = () => g.all().filter(([r, , b]) => r > 0 && b.k === NORMAL && !b.p);
  if (s >= 6) sprinkle(rand, cells(), Math.min(5, Math.floor(s / 3)), (b) => { b.k = STONE; b.c = -1; });
  if (s >= 2) sprinkle(rand, cells(), 1 + (s >= 8 ? 1 : 0), (b) => { b.p = rand.weighted(CONFIG.powers.weights); });
  return { grid: g, colours };
}

export function classicGame(seed) {
  const first = classicStage(1);
  return new Game({ mode: "classic", grid: first.grid, colours: first.colours, seed, stage: 1, nextStage: classicStage });
}

export function endlessGame(seed) {
  const rand = rng(hash32(seed, 7));
  const colours = stepTable(CONFIG.endless.colours, 0);
  const g = layout(rand, CONFIG.endless.startRows, colours, { cluster: 0.5 });
  return new Game({ mode: "endless", grid: g, colours, seed });
}

/** A short text fingerprint of a level, for the tests. */
export function fingerprint(level) {
  const cells = level.grid.all().map(([r, c, b]) => `${r}.${c}.${b.k}${b.c}${b.p ? b.p[0] : ""}${b.crit ? "*" : ""}`).join(" ");
  return hash32(cells, JSON.stringify(level.goal), level.shots).toString(36);
}
