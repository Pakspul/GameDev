// Drawing Loopline on a 2D canvas, in a chunky pixel style: the picture as little voxel blocks on a
// dark board, the loop as a light rail with running chevrons, the critters as pixel sprites.
// Nothing here changes the game; game.js calls draw() only while something moves, so an idle board
// costs no battery.
//
// Critters: picture with the track round it, the bays under it, the lanes under those. (Depot has its
// own renderer, renderDepot.js, which borrows the helpers at the bottom of this file.)
import { PALETTE } from "./config.js";
import { BAY, YARD } from "./engine.js";

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

/** Buddies waiting in the lanes (Critters and Orbit): a gold rope from one to the other, drawn under the
 *  critters, and (`under` false) a chain link on top, half way. at(m): where m stands in its lane. */
function drawBuddies(ctx, g, at, size, under) {
  if (!g.buddy) return;
  for (let m = 0; m < g.buddy.length; m++) {
    const p = g.buddy[m];
    if (p < 0 || !g.lead[m] || g.where[m] !== YARD || g.where[p] !== YARD) continue;
    const a = at(m), b = at(p);
    if (!a || !b) continue;
    ctx.save();
    if (under) {
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = UI.ink; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = "#ffcf3f"; ctx.lineWidth = 4; ctx.setLineDash([6, 5]); ctx.stroke();
    } else {
      const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2, r = clamp(size * 0.13, 4, 7);
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
      ctx.fillStyle = UI.ink;
      ctx.beginPath(); rr(ctx, -r * 2.3, -r * 1.35, r * 4.6, r * 2.7, r * 1.3); ctx.fill();
      ctx.strokeStyle = "#ffcf3f"; ctx.lineWidth = Math.max(2, r * 0.5);
      for (const dx of [-0.6, 0.6]) { ctx.beginPath(); rr(ctx, dx * r - r * 0.95, -r * 0.65, r * 1.9, r * 1.3, r * 0.65); ctx.stroke(); }
    }
    ctx.restore();
  }
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
/** Fireworks for `dur` seconds: a burst every quarter second at `where()` ([x, y]), into `fx`. */
function fireworks(fx, now, dur, where) {
  for (let t = 0; t < dur; t += 0.22) {
    const [x, y] = where(), color = HEX[Math.floor(Math.random() * 10)], n = 16 + Math.floor(Math.random() * 8);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + Math.random() * 0.3, v = 70 + Math.random() * 50;
      fx.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 120, t0: now + t + Math.random() * 0.05, dur: 0.9, color, s: 5 });
    }
  }
}

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
  clearFx() { this.fx = []; this.ghosts.clear(); this.tweens.clear(); this.shakes.clear(); this.hint = -1; }

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
    const g = this.game, lv = g.level, W = this.W;
    const top = this.top, bot = this.H - (this.bottom || 0), pad = 14, avH = bot - top - 2 * pad;
    const wide = W > (bot - top) * 1.15;
    const compact = !wide && avH < 560; // small phones: tighter everything
    const rail = compact ? 16 : 20, Gmin = compact ? 16 : 22;
    const nS = g.bays.length; // the Extra bay power can add one
    const slotS = compact ? 44 : 54, slotGap = compact ? 8 : 10;
    // Gaps: board to bays (with room for the loop bar: how many ride, and Repeat), bays to lanes.
    const barH = compact ? 30 : 34;
    const gap1 = (compact ? 8 : 12) + barH, gap2 = compact ? 14 : 24;
    // The lanes of critters. They give up room if the picture would get too small.
    let cellY, rowH, yardW, yardH, cs = 30, G = 26;
    const cols = lv.lanes.length, rows = 4;
    const yardMaxW = wide ? W * 0.4 - pad : W - 2 * pad - 12;
    const yardMaxH = wide ? avH - 20 : avH * 0.3;
    for (let shrink = 1, k = 0; k < 12; k++, shrink *= 0.9) {
      cellY = Math.floor(Math.min(86, yardMaxW / cols)); rowH = Math.floor(Math.min(64, (yardMaxH * shrink) / rows));
      yardW = cellY * cols; yardH = rowH * rows;
      // The picture gets the rest. G: picture edge to the middle of the rail.
      const gaps = gap1 + (wide ? 0 : gap2) + 8;
      const boardW = wide ? W - yardW - 4 * pad - 60 : W - 2 * pad;
      const boardH = wide ? avH - slotS - gaps : avH - yardH - slotS - gaps;
      for (let j = 0; j < 3; j++) {
        const ringOut = 2 * (G + rail / 2 + 6);
        cs = Math.floor(Math.min((boardW - ringOut) / lv.w, (boardH - ringOut) / lv.h));
        G = clamp(Math.round(cs * 1.15), Gmin, 32);
      }
      if (wide || cs >= 9 || rowH <= 36) break;
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
    // Bays, centred under the board.
    const cx = px + pw / 2;
    sx = clamp(Math.round(cx - sw / 2), pad, W - pad - sw);
    if (wide) sx = clamp(Math.round(cx - sw / 2), pad, Math.max(pad, px + pw + ring - sw));
    this.slots = Array.from({ length: nS }, (_, i) => ({ x: sx + i * (slotS + slotGap), y: sy, s: slotS }));
    this.yard = { x: yx, y: yy, w: yardW, h: yardH };
    // The loop bar (HTML, placed by game.js) sits just over the bays.
    this.bar = { x: sx + sw / 2, y: sy - barH, h: barH - 4 };
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
  cellPoint(i) {
    const w = this.game.w;
    return [this.px + ((i % w) + 0.5) * this.cs, this.py + (Math.floor(i / w) + 0.5) * this.cs];
  }
  entrance() { return this.stepPoint(this.game.track[0]); }
  bayPoint(b) { const s = this.slots[b]; return [s.x + s.s / 2, s.y + s.s / 2]; }
  /** Where mover m stands in its lane now. */
  yardPoint(m) {
    const g = this.game, Y = this.yard;
    for (let k = 0; k < g.lanes.length; k++) {
      const i = g.lanes[k].indexOf(m);
      if (i >= 0) return [Y.x + (k + 0.5) * this.cellY, Y.y + (i + 0.5) * this.rowH];
    }
    return [Y.x + Y.w / 2, Y.y];
  }

  // ---- Effects, started by game.js from the engine's events --------------------------------------------------
  onLaunch(m, e, now) {
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
  onPark(m, bay, now) {
    const e = this.entrance();
    this.tweens.set(m, { pts: [e, this.bayPoint(bay)], t0: now, dur: 0.35 });
  }
  onDone(m, now) {
    const [x, y] = this.entrance(), color = colorOf(this.game.color(m));
    this.fx.push({ kind: "ring", x, y, t0: now, dur: 0.35, color });
    this.burst(x, y, color, now, 10);
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
  /** The level finishes itself (a sure win): fireworks round the board for `dur` seconds, while the
   *  critters pop what's left. */
  onCelebrate(now, dur) {
    const { px, py, pw, ph, ringOut } = this;
    fireworks(this.fx, now, dur, () => [px - ringOut / 2 + Math.random() * (pw + ringOut), py - ringOut / 2 + Math.random() * (ph * 0.6 + ringOut / 2)]);
  }
  shake(m, now) { this.shakes.set(m, now); }
  showHint(m, now) { this.hint = m; this.hintT0 = now; }

  busy(now) {
    if (this.armed) return true; // a power waits for a tap: keep it pulsing
    if (this.fx.some((f) => now < f.t0 + f.dur)) return true;
    for (const t of this.tweens.values()) if (now < t.t0 + t.dur) return true;
    for (const t0 of this.shakes.values()) if (now < t0 + 0.4) return true;
    if (this.hint >= 0 && now < this.hintT0 + 4) return true;
    return false;
  }

  // ---- Hit testing -------------------------------------------------------------------------------------------
  /** What's under a tap: { m } a mover to send, or null. `any` (the Pick power): any critter in a
   *  lane, not just the front one. */
  hit(x, y, any = false) {
    const g = this.game;
    for (let b = 0; b < this.slots.length; b++) {
      const s = this.slots[b];
      if (g.bays[b] >= 0 && x >= s.x - 4 && x <= s.x + s.s + 4 && y >= s.y - 4 && y <= s.y + s.s + 4) return { m: g.bays[b] };
    }
    const Y = this.yard;
    if (x < Y.x - 6 || x > Y.x + Y.w + 6 || y < Y.y - 6 || y > Y.y + Y.h + 6) return null;
    const k = clamp(Math.floor((x - Y.x) / this.cellY), 0, g.lanes.length - 1);
    const lane = g.lanes[k], rows = Math.round(Y.h / this.rowH);
    if (!lane.length) return null;
    if (any) {
      const i = clamp(Math.floor((y - Y.y) / this.rowH), 0, rows - 1);
      if (i < lane.length && !(i === rows - 1 && lane.length > rows)) return { m: lane[i], lane: k };
    }
    return { m: lane[0], lane: k };
  }

  // ---- Drawing -----------------------------------------------------------------------------------------------
  draw(frac, now) {
    const ctx = this.ctx, g = this.game;
    ctx.clearRect(0, 0, this.W, this.H);
    if (!g) return;
    this.drawBoard(now, frac);
    this.drawPicture(now);
    this.drawSlots(now);
    this.drawYard(now);
    g.queue.forEach((m, i) => { const e = this.entrance(); this.drawMover(m, [e[0] - 4 - i * 8, e[1] + 26], now, "queue"); });
    for (const b of g.belt) this.drawMover(b.m, this.trackPoint(Math.min(b.pos + frac, g.L)), now, "belt");
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
    const g = this.game, running = g.belt.length > 0;
    const step = 26, n = Math.floor(this.path.len / step);
    const off = running ? now * 2.2 : 0;
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
    this.drawFinish();
  }

  /** Critters: a chequered start and finish line across the rail where every lap starts and ends. */
  drawFinish() {
    const ctx = this.ctx, T = this.game.track, L = T.length;
    const [x, y] = this.stepPoint(T[0]), a = this.stepPoint(T[L - 1]), b = this.stepPoint(T[1]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), n = 4, w = this.rail + 6, s = w / n;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = UI.ink; ctx.fillRect(-1.5 * s - 2, -w / 2 - 2, 3 * s + 4, w + 4);
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? "#ffffff" : "#26283f"; ctx.fillRect(-1.5 * s + j * s, -w / 2 + i * s, s, s); }
    ctx.restore();
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

  // ---- Bays ---------------------------------------------------------------------------------------------------
  drawSlots(now) {
    const ctx = this.ctx, g = this.game;
    this.slots.forEach((s, b) => {
      ctx.fillStyle = UI.slotEdge;
      ctx.beginPath(); rr(ctx, s.x, s.y, s.s, s.s, 12); ctx.fill();
      ctx.fillStyle = UI.slot;
      ctx.beginPath(); rr(ctx, s.x + 3, s.y + 4, s.s - 6, s.s - 6, 10); ctx.fill();
      const m = g.bays[b];
      if (m >= 0) this.drawMover(m, this.bayPoint(b), now, "bay");
    });
  }

  // ---- The lanes ---------------------------------------------------------------------------------------------
  drawYard(now) {
    const ctx = this.ctx, g = this.game, Y = this.yard, c = this.cellY, rows = Math.round(Y.h / this.rowH);
    for (let k = 0; k < g.lanes.length; k++) {
      ctx.fillStyle = UI.lane;
      ctx.beginPath(); rr(ctx, Y.x + k * c + 5, Y.y - 6, c - 10, Y.h + 12, 16); ctx.fill();
    }
    const at = (m) => { // where m stands, if it shows (not behind the "+n" of a long lane)
      const lane = g.lanes.find((l) => l.includes(m)), i = lane.indexOf(m);
      return i < rows - 1 || (i === rows - 1 && lane.length === rows) ? this.yardPoint(m) : null;
    };
    const size = Math.min(c * 0.72, this.rowH * 0.92);
    drawBuddies(ctx, g, at, size, true);
    for (let k = 0; k < g.lanes.length; k++) {
      const lane = g.lanes[k];
      for (let i = Math.min(lane.length, rows) - 1; i >= 0; i--) {
        const m = lane[i];
        const at = [Y.x + (k + 0.5) * c, Y.y + (i + 0.5) * this.rowH];
        if (i === rows - 1 && lane.length > rows) { label(ctx, "+" + (lane.length - rows + 1), at[0], at[1], 18); continue; }
        this.drawMover(m, at, now, i === 0 || this.armed === "pick" ? "front" : "lane", g.level.hidden && i > 0 && this.armed !== "pick");
      }
    }
    drawBuddies(ctx, g, at, size, false);
    if (this.armed === "pick") this.armedFrame(Y.x - 2, Y.y - 10, Y.w + 4, Y.h + 20, now);
  }
  /** A pulsing gold frame round the lanes while the Pick power waits for a tap. */
  armedFrame(x, y, w, h, now) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(now * 6);
    ctx.strokeStyle = UI.glow; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -now * 30;
    ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.stroke();
    ctx.restore();
  }


  // ---- Movers ------------------------------------------------------------------------------------------------
  /** Critter m at point p. where: belt | queue | front | lane | bay. */
  drawMover(m, p, now, where, hidden = false) {
    const g = this.game, tw = this.tweens.get(m);
    let [x, y] = p;
    if (tw && now < tw.t0 + tw.dur && where !== "front" && where !== "lane") {
      const t = ease((now - tw.t0) / tw.dur), pts = where === "belt" ? tw.pts.concat([p]) : tw.pts;
      [x, y] = along(pts, t);
    }
    const sh = this.shakes.get(m);
    if (sh != null && now < sh + 0.4) x += Math.sin((now - sh) * 50) * 5 * (1 - (now - sh) / 0.4);
    const hex = hidden ? "#8a8fb8" : colorOf(g.color(m));
    const text = hidden ? "?" : g.left[m] ? String(g.left[m]) : "✓";
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    const big = where === "front" ? 1.08 : where === "lane" ? 0.9 : 1;
    const size = (where === "bay" ? this.slots[0].s * 0.78 : where === "belt" || where === "queue" ? this.moverSize : Math.min(this.cellY * 0.72, this.rowH * 0.92)) * big;
    if (where === "belt") ctx.translate(0, Math.sin(now * 14 + m) * 1.2);
    const img = sprite(hidden ? "hid" : "crit", hidden ? HIDDEN : CRITTER, hex);
    // The Laser power: a glow round the critter riding with it, or the one it's waiting for.
    if (g.zap[m] || (this.armed === "zap" && (where === "front" || where === "bay"))) {
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(now * 10); ctx.fillStyle = UI.glow;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.62, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    blit(ctx, img, size);
    label(ctx, text, 0, hidden ? 0 : size * 0.2, clamp(size * 0.38, 12, 22));
    if (where === "lane" && !hidden) { ctx.globalAlpha = 0.28; ctx.fillStyle = UI.panel; ctx.beginPath(); ctx.arc(0, 0, size * 0.56, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
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
      if (f.kind === "pellet") {
        const x = lerp(f.x0, f.x, t), y = lerp(f.y0, f.y, t);
        voxel(ctx, x, y, 7, f.color);
      } else if (f.kind === "spark") {
        const s = now - f.t0, x = f.x + f.vx * s, y = f.y + f.vy * s + 0.5 * (f.g || 0) * s * s;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = f.color;
        ctx.fillRect(Math.round(x - f.s / 2), Math.round(y - f.s / 2), Math.round(f.s), Math.round(f.s)); ctx.globalAlpha = 1;
      } else if (f.kind === "ring") {
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
        ctx.strokeRect(f.x - 10 - t * 22, f.y - 10 - t * 22, 20 + t * 44, 20 + t * 44); ctx.globalAlpha = 1;
      }
    }
    this.fx = keep;
  }

  drawHint(now) {
    const g = this.game, m = this.hint, t = now - this.hintT0;
    if (t > 4 || g.where[m] === undefined) { this.hint = -1; return; }
    let p;
    const rx = 30, ry = 30;
    if (g.where[m] === BAY) p = this.bayPoint(g.bays.indexOf(m));
    else if (g.where[m] === 0) p = this.yardPoint(m);
    else { this.hint = -1; return; }
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
export { UI, CRITTER, HIDDEN, FONT, shade, colorOf, sprite, blit, label, rr, along, ease, lerp, clamp, drawBuddies, fireworks };
