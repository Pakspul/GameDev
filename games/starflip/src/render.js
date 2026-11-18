// Draws a table with the 2D canvas. Everything that never changes (space, the floor, walls, labels,
// unlit lamps) is drawn once into a cached layer per table and size; every frame then copies that
// and adds what moves or lights up: arrows, lamps, flippers, balls, sparks and score pop-ups.
//
//   const R = new Renderer(canvas);
//   R.layout(topPx, bottomPx);                the screen area above and below the table stays free
//   R.draw(game, dt, labels);                 labels: the shot names in the player's language
//   R.event(fx);                              a game fx (hit, jackpot …) for sparks and flashes
import { CONFIG } from "./config.js";
import { STAR_RING, UFO } from "./tables.js";
import { MISSIONS } from "./missions.js";

const TAU = Math.PI * 2;
export const COLORS = { start: "#ffd23f", mission: "#ffd23f", comet: "#ff9b3d", wormhole: "#ff5ad9", jackpot: "#4dff9a" };
const THEMES = {
  main: { wall: "#5ce1ff", floor0: "#0d1340", floor1: "#140b33", accent: "#ff5ad9", neb: ["rgba(90,70,255,.22)", "rgba(255,80,200,.13)"] },
  asteroids: { wall: "#ffae42", floor0: "#2a1508", floor1: "#140a1c", accent: "#ffd23f", neb: ["rgba(255,140,40,.2)", "rgba(255,60,60,.1)"] },
  gravity: { wall: "#b892ff", floor0: "#1a0b38", floor1: "#05030f", accent: "#ff5ad9", neb: ["rgba(160,90,255,.25)", "rgba(60,160,255,.12)"] },
  ufo: { wall: "#7dff6a", floor0: "#08261a", floor1: "#071018", accent: "#4dff9a", neb: ["rgba(60,255,140,.16)", "rgba(40,120,255,.14)"] },
};

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.top = 0; this.bottom = 0;
    this.cache = null;
    this.flash = new Map();    // object id → seconds left
    this.parts = [];           // sparks
    this.pops = [];            // floating score texts
    this.trails = new Map();   // ball id → recent positions
    this.spin = Math.PI / 2; this.spinV = 0; // the spinner at rest is edge-on
    this.warp = 0;             // seconds left of the warp effect
    this.t = 0;
    this.resize();
  }

  layout(top, bottom) { this.top = top; this.bottom = bottom; this.resize(); }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    this.dpr = dpr; this.w = w; this.h = h;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    const avail = Math.max(100, h - this.top - this.bottom);
    this.s = Math.min((w - 8) / CONFIG.W, avail / (CONFIG.H - 30)); // the last 30 units are below the flippers: let them crop
    this.ox = (w - CONFIG.W * this.s) / 2;
    this.oy = this.top + Math.max(0, (avail - (CONFIG.H - 30) * this.s) / 2);
    this.cache = null;
  }
  /** World → screen (CSS pixels). */
  project(x, y) { return { x: this.ox + x * this.s, y: this.oy + y * this.s }; }

  // ---- Events from the game -----------------------------------------------------------------------------
  event(f) {
    const pop = (pts, x, y, color) => this.pops.push({ text: "+" + pts.toLocaleString(), x, y, t: 1.1, color });
    switch (f.type) {
      case "bumper": this.flash.set(f.id, 0.16); this.burst(f.x, f.y, "#9ff3ff", 8); break;
      case "sling": this.flash.set(f.id, 0.12); this.burst(f.x, f.y, "#ff9bf0", 6); break;
      case "drop": case "standup": this.flash.set(f.id, 0.25); this.burst(f.x, f.y, "#ffd23f", 10); break;
      case "rock": this.flash.set(f.id, 0.15); this.burst(f.x, f.y, "#ffb067", 8); break;
      case "rockBreak": this.burst(f.x, f.y, "#ffb067", 26, 1.6); pop(f.points, f.x, f.y, "#ffd23f"); break;
      case "star": this.flash.set(f.id, 0.15); this.burst(f.x, f.y, "#d9c4ff", 6); break;
      case "starLit": this.flash.set(f.id, 0.4); this.burst(f.x, f.y, "#fff3a0", 24, 1.5); pop(f.points, f.x, f.y, "#ffd23f"); break;
      case "core": this.burst(f.x, f.y, "#ff5ad9", 30, 1.8); pop(f.points, f.x, f.y - 30, "#ff5ad9"); break;
      case "ufo": this.flash.set("ufo", 0.2); this.burst(f.x, f.y, "#7dff6a", 14); pop(f.points, f.x, f.y - 20, "#7dff6a"); break;
      case "ufoDown": this.burst(f.x, f.y, "#7dff6a", 40, 2); pop(f.points, f.x, f.y - 20, "#ffd23f"); break;
      case "spinner": this.spinV = Math.min(60, this.spinV + f.spins * 6); break;
      case "jackpot": this.burst(260, 440, "#4dff9a", 30, 2); break;
      case "warp": this.warp = 1.2; break;
      case "miniStart": case "miniEnd": this.warp = Math.max(this.warp, 0.7); this.cache = null; this.trails.clear(); break;
    }
  }
  burst(x, y, color, n, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = (80 + Math.random() * 260) * power;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.35 + Math.random() * 0.35, color });
    }
    if (this.parts.length > 300) this.parts.splice(0, this.parts.length - 300);
  }

  // ---- The cached layer ---------------------------------------------------------------------------------
  staticLayer(table, labels) {
    const key = table.id + "|" + this.w + "x" + this.h + "|" + this.s;
    if (this.cache && this.cache.key === key) return this.cache.cv;
    const cv = document.createElement("canvas");
    cv.width = this.cv.width; cv.height = this.cv.height;
    const c = cv.getContext("2d"), th = THEMES[table.id];
    c.scale(this.dpr, this.dpr);
    // Space, all over the screen.
    c.fillStyle = "#04050f";
    c.fillRect(0, 0, this.w, this.h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (this.w * this.h) / 2200; i++) {
      c.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.6})`;
      const r = rnd() < 0.08 ? 1.4 : 0.7;
      c.fillRect(rnd() * this.w, rnd() * this.h, r, r);
    }
    c.save();
    c.translate(this.ox, this.oy);
    c.scale(this.s, this.s);
    // The floor.
    const floor = new Path2D();
    table.floor.forEach(([x, y], i) => (i ? floor.lineTo(x, y) : floor.moveTo(x, y)));
    floor.closePath();
    const g = c.createLinearGradient(0, 0, 0, CONFIG.H);
    g.addColorStop(0, th.floor0); g.addColorStop(1, th.floor1);
    c.fillStyle = g;
    c.fill(floor);
    c.save();
    c.clip(floor);
    for (const [i, col] of th.neb.entries()) {
      const ng = c.createRadialGradient(i ? 420 : 140, i ? 640 : 260, 10, i ? 420 : 140, i ? 640 : 260, 320);
      ng.addColorStop(0, col); ng.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = ng; c.fillRect(0, 0, CONFIG.W, CONFIG.H);
    }
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(255,255,255,${0.1 + rnd() * 0.5})`;
      c.beginPath(); c.arc(rnd() * CONFIG.W, rnd() * CONFIG.H, rnd() < 0.1 ? 1.6 : 0.8, 0, TAU); c.fill();
    }
    this.decor(c, table, th, labels);
    c.restore();
    // Walls: a soft glow, then a bright core.
    const walls = new Path2D(), thick = new Path2D();
    for (const s of table.segs) {
      if (s.kind === "drop" || s.kind === "standup" || (s.kind === "sling" && s.kick) || s.kind === "gate") continue;
      const p = s.r >= 2 ? thick : walls;
      p.moveTo(s.ax, s.ay); p.lineTo(s.bx, s.by);
    }
    c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = th.wall;
    c.globalAlpha = 0.22; c.lineWidth = 9; c.stroke(walls); c.lineWidth = 13; c.stroke(thick);
    c.globalAlpha = 1; c.lineWidth = 2.5; c.stroke(walls); c.lineWidth = 7; c.stroke(thick);
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1; c.stroke(walls); c.lineWidth = 2; c.stroke(thick);
    // Slingshots.
    for (const s of table.segs) if (s.kind === "sling" && s.kick) {
      const side = s.id === "slingL" ? 1 : -1, bx = side > 0 ? 102 : 418;
      c.beginPath(); c.moveTo(bx, 720); c.lineTo(bx, 800); c.lineTo(bx + side * 38, 828); c.closePath();
      c.fillStyle = "rgba(255,90,217,.18)"; c.fill();
    }
    // Round things that don't change look.
    for (const o of table.circles) if (o.kind === "bumper") this.bumperBody(c, o, th);
    if (table.id === "main") this.mainStatic(c, table, labels);
    c.restore();
    this.cache = { key, cv };
    return cv;
  }

  decor(c, table, th, labels) {
    c.save();
    if (table.id === "main") {
      // A ringed planet behind the bumpers.
      const pg = c.createRadialGradient(240, 230, 10, 260, 250, 90);
      pg.addColorStop(0, "rgba(120,110,255,.35)"); pg.addColorStop(1, "rgba(40,30,120,0)");
      c.fillStyle = pg; c.beginPath(); c.arc(260, 250, 92, 0, TAU); c.fill();
      c.strokeStyle = "rgba(160,200,255,.18)"; c.lineWidth = 6;
      c.beginPath(); c.ellipse(260, 255, 150, 34, -0.18, 0, TAU); c.stroke();
      // A constellation that maps the six missions: one star each (lit in mainDynamic when done).
      c.strokeStyle = "rgba(255,255,255,.08)"; c.lineWidth = 1.5;
      c.beginPath(); MISSION_STARS.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    } else if (table.id === "asteroids") {
      c.fillStyle = "rgba(255,170,90,.07)";
      for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(60 + ((i * 97) % 420), 120 + ((i * 173) % 560), 6 + (i % 4) * 4, 0, TAU); c.fill(); }
    } else if (table.id === "ufo") {
      c.strokeStyle = "rgba(125,255,106,.07)"; c.lineWidth = 1;
      for (let y = 280; y < 900; y += 28) { c.beginPath(); c.moveTo(40, y); c.lineTo(480, y); c.stroke(); }
      for (let x = 40; x < 480; x += 28) { c.beginPath(); c.moveTo(x, 260); c.lineTo(x, 900); c.stroke(); }
    }
    // The table's name, faint, low on the floor.
    c.fillStyle = "rgba(255,255,255,.07)";
    c.font = "900 30px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText(labels["table." + table.id], 260, 690);
    c.restore();
  }

  bumperBody(c, o, th) {
    const g = c.createRadialGradient(o.x - 6, o.y - 8, 2, o.x, o.y, o.r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, th.accent); g.addColorStop(1, "#2a0a3a");
    c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.r, 0, TAU); c.fill();
    c.strokeStyle = th.wall; c.lineWidth = 3; c.beginPath(); c.arc(o.x, o.y, o.r + 2, 0, TAU); c.stroke();
    c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.arc(o.x, o.y, o.r * 0.42, 0, TAU); c.fill();
  }

  mainStatic(c, table, labels) {
    c.save();
    // Unlit arrows with their names.
    for (const [name, a] of Object.entries(table.shots)) {
      if (a.ring || a.same) continue;
      arrow(c, a.x, a.y, a.a, "rgba(255,255,255,.12)", "rgba(255,255,255,.25)");
      label(c, labels["shot." + name], a, "rgba(255,255,255,.4)");
    }
    // The launch pad and the wormhole.
    c.strokeStyle = "rgba(255,210,63,.6)"; c.lineWidth = 2;
    for (const r of [17, 24]) { c.beginPath(); c.arc(260, 440, r, 0, TAU); c.stroke(); }
    c.fillStyle = "#05030a"; c.beginPath(); c.arc(260, 440, 13, 0, TAU); c.fill();
    c.fillStyle = "#05030a"; c.beginPath(); c.arc(165, 385, 16, 0, TAU); c.fill();
    // Lane lamps, multiplier lamps, mission stars, shield.
    for (const [x, y] of table.lanes) lamp(c, x, y + 44, 7, "rgba(255,255,255,.1)");
    table.mult.forEach(([x, y], i) => { lamp(c, x, y, 14, "rgba(255,255,255,.06)"); text(c, i + 2 + "×", x, y + 4, "rgba(255,255,255,.3)", 11); });
    for (const [x, y] of MISSION_STARS) star(c, x, y, 7, "rgba(255,255,255,.14)");
    const [sx, sy] = table.save;
    text(c, labels.shield, sx, sy + 4, "rgba(255,255,255,.25)", 10);
    // Drop and standup targets when down / unlit.
    for (const s of table.segs) if (s.kind === "drop") { c.strokeStyle = "rgba(255,140,60,.3)"; c.lineWidth = 1.5; c.strokeRect(s.ax - 4, s.ay, 8, s.by - s.ay); }
    // The plunger lane.
    c.save(); c.translate(520, 800); c.rotate(-Math.PI / 2); text(c, labels.launch, 0, 4, "rgba(255,255,255,.3)", 10); c.restore();
    c.restore();
  }

  // ---- Every frame --------------------------------------------------------------------------------------
  draw(game, dt, labels) {
    this.t += dt;
    const c = this.ctx, w = game.world, table = w.table;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.staticLayer(table, labels), 0, 0);
    c.setTransform(this.dpr * this.s, 0, 0, this.dpr * this.s, this.dpr * this.ox, this.dpr * this.oy);
    for (const [k, v] of this.flash) if (v - dt <= 0) this.flash.delete(k); else this.flash.set(k, v - dt);
    const blink = 0.5 + 0.5 * Math.sin(this.t * 9);

    if (table.id === "main") this.mainDynamic(c, game, labels, blink, dt);
    else this.miniDynamic(c, game, blink);

    // Bumper flashes.
    for (const o of w.circles) if (o.kind === "bumper" && this.flash.has(o.id)) {
      c.fillStyle = `rgba(255,255,255,${this.flash.get(o.id) * 4})`;
      c.beginPath(); c.arc(o.x, o.y, o.r + 4, 0, TAU); c.fill();
    }
    // Slingshot faces.
    for (const s of w.segs) if (s.kind === "sling" && s.kick) {
      const f = this.flash.get(s.id) || 0;
      c.strokeStyle = f ? "#ffffff" : THEMES[table.id].accent; c.lineWidth = f ? 6 : 4; c.lineCap = "round";
      c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke();
    }
    for (const f of w.flippers) drawFlipper(c, f, THEMES[table.id].wall);
    this.drawBalls(c, w, dt);
    this.drawParts(c, dt);
    if (this.warp > 0) this.drawWarp(c, dt);
  }

  mainDynamic(c, game, labels, blink, dt) {
    const w = game.world, table = w.table, lit = game.litShots();
    // Targets.
    for (const s of w.segs) {
      if (s.kind === "drop" && s.active) {
        const f = this.flash.get(s.id) || 0;
        c.fillStyle = f ? "#fff" : "#ff8a3d";
        roundRect(c, s.ax - 5, s.ay, 10, s.by - s.ay, 4); c.fill();
        c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.arc(s.ax, (s.ay + s.by) / 2, 3, 0, TAU); c.fill();
      } else if (s.kind === "standup") {
        const f = this.flash.get(s.id) || 0;
        c.fillStyle = f ? "#fff" : "#4dd2ff";
        roundRect(c, s.ax - 5, s.ay, 10, s.by - s.ay, 4); c.fill();
        c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1; c.beginPath(); c.moveTo(s.ax - 9, (s.ay + s.by) / 2); c.lineTo(s.ax + 9, (s.ay + s.by) / 2); c.stroke();
      }
    }
    // The spinner, in the left orbit.
    this.spinV *= Math.pow(0.25, dt);
    this.spin += this.spinV * dt;
    const sw = Math.abs(Math.cos(this.spin)) * 22 + 2;
    c.fillStyle = "#cfe8ff"; c.fillRect(45 - sw, 503, sw * 2, 4);
    // Lit arrows.
    for (const [name, kind] of lit) {
      const a = table.shots[name];
      if (!a || (a.same && lit.has(a.same))) continue; // the spinner shares the left orbit's arrow
      const col = COLORS[kind];
      if (a.ring) {
        c.strokeStyle = col; c.globalAlpha = 0.35 + 0.65 * blink; c.lineWidth = 3;
        c.beginPath(); c.arc(260, 245, 92, 0, TAU); c.stroke(); c.globalAlpha = 1;
        label(c, labels["shot.bumpers"], { x: 260, y: 352 }, col);
        continue;
      }
      c.save(); c.shadowColor = col; c.shadowBlur = 14 * blink;
      arrow(c, a.x, a.y, a.a, col, "#fff", 0.35 + 0.65 * blink);
      c.restore();
      label(c, labels["shot." + name], a, col);
      if (name === "pad" && kind === "start") { c.strokeStyle = col; c.globalAlpha = blink; c.lineWidth = 3; c.beginPath(); c.arc(260, 440, 24, 0, TAU); c.stroke(); c.globalAlpha = 1; }
    }
    // The wormhole: a slow swirl, magenta when it's open.
    const open = !!game.wormhole;
    c.save(); c.translate(165, 385); c.rotate(-this.t * (open ? 4 : 1));
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = open ? `rgba(255,90,217,${0.5 + 0.5 * blink})` : "rgba(180,140,255,.35)"; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 10 + i * 3, i * 2.1, i * 2.1 + 2.4); c.stroke();
    }
    c.restore();
    // Lane lamps (the skill-shot lane blinks).
    table.lanes.forEach(([x, y], i) => {
      const skill = game.skill && game.skill.lane === i;
      if (game.lanes[i]) lamp(c, x, y + 44, 7, "#ffd23f", true);
      else if (skill) lamp(c, x, y + 44, 7, `rgba(77,255,154,${blink})`, true);
    });
    // Multiplier.
    table.mult.forEach(([x, y], i) => { if (game.mult >= i + 2) { lamp(c, x, y, 14, "rgba(255,90,217,.85)", true); text(c, i + 2 + "×", x, y + 4, "#fff", 11); } });
    // Mission stars: done ones lit, the one being played blinks.
    MISSIONS.forEach((m, i) => {
      const [x, y] = MISSION_STARS[i];
      if (game.done.has(m.id)) star(c, x, y, 8, "#ffd23f", true);
      else if (game.active && game.active.def.id === m.id) star(c, x, y, 8, `rgba(255,210,63,${blink})`, true);
    });
    // Shield (ball save).
    if (game.ballSave > 0) {
      const [sx, sy] = table.save, on = game.ballSave > 2 || blink > 0.5;
      if (on) { c.save(); c.shadowColor = "#4dff9a"; c.shadowBlur = 12; text(c, labels.shield, sx, sy + 4, "#4dff9a", 10); c.restore(); }
    }
    // The plunger and, while charging, how hard.
    const P = table.plunger, pull = game.charging ? game.power : 0;
    c.fillStyle = "#c9d2e6"; c.fillRect(506, 962 + pull * 26, 28, 6);
    c.strokeStyle = "rgba(200,210,230,.6)"; c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i <= 6; i++) c.lineTo(i % 2 ? 512 : 528, 968 + pull * 26 + i * ((24 - pull * 22) / 6));
    c.stroke();
    if (game.ready) {
      const k = game.charging ? game.power : 0.5 + 0.5 * blink;
      c.fillStyle = "rgba(255,255,255,.12)"; roundRect(c, 545, 760, 8, 180, 4); c.fill();
      const col = game.charging ? `hsl(${120 - 120 * game.power},100%,60%)` : `rgba(77,255,154,${k})`;
      c.fillStyle = col; roundRect(c, 545, 940 - 180 * (game.charging ? game.power : 0.15), 8, 180 * (game.charging ? game.power : 0.15), 4); c.fill();
      if (!game.charging) arrow(c, 520, 900 + 10 * blink, -Math.PI / 2, `rgba(77,255,154,${0.4 + 0.6 * blink})`, "#fff");
    }
  }

  miniDynamic(c, game, blink) {
    const w = game.world, M = game.mini, id = w.table.id;
    if (id === "asteroids") {
      for (const o of w.circles) if (o.kind === "rock" && o.active) drawRock(c, o, this.flash.get(o.id) || 0);
    } else if (id === "gravity") {
      const S = STAR_RING;
      // The black hole: an accretion disc around a dark core.
      c.save(); c.translate(S.x, S.y);
      for (let i = 0; i < 4; i++) {
        c.rotate(this.t * (0.6 + i * 0.25));
        c.strokeStyle = `rgba(${200 - i * 20},${120 + i * 20},255,${0.45 - i * 0.08})`; c.lineWidth = 4 - i * 0.6;
        c.beginPath(); c.ellipse(0, 0, 30 + i * 12, 14 + i * 6, 0, 0, 4.2); c.stroke();
      }
      c.restore();
      c.fillStyle = "#000"; c.beginPath(); c.arc(S.x, S.y, 18, 0, TAU); c.fill();
      c.strokeStyle = "rgba(255,90,217,.8)"; c.lineWidth = 2; c.beginPath(); c.arc(S.x, S.y, 19, 0, TAU); c.stroke();
      c.strokeStyle = "rgba(184,146,255,.12)"; c.lineWidth = 1; c.setLineDash([4, 6]);
      c.beginPath(); c.arc(S.x, S.y, S.r, 0, TAU); c.stroke(); c.setLineDash([]);
      for (const o of w.circles) if (o.kind === "star") {
        const isLit = M && "star" + M.lit === o.id, f = this.flash.get(o.id) || 0;
        if (isLit) { c.save(); c.shadowColor = "#ffd23f"; c.shadowBlur = 20 * blink; star(c, o.x, o.y, o.r + 6 + 3 * blink, "#ffd23f", true); c.restore(); }
        else star(c, o.x, o.y, o.r + 2, f ? "#fff" : "rgba(216,200,255,.55)", true);
      }
    } else if (id === "ufo") {
      for (const s of w.segs) if (s.kind === "drop") {
        if (s.active) drawAlien(c, (s.ax + s.bx) / 2, s.ay, this.t);
        else { c.strokeStyle = "rgba(125,255,106,.25)"; c.strokeRect(s.ax, s.ay - 3, s.bx - s.ax, 6); }
      }
      const u = w.get("ufo");
      if (u.active) drawUfo(c, u, this.flash.get("ufo") || 0, M ? M.ufoHits : 0, this.t);
    }
  }

  drawBalls(c, w, dt) {
    const alive = new Set();
    for (const b of w.balls) {
      alive.add(b.id);
      let tr = this.trails.get(b.id);
      if (!tr) this.trails.set(b.id, (tr = []));
      tr.push(b.x, b.y);
      if (tr.length > 16) tr.splice(0, 2);
      for (let i = 0; i < tr.length - 2; i += 2) {
        const k = i / tr.length;
        c.fillStyle = `rgba(150,220,255,${0.18 * k})`;
        c.beginPath(); c.arc(tr[i], tr[i + 1], b.r * (0.4 + 0.6 * k), 0, TAU); c.fill();
      }
      if (b.held) continue;
      const g = c.createRadialGradient(b.x - 3.5, b.y - 4, 1, b.x, b.y, b.r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#c8d3e6"); g.addColorStop(1, "#4a5470");
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
    }
    for (const id of this.trails.keys()) if (!alive.has(id)) this.trails.delete(id);
  }

  drawParts(c, dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      if ((p.t -= dt) <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
      c.globalAlpha = Math.min(1, p.t * 3);
      c.fillStyle = p.color; c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    c.globalAlpha = 1;
    c.textAlign = "center"; c.font = "900 20px system-ui, sans-serif";
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      if ((p.t -= dt) <= 0) { this.pops.splice(i, 1); continue; }
      p.y -= 50 * dt;
      c.globalAlpha = Math.min(1, p.t * 2.5);
      c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeText(p.text, p.x, p.y);
      c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
    }
    c.globalAlpha = 1;
  }

  drawWarp(c, dt) {
    this.warp -= dt;
    const k = Math.max(0, this.warp);
    c.save();
    c.globalAlpha = Math.min(1, k * 1.4);
    c.fillStyle = "rgba(255,90,217,.25)"; c.fillRect(0, 0, CONFIG.W, CONFIG.H);
    c.strokeStyle = "#fff"; c.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU + this.t, r0 = 40 + ((this.t * 900 + i * 37) % 500), r1 = r0 + 40 + k * 60;
      c.beginPath(); c.moveTo(260 + Math.cos(a) * r0, 470 + Math.sin(a) * r0); c.lineTo(260 + Math.cos(a) * r1, 470 + Math.sin(a) * r1); c.stroke();
    }
    c.restore();
  }
}

// Where the six mission stars sit (a constellation above the flippers).
const MISSION_STARS = [[185, 590], [218, 562], [248, 580], [272, 556], [302, 578], [335, 560]];

// ---- Drawing helpers -------------------------------------------------------------------------------------
function arrow(c, x, y, a, fill, stroke, alpha = 1) {
  c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha *= alpha;
  c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -13); c.lineTo(-3, 0); c.lineTo(-8, 13); c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = stroke; c.lineWidth = 1.2; c.stroke();
  c.restore();
}
function label(c, s, a, color) {
  if (!s) return;
  c.save();
  c.font = "800 10px system-ui, sans-serif"; c.textAlign = "center"; c.fillStyle = color;
  const vertical = a.a != null && Math.abs(Math.cos(a.a)) < 0.2 && (a.x < 70 || a.x > 450);
  if (a.label) c.fillText(s, a.label[0], a.label[1]);
  else if (vertical) { c.translate(a.x, a.y - 84); c.rotate(-Math.PI / 2); c.fillText(s, 0, 4); } // up the channel, above the arrow
  else if (a.a != null && Math.abs(Math.cos(a.a)) > 0.9) c.fillText(s, a.x + Math.cos(a.a) * -6, a.y + 26);
  else c.fillText(s, a.x, a.y + 30);
  c.restore();
}
function text(c, s, x, y, color, size) {
  c.font = `800 ${size}px system-ui, sans-serif`; c.textAlign = "center"; c.fillStyle = color; c.fillText(s, x, y);
}
function lamp(c, x, y, r, color, glow) {
  c.save();
  if (glow) { c.shadowColor = color; c.shadowBlur = 10; }
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.restore();
}
function star(c, x, y, r, color, glow) {
  c.save();
  if (glow) { c.shadowColor = color; c.shadowBlur = 10; }
  c.fillStyle = color; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
  c.restore();
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function drawFlipper(c, f, color) {
  const ca = Math.cos(f.a), sa = Math.sin(f.a), tx = f.x + ca * f.len, ty = f.y + sa * f.len;
  const nx = -sa, ny = ca;
  c.beginPath();
  c.arc(f.x, f.y, f.r1, f.a + Math.PI / 2, f.a - Math.PI / 2);
  c.lineTo(tx - nx * f.r2, ty - ny * f.r2);
  c.arc(tx, ty, f.r2, f.a - Math.PI / 2, f.a + Math.PI / 2);
  c.closePath();
  const g = c.createLinearGradient(f.x, f.y - 12, f.x, f.y + 14);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#b9c8e8");
  c.fillStyle = g; c.fill();
  c.strokeStyle = color; c.lineWidth = 3; c.stroke();
  c.fillStyle = color; c.beginPath(); c.arc(f.x, f.y, 4, 0, TAU); c.fill();
}
function drawRock(c, o, f) {
  c.save(); c.translate(o.x, o.y);
  c.fillStyle = f ? "#fff" : "#8a6a52";
  c.beginPath();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = o.r * (0.82 + 0.18 * Math.sin(i * 2.7 + o.x)); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fill();
  c.strokeStyle = "#ffae42"; c.lineWidth = 2; c.stroke();
  c.fillStyle = "rgba(0,0,0,.25)";
  c.beginPath(); c.arc(-6, -4, 5, 0, TAU); c.arc(7, 6, 3.5, 0, TAU); c.fill();
  // Cracks: one per hit taken.
  c.strokeStyle = "#ffd23f"; c.lineWidth = 2;
  const cracks = 3 - (o.hp ?? 3);
  for (let i = 0; i < cracks; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * 2.2) * o.r * 0.9, Math.sin(i * 2.2) * o.r * 0.9); c.stroke(); }
  c.restore();
}
function drawUfo(c, u, f, hits, t) {
  c.save(); c.translate(u.x, u.y);
  c.fillStyle = "rgba(140,255,200,.35)"; c.beginPath(); c.ellipse(0, -8, 14, 13, 0, Math.PI, TAU); c.fill();
  c.fillStyle = f ? "#fff" : "#9aa7bd"; c.beginPath(); c.ellipse(0, 0, u.r, 11, 0, 0, TAU); c.fill();
  c.strokeStyle = "#7dff6a"; c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 5; i++) {
    const on = (Math.floor(t * 6) + i) % 2;
    c.fillStyle = on ? "#ffd23f" : "#ff5ad9"; c.beginPath(); c.arc(-20 + i * 10, 2, 2.5, 0, TAU); c.fill();
  }
  // Damage pips: three hits bring it down.
  for (let i = 0; i < 3; i++) { c.fillStyle = i < hits ? "#ff5a5a" : "rgba(255,255,255,.25)"; c.fillRect(-12 + i * 9, 16, 6, 4); }
  c.restore();
}
function drawAlien(c, x, y, t) {
  c.save(); c.translate(x, y + Math.sin(t * 4 + x) * 1.5);
  c.fillStyle = "#7dff6a"; c.beginPath(); c.ellipse(0, 0, 16, 9, 0, 0, TAU); c.fill();
  c.fillStyle = "#06140c"; c.beginPath(); c.ellipse(-6, -1, 3.5, 4.5, -0.4, 0, TAU); c.ellipse(6, -1, 3.5, 4.5, 0.4, 0, TAU); c.fill();
  c.restore();
}
