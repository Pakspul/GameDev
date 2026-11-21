// Drawing Loopline on a 2D canvas, in a chunky pixel style: the picture as little voxel blocks on a
// dark board, the loop as a light rail with running chevrons, the critters and buses as pixel sprites.
// Nothing here changes the game; game.js calls draw() only while something moves, so an idle board
// costs no battery.
//
// Critters: picture with the track round it, the bays under it, the lanes under those.
// Depot:    picture with the ring of trays round it, the stop and its docks under it, the car park under those.
import { PALETTE } from "./config.js";
import { DIRS, BAY, YARD, carCells } from "./engine.js";
import { DOCKED } from "./depot.js";

const TAU = Math.PI * 2;
const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FONT = '"Lilita One", "Baloo 2", system-ui, sans-serif';

/** A colour a bit darker (amt < 0) or lighter (amt > 0). */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  r = f(r); g = f(g); b = f(b);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const HEX = PALETTE.map((p) => p.hex);
const colorOf = (c) => HEX[c - 1];

const UI = {
  panel: "#262a55", panelEdge: "#454b96", panelLip: "#1a1d3f",
  plate: "#1a1d3e", hole: "#22264c",
  rail: "#b4b9e4", railEdge: "#6f76bb", railIn: "#9aa0d4", chevron: "#e3e6ff",
  slot: "#1c2045", slotEdge: "#3c4288",
  lot: "#2c3160", lotEdge: "#40468c", lotLine: "rgba(255,255,255,.18)",
  lane: "#2a2f5c", ink: "#191b33", glow: "#ffe45c",
};

// ---- Pixel sprites -------------------------------------------------------------------------------------------
// Letters: o outline, b body, h light, s shade, w white, k black, p cheek, g glass, G glass shine.
const CRITTER = [
  "..oo........oo..",
  ".obbo......obbo.",
  ".obhboooooobbbo.",
  "obhhbbbbbbbbbbbo",
  "obhbbbbbbbbbbbbo",
  "obbwwkbbbbwwkbbo",
  "obbwkkbbbbwkkbbo",
  "obbbbbbbbbbbbbbo",
  "obpbbbbbbbbbbpbo",
  "obbbbbbbbbbbbbso",
  "obbbbbbbbbbbbbso",
  ".osbbbbbbbbbbso.",
  "..osssssssssso..",
  "...oo......oo...",
];
const HIDDEN = CRITTER.map((r) => r.replace(/[wkp]/g, "b"));

/** A bus from above, nose to the right: 17 or 30 pixels long, 13 wide (wheels included). */
function busRows(len) {
  const L = len === 2 ? 30 : 17, H = 13, rows = [];
  const wheels = len === 2 ? [3, 4, 5, 6, L - 9, L - 8, L - 7, L - 6] : [3, 4, 5, L - 6, L - 5, L - 4];
  for (let y = 0; y < H; y++) {
    let r = "";
    for (let x = 0; x < L; x++) {
      let ch;
      if (y === 0 || y === H - 1) ch = wheels.includes(x) ? "k" : ".";
      else if ((x === 0 || x === L - 1) && (y === 1 || y === H - 2)) ch = ".";
      else if (x === 0 || x === L - 1 || y === 1 || y === H - 2) ch = "o";
      else if (x >= L - 5 && x <= L - 4 && y >= 3 && y <= H - 4) ch = y === 3 ? "G" : "g";
      else if (x === L - 2 && (y === 2 || y === H - 3)) ch = "w";
      else if (x === 2 && y >= 4 && y <= H - 5) ch = "g";
      else if (y === 2 || y === H - 3) ch = "s";
      else if (y >= 5 && y <= H - 6 && x >= 4 && x <= L - 8) ch = (x - 4) % 5 === 4 ? "s" : "h";
      else ch = "b";
      r += ch;
    }
    rows.push(r);
  }
  return rows;
}
const BUS = { 1: busRows(1), 2: busRows(2) };

const sprites = new Map();
function sprite(key, rows, hex) {
  const id = key + hex;
  let c = sprites.get(id);
  if (c) return c;
  const map = {
    o: shade(hex, -0.62), b: hex, h: shade(hex, 0.38), s: shade(hex, -0.24), w: "#ffffff", k: "#16182c",
    p: shade(hex, 0.55), g: "#28356a", G: "#8ea6ec",
  };
  c = document.createElement("canvas");
  c.width = rows[0].length; c.height = rows.length;
  const x = c.getContext("2d");
  rows.forEach((row, y) => { for (let i = 0; i < row.length; i++) if (row[i] !== ".") { x.fillStyle = map[row[i]]; x.fillRect(i, y, 1, 1); } });
  sprites.set(id, c);
  return c;
}
/** Draw a sprite centred at the origin, `size` px wide. */
function blit(ctx, img, size) {
  const k = size / img.width, w = img.width * k, h = img.height * k;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}

/** A voxel: a square with a light top-left and a dark bottom-right edge. (x, y) is its centre. */
function voxel(ctx, x, y, s, hex) {
  const e = Math.max(1, Math.round(s * 0.16)), x0 = Math.round(x - s / 2), y0 = Math.round(y - s / 2), S = Math.round(s);
  ctx.fillStyle = shade(hex, -0.34); ctx.fillRect(x0, y0, S, S);
  ctx.fillStyle = hex; ctx.fillRect(x0, y0, S - e, S - e);
  ctx.fillStyle = shade(hex, 0.34); ctx.fillRect(x0, y0, S - e, e);
  ctx.fillStyle = shade(hex, 0.16); ctx.fillRect(x0, y0 + e, e, S - 2 * e);
}

/** A number in white with a dark outline (the game's font). */
function label(ctx, text, x, y, size) {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2.5, size * 0.24);
  ctx.strokeStyle = UI.ink;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function along(pts, t) {
  if (pts.length === 1) return pts[0];
  const seg = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
  let d = t * tot;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, d / seg[i]) : 1; return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

/** A rounded rectangle as a closed polyline from the middle of its top-left corner, clockwise, with
 *  lengths, so a fraction of a lap can be turned into a point and a heading. */
function loopPath(x, y, w, h, r) {
  const pts = [];
  const arc = (cx, cy, a0) => { for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  // From the top-left arc's middle: the rest of that arc, then each side and corner.
  for (let k = 4; k <= 8; k++) { const a = Math.PI + (k / 8) * (Math.PI / 2); pts.push([x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]); }
  arc(x + w - r, y + r, -Math.PI / 2);
  arc(x + w - r, y + h - r, 0);
  arc(x + r, y + h - r, Math.PI / 2);
  for (let k = 0; k <= 4; k++) { const a = Math.PI + (k / 8) * (Math.PI / 2); pts.push([x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]); }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  return {
    len,
    /** [x, y, heading] at fraction f of the lap. */
    at(f) {
      let d = (((f % 1) + 1) % 1) * len, i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const a = pts[i - 1], b = pts[i], s = cum[i] - cum[i - 1] || 1, t = (d - cum[i - 1]) / s;
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0])];
    },
  };
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.fx = [];
    this.ghosts = new Map();  // Critters: cell -> { until, color } (shows until the pellet lands)
    this.tweens = new Map();  // mover -> { pts, t0, dur }
    this.shakes = new Map();  // mover -> t0
    this.flyIn = new Map();   // Depot: cell -> { t0, from } (a pixel on its way to the ring)
    this.hint = -1; this.hintT0 = 0;
    this.game = null;
    this.top = 64; this.bottom = 0;
    this.resize();
  }

  setGame(game, mode) {
    this.game = game; this.mode = mode;
    this.clearFx();
    this.layout();
  }
  clearFx() { this.fx = []; this.ghosts.clear(); this.tweens.clear(); this.shakes.clear(); this.flyIn.clear(); this.hint = -1; }

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
    const g = this.game, lv = g.level, W = this.W, depot = this.mode === "depot";
    const top = this.top, bot = this.H - (this.bottom || 0), pad = 14, avH = bot - top - 2 * pad;
    const wide = W > (bot - top) * 1.15;
    const compact = !wide && avH < 560; // small phones: tighter everything
    const rail = compact ? 16 : 20, Gmin = compact ? 16 : 22;
    const nS = depot ? g.docks.length : g.bays.length; // the Extra bay power can add one
    const slotS = compact ? 44 : depot ? 58 : 54, slotGap = compact ? 8 : 10;
    // Gaps: board to slots (the stop's crossing in Depot), slots to yard.
    const gap1 = depot ? (compact ? 26 : 34) : compact ? 12 : 18, gap2 = compact ? 14 : 24;
    // The yard: lanes of critters or the car park. It gives up room if the picture would get too small.
    let cols, rows, cellY, rowH, yardW, yardH, cs = 30, G = 26;
    if (depot) { cols = lv.lot.w; rows = lv.lot.h; }
    else { cols = lv.lanes.length; rows = 4; }
    const yardMaxW = wide ? W * 0.4 - pad : W - 2 * pad - 12;
    const yardMaxH = wide ? avH - 20 : avH * (depot ? 0.36 : 0.3);
    for (let shrink = 1, k = 0; k < 12; k++, shrink *= 0.9) {
      if (depot) { cellY = Math.floor(Math.min(wide ? 60 : 50, yardMaxW / cols, (yardMaxH * shrink) / rows)); rowH = cellY; }
      else { cellY = Math.floor(Math.min(86, yardMaxW / cols)); rowH = Math.floor(Math.min(64, (yardMaxH * shrink) / rows)); }
      yardW = cellY * cols; yardH = rowH * rows;
      // The picture gets the rest. G: picture edge to the middle of the rail. The extra bit is what the
      // docks' pavement and the car park's frame stick out.
      const gaps = gap1 + (wide ? 0 : gap2) + (depot ? 12 : 8);
      const boardW = wide ? W - yardW - 4 * pad - 60 : W - 2 * pad;
      const boardH = wide ? avH - slotS - gaps : avH - yardH - slotS - gaps;
      for (let j = 0; j < 3; j++) {
        const ringOut = 2 * (G + rail / 2 + 6);
        cs = Math.floor(Math.min((boardW - ringOut) / lv.w, (boardH - ringOut) / lv.h));
        G = clamp(Math.round(cs * 1.15), Gmin, 32);
      }
      if (wide || cs >= 9 || (depot ? cellY <= 26 : rowH <= 36)) break;
    }
    cs = clamp(cs, 6, 30);
    this.cellY = cellY; this.rowH = rowH;
    const pw = cs * lv.w, ph = cs * lv.h, ring = G + rail / 2 + 6; // picture edge to the outside of the board
    const sw = nS * slotS + (nS - 1) * slotGap;
    let px, py, sx, sy, yx, yy;
    if (wide) {
      // Board and yard side by side, centred as one group.
      const colW = Math.max(pw + 2 * ring, sw + 24), between = 48;
      const gx = Math.max(pad, Math.round((W - colW - between - yardW - 12) / 2));
      const stack = 2 * ring + ph + gap1 + slotS;
      const y0 = top + pad + Math.max(0, (avH - stack) / 2);
      px = Math.round(gx + (colW - pw) / 2); py = Math.round(y0 + ring);
      sy = Math.round(py + ph + ring + gap1);
      yx = Math.round(gx + colW + between + 10); yy = Math.round(top + pad + Math.max(0, (avH - yardH) / 2));
    } else {
      const stack = 2 * ring + ph + gap1 + slotS + gap2 + yardH;
      const y0 = top + pad + Math.max(0, (avH - stack) * 0.4);
      px = Math.round((W - pw) / 2); py = Math.round(y0 + ring);
      sy = Math.round(py + ph + ring + gap1);
      yy = sy + slotS + gap2; yx = Math.round((W - yardW) / 2);
    }
    Object.assign(this, { cs, px, py, pw, ph, G, rail, wide, compact, ringOut: ring });
    this.path = loopPath(px - G, py - G, pw + 2 * G, ph + 2 * G, Math.min(G, 24));
    // Slots (bays or docks), centred under the board, or under the stop in Depot.
    let cx = px + pw / 2;
    if (depot) cx = this.ringPoint(g.stop)[0];
    sx = clamp(Math.round(cx - sw / 2), pad, W - pad - sw);
    if (wide) sx = clamp(Math.round(cx - sw / 2), pad, Math.max(pad, px + pw + ring - sw));
    this.slots = Array.from({ length: nS }, (_, i) => ({ x: sx + i * (slotS + slotGap), y: sy, s: slotS }));
    this.yard = { x: yx, y: yy, w: yardW, h: yardH };
    this.moverSize = clamp(cs * 1.7, compact ? 22 : 26, 38);
  }

  // ---- Points ------------------------------------------------------------------------------------------------
  /** Critters: screen point of a track step (fractional steps blend). */
  trackPoint(pos) {
    const T = this.game.track, L = T.length;
    const p0 = Math.floor(pos), f = pos - p0;
    const a = this.stepPoint(T[((p0 % L) + L) % L]), b = this.stepPoint(T[(p0 + 1) % L]);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }
  stepPoint(t) {
    const { px, py, pw, ph, cs, G } = this;
    let x = t.x < 0 ? px - G : t.x >= this.game.w ? px + pw + G : px + (t.x + 0.5) * cs;
    let y = t.y < 0 ? py - G : t.y >= this.game.h ? py + ph + G : py + (t.y + 0.5) * cs;
    if (!t.line) { // corners: onto the rounded rail
      const r = Math.min(G, 24) * (1 - Math.SQRT1_2);
      x += t.x < 0 ? r : -r; y += t.y < 0 ? r : -r;
    }
    return [x, y];
  }
  /** Depot: screen point [x, y, heading] of ring position p (fractional positions blend). */
  ringPoint(p) { return this.path.at(p / this.game.R); }
  cellPoint(i) {
    const w = this.game.w;
    return [this.px + ((i % w) + 0.5) * this.cs, this.py + (Math.floor(i / w) + 0.5) * this.cs];
  }
  entrance() { return this.stepPoint(this.game.track[0]); }
  bayPoint(b) { const s = this.slots[b]; return [s.x + s.s / 2, s.y + s.s / 2]; }
  /** Where mover m stands in the yard now (lane slot or parked bus). */
  yardPoint(m) {
    const g = this.game, Y = this.yard;
    if (g.lanes) {
      for (let k = 0; k < g.lanes.length; k++) {
        const i = g.lanes[k].indexOf(m);
        if (i >= 0) return [Y.x + (k + 0.5) * this.cellY, Y.y + (i + 0.5) * this.rowH];
      }
      return [Y.x + Y.w / 2, Y.y];
    }
    return this.carCenter(g.cars[g.carOf.get(m)]);
  }
  carCenter(car) {
    const cells = carCells(car), c = this.cellY;
    const xs = cells.map((p) => p[0]), ys = cells.map((p) => p[1]);
    return [this.yard.x + ((Math.min(...xs) + Math.max(...xs)) / 2 + 0.5) * c, this.yard.y + ((Math.min(...ys) + Math.max(...ys)) / 2 + 0.5) * c];
  }

  // ---- Effects, started by game.js from the engine's events --------------------------------------------------
  onLaunch(m, e, now) {
    const g = this.game;
    if (this.mode === "depot") {
      const car = g.cars[e.from.car], [dx, dy] = DIRS[car.dir], c = this.carCenter(car), Y = this.yard;
      const ex = dx ? (dx > 0 ? Y.x + Y.w + 18 : Y.x - 18) : c[0], ey = dy ? (dy > 0 ? Y.y + Y.h + 18 : Y.y - 18) : c[1];
      const d = this.bayPoint(e.dock), s = this.slots[e.dock];
      const pts = [c, [ex, ey]];
      // Round the car park's side, then up to the dock.
      if (ey > Y.y + Y.h) pts.push([ex < Y.x + Y.w / 2 ? Y.x - 18 : Y.x + Y.w + 18, ey]);
      const side = pts[pts.length - 1][0];
      pts.push([side, s.y + s.s + 14], [d[0], s.y + s.s + 14], d);
      this.tweens.set(m, { pts, t0: now, dur: g.level.transit * this.tickDT });
      return;
    }
    let pts;
    if (e.from.bay != null) pts = [this.bayPoint(e.from.bay)];
    else pts = [[this.yard.x + (e.from.lane + 0.5) * this.cellY, this.yard.y + ((e.from.row || 0) + 0.5) * this.rowH]];
    pts.push(this.entrance());
    this.tweens.set(m, { pts, t0: now, dur: 0.3 });
  }
  onTake(m, cell, now, pos) {
    const at = this.trackPoint(pos), color = colorOf(this.game.color(m));
    const [cx, cy] = this.cellPoint(cell);
    this.ghosts.set(cell, { until: now + 0.12, color: this.game.color(m) });
    this.fx.push({ kind: "pellet", x0: at[0], y0: at[1], x: cx, y: cy, t0: now, dur: 0.12, color });
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * TAU, v = 40 + Math.random() * 60;
      this.fx.push({ kind: "spark", x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: now + 0.12, dur: 0.4, color, s: Math.max(3, this.cs * 0.32) });
    }
  }
  onEnter(cell, now) { this.flyIn.set(cell, { t0: now, from: this.cellPoint(cell) }); }
  onBoard(m, cell, dock, now, at) {
    const color = colorOf(this.game.level.cells[cell]);
    this.fx.push({ kind: "hop", dock, x: at[0], y: at[1], t0: now, dur: 0.28, color });
  }
  onPark(m, bay, now) {
    const e = this.entrance();
    this.tweens.set(m, { pts: [e, this.bayPoint(bay)], t0: now, dur: 0.35 });
  }
  onDone(m, now) {
    const [x, y] = this.entrance(), color = colorOf(this.game.color(m));
    this.fx.push({ kind: "ring", x, y, t0: now, dur: 0.35, color });
    this.burst(x, y, color, now, 10);
  }
  onDepart(m, dock, now) {
    const [x, y] = this.bayPoint(dock), color = colorOf(this.game.color(m));
    const len = this.game.level.movers[m].cap >= 8 ? 2 : 1;
    this.fx.push({ kind: "busOut", m, x, y, len, t0: now, dur: 0.55, color, to: this.W + 60 });
    this.burst(x, y - 10, color, now, 12);
  }
  burst(x, y, color, now, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, v = 50 + Math.random() * 70;
      this.fx.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 200, t0: now, dur: 0.55, color, s: 4 });
    }
  }
  onWin(now) {
    const { px, py, pw, ph } = this;
    for (let k = 0; k < 70; k++) {
      const color = HEX[Math.floor(Math.random() * 10)];
      this.fx.push({ kind: "spark", x: px + Math.random() * pw, y: py + Math.random() * ph, vx: (Math.random() - 0.5) * 140, vy: -90 - Math.random() * 140, g: 300, t0: now + Math.random() * 0.3, dur: 1.2, color, s: 6 });
    }
  }
  shake(m, now) { this.shakes.set(m, now); }
  showHint(m, now) { this.hint = m; this.hintT0 = now; }

  busy(now) {
    if (this.armed) return true; // a power waits for a tap: keep it pulsing
    if (this.fx.some((f) => now < f.t0 + f.dur)) return true;
    for (const t of this.tweens.values()) if (now < t.t0 + t.dur) return true;
    for (const t0 of this.shakes.values()) if (now < t0 + 0.4) return true;
    for (const f of this.flyIn.values()) if (now < f.t0 + 0.25) return true;
    if (this.hint >= 0 && now < this.hintT0 + 4) return true;
    return false;
  }

  // ---- Hit testing -------------------------------------------------------------------------------------------
  /** What's under a tap: { m } a mover to send, or null. `any` (the Pick power): any critter in a
   *  lane, not just the front one. */
  hit(x, y, any = false) {
    const g = this.game;
    if (this.mode !== "depot") {
      for (let b = 0; b < this.slots.length; b++) {
        const s = this.slots[b];
        if (g.bays[b] >= 0 && x >= s.x - 4 && x <= s.x + s.s + 4 && y >= s.y - 4 && y <= s.y + s.s + 4) return { m: g.bays[b] };
      }
    }
    const Y = this.yard;
    if (x < Y.x - 6 || x > Y.x + Y.w + 6 || y < Y.y - 6 || y > Y.y + Y.h + 6) return null;
    if (g.lanes) {
      const k = clamp(Math.floor((x - Y.x) / this.cellY), 0, g.lanes.length - 1);
      const lane = g.lanes[k], rows = Math.round(Y.h / this.rowH);
      if (!lane.length) return null;
      if (any) {
        const i = clamp(Math.floor((y - Y.y) / this.rowH), 0, rows - 1);
        if (i < lane.length && !(i === rows - 1 && lane.length > rows)) return { m: lane[i], lane: k };
      }
      return { m: lane[0], lane: k };
    }
    const lw = g.level.lot.w;
    const cx = Math.floor((x - Y.x) / this.cellY), cy = Math.floor((y - Y.y) / this.cellY);
    if (cx < 0 || cy < 0 || cx >= lw || cy >= g.level.lot.h) return null;
    const i = g.occ[cy * lw + cx];
    return i >= 0 ? { m: g.cars[i].m } : null;
  }

  // ---- Drawing -----------------------------------------------------------------------------------------------
  draw(frac, now) {
    const ctx = this.ctx, g = this.game;
    ctx.clearRect(0, 0, this.W, this.H);
    if (!g) return;
    const depot = this.mode === "depot";
    this.drawBoard(now, frac);
    this.drawPicture(now);
    if (depot) { this.drawDoors(now); this.drawStop(); }
    this.drawSlots(now);
    this.drawYard(now);
    if (depot) this.drawRing(frac, now);
    else {
      g.queue.forEach((m, i) => { const e = this.entrance(); this.drawMover(m, [e[0] - 4 - i * 8, e[1] + 26], now, "queue"); });
      for (const b of g.belt) this.drawMover(b.m, this.trackPoint(Math.min(b.pos + frac, g.L)), now, "belt");
    }
    this.drawFx(now);
    if (this.hint >= 0) this.drawHint(now);
  }

  drawBoard(now, frac) {
    const ctx = this.ctx, { px, py, pw, ph, G, rail, ringOut } = this;
    // The board panel.
    const bx = px - ringOut, by = py - ringOut, bw = pw + 2 * ringOut, bh = ph + 2 * ringOut;
    ctx.fillStyle = UI.panelLip;
    ctx.beginPath(); rr(ctx, bx, by + 5, bw, bh, 22); ctx.fill();
    ctx.fillStyle = UI.panel; ctx.strokeStyle = UI.panelEdge; ctx.lineWidth = 2.5;
    ctx.beginPath(); rr(ctx, bx, by, bw, bh, 22); ctx.fill(); ctx.stroke();
    // The rail.
    const x = px - G, y = py - G, w = pw + 2 * G, h = ph + 2 * G, r = Math.min(G, 24);
    ctx.beginPath(); rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = UI.railEdge; ctx.lineWidth = rail + 5; ctx.stroke();
    ctx.strokeStyle = UI.rail; ctx.lineWidth = rail; ctx.stroke();
    ctx.strokeStyle = UI.railIn; ctx.lineWidth = rail - 10; ctx.stroke();
    // Chevrons that run while the loop runs.
    const g = this.game, running = this.mode === "depot" ? !g.idle : g.belt.length > 0;
    const step = 26, n = Math.floor(this.path.len / step);
    const off = this.mode === "depot" ? (running ? ((g.ticks + frac) / g.R) * (this.path.len / step) : (g.ticks / g.R) * (this.path.len / step)) : (running ? now * 2.2 : 0);
    ctx.strokeStyle = UI.chevron; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const [cx, cy, a] = this.path.at((k + (off % 1)) / n);
      const c = Math.cos(a), s = Math.sin(a), L = 4;
      ctx.moveTo(cx - c * L - s * L, cy - s * L + c * L); ctx.lineTo(cx, cy); ctx.lineTo(cx - c * L + s * L, cy - s * L - c * L);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawPicture(now) {
    const ctx = this.ctx, g = this.game, { px, py, pw, ph, cs } = this;
    ctx.fillStyle = UI.plate;
    ctx.beginPath(); rr(ctx, px - 5, py - 5, pw + 10, ph + 10, 8); ctx.fill();
    const s = cs >= 10 ? cs - 1 : cs;
    // Holes where pixels have gone.
    ctx.fillStyle = UI.hole;
    for (let i = 0; i < g.cells.length; i++) {
      if (g.level.cells[i] && !g.cells[i] && !this.ghosts.has(i)) { const [x, y] = this.cellPoint(i); ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.round(s), Math.round(s)); }
    }
    for (let i = 0; i < g.cells.length; i++) {
      let c = g.cells[i];
      const gh = this.ghosts.get(i);
      if (!c && gh) { if (now < gh.until) c = gh.color; else this.ghosts.delete(i); }
      if (!c) continue;
      const [x, y] = this.cellPoint(i);
      voxel(ctx, x, y, s, colorOf(c));
    }
  }

  // ---- Depot -------------------------------------------------------------------------------------------------
  /** The two doors (chutes from the picture's sides onto the ring) and the next pixel out of each. */
  drawDoors(now) {
    const ctx = this.ctx, g = this.game, { px, pw, cs } = this;
    const pulse = 0.55 + 0.45 * Math.sin(now * 6);
    for (let side = 0; side < 2; side++) {
      const [dx, dy] = this.ringPoint(g.doors[side]);
      const edge = side === 0 ? px - 5 : px + pw + 5;
      ctx.fillStyle = UI.plate;
      ctx.fillRect(Math.min(edge, dx), dy - cs * 0.6, Math.abs(dx - edge), cs * 1.2);
      ctx.fillStyle = UI.chevron; ctx.globalAlpha = 0.6;
      const dir = side === 0 ? -1 : 1, mx = (edge + dx) / 2;
      ctx.beginPath(); ctx.moveTo(mx - dir * 4, dy - 5); ctx.lineTo(mx + dir * 3, dy); ctx.lineTo(mx - dir * 4, dy + 5); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // The next pixels to leave this side: the very next one pulses, the few after it are marked.
      const q = g.feeds[side], k = g.fed[side];
      if (g.status !== "play") continue;
      for (let j = Math.min(q.length - 1, k + 3); j >= k; j--) {
        const [x, y] = this.cellPoint(q[j]);
        ctx.strokeStyle = j === k ? `rgba(255,255,255,${pulse})` : `rgba(255,255,255,${0.42 - (j - k) * 0.11})`;
        ctx.lineWidth = j === k ? 2.5 : 1.5;
        ctx.strokeRect(Math.round(x - cs / 2) + 1, Math.round(y - cs / 2) + 1, cs - 2, cs - 2);
      }
    }
  }

  /** The stop under the ring: a gold frame on the rail, a crossing down to the kerb, and the docks' pavement. */
  drawStop() {
    const ctx = this.ctx, g = this.game;
    const [x, y] = this.ringPoint(g.stop);
    const s0 = this.slots[0], sN = this.slots[this.slots.length - 1];
    const left = s0.x - 12, w = sN.x + sN.s - s0.x + 24, top = s0.y - 14;
    // Pavement behind the docks, with a gold kerb.
    ctx.fillStyle = UI.panelLip;
    ctx.beginPath(); rr(ctx, left, top + 5, w, s0.s + 24, 16); ctx.fill();
    ctx.fillStyle = "#353a78";
    ctx.beginPath(); rr(ctx, left, top, w, s0.s + 24, 16); ctx.fill();
    ctx.fillStyle = "#ffcf3f";
    ctx.beginPath(); rr(ctx, left, top, w, 5, 3); ctx.fill();
    // A zebra crossing from the stop to the kerb.
    const y0 = y + this.rail / 2 + 3;
    for (let yy = y0, k = 0; yy < top - 1; yy += 5, k++) {
      ctx.fillStyle = k % 2 ? UI.panelLip : "#e3e6ff";
      ctx.fillRect(Math.round(x - 10), Math.round(yy), 20, Math.min(5, top - 1 - yy));
    }
    // The stop on the rail.
    ctx.strokeStyle = UI.ink; ctx.lineWidth = 6;
    ctx.beginPath(); rr(ctx, x - 14, y - 14, 28, 28, 7); ctx.stroke();
    ctx.strokeStyle = "#ffcf3f"; ctx.lineWidth = 3;
    ctx.stroke();
    // The sign on its post.
    const sx = x + 30, sy = y + 24;
    ctx.fillStyle = UI.ink; ctx.fillRect(sx - 2.5, sy - 8, 5, 22);
    ctx.fillStyle = "#c9cdf5"; ctx.fillRect(sx - 1, sy - 8, 2, 21);
    ctx.fillStyle = "#ffcf3f"; ctx.strokeStyle = UI.ink; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(sx, sy - 12, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = UI.ink; ctx.fillRect(sx - 5, sy - 14, 10, 4);
  }

  drawRing(frac, now) {
    const ctx = this.ctx, g = this.game, R = g.R;
    const gapPx = this.path.len / R;
    const s = clamp(Math.min(this.cs * 0.95, gapPx * 0.78), 8, 20);
    const moving = !g.idle;
    for (let i = 0; i < R; i++) {
      const p = g.posOf(i) + (moving ? frac : 0);
      const [x, y] = this.ringPoint(p);
      ctx.fillStyle = UI.slot; ctx.globalAlpha = 0.55;
      ctx.fillRect(Math.round(x - s / 2 - 2), Math.round(y - s / 2 - 2), Math.round(s + 4), Math.round(s + 4));
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < R; i++) {
      const cell = g.ring[i];
      if (cell < 0) continue;
      const p = g.posOf(i) + (moving ? frac : 0);
      let [x, y] = this.ringPoint(p);
      const f = this.flyIn.get(cell);
      if (f) {
        const t = (now - f.t0) / 0.22;
        if (t < 1) { const e = ease(t); x = lerp(f.from[0], x, e); y = lerp(f.from[1], y, e) - Math.sin(t * Math.PI) * 10; }
        else this.flyIn.delete(cell);
      }
      voxel(ctx, x, y, s, colorOf(g.level.cells[cell]));
    }
  }

  // ---- Slots: bays (Critters) or docks (Depot) ----------------------------------------------------------------
  drawSlots(now) {
    const ctx = this.ctx, g = this.game, depot = this.mode === "depot";
    this.slots.forEach((s, b) => {
      ctx.fillStyle = UI.slotEdge;
      ctx.beginPath(); rr(ctx, s.x, s.y, s.s, s.s, 12); ctx.fill();
      ctx.fillStyle = UI.slot;
      ctx.beginPath(); rr(ctx, s.x + 3, s.y + 4, s.s - 6, s.s - 6, 10); ctx.fill();
      const m = depot ? g.docks[b] : g.bays[b];
      if (m < 0) return;
      if (depot) { if (g.where[m] === DOCKED) this.drawMover(m, this.bayPoint(b), now, "dock"); }
      else this.drawMover(m, this.bayPoint(b), now, "bay");
    });
    // Depot: buses on their way to a dock.
    if (depot) for (const d of g.driving) this.drawMover(d.m, this.bayPoint(g.docks.indexOf(d.m)), now, "driving");
  }

  // ---- The yard ----------------------------------------------------------------------------------------------
  drawYard(now) {
    const ctx = this.ctx, g = this.game, Y = this.yard;
    if (g.lanes) {
      const c = this.cellY;
      for (let k = 0; k < g.lanes.length; k++) {
        ctx.fillStyle = UI.lane;
        ctx.beginPath(); rr(ctx, Y.x + k * c + 5, Y.y - 6, c - 10, Y.h + 12, 16); ctx.fill();
        const lane = g.lanes[k], rows = Math.round(Y.h / this.rowH);
        for (let i = Math.min(lane.length, rows) - 1; i >= 0; i--) {
          const m = lane[i];
          const at = [Y.x + (k + 0.5) * c, Y.y + (i + 0.5) * this.rowH];
          if (i === rows - 1 && lane.length > rows) { label(ctx, "+" + (lane.length - rows + 1), at[0], at[1], 18); continue; }
          this.drawMover(m, at, now, i === 0 || this.armed === "pick" ? "front" : "lane", g.level.hidden && i > 0 && this.armed !== "pick");
        }
      }
      if (this.armed === "pick") this.armedFrame(Y.x - 2, Y.y - 10, Y.w + 4, Y.h + 20, now);
      return;
    }
    // The car park.
    const lot = g.level.lot, c = this.cellY;
    ctx.fillStyle = UI.panelLip;
    ctx.beginPath(); rr(ctx, Y.x - 10, Y.y - 10 + 5, Y.w + 20, Y.h + 20, 16); ctx.fill();
    ctx.fillStyle = UI.lot; ctx.strokeStyle = UI.lotEdge; ctx.lineWidth = 2.5;
    ctx.beginPath(); rr(ctx, Y.x - 10, Y.y - 10, Y.w + 20, Y.h + 20, 16); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = UI.lotLine; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]);
    for (let x = 1; x < lot.w; x++) { ctx.beginPath(); ctx.moveTo(Y.x + x * c, Y.y + 4); ctx.lineTo(Y.x + x * c, Y.y + Y.h - 4); ctx.stroke(); }
    ctx.setLineDash([]);
    g.cars.forEach((car) => {
      if (g.where[car.m] !== YARD) return;
      this.drawMover(car.m, this.carCenter(car), now, "lot", false, car);
    });
    if (this.armed === "pick") this.armedFrame(Y.x - 14, Y.y - 14, Y.w + 28, Y.h + 28, now);
  }
  /** A pulsing gold frame round the yard while the Pick or Tow power waits for a tap. */
  armedFrame(x, y, w, h, now) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(now * 6);
    ctx.strokeStyle = UI.glow; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -now * 30;
    ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.stroke();
    ctx.restore();
  }

  // ---- Movers ------------------------------------------------------------------------------------------------
  /** Mover m at point p. where: belt | queue | front | lane | bay (Critters), lot | driving | dock (Depot). */
  drawMover(m, p, now, where, hidden = false, car = null) {
    const g = this.game, tw = this.tweens.get(m);
    let [x, y] = p, angle = -Math.PI / 2;
    if (tw && now < tw.t0 + tw.dur && where !== "lot" && where !== "front" && where !== "lane") {
      const t = ease((now - tw.t0) / tw.dur), pts = where === "belt" ? tw.pts.concat([p]) : tw.pts;
      const q = along(pts, t), q2 = along(pts, Math.min(1, t + 0.02));
      x = q[0]; y = q[1];
      if (q2[0] !== q[0] || q2[1] !== q[1]) angle = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
    }
    const sh = this.shakes.get(m);
    if (sh != null && now < sh + 0.4) x += Math.sin((now - sh) * 50) * 5 * (1 - (now - sh) / 0.4);
    const hex = hidden ? "#8a8fb8" : colorOf(g.color(m));
    const text = hidden ? "?" : g.left[m] ? String(g.left[m]) : "✓";
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (this.mode === "depot") {
      const c = this.cellY;
      let len = car ? car.len : g.level.movers[m].cap >= 8 ? 2 : 1, size;
      if (car) { angle = Math.atan2(DIRS[car.dir][1], DIRS[car.dir][0]); size = len * c - 6; }
      else { const s = this.slots[0].s; size = len === 2 ? s * 0.95 : s * 0.62; if (where === "dock") angle = -Math.PI / 2; }
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(0,0,0,.28)";
      const img = sprite("bus" + len, BUS[len], hex), k = size / img.width;
      ctx.fillRect(-size / 2 + 2, -img.height * k / 2 + 3, size, img.height * k);
      blit(ctx, img, size);
      ctx.rotate(-angle);
      label(ctx, text, 0, 0, clamp(c * 0.42, 14, 20));
    } else {
      const big = where === "front" ? 1.08 : where === "lane" ? 0.9 : 1;
      let size = (where === "bay" ? this.slots[0].s * 0.78 : where === "belt" || where === "queue" ? this.moverSize : Math.min(this.cellY * 0.72, this.rowH * 0.92)) * big;
      if (where === "belt") y = Math.sin(now * 14 + m) * 1.2;
      else y = 0;
      ctx.translate(0, y);
      const img = sprite(hidden ? "hid" : "crit", hidden ? HIDDEN : CRITTER, hex);
      // The Laser power: a glow round the critter riding with it, or the one it's waiting for.
      if (g.zap[m] || (this.armed === "zap" && (where === "front" || where === "bay"))) {
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(now * 10); ctx.fillStyle = UI.glow;
        ctx.beginPath(); ctx.arc(0, 0, size * 0.62, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
      blit(ctx, img, size);
      label(ctx, text, 0, hidden ? 0 : size * 0.2, clamp(size * 0.38, 12, 22));
      if (where === "lane" && !hidden) { ctx.globalAlpha = 0.28; ctx.fillStyle = UI.panel; ctx.beginPath(); ctx.arc(0, 0, size * 0.56, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }

  drawFx(now) {
    const ctx = this.ctx;
    const keep = [];
    for (const f of this.fx) {
      const t = (now - f.t0) / f.dur;
      if (t >= 1) continue;
      keep.push(f);
      if (t < 0) continue;
      if (f.kind === "hop") {
        // A pixel hops from the stop onto its bus.
        const to = this.bayPoint(f.dock);
        const e = ease(t), x = lerp(f.x, to[0], e), y = lerp(f.y, to[1], e) - Math.sin(t * Math.PI) * 22;
        voxel(ctx, x, y, Math.max(6, this.cs * 0.9 * (1 - 0.5 * t)), f.color);
      } else if (f.kind === "pellet") {
        const x = lerp(f.x0, f.x, t), y = lerp(f.y0, f.y, t);
        voxel(ctx, x, y, 7, f.color);
      } else if (f.kind === "spark") {
        const s = now - f.t0, x = f.x + f.vx * s, y = f.y + f.vy * s + 0.5 * (f.g || 0) * s * s;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = f.color;
        ctx.fillRect(Math.round(x - f.s / 2), Math.round(y - f.s / 2), Math.round(f.s), Math.round(f.s)); ctx.globalAlpha = 1;
      } else if (f.kind === "ring") {
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
        ctx.strokeRect(f.x - 10 - t * 22, f.y - 10 - t * 22, 20 + t * 44, 20 + t * 44); ctx.globalAlpha = 1;
      } else if (f.kind === "busOut") {
        // A full bus pulls away: up out of the dock, then off to the side.
        const s = this.slots[0].s, size = f.len === 2 ? s * 0.95 : s * 0.62;
        const e = t * t, up = Math.min(1, t * 3);
        const x = f.x + e * (f.to - f.x), y = f.y - up * (s * 0.55);
        ctx.save(); ctx.translate(x, y); ctx.rotate(t < 0.3 ? -Math.PI / 2 : lerp(-Math.PI / 2, 0, Math.min(1, (t - 0.3) * 4)));
        blit(ctx, sprite("bus" + f.len, BUS[f.len], f.color), size);
        ctx.restore();
        if (t < 0.3) label(ctx, "✓", x, y, 18);
      }
    }
    this.fx = keep;
  }

  drawHint(now) {
    const g = this.game, m = this.hint, t = now - this.hintT0;
    if (t > 4 || g.where[m] === undefined) { this.hint = -1; return; }
    let p, rx = 30, ry = 30;
    if (this.mode !== "depot" && g.where[m] === BAY) p = this.bayPoint(g.bays.indexOf(m));
    else if (g.where[m] === YARD) {
      p = this.yardPoint(m);
      if (g.cars) {
        // Hug the bus: its cells in the car park.
        const car = g.cars[g.carOf.get(m)], c = this.cellY, vertical = car.dir === "up" || car.dir === "down";
        rx = ((vertical ? 1 : car.len) * c) / 2 + 4; ry = ((vertical ? car.len : 1) * c) / 2 + 4;
      }
    } else { this.hint = -1; return; }
    const ctx = this.ctx, k = 3 * Math.sin(t * 7);
    ctx.globalAlpha = Math.min(1, 4 - t);
    ctx.strokeStyle = UI.ink; ctx.lineWidth = 7;
    ctx.beginPath(); rr(ctx, p[0] - rx - k, p[1] - ry - k, 2 * (rx + k), 2 * (ry + k), 12); ctx.stroke();
    ctx.strokeStyle = UI.glow; ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Shared with the 3D renderer (render3d.js), which draws Orbit's bays and lanes in the same style.
export { UI, CRITTER, HIDDEN, FONT, shade, colorOf, sprite, blit, label, rr, along, ease, lerp, clamp };
