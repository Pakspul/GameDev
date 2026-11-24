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
//   3. Put the movers in the yard so the solution can be played: in Critters each lane keeps the
//      order.
//   4. Replay the solution with the real rules. Only a level that passes is used.
//   5. Critters and Orbit: link a few pairs of critters as buddies, which leave the lanes together
//      (buddyUp(); the level stays the same otherwise).
//
// Depot has no picture. Its vehicles are picked first (colours and kinds); then the crowd is made up
// while the level is played forwards: each time the loop stops, send a vehicle whose colour walks the
// loop, and pick the colour of each person as they step in, from the seats still unclaimed. Then the car
// park is filled from the last vehicle to leave to the first, each with a clear way out past the ones
// already there (but often in their way: that's the jam). It is replayed too.
import { Rng, hashSeed } from "./rng.js";
import { Game, makeTrack, lap } from "./engine.js";
import { Depot, DOCKED, DRIVING } from "./depot.js";
import { KINDS, KIND_OF_SEATS, latticesFor, fit, body, sweep, overlap } from "./lot.js";
import { DRAWN, LARGE, artOf, fromArt, madePicture } from "./pictures.js";
import { Orbit, lap3 } from "./orbit.js";
import { SCULPTS, sculptById, sculptFor, madeSculpture } from "./sculptures.js";
import { CONFIG } from "./config.js";
import { playThrough } from "./judge.js";

export const MODES = ["depot", "critters", "orbit"];
export const DIFFS = ["easy", "medium", "hard"];

// The drawn pictures, in the order each track meets them.
const ORDER = {
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
    const g = Math.min(8, Math.floor((n - 1) / 3)); // grows a little every three levels
    return {
      D,
      streams: [n <= 4 ? 1 : 2, n % 3 === 0 ? 3 : 2, n % 4 === 1 ? 2 : 3][D],
      colors: Math.min([5, 6, 7][D], [3, 5, 6][D] + Math.floor((n - 1) / [4, 6, 8][D])),
      vehicles: [10, 18, 24][D] + g,
      kinds: [[4, 3, 2], [3, 3, 3], [3, 3, 4]][D], // how often a car, a van, a bus
      loop: [44, 38, 34][D],                       // spots on the loop
      docks: [5, 3, 3][D] - (tight ? 1 : 0),
      open: [1, 2, 2][D],     // vehicles the made solution may keep waiting at a bay at once
      keep: [0.1, 0.3, 0.45][D],
      clump: [0.72, 0.62, 0.52][D], // how often a person has the colour of the one before them in their stream
      jam: [0.7, 1.3, 1.9][D],      // how much the car park is packed in each other's way
      shape: depotShape(D, n),
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

/** Straight, diagonal or mixed car parks, in turns that get busier on harder tracks. */
function depotShape(D, n) {
  const turns = [["straight", "straight", "diagonal", "straight", "mixed"], ["straight", "diagonal", "mixed"], ["mixed", "diagonal", "straight", "mixed"]][D];
  if (D === 0 && n <= 3) return "straight";
  return turns[(n - 1) % turns.length];
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
// Colours that stay easy to tell apart in a crowd, best first (palette index + 1).
const CROWD = [1, 8, 3, 5, 10, 9, 2, 7, 13, 11];

/** The vehicles, the crowd and a solution (each vehicle is sent once), played forwards on a Depot
 *  without a car park. */
function constructDepot(P, rng) {
  // The vehicles: every colour gets at least two.
  const pool = CROWD.slice(0, P.colors + 2);
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const colors = pool.slice(0, P.colors);
  const kinds = ["car", "van", "bus"], kw = P.kinds.reduce((a, b) => a + b, 0);
  const fleet = [];
  for (let v = 0; v < P.vehicles; v++) {
    let r = rng.int(kw), k = 0;
    while (r >= P.kinds[k]) r -= P.kinds[k++];
    fleet.push({ color: colors[v % colors.length], seats: KINDS[kinds[k]].seats });
  }
  const total = new Map(colors.map((c) => [c, 0])), made = new Map(colors.map((c) => [c, 0]));
  for (const v of fleet) total.set(v.color, total.get(v.color) + v.seats);
  const N = fleet.reduce((a, v) => a + v.seats, 0);
  // The streams: the zip deals people out in turn.
  const streams = Array.from({ length: P.streams }, (_, j) => new Array(Math.floor(N / P.streams) + (j < N % P.streams ? 1 : 0)).fill(0));
  const level = { mode: "depot", streams, loop: P.loop, docks: P.docks, transit: CONFIG.depot.transit, movers: [], lot: null };
  const g = new Depot(level, { history: false });
  const last = new Array(P.streams).fill(0);
  // Someone steps in: a colour from the seats still unclaimed, often the colour of the one in front
  // of them, and more often a colour a parked vehicle is waiting for.
  g.draw = (j) => {
    const need = (c) => total.get(c) - made.get(c);
    let pick = 0;
    if (last[j] && need(last[j]) > 0 && rng.chance(P.clump)) pick = last[j];
    else {
      const want = new Map();
      for (const m of g.docks) if (m >= 0 && (g.where[m] === DOCKED || g.where[m] === DRIVING)) {
        const c = g.color(m);
        want.set(c, (want.get(c) || 0) + g.left[m]);
      }
      const w = colors.map((c) => need(c) * ((want.get(c) || 0) > g.onRing[c] ? 4 : 1));
      let r = rng.float() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < colors.length; i++) { if (w[i] > 0) { pick = colors[i]; if ((r -= w[i]) <= 0) break; } }
    }
    made.set(pick, made.get(pick) + 1);
    last[j] = pick;
    return pick;
  };
  const solution = [];
  g.settle();
  while (g.status === "play" && fleet.length) {
    // The loop has stopped: no one on it has a vehicle. Send one whose colour walks the loop: one that
    // fills up at once, or now and then one that has to wait at its bay for more.
    const on = g.onRing, waiting = g.docks.filter((m) => m >= 0).length;
    const now = [], later = [];
    fleet.forEach((v, i) => {
      if (on[v.color] >= v.seats) now.push(i);
      else if (on[v.color] > 0) later.push(i);
    });
    const canWait = later.length > 0 && waiting < P.open && P.docks - waiting >= 2;
    let opts = now;
    if (!now.length || (canWait && rng.chance(P.keep))) opts = canWait ? later : [];
    if (!opts.length) return null;
    const ws = opts.map((i) => Math.pow(on[fleet[i].color], P.bias));
    let r = rng.float() * ws.reduce((a, b) => a + b, 0), pick = opts[0];
    for (let k = 0; k < opts.length; k++) { if ((r -= ws[k]) <= 0) { pick = opts[k]; break; } }
    const v = fleet.splice(pick, 1)[0];
    const m = g.addMover(v.color, v.seats);
    if (g.launch(m) !== "ok") return null;
    g.settle();
    solution.push(m);
  }
  if (g.status !== "won") return null;
  return { streams, movers: level.movers, solution };
}

/** Depot's car park for the vehicles in the order they leave. Returns { shape, cars } or null if they
 *  don't fit. The last to leave is placed first; each next one needs a clear way out past the ones
 *  already there, and is preferably put in their way. */
function park(order, movers, P, rng, grow) {
  const kindOf = (m) => KIND_OF_SEATS[movers[m].cap];
  const need = order.reduce((a, m) => a + KINDS[kindOf(m)].cells, 0);
  const Ls = latticesFor(P.shape, need, grow);
  const used = Ls.map(() => new Set());
  const cars = [], bodies = [], sweeps = [];
  for (let k = order.length - 1; k >= 0; k--) {
    const m = order[k], kind = kindOf(m);
    const cands = [];
    Ls.forEach((L, li) => {
      for (const [i, j] of L.cells) for (let d = 0; d < 4; d++) {
        const f = fit(L, kind, i, j, d);
        if (!f || f.cells.some(([a, b]) => used[li].has(a + "," + b))) continue;
        const b = body(f.car);
        if (bodies.some((o) => overlap(b, o))) continue;
        const s = sweep(f.car);
        if (bodies.some((o) => overlap(s, o))) continue;
        let blocks = 0, near = 0;
        for (const sw of sweeps) if (overlap(sw, b)) blocks++;
        for (const o of bodies) if (Math.hypot(o.cx - b.cx, o.cy - b.cy) < 1.7) near++;
        // Jam, then a tight pack round the middle, with a little chance.
        const score = blocks * 1.2 * P.jam + near * 1.4 - Math.hypot(b.cx, b.cy) * 2.0 + rng.float() * 1.2;
        cands.push({ f, li, b, s, score });
      }
    });
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score);
    const c = cands[rng.int(Math.min(3, cands.length))];
    for (const [a, b] of c.f.cells) used[c.li].add(a + "," + b);
    cars.push({ m, ...c.f.car });
    bodies.push(c.b); sweeps.push(c.s);
  }
  return { shape: P.shape, cars: cars.reverse() };
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
    const pic = mode === "critters" ? pictureFor(mode, diff, n, rng, P) : null;
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
      const made = constructDepot(P, rng);
      if (!made) continue;
      const lot = park(made.solution, made.movers, P, rng, attempt >> 2);
      if (!lot) continue;
      level = {
        mode, diff, n, streams: made.streams, movers: made.movers, solution: made.solution,
        loop: P.loop, docks: P.docks, transit: CONFIG.depot.transit, lot,
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
