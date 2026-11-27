// The honeycomb and everything that happens on it: neighbours, where a shot flies and sticks, which
// bubbles pop and which drop, and what each power does. Pure logic, no screen and no clock, so the
// game, the autoplayer and the tests all use exactly the same rules.
//
// Coordinates are "grid space": x from the left wall, y from the ceiling (row 0's centre is at y = R).
// Every other row is shifted half a bubble to the right and holds one bubble less. Which rows are
// shifted is set by `parity`, so a new row can be pushed in on top (Endless) without moving the others.
import { CONFIG } from "./config.js";

const { R, D, RH, cols: COLS, width: W } = CONFIG;

/** Bubble kinds. A stone can't pop, only drop; ice doesn't match until a pop next to it thaws it. */
export const NORMAL = "n", STONE = "s", ICE = "i";
/** The powers, in the order they're introduced. */
export const POWERS = ["bomb", "prism", "laser", "comet", "blackhole", "freeze"];

const key = (r, c) => r * 16 + c;

export class Grid {
  constructor(parity = 0) {
    this.rows = [];
    this.parity = parity;
  }
  shifted(r) { return ((r + this.parity) & 1) === 1; }
  width(r) { return this.shifted(r) ? COLS - 1 : COLS; }
  inside(r, c) { return r >= 0 && c >= 0 && c < this.width(r); }
  get(r, c) { const row = this.rows[r]; return (row && row[c]) || null; }
  set(r, c, b) {
    while (this.rows.length <= r) this.rows.push(new Array(COLS).fill(null));
    this.rows[r][c] = b;
  }
  x(r, c) { return R + c * D + (this.shifted(r) ? R : 0); }
  y(r) { return R + r * RH; }
  neighbours(r, c) {
    const s = this.shifted(r), out = [];
    const a = s ? c : c - 1, b = s ? c + 1 : c;
    for (const [rr, cc] of [[r, c - 1], [r, c + 1], [r - 1, a], [r - 1, b], [r + 1, a], [r + 1, b]]) if (this.inside(rr, cc)) out.push([rr, cc]);
    return out;
  }
  /** Every bubble: [r, c, bubble]. */
  all() {
    const out = [];
    for (let r = 0; r < this.rows.length; r++) for (let c = 0; c < COLS; c++) { const b = this.rows[r][c]; if (b) out.push([r, c, b]); }
    return out;
  }
  count() { let n = 0; for (const row of this.rows) for (const b of row) if (b) n++; return n; }
  /** The lowest row that holds a bubble, or -1 when the board is empty. */
  lowest() {
    for (let r = this.rows.length - 1; r >= 0; r--) if (this.rows[r].some(Boolean)) return r;
    return -1;
  }
  trim() { while (this.rows.length && !this.rows[this.rows.length - 1].some(Boolean)) this.rows.pop(); }
  /** Push a row in on top; every other row keeps its place in the honeycomb (one row lower). */
  pushTop(row) {
    const full = new Array(COLS).fill(null);
    row.forEach((b, i) => { full[i] = b; });
    this.rows.unshift(full);
    this.parity ^= 1;
    if (this.shifted(0)) full[COLS - 1] = null;
  }
  /** The colours still on the board (normal bubbles and the colour under ice), counted. */
  colours() {
    const m = new Map();
    for (const row of this.rows) for (const b of row) if (b && b.k !== STONE) m.set(b.c, (m.get(b.c) || 0) + 1);
    return m;
  }
  clone() {
    const g = new Grid(this.parity);
    g.rows = this.rows.map((row) => row.map((b) => b && { ...b }));
    return g;
  }
}

/** The same-colour group of normal bubbles that (r, c) belongs to. */
export function group(grid, r, c) {
  const start = grid.get(r, c);
  if (!start || start.k !== NORMAL) return [];
  const seen = new Set([key(r, c)]), out = [[r, c]];
  for (let i = 0; i < out.length; i++) {
    for (const [a, b] of grid.neighbours(out[i][0], out[i][1])) {
      const n = grid.get(a, b), k = key(a, b);
      if (n && n.k === NORMAL && n.c === start.c && !seen.has(k)) { seen.add(k); out.push([a, b]); }
    }
  }
  return out;
}

/** Every bubble that no longer hangs from the ceiling (row 0), through any chain of neighbours. */
export function floating(grid) {
  const seen = new Set(), queue = [];
  for (let c = 0; c < COLS; c++) if (grid.get(0, c)) { seen.add(key(0, c)); queue.push([0, c]); }
  for (let i = 0; i < queue.length; i++) {
    for (const [a, b] of grid.neighbours(queue[i][0], queue[i][1])) {
      const k = key(a, b);
      if (!seen.has(k) && grid.get(a, b)) { seen.add(k); queue.push([a, b]); }
    }
  }
  return grid.all().filter(([r, c]) => !seen.has(key(r, c))).map(([r, c]) => [r, c]);
}

/**
 * Where a shot from (x0, y0) at `angle` (radians from straight up, + is right) goes. The path is walked
 * in steps of CONFIG.step, bouncing off the side walls, until the shot touches a bubble or the ceiling.
 * A comet (`pass`) flies through bubbles instead and collects them in `passed`.
 * Returns { pts: the path as [x, y] corners, x, y: where it stopped, hit: [r, c] or null, passed: keys }.
 */
export function trace(grid, x0, y0, angle, pass = false) {
  let x = x0, y = y0, dx = Math.sin(angle), dy = -Math.cos(angle);
  const pts = [[x, y]], passed = [], hit2 = CONFIG.hit * CONFIG.hit, step = CONFIG.step;
  for (let i = 0; i < 10000; i++) {
    x += dx * step; y += dy * step;
    if (x < R) { x = 2 * R - x; dx = -dx; pts.push([R, y]); }
    else if (x > W - R) { x = 2 * (W - R) - x; dx = -dx; pts.push([W - R, y]); }
    if (y <= R) { y = R; pts.push([x, y]); return { pts, x, y, hit: null, passed }; }
    const r0 = Math.round((y - R) / RH);
    let hit = null, best = hit2;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (r < 0 || r >= grid.rows.length) continue;
      const cy = grid.y(r), cg = Math.round((x - R - (grid.shifted(r) ? R : 0)) / D);
      for (let c = cg - 1; c <= cg + 1; c++) {
        if (!grid.inside(r, c) || !grid.get(r, c)) continue;
        const ex = grid.x(r, c) - x, ey = cy - y, d = ex * ex + ey * ey;
        if (d >= hit2) continue;
        if (pass) { const k = key(r, c); if (!passed.includes(k)) passed.push(k); }
        else if (d < best) { best = d; hit = [r, c]; }
      }
    }
    if (hit) { pts.push([x, y]); return { pts, x, y, hit, passed }; }
  }
  pts.push([x, y]);
  return { pts, x, y, hit: null, passed };
}

/** The free cell a shot that stopped at (x, y) sticks in: the nearest empty cell that touches the
 *  ceiling or another bubble. */
export function snap(grid, x, y) {
  const r0 = Math.max(0, Math.round((y - R) / RH));
  for (const reach of [1, 2, 3]) {
    let best = null, bd = Infinity;
    for (let r = Math.max(0, r0 - reach); r <= r0 + reach; r++) {
      const cg = Math.round((x - R - (grid.shifted(r) ? R : 0)) / D);
      for (let c = cg - reach; c <= cg + reach; c++) {
        if (!grid.inside(r, c) || grid.get(r, c)) continue;
        if (r > 0 && !grid.neighbours(r, c).some(([a, b]) => grid.get(a, b))) continue;
        const d = (grid.x(r, c) - x) ** 2 + (grid.y(r) - y) ** 2;
        if (d < bd) { bd = d; best = [r, c]; }
      }
    }
    if (best) return best;
  }
  return [0, Math.max(0, Math.min(COLS - 1, Math.round((x - R) / D)))];
}

function mostCommon(grid) {
  let best = 0, n = -1;
  for (const [c, k] of grid.colours()) if (k > n) { n = k; best = c; }
  return best;
}

/**
 * Apply a shot that flew along `tr`. `shot` is { c } for a coloured bubble or { p } for a power.
 * Changes the grid and returns what happened:
 *   { placed: [r, c] | null, at: [x, y] where it hit, popped: [...], dropped: [...], thawed: [[r, c]],
 *     colour: the colour a prism became or a black hole took }
 * Each popped or dropped entry is { r, c, b (the bubble), x, y }, in grid space.
 */
export function resolve(grid, tr, shot) {
  const out = { placed: null, at: [tr.x, tr.y], popped: [], dropped: [], thawed: [], colour: null };
  const take = (r, c, list) => {
    const b = grid.get(r, c);
    if (!b) return;
    grid.set(r, c, null);
    list.push({ r, c, b, x: grid.x(r, c), y: grid.y(r) });
  };
  const p = shot.p || null;
  if (p === "comet") {
    for (const k of tr.passed) take(k >> 4, k & 15, out.popped);
  } else {
    const [r, c] = snap(grid, tr.x, tr.y);
    out.at = [grid.x(r, c), grid.y(r)];
    if (!p || p === "prism") {
      let colour = shot.c;
      if (p === "prism") colour = prismColour(grid, r, c);
      out.colour = colour;
      grid.set(r, c, { c: colour, k: NORMAL });
      out.placed = [r, c];
      const g = group(grid, r, c);
      if (g.length >= 3) for (const [a, b] of g) take(a, b, out.popped);
    } else if (p === "bomb") {
      const reach = (CONFIG.powers.bombRadius * D) ** 2, cx = grid.x(r, c), cy = grid.y(r);
      for (const [a, b] of grid.all()) if ((grid.x(a, b) - cx) ** 2 + (grid.y(a) - cy) ** 2 <= reach) take(a, b, out.popped);
    } else if (p === "laser") {
      const row = tr.hit ? tr.hit[0] : 0;
      for (let k = 0; k < COLS; k++) take(row, k, out.popped);
    } else if (p === "blackhole") {
      let colour = null;
      const h = tr.hit && grid.get(tr.hit[0], tr.hit[1]);
      if (h && h.k !== STONE) colour = h.c;
      else {
        for (const [a, b] of grid.neighbours(r, c)) { const n = grid.get(a, b); if (n && n.k !== STONE) { colour = n.c; break; } }
        if (colour === null) colour = mostCommon(grid);
      }
      out.colour = colour;
      for (const [a, b, n] of grid.all()) if (n.k !== STONE && n.c === colour) take(a, b, out.popped);
    }
  }
  // A pop thaws the ice next to it.
  for (const q of out.popped) {
    for (const [a, b] of grid.neighbours(q.r, q.c)) {
      const n = grid.get(a, b);
      if (n && n.k === ICE) { n.k = NORMAL; out.thawed.push([a, b]); }
    }
  }
  for (const [r, c] of floating(grid)) take(r, c, out.dropped);
  grid.trim();
  return out;
}

/** The colour a prism takes at (r, c): the one whose group it would make the biggest. */
function prismColour(grid, r, c) {
  let best = null, size = 0;
  const tried = new Set();
  for (const [a, b] of grid.neighbours(r, c)) {
    const n = grid.get(a, b);
    if (!n || n.k !== NORMAL || tried.has(n.c)) continue;
    tried.add(n.c);
    grid.set(r, c, { c: n.c, k: NORMAL });
    const s = group(grid, r, c).length;
    grid.set(r, c, null);
    if (s > size) { size = s; best = n.c; }
  }
  return best === null ? mostCommon(grid) : best;
}

/** A new row for Endless: colours that tend to continue the row under it, sometimes a power bubble. */
export function randomRow(grid, rand, colours, powerChance, powers) {
  // The row goes in on top, so it will be shifted when row 0 isn't now.
  const width = grid.shifted(0) ? COLS : COLS - 1;
  const row = [];
  for (let c = 0; c < width; c++) {
    const below = grid.get(0, Math.min(c, grid.width(0) - 1));
    const left = row[c - 1];
    let col;
    if (left && rand.chance(0.4)) col = left.c;
    else if (below && below.k !== STONE && rand.chance(0.35)) col = below.c;
    else col = rand.int(colours);
    row.push({ c: col, k: NORMAL });
  }
  if (powers && rand.chance(powerChance)) row[rand.int(width)].p = rand.weighted(powers);
  return row;
}
