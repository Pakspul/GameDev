// Levels, built from a seed: the same mode, difficulty and level number give the same level on every
// device.
//
// How a level is made, so that it can always be solved:
//   1. Take a picture (pictures.js): small drawn ones on Easy, bigger ones on Medium and Hard, then
//      endless seeded ones.
//   2. Play it forwards with the real rules, making up each mover as it's needed, so that the list of
//      sends is a solution:
//      - Critters: pick a colour that shows, send a critter of it round; its capacity is what it took.
//        Sometimes it parks and comes back later for more (that's what makes bays matter).
//      - Depot: when the loop stops, pick a colour riding it and send a bus of that colour; its seats are
//        what gets on. Sometimes it gets more seats, so it waits at its dock for pixels still in the
//        picture (that's what makes docks matter).
//   3. Put the movers in the yard so the solution can be played: in Critters each lane keeps the
//      order; in Depot the car park is filled from the last bus to leave to the first, each with a clear
//      way out past the ones already there (but often in their way: that's the jam).
//   4. Replay the solution with the real rules. Only a level that passes is used.
//   5. Critters and Orbit: link a few pairs of critters as buddies, which leave the lanes together
//      (buddyUp(); the level stays the same otherwise).
import { Rng, hashSeed } from "./rng.js";
import { Game, makeTrack, lap, carCells, carPath } from "./engine.js";
import { Depot, trayCount } from "./depot.js";
import { DRAWN, LARGE, artOf, fromArt, madePicture } from "./pictures.js";
import { Orbit, lap3 } from "./orbit.js";
import { SCULPTS, sculptById, sculptFor, madeSculpture } from "./sculptures.js";
import { CONFIG } from "./config.js";
import { playThrough } from "./judge.js";

export const MODES = ["depot", "critters", "orbit"];
export const DIFFS = ["easy", "medium", "hard"];

// The drawn pictures, in the order each track meets them.
const ORDER = {
  depot: {
    easy: ["heart", "fish", "mushroom", "tree", "apple", "house", "cactus", "duck", "flower", "boat", "cat", "icecream", "butterfly", "bus", "rocket"],
    medium: ["cactus2", "house2", "fox", "frog", "strawberry", "snail", "cupcake", "whale", "penguin", "rocket2", "owl", "robot", "balloon", "ladybug"],
    hard: ["frog", "rocket2", "ladybug", "owl", "whale", "balloon", "penguin", "robot", "cupcake", "fox", "strawberry", "snail"],
  },
  critters: {
    easy: ["heart", "apple", "fish", "tree", "flower", "cat", "mushroom", "icecream", "house", "butterfly", "cactus", "duck", "rocket", "boat", "bus"],
    medium: ["house2", "cactus2", "strawberry", "fox", "whale", "frog", "rocket2", "snail", "cupcake", "penguin", "robot", "owl", "ladybug", "balloon"],
    hard: ["rocket2", "fox", "ladybug", "whale", "robot", "owl", "frog", "balloon", "snail", "penguin", "strawberry", "cupcake"],
  },
};
// Orbit's sculptures, in the order each track meets them (thin, tall ones only on Easy: they stay small).
// The second batch of models (burger to bee) comes after the first on every track, so levels before it
// stay the same levels.
const SCULPT_ORDER = {
  easy: ["jawbreaker", "apple", "mushroom", "cube", "snowman", "pumpkin", "donut", "watermelon", "cake", "rocket", "planet", "duck",
    "icecream", "tree", "lighthouse", "fish", "penguin", "house", "owl", "robot", "geode", "saturn",
    "strawberry", "burger", "ladybug", "gift", "frog", "cupcake", "balloon", "turtle", "bee", "castle"],
  medium: ["planet", "cake", "pumpkin", "owl", "house", "geode", "duck", "penguin", "saturn", "robot", "donut", "apple", "mushroom",
    "watermelon", "cube", "tree", "jawbreaker",
    "burger", "turtle", "castle", "cupcake", "bee", "ladybug", "balloon", "frog", "gift", "strawberry"],
  hard: ["geode", "house", "owl", "cube", "duck", "pumpkin", "watermelon", "mushroom", "apple", "cake", "penguin", "donut", "planet",
    "robot", "jawbreaker",
    "castle", "bee", "turtle", "burger", "frog", "balloon", "ladybug", "cupcake", "gift", "strawberry"],
};
const BY_ID = Object.fromEntries([...DRAWN.map((d) => [d.id, d.art]), ...LARGE.map((d) => [d.id, artOf(d)])]);

// How hard level n of a track is. Besides the obvious numbers (bays, docks, sizes):
//   bias: how the made solution picks its next colour, by how much of it shows (weight = shows^bias).
//         1.5 follows the obvious move; Hard leans the other way, so the obvious send is often wrong.
//   pick: Hard only, how many solvable candidates to make; the one the stand-in players (judge.js)
//         do worst on is used.
export function params(mode, diff, n) {
  const D = Math.max(0, DIFFS.indexOf(diff));
  const tight = D === 2 && n % 4 === 0; // every 4th Hard level has one bay or dock fewer
  const sizes = [[10, 12], [13, 15], [15, 18]][D];
  const base = { D, size: Math.min(sizes[1], sizes[0] + Math.floor((n - 1) / 8)) };
  if (mode === "orbit") {
    return {
      D,
      // About this many blocks, growing a little every few levels.
      target: [10000, 12000, 14000][D] + Math.min(8, Math.floor((n - 1) / 4)) * [150, 200, 250][D],
      bays: [5, 3, 3][D] - (tight ? 1 : 0),
      open: [1, 2, 2][D],
      keep: [0.15, 0.45, 0.55][D],
      bias: [1.5, 1.5, -0.5][D],
      minCap: [180, 220, 260][D],
      maxCap: [420, 500, 580][D],
      lanes: n <= 2 && D === 0 ? 3 : [4, 5, 5][D],
      hidden: D === 2 || (D === 1 && n >= 10),
      buddies: [n < 3 ? 0 : 2, 3, 4][D],
    };
  }
  if (mode === "depot") {
    return {
      ...base,
      docks: [4, 3, 3][D] - (tight ? 1 : 0),
      density: [0.5, 0.36, 0.26][D], // trays per cell of loop length
      maxCap: [12, 18, 24][D],
      minCap: [3, 5, 6][D],
      keep: [0.15, 0.4, 0.55][D],
      open: [1, 2, tight ? 1 : 2][D], // buses the made solution may keep waiting at a dock at once
      jam: [0.6, 1.2, 1.8][D], // how much the car park is packed in each other's way
      bias: [1.5, 1.5, 0.5][D],
      pick: [1, 1, 6][D],
    };
  }
  return {
    ...base,
    bays: [5, 3, 2][D],
    open: [1, 2, 2][D],
    keep: [0.15, 0.5, 0.85][D],
    maxCap: [12, 18, 30][D],
    bias: [1.5, 1.5, -0.5][D],
    pick: [1, 1, 8][D],
    lanes: n <= 2 && D === 0 ? 2 : [3, 4, 4][D],
    hidden: D === 2 || (D === 1 && n >= 12), // only the front critter of a lane shows its colour
    buddies: [n < 4 ? 0 : n < 10 ? 1 : 2, 2, 3][D], // pairs of critters that leave together
  };
}

function sculptureFor(diff, n, rng, P) {
  const order = SCULPT_ORDER[diff];
  if (n <= order.length) return sculptFor(sculptById(order[n - 1]), P.target);
  return madeSculpture(rng, n - order.length - 1 + P.D, P.target);
}

function pictureFor(mode, diff, n, rng, P) {
  const order = ORDER[mode][diff];
  if (n <= order.length) { const id = order[n - 1]; return fromArt(id, BY_ID[id]); }
  const k = n - order.length - 1;
  return madePicture(rng, k + (mode === "critters" ? 1 : 0) + P.D, P.size);
}

// ---- Critters ----------------------------------------------------------------------------------------------
/** The critters and a solution (a list of sends; a critter may appear more than once). */
function constructCritters(pic, P, rng) {
  const track = makeTrack(pic.w, pic.h);
  const cells = pic.cells.slice();
  const colors = [...new Set(cells)].filter(Boolean).sort((a, b) => a - b);
  const count = (c) => cells.reduce((a, v) => a + (v === c ? 1 : 0), 0);
  let remaining = cells.reduce((a, v) => a + (v ? 1 : 0), 0);
  const movers = [], solution = [];
  while (remaining > 0) {
    const opts = [];
    for (const c of colors) {
      const t = lap(cells.slice(), track, c, Infinity);
      if (t) opts.push({ c, t, w: Math.pow(t, P.bias) });
    }
    let r = rng.float() * opts.reduce((a, o) => a + o.w, 0), pick = opts[0];
    for (const o of opts) { if ((r -= o.w) <= 0) { pick = o; break; } }
    let m = movers.findIndex((mv) => mv.open && mv.color === pick.c);
    if (m < 0) { m = movers.length; movers.push({ color: pick.c, total: 0, open: false }); }
    const mv = movers[m];
    const room = P.maxCap - mv.total;
    const got = lap(cells, track, mv.color, Math.min(pick.t, room));
    mv.total += got;
    remaining -= got;
    solution.push(m);
    const others = movers.filter((x) => x.open && x !== mv).length;
    // Small critters are the likeliest to come back for more later.
    const keep = P.keep + (P.keep && mv.total < P.maxCap / 3 ? 0.3 : 0);
    mv.open = got === pick.t && mv.total < P.maxCap - 2 && count(mv.color) > 0 && others < P.open && rng.chance(keep);
  }
  return { movers: movers.map((mv) => ({ color: mv.color, cap: mv.total })), solution };
}

// ---- Orbit ------------------------------------------------------------------------------------------------
/** Like Critters, in 3D: the critters and a solution. Each critter gets a size it aims for (minCap to
 *  maxCap), so a lap that could take hundreds of blocks of one colour stops somewhere along the way. */
function constructOrbit(sc, P, rng) {
  const track = makeTrack(sc.w, sc.d), plane = sc.w * sc.d;
  const cells = sc.cells.slice();
  const colors = [...new Set(cells)].filter(Boolean).sort((a, b) => a - b);
  const left = new Map(colors.map((c) => [c, 0]));
  for (const v of cells) if (v) left.set(v, left.get(v) + 1);
  let remaining = cells.reduce((a, v) => a + (v ? 1 : 0), 0);
  const movers = [], solution = [];
  for (let guard = 0; remaining > 0 && guard < 2000; guard++) {
    const opts = [];
    for (const c of colors) {
      if (!left.get(c)) continue;
      const t = lap3(cells.slice(), track, sc.h, plane, c, Infinity);
      if (t) opts.push({ c, t, w: Math.pow(Math.min(t, P.maxCap), P.bias) });
    }
    let r = rng.float() * opts.reduce((a, o) => a + o.w, 0), pick = opts[0];
    for (const o of opts) { if ((r -= o.w) <= 0) { pick = o; break; } }
    let m = movers.findIndex((mv) => mv.open && mv.color === pick.c);
    if (m < 0) {
      m = movers.length;
      // The last critter of a colour takes what is left of it, if that fits.
      const aim = P.minCap + rng.int(P.maxCap - P.minCap + 1);
      movers.push({ color: pick.c, total: 0, open: false, aim: left.get(pick.c) <= P.maxCap ? left.get(pick.c) : aim });
    }
    const mv = movers[m];
    const got = lap3(cells, track, sc.h, plane, mv.color, Math.min(pick.t, mv.aim - mv.total));
    mv.total += got;
    left.set(mv.color, left.get(mv.color) - got);
    remaining -= got;
    solution.push(m);
    const others = movers.filter((x) => x.open && x !== mv).length;
    const keep = P.keep + (P.keep && mv.total < P.maxCap / 3 ? 0.3 : 0);
    mv.open = mv.total < mv.aim && left.get(mv.color) > 0 && (got === pick.t ? others < P.open && rng.chance(keep) : false);
    if (mv.total < mv.aim && !mv.open) mv.aim = mv.total; // it goes home with what it has
  }
  return { movers: movers.map((mv) => ({ color: mv.color, cap: mv.total })), solution };
}

/** An Orbit level round sculpture `sc`: its critters, lanes and made solution. */
function orbitLevel(sc, P, rng, info) {
  const { movers, solution } = constructOrbit(sc, P, rng);
  const order = [];
  for (const m of solution) if (!order.includes(m)) order.push(m);
  return {
    ...info, picture: sc.id, w: sc.w, h: sc.h, d: sc.d, cells: sc.cells, movers, solution,
    bays: P.bays, belt: CONFIG.belt, spacing: CONFIG.spacing, hidden: P.hidden, lanes: laneUp(order, P.lanes, rng),
  };
}

// ---- The model gallery ---------------------------------------------------------------------------------------
/** Every drawn Orbit model, in the order the gallery shows them. */
export const MODELS = SCULPTS.map((s) => s.id);

/** Just the sculpture of model `id`, as big as it is on a track of `diff`'s first level, for looking at:
 *  { mode: "orbit", view: true, w, h, d, cells } with no critters. */
export function modelView(id, diff = "easy") {
  const P = params("orbit", diff, 1), sc = sculptFor(sculptById(id), P.target);
  return { mode: "orbit", diff, n: 0, view: true, picture: sc.id, w: sc.w, h: sc.h, d: sc.d, cells: sc.cells, movers: [], lanes: [], bays: 0, belt: CONFIG.belt, spacing: CONFIG.spacing };
}

const tests = new Map();
/** A test level round model `id`, made like level 1 of Orbit `diff` (bays, critter sizes, hidden colours
 *  from that track). Always solvable, like every level; not part of any track. */
export function makeTestLevel(id, diff = "easy") {
  const key = `orbit:test:${id}:${diff}`;
  if (tests.has(key)) return tests.get(key);
  const P = params("orbit", diff, 1), sc = sculptFor(sculptById(id), P.target);
  for (let attempt = 0; attempt < 20; attempt++) {
    let level = orbitLevel(sc, P, new Rng(hashSeed(`${key}:${attempt}`)), { mode: "orbit", diff, n: 0, test: true });
    if (!replay(level)) continue;
    level = buddyUp(level, P.buddies, key);
    tests.set(key, level);
    return level;
  }
  throw new Error(`could not make a test level for ${id}`);
}

// ---- Buddies (Critters and Orbit) -------------------------------------------------------------------------
/** Where the made solution sends two critters one right after the other, both from the front of their
 *  lanes, in lanes side by side: the index of the first of the two. `pairs` are buddies already linked
 *  (the solution sends each pair as one, by its lead). */
function pairSpots(lanes0, solution, pairs) {
  const lanes = lanes0.map((l) => l.slice()), linked = new Map(), out = [];
  for (const [a, b] of pairs) { linked.set(a, b); linked.set(b, a); }
  const front = (m) => lanes.findIndex((l) => l[0] === m);
  for (let i = 0; i < solution.length; i++) {
    const m = solution[i], k = front(m);
    if (k < 0) continue; // from a bay
    const n = solution[i + 1], k2 = n == null ? -1 : front(n);
    if (k2 >= 0 && Math.abs(k - k2) === 1 && !linked.has(m) && !linked.has(n)) out.push(i);
    for (const x of [m, linked.get(m)]) { const j = x == null ? -1 : front(x); if (j >= 0) lanes[j].shift(); }
  }
  return out;
}

/** Step 5: link up to `want` pairs of critters as buddies. Two critters the made solution sends one after
 *  the other from the fronts of neighbouring lanes become a pair, sent as one, if the made solution still
 *  wins that way. Pairs can never wait on each other: the lanes keep the order the solution sends them
 *  in. Picture, critters and lanes stay as they were; the choice has its own random stream. */
function buddyUp(level, want, key) {
  if (!want) return level;
  const rng = new Rng(hashSeed(`${key}:buddies`)), tried = new Set();
  let pairs = [], solution = level.solution;
  for (let guard = 0; pairs.length < want && guard < want * 8; guard++) {
    const spots = pairSpots(level.lanes, solution, pairs).filter((i) => !tried.has(solution[i] + "," + solution[i + 1]));
    if (!spots.length) break;
    const i = spots[rng.int(spots.length)], pair = [solution[i], solution[i + 1]];
    tried.add(pair.join());
    const next = { ...level, pairs: [...pairs, pair], solution: [...solution.slice(0, i + 1), ...solution.slice(i + 2)] };
    if (replay(next)) { pairs = next.pairs; solution = next.solution; }
  }
  return pairs.length ? { ...level, pairs, solution } : level;
}

/** Lanes for critters in the order they first go: each lane keeps that order. */
function laneUp(order, nLanes, rng) {
  const lanes = Array.from({ length: Math.min(nLanes, order.length) }, () => []);
  for (const m of order) {
    const min = Math.min(...lanes.map((l) => l.length));
    const ok = lanes.map((l, i) => i).filter((i) => lanes[i].length <= min + 1);
    lanes[ok[rng.int(ok.length)]].push(m);
  }
  return lanes;
}

// ---- Depot -------------------------------------------------------------------------------------------------
/** The buses and a solution (each bus is sent once), played forwards on a Depot without a car park. */
function constructDepot(pic, P, rng) {
  const level = {
    mode: "depot", w: pic.w, h: pic.h, cells: pic.cells, movers: [],
    ring: trayCount(pic.w, pic.h, P.density), docks: P.docks, transit: CONFIG.depot.transit, lot: null,
  };
  const g = new Depot(level, { history: false });
  const unassigned = new Map();
  for (const c of pic.cells) if (c) unassigned.set(c, (unassigned.get(c) || 0) + 1);
  const solution = [];
  g.settle();
  for (let guard = 0; g.status === "play" && guard < 400; guard++) {
    // Colours riding the loop with no bus for them (the loop has stopped, so none has one).
    const opts = [];
    for (let c = 1; c < g.onRing.length; c++) if (g.onRing[c] > 0) opts.push({ c, w: Math.pow(g.onRing[c], P.bias) });
    if (!opts.length) return null;
    let r = rng.float() * opts.reduce((a, o) => a + o.w, 0), pick = opts[0];
    for (const o of opts) { if ((r -= o.w) <= 0) { pick = o; break; } }
    const c = pick.c, have = unassigned.get(c);
    // How many would get on a bus with endless seats?
    const probe = g.clone();
    const pm = probe.addMover(c, have);
    probe.launch(pm); probe.settle();
    level.movers.pop();
    const took = have - probe.left[pm];
    const waiting = g.docks.filter((m) => m >= 0).length;
    let cap = Math.min(took, P.maxCap);
    if (have > took && waiting < P.open && (took < P.minCap || rng.chance(P.keep))) {
      cap = Math.min(have, P.maxCap, Math.max(took + 1 + rng.int(Math.max(1, Math.round(took * 0.6))), P.minCap));
    }
    const m = g.addMover(c, cap);
    unassigned.set(c, have - cap);
    if (g.launch(m) !== "ok") return null;
    g.settle();
    solution.push(m);
  }
  if (g.status !== "won") return null;
  return { movers: level.movers, solution, ring: level.ring };
}

/** Depot's car park for the buses in the order they leave. Returns { w, h, cars } or null if it doesn't fit. */
function park(order, movers, P, rng, grow) {
  const big = Math.max(8, Math.round(P.maxCap * 0.6));
  const lens = order.map((m) => (movers[m].cap >= big ? 2 : 1));
  const need = lens.reduce((a, b) => a + b, 0);
  const lw = order.length > 14 ? 7 : order.length > 9 ? 6 : 5;
  const lh = Math.max(3, Math.min(8, Math.ceil((need * 1.4) / lw) + grow));
  const occ = new Int16Array(lw * lh).fill(-1);
  const cars = [];
  const inside = ([x, y]) => x >= 0 && y >= 0 && x < lw && y < lh;
  for (let k = order.length - 1; k >= 0; k--) {
    const m = order[k];
    let placed = null;
    for (const len of lens[k] === 2 ? [2, 1] : [1]) {
      const cands = [];
      for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) for (const dir of ["up", "down", "left", "right"]) {
        const car = { m, x, y, len, dir };
        const body = carCells(car);
        if (!body.every((p) => inside(p) && occ[p[1] * lw + p[0]] === -1)) continue;
        if (!carPath(car, lw, lh).every(([px, py]) => occ[py * lw + px] === -1)) continue;
        // Jam: how many parked buses (which leave later) this one stands in the way of.
        const keys = new Set(body.map(([bx, by]) => by * lw + bx));
        let blocks = 0;
        for (const c of cars) if (carPath(c, lw, lh).some(([px, py]) => keys.has(py * lw + px))) blocks++;
        cands.push({ car, score: blocks * 3 * P.jam + rng.float() * 2.5 + (dir === "down" || dir === "up" ? 0.4 : 0) });
      }
      if (cands.length) {
        cands.sort((a, b) => b.score - a.score);
        placed = cands[rng.int(Math.min(3, cands.length))].car;
        break;
      }
    }
    if (!placed) return null;
    for (const [x, y] of carCells(placed)) occ[y * lw + x] = cars.length;
    cars.push(placed);
  }
  return { w: lw, h: lh, cars: cars.reverse() };
}

// ---- Both --------------------------------------------------------------------------------------------------
/** A fresh game of a level, in its mode's rules. */
export function newGame(level, opts) {
  return level.mode === "depot" ? new Depot(level, opts) : level.mode === "orbit" ? new Orbit(level, opts) : new Game(level, opts);
}

/** Step 4: play a solution with the real rules. */
export function replay(level, solution = level.solution) {
  const g = newGame(level, { history: false });
  for (const m of solution) {
    if (g.launch(m) !== "ok") return false;
    g.settle();
    if (g.status === "lost") return false;
  }
  return g.status === "won";
}

/** How many of a few stand-in plays (one greedy, the rest greedy with slips) win the level. */
function judge(level, key, plays = 3) {
  let wins = 0;
  for (let i = 0; i < plays; i++) wins += playThrough(newGame(level, { history: false }), new Rng(hashSeed(`${key}:judge:${i}`)), i === 0 ? 0 : 0.25) ? 1 : 0;
  return wins;
}

const cache = new Map();
/** Level n (1, 2, 3...) of a mode and difficulty. */
export function makeLevel(mode, diff, n) {
  const key = `${mode}:${diff}:${n}`;
  if (cache.has(key)) return cache.get(key);
  const P = params(mode, diff, n);
  // Hard: a few good candidates, and the one the stand-in players (judge.js) do worst on.
  const want = P.pick || 1;
  let best = null, bestScore = Infinity, found = 0;
  for (let attempt = 0; attempt < 40 && found < want; attempt++) {
    const rng = new Rng(hashSeed(`${key}:${attempt}`));
    const pic = mode === "orbit" ? null : pictureFor(mode, diff, n, rng, P);
    let level;
    if (mode === "orbit") {
      level = orbitLevel(sculptureFor(diff, n, rng, P), P, rng, { mode, diff, n });
    } else if (mode === "critters") {
      const { movers, solution } = constructCritters(pic, P, rng);
      const order = [];
      for (const m of solution) if (!order.includes(m)) order.push(m);
      level = {
        mode, diff, n, picture: pic.id, w: pic.w, h: pic.h, cells: pic.cells, movers, solution,
        bays: P.bays, belt: CONFIG.belt, spacing: CONFIG.spacing, hidden: P.hidden,
      };
      const lanes = Array.from({ length: Math.min(P.lanes, order.length) }, () => []);
      for (const m of order) {
        const min = Math.min(...lanes.map((l) => l.length));
        const ok = lanes.map((l, i) => i).filter((i) => lanes[i].length <= min + 1);
        lanes[ok[rng.int(ok.length)]].push(m);
      }
      level.lanes = lanes;
    } else {
      const made = constructDepot(pic, P, rng);
      if (!made) continue;
      const lot = park(made.solution, made.movers, P, rng, attempt >> 2);
      if (!lot) continue;
      level = {
        mode, diff, n, picture: pic.id, w: pic.w, h: pic.h, cells: pic.cells, movers: made.movers, solution: made.solution,
        ring: made.ring, docks: P.docks, transit: CONFIG.depot.transit, lot,
      };
    }
    if (!replay(level)) continue;
    found++;
    if (want === 1) { best = level; break; }
    const score = judge(level, key, P.judges);
    if (score < bestScore) { best = level; bestScore = score; }
    if (score === 0) break;
  }
  if (!best) throw new Error(`could not make ${mode} ${diff} level ${n}`);
  best = buddyUp(best, P.buddies, key);
  cache.set(key, best);
  return best;
}
