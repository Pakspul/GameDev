// The tables, as data: walls (segments), round things (bumpers, posts, rocks), flippers, sensors
// (rollovers and lines a ball crosses) and holes. physics.js plays them; render.js draws them.
//
// Every table is 560 × 1000 world units with the same lower half (inlanes, slingshots, flippers at
// the same spots), so a player's timing carries over from the main table to the bonus tables.
// The playfield's middle is x = 260; the main table's plunger lane sits to the right of x = 500.
import { CONFIG } from "./config.js";

const W = CONFIG.W, H = CONFIG.H, X0 = 260;
const DEG = Math.PI / 180;
const mx = (x) => 2 * X0 - x; // mirror left ↔ right

function seg(a, b, o = {}) { return { ax: a[0], ay: a[1], bx: b[0], by: b[1], ...o }; }
function wall(pts, o = {}) {
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push(seg(pts[i - 1], pts[i], o));
  return out;
}
function arc(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function bezier(p0, c, p1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return pts;
}
const flipPts = (pts) => pts.map(([x, y]) => [mx(x), y]);

/** The lower half every table shares: side walls curving into the inlanes, slingshots, flippers. */
function lower(xl) {
  const left = [...bezier([xl, 560], [xl, 660], [60, 690], 10), [60, 830], [157, 866]]; // ends on top of the flipper's pivot, so a ball rolls on without a notch to rest in
  const segs = [...wall(left), ...wall(flipPts(left))];
  // Slingshots: the face towards the middle kicks (a little shorter than the face, so a ball
  // brushing a corner from the inlane isn't fired off); the other two sides are plain rubber.
  const sling = [[102, 720], [102, 800], [140, 828]];
  for (const [pts, id] of [[sling, "slingL"], [flipPts(sling), "slingR"]]) {
    const [a, b, c] = pts, lerp = (t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
    segs.push(seg(lerp(0.12), lerp(0.88), { id, kind: "sling", kick: CONFIG.sling.kick, minHit: CONFIG.sling.minHit, e: CONFIG.sling.e }));
    segs.push(seg(a, c, { e: 0.5 }), seg(a, b, { e: 0.5 }), seg(b, c, { e: 0.5 }));
  }
  const F = CONFIG.flipper;
  const flippers = [
    { side: "L", x: 160, y: 880, rest: F.rest, up: F.up },
    { side: "R", x: 360, y: 880, rest: Math.PI - F.rest, up: Math.PI - F.up },
  ];
  return { segs, flippers };
}

const bumper = (id, x, y, r = 24) => ({ id, kind: "bumper", x, y, r, kick: CONFIG.bumper.kick, e: CONFIG.bumper.e });

// ---- The main table ------------------------------------------------------------------------------------------
function main() {
  const lo = lower(20);
  // The top: two tight corners joined by a straight roof. A fast ball follows the corners round
  // (an orbit); a slow one leaves the roof and drops into the lanes and bumpers.
  const top = [...arc(120, 140, 100, Math.PI, 1.5 * Math.PI, 16), ...arc(440, 140, 100, 1.5 * Math.PI, 2 * Math.PI, 16)];
  const segs = [
    ...wall(top),
    ...wall([[20, 140], [20, 560]]),
    // The plunger lane, right of x = 500: its floor is where a new ball waits.
    seg([540, 140], [540, 962]), seg([500, 962], [540, 962]), seg([500, 306], [500, 962], { r: 2 }),
    // A one-way gate on top of the lane: up and out, never back in.
    seg([500, 306], [540, 292], { pass: norm(-14, -40), r: 1, kind: "gate" }),
    // The orbits: a channel up each side, joined by the arc over the top.
    seg([70, 330], [70, 560], { r: 3 }), seg([450, 330], [450, 560], { r: 3 }),
    // The wormhole: a scoop open to the flippers, with a guard over its back so balls falling from
    // the bumpers glance off it. It sits in the path of a right-flipper shot hit a little early.
    ...wall(arc(165, 385, 28, 1.12 * Math.PI, 1.82 * Math.PI, 8), { r: 3 }),
    // Top lane guides.
    ...[170, 230, 290, 350].map((x) => seg([x, 88], [x, 134], { r: 4, e: 0.5 })),
    // Asteroid drop targets (left) and satellite standups (right).
    ...[428, 468, 508].map((y, i) => seg([80, y], [80, y + 30], { id: "drop" + (i + 1), kind: "drop", r: 4, e: 0.3 })),
    ...[428, 468, 508].map((y, i) => seg([440, y], [440, y + 30], { id: "sat" + (i + 1), kind: "standup", r: 4, e: 0.35 })),
    ...lo.segs,
  ];
  const circles = [bumper("bumper1", 210, 215), bumper("bumper2", 310, 215), bumper("bumper3", 260, 292)];
  const sensors = [
    { id: "lane1", x: 200, y: 112, r: 12 }, { id: "lane2", x: 260, y: 112, r: 12 }, { id: "lane3", x: 320, y: 112, r: 12 },
    seg([20, 505], [70, 505], { id: "spinner" }),
    seg([20, 452], [70, 452], { id: "orbitL" }),
    seg([450, 452], [500, 452], { id: "orbitR" }),
    seg([500, 700], [540, 700], { id: "shooter" }),
  ];
  const holes = [
    { id: "pad", x: 260, y: 440, r: 13 },
    { id: "wormhole", x: 165, y: 385, r: 19 },
  ];
  return {
    id: "main", W, H, gravity: CONFIG.gravity, segs, circles, flippers: lo.flippers, sensors, holes, drainY: H + 20,
    floor: [[20, H], ...top, [540, H]],
    plunger: { x: 520, y: 951, x0: 500, x1: 540, y0: 860 },
    // Where the arrows sit that point at each shot (render.js), and which way they point.
    shots: {
      leftOrbit: { x: 45, y: 615, a: -90 * DEG },
      rightOrbit: { x: 475, y: 615, a: -90 * DEG },
      pad: { x: 260, y: 492, a: -90 * DEG },
      wormhole: { x: 165, y: 432, a: -90 * DEG },
      drops: { x: 122, y: 483, a: 180 * DEG },
      sat: { x: 398, y: 483, a: 0 },
      spinner: { x: 45, y: 615, a: -90 * DEG, same: "leftOrbit" },
      bumpers: { x: 260, y: 250, ring: true },
    },
    lanes: [[200, 112], [260, 112], [320, 112]],
    mult: [[206, 646], [242, 646], [278, 646], [314, 646]],
    save: [260, 958],
  };
}

// ---- Bonus tables --------------------------------------------------------------------------------------------
function frame() {
  const lo = lower(40);
  const top = arc(X0, 260, 220, Math.PI, 2 * Math.PI, 48);
  return {
    segs: [...wall(top), ...wall([[40, 260], [40, 560]]), ...wall([[480, 260], [480, 560]]), ...lo.segs],
    flippers: lo.flippers,
    floor: [[40, H], ...top, [480, H]],
  };
}

/** Asteroid Belt: rocks that crack and break, and come back somewhere else. */
export const ROCK_SLOTS = [[260, 180], [165, 285], [355, 285], [260, 380], [150, 475], [370, 475], [260, 560]];
function asteroids() {
  const f = frame();
  return {
    id: "asteroids", W, H, gravity: CONFIG.gravity, floor: f.floor, segs: f.segs, flippers: f.flippers, drainY: H + 20,
    circles: [
      bumper("mb1", 132, 175, 20), bumper("mb2", 388, 175, 20),
      ...ROCK_SLOTS.map(([x, y], i) => ({ id: "rock" + i, kind: "rock", x, y, r: 22, e: 0.55, active: false })),
    ],
    sensors: [], holes: [],
    entry: [X0, 78],
  };
}

/** Gravity Well: a black hole pulls the ball in; stars on a ring around it light up one at a time. */
export const STAR_RING = { x: X0, y: 335, r: 150, n: 6 };
function gravity() {
  const f = frame(), S = STAR_RING;
  const stars = [];
  for (let i = 0; i < S.n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / S.n;
    stars.push({ id: "star" + i, kind: "star", x: S.x + S.r * Math.cos(a), y: S.y + S.r * Math.sin(a), r: 12, e: 0.8 });
  }
  return {
    id: "gravity", W, H, gravity: CONFIG.gravity, floor: f.floor, segs: f.segs, flippers: f.flippers, drainY: H + 20,
    circles: stars,
    fields: [{ x: S.x, y: S.y, R: 215, k: 2300 }],
    holes: [{ id: "core", x: S.x, y: S.y, r: 15 }],
    sensors: [],
    entry: [X0 + 60, 78],
  };
}

/** UFO Attack: a saucer flies to and fro at the top; a row of alien drop targets below it. */
export const UFO = { y: 190, x0: 120, x1: 400, r: 30, speed: 150 };
function ufo() {
  const f = frame();
  const aliens = [[140, 185], [205, 250], [270, 315], [335, 380]].map(([a, b], i) =>
    seg([a, 430], [b, 430], { id: "alien" + (i + 1), kind: "drop", r: 5, e: 0.3 }));
  return {
    id: "ufo", W, H, gravity: CONFIG.gravity, floor: f.floor, segs: [...f.segs, ...aliens], flippers: f.flippers, drainY: H + 20,
    circles: [
      { id: "ufo", kind: "ufo", x: X0, y: UFO.y, r: UFO.r, e: 0.6 },
      bumper("mb1", 165, 305, 20), bumper("mb2", 355, 305, 20),
    ],
    sensors: [], holes: [],
    entry: [X0, 78],
  };
}

function norm(x, y) { const d = Math.hypot(x, y); return [x / d, y / d]; }

export const MINIS = ["asteroids", "gravity", "ufo"];
const BUILD = { main, asteroids, gravity, ufo };
/** A fresh copy of a table (physics changes its objects, so every World gets its own). */
export function buildTable(id) { return BUILD[id](); }
