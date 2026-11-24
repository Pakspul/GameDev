// Depot's car park, in plain geometry: vehicles are rectangles at any of eight headings (every 45°),
// so a lot can be straight, diagonal or a mix of both. No drawing in here.
//
// A vehicle drives straight ahead to leave. It can go only if no other vehicle still in the lot
// overlaps the strip in front of its nose. Which vehicles stand in whose way never changes, so it is
// worked out once per level (blockersOf).
//
// Lots are made from lattices: grids of unit cells, straight or turned 45°, clipped to a shape. A car
// covers one cell, a van or a bus two. The level generator (levels.js) fills them.

const S = Math.SQRT1_2;
/** Heading h (0..7) as a unit vector: 0 right, 2 down, 4 left, 6 up (screen y points down). */
export const HEAD = [[1, 0], [S, S], [0, 1], [-S, S], [-1, 0], [-S, -S], [0, -1], [S, -S]];

/** The kinds of vehicle: seats, the cells it covers, and its body (length, width) in cells. */
export const KINDS = {
  car: { seats: 4, cells: 1, len: 0.84, wid: 0.6 },
  van: { seats: 6, cells: 2, len: 1.42, wid: 0.66 },
  bus: { seats: 10, cells: 2, len: 1.86, wid: 0.7 },
};
export const KIND_OF_SEATS = { 4: "car", 6: "van", 10: "bus" };

/** A vehicle's body as a rectangle: centre, heading, half length and half width. */
export function body(car) {
  const k = KINDS[car.kind], [ux, uy] = HEAD[car.h];
  return { cx: car.x, cy: car.y, ux, uy, hl: k.len / 2, hw: k.wid / 2 };
}
/** The strip a vehicle drives through to leave: from its nose, straight ahead, far out. */
export function sweep(car, far = 40) {
  const b = body(car);
  return { ...b, cx: b.cx + b.ux * (b.hl + far / 2), cy: b.cy + b.uy * (b.hl + far / 2), hl: far / 2 };
}
/** Do two rectangles overlap (by more than a hair)? Separating axis test. */
export function overlap(a, b, eps = 0.02) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  for (const [ax, ay] of [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]]) {
    const ra = a.hl * Math.abs(a.ux * ax + a.uy * ay) + a.hw * Math.abs(-a.uy * ax + a.ux * ay);
    const rb = b.hl * Math.abs(b.ux * ax + b.uy * ay) + b.hw * Math.abs(-b.uy * ax + b.ux * ay);
    if (Math.abs(dx * ax + dy * ay) >= ra + rb - eps) return false;
  }
  return true;
}
/** The four corners of a rectangle. */
export function corners(r) {
  const out = [];
  for (const [s, t] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) out.push([r.cx + r.ux * r.hl * s - r.uy * r.hw * t, r.cy + r.uy * r.hl * s + r.ux * r.hw * t]);
  return out;
}
/** Is point (x, y) inside a rectangle grown by `pad`? */
export function inside(r, x, y, pad = 0) {
  const dx = x - r.cx, dy = y - r.cy;
  return Math.abs(dx * r.ux + dy * r.uy) <= r.hl + pad && Math.abs(-dx * r.uy + dy * r.ux) <= r.hw + pad;
}

/** For each vehicle, the vehicles in its way (by index). */
export function blockersOf(cars) {
  const bodies = cars.map(body);
  return cars.map((c, i) => {
    const s = sweep(c), out = [];
    bodies.forEach((b, j) => { if (j !== i && overlap(s, b)) out.push(j); });
    return out;
  });
}

/** How far a vehicle can drive ahead before it touches one of `others` (for the bump when it's blocked). */
export function reach(car, others, max = 30) {
  const b = body(car), bodies = others.map(body);
  for (let d = 0.05; d < max; d += 0.05) {
    const moved = { ...b, cx: b.cx + b.ux * d, cy: b.cy + b.uy * d };
    if (bodies.some((o) => overlap(moved, o))) return d - 0.05;
  }
  return max;
}

/** The lot's extent: { x0, y0, x1, y1 } round every vehicle's corners. */
export function bounds(cars) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cars) for (const [x, y] of corners(body(c))) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

// ---- Lattices ---------------------------------------------------------------------------------------------
/** A lattice: unit cells (i, j), straight (turn 0) or turned 45° (turn 1), with a mask of usable cells. */
function lattice(turn, keep, R) {
  const cells = [];
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const [x, y] = toWorld(turn, i, j);
    if (keep(x, y)) cells.push([i, j]);
  }
  return { turn, cells, has: new Set(cells.map(([i, j]) => i + "," + j)) };
}
export function toWorld(turn, i, j) {
  if (!turn) return [i, j];
  return [(i - j) * S, (i + j) * S];
}

/** The lattices of a lot shape, sized for about `need` cells. Shapes:
 *  - "straight": one straight lattice in an oval;
 *  - "diagonal": one lattice turned 45°, in an oval;
 *  - "mixed": a diagonal heart in a straight ring. */
export function latticesFor(shape, need, grow = 0) {
  const area = need * 1.06 + grow * 5;
  const ry = Math.sqrt(area / (Math.PI * 1.15)), rx = ry * 1.15; // ovals a little wider than high
  const oval = (a, b) => (x, y) => (x * x) / (a * a) + (y * y) / (b * b) <= 1;
  const R = Math.ceil(rx) + 2;
  if (shape === "straight") return [lattice(0, oval(rx, ry), R)];
  if (shape === "diagonal") return [lattice(1, oval(rx + 0.3, ry + 0.3), R)];
  // Mixed: a diagonal heart (a third of the room) and a straight ring round it, with a gap between.
  // The ring holds the other two thirds, plus what the gap takes.
  const r1 = Math.max(1.6, Math.sqrt(area / 3 / Math.PI)), r2 = r1 + 0.95;
  const rx2 = Math.max(r2 + 1.6, Math.sqrt(1.15 * ((area * 2) / 3 / Math.PI + r2 * r2))), ry2 = Math.max(r2 + 1.2, rx2 / 1.15);
  return [
    lattice(1, (x, y) => x * x + y * y <= r1 * r1, Math.ceil(rx2) + 2),
    lattice(0, (x, y) => oval(rx2, ry2)(x, y) && Math.hypot(x, y) >= r2, Math.ceil(rx2) + 2),
  ];
}

/** Where a vehicle of `kind` can stand on lattice L with its nose in cell (i, j) facing lattice
 *  direction d (0 right, 1 down, 2 left, 3 up): its cells and the car, or null if it doesn't fit. */
export function fit(L, kind, i, j, d) {
  const DI = [[1, 0], [0, 1], [-1, 0], [0, -1]][d];
  const n = KINDS[kind].cells, cells = [];
  for (let k = 0; k < n; k++) cells.push([i - DI[0] * k, j - DI[1] * k]);
  if (!cells.every(([a, b]) => L.has.has(a + "," + b))) return null;
  let x = 0, y = 0;
  for (const [a, b] of cells) { const p = toWorld(L.turn, a, b); x += p[0] / n; y += p[1] / n; }
  return { cells, car: { kind, x, y, h: (2 * d + L.turn) % 8 } };
}
