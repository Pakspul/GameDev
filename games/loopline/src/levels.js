// Levels, built from a seed: the same level number gives the same level on every device.
//
// How a level is made, so that it can always be solved:
//   1. Take a picture (pictures.js).
//   2. Play it forwards: again and again, pick a colour that shows somewhere and send a mover of that
//      colour round. Its capacity becomes whatever it took. Sometimes a mover takes everything it can
//      see, parks in a bay and comes back later for more (that's what makes bays matter).
//   3. That list of sends is a solution. Put the movers in the yard so it can be played in that
//      order: in Critters each lane keeps their order; in Depot the car park is filled from the
//      last car to leave to the first, and each car is placed with a clear way out past the cars
//      already there (but may block theirs, which is the jam).
//   4. Replay the solution with the real rules (engine.js). Only a level that passes is used.
import { Rng, hashSeed } from "./rng.js";
import { Game, makeTrack, lap, carCells, carPath } from "./engine.js";
import { DRAWN, fromArt, madePicture } from "./pictures.js";
import { CONFIG } from "./config.js";

export const MODES = ["depot", "critters"];

// The drawn pictures, in the order each mode meets them (small and simple first).
const ORDER = {
  depot: ["heart", "fish", "mushroom", "tree", "apple", "house", "cactus", "duck", "flower", "boat", "cat", "icecream", "butterfly", "bus", "rocket"],
  critters: ["heart", "apple", "fish", "tree", "flower", "cat", "mushroom", "icecream", "house", "butterfly", "cactus", "duck", "rocket", "boat", "bus"],
};
const BY_ID = Object.fromEntries(DRAWN.map((d) => [d.id, d]));

/** How hard level n of a mode is. */
export function params(mode, n) {
  const t = n <= 2 ? 0 : n <= 6 ? 1 : n <= 18 ? 2 : 3;
  const bays = [5, 4, 3, 3][t] - (t === 3 && n % 4 === 0 ? 1 : 0); // every 4th late level is a tight one
  return {
    bays,
    open: Math.min(bays - 1, [0, 1, 2, 2][t]), // how many movers the made solution may keep parked at once
    keep: [0, 0.3, 0.45, 0.55][t],             // how often a mover in it parks to come back later
    maxCap: [10, 14, 20, 26][t],
    lanes: n <= 2 ? 2 : n <= 12 ? 3 : 4,
    hidden: mode === "critters" && n >= 16,    // only the front critter of a lane shows its colour
  };
}

function pictureFor(mode, n, rng) {
  const order = ORDER[mode];
  if (n <= order.length) { const d = BY_ID[order[n - 1]]; return fromArt(d.id, d.art); }
  const k = n - order.length - 1;
  const size = Math.min(16, 11 + Math.floor(k / 6));
  return madePicture(rng, k + (mode === "critters" ? 1 : 0), size);
}

/** Step 2: the movers and a solution (a list of sends, a mover may appear more than once). */
function construct(pic, P, rng) {
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
      if (t) opts.push({ c, t, w: Math.pow(t, 1.5) });
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
    // Small movers are the likeliest to come back for more later.
    const keep = P.keep + (P.keep && mv.total < P.maxCap / 3 ? 0.3 : 0);
    mv.open = got === pick.t && mv.total < P.maxCap - 2 && count(mv.color) > 0 && others < P.open && rng.chance(keep);
  }
  return { movers: movers.map((mv) => ({ color: mv.color, cap: mv.total })), solution };
}

/** Step 3 for Depot: the car park. Returns { w, h, cars } or null if it doesn't fit. */
function park(order, movers, P, rng, grow) {
  const big = Math.max(8, Math.round(P.maxCap * 0.6));
  const lens = order.map((m) => (movers[m].cap >= big ? 2 : 1));
  const need = lens.reduce((a, b) => a + b, 0);
  const lw = order.length > 9 ? 6 : 5;
  const lh = Math.max(3, Math.min(7, Math.ceil((need * 1.45) / lw) + grow));
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
        // Jam: how many parked cars (which leave later) this one stands in the way of.
        const keys = new Set(body.map(([bx, by]) => by * lw + bx));
        let blocks = 0;
        for (const c of cars) if (carPath(c, lw, lh).some(([px, py]) => keys.has(py * lw + px))) blocks++;
        cands.push({ car, score: blocks * 3 + rng.float() * 2.5 + (dir === "down" || dir === "up" ? 0.4 : 0) });
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

/** Step 4: play a solution with the real rules. */
export function replay(level, solution = level.solution) {
  const g = new Game(level, { history: false });
  for (const m of solution) {
    if (g.launch(m) !== "ok") return false;
    g.settle();
    if (g.status === "lost") return false;
  }
  return g.status === "won";
}

const cache = new Map();
/** Level n (1, 2, 3...) of a mode. */
export function makeLevel(mode, n) {
  const key = mode + ":" + n;
  if (cache.has(key)) return cache.get(key);
  const P = params(mode, n);
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = new Rng(hashSeed(`${mode}:${n}:${attempt}`));
    const pic = pictureFor(mode, n, rng);
    const { movers, solution } = construct(pic, P, rng);
    const order = [];
    for (const m of solution) if (!order.includes(m)) order.push(m);
    const level = {
      mode, n, picture: pic.id, w: pic.w, h: pic.h, cells: pic.cells, movers, solution,
      bays: P.bays, belt: CONFIG.belt, spacing: CONFIG.spacing, hidden: P.hidden,
    };
    if (mode === "critters") {
      const lanes = Array.from({ length: Math.min(P.lanes, order.length) }, () => []);
      for (const m of order) {
        const min = Math.min(...lanes.map((l) => l.length));
        const ok = lanes.map((l, i) => i).filter((i) => lanes[i].length <= min + 1);
        lanes[ok[rng.int(ok.length)]].push(m);
      }
      level.lanes = lanes;
    } else {
      const lot = park(order, movers, P, rng, attempt >> 2);
      if (!lot) continue;
      level.lot = lot;
    }
    if (!replay(level)) continue;
    cache.set(key, level);
    return level;
  }
  throw new Error(`could not make ${mode} level ${n}`);
}
