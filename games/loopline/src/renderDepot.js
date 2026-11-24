// Drawing Depot on the 2D canvas, in Loopline's chunky pixel style. Top to bottom:
//   - the crowd: one to three streams of people walking into a loop, round and round;
//   - the stop at the bottom of the loop, and the row of bays where vehicles park to be boarded;
//   - the car park: vehicles with an arrow on their roof, at any of eight headings, inside a road.
// Nothing here changes the game. The loop keeps walking while the game waits for you, so frames run
// while a level is played (the people are the point of this mode).
import { UI, shade, colorOf, sprite, label, rr, ease, lerp, clamp, fireworks } from "./render.js";
import { YARD, DOCKED, GATES } from "./depot.js";
import { KINDS, HEAD, body, corners, inside, bounds, reach } from "./lot.js";

const TAU = Math.PI * 2;

// ---- Sprites -------------------------------------------------------------------------------------------------
// Letters as in render.js: o outline, b body, h light, s shade, w white, k black, g glass, G glass shine.
const PERSON = [
  "..ooooo..",
  ".ohhbbbo.",
  ".ohbbbbo.",
  ".obbbbso.",
  "..obsso..",
  ".ooooooo.",
  "ohhbbbbso",
  "ohbbbbbso",
  "obbbbbsso",
  "obbbbbsso",
  ".ooooooo.",
];

/** A vehicle from above, nose to the right. */
function vehicleRows(kind) {
  const [L, H] = { car: [14, 10], van: [23, 11], bus: [32, 12] }[kind];
  const wheels = kind === "car" ? [2, 3, L - 4, L - 3] : kind === "van" ? [3, 4, 5, L - 7, L - 6, L - 5] : [3, 4, 5, 6, L - 9, L - 8, L - 7, L - 6];
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = "";
    for (let x = 0; x < L; x++) {
      let ch;
      if (y === 0 || y === H - 1) ch = wheels.includes(x) ? "k" : ".";
      else if ((x === 0 || x === L - 1) && (y === 1 || y === H - 2)) ch = ".";
      else if (x === 0 || x === L - 1 || y === 1 || y === H - 2) ch = "o";
      else if (x === L - 2 && (y === 2 || y === H - 3)) ch = "w";
      else if (x >= L - 5 && x <= L - 4 && y >= 3 && y <= H - 4) ch = y === 3 ? "G" : "g";
      else if (kind === "car" && x >= 3 && x <= L - 7 && y >= 3 && y <= H - 4) ch = x === 3 ? "g" : "h";
      else if (kind !== "car" && x === 2 && y >= 4 && y <= H - 5) ch = "g";
      else if (y === 2 || y === H - 3) ch = "s";
      else if (kind === "bus" && y >= 4 && y <= H - 5 && x >= 4 && x <= L - 8) ch = (x - 4) % 5 === 4 ? "s" : "h";
      else if (kind === "van" && y >= 4 && y <= H - 5 && x >= 4 && x <= L - 8) ch = "h";
      else ch = "b";
      r += ch;
    }
    rows.push(r);
  }
  return rows;
}
const VEHICLE = { car: vehicleRows("car"), van: vehicleRows("van"), bus: vehicleRows("bus") };

/** Every colour of person on one sprite sheet (one image to draw from, however big the crowd).
 *  Returns the sheet and where on it the person in colour `hex` is. */
const sheet = { img: null, at: new Map() };
function people(hex) {
  let x = sheet.at.get(hex);
  if (x == null) {
    const w = PERSON[0].length, n = sheet.at.size, c = document.createElement("canvas");
    c.width = (n + 1) * (w + 1); c.height = PERSON.length;
    const cx = c.getContext("2d");
    if (sheet.img) cx.drawImage(sheet.img, 0, 0);
    x = n * (w + 1);
    const map = { o: shade(hex, -0.62), b: hex, h: shade(hex, 0.38), s: shade(hex, -0.24) };
    PERSON.forEach((row, y) => { for (let i = 0; i < row.length; i++) if (row[i] !== ".") { cx.fillStyle = map[row[i]]; cx.fillRect(x + i, y, 1, 1); } });
    sheet.img = c; sheet.at.set(hex, x);
  }
  return { img: sheet.img, x };
}
const kindOf = (cap) => (cap >= 10 ? "bus" : cap >= 6 ? "van" : "car");

/** A stadium-like loop (a rounded rectangle) as a function of the fraction of a lap from its top
 *  middle, clockwise. A rounded rectangle has the same length in each quarter, so the right, bottom
 *  and left middles sit at exactly 1/4, 1/2 and 3/4, where the rules put the gates and the stop. */
function roundLoop(x, y, w, h, r) {
  const pts = [], arc = (cx, cy, a0) => { for (let k = 1; k <= 10; k++) { const a = a0 + (k / 10) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  pts.push([x + w / 2, y]);
  pts.push([x + w - r, y]); arc(x + w - r, y + r, -Math.PI / 2);
  pts.push([x + w, y + h - r]); arc(x + w - r, y + h - r, 0);
  pts.push([x + r, y + h]); arc(x + r, y + h - r, Math.PI / 2);
  pts.push([x, y + r]); arc(x + r, y + r, Math.PI);
  pts.push([x + w / 2, y]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  return {
    x, y, w, h, r, len,
    /** [x, y, heading] at fraction f of the lap. */
    at(f) {
      const d = (((f % 1) + 1) % 1) * len;
      let lo = 1, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < d) lo = mid + 1; else hi = mid; }
      const a = pts[lo - 1], b = pts[lo], s = cum[lo] - cum[lo - 1] || 1, t = (d - cum[lo - 1]) / s;
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0])];
    },
    /** The fraction of the lap nearest to point (px, py). */
    nearest(px, py) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < 240; k++) { const [x2, y2] = this.at(k / 240), d = (x2 - px) ** 2 + (y2 - py) ** 2; if (d < bd) { bd = d; best = k / 240; } }
      return best;
    },
  };
}
/** The point at distance d along a polyline. */
function atDist(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= s || i === pts.length - 1) { const t = s ? Math.min(1, d / s) : 0; return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]; }
    d -= s;
  }
  return pts[pts.length - 1];
}
const polyLen = (pts) => { let n = 0; for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return n; };
/** [x, y, heading] at fraction t along a polyline. */
function alongH(pts, t) {
  const L = polyLen(pts), p = atDist(pts, t * L), q = atDist(pts, Math.min(L, t * L + 2));
  const a = q[0] !== p[0] || q[1] !== p[1] ? Math.atan2(q[1] - p[1], q[0] - p[0]) : null;
  return [p[0], p[1], a];
}

// A little town at dusk: grass, pavements, asphalt with white markings, yellow for the bus stop.
const D = {
  grass: "#2c5b4f", grassLo: "#244c42", grassHi: "#37705f",
  pave: "#5d6198", paveJoint: "rgba(25,27,51,.16)", kerb: "#b9bde8", kerbLo: "#3a3e70",
  walk: "#9ca0d3", walkJoint: "rgba(25,27,51,.13)", walkEdge: "#c9ccf2", walkLo: "#4a4e86",
  road: "#272a4b", roadEdge: "#1b1d36", mark: "rgba(236,238,255,.78)", markSoft: "rgba(236,238,255,.42)",
  lot: "#30335a", stall: "rgba(236,238,255,.5)",
  stop: "#ffcf3f", rope: "#e5484d", post: "#1b1d36",
  tree: "#3c8a5c", treeHi: "#5aa874", treeLo: "#1d3d33",
};
/** A tiny seeded random, so the scenery (tufts, trees) stays put between layouts of the same size. */
function scatter(seed) { let a = seed >>> 0 || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

export class DepotRenderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.fx = [];
    this.tweens = new Map();  // vehicle -> { pts, t0, dur }
    this.bumps = new Map();   // vehicle -> { t0, dist } (a blocked vehicle nudging forward)
    this.flyIn = new Map();   // person -> { t0, from }
    this.shift = [];          // per stream: when its queue last stepped up
    this.hint = -1; this.hintT0 = 0;
    this.armed = null;        // a power that waits for a tap on a vehicle ("pick": Tow, "zap": Magnet)
    this.game = null;
    this.top = 64; this.bottom = 0;
    this.tickDT = 0.15;
    this.resize();
  }

  setGame(game) {
    this.game = game;
    this.clearFx();
    this.layout();
  }
  clearFx() { this.fx = []; this.tweens.clear(); this.bumps.clear(); this.flyIn.clear(); this.shift = []; this.hint = -1; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth || window.innerWidth;
    this.H = this.cv.clientHeight || window.innerHeight;
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.game) this.layout();
  }

  // ---- Layout ------------------------------------------------------------------------------------------------
  layout() {
    const g = this.game, W = this.W, pad = 12;
    const top = this.top, bot = this.H - (this.bottom || 0), avH = bot - top - 2 * pad;
    const wide = W > (bot - top) * 1.15;
    const nD = g.docks.length, short = !wide && avH < 560; // small phones: a narrower road, lower bays
    // The car park in its own units, with a road round it.
    const B = bounds(g.cars), margin = 0.45, road = short ? 0.6 : 0.95;
    const lw = B.x1 - B.x0 + 2 * margin, lh = B.y1 - B.y0 + 2 * margin;
    const colW = wide ? Math.min(Math.round(W * 0.5) - pad, 520) : W - 2 * pad;
    const bayW = Math.floor(clamp((Math.min(colW, 420) - (nD - 1) * 10) / nD, 38, 56)), bayH = Math.round(Math.min(bayW * 1.5, Math.max(54, avH * 0.13)));
    const baysH = bayH + 18; // the seat chips sit on the bays' lower edge, the road right under them
    let crowdH = Math.min(wide ? avH - baysH - 10 : clamp(Math.round(avH * 0.36), 130, 280), this.crowdNeed(colW)), u = 40, lotH = 0;
    const minCrowd = this.crowdMin(colW);
    for (let k = 0; k < 8; k++) {
      lotH = wide ? avH : avH - crowdH - baysH - 6;
      const lotW = wide ? W - colW - 3 * pad : W - 2 * pad;
      u = Math.min(lotW / (lw + 2 * road), lotH / (lh + 2 * road), 54);
      if (wide || u >= 30 || crowdH <= minCrowd) break;
      crowdH = Math.max(minCrowd, crowdH - 14);
    }
    u = Math.max(14, Math.floor(u));
    const lotPW = Math.round((lw + 2 * road) * u), lotPH = Math.round((lh + 2 * road) * u);
    let zx, zy, by, lx, ly;
    if (wide) {
      zx = pad + Math.max(0, Math.round((W - colW - lotPW - 3 * pad) / 2));
      zy = top + pad + Math.max(0, Math.round((avH - crowdH - 6 - baysH) / 2));
      by = zy + crowdH + 6;
      lx = zx + colW + pad * 2; ly = top + pad + Math.max(0, Math.round((avH - lotPH) / 2));
    } else {
      const stack = crowdH + 6 + baysH + lotPH;
      zx = pad; zy = top + pad + Math.max(0, Math.round((avH - stack) * 0.4));
      by = zy + crowdH + 6;
      lx = Math.round((W - lotPW) / 2); ly = by + baysH;
    }
    this.zone = { x: zx, y: zy, w: colW, h: crowdH };
    this.u = u;
    this.lotBox = { x: lx, y: ly, w: lotPW, h: lotPH };
    this.ox = lx + (road + margin - B.x0) * u;
    this.oy = ly + (road + margin - B.y0) * u;
    this.pad = { x: lx + road * u, y: ly + road * u, w: lw * u, h: lh * u };
    this.road = roundLoop(lx + road * u * 0.5, ly + road * u * 0.5, lotPW - road * u, lotPH - road * u, Math.min(road * u * 1.6, 40));
    this.roadW = road * u;
    // Bays, centred under the loop.
    const bw = nD * bayW + (nD - 1) * 10, bx = Math.round(zx + (colW - bw) / 2);
    this.slots = Array.from({ length: nD }, (_, i) => ({ x: bx + i * (bayW + 10), y: by, w: bayW, h: bayH, s: bayW }));
    this.baysBox = { x: bx, y: by, w: bw, h: baysH };
    // The street: the bus bays are lay-bys on its upper side, its lane runs just under them. On a phone
    // its lane is the top of the car park's ring road, running on across the screen; side by side, it
    // runs from the left edge to the ring road's left side (and up or down to meet it).
    const sy = by + baysH + this.roadW / 2, Rd = this.road;
    this.street = { y0: by - 4, y: sy, y1: by + baysH + this.roadW, x0: 0, x1: wide ? Rd.x : W, wide };
    this.join = wide ? [Rd.x, clamp(sy, Rd.y + Rd.r, Rd.y + Rd.h - Rd.r)] : null;
    this.layoutCrowd();
    this.paintStatic();
  }

  /** The loop's size (its middle line) for a crowd zone of width zw and height zh (the height it needs,
   *  if zh is left out). Around it: the streams' band on top, their lanes at the sides, half a walkway
   *  (edge) all round, and the crossing to the bays below. */
  loopSize(zw, zh = Infinity) {
    const g = this.game, sides = g.nS >= 2, band = GATES[g.nS].includes(0) ? 30 : 10, side = sides ? 36 : 10;
    const edge = 16, below = 22;
    const aw = zw - 2 * (side + edge), ah = Math.max(48, zh - band - 2 * edge - below);
    // About 10 px of walkway per spot (more on big screens): big enough people, and a crowd that looks
    // like a crowd.
    const len = g.R * clamp(zw / 34, 10.5, 14);
    const w = Math.min(aw, Math.max(180, len * 0.3));
    const h = clamp((len - 2 * w) / (Math.PI - 2), Math.min(96, ah), ah);
    return { w, h, band, side, sides, len, edge, below };
  }
  /** How tall the crowd zone needs to be (at most, and at least). */
  crowdNeed(zw) { const L = this.loopSize(zw); return Math.round(L.band + L.h + 2 * L.edge + L.below); }
  crowdMin(zw) { const L = this.loopSize(zw, 0); return Math.round(L.band + 48 + 2 * L.edge + L.below); }

  /** The loop and the streams inside the crowd zone. */
  layoutCrowd() {
    const g = this.game, Z = this.zone;
    const { band, side, sides, len, edge, below } = this.loopSize(Z.w, Z.h);
    const area = { x: Z.x + side + edge, y: Z.y + band + edge, w: Z.w - 2 * (side + edge), h: Z.h - band - 2 * edge - below };
    let { w, h } = this.loopSize(Z.w, Z.h);
    if (h >= area.h - 1) w = clamp((len - (Math.PI - 2) * h) / 2, w, area.w); // capped in height: longer instead
    const lx = Math.round(area.x + (area.w - w) / 2), ly = Math.round(area.y + Math.max(0, (area.h - h) / 2));
    this.loop = roundLoop(lx, ly, w, h, Math.min(h / 2, 64));
    const sp = this.loop.len / g.R;
    // A person's size: from the room per spot, but two files must fit in the loop's height.
    this.ps = clamp(Math.round(Math.min(sp * 1.8, (h * 0.72 - 6) / 2)), 11, 25);
    this.ww = this.ps * 2 + 6;                          // the walkway's width (two files)
    // Streams: paths from each gate outwards, the front of the queue first.
    const cx = lx + w / 2, cy = ly + h / 2, ty = Z.y + band / 2 + 2;
    const fr = GATES[g.nS];
    this.streams = fr.map((f) => {
      if (f === 0.75) return [[lx, cy], [Z.x + 16, cy], [Z.x + 16, Z.y + 16]];
      if (f === 0.25) return [[lx + w, cy], [Z.x + Z.w - 16, cy], [Z.x + Z.w - 16, Z.y + 16]];
      return [[cx, ly], [cx, ty], [sides ? Z.x + 44 : Z.x + 14, ty]];
    });
    this.streamLen = this.streams.map(polyLen);
  }

  // ---- Points ------------------------------------------------------------------------------------------------
  /** Screen point [x, y] of loop position p (fractional positions blend), in its file. */
  spot(p, i) {
    const [x, y, a] = this.loop.at(p / this.game.R);
    const off = (i % 2 ? 1 : -1) * (this.ps / 2 + 1);
    return [x - Math.sin(a) * off, y + Math.cos(a) * off];
  }
  stopPoint() { return this.loop.at(0.5); }
  toScreen(x, y) { return [this.ox + x * this.u, this.oy + y * this.u]; }
  carCenter(m) { const c = this.game.cars[this.game.carOf.get(m)]; return this.toScreen(c.x, c.y); }
  yardPoint(m) { return this.carCenter(m); }
  bayPoint(b) { const s = this.slots[b]; return [s.x + s.w / 2, s.y + s.h / 2]; }

  // ---- Effects, started by game.js from the engine's events --------------------------------------------------
  onLaunch(m, e, now) {
    const g = this.game, car = g.cars[e.car], [ux, uy] = HEAD[car.h];
    const c = this.toScreen(car.x, car.y), P = this.pad;
    // Straight ahead out of the car park, onto the road.
    let t = 0;
    while (t < 60) { const x = c[0] + ux * t, y = c[1] + uy * t; if (x < P.x - 4 || x > P.x + P.w + 4 || y < P.y - 4 || y > P.y + P.h + 4) break; t += 2; }
    const out = [c[0] + ux * t, c[1] + uy * t];
    // Round the ring road, the short way, to where it meets the street; along the street to the bay,
    // and up into it.
    const Rd = this.road, St = this.street, f0 = Rd.nearest(out[0], out[1]), s = this.slots[e.dock], bx = s.x + s.w / 2;
    const fJ = this.join ? Rd.nearest(this.join[0], this.join[1]) : Rd.nearest(clamp(bx, Rd.x + Rd.r, Rd.x + Rd.w - Rd.r), Rd.y);
    let df = fJ - f0;
    if (df > 0.5) df -= 1; else if (df < -0.5) df += 1;
    const pts = [c, out];
    const n = Math.ceil(Math.abs(df) * 60);
    for (let k = 0; k <= n; k++) { const p = Rd.at(f0 + (df * k) / Math.max(1, n)); pts.push([p[0], p[1]]); }
    if (this.join) pts.push([Rd.x, St.y]);
    pts.push([bx, St.y], [bx, s.y + s.h * 0.8], [bx, s.y + s.h / 2]);
    this.tweens.set(m, { pts, t0: now, dur: g.level.transit * this.tickDT });
    if (e.tow) this.burst(c[0], c[1], UI.glow, now, 16); // the tow truck pulled it out
  }
  onEnter(id, stream, now) {
    const q = this.streams[stream];
    this.flyIn.set(id, { t0: now, from: atDist(q, this.ps * 0.6) });
    this.shift[stream] = now;
  }
  /** Someone gets on. `e`: the event; the Magnet takes people from anywhere on the loop (e.spot) or
   *  out of a stream (e.stream, with e.queue people still in front of them); the rest board at the stop. */
  onBoard(m, id, dock, now, e = {}) {
    let [x, y] = this.stopPoint();
    if (e.spot != null) [x, y] = this.spot(this.game.posOf(e.spot), e.spot);
    else if (e.stream != null) {
      const qs = this.ps * 0.92, fit = Math.max(1, Math.floor((this.streamLen[e.stream] - qs * 0.5) / qs));
      [x, y] = atDist(this.streams[e.stream], (Math.min(e.queue, fit - 1) + 0.6) * qs);
    }
    this.fx.push({ kind: "hop", dock, x, y, t0: now, dur: 0.3, color: colorOf(this.game.personColor(id)), id });
  }
  onDepart(m, dock, now) {
    // Back out onto the street and drive off the screen along it.
    const s = this.slots[dock], x = s.x + s.w / 2, y = s.y + s.h / 2, ry = this.street.y;
    const right = !this.street.wide && x > this.W / 2;
    this.fx.push({ kind: "leave", m, pts: [[x, y], [x, ry], [right ? this.W + 60 : -60, ry]], t0: now, dur: 0.9, color: colorOf(this.game.color(m)), kindOf: kindOf(this.game.level.movers[m].cap) });
    this.burst(x, s.y, colorOf(this.game.color(m)), now, 12);
  }
  burst(x, y, color, now, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, v = 50 + Math.random() * 70;
      this.fx.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 200, t0: now, dur: 0.55, color, s: 4 });
    }
  }
  /** The level finishes itself (a sure win): fireworks over the crowd for `dur` seconds. */
  onCelebrate(now, dur) {
    const Z = this.zone;
    fireworks(this.fx, now, dur, () => [Z.x + 20 + Math.random() * (Z.w - 40), Z.y + 10 + Math.random() * Z.h * 0.7]);
  }
  onWin(now) {
    const L = this.loop, HEX = ["#e5484d", "#3d5fd6", "#ffcb3d", "#2f9e5f", "#f48bbd", "#8f52c9", "#f7802b", "#62b6f0"];
    for (let k = 0; k < 70; k++) {
      this.fx.push({ kind: "spark", x: L.x + Math.random() * L.w, y: L.y + Math.random() * L.h, vx: (Math.random() - 0.5) * 140, vy: -90 - Math.random() * 140, g: 300, t0: now + Math.random() * 0.3, dur: 1.2, color: HEX[k % HEX.length], s: 6 });
    }
  }
  /** A blocked vehicle drives up to what's in its way and back. */
  shake(m, now) {
    const g = this.game;
    if (g.where[m] !== YARD) return;
    const i = g.carOf.get(m), others = g.cars.filter((c, j) => j !== i && g.where[c.m] === YARD);
    this.bumps.set(m, { t0: now, dist: Math.min(reach(g.cars[i], others), 2.5) });
  }
  showHint(m, now) { this.hint = m; this.hintT0 = now; }

  busy(now) {
    if (this.armed) return true; // a power waits for a tap: keep it pulsing
    if (this.fx.some((f) => now < f.t0 + f.dur)) return true;
    for (const t of this.tweens.values()) if (now < t.t0 + t.dur) return true;
    for (const b of this.bumps.values()) if (now < b.t0 + 0.4) return true;
    for (const f of this.flyIn.values()) if (now < f.t0 + 0.25) return true;
    if (this.hint >= 0 && now < this.hintT0 + 4) return true;
    return false;
  }

  // ---- Hit testing -------------------------------------------------------------------------------------------
  /** What's under a tap: { m } a vehicle in the car park, or null. */
  hit(x, y) {
    const g = this.game, lx = (x - this.ox) / this.u, ly = (y - this.oy) / this.u;
    let best = null, bd = 0.75;
    for (const c of g.cars) {
      if (g.where[c.m] !== YARD) continue;
      if (inside(body(c), lx, ly, 0.12)) return { m: c.m };
      const d = Math.hypot(c.x - lx, c.y - ly);
      if (d < bd) { bd = d; best = c.m; }
    }
    return best == null ? null : { m: best };
  }

  // ---- Drawing -----------------------------------------------------------------------------------------------
  // What never moves (the plaza, the walkways, the road, the car park, the bays) is painted once per layout
  // onto a layer of its own; each frame copies it and draws the crowd and the vehicles on top.
  draw(frac, now) {
    const ctx = this.ctx, g = this.game;
    ctx.clearRect(0, 0, this.W, this.H);
    if (!g) return;
    if (this.bg) ctx.drawImage(this.bg, 0, 0, this.W, this.H);
    ctx.imageSmoothingEnabled = false;
    this.drawCrowdLive(frac);
    this.drawStreams(now);
    this.drawLoop(frac, now);
    this.drawBays();
    this.drawCars(now);
    this.drawFx(now);
    if (this.hint >= 0) this.drawHint(now);
    if (this.armed) this.drawArmed(now);
  }
  /** A pulsing gold frame round the car park while the Tow or Magnet power waits for a tap. */
  drawArmed(now) {
    const ctx = this.ctx, P = this.pad;
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(now * 6);
    ctx.strokeStyle = UI.glow; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -now * 30;
    ctx.beginPath(); rr(ctx, P.x - 6, P.y - 6, P.w + 12, P.h + 12, 18); ctx.stroke();
    ctx.restore();
  }

  /** Paint the layer of things that never move: the town (grass, roads, the car park, the plaza with the
   *  loop round its park, the queues, the bus stop). */
  paintStatic() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bg = this.bg || document.createElement("canvas");
    bg.width = Math.round(this.W * dpr); bg.height = Math.round(this.H * dpr);
    const main = this.ctx;
    this.ctx = bg.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.paintGround();
    this.paintLot();
    this.paintStreet();
    this.paintCrowd();
    this.paintBays();
    this.paintTrees();
    this.ctx = main;
    this.bg = bg;
  }

  /** Grass under everything between the HUD and the toolbar, with a few tufts. */
  paintGround() {
    const ctx = this.ctx, y0 = this.top, y1 = this.H - (this.bottom || 0), rnd = scatter(this.W * 7 + this.H);
    ctx.fillStyle = D.grass; ctx.fillRect(0, y0, this.W, y1 - y0);
    for (let k = Math.round((this.W * (y1 - y0)) / 900); k > 0; k--) {
      const x = Math.round(rnd() * this.W), y = Math.round(y0 + rnd() * (y1 - y0));
      ctx.fillStyle = rnd() < 0.5 ? D.grassHi : D.grassLo;
      ctx.fillRect(x, y, 2, 2); ctx.fillRect(x + 3, y - 2, 2, 2);
    }
  }

  /** A path of `w` pixels along a polyline (or the loop when `pts` is null), with kerbs and paving
   *  joints across it every `step` pixels. */
  paintPath(pts, w, step) {
    const ctx = this.ctx, L = this.loop;
    const trace = () => { ctx.beginPath(); if (pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); } else rr(ctx, L.x, L.y, L.w, L.h, L.r); };
    ctx.lineCap = pts ? "round" : "butt"; ctx.lineJoin = "round";
    trace(); ctx.strokeStyle = D.walkLo; ctx.lineWidth = w + 7; ctx.stroke();
    ctx.strokeStyle = D.walkEdge; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.strokeStyle = D.walk; ctx.lineWidth = w - 1; ctx.stroke();
    // Paving joints across the path.
    const len = pts ? polyLen(pts) : L.len;
    ctx.strokeStyle = D.walkJoint; ctx.lineWidth = 1.5; ctx.lineCap = "butt";
    ctx.beginPath();
    for (let d = step / 2; d < len; d += step) {
      let x, y, a;
      if (pts) { const p = atDist(pts, d), q = atDist(pts, Math.min(len, d + 1)); x = p[0]; y = p[1]; a = Math.atan2(q[1] - p[1], q[0] - p[0]) || 0; }
      else [x, y, a] = L.at(d / len);
      const nx = -Math.sin(a) * (w / 2 - 1), ny = Math.cos(a) * (w / 2 - 1);
      ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx, y + ny);
    }
    ctx.stroke();
  }

  paintCrowd() {
    const ctx = this.ctx, Z = this.zone, L = this.loop, ww = this.ww, St = this.street;
    // The plaza: paving from the crowd's zone down to the kerb of the street.
    const px = St.wide ? Z.x : Z.x - 4, pw = St.wide ? Z.w : Z.w + 8, py = Z.y, ph = St.y0 - Z.y;
    ctx.fillStyle = D.kerbLo; ctx.beginPath(); rr(ctx, px - 3, py - 3, pw + 6, ph + 3, 22); ctx.fill();
    ctx.fillStyle = D.pave; ctx.beginPath(); rr(ctx, px, py, pw, ph + 6, 20); ctx.fill();
    ctx.save(); ctx.beginPath(); rr(ctx, px, py, pw, ph, 20); ctx.clip();
    ctx.strokeStyle = D.paveJoint; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = px + 9; x < px + pw; x += 18) { ctx.moveTo(x + 0.5, py); ctx.lineTo(x + 0.5, py + ph); }
    for (let y = py + 9; y < py + ph; y += 18) { ctx.moveTo(px, y + 0.5); ctx.lineTo(px + pw, y + 0.5); }
    ctx.stroke();
    ctx.restore();
    // The park inside the loop: grass, and trees either side of the sign that counts who still waits.
    const inX = L.x + ww / 2 + 3, inY = L.y + ww / 2 + 3, inW = L.w - ww - 6, inH = L.h - ww - 6;
    if (inW > 10 && inH > 10) {
      ctx.fillStyle = D.grass; ctx.beginPath(); rr(ctx, inX, inY, inW, inH, Math.max(0, L.r - ww / 2 - 3)); ctx.fill();
      ctx.fillStyle = D.grassHi;
      const rnd = scatter(Math.round(inW * 13 + inH));
      for (let k = Math.round((inW * inH) / 500); k > 0; k--) ctx.fillRect(Math.round(inX + 8 + rnd() * (inW - 16)), Math.round(inY + 6 + rnd() * (inH - 12)), 2, 2);
      const r = clamp(inH * 0.26, 6, 15), sign = clamp(inH * 0.6, 12, 30) * 3.2, cx = L.x + L.w / 2, cy = L.y + L.h / 2;
      if (inH > 2 * r + 4) for (let x = cx + sign / 2 + r + 4; x < inX + inW - r - 6 - (inH < 60 ? r : 0); x += r * 2.6) { this.tree(x, cy + (Math.round(x) % 3 - 1) * r * 0.3, r); this.tree(2 * cx - x, cy - (Math.round(x) % 3 - 1) * r * 0.3, r); }
    }
    // The queues: paved lanes from the edge of the plaza to their gate, lined with posts and a rope.
    const qw = this.ps + 6;
    for (const q of this.streams) this.paintPath(q, qw, this.ps * 0.92);
    for (const q of this.streams) this.paintRopes(q, qw);
    // The loop: a paved walk round the park.
    this.paintPath(null, ww, this.loop.len / this.game.R);
    // The stop: a gold frame on the walk, and the bus stop sign beside it.
    const [sx, sy] = this.stopPoint();
    ctx.strokeStyle = UI.ink; ctx.lineWidth = 6;
    ctx.beginPath(); rr(ctx, sx - this.ps * 0.9, sy - ww / 2 - 2, this.ps * 1.8, ww + 4, 8); ctx.stroke();
    ctx.strokeStyle = D.stop; ctx.lineWidth = 3; ctx.stroke();
    const gx = Math.round(sx + this.ps * 0.9 + 10), gy = St.y0 - 3, top = Math.max(sy + ww / 2 + 4, gy - 22);
    if (gy - top > 8) {
      ctx.fillStyle = D.post; ctx.fillRect(gx - 1.5, top + 4, 3, gy - top - 4);
      ctx.fillStyle = UI.ink; ctx.beginPath(); ctx.arc(gx, top + 4, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = D.stop; ctx.beginPath(); ctx.arc(gx, top + 4, 4, 0, TAU); ctx.fill();
    }
  }
  /** Posts on both sides of a queue, with a rope between them. */
  paintRopes(pts, w) {
    const ctx = this.ctx, len = polyLen(pts), step = Math.max(16, this.ps * 1.4), off = w / 2 + 3;
    for (const side of [-1, 1]) {
      const posts = [];
      for (let d = this.ww / 2 + 4; d < len - 2; d += step) {
        const p = atDist(pts, d), q = atDist(pts, Math.min(len, d + 1)), a = Math.atan2(q[1] - p[1], q[0] - p[0]) || 0;
        posts.push([p[0] - Math.sin(a) * off * side, p[1] + Math.cos(a) * off * side]);
      }
      ctx.strokeStyle = D.rope; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); posts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 2) : ctx.moveTo(x, y - 2))); ctx.stroke();
      for (const [x, y] of posts) {
        ctx.fillStyle = D.post; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
        ctx.fillStyle = "#d9dcf7"; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 1.5, 1.5);
      }
    }
  }

  /** The ring road round the car park, and the car park itself: asphalt with a painted stall under every
   *  vehicle, so an empty stall shows where one stood. */
  paintLot() {
    const ctx = this.ctx, P = this.pad, Rd = this.road, rw = this.roadW;
    ctx.lineCap = "butt"; ctx.lineJoin = "round";
    ctx.beginPath(); rr(ctx, Rd.x, Rd.y, Rd.w, Rd.h, Rd.r);
    ctx.strokeStyle = D.kerbLo; ctx.lineWidth = rw + 8; ctx.stroke();
    ctx.strokeStyle = D.kerb; ctx.lineWidth = rw + 4; ctx.stroke();
    ctx.strokeStyle = D.road; ctx.lineWidth = rw; ctx.stroke();
    ctx.strokeStyle = D.markSoft; ctx.lineWidth = 2; ctx.setLineDash([9, 9]); ctx.stroke(); ctx.setLineDash([]);
    // The car park: a kerb, then asphalt.
    ctx.fillStyle = D.kerb; ctx.beginPath(); rr(ctx, P.x - 2, P.y - 2, P.w + 4, P.h + 4, 14); ctx.fill();
    ctx.fillStyle = D.lot; ctx.beginPath(); rr(ctx, P.x, P.y, P.w, P.h, 12); ctx.fill();
    // Stalls: the cells a vehicle stands on, lined along both sides and across the back (open at its
    // nose), so neighbours share their lines and an empty car park still looks like one.
    ctx.strokeStyle = D.stall; ctx.lineWidth = Math.max(1.5, this.u * 0.05); ctx.lineCap = "round";
    ctx.beginPath();
    for (const c of this.game.cars) {
      const b = body(c), k = corners({ ...b, hl: KINDS[c.kind].cells / 2 - 0.04, hw: 0.47 }).map(([x, y]) => this.toScreen(x, y));
      // corners: front-left, front-right, back-right, back-left (from the nose)
      ctx.moveTo(k[0][0], k[0][1]); ctx.lineTo(k[3][0], k[3][1]); ctx.lineTo(k[2][0], k[2][1]); ctx.lineTo(k[1][0], k[1][1]);
    }
    ctx.stroke();
  }

  /** The street with the bus bays: asphalt from the kerb under the plaza to the bottom of its lane. */
  paintStreet() {
    const ctx = this.ctx, St = this.street, Rd = this.road, rw = this.roadW;
    const x0 = St.x0 - 2, x1 = St.x1 + (St.wide ? rw / 2 : 2);
    ctx.fillStyle = D.kerbLo; ctx.fillRect(x0, St.y0 - 4, x1 - x0, St.y1 - St.y0 + 8);
    ctx.fillStyle = D.kerb; ctx.fillRect(x0, St.y0 - 2, x1 - x0, St.y1 - St.y0 + 4);
    if (St.wide && Math.abs(this.join[1] - St.y) > 1) { // up or down to meet the ring road
      const ya = Math.min(St.y, this.join[1]) - rw / 2, yb = Math.max(St.y, this.join[1]) + rw / 2;
      ctx.fillStyle = D.kerb; ctx.fillRect(Rd.x - rw / 2 - 2, ya, rw + 4, yb - ya);
      ctx.fillStyle = D.road; ctx.fillRect(Rd.x - rw / 2, ya, rw, yb - ya);
    }
    ctx.fillStyle = D.road; ctx.fillRect(x0, St.y0, x1 - x0, St.y1 - St.y0);
    // The lane's edge under the bays, and its centre line.
    ctx.strokeStyle = D.markSoft; ctx.lineWidth = 2;
    ctx.setLineDash([9, 9]); ctx.beginPath(); ctx.moveTo(x0, St.y + 0.5); ctx.lineTo(St.wide ? Rd.x : x1, St.y + 0.5); ctx.stroke(); ctx.setLineDash([]);
  }

  /** The bus stop: a yellow edge along the kerb, and a yellow box per bay, open to the street. */
  paintBays() {
    const ctx = this.ctx, S0 = this.slots[0], SN = this.slots[this.slots.length - 1], y0 = this.street.y0;
    ctx.fillStyle = D.stop; ctx.fillRect(S0.x - 10, y0 - 2, SN.x + SN.w - S0.x + 20, 3);
    for (const s of this.slots) {
      ctx.strokeStyle = D.stop; ctx.lineWidth = 2.5; ctx.lineCap = "square";
      ctx.beginPath(); ctx.moveTo(s.x, s.y + s.h); ctx.lineTo(s.x, s.y + 2); ctx.lineTo(s.x + s.w, s.y + 2); ctx.lineTo(s.x + s.w, s.y + s.h); ctx.stroke();
      // "BUS" written as three bars across the bay, faint, the way a bus box is marked on the road.
      ctx.fillStyle = "rgba(255,207,63,.16)";
      for (let k = 0; k < 3; k++) ctx.fillRect(s.x + s.w * 0.3, s.y + s.h * (0.3 + k * 0.17), s.w * 0.4, 3);
    }
  }

  /** Trees on the grass either side of the car park, where there is room. */
  paintTrees() {
    const B = this.lotBox, St = this.street, y1 = this.H - (this.bottom || 0) - 8, rnd = scatter(this.W * 3 + this.H * 5);
    if (St.wide) { // side by side: a row of trees under the street, and one over the plaza, where there is room
      const x1 = Math.min(this.road.x - this.roadW, St.x1) - 20, Z = this.zone;
      for (const [ya, yb] of [[St.y1 + 6, y1], [this.top + 4, Z.y - 6]]) {
        const r = Math.min(15, (yb - ya) / 2 - 3);
        if (r < 8) continue;
        for (let x = 20 + r; x < x1 - r; x += r * 2.6 + rnd() * r * 1.5) this.tree(x, (ya + yb) / 2 + (rnd() - 0.5) * Math.max(0, yb - ya - 2 * r - 6), r * (0.8 + rnd() * 0.25));
      }
      return;
    }
    const room = B.x - 4;
    if (room < 28) return;
    const r = Math.min(15, room / 2 - 3);
    for (const side of [0, 1]) {
      for (let y = St.y1 + r + 10; y < Math.min(y1, B.y + B.h + 40) - r; y += r * 2.4 + rnd() * r) {
        const x = side ? this.W - room / 2 : room / 2;
        this.tree(x + (rnd() - 0.5) * Math.max(0, room - 2 * r - 6), y, r * (0.8 + rnd() * 0.25));
      }
    }
  }
  /** A round tree from above, with its shadow. */
  tree(x, y, r) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r, 0, TAU); ctx.fill();
    ctx.fillStyle = D.treeLo; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = D.tree; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = D.treeHi; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU); ctx.fill();
  }

  /** The parts of the crowd zone that change: the chevrons walking with the crowd, and the count. */
  drawCrowdLive(frac) {
    const ctx = this.ctx, g = this.game, L = this.loop, ww = this.ww;
    const n = Math.floor(L.len / 34), off = ((g.ticks + frac) / g.R) * n;
    ctx.strokeStyle = "rgba(25,27,51,.2)"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [x, y, a] = L.at((i + (off % 1)) / n), c = Math.cos(a), s = Math.sin(a), q = 3.5;
      ctx.moveTo(x - c * q - s * q, y - s * q + c * q); ctx.lineTo(x, y); ctx.lineTo(x - c * q + s * q, y - s * q - c * q);
    }
    ctx.stroke();
    // The middle: how many people still wait for a ride.
    const cx = L.x + L.w / 2, cy = L.y + L.h / 2, inner = L.h - ww - 6;
    if (inner > 16) {
      const k = clamp(inner * 0.6, 12, 30), sw = k * 2.9;
      ctx.fillStyle = UI.ink; ctx.beginPath(); rr(ctx, cx - sw / 2, cy - k * 0.62, sw, k * 1.24, k * 0.4); ctx.fill();
      ctx.strokeStyle = D.walkEdge; ctx.lineWidth = 2; ctx.stroke();
      this.person(cx - k * 0.85, cy - k * 0.05, "#c9cdf5", 0, 0, k * 0.85, false);
      label(ctx, String(g.remaining), cx + k * 0.35, cy + 1, k);
    }
  }

  /** A person centred at (x, y), bobbing as they walk. All people come from one sprite sheet. */
  person(x, y, hex, now, id, size = this.ps, shadow = true) {
    const ctx = this.ctx, sheet = people(hex), w = size * 0.82, h = (w * PERSON.length) / PERSON[0].length;
    const bob = now ? Math.abs(Math.sin(now * 9 + id * 1.7)) * Math.max(1, size * 0.08) : 0;
    if (shadow) { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x - size * 0.36, y + size * 0.42, size * 0.72, Math.max(2, size * 0.12)); }
    ctx.drawImage(sheet.img, sheet.x, 0, PERSON[0].length, PERSON.length, Math.round(x - w / 2), Math.round(y - bob - h / 2), w, h);
  }

  drawStreams(now) {
    const g = this.game, ctx = this.ctx, qs = this.ps * 0.92;
    for (let j = 0; j < g.nS; j++) {
      const q = this.streams[j], L = this.streamLen[j], list = g.level.streams[j], gone = g.gone[j];
      const rem = g.waiting(j);
      if (rem <= 0) continue;
      const fit = Math.max(1, Math.floor((L - qs * 0.5) / qs));
      const t = this.shift[j] != null ? (now - this.shift[j]) / Math.min(0.3, this.tickDT * 1.6) : 1;
      const back = t < 1 ? 1 - ease(t) : 0;
      // Who shows, front first (skipping anyone the Magnet took).
      const shown = [];
      for (let i = g.fed[j]; i < list.length && shown.length < fit; i++) if (!gone[i]) shown.push(i);
      // A queue only shuffles while it moves up; standing still, it just breathes a little.
      for (let k = shown.length - 1; k >= 0; k--) {
        if (k === fit - 1 && rem > fit) continue;
        const [x, y] = atDist(q, (k + 0.6 + back) * qs), i = shown[k];
        this.person(x, y, colorOf(list[i]), t < 1 ? now : now * 0.25, i * g.nS + j);
      }
      if (rem > fit) {
        const [x, y] = atDist(q, (fit - 1 + 0.6) * qs);
        ctx.fillStyle = UI.ink; ctx.beginPath(); rr(ctx, x - 15, y - 10, 30, 20, 10); ctx.fill();
        label(ctx, "+" + (rem - fit + 1), x, y + 1, 13);
      }
    }
  }

  drawLoop(frac, now) {
    const g = this.game;
    // Back file first, so the front file stands in front.
    for (const file of [0, 1]) {
      for (let i = file; i < g.R; i += 2) {
        const id = g.ring[i];
        if (id < 0) continue;
        let [x, y] = this.spot(g.posOf(i) + frac, i);
        const f = this.flyIn.get(id);
        if (f) {
          const t = (now - f.t0) / 0.22;
          if (t < 1) { const e = ease(t); x = lerp(f.from[0], x, e); y = lerp(f.from[1], y, e) - Math.sin(t * Math.PI) * 6; }
          else this.flyIn.delete(id);
        }
        this.person(x, y, colorOf(g.personColor(id)), now, id);
      }
    }
  }

  /** Vehicles parked in the bays, each with a chip of the seats it has left. */
  drawBays() {
    const ctx = this.ctx, g = this.game;
    this.slots.forEach((s, b) => {
      const m = g.docks[b];
      if (m < 0) return;
      if (g.where[m] === DOCKED) this.vehicle(m, s.x + s.w / 2, s.y + s.h / 2, -Math.PI / 2, this.bayScale(m), false);
      const hex = colorOf(g.color(m)), cy = s.y + s.h + 2;
      ctx.fillStyle = shade(hex, -0.45); ctx.beginPath(); rr(ctx, s.x + 4, cy - 10, s.w - 8, 21, 9); ctx.fill();
      ctx.fillStyle = hex; ctx.beginPath(); rr(ctx, s.x + 4, cy - 11, s.w - 8, 19, 9); ctx.fill();
      label(ctx, String(g.left[m]), s.x + s.w / 2, cy - 1, 15);
    });
  }
  /** Pixels per car-park unit for a vehicle parked in a bay (a bus fills the bay's length). */
  bayScale() { return Math.min(this.slots[0].h * 0.9 / KINDS.bus.len, this.slots[0].w * 0.78 / KINDS.bus.wid); }

  drawCars(now) {
    const g = this.game;
    for (const c of g.cars) {
      if (g.where[c.m] !== YARD) continue;
      let [x, y] = this.toScreen(c.x, c.y);
      const bp = this.bumps.get(c.m);
      if (bp) {
        const t = (now - bp.t0) / 0.4;
        if (t < 1) { const k = Math.sin(Math.PI * Math.min(1, t * 1.25)) * bp.dist * this.u; x += HEAD[c.h][0] * k; y += HEAD[c.h][1] * k; }
        else this.bumps.delete(c.m);
      }
      this.vehicle(c.m, x, y, Math.atan2(HEAD[c.h][1], HEAD[c.h][0]), this.u, true);
    }
    // Vehicles on their way to a bay.
    for (const d of g.driving) {
      const tw = this.tweens.get(d.m), b = g.docks.indexOf(d.m);
      let x, y, a = -Math.PI / 2, sc = this.bayScale();
      if (tw && now < tw.t0 + tw.dur) {
        const t = ease((now - tw.t0) / tw.dur), p = alongH(tw.pts, t);
        x = p[0]; y = p[1]; if (p[2] != null) a = p[2];
        sc = lerp(this.u, sc, clamp(t * 1.4 - 0.4, 0, 1));
      } else [x, y] = this.bayPoint(b);
      this.vehicle(d.m, x, y, a, sc, false);
    }
  }

  /** Vehicle m centred at (x, y), heading `a`, at `scale` pixels per car-park unit. */
  vehicle(m, x, y, a, scale, arrow) {
    const ctx = this.ctx, g = this.game, kind = kindOf(g.level.movers[m].cap), K = KINDS[kind];
    const hex = colorOf(g.color(m)), img = sprite("veh-" + kind, VEHICLE[kind], hex);
    const len = K.len * scale, wid = K.wid * scale;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(-len / 2 + 2, -wid / 2 + 3, len, wid);
    ctx.imageSmoothingEnabled = Math.abs(Math.round(a / (Math.PI / 4))) % 2 === 1; // diagonals look better smoothed
    ctx.drawImage(img, -len / 2, -(img.height / img.width) * len / 2, len, (img.height / img.width) * len);
    ctx.imageSmoothingEnabled = false;
    if (arrow) {
      // An arrow on the roof: the way it will drive.
      const L = Math.min(len * 0.5, scale * 0.62), hw = Math.min(wid * 0.34, L * 0.42);
      ctx.beginPath();
      ctx.moveTo(L / 2, 0); ctx.lineTo(L / 2 - hw * 1.2, -hw); ctx.lineTo(L / 2 - hw * 1.2, -hw * 0.4); ctx.lineTo(-L / 2, -hw * 0.4);
      ctx.lineTo(-L / 2, hw * 0.4); ctx.lineTo(L / 2 - hw * 1.2, hw * 0.4); ctx.lineTo(L / 2 - hw * 1.2, hw); ctx.closePath();
      ctx.lineJoin = "round"; ctx.strokeStyle = UI.ink; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.fill();
    }
    ctx.restore();
  }

  drawFx(now) {
    const ctx = this.ctx, keep = [];
    for (const f of this.fx) {
      const t = (now - f.t0) / f.dur;
      if (t >= 1) continue;
      keep.push(f);
      if (t < 0) continue;
      if (f.kind === "hop") {
        // A person walks from the stop to their vehicle.
        const to = this.bayPoint(f.dock), e = ease(t);
        const x = lerp(f.x, to[0], e), y = lerp(f.y, to[1], e) - Math.sin(t * Math.PI) * 14;
        this.person(x, y, f.color, now, f.id, this.ps * (1 - 0.45 * t));
      } else if (f.kind === "spark") {
        const s = now - f.t0, x = f.x + f.vx * s, y = f.y + f.vy * s + 0.5 * (f.g || 0) * s * s;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = f.color;
        ctx.fillRect(Math.round(x - f.s / 2), Math.round(y - f.s / 2), Math.round(f.s), Math.round(f.s)); ctx.globalAlpha = 1;
      } else if (f.kind === "leave") {
        // A full vehicle backs onto the road and drives off.
        const p = alongH(f.pts, t * t), a = p[2] != null ? p[2] : -Math.PI / 2;
        const K = KINDS[f.kindOf], sc = this.bayScale(), len = K.len * sc, img = sprite("veh-" + f.kindOf, VEHICLE[f.kindOf], f.color);
        ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(t < 0.25 ? -Math.PI / 2 : a);
        ctx.drawImage(img, -len / 2, -(img.height / img.width) * len / 2, len, (img.height / img.width) * len);
        ctx.restore();
        if (t < 0.25) label(ctx, "✓", p[0], p[1], 18);
      }
    }
    this.fx = keep;
  }

  drawHint(now) {
    const g = this.game, m = this.hint, t = now - this.hintT0;
    if (t > 4 || g.where[m] !== YARD) { this.hint = -1; return; }
    const c = g.cars[g.carOf.get(m)], b = body(c), ctx = this.ctx, k = (2 + 2 * Math.sin(t * 7)) / this.u;
    const pts = corners({ ...b, hl: b.hl + 0.12 + k, hw: b.hw + 0.12 + k }).map(([x, y]) => this.toScreen(x, y));
    ctx.globalAlpha = Math.min(1, 4 - t);
    ctx.lineJoin = "round";
    for (const [col, lw] of [[UI.ink, 7], [UI.glow, 4]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

