// Drawing: deep space behind a glass field, glossy bubbles (each colour with its own symbol, so colour
// is never the only clue), asteroids, ice, little aliens to rescue, the launcher, the aim line and the
// effects (pops, falling bubbles, points). Plain 2D canvas. Bubbles are drawn once per size into small
// sprites; the starfield is drawn once per resize. Nothing is drawn while nothing moves.
import { CONFIG } from "./config.js";
import { STONE, ICE, snap } from "./grid.js";

const { R, D, RH, width: W, height: H } = CONFIG;

export const COLOURS = [
  { fill: "#ff4f6d", dark: "#a3143a", name: "red" },
  { fill: "#ffa133", dark: "#a4520a", name: "orange" },
  { fill: "#ffe14a", dark: "#9c7c00", name: "yellow" },
  { fill: "#3fdc8b", dark: "#0e7a46", name: "green" },
  { fill: "#3ea4ff", dark: "#0b4f9c", name: "blue" },
  { fill: "#b57bff", dark: "#5a22a8", name: "purple" },
];

/** 24×24 line icons for the powers (also used by the tray buttons in the page). */
export const POWER_ICONS = {
  bomb: "M10.5 8.5a6.5 6.5 0 1 0 4 1.3M14.5 9.8l2.6-2.6M18.5 3.5v2M21 6h-2M20.3 4.2l-1.4 1.4",
  prism: "M12 3.5l8 15H4zM12 3.5v15M4 18.5l8-6 8 6",
  laser: "M2.5 12h19M6.5 8l-4 4 4 4M17.5 8l4 4-4 4",
  comet: "M14 10a3.6 3.6 0 1 0 .01 0M11.2 12.8L3.5 20.5M9 10.5l-5 5M13.5 15l-5 5",
  blackhole: "M12 9a3 3 0 1 1 0 6 3 3 0 1 1 0-6M2.5 12c3.2-5.5 15.8-5.5 19 0-3.2 5.5-15.8 5.5-19 0",
  freeze: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5",
};
export function powerSvg(p, cls = "") {
  return `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${POWER_ICONS[p]}"/></svg>`;
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The symbol inside each colour, in a unit circle. */
function symbol(ctx, i, s) {
  ctx.beginPath();
  switch (i) {
    case 0: ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); ctx.moveTo(s * 0.2, 0); ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2, true); break; // ring
    case 1: ctx.moveTo(0, -s * 0.48); ctx.lineTo(s * 0.45, s * 0.32); ctx.lineTo(-s * 0.45, s * 0.32); ctx.closePath(); break; // triangle
    case 2: for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? s * 0.22 : s * 0.5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); break; // star
    case 3: ctx.rect(-s * 0.34, -s * 0.34, s * 0.68, s * 0.68); break; // square
    case 4: ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.4, 0); ctx.lineTo(0, s * 0.5); ctx.lineTo(-s * 0.4, 0); ctx.closePath(); break; // diamond
    case 5: { const a = s * 0.15, b = s * 0.45; ctx.moveTo(-a, -b); ctx.lineTo(a, -b); ctx.lineTo(a, -a); ctx.lineTo(b, -a); ctx.lineTo(b, a); ctx.lineTo(a, a); ctx.lineTo(a, b); ctx.lineTo(-a, b); ctx.lineTo(-a, a); ctx.lineTo(-b, a); ctx.lineTo(-b, -a); ctx.lineTo(-a, -a); ctx.closePath(); break; } // plus
  }
}

/** A glossy bubble of colour i (or a stone, -1) at the origin with radius r. */
function paintBubble(ctx, i, r, kind) {
  if (kind === STONE) {
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, "#a9a3b8"); g.addColorStop(1, "#4a4558");
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2, rr = r * (0.9 + 0.1 * Math.sin(k * 2.7)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(40,36,52,.55)";
    for (const [x, y, s] of [[-0.3, -0.2, 0.22], [0.35, 0.2, 0.16], [-0.05, 0.45, 0.12], [0.25, -0.4, 0.1]]) { ctx.beginPath(); ctx.arc(x * r, y * r, s * r, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  const C = COLOURS[i] || COLOURS[0];
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.18, C.fill); g.addColorStop(0.85, C.fill); g.addColorStop(1, C.dark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.dark; ctx.globalAlpha = 0.55;
  symbol(ctx, i, r * 0.95); ctx.fill("evenodd");
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath(); ctx.ellipse(-r * 0.36, -r * 0.46, r * 0.26, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  if (kind === ICE) {
    ctx.fillStyle = "rgba(214,244,255,.72)";
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.1); ctx.lineTo(-r * 0.1, r * 0.25); ctx.lineTo(r * 0.5, -r * 0.35); ctx.moveTo(-r * 0.1, r * 0.25); ctx.lineTo(r * 0.05, r * 0.7); ctx.stroke();
    ctx.strokeStyle = "#9fe4ff"; ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.93, 0, Math.PI * 2); ctx.stroke();
  }
}

function paintAlien(ctx, r) {
  ctx.fillStyle = "#7dff9a"; ctx.strokeStyle = "#0b3d1c"; ctx.lineWidth = r * 0.08;
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.38); ctx.lineTo(-r * 0.35, -r * 0.7); ctx.moveTo(r * 0.2, -r * 0.38); ctx.lineTo(r * 0.35, -r * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.72, r * 0.09, 0, Math.PI * 2); ctx.arc(r * 0.35, -r * 0.72, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#0b3d1c";
  ctx.beginPath(); ctx.ellipse(-r * 0.18, -r * 0.05, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.18, -r * 0.05, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.16, 0.2, Math.PI - 0.2); ctx.stroke();
}

function paintPower(ctx, p, r) {
  ctx.fillStyle = "rgba(10,12,40,.78)";
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  const k = (r * 0.9) / 12;
  ctx.scale(k, k); ctx.translate(-12, -12);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.stroke(new Path2D(POWER_ICONS[p]));
  ctx.restore();
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.top = 0; this.bottom = 0;
    this.sprites = new Map();
    this.fx = [];          // particles, falling bubbles, texts
    this.shakeUntil = 0;
    this.dispOff = 0;      // the board's offset as shown (slides towards the game's)
    this.lastT = 0;
    this.placed = null;    // { r, c, t } the bubble that just stuck, for its little bounce
    this.warnT = 0;
  }

  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
    this.dpr = dpr; this.w = w; this.h = h;
    const availH = Math.max(200, h - this.top - this.bottom - 8), availW = w - 16;
    this.s = Math.min(availW / W, availH / H, 2.2);
    this.ox = (w - W * this.s) / 2;
    // Low on the screen, so the launcher is close to the thumb.
    this.oy = this.top + Math.max(4, (availH - H * this.s) * 0.85);
    this.sprites.clear();
    this.sky = null;
  }
  /** Page coordinates → field coordinates. */
  toField(px, py) { return { x: (px - this.ox) / this.s, y: (py - this.oy) / this.s }; }
  /** Field coordinates → page coordinates. */
  toPage(x, y) { return { x: this.ox + x * this.s, y: this.oy + y * this.s }; }

  setGame(game) { this.fx = []; this.dispOff = game.offset; this.placed = null; }

  sprite(id, paint) {
    let sp = this.sprites.get(id);
    if (!sp) {
      const px = Math.ceil(D * this.s * this.dpr) + 4;
      sp = document.createElement("canvas");
      sp.width = sp.height = px;
      const c = sp.getContext("2d");
      c.translate(px / 2, px / 2);
      paint(c, (px - 4) / 2);
      this.sprites.set(id, sp);
    }
    return sp;
  }
  bubbleSprite(b) {
    const id = `${b.k}${b.c}${b.crit ? "a" : ""}${b.p || ""}`;
    return this.sprite(id, (c, r) => {
      paintBubble(c, b.c, r, b.k);
      if (b.crit) paintAlien(c, r * 0.8);
      if (b.p) paintPower(c, b.p, r);
    });
  }
  /** Draw a bubble at field (x, y), scale k. */
  drawBubble(b, x, y, k = 1, alpha = 1) {
    const sp = this.bubbleSprite(b), size = (sp.width / this.dpr / this.s) * k;
    const ctx = this.ctx;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(sp, x - size / 2, y - size / 2, size, size);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  /** Stars, a nebula and a planet, drawn once per resize. */
  drawSky() {
    const c = document.createElement("canvas");
    c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext("2d"), w = c.width, h = c.height;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#090b26"); bg.addColorStop(0.6, "#141038"); bg.addColorStop(1, "#22103f");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const neb = (x, y, r, col) => { const n = g.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, col); n.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = n; g.fillRect(0, 0, w, h); };
    neb(w * 0.85, h * 0.12, w * 0.7, "rgba(255,79,160,.16)");
    neb(w * 0.1, h * 0.7, w * 0.8, "rgba(62,164,255,.14)");
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (w * h) / 2600; i++) {
      const x = rnd() * w, y = rnd() * h, r = rnd() * rnd() * 1.8 * this.dpr + 0.3;
      g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // A ringed planet low on the right.
    const px = w * 0.92, py = h * 0.93, pr = Math.min(w, h) * 0.16;
    const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, "#ffb86b"); pg.addColorStop(1, "#6b2a6e");
    g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,214,160,.45)"; g.lineWidth = pr * 0.08;
    g.beginPath(); g.ellipse(px, py, pr * 1.7, pr * 0.42, -0.35, 0, Math.PI * 2); g.stroke();
    this.sky = c;
  }

  shake(t, ms = 260) { if (!reduced()) this.shakeUntil = t + ms / 1000; }

  /** Turn the game's events into effects. */
  onEvents(events, t, game) {
    const rm = reduced();
    for (const e of events) {
      if (e.type === "land" && e.placed) this.placed = { r: e.placed[0], c: e.placed[1], t };
      else if (e.type === "pop") {
        for (const q of e.list) {
          this.fx.push({ kind: "burst", x: q.x, y: q.y, b: q.b, t0: t, dur: 0.22 });
          const col = q.b.k === STONE ? "#b8b2c8" : (COLOURS[q.b.c] || COLOURS[0]).fill;
          const n = rm ? 2 : 7;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
            this.fx.push({ kind: "spark", x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col, t0: t, dur: 0.45 + Math.random() * 0.25, r: 1.5 + Math.random() * 2.5 });
          }
        }
        if (e.power === "bomb" || e.power === "laser" || e.power === "blackhole") this.shake(t, 320);
        if (e.power) this.fx.push({ kind: "flash", x: e.list[0] ? e.list[0].x : W / 2, y: e.list[0] ? e.list[0].y : 100, p: e.power, t0: t, dur: 0.4 });
      } else if (e.type === "drop") {
        for (const q of e.list) this.fx.push({ kind: "fall", x: q.x, y: q.y, b: q.b, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, t0: t, dur: 2 });
      } else if (e.type === "points") this.fx.push({ kind: "text", x: e.x, y: e.y, text: "+" + e.points.toLocaleString(), t0: t, dur: 0.9, col: "#fff" });
      else if (e.type === "free") this.fx.push({ kind: "alien", x: e.x, y: e.y, t0: t, dur: 1.4 });
      else if (e.type === "power") this.fx.push({ kind: "picked", x: e.x, y: e.y, p: e.p, t0: t, dur: 0.9 });
      else if (e.type === "push") { this.dispOff -= RH; }
      else if (e.type === "ceiling") this.shake(t, 200);
      else if (e.type === "newStage") { this.dispOff = game.offset; this.placed = null; }
    }
  }

  busy(t) { return this.fx.length > 0 || Math.abs(this.dispOff - this.target) > 0.3 || t < this.shakeUntil || (this.placed && t - this.placed.t < 0.3); }

  /**
   * Draw a frame. `ui`: { angle (the aim, or null while not aiming), full (Aim+: the whole path and
   * where it sticks), flight ({ tr, t0, dur, shot } while a shot flies), danger (0..1) }.
   */
  draw(game, ui, t) {
    const ctx = this.ctx, dt = Math.min(0.05, this.lastT ? t - this.lastT : 0);
    this.lastT = t;
    if (!this.sky) this.drawSky();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.sky, 0, 0);
    if (!game) return;
    this.target = game.offset;
    this.dispOff += (this.target - this.dispOff) * Math.min(1, dt * CONFIG.ease);
    if (Math.abs(this.target - this.dispOff) < 0.3) this.dispOff = this.target;

    let sx = 0, sy = 0;
    if (t < this.shakeUntil) { const k = (this.shakeUntil - t) * 14; sx = (Math.random() - 0.5) * k; sy = (Math.random() - 0.5) * k; }
    const s = this.s * this.dpr;
    ctx.setTransform(s, 0, 0, s, (this.ox + sx) * this.dpr, (this.oy + sy) * this.dpr);

    // The field: dark glass, the ceiling, the line.
    ctx.fillStyle = "rgba(6,8,30,.55)";
    roundRect(ctx, -6, -6, W + 12, H + 10, 14); ctx.fill();
    ctx.strokeStyle = "rgba(150,170,255,.22)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(-6, -6, W + 12, H + 10); ctx.clip();

    const off = this.dispOff, g = game.grid;
    if (game.mode === "classic" && off > 0.5) this.drawCeiling(off);
    if (game.mode === "levels" && game.scroll > 0) {
      const fade = ctx.createLinearGradient(0, 0, 0, 40);
      fade.addColorStop(0, "rgba(160,190,255,.25)"); fade.addColorStop(1, "rgba(160,190,255,0)");
      ctx.fillStyle = fade; ctx.fillRect(0, 0, W, 40);
    }
    if (game.mode !== "levels") this.drawLine(ui.danger || 0, t);

    // The board.
    const first = Math.max(0, Math.floor((-off - D) / RH)), last = Math.min(g.rows.length - 1, Math.ceil((H - off) / RH));
    for (let r = first; r <= last; r++) {
      const y = g.y(r) + off;
      for (let c = 0; c < g.width(r); c++) {
        const b = g.get(r, c);
        if (!b) continue;
        let k = 1;
        if (this.placed && this.placed.r === r && this.placed.c === c) { const a = (t - this.placed.t) / 0.3; if (a < 1) k = 1 + Math.sin(a * Math.PI) * 0.12; }
        this.drawBubble(b, g.x(r, c), y, k);
      }
    }

    // Aim line and the shot in flight.
    if (ui.angle != null && game.status === "play" && !ui.flight) this.drawAim(game, ui.angle, ui.full);
    if (ui.flight) {
      const f = ui.flight, a = Math.min(1, (t - f.t0) / f.dur);
      const p = along(f.tr.pts, a);
      const shot = f.shot.p ? { c: 0, k: "n", p: f.shot.p } : { c: f.shot.c, k: "n" };
      if (f.shot.p === "comet") this.drawComet(f.tr.pts, a);
      else this.drawBubble(shot, p[0], p[1] + off);
    }
    this.drawFx(dt, t);
    ctx.restore();
    this.drawLauncher(game, ui);
  }

  drawCeiling(h) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#3a3f6e"); g.addColorStop(1, "#5d6496");
    ctx.fillStyle = g; ctx.fillRect(-6, -6, W + 12, h + 6);
    ctx.fillStyle = "#8f97c8";
    ctx.fillRect(-6, h - 3, W + 12, 3);
    ctx.fillStyle = "rgba(20,22,50,.6)";
    for (let x = 14; x < W; x += 28) { ctx.beginPath(); ctx.arc(x, h - 9, 2, 0, Math.PI * 2); ctx.fill(); }
  }

  drawLine(danger, t) {
    const ctx = this.ctx, y = R + (CONFIG.lineRow - 1) * RH + R + 1;
    const pulse = danger > 0 ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
    ctx.strokeStyle = danger > 0 ? `rgba(255,${90 - 60 * danger},${110 - 60 * danger},${0.5 + 0.4 * pulse})` : "rgba(160,180,255,.28)";
    ctx.lineWidth = danger > 0 ? 2 : 1.2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawAim(game, angle, full) {
    const ctx = this.ctx, tr = game.aim(angle), off = this.dispOff;
    // Walk the path: a dot every 14 units, up to `aimAfterBounce` past the first bounce (all of it with Aim+).
    const pts = tr.pts;
    let walked = 0, afterBounce = -1, limit = full ? Infinity : CONFIG.aimAfterBounce;
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = (14 - (walked % 14)) % 14; d < len; d += 14) {
        const at = walked + d;
        if (afterBounce >= 0 && at - afterBounce > limit) { i = pts.length; break; }
        const k = d / len, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k + off;
        const fade = afterBounce >= 0 && !full ? 1 - (at - afterBounce) / limit : 1;
        ctx.globalAlpha = 0.25 + 0.6 * fade;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      walked += len;
      if (afterBounce < 0 && i < pts.length - 1) afterBounce = walked;
    }
    ctx.globalAlpha = 1;
    if (full && game.armedPower() !== "comet") {
      const cell = snap(game.grid, tr.x, tr.y);
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(game.grid.x(cell[0], cell[1]), game.grid.y(cell[0]) + off, R - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawComet(pts, a) {
    const ctx = this.ctx, off = this.dispOff;
    for (let i = 0; i < 8; i++) {
      const p = along(pts, Math.max(0, a - i * 0.025));
      ctx.fillStyle = `rgba(255,${180 - i * 15},80,${0.8 - i * 0.09})`;
      ctx.beginPath(); ctx.arc(p[0], p[1] + off, R * (1 - i * 0.09), 0, Math.PI * 2); ctx.fill();
    }
  }

  drawLauncher(game, ui) {
    const ctx = this.ctx, cx = W / 2, cy = CONFIG.launchY;
    const angle = ui.angle != null ? Math.max(-CONFIG.maxAngle, Math.min(CONFIG.maxAngle, ui.angle)) : 0;
    // Base
    const base = ctx.createLinearGradient(0, cy, 0, cy + 40);
    base.addColorStop(0, "#5b62a3"); base.addColorStop(1, "#2a2d5c");
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.ellipse(cx, cy + 24, 44, 16, 0, 0, Math.PI * 2); ctx.fill();
    // Barrel
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.fillStyle = "#c7cdf5"; roundRect(ctx, -7, -R - 18, 14, 22, 4); ctx.fill();
    ctx.fillStyle = "#7a81c4"; ctx.fillRect(-7, -R - 18, 14, 4);
    ctx.restore();
    ctx.strokeStyle = "rgba(160,200,255,.55)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2); ctx.stroke();
    // The loaded bubble (or the armed power), and the next one.
    if (game.status === "play" || game.status === "stage") {
      const p = game.armedPower();
      if (!ui.flight || p) this.drawBubble(p ? { c: game.current, k: "n", p } : { c: game.current, k: "n" }, cx, cy);
      if (p) {
        ctx.strokeStyle = "#ffe14a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const nx = cx - 64, ny = cy + 18;
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.arc(nx, ny, R * 0.95, 0, Math.PI * 2); ctx.fill();
    this.drawBubble({ c: game.next, k: "n" }, nx, ny, 0.7);
    // Swap arrows between them.
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx - 34, cy + 10, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 27, cy + 3); ctx.lineTo(cx - 26, cy + 8); ctx.lineTo(cx - 31, cy + 8); ctx.stroke();
    // Shots before the ceiling drops (Classic) or the next row comes (Endless): pips on the right.
    if (game.mode !== "levels") {
      const left = game.shotsToMove(), total = game.mode === "classic" ? game.missLimit() : game.pushEvery();
      const px = cx + 50, py = cy + 18;
      for (let i = 0; i < total; i++) {
        const x = px + (i % 4) * 10, y = py + Math.floor(i / 4) * 10 - (total > 4 ? 5 : 0);
        ctx.fillStyle = game.freeze > 0 ? "#9fe4ff" : i < left ? (left <= 2 ? "#ff6b81" : "#ffe14a") : "rgba(255,255,255,.18)";
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawFx(dt, t) {
    const ctx = this.ctx, keep = [];
    for (const f of this.fx) {
      const a = (t - f.t0) / f.dur;
      if (a >= 1 || a < -0.01) { if (a < 1) keep.push(f); continue; }
      if (f.kind === "burst") this.drawBubble(f.b, f.x, f.y, 1 + a * 0.5, 1 - a);
      else if (f.kind === "spark") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt;
        ctx.globalAlpha = 1 - a; ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.kind === "fall") {
        f.vy += CONFIG.fallGravity * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.y > H + 40) continue;
        this.drawBubble(f.b, f.x, f.y, 1, 1);
      } else if (f.kind === "text") {
        ctx.globalAlpha = 1 - a * a; ctx.fillStyle = f.col;
        ctx.font = "700 15px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(10,10,40,.8)";
        ctx.strokeText(f.text, f.x, f.y - a * 30); ctx.fillText(f.text, f.x, f.y - a * 30); ctx.globalAlpha = 1;
      } else if (f.kind === "alien") {
        ctx.save(); ctx.translate(f.x + Math.sin(a * 12) * 6, f.y - a * 160); ctx.globalAlpha = 1 - a * a;
        paintAlien(ctx, R * 0.9); ctx.restore(); ctx.globalAlpha = 1;
      } else if (f.kind === "picked") {
        ctx.save(); ctx.translate(f.x, f.y - a * 50); ctx.globalAlpha = 1 - a;
        ctx.fillStyle = "rgba(255,225,74,.3)"; ctx.beginPath(); ctx.arc(0, 0, R * (1 + a), 0, Math.PI * 2); ctx.fill();
        paintPower(ctx, f.p, R * 1.1); ctx.restore(); ctx.globalAlpha = 1;
      } else if (f.kind === "flash") {
        ctx.globalAlpha = (1 - a) * 0.5; ctx.fillStyle = f.p === "blackhole" ? "#6a2cff" : f.p === "laser" ? "#ff4f6d" : "#fff1a8";
        ctx.beginPath(); ctx.arc(f.x, f.y, R * (1 + a * 5), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      keep.push(f);
    }
    this.fx = keep;
  }
}

/** The point a fraction `a` along a polyline. */
export function along(pts, a) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let want = total * a;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= len || i === pts.length - 1) {
      const k = len ? Math.min(1, want / len) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    }
    want -= len;
  }
  return pts[pts.length - 1];
}
export function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
