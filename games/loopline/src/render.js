// Drawing Loopline on a 2D canvas: the picture, the loop round it, the bays and the yard, and the
// movers on their way. Nothing here changes the game; game.js calls draw() only while something
// moves, so an idle board costs no battery.
import { PALETTE } from "./config.js";
import { DIRS, BAY, YARD, carCells } from "./engine.js";

const TAU = Math.PI * 2;
const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
const lerp = (a, b, t) => a + (b - a) * t;

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
// Ink on a mover: dark on light colours, white on dark ones.
const LIGHT = new Set(["Y", "L", "S", "K", "F", "W", "O"].map((k) => PALETTE.findIndex((p) => p.key === k) + 1));

const THEME = {
  depot: { road: "#3c404b", roadEdge: "#2c2f38", mark: "#ffd65c", plate: "#fffaf0", plateEdge: "#e6dcc6", yard: "#474c59", yardLine: "rgba(255,255,255,.55)" },
  critters: { road: "#56607a", roadEdge: "#434b61", mark: "#8590ab", plate: "#fbf8ff", plateEdge: "#ddd5ec", yard: "#e9e2f3", yardLine: "#d6cce6" },
};

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.fx = [];        // flying passengers, pellets, sparks
    this.ghosts = new Map(); // cell -> time it may disappear (Critters: until the pellet lands)
    this.tweens = new Map(); // mover -> { pts: [[x,y]...], t0, dur }
    this.shakes = new Map(); // mover -> t0
    this.hint = -1; this.hintT0 = 0;
    this.game = null;
    this.resize();
  }

  setGame(game, mode) {
    this.game = game; this.mode = mode; this.theme = THEME[mode];
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
    const g = this.game, lv = g.level, W = this.W, H = this.H;
    const top = this.top || 64, pad = 14;
    const wide = W > H * 1.05;
    const G = 22;               // picture edge to the middle of the road
    const ring = G + 17;        // picture edge to the outside of the road
    const bayS = 50, bayGap = 8;
    // The yard's size per cell.
    let yardW, yardH, cellY;
    const lanes = lv.lanes, lot = lv.lot;
    const colsY = lot ? lot.w : lanes.length, rowsY = lot ? lot.h : 4;
    const yardMaxW = wide ? W * 0.42 : W - 2 * pad;
    const yardMaxH = wide ? H - top - bayS - 3 * pad : (H - top) * 0.36;
    cellY = Math.floor(Math.min(lot ? 52 : 74, yardMaxW / colsY, yardMaxH / rowsY));
    const rowH = lot ? cellY : Math.min(60, cellY);
    yardW = cellY * colsY; yardH = rowH * rowsY;
    this.cellY = cellY; this.rowH = rowH;
    // The picture gets the rest; then the whole stack is centred in the space below the HUD.
    const gapA = 16, gapB = 16; // road to bays, bays to yard
    let cs;
    if (wide) cs = Math.min((W - yardW - 3 * pad - 2 * ring) / lv.w, (H - top - pad - 2 * ring) / lv.h);
    else cs = Math.min((W - 2 * pad - 2 * ring) / lv.w, (H - top - 2 * pad - gapA - bayS - gapB - yardH - 2 * ring) / lv.h);
    cs = Math.max(6, Math.floor(Math.min(30, cs)));
    const pw = cs * lv.w, ph = cs * lv.h;
    const nb = lv.bays, bw = nb * bayS + (nb - 1) * bayGap;
    let px, py, bx, by, yx, yy;
    if (wide) {
      const left = W - yardW - 3 * pad;
      px = Math.round(pad + (left - pw) / 2);
      py = Math.round(top + Math.max(0, (H - top - pad - ph - 2 * ring) / 2) + ring);
      yx = W - pad - yardW;
      const stack = bayS + gapB + yardH;
      by = Math.round(top + Math.max(0, (H - top - pad - stack) / 2)); bx = yx + (yardW - bw) / 2; yy = by + bayS + gapB;
    } else {
      const stack = 2 * ring + ph + gapA + bayS + gapB + yardH;
      const y0 = top + pad + Math.max(0, (H - top - 2 * pad - stack) * 0.45);
      px = Math.round((W - pw) / 2); py = Math.round(y0 + ring);
      by = Math.round(py + ph + ring + gapA); bx = Math.max(px - G + 24, (W - bw) / 2); yy = by + bayS + gapB; yx = (W - yardW) / 2;
    }
    Object.assign(this, { cs, px, py, pw, ph, G, wide });
    this.bays = Array.from({ length: nb }, (_, i) => ({ x: bx + i * (bayS + bayGap), y: by, s: bayS }));
    this.yard = { x: yx, y: yy, w: yardW, h: yardH };
    this.moverSize = Math.max(18, Math.min(26, cs * 1.5));
  }

  /** Screen point of a track step (fractional steps blend). */
  trackPoint(pos) {
    const T = this.game.track, L = T.length;
    const p0 = Math.floor(pos), f = pos - p0;
    const a = this.stepPoint(T[((p0 % L) + L) % L]), b = this.stepPoint(T[(p0 + 1) % L]);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }
  stepPoint(t) {
    const { px, py, pw, ph, cs, G } = this;
    const x = t.x < 0 ? px - G : t.x >= this.game.w ? px + pw + G : px + (t.x + 0.5) * cs;
    const y = t.y < 0 ? py - G : t.y >= this.game.h ? py + ph + G : py + (t.y + 0.5) * cs;
    return [x, y];
  }
  cellPoint(i) {
    const w = this.game.w;
    return [this.px + ((i % w) + 0.5) * this.cs, this.py + (Math.floor(i / w) + 0.5) * this.cs];
  }
  entrance() { return this.stepPoint(this.game.track[0]); }
  /** The side road the bays sit on: from below the entrance to past the last bay. */
  bayLane() {
    const b0 = this.bays[0], bn = this.bays[this.bays.length - 1];
    if (this.wide) { const e = this.entrance(); return { y: e[1] + 30, x1: e[0] }; } // bays beside the picture: just a stub
    return { y: b0.y + b0.s / 2, x1: Math.max(bn.x + bn.s - 10, this.entrance()[0]) };
  }
  bayPoint(b) { const s = this.bays[b]; return [s.x + s.s / 2, s.y + s.s / 2]; }
  /** Where mover m stands in the yard now (lane slot or parked car). */
  yardPoint(m) {
    const g = this.game, Y = this.yard;
    if (g.lanes) {
      for (let k = 0; k < g.lanes.length; k++) {
        const i = g.lanes[k].indexOf(m);
        if (i >= 0) return [Y.x + (k + 0.5) * this.cellY, Y.y + (i + 0.5) * this.rowH];
      }
      return [Y.x + Y.w / 2, Y.y];
    }
    const car = g.cars[g.carOf.get(m)];
    return this.carCenter(car);
  }
  carCenter(car) {
    const cells = carCells(car), c = this.cellY;
    const xs = cells.map((p) => p[0]), ys = cells.map((p) => p[1]);
    return [this.yard.x + ((Math.min(...xs) + Math.max(...xs)) / 2 + 0.5) * c, this.yard.y + ((Math.min(...ys) + Math.max(...ys)) / 2 + 0.5) * c];
  }

  // ---- Effects, started by game.js from the engine's events --------------------------------------------------
  /** A mover leaves the yard or a bay: glide from there to the entrance. */
  onLaunch(m, from, now) {
    const g = this.game;
    let pts;
    if (from.bay != null) pts = [this.bayPoint(from.bay)];
    else if (from.lane != null) pts = [[this.yard.x + (from.lane + 0.5) * this.cellY, this.yard.y + 0.5 * this.rowH]];
    else {
      const car = g.cars[from.car], [dx, dy] = DIRS[car.dir], c = this.carCenter(car), Y = this.yard;
      // Drive out of the park the way it faces first.
      const ex = dx ? (dx > 0 ? Y.x + Y.w + 14 : Y.x - 14) : c[0], ey = dy ? (dy > 0 ? Y.y + Y.h + 14 : Y.y - 14) : c[1];
      pts = [c, [ex, ey]];
    }
    const e = this.entrance(), lane = this.bayLane();
    pts.push([e[0], lane.y], e);
    this.tweens.set(m, { pts, t0: now, dur: from.car != null ? 0.42 : 0.3, kind: "in" });
  }
  onTake(m, cell, now, at) {
    const color = colorOf(this.game.color(m));
    const [cx, cy] = this.cellPoint(cell);
    if (this.mode === "depot") this.fx.push({ kind: "hop", m, x: cx, y: cy, t0: now, dur: 0.32, color });
    else {
      this.ghosts.set(cell, { until: now + 0.11, color: this.game.color(m) });
      this.fx.push({ kind: "pellet", x0: at[0], y0: at[1], x: cx, y: cy, t0: now, dur: 0.11, color });
      for (let k = 0; k < 6; k++) {
        const a = Math.random() * TAU, v = 30 + Math.random() * 50;
        this.fx.push({ kind: "spark", x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: now + 0.11, dur: 0.35, color, s: this.cs * 0.3 });
      }
    }
  }
  onPark(m, bay, now) {
    const e = this.entrance();
    this.tweens.set(m, { pts: [e, [e[0], this.bayLane().y], this.bayPoint(bay)], t0: now, dur: 0.4, kind: "park" });
  }
  onDone(m, now) {
    const [x, y] = this.entrance(), color = colorOf(this.game.color(m));
    this.fx.push({ kind: "leave", m, x, y, t0: now, dur: 0.35, color });
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * TAU, v = 40 + Math.random() * 60;
      this.fx.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t0: now, dur: 0.5, color, s: 4 });
    }
  }
  onWin(now) {
    const { px, py, pw, ph } = this;
    for (let k = 0; k < 60; k++) {
      const color = HEX[Math.floor(Math.random() * 10)];
      this.fx.push({ kind: "spark", x: px + Math.random() * pw, y: py + Math.random() * ph, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 120, g: 260, t0: now + Math.random() * 0.3, dur: 1.1, color, s: 5 });
    }
  }
  shake(m, now) { this.shakes.set(m, now); }
  showHint(m, now) { this.hint = m; this.hintT0 = now; }

  /** Anything still moving that needs frames? */
  busy(now) {
    if (this.fx.some((f) => now < f.t0 + f.dur)) return true;
    for (const t of this.tweens.values()) if (now < t.t0 + t.dur) return true;
    for (const t0 of this.shakes.values()) if (now < t0 + 0.4) return true;
    if (this.hint >= 0 && now < this.hintT0 + 4) return true;
    return false;
  }

  // ---- Hit testing --------------------------------------------------------------------------------------------
  /** What's under a tap: { m } a mover to send, or null. */
  hit(x, y) {
    const g = this.game;
    for (let b = 0; b < this.bays.length; b++) {
      const s = this.bays[b];
      if (g.bays[b] >= 0 && x >= s.x - 4 && x <= s.x + s.s + 4 && y >= s.y - 4 && y <= s.y + s.s + 4) return { m: g.bays[b] };
    }
    const Y = this.yard;
    if (x < Y.x - 6 || x > Y.x + Y.w + 6 || y < Y.y - 6 || y > Y.y + Y.h + 6) return null;
    if (g.lanes) {
      const k = Math.max(0, Math.min(g.lanes.length - 1, Math.floor((x - Y.x) / this.cellY)));
      return g.lanes[k].length ? { m: g.lanes[k][0], lane: k } : null;
    }
    const lw = g.level.lot.w;
    const cx = Math.floor((x - Y.x) / this.cellY), cy = Math.floor((y - Y.y) / this.cellY);
    if (cx < 0 || cy < 0 || cx >= lw || cy >= g.level.lot.h) return null;
    const i = g.occ[cy * lw + cx];
    return i >= 0 ? { m: g.cars[i].m } : null;
  }

  // ---- Drawing ------------------------------------------------------------------------------------------------
  draw(frac, now) {
    const ctx = this.ctx, g = this.game;
    ctx.clearRect(0, 0, this.W, this.H);
    if (!g) return;
    this.drawRoad(now);
    this.drawPicture(now);
    this.drawBays();
    this.drawYard(now);
    // Parked movers.
    g.bays.forEach((m, b) => { if (m >= 0) this.drawAt(m, this.bayPoint(b), -Math.PI / 2, now, 1, "bay"); });
    // Waiting for the entrance: just below it.
    g.queue.forEach((m, i) => { const e = this.entrance(); this.drawAt(m, [e[0], e[1] + 22 + i * 10], -Math.PI / 2, now, 0.9, "queue"); });
    // On the loop.
    for (const b of g.belt) {
      const pos = Math.min(b.pos + frac, g.L);
      const p = this.trackPoint(pos);
      this.drawAt(b.m, p, this.heading(pos), now, 1, "belt");
    }
    this.drawFx(now);
    if (this.hint >= 0) this.drawHint(now);
  }

  heading(pos) {
    const T = this.game.track, L = T.length;
    const a = this.trackPoint(pos - 0.5), b = this.trackPoint(Math.min(pos + 0.5, L));
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }

  drawRoad(now) {
    const ctx = this.ctx, th = this.theme, { px, py, pw, ph, G } = this;
    const x = px - G, y = py - G, w = pw + 2 * G, h = ph + 2 * G, r = 16;
    // A side road from the entrance down to the bays and along them.
    const e = this.entrance(), lane = this.bayLane();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[0], lane.y); ctx.lineTo(lane.x1, lane.y);
    ctx.strokeStyle = th.roadEdge; ctx.lineWidth = 34; ctx.stroke();
    ctx.strokeStyle = th.road; ctx.lineWidth = 30; ctx.stroke();
    ctx.beginPath(); rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = th.roadEdge; ctx.lineWidth = 34; ctx.stroke();
    ctx.strokeStyle = th.road; ctx.lineWidth = 30; ctx.stroke();
    // Markings: dashes on the road, slats on the belt (they run while the belt runs).
    const run = this.game.belt.length ? now : 0;
    ctx.save();
    if (this.mode === "depot") { ctx.setLineDash([8, 10]); ctx.lineDashOffset = -run * 40; ctx.strokeStyle = th.mark; ctx.lineWidth = 2; }
    else { ctx.setLineDash([3, 7]); ctx.lineDashOffset = -run * 60; ctx.strokeStyle = th.mark; ctx.lineWidth = 22; ctx.lineCap = "butt"; }
    ctx.beginPath(); rr(ctx, x, y, w, h, r); ctx.stroke();
    ctx.restore();
    // Entrance arrow.
    ctx.fillStyle = th.mark;
    ctx.beginPath(); ctx.moveTo(e[0] - 6, e[1] - 4); ctx.lineTo(e[0] + 6, e[1] - 4); ctx.lineTo(e[0], e[1] - 13); ctx.closePath(); ctx.fill();
  }

  drawPicture(now) {
    const ctx = this.ctx, g = this.game, th = this.theme, { px, py, pw, ph, cs } = this;
    ctx.fillStyle = th.plate; ctx.strokeStyle = th.plateEdge; ctx.lineWidth = 2;
    ctx.beginPath(); rr(ctx, px - 5, py - 5, pw + 10, ph + 10, 9); ctx.fill(); ctx.stroke();
    // Faint dots where cells have gone.
    ctx.fillStyle = th.plateEdge;
    for (let i = 0; i < g.cells.length; i++) {
      if (g.level.cells[i] && !g.cells[i] && !this.ghosts.has(i)) { const [x, y] = this.cellPoint(i); ctx.fillRect(x - 1, y - 1, 2, 2); }
    }
    for (let i = 0; i < g.cells.length; i++) {
      let c = g.cells[i];
      const gh = this.ghosts.get(i);
      if (!c && gh) { if (now < gh.until) c = gh.color; else this.ghosts.delete(i); }
      if (!c) continue;
      const [x, y] = this.cellPoint(i);
      this.drawCell(x, y, cs, colorOf(c));
    }
  }
  drawCell(x, y, cs, hex) {
    const ctx = this.ctx;
    if (this.mode === "depot") {
      // A passenger seen from above: a round head with a light patch.
      const r = cs * 0.44;
      ctx.fillStyle = shade(hex, -0.22);
      ctx.beginPath(); ctx.arc(x, y + cs * 0.04, r, 0, TAU); ctx.fill();
      ctx.fillStyle = hex;
      ctx.beginPath(); ctx.arc(x, y - cs * 0.02, r * 0.9, 0, TAU); ctx.fill();
      if (cs >= 10) { ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, TAU); ctx.fill(); }
    } else {
      // A block with a bevel.
      const s = cs * 0.92, h = s / 2;
      ctx.fillStyle = shade(hex, -0.25);
      ctx.beginPath(); rr(ctx, x - h, y - h, s, s, cs * 0.18); ctx.fill();
      ctx.fillStyle = hex;
      ctx.beginPath(); rr(ctx, x - h, y - h, s, s - cs * 0.14, cs * 0.18); ctx.fill();
      if (cs >= 10) { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x - h + cs * 0.16, y - h + cs * 0.12, s * 0.4, cs * 0.1); }
    }
  }

  drawBays() {
    const ctx = this.ctx, g = this.game;
    this.bays.forEach((s, b) => {
      ctx.fillStyle = this.mode === "depot" ? "#e4dccb" : "#e6def2";
      ctx.strokeStyle = g.bays[b] >= 0 ? "transparent" : this.mode === "depot" ? "#cbbfa4" : "#cbbfe0";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); rr(ctx, s.x, s.y, s.s, s.s, 12); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  drawYard(now) {
    const ctx = this.ctx, g = this.game, th = this.theme, Y = this.yard;
    if (g.lanes) {
      const c = this.cellY;
      for (let k = 0; k < g.lanes.length; k++) {
        ctx.fillStyle = th.yard;
        ctx.beginPath(); rr(ctx, Y.x + k * c + 4, Y.y - 4, c - 8, Y.h + 8, 14); ctx.fill();
        const lane = g.lanes[k], rows = Math.round(Y.h / this.rowH);
        for (let i = Math.min(lane.length, rows) - 1; i >= 0; i--) {
          const m = lane[i];
          if (i === rows - 1 && lane.length > rows) {
            ctx.fillStyle = "#8d84a3"; ctx.font = "800 14px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("+" + (lane.length - rows + 1), Y.x + (k + 0.5) * c, Y.y + (i + 0.5) * this.rowH);
            continue;
          }
          const hidden = g.level.hidden && i > 0;
          this.drawAt(m, [Y.x + (k + 0.5) * c, Y.y + (i + 0.5) * this.rowH], -Math.PI / 2, now, i === 0 ? 1.15 : 1, "yard", hidden);
        }
      }
      return;
    }
    // The car park.
    const lot = g.level.lot, c = this.cellY;
    ctx.fillStyle = th.yard;
    ctx.beginPath(); rr(ctx, Y.x - 8, Y.y - 8, Y.w + 16, Y.h + 16, 14); ctx.fill();
    ctx.strokeStyle = th.yardLine; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    for (let x = 1; x < lot.w; x++) { ctx.beginPath(); ctx.moveTo(Y.x + x * c, Y.y + 4); ctx.lineTo(Y.x + x * c, Y.y + Y.h - 4); ctx.stroke(); }
    ctx.setLineDash([]);
    g.cars.forEach((car) => {
      if (g.where[car.m] !== YARD) return;
      const [x, y] = this.carCenter(car);
      const [dx, dy] = DIRS[car.dir];
      this.drawAt(car.m, [x, y], Math.atan2(dy, dx), now, 1, "lot", false, car.len);
    });
  }

  /** Mover m at a point, facing angle, in the look of the mode. */
  drawAt(m, p, angle, now, scale, where, hidden = false, len = 0) {
    const g = this.game, tw = this.tweens.get(m);
    let [x, y] = p;
    if (tw && now < tw.t0 + tw.dur && (where === "belt" || where === "bay" || where === "queue")) {
      // Blend from the tween's path into wherever the engine has it now.
      const t = ease((now - tw.t0) / tw.dur), pts = tw.kind === "in" ? tw.pts.concat([p]) : tw.pts;
      const q = along(pts, t);
      if (tw.kind === "in" && where === "belt") { x = q[0]; y = q[1]; }
      else if (tw.kind === "park" && where === "bay") { x = q[0]; y = q[1]; }
      else if (tw.kind === "in" && where === "queue") { x = q[0]; y = q[1]; }
    }
    const sh = this.shakes.get(m);
    if (sh != null && now < sh + 0.4) x += Math.sin((now - sh) * 50) * 5 * (1 - (now - sh) / 0.4);
    const color = g.color(m), hex = hidden ? "#b9b3c6" : colorOf(color), ink = hidden || LIGHT.has(color) ? "#2a2730" : "#ffffff";
    const label = hidden ? "?" : g.left[m] ? String(g.left[m]) : "✓";
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (this.mode === "depot") {
      const c = this.cellY;
      let L, Wd;
      if (where === "lot") { L = len * c - 8; Wd = c - 12; }
      else { const s = this.moverSize * scale; L = s * (g.level.movers[m].cap >= 8 ? 1.5 : 1.15); Wd = s * 0.82; if (where === "bay") { L = Math.min(L, 44); Wd = Math.min(Wd, 30); } }
      ctx.rotate(angle);
      bus(ctx, L, Wd, hex);
      ctx.rotate(-angle);
      chip(ctx, label, ink, hex, Math.max(11, Math.min(15, Wd * 0.5)));
    } else {
      const r = (where === "bay" ? 19 : where === "yard" ? Math.min(this.cellY, this.rowH) * 0.36 : this.moverSize * 0.55) * scale;
      critter(ctx, r, hex, where === "belt" ? angle : Math.PI, label, ink, hidden); // off the loop: eyes up
    }
    ctx.restore();
  }

  drawFx(now) {
    const ctx = this.ctx, g = this.game;
    const keep = [];
    for (const f of this.fx) {
      const t = (now - f.t0) / f.dur;
      if (t >= 1) continue;
      keep.push(f);
      if (t < 0) continue;
      if (f.kind === "hop") {
        // A passenger hops onto its bus, wherever the bus is by now.
        const b = g.belt.find((e) => e.m === f.m);
        const to = b ? this.trackPoint(b.pos) : this.entrance();
        const e = ease(t), x = lerp(f.x, to[0], e), y = lerp(f.y, to[1], e) - Math.sin(t * Math.PI) * 14;
        const r = this.cs * 0.44 * (1 - 0.5 * t);
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      } else if (f.kind === "pellet") {
        const x = lerp(f.x0, f.x, t), y = lerp(f.y0, f.y, t);
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      } else if (f.kind === "spark") {
        const s = (now - f.t0), x = f.x + f.vx * s, y = f.y + f.vy * s + 0.5 * (f.g || 0) * s * s;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = f.color;
        ctx.fillRect(x - f.s / 2, y - f.s / 2, f.s, f.s); ctx.globalAlpha = 1;
      } else if (f.kind === "leave") {
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, 10 + t * 26, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    this.fx = keep;
  }

  drawHint(now) {
    const g = this.game, m = this.hint, t = now - this.hintT0;
    if (t > 4 || g.where[m] === undefined) { this.hint = -1; return; }
    let p;
    if (g.where[m] === BAY) p = this.bayPoint(g.bays.indexOf(m));
    else if (g.where[m] === YARD) p = this.yardPoint(m);
    else { this.hint = -1; return; }
    const ctx = this.ctx, r = 30 + 6 * Math.sin(t * 7);
    ctx.strokeStyle = "#ff3d7f"; ctx.lineWidth = 4; ctx.globalAlpha = Math.min(1, 4 - t);
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  }
}

// ---- Shapes ----------------------------------------------------------------------------------------------------
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
/** A bus from above, nose along +x, centred. */
function bus(ctx, L, W, hex) {
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath(); rr(ctx, -L / 2 + 1, -W / 2 + 3, L, W, W * 0.28); ctx.fill();
  ctx.fillStyle = shade(hex, -0.25);
  ctx.beginPath(); rr(ctx, -L / 2, -W / 2, L, W, W * 0.28); ctx.fill();
  ctx.fillStyle = hex;
  ctx.beginPath(); rr(ctx, -L / 2 + 2, -W / 2 + 2, L - 4, W - 4, W * 0.24); ctx.fill();
  // Windscreen at the nose, a roof stripe.
  ctx.fillStyle = "rgba(30,40,60,.55)";
  ctx.beginPath(); rr(ctx, L / 2 - W * 0.42, -W / 2 + 4, W * 0.26, W - 8, 3); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.fillRect(-L / 2 + 5, -W / 2 + 4, L - W * 0.6 - 6, 3);
}
/** The capacity in a round chip. */
function chip(ctx, label, ink, hex, size) {
  ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = Math.max(size * 1.35, ctx.measureText(label).width + 8);
  ctx.fillStyle = ink === "#ffffff" ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.7)";
  ctx.beginPath(); rr(ctx, -w / 2, -size * 0.68, w, size * 1.36, size * 0.68); ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(label, 0, 1);
}
/** A round critter with big eyes that look along `angle` (towards the picture on the loop). */
function critter(ctx, r, hex, angle, label, ink, hidden) {
  ctx.fillStyle = "rgba(0,0,0,.2)";
  ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.85, r * 0.28, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(hex, -0.22);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = hex;
  ctx.beginPath(); ctx.arc(0, -r * 0.06, r * 0.92, 0, TAU); ctx.fill();
  // Ears.
  ctx.beginPath(); ctx.arc(-r * 0.62, -r * 0.7, r * 0.26, 0, TAU); ctx.arc(r * 0.62, -r * 0.7, r * 0.26, 0, TAU); ctx.fill();
  if (!hidden) {
    // Eyes looking inward (towards the picture): to the right of the direction of travel.
    const la = angle + Math.PI / 2, ox = Math.cos(la) * r * 0.1, oy = Math.sin(la) * r * 0.1;
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s * r * 0.34, -r * 0.3, r * 0.24, 0, TAU); ctx.fill();
      ctx.fillStyle = "#23212b"; ctx.beginPath(); ctx.arc(s * r * 0.34 + ox, -r * 0.3 + oy, r * 0.12, 0, TAU); ctx.fill();
    }
  }
  ctx.font = `800 ${Math.max(10, Math.round(r * 0.72))}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.fillText(label, 0, hidden ? 0 : r * 0.36);
}
