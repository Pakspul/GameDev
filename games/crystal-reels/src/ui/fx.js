// Effects (FEEL-04/06): particles, screen shake and haptics.
// With Reduced motion on (the setting or the OS preference) shake and flashing are off and
// there are far fewer particles. The animation loop only runs while there is something to draw.
import { timing } from "./dom.js";

export function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

const COLORS = ["#ffd35a", "#ff6fb7", "#6fd0ff", "#7dffb0", "#b07cff", "#ffffff"];

export class Fx {
  constructor(canvas, getSettings) {
    this.canvas = canvas;
    this.getSettings = getSettings;
    this.ctx = canvas.getContext("2d");
    this.parts = [];
    this.running = false;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  reduced() { return !!(this.getSettings().reducedMotion || prefersReducedMotion()); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(this.w * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.h * dpr));
    this.canvas.style.width = this.w + "px"; this.canvas.style.height = this.h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** A burst of coins/confetti from a point. */
  burst(x, y, count = 40, power = 1) {
    const n = Math.round(count * (this.reduced() ? 0.2 : 1));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (2 + Math.random() * 7) * power;
      this._add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * power, coin: Math.random() < 0.6 });
    }
  }

  /** Coins falling from the top of the screen for `ms`. */
  rain(ms = 3000, density = 1) {
    const end = performance.now() + ms / timing.speed;
    const tick = () => {
      if (performance.now() > end) return;
      const n = Math.round((this.reduced() ? 1 : 3) * density);
      for (let i = 0; i < n; i++) this._add({ x: Math.random() * this.w, y: -20, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, coin: Math.random() < 0.7 });
      setTimeout(tick, 60);
    };
    tick();
  }

  _add(p) {
    if (this.parts.length > 320) return;
    p.size = 5 + Math.random() * 7; p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 0.4;
    p.color = COLORS[(Math.random() * COLORS.length) | 0]; p.life = 0; p.max = 90 + Math.random() * 60;
    this.parts.push(p);
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this._frame(t)); }
  }

  _frame(now) {
    const dt = Math.min(2.5, ((now - this.last) / 16.7) * timing.speed);
    this.last = now;
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    for (const p of this.parts) {
      p.life += dt; p.vy += 0.22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = Math.max(0, 1 - Math.max(0, p.life - p.max * 0.6) / (p.max * 0.4));
      c.save(); c.globalAlpha = a; c.translate(p.x, p.y); c.rotate(p.rot);
      if (p.coin) {
        c.fillStyle = "#f5b82e"; c.strokeStyle = "#fff3c4"; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(0, 0, p.size, p.size * Math.abs(Math.cos(p.life * 0.15)) + 1, 0, 0, 6.28); c.fill(); c.stroke();
      } else { c.fillStyle = p.color; c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      c.restore();
    }
    this.parts = this.parts.filter((p) => p.life < p.max && p.y < this.h + 40);
    if (this.parts.length) requestAnimationFrame((t) => this._frame(t));
    else { this.running = false; c.clearRect(0, 0, this.w, this.h); }
  }

  /** Light screen shake; skipped with Reduced motion. */
  shake(el, ms = 450, px = 6) {
    if (this.reduced() || !el.animate) return;
    const frames = [];
    for (let i = 0; i <= 8; i++) frames.push({ transform: `translate(${((i % 2 ? 1 : -1) * px * (1 - i / 8)).toFixed(1)}px, ${((i % 3 - 1) * px * 0.5 * (1 - i / 8)).toFixed(1)}px)` });
    el.animate(frames, { duration: ms / timing.speed });
  }
}

export class Haptics {
  constructor(getSettings) { this.getSettings = getSettings; }
  _vibrate(p) {
    if (!this.getSettings().haptics) return;
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ }
  }
  /** Light haptic on reel stop. */
  light() { if (this.getSettings().haptics && window.Platform) window.Platform.haptic(10); else this._vibrate(10); }
  /** Medium haptic on special-symbol landings. */
  medium() { this._vibrate(28); }
  /** Pattern for Big Win and above. */
  pattern() { this._vibrate([40, 40, 40, 40, 90, 60, 160]); }
}
