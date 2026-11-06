// Drawing: one 2D canvas, the 360 × 640 world scaled to fit the screen. Reads the engine's state
// every frame and never changes it. Particles, shake and floating text live here, fed by the
// engine's events. Looks (themes, brick sets, skins, trails) come from the equipped cosmetics.
import { CONFIG } from "./config.js";
import { sweepRect } from "./collide.js";

const WD = CONFIG.world;
const TAU = Math.PI * 2;

// ---- Looks -------------------------------------------------------------------------------------------
export const THEMES = {
  "theme.night": { bg: ["#0b1020", "#18203f"], frame: "#2b3566", glow: "#7aa2ff" },
  "theme.ocean": { bg: ["#031a26", "#0b3f55"], frame: "#1d5f78", glow: "#5ee7ff" },
  "theme.dusk": { bg: ["#22102e", "#5a2440"], frame: "#7a3a5c", glow: "#ffb08a" },
  "theme.forest": { bg: ["#0b1a12", "#1e3a28"], frame: "#2f5a3d", glow: "#9be89b" },
  "theme.space": { bg: ["#020206", "#0d0a24"], frame: "#2a2550", glow: "#c9b8ff", stars: true },
};
export const BRICK_SETS = {
  "bricks.neon": ["#ff4d6d", "#ff9f1c", "#ffd60a", "#4ade80", "#22d3ee", "#818cf8", "#e879f9"],
  "bricks.pastel": ["#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#a0c4ff", "#bdb2ff"],
  "bricks.earth": ["#c2703d", "#d9a05b", "#a3b18a", "#588157", "#8d6e63", "#bc8a5f", "#6b705c"],
  "bricks.glass": ["#7dd3fc", "#a5b4fc", "#c4b5fd", "#f0abfc", "#99f6e4", "#bae6fd", "#ddd6fe"],
  "bricks.gold": ["#f6d365", "#e9b949", "#d4a017", "#f8e08e", "#c9a227", "#ffe5a0", "#b8860b"],
};
// Okabe–Ito colours: told apart with every common kind of colour blindness.
const CB_SET = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"];
const BALLS = {
  "ball.classic": { fill: "#ffffff" }, "ball.pearl": { fill: "#f3e8ff", ring: "#c4b5fd" },
  "ball.ember": { fill: "#ffb36b", glow: "#ff6a00" }, "ball.ringed": { fill: "#ffffff", ring: "#22d3ee" },
  "ball.star": { fill: "#ffe066", star: true },
};
const PADDLES = {
  "paddle.classic": ["#e2e8f0", "#94a3b8"], "paddle.mint": ["#a7f3d0", "#34d399"], "paddle.candy": ["#fecdd3", "#fb7185", "stripes"],
  "paddle.chrome": ["#ffffff", "#64748b", "chrome"], "paddle.aurora": ["#a78bfa", "#22d3ee", "aurora"],
};
export const CAPSULE_COLORS = {
  multi2: "#60a5fa", multi3: "#3b82f6", sticky: "#a3e635", fire: "#fb923c", big: "#f472b6", slow: "#2dd4bf", magnet: "#f87171",
  wide: "#34d399", laser: "#facc15", twin: "#c084fc", net: "#38bdf8", bomb: "#94a3b8", lightning: "#fde047", gravity: "#a78bfa",
  score2: "#fbbf24", life: "#fb7185",
  surge: "#ef4444", tiny: "#ef4444", armor: "#ef4444", blackout: "#ef4444", wild: "#ef4444", allin: "#ef4444",
};

// ---- Icons: tiny vector pictures for every capsule, used on the canvas and in the menus -------------
export function drawIcon(c, id, x, y, s, color = "#fff") {
  c.save();
  c.translate(x, y);
  c.scale(s / 20, s / 20);
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
  const circle = (cx, cy, r, fill = true) => { c.beginPath(); c.arc(cx, cy, r, 0, TAU); fill ? c.fill() : c.stroke(); };
  const line = (...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
  switch (id) {
    case "multi2": circle(-4, 2, 3.6); circle(4, -2, 3.6); break;
    case "multi3": circle(-5.5, 3, 3); circle(5.5, 3, 3); circle(0, -4.5, 3); break;
    case "sticky": line(-8, -2, -8, 5, 8, 5, 8, -2); c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(4, -2, 0, 1); c.quadraticCurveTo(-4, -2, 0, -8); c.fill(); break;
    case "fire": c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(8, 0, 4, 7); c.quadraticCurveTo(0, 10, -4, 7); c.quadraticCurveTo(-8, 0, 0, -9); c.fill(); break;
    case "big": circle(0, 0, 7.5); break;
    case "slow": line(-8, -3, -4, -6, 0, -3, 4, -6, 8, -3); line(-8, 4, -4, 1, 0, 4, 4, 1, 8, 4); break;
    case "magnet": c.lineWidth = 4; line(-6, -7, -6, 1); c.beginPath(); c.arc(0, 1, 6, Math.PI, 0, true); c.stroke(); line(6, 1, 6, -7); break;
    case "wide": line(-9, 0, 9, 0); line(-5, -4, -9, 0, -5, 4); line(5, -4, 9, 0, 5, 4); break;
    case "laser": line(-5, 8, -5, -8); line(5, 8, 5, -8); circle(-5, -9, 1.6); circle(5, -9, 1.6); break;
    case "twin": c.fillRect(-9, -5, 7, 4); c.fillRect(2, 1, 7, 4); break;
    case "net": line(-9, 3, 9, 3); line(-9, -2, -6, 3, -3, -2, 0, 3, 3, -2, 6, 3, 9, -2); break;
    case "bomb": circle(-1, 2, 6.5); line(3, -3, 6, -7); circle(7.5, -8.5, 1.6); break;
    case "lightning": c.beginPath(); c.moveTo(2, -10); c.lineTo(-6, 1); c.lineTo(-1, 1); c.lineTo(-3, 10); c.lineTo(6, -2); c.lineTo(1, -2); c.closePath(); c.fill(); break;
    case "gravity": circle(0, 0, 2.5); circle(0, 0, 6, false); c.beginPath(); c.arc(0, 0, 9.5, -0.6, 2.2); c.stroke(); break;
    case "score2": star(c, 0, 0, 9, 4); break;
    case "life": c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-11, 0, -7, -10, 0, -4); c.bezierCurveTo(7, -10, 11, 0, 0, 8); c.fill(); break;
    case "surge": line(-8, -6, -2, 0, -8, 6); line(1, -6, 7, 0, 1, 6); break;
    case "tiny": c.fillRect(-3, -2, 6, 4); line(-10, -5, -6, 0, -10, 5); line(10, -5, 6, 0, 10, 5); break;
    case "armor": c.beginPath(); c.moveTo(0, -9); c.lineTo(8, -5); c.lineTo(7, 3); c.quadraticCurveTo(4, 8, 0, 10); c.quadraticCurveTo(-4, 8, -7, 3); c.lineTo(-8, -5); c.closePath(); c.stroke(); break;
    case "blackout": c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 8, -Math.PI / 2, Math.PI / 2); c.fill(); break;
    case "wild": line(-9, 0, -6, -5, -2, 5, 2, -5, 6, 5, 9, 0); break;
    case "allin": circle(0, 0, 9, false); line(0, -5, 0, 1.5); circle(0, 5.5, 1.5); break;
    case "plus": c.font = "bold 12px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("+1", 0, 1); break;
  }
  c.restore();
}
function star(c, x, y, R, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/** An icon as a data URL, for <img> in the menus. */
const iconCache = new Map();
export function iconURL(id, color = "#fff", size = 40) {
  const k = id + color + size;
  if (iconCache.has(k)) return iconCache.get(k);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  drawIcon(cv.getContext("2d"), id, size / 2, size / 2, size * 0.85, color);
  const url = cv.toDataURL();
  iconCache.set(k, url);
  return url;
}

// ---- Renderer -------------------------------------------------------------------------------------------
export class Renderer {
  constructor(canvas, text) {
    this.cv = canvas;
    this.c = canvas.getContext("2d");
    this.text = text; // (key, vars) → string
    this.parts = [];
    this.floats = [];
    this.zaps = [];
    this.flashes = [];
    this.shake = 0;
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.look = {};
    this.opts = { palette: "default", reducedMotion: false, leftHanded: false, aimAssist: true };
    this.starsBg = Array.from({ length: 60 }, (_, i) => [(i * 97) % 360, (i * 211) % 640, (i % 3) + 0.5]);
  }
  setLook(look) { this.look = look; }
  setOptions(o) { Object.assign(this.opts, o); }

  /** Fit the world into the canvas area below `top` CSS pixels. */
  resize(top = 0, bottom = 0) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.dpr = dpr;
    const avail = Math.max(100, h - top - bottom);
    this.scale = Math.min(w / WD.W, avail / WD.H);
    this.ox = (w - WD.W * this.scale) / 2;
    this.oy = top + (avail - WD.H * this.scale) / 2;
  }
  /** Screen (CSS px) → world. */
  toWorld(x, y) { return [(x - this.ox) / this.scale, (y - this.oy) / this.scale]; }

  // ---- Effects fed by engine events -----------------------------------------------------------------
  burst(x, y, color, n = 10, speed = 120) {
    if (this.opts.reducedMotion) n = Math.ceil(n / 3);
    if (this.parts.length > 420) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 1.5 + Math.random() * 2.2 });
    }
  }
  float(x, y, text, color = "#fff") { this.floats.push({ x, y, text, color, life: 1.1 }); }
  zap(x0, y0, x1, y1) { this.zaps.push({ x0, y0, x1, y1, life: 0.25 }); }
  flash(color, life = 0.25) { if (!this.opts.reducedMotion) this.flashes.push({ color, life, max: life }); }
  addShake(v) { if (!this.opts.reducedMotion) this.shake = Math.min(10, this.shake + v); }
  brickColor(b) {
    const set = this.opts.palette === "cb" ? CB_SET : BRICK_SETS[this.look.bricks] || BRICK_SETS["bricks.neon"];
    return set[((b.r % set.length) + set.length) % set.length];
  }

  tick(dt) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y -= 28 * dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const z of this.zaps) z.life -= dt;
    this.zaps = this.zaps.filter((z) => z.life > 0);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  // ---- The frame --------------------------------------------------------------------------------------
  draw(e, now, extra = {}) {
    const c = this.c, s = this.scale * this.dpr;
    const theme = THEMES[this.look.theme] || THEMES["theme.night"];
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = theme.bg[0];
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    c.setTransform(s, 0, 0, s, (this.ox + sx) * this.dpr, (this.oy + sy) * this.dpr);

    // Playfield
    const g = c.createLinearGradient(0, 0, 0, WD.H);
    g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, WD.W, WD.H);
    if (theme.stars) for (const [x, y, r] of this.starsBg) { c.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(now / 900 + x)})`; c.fillRect(x, y, r, r); }
    c.strokeStyle = theme.frame; c.lineWidth = 3;
    c.beginPath(); c.moveTo(WD.left - 1.5, WD.H); c.lineTo(WD.left - 1.5, WD.top - 1.5); c.lineTo(WD.right + 1.5, WD.top - 1.5); c.lineTo(WD.right + 1.5, WD.H); c.stroke();
    if (!e) { c.setTransform(1, 0, 0, 1, 0, 0); return; }

    c.save();
    c.beginPath(); c.rect(WD.left, WD.top, WD.right - WD.left, WD.H - WD.top); c.clip();
    this.drawBricks(e, now);
    // Descent: the line the wall must not reach.
    if (e.rules.descent) {
      c.strokeStyle = "rgba(255,90,90,0.55)"; c.setLineDash([6, 6]); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(WD.left, CONFIG.descent.failY); c.lineTo(WD.right, CONFIG.descent.failY); c.stroke(); c.setLineDash([]);
    }
    if (e.net > 0) {
      c.strokeStyle = "#38bdf8"; c.lineWidth = 2; c.globalAlpha = 0.7 + 0.3 * Math.sin(now / 150);
      c.beginPath(); for (let x = WD.left; x <= WD.right; x += 12) c.lineTo(x, WD.netY + (x / 12) % 2 * 3); c.stroke(); c.globalAlpha = 1;
    }
    this.drawCapsules(e, now);
    for (const l of e.lasers) { c.fillStyle = "#fde047"; c.fillRect(l.x - 1.2, l.y - 7, 2.4, 9); }
    if (e.rules.play === "paddle") this.drawPaddles(e, now);
    else this.drawLauncher(e, extra.aim, now);
    this.drawBalls(e, now);
    for (const z of this.zaps) {
      c.strokeStyle = `rgba(253,224,71,${z.life * 4})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(z.x0, z.y0);
      for (let k = 1; k < 5; k++) c.lineTo(z.x0 + (z.x1 - z.x0) * k / 5 + (Math.random() - 0.5) * 8, z.y0 + (z.y1 - z.y0) * k / 5 + (Math.random() - 0.5) * 8);
      c.lineTo(z.x1, z.y1); c.stroke();
    }
    for (const p of this.parts) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.color; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    c.globalAlpha = 1;
    c.restore();

    this.drawEffects(e, now);
    this.drawRiskyBanner(e, now);
    c.textAlign = "center"; c.textBaseline = "middle";
    for (const f of this.floats) {
      c.globalAlpha = Math.min(1, f.life * 2);
      c.font = "800 12px system-ui, sans-serif";
      c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.6)"; c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    for (const f of this.flashes) { c.globalAlpha = (f.life / f.max) * 0.35; c.fillStyle = f.color; c.fillRect(0, 0, WD.W, WD.H); }
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawBricks(e, now) {
    const c = this.c;
    const blackout = e.hasRisky("blackout");
    const cb = this.opts.palette === "cb";
    for (const b of e.bricks) {
      if (!b.alive) continue;
      const x = b.x + 1, y = b.y + 1, w = b.w - 2, h = b.h - 2;
      if (y + h < WD.top) continue;
      let col = this.brickColor(b), alpha = 1;
      if (b.t === "ghost") alpha = e.t - b.lastHit < CONFIG.bricks.ghostVisible ? 1 : 0.16;
      c.globalAlpha = alpha;
      if (b.t === "portal") { this.drawPortal(b, now); c.globalAlpha = 1; continue; }
      if (b.t === "plus") { this.drawPlus(b, now); c.globalAlpha = 1; continue; }
      if (b.t === "steel") col = "#9aa4b2";
      else if (b.t === "explosive") col = cb ? "#D55E00" : "#ff5a36";
      else if (b.t === "regen") col = cb ? "#009E73" : "#3ddc84";
      else if (b.t === "gift") col = "#ffd166";
      else if (b.t === "core") col = "#b062ff";
      else if (b.t === "tough") col = shade(col, -0.25);
      if (blackout && b.t !== "steel") {
        c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1;
        c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        c.globalAlpha = 1;
        continue;
      }
      const glass = this.look.bricks === "bricks.glass" && !cb;
      c.fillStyle = glass ? hexA(col, 0.45) : col;
      roundRect(c, x, y, w, h, 2.5); c.fill();
      if (glass) { c.strokeStyle = col; c.lineWidth = 1; c.stroke(); }
      // Light edge on top, shadow below.
      c.fillStyle = "rgba(255,255,255,0.28)"; c.fillRect(x + 2, y + 1, w - 4, 2);
      c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(x + 2, y + h - 2, w - 4, 1.5);
      if (b.flash > 0) { c.fillStyle = `rgba(255,255,255,${b.flash * 5})`; roundRect(c, x, y, w, h, 2.5); c.fill(); }
      this.brickMark(b, x, y, w, h, e, now);
      c.globalAlpha = 1;
    }
  }

  brickMark(b, x, y, w, h, e, now) {
    const c = this.c, cx = x + w / 2, cy = y + h / 2;
    c.strokeStyle = "rgba(0,0,0,0.55)"; c.fillStyle = "rgba(0,0,0,0.55)"; c.lineWidth = 1.2;
    if (e.rules.descent && b.t !== "explosive") {
      c.fillStyle = "#0b1020"; c.font = "800 11px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(Math.ceil(b.hp)), cx, cy + 0.5);
      return;
    }
    switch (b.t) {
      case "tough": {
        const dmg = b.maxHp - b.hp;
        c.beginPath(); // dots for remaining hits, cracks for damage taken
        for (let i = 0; i < Math.ceil(b.hp); i++) { c.moveTo(cx - (Math.ceil(b.hp) - 1) * 3 + i * 6 + 1.3, cy); c.arc(cx - (Math.ceil(b.hp) - 1) * 3 + i * 6, cy, 1.3, 0, TAU); }
        c.fill();
        if (dmg > 0) { c.beginPath(); c.moveTo(x + 4, y + 2); c.lineTo(x + 9, cy); c.lineTo(x + 6, y + h - 2); if (dmg > 1) { c.moveTo(x + w - 4, y + 2); c.lineTo(x + w - 9, cy + 1); c.lineTo(x + w - 5, y + h - 1); } c.stroke(); }
        break;
      }
      case "steel": for (const [px, py] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) { c.beginPath(); c.arc(px, py, 1, 0, TAU); c.fill(); } break;
      case "explosive": drawIcon(c, "bomb", cx, cy, 10, "rgba(0,0,0,0.6)"); break;
      case "regen": {
        c.beginPath(); c.moveTo(cx - 3.5, cy); c.lineTo(cx + 3.5, cy); c.moveTo(cx, cy - 3.5); c.lineTo(cx, cy + 3.5); c.stroke();
        if (b.hp < b.maxHp) { c.fillStyle = "rgba(255,255,255,0.6)"; c.fillRect(x + 2, y + h - 2.5, (w - 4) * (b.regenT / CONFIG.bricks.regenSeconds), 1.5); }
        break;
      }
      case "moving": c.beginPath(); c.moveTo(x + 7, cy - 3); c.lineTo(x + 3, cy); c.lineTo(x + 7, cy + 3); c.moveTo(x + w - 7, cy - 3); c.lineTo(x + w - 3, cy); c.lineTo(x + w - 7, cy + 3); c.stroke(); break;
      case "gift": c.fillStyle = "rgba(200,40,80,0.8)"; c.fillRect(cx - 1.5, y, 3, h); c.fillRect(x, cy - 1.5, w, 3); break;
      case "ghost": c.strokeStyle = "rgba(255,255,255,0.7)"; c.setLineDash([2, 2]); c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); c.setLineDash([]); break;
      case "core": {
        const f = b.hp / b.maxHp;
        c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x + 6, y + 4, w - 12, 4);
        c.fillStyle = f > 0.5 ? "#4ade80" : f > 0.25 ? "#facc15" : "#ef4444"; c.fillRect(x + 6, y + 4, (w - 12) * f, 4);
        // The weak spot: an eye on the underside.
        const pulse = 0.6 + 0.4 * Math.sin(now / 200);
        c.fillStyle = `rgba(255,240,120,${pulse})`;
        c.beginPath(); c.ellipse(cx, y + h - 6, w / 4, 4, 0, 0, TAU); c.fill();
        c.fillStyle = "#1a0b2e"; c.beginPath(); c.arc(cx, y + h - 6, 2.5, 0, TAU); c.fill();
        break;
      }
    }
  }

  drawPortal(b, now) {
    const c = this.c, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const col = b.pair === 1 ? "#22d3ee" : "#f472b6";
    c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); c.ellipse(cx, cy, b.w / 2 - 2, b.h / 2 - 1, 0, 0, TAU); c.stroke();
    c.setLineDash([3, 4]); c.lineDashOffset = -now / 40;
    c.beginPath(); c.ellipse(cx, cy, b.w / 2 - 6, b.h / 2 - 3.5, 0, 0, TAU); c.stroke(); c.setLineDash([]);
    c.fillStyle = hexA(col, 0.18); c.beginPath(); c.ellipse(cx, cy, b.w / 2 - 2, b.h / 2 - 1, 0, 0, TAU); c.fill();
  }
  drawPlus(b, now) {
    const c = this.c, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    c.strokeStyle = "#fde047"; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, 8 + Math.sin(now / 200), 0, TAU); c.stroke();
    drawIcon(c, "plus", cx, cy, 16, "#fde047");
  }

  drawCapsules(e, now) {
    const c = this.c, W = CONFIG.physics.capsuleW, H = CONFIG.physics.capsuleH;
    for (const k of e.capsules) {
      const col = CAPSULE_COLORS[k.id];
      roundRect(c, k.x - W / 2, k.y - H / 2, W, H, H / 2);
      c.fillStyle = k.risky ? "#3a0d10" : col; c.fill();
      if (k.risky) {
        c.strokeStyle = `rgba(255,60,60,${0.55 + 0.45 * Math.sin(now / 110)})`; c.lineWidth = 2.2 + Math.sin(now / 110); c.stroke();
        drawIcon(c, k.id, k.x, k.y, 11, "#ff8a80");
        // Say exactly what it does before it's caught.
        const label = this.text("risky." + k.id + ".short");
        c.font = "700 8.5px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "top";
        const tw = c.measureText(label).width + 8;
        c.fillStyle = "rgba(20,4,6,0.85)"; roundRect(c, k.x - tw / 2, k.y + H / 2 + 2, tw, 12, 4); c.fill();
        c.fillStyle = "#ffb4ab"; c.fillText(label, k.x, k.y + H / 2 + 4);
      } else {
        c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 1; c.stroke();
        drawIcon(c, k.id, k.x, k.y, 10, "#0b1020");
      }
    }
  }

  drawPaddles(e, now) {
    const c = this.c;
    const skin = PADDLES[this.look.paddle] || PADDLES["paddle.classic"];
    for (const p of e.paddles()) {
      const x = p.x - p.w / 2;
      let g = c.createLinearGradient(0, p.y, 0, p.y + p.h);
      if (skin[2] === "aurora") { g = c.createLinearGradient(x, 0, x + p.w, 0); const h = (now / 20) % 360; g.addColorStop(0, `hsl(${h},90%,70%)`); g.addColorStop(1, `hsl(${(h + 120) % 360},90%,65%)`); }
      else if (skin[2] === "chrome") { g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#cbd5e1"); g.addColorStop(0.55, "#64748b"); g.addColorStop(1, "#e2e8f0"); }
      else { g.addColorStop(0, skin[0]); g.addColorStop(1, skin[1]); }
      c.globalAlpha = p.twin ? 0.75 : 1;
      c.fillStyle = g; roundRect(c, x, p.y, p.w, p.h, p.h / 2); c.fill();
      if (skin[2] === "stripes") { c.save(); roundRect(c, x, p.y, p.w, p.h, p.h / 2); c.clip(); c.fillStyle = "rgba(255,255,255,0.55)"; for (let k = -2; k < p.w / 6 + 2; k++) { c.beginPath(); c.moveTo(x + k * 8, p.y + p.h); c.lineTo(x + k * 8 + 4, p.y + p.h); c.lineTo(x + k * 8 + 10, p.y); c.lineTo(x + k * 8 + 6, p.y); c.fill(); } c.restore(); }
      if (e.has("laser")) { c.fillStyle = "#facc15"; c.fillRect(x + 3, p.y - 3, 4, 4); c.fillRect(x + p.w - 7, p.y - 3, 4, 4); }
      if (e.has("sticky")) { c.fillStyle = "rgba(163,230,53,0.8)"; c.fillRect(x + 4, p.y - 1, p.w - 8, 2); }
      c.globalAlpha = 1;
    }
  }

  drawLauncher(e, aim, now) {
    const c = this.c, L = e.launcher;
    if (e.state === "aim" && aim != null) {
      const pts = this.tracePath(e, aim, this.opts.aimAssist ? 3 : 1, this.opts.aimAssist ? 900 : 140);
      c.fillStyle = "rgba(255,255,255,0.8)";
      for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); }
    }
    c.fillStyle = e.state === "aim" ? "#ffffff" : "rgba(255,255,255,0.4)";
    c.beginPath(); c.arc(L.x, L.y, CONFIG.physics.ballRadius, 0, TAU); c.fill();
    c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "700 10px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "top";
    if (e.volley > 1) c.fillText("×" + e.volley, L.x, L.y + 9);
  }
  /** Dots along the path a shot would take, bouncing off walls and bricks (aim assist). */
  tracePath(e, angle, bounces, maxLen) {
    const r = CONFIG.physics.ballRadius;
    let x = e.launcher.x, y = e.launcher.y - r, vx = Math.sin(angle), vy = -Math.cos(angle);
    const pts = [];
    let len = 0, carry = 0;
    for (let k = 0; k < bounces && len < maxLen; k++) {
      const D = 1200;
      let best = null;
      const consider = (h) => { if (h && h.t > 1e-4 && (!best || h.t < best.t)) best = h; };
      if (vx < 0) consider({ t: (WD.left + r - x) / (vx * D), nx: 1, ny: 0 });
      if (vx > 0) consider({ t: (WD.right - r - x) / (vx * D), nx: -1, ny: 0 });
      if (vy < 0) consider({ t: (WD.top + r - y) / (vy * D), nx: 0, ny: 1 });
      for (const b of e.bricks) if (b.alive && b.t !== "plus" && b.t !== "portal" && (b.t !== "ghost" || e.t - b.lastHit < 1)) consider(sweepRect(x, y, vx * D, vy * D, r, b.x, b.y, b.x + b.w, b.y + b.h));
      const t = best ? Math.min(1, best.t) : 1;
      const seg = D * t;
      for (let d = 10 - carry; d < seg && len + d < maxLen; d += 10) pts.push([x + vx * d, y + vy * d]);
      carry = (seg + carry) % 10;
      len += seg;
      x += vx * seg; y += vy * seg;
      if (!best) break;
      const dot = vx * best.nx + vy * best.ny;
      vx -= 2 * dot * best.nx; vy -= 2 * dot * best.ny;
    }
    return pts;
  }

  drawBalls(e, now) {
    const c = this.c;
    const skin = BALLS[this.look.ball] || BALLS["ball.classic"];
    const trail = this.look.trail || "trail.none";
    const fire = e.has("fire");
    for (const b of e.balls) {
      // Trail
      if (!b.stuck && trail !== "trail.none") {
        b.trail.push([b.x, b.y]);
        if (b.trail.length > (trail === "trail.comet" ? 14 : 10)) b.trail.shift();
        const n = b.trail.length;
        if (trail === "trail.line" || trail === "trail.ribbon") {
          c.lineCap = "round";
          for (let i = 1; i < n; i++) {
            c.strokeStyle = hexA(skin.glow || "#ffffff", (i / n) * 0.5);
            c.lineWidth = trail === "trail.ribbon" ? b.r * 1.6 * (i / n) : 2;
            c.beginPath(); c.moveTo(b.trail[i - 1][0], b.trail[i - 1][1]); c.lineTo(b.trail[i][0], b.trail[i][1]); c.stroke();
          }
        } else if (trail === "trail.dots") {
          for (let i = 0; i < n; i += 2) { c.fillStyle = hexA("#ffffff", (i / n) * 0.6); c.beginPath(); c.arc(b.trail[i][0], b.trail[i][1], 1.6, 0, TAU); c.fill(); }
        } else if (trail === "trail.comet") {
          for (let i = 0; i < n; i++) { c.fillStyle = `hsla(${(now / 8 + i * 20) % 360},90%,65%,${(i / n) * 0.55})`; c.beginPath(); c.arc(b.trail[i][0], b.trail[i][1], b.r * (i / n), 0, TAU); c.fill(); }
        }
      }
      if (fire) { c.fillStyle = "rgba(255,120,30,0.35)"; c.beginPath(); c.arc(b.x, b.y, b.r + 4 + Math.sin(now / 50), 0, TAU); c.fill(); }
      if (skin.glow) { c.fillStyle = hexA(skin.glow, 0.3); c.beginPath(); c.arc(b.x, b.y, b.r + 3, 0, TAU); c.fill(); }
      c.fillStyle = fire ? "#ffb347" : skin.fill;
      if (skin.star) { star(c, b.x, b.y, b.r + 1.5, b.r * 0.55); }
      else { c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); }
      if (skin.ring) { c.strokeStyle = skin.ring; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, b.r - 1.5, 0, TAU); c.stroke(); }
      if (e.bomb) { c.fillStyle = "#0b1020"; c.beginPath(); c.arc(b.x, b.y, b.r * 0.45, 0, TAU); c.fill(); }
    }
  }

  /** Active effects along the top: an icon with a ring that drains, and the credit multiplier. */
  drawEffects(e, now) {
    const c = this.c;
    const list = [];
    for (const [id, f] of e.fx) list.push({ id, f, risky: false });
    for (const [id, f] of e.risky) list.push({ id, f, risky: true });
    if (e.net > 0) list.push({ id: "net", f: null });
    if (e.bomb) list.push({ id: "bomb", f: null });
    const y = 34, size = 22, gap = 27;
    const left = this.opts.leftHanded;
    let x = left ? WD.right - 12 : WD.left + 12;
    for (const it of list) {
      const col = it.risky ? "#ef4444" : CAPSULE_COLORS[it.id];
      c.fillStyle = "rgba(0,0,0,0.45)"; c.beginPath(); c.arc(x, y, size / 2, 0, TAU); c.fill();
      c.lineWidth = 2.5;
      c.strokeStyle = "rgba(255,255,255,0.15)"; c.beginPath(); c.arc(x, y, size / 2 - 1, 0, TAU); c.stroke();
      const frac = !it.f || !Number.isFinite(it.f.total) ? 1 : Math.max(0, it.f.left / it.f.total);
      c.strokeStyle = col; c.beginPath(); c.arc(x, y, size / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU * frac); c.stroke();
      drawIcon(c, it.id, x, y, 12, col);
      if (it.f && it.f.catches != null) { c.fillStyle = "#fff"; c.font = "800 8px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(it.f.catches), x + 8, y + 8); }
      x += left ? -gap : gap;
    }
    const m = e.multiplier();
    if (m > 1) {
      c.font = "900 15px system-ui, sans-serif"; c.textAlign = left ? "left" : "right"; c.textBaseline = "middle";
      c.fillStyle = "#ff6b5a";
      c.fillText(this.text("hud.mult", { m: fmtMult(m) }), left ? WD.left + 6 : WD.right - 6, y);
    }
  }

  drawRiskyBanner(e, now) {
    const k = e.capsules.find((q) => q.risky);
    if (!k) return;
    const c = this.c;
    const text = this.text("risky." + k.id + ".banner", { m: fmtMult(1 + CONFIG.risky[k.id].bonus) });
    c.font = "700 10.5px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    const w = Math.min(WD.right - WD.left - 8, c.measureText(text).width + 20);
    const y = WD.paddleY - 44;
    c.fillStyle = "rgba(40,6,10,0.88)"; roundRect(c, WD.W / 2 - w / 2, y - 11, w, 22, 8); c.fill();
    c.strokeStyle = `rgba(255,70,70,${0.5 + 0.5 * Math.sin(now / 110)})`; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = "#ffd2cc";
    c.fillText(text, WD.W / 2, y + 0.5, w - 12);
  }
}

export function fmtMult(m) { return (Math.round(m * 10) / 10).toString(); }

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return "#" + ((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0");
}
