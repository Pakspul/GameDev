// Graphite: the game shell. Four puzzle types share one board renderer, one input model,
// undo, hints, timer, saving and the daily puzzles. The generators live in levels/*.js
// (pure logic) and run in worker.js so the screen never freezes.
(function () {
"use strict";
const $ = (s) => document.querySelector(s);
const _t = I18n.t;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------- icons ---------- */
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  erase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H9L4.6 15.6a2 2 0 0 1 0-2.8l8.8-8.8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 18.4"/><path d="M8.5 9.5l6 6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M14.5 6l3.5 3.5"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="12" r="1.8"/><path d="M12 8.6l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z"/><circle cx="18" cy="12" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="12" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/></svg>',
  // puzzle types
  sudoku: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke-width="1.3"/><text x="12" y="14.3" font-size="6.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">7</text></svg>',
  takuzu: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="4.6" fill="currentColor"/><path d="M18.8 13.4a4.8 4.8 0 1 1-4.2 7.2 4 4 0 0 0 4.2-7.2z" fill="currentColor"/><circle cx="16.5" cy="7.5" r="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/><circle cx="7.5" cy="16.5" r="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>',
  stars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3 3h10v7h8v11H3z"/><path d="M8 5.3l1.2 2.5 2.7.3-2 1.9.5 2.7L8 11.4l-2.4 1.3.5-2.7-2-1.9 2.7-.3z" fill="currentColor" stroke="none"/><path d="M16 13.8l1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z" fill="currentColor" stroke="none"/></svg>',
  calcudoku: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3 3h11v7H10v11H3z"/><path d="M14 3h7v18H10"/><text x="6.2" y="8.6" font-size="5.6" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">+</text><text x="17.5" y="8.6" font-size="5.6" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">×</text></svg>',
};
function fillIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICON[el.getAttribute("data-icon")] || ""; });
}

/* ---------- puzzle types ---------- */
const TIERS = ["easy", "medium", "hard", "expert"];
const TIER_LABEL = Object.fromEntries(TIERS.map((t) => [t, _t("tier." + t)]));
const KINDS = {
  sudoku: { gen: window.GraphiteSudoku, input: "digits" },
  takuzu: { gen: window.GraphiteTakuzu, input: "cycle" },
  stars: { gen: window.GraphiteStars, input: "stars" },
  calcudoku: { gen: window.GraphiteCalcudoku, input: "digits" },
};
const KIND_ORDER = ["sudoku", "takuzu", "stars", "calcudoku"];
// Names, descriptions and rules come from strings.js: "<kind>.name", "<kind>.tier.<tier>", "<kind>.rule.1", ...
for (const k of KIND_ORDER) {
  const K = KINDS[k];
  K.name = _t(k + ".name");
  K.desc = _t(k + ".desc");
  K.tiers = Object.fromEntries(TIERS.map((t) => [t, _t(k + ".tier." + t)]));
  K.rules = [];
  for (let i = 1; I18n.has(k + ".rule." + i); i++) K.rules.push(_t(k + ".rule." + i));
}
// Daily difficulty by weekday (0 = Sunday): gentle at the start of the week, a treat on Saturday.
const DAILY_TIER = ["hard", "easy", "medium", "medium", "hard", "medium", "expert"];
const PAGE = 30;

/* ---------- storage ---------- */
const KEY = "graphite.v1";
const DEFAULT_SETTINGS = { theme: "auto", timer: true, mistakes: true, autodot: false, sound: true };
let store = (function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
  if (!s || s.v !== 1) s = { v: 1 };
  s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
  s.progress = s.progress || {};
  s.daily = s.daily || {};
  s.current = s.current || {};
  s.ui = Object.assign({ kind: "sudoku", tier: {}, page: {} }, s.ui || {});
  s.best = s.best || {};
  return s;
})();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage full or blocked */ } }
function prog(kind, tier) {
  const p = (store.progress[kind] = store.progress[kind] || {});
  return (p[tier] = p[tier] || { done: {}, best: 0 });
}
function nextLevel(kind, tier) {
  const done = prog(kind, tier).done;
  let l = 1;
  while (done[l]) l++;
  return l;
}

/* ---------- dates & streak ---------- */
function dayKey(d) {
  const z = (x) => (x < 10 ? "0" : "") + x;
  return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
}
function today() { return dayKey(new Date()); }
function dailyTier(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAILY_TIER[new Date(y, m - 1, d).getDay()];
}
function streak() {
  const d = new Date();
  if (!store.daily[dayKey(d)]) d.setDate(d.getDate() - 1); // today not played yet: count from yesterday
  let n = 0;
  while (store.daily[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- generation (worker with a main-thread fallback) ---------- */
let worker = null, reqId = 0;
const pending = new Map();
function localGenerate(job) {
  setTimeout(() => {
    try { job.resolve(KINDS[job.kind].gen.generate(job.tier, job.seed)); } catch (e) { job.reject(e); }
  }, 30);
}
try {
  worker = new Worker("worker.js");
  worker.onmessage = (e) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    if (e.data.error) job.reject(new Error(e.data.error)); else job.resolve(e.data.puzzle);
  };
  worker.onerror = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    worker = null;
    for (const job of pending.values()) localGenerate(job);
    pending.clear();
  };
} catch (e) { worker = null; }
function generate(kind, tier, seed) {
  return new Promise((resolve, reject) => {
    const job = { kind, tier, seed, resolve, reject };
    if (worker) { const id = ++reqId; pending.set(id, job); worker.postMessage({ id, kind, tier, seed }); }
    else localGenerate(job);
  });
}

/* ---------- theme ---------- */
function applyTheme() {
  const t = store.settings.theme;
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  colors = null;
  if (G) draw();
}
let colors = null;
function readColors() {
  const cs = getComputedStyle(document.body);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    cell: v("--b-cell"), grid: v("--b-grid"), gridTint: v("--b-grid-tint"), ink: v("--b-ink"), peer: v("--b-peer"), same: v("--b-same"),
    sun: v("--b-sun"), sunSoft: v("--b-sun-soft"), moon: v("--b-moon"), moonSoft: v("--b-moon-soft"),
    tile: v("--b-tile"), glyph: v("--b-glyph"), regions: v("--b-regions").split(/\s+/),
    accent: v("--accent"), bad: v("--bad"), muted: v("--muted"), paper: v("--paper"),
  };
}
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
(darkQuery.addEventListener ? darkQuery.addEventListener.bind(darkQuery, "change") : darkQuery.addListener.bind(darkQuery))(() => { colors = null; if (G) draw(); });

/* ---------- sound (synthesised, no files) ---------- */
let actx = null;
function sfx(type) {
  if (!store.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const t = actx.currentTime;
    const notes = type === "win" ? [[660, 0], [880, .09], [1320, .18]] : type === "erase" ? [[420, 0]] : [[1150 + Math.random() * 120, 0]];
    for (const [f, dt] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type === "win" ? "sine" : "triangle";
      o.frequency.value = f;
      const vol = type === "win" ? .07 : .035, len = type === "win" ? .35 : .05;
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(vol, t + dt + .005);
      g.gain.exponentialRampToValueAtTime(.0001, t + dt + len);
      o.connect(g).connect(actx.destination);
      o.start(t + dt); o.stop(t + dt + len + .02);
    }
  } catch (e) { /* audio not available */ }
}
function haptic() { if (window.Platform) Platform.haptic(8); }

/* ---------- game state ---------- */
// G = { kind, tier, level, date, slot, key, p, cells, notes, hints, elapsed, done, undo, sel, noteMode, flash, win }
let G = null;
let loadToken = 0;

function slotOf(kind, tier, date) { return date ? kind + ":daily" : kind + ":" + tier; }
function keyOf(kind, tier, level, date) { return date ? kind + ":daily:" + date : kind + ":" + tier + ":" + level; }

function isGiven(i) {
  const p = G.p;
  if (p.kind === "sudoku") return p.givens[i] !== 0;
  if (p.kind === "takuzu") return p.givens[i] >= 0;
  return false;
}
function initialCells(p) {
  if (p.kind === "sudoku" || p.kind === "takuzu") return p.givens.slice();
  return new Array(p.n * p.n).fill(0);
}
const peerCache = {};
function peersOf(i) {
  const p = G.p;
  if (p.kind === "sudoku") return GraphiteSudoku.PEERS[i];
  const k = p.n + ":" + i;
  if (!peerCache[k]) {
    const n = p.n, r = (i / n) | 0, c = i % n, out = [];
    for (let x = 0; x < n; x++) { if (x !== c) out.push(r * n + x); if (x !== r) out.push(x * n + c); }
    peerCache[k] = out;
  }
  return peerCache[k];
}

async function startGame(opts) {
  const { kind, tier, level, date } = opts;
  const slot = slotOf(kind, tier, date), key = keyOf(kind, tier, level, date);
  const token = ++loadToken;
  document.body.dataset.kind = kind;
  colors = null;
  G = null;
  showView("game");
  $("#gPill").textContent = date ? _t("daily", { tier: TIER_LABEL[tier] }) : KINDS[kind].name + " · " + TIER_LABEL[tier];
  $("#gTitle").textContent = date ? KINDS[kind].name : _t("level", { n: level });
  $("#pad").innerHTML = ""; $("#tools").innerHTML = ""; $("#timer").textContent = "";
  const canvas = $("#board");
  canvas.style.visibility = "hidden";

  const saved = store.current[slot];
  let state;
  if (saved && saved.key === key && !opts.fresh) state = saved;
  else {
    $("#loading").hidden = false;
    let p;
    try { p = await generate(kind, tier, date ? "daily:" + date : tier + ":" + level); }
    catch (e) { console.warn(e); $("#loading").textContent = _t("genFailed"); return; }
    if (token !== loadToken) return;
    state = { key, p, cells: initialCells(p), notes: new Array(p.n * p.n).fill(0), hints: 0, elapsed: 0 };
  }
  if (token !== loadToken) return;
  $("#loading").hidden = true;
  canvas.style.visibility = "";
  G = {
    kind, tier, level, date, slot, key, p: state.p, cells: state.cells.slice(), notes: state.notes.slice(),
    hints: state.hints || 0, elapsed: state.elapsed || 0, done: false, undo: [], sel: -1, noteMode: false, flash: null, win: null,
  };
  if (KINDS[kind].input === "digits") G.sel = firstEmpty();
  buildControls();
  layout();
  persist();
  lastTick = performance.now();
  updateTimer();
}
function firstEmpty() {
  for (let i = 0; i < G.cells.length; i++) if (!isGiven(i) && !G.cells[i]) return i;
  return 0;
}
function persist() {
  if (!G || G.done) return;
  store.current[G.slot] = { key: G.key, p: G.p, cells: G.cells, notes: G.notes, hints: G.hints, elapsed: Math.round(G.elapsed) };
  save();
}

/* ---------- timer ---------- */
let lastTick = 0;
function tickTimer() {
  const now = performance.now();
  if (G && !G.done && !$("#game").hidden && document.visibilityState === "visible" && $("#overlay").hidden && !nav.isOpen()) {
    G.elapsed += Math.min(5, (now - lastTick) / 1000);
  }
  lastTick = now;
  updateTimer();
}
function fmtTime(s) {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const z = (x) => (x < 10 ? "0" : "") + x;
  return h ? h + ":" + z(m) + ":" + z(sec) : m + ":" + z(sec);
}
function updateTimer() {
  const el = $("#timer");
  el.hidden = !store.settings.timer;
  if (G) el.textContent = fmtTime(G.elapsed);
}
setInterval(tickTimer, 1000);
let lastSave = 0;
setInterval(() => { if (G && !G.done && performance.now() - lastSave > 9000) { lastSave = performance.now(); persist(); } }, 10000);
document.addEventListener("visibilitychange", () => { lastTick = performance.now(); if (document.visibilityState === "hidden") persist(); });
window.addEventListener("pagehide", persist);

/* ---------- board geometry & drawing ---------- */
const canvas = $("#board");
const ctx = canvas.getContext("2d");
let geo = { size: 0, pad: 0, cs: 0, dpr: 1 };

function layout() {
  if (!G) return;
  const wrap = $("#boardWrap").getBoundingClientRect();
  const size = Math.max(160, Math.floor(Math.min(wrap.width, wrap.height, 620)));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = size + "px"; canvas.style.height = size + "px";
  canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
  const pad = Math.round(size * 0.018) + 2;
  geo = { size, pad, cs: (size - 2 * pad) / G.p.n, dpr };
  draw();
}
if (window.ResizeObserver) new ResizeObserver(() => { if (G && !$("#game").hidden) layout(); }).observe($("#boardWrap"));
else window.addEventListener("resize", () => { if (G) layout(); });

function cellAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left - geo.pad, y = clientY - r.top - geo.pad;
  const n = G.p.n;
  const c = Math.floor(x / geo.cs), rr = Math.floor(y / geo.cs);
  if (c < 0 || rr < 0 || c >= n || rr >= n) return -1;
  return rr * n + c;
}

let raf = 0;
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function frame() {
  raf = 0;
  draw();
  const now = performance.now();
  if ((G && G.flash && now < G.flash.until) || (G && G.win && now < G.win.until)) kick();
}

function draw() {
  if (!G) return;
  if (!colors) colors = readColors();
  const { size, dpr } = geo;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const k = G.p.kind;
  if (k === "takuzu") drawTakuzu();
  else if (k === "stars") drawStars();
  else drawDigits();
  drawOverlayEffects();
}

function cellRect(i) {
  const n = G.p.n, r = (i / n) | 0, c = i % n;
  return { x: geo.pad + c * geo.cs, y: geo.pad + r * geo.cs, r, c };
}

function roundRect(x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/* --- clashes: rule violations visible on the board (never compares with the solution) --- */
function clashes() {
  const out = new Set();
  if (!store.settings.mistakes) return out;
  const p = G.p, n = p.n, cells = G.cells;
  const lines = [];
  for (let r = 0; r < n; r++) { const a = []; for (let c = 0; c < n; c++) a.push(r * n + c); lines.push(a); }
  for (let c = 0; c < n; c++) { const a = []; for (let r = 0; r < n; r++) a.push(r * n + c); lines.push(a); }
  if (p.kind === "sudoku" || p.kind === "calcudoku") {
    const units = p.kind === "sudoku" ? GraphiteSudoku.UNITS : lines;
    for (const u of units) {
      const seen = {};
      for (const i of u) if (cells[i]) (seen[cells[i]] = seen[cells[i]] || []).push(i);
      for (const v in seen) if (seen[v].length > 1) seen[v].forEach((i) => out.add(i));
    }
    if (p.kind === "calcudoku") {
      for (const cg of p.cages) {
        const vals = cg.cells.map((i) => cells[i]);
        if (vals.some((v) => !v)) continue;
        const got = cg.op ? GraphiteCalcudoku.applyOp(cg.op, vals) : vals[0];
        if (got !== cg.target) cg.cells.forEach((i) => out.add(i));
      }
    }
  } else if (p.kind === "takuzu") {
    const done = {};
    lines.forEach((u, li) => {
      let z = 0, o = 0;
      for (let k = 0; k < n; k++) {
        const v = cells[u[k]];
        if (v === 0) z++; else if (v === 1) o++;
        if (k >= 2 && v >= 0 && v === cells[u[k - 1]] && v === cells[u[k - 2]]) { out.add(u[k]); out.add(u[k - 1]); out.add(u[k - 2]); }
      }
      if (z > n / 2) u.forEach((i) => cells[i] === 0 && out.add(i));
      if (o > n / 2) u.forEach((i) => cells[i] === 1 && out.add(i));
      if (z + o === n) {
        const sig = (li < n ? "r" : "c") + u.map((i) => cells[i]).join("");
        if (done[sig]) { u.forEach((i) => out.add(i)); done[sig].forEach((i) => out.add(i)); }
        else done[sig] = u;
      }
    });
  } else if (p.kind === "stars") {
    const k = p.k;
    const groups = lines.slice();
    const regs = [];
    p.regions.forEach((g, i) => (regs[g] = regs[g] || []).push(i));
    groups.push(...regs);
    for (const u of groups) {
      const st = u.filter((i) => cells[i] === 2);
      if (st.length > k) st.forEach((i) => out.add(i));
    }
    for (let i = 0; i < n * n; i++) {
      if (cells[i] !== 2) continue;
      const r = (i / n) | 0, c = i % n;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        if (cells[rr * n + cc] === 2) { out.add(i); out.add(rr * n + cc); }
      }
    }
  }
  return out;
}

function drawGridLines(thickBetween, thin = colors.grid) {
  const n = G.p.n, { pad, cs } = geo, L = pad, R = pad + n * cs;
  ctx.strokeStyle = thin; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k < n; k++) {
    const p = Math.round(pad + k * cs) + 0.5;
    ctx.moveTo(L, p); ctx.lineTo(R, p);
    ctx.moveTo(p, L); ctx.lineTo(p, R);
  }
  ctx.stroke();
  // thick borders between different groups (boxes, cages, regions)
  ctx.strokeStyle = colors.ink; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.lineCap = "round";
  ctx.beginPath();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, x = pad + c * cs, y = pad + r * cs;
    if (c < n - 1 && thickBetween(i, i + 1)) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
    if (r < n - 1 && thickBetween(i, i + n)) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
  }
  ctx.stroke();
  ctx.lineWidth = Math.max(2.5, cs * 0.07);
  roundRect(L, L, R - L, R - L, Math.min(8, cs * 0.15));
  ctx.stroke();
}

function drawDigits() {
  const p = G.p, n = p.n, { pad, cs } = geo, cells = G.cells;
  const bad = clashes();
  roundRect(pad, pad, n * cs, n * cs, Math.min(8, cs * 0.15));
  ctx.fillStyle = colors.cell; ctx.fill();
  const sel = G.sel;
  const selVal = sel >= 0 ? cells[sel] : 0;
  const box = p.kind === "sudoku" ? GraphiteSudoku.BOX : null;
  for (let i = 0; i < n * n; i++) {
    const { x, y, r, c } = cellRect(i);
    let fill = null;
    if (sel >= 0) {
      const sr = (sel / n) | 0, sc = sel % n;
      if (r === sr || c === sc || (box && box[i] === box[sel])) fill = colors.peer;
      if (selVal && cells[i] === selVal) fill = colors.same;
    }
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, cs, cs); }
    if (i === sel) {
      ctx.fillStyle = colors.accent; ctx.globalAlpha = 0.22; ctx.fillRect(x, y, cs, cs); ctx.globalAlpha = 1;
    }
  }
  // cage labels sit under the lines
  let cageOf = null;
  if (p.kind === "calcudoku") {
    cageOf = new Array(n * n);
    p.cages.forEach((cg, k) => cg.cells.forEach((i) => (cageOf[i] = k)));
    ctx.fillStyle = colors.ink; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = `700 ${Math.max(9, cs * 0.2)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
    for (const cg of p.cages) {
      const { x, y } = cellRect(cg.cells[0]);
      ctx.fillText(cg.target + (cg.op || ""), x + cs * 0.08, y + cs * 0.07);
    }
  }
  drawGridLines((a, b) => (box ? box[a] !== box[b] : cageOf[a] !== cageOf[b]));
  // digits
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const big = `600 ${cs * (p.kind === "calcudoku" ? 0.5 : 0.6)}px Fraunces, Georgia, serif`;
  const small = `700 ${cs * (p.kind === "calcudoku" ? 0.17 : 0.24)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
  for (let i = 0; i < n * n; i++) {
    const { x, y } = cellRect(i);
    const v = cells[i];
    if (v) {
      const given = isGiven(i);
      ctx.font = big;
      ctx.fillStyle = bad.has(i) ? colors.bad : given ? colors.ink : colors.accent;
      ctx.fillText(String(v), x + cs / 2, y + cs * (p.kind === "calcudoku" ? 0.6 : 0.53));
      if (bad.has(i) && !given) {
        ctx.strokeStyle = colors.bad; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + cs * 0.3, y + cs * 0.86); ctx.lineTo(x + cs * 0.7, y + cs * 0.86); ctx.stroke();
      }
    } else if (G.notes[i]) {
      ctx.font = small; ctx.fillStyle = colors.muted;
      const calc = p.kind === "calcudoku";
      const cols = calc ? 4 : 3, top = calc ? 0.36 : 0.06, h = calc ? 0.6 : 0.88;
      const rows = Math.ceil(n / cols);
      for (let d = 1; d <= n; d++) {
        if (!(G.notes[i] & (1 << d))) continue;
        const cx = x + cs * (0.06 + 0.88 * (((d - 1) % cols) + 0.5) / cols);
        const cy = y + cs * (top + h * ((((d - 1) / cols) | 0) + 0.5) / rows);
        if (selVal === d) { ctx.fillStyle = colors.accent; ctx.fillText(String(d), cx, cy); ctx.fillStyle = colors.muted; }
        else ctx.fillText(String(d), cx, cy);
      }
    }
  }
}

function drawSun(cx, cy, s, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.055); ctx.lineCap = "round";
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    ctx.moveTo(cx + Math.cos(a) * s * 0.24, cy + Math.sin(a) * s * 0.24);
    ctx.lineTo(cx + Math.cos(a) * s * 0.32, cy + Math.sin(a) * s * 0.32);
  }
  ctx.stroke();
}
function drawMoon(cx, cy, s, color) {
  ctx.fillStyle = color;
  const R = s * 0.27;
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.32, Math.PI * 1.68, false);
  ctx.arc(cx + R * 0.55, cy - R * 0.28, R * 0.82, Math.PI * 1.45, Math.PI * 0.62, true);
  ctx.closePath();
  ctx.fill();
}

function drawTakuzu() {
  const p = G.p, n = p.n, { cs } = geo, cells = G.cells;
  const bad = clashes();
  const gap = Math.max(2, cs * 0.07), rad = cs * 0.2;
  for (let i = 0; i < n * n; i++) {
    const { x, y } = cellRect(i);
    const v = cells[i], given = isGiven(i);
    const tx = x + gap / 2, ty = y + gap / 2, ts = cs - gap;
    roundRect(tx, ty, ts, ts, rad);
    ctx.fillStyle = v < 0 ? colors.tile : v === 0 ? (given ? colors.sun : colors.sunSoft) : (given ? colors.moon : colors.moonSoft);
    ctx.fill();
    if (v === 0) drawSun(x + cs / 2, y + cs / 2, cs, colors.glyph);
    else if (v === 1) drawMoon(x + cs / 2, y + cs / 2, cs, colors.glyph);
    if (given) {
      // printed cells get a small corner notch so they read as "fixed"
      ctx.fillStyle = colors.glyph; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(tx + ts - rad * 0.75, ty + rad * 0.75, Math.max(1.5, cs * 0.04), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (bad.has(i)) {
      roundRect(tx + 1.5, ty + 1.5, ts - 3, ts - 3, rad);
      ctx.strokeStyle = colors.bad; ctx.lineWidth = 3; ctx.stroke();
    }
    if (i === G.sel && kbdUsed) {
      roundRect(tx - 1, ty - 1, ts + 2, ts + 2, rad);
      ctx.strokeStyle = colors.accent; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
}

function starPath(cx, cy, R) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? R * 0.45 : R;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function drawStars() {
  const p = G.p, n = p.n, { pad, cs } = geo, cells = G.cells;
  const bad = clashes();
  for (let i = 0; i < n * n; i++) {
    const { x, y } = cellRect(i);
    ctx.fillStyle = colors.regions[p.regions[i] % colors.regions.length];
    ctx.fillRect(x, y, cs + 0.5, cs + 0.5);
  }
  drawGridLines((a, b) => p.regions[a] !== p.regions[b], colors.gridTint);
  for (let i = 0; i < n * n; i++) {
    const { x, y } = cellRect(i);
    const v = cells[i];
    if (v === 1) {
      ctx.fillStyle = colors.ink; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, Math.max(2, cs * 0.075), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (v === 2) {
      starPath(x + cs / 2, y + cs / 2 + cs * 0.02, cs * 0.34);
      ctx.fillStyle = bad.has(i) ? colors.bad : colors.ink; ctx.fill();
    }
    if (i === G.sel && kbdUsed) {
      ctx.strokeStyle = colors.accent; ctx.lineWidth = 3;
      ctx.strokeRect(x + 2.5, y + 2.5, cs - 5, cs - 5);
    }
  }
  void pad;
}

function drawOverlayEffects() {
  const now = performance.now();
  if (G.flash && now < G.flash.until) {
    const { x, y } = cellRect(G.flash.cell);
    const t = (G.flash.until - now) / 900;
    ctx.fillStyle = G.flash.bad ? colors.bad : colors.accent;
    ctx.globalAlpha = 0.45 * Math.sin(Math.min(1, t) * Math.PI);
    ctx.fillRect(x, y, geo.cs, geo.cs);
    ctx.globalAlpha = 1;
  }
  if (G.win && now < G.win.until) {
    const n = G.p.n, t = (now - G.win.start) / 1000;
    ctx.fillStyle = colors.accent;
    for (let i = 0; i < n * n; i++) {
      const { x, y, r, c } = cellRect(i);
      const ph = t * 2.6 - (r + c) / (2 * n) * 1.6;
      if (ph <= 0 || ph >= 1) continue;
      ctx.globalAlpha = 0.35 * Math.sin(ph * Math.PI);
      ctx.fillRect(x, y, geo.cs, geo.cs);
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- actions & undo ---------- */
function begin() { return new Map(); }
function setCell(act, i, v, note) {
  if (!act.has(i)) act.set(i, { i, c0: G.cells[i], n0: G.notes[i] });
  G.cells[i] = v;
  if (note !== undefined) G.notes[i] = note;
}
function commit(act, sound) {
  const list = [];
  for (const e of act.values()) if (e.c0 !== G.cells[e.i] || e.n0 !== G.notes[e.i]) list.push({ i: e.i, c0: e.c0, n0: e.n0, c1: G.cells[e.i], n1: G.notes[e.i] });
  if (!list.length) return false;
  G.undo.push(list);
  if (sound) { sfx(sound); haptic(); }
  afterChange();
  return true;
}
function undo() {
  if (!G || G.done) return;
  const list = G.undo.pop();
  if (!list) return;
  for (const e of list) { G.cells[e.i] = e.c0; G.notes[e.i] = e.n0; }
  sfx("erase");
  afterChange();
}
function afterChange() {
  persist();
  draw();
  updateControls();
  checkWin();
}

function inputDigit(d) {
  if (!G || G.done || KINDS[G.kind].input !== "digits") return;
  const i = G.sel;
  if (i < 0 || isGiven(i) || d > G.p.n) return;
  const act = begin();
  if (G.noteMode) {
    if (G.cells[i]) setCell(act, i, 0, 1 << d);
    else setCell(act, i, 0, G.notes[i] ^ (1 << d));
    commit(act, "tick");
    return;
  }
  const v = G.cells[i] === d ? 0 : d;
  setCell(act, i, v, 0);
  if (v) for (const j of peersOf(i)) if (G.notes[j] & (1 << d)) setCell(act, j, G.cells[j], G.notes[j] & ~(1 << d));
  commit(act, v ? "tick" : "erase");
}
function erase() {
  if (!G || G.done || G.sel < 0) return;
  const i = G.sel;
  if (isGiven(i)) return;
  const act = begin();
  setCell(act, i, G.kind === "takuzu" ? -1 : 0, 0);
  commit(act, "erase");
}

function cycleTakuzu(i) {
  if (isGiven(i)) { G.flash = { cell: i, until: performance.now() + 500, bad: false }; kick(); return; }
  const v = G.cells[i];
  const act = begin();
  setCell(act, i, v === -1 ? 0 : v === 0 ? 1 : -1);
  commit(act, v === 1 ? "erase" : "tick");
}

function autodot(act, i) {
  if (!store.settings.autodot) return;
  const n = G.p.n, r = (i / n) | 0, c = i % n;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((!dr && !dc) || rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
    if (G.cells[rr * n + cc] === 0) setCell(act, rr * n + cc, 1);
  }
}

/* ---------- pointer input ---------- */
let drag = null, kbdUsed = false;
canvas.addEventListener("pointerdown", (e) => {
  if (!G || G.done) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0) return;
  kbdUsed = false;
  e.preventDefault();
  const input = KINDS[G.kind].input;
  if (input === "digits") { G.sel = i; draw(); updateControls(); return; }
  if (input === "cycle") { G.sel = i; cycleTakuzu(i); return; }
  // stars: tap cycles empty → dot → star → empty; dragging from a new dot paints dots
  G.sel = i;
  const act = begin();
  const v = G.cells[i];
  const nv = v === 0 ? 1 : v === 1 ? 2 : 0;
  setCell(act, i, nv);
  if (nv === 2) autodot(act, i);
  drag = { act, mode: nv === 1 ? 1 : v === 1 ? -1 : 0, last: i };
  draw();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || !G) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0 || i === drag.last) return;
  drag.last = i;
  if (drag.mode === 1 && G.cells[i] === 0) { setCell(drag.act, i, 1); draw(); }
  else if (drag.mode === -1 && G.cells[i] === 1) { setCell(drag.act, i, 0); draw(); }
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  const star = [...d.act.values()].some((e) => G.cells[e.i] === 2);
  commit(d.act, star ? "tick" : "erase");
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ---------- keyboard ---------- */
document.addEventListener("keydown", (e) => {
  if (!G || $("#game").hidden || !$("#overlay").hidden) return;
  const n = G.p.n;
  const move = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (move !== undefined) {
    e.preventDefault();
    kbdUsed = true;
    if (G.sel < 0) G.sel = 0;
    else {
      const r = (G.sel / n) | 0, c = G.sel % n;
      if (move === -1 && c > 0) G.sel--;
      if (move === 1 && c < n - 1) G.sel++;
      if (move === -n && r > 0) G.sel -= n;
      if (move === n && r < n - 1) G.sel += n;
    }
    draw();
    return;
  }
  if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const input = KINDS[G.kind].input;
  if (input === "digits") {
    if (/^[1-9]$/.test(e.key)) inputDigit(+e.key);
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
    else if (e.key === "n" || e.key === "N") toggleNotes();
    else return;
  } else if (G.sel >= 0) {
    const i = G.sel;
    if (input === "cycle") {
      if (e.key === " " || e.key === "Enter") cycleTakuzu(i);
      else if (e.key === "0" || e.key === "1") {
        if (isGiven(i)) return;
        const act = begin(); setCell(act, i, +e.key); commit(act, "tick");
      } else if (e.key === "Backspace" || e.key === "Delete") erase();
      else return;
    } else {
      const act = begin();
      if (e.key === " " || e.key === "Enter") { const v = G.cells[i]; setCell(act, i, v === 0 ? 1 : v === 1 ? 2 : 0); if (G.cells[i] === 2) autodot(act, i); }
      else if (e.key === "s" || e.key === "S" || e.key === "*") { setCell(act, i, G.cells[i] === 2 ? 0 : 2); if (G.cells[i] === 2) autodot(act, i); }
      else if (e.key === "." || e.key === "x" || e.key === "X") setCell(act, i, G.cells[i] === 1 ? 0 : 1);
      else if (e.key === "Backspace" || e.key === "Delete") setCell(act, i, 0);
      else return;
      commit(act, "tick");
    }
  } else return;
  e.preventDefault();
});

/* ---------- controls ---------- */
function tool(id, icon, label) {
  return `<button type="button" class="tool" id="${id}"><span class="ico">${ICON[icon]}</span>${label}</button>`;
}
function buildControls() {
  const k = G.kind, n = G.p.n, pad = $("#pad"), tools = $("#tools");
  if (KINDS[k].input === "digits") {
    pad.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    let h = "";
    for (let d = 1; d <= n; d++) h += `<button type="button" class="key" data-d="${d}" aria-label="${d}">${d}<small></small></button>`;
    pad.innerHTML = h;
    tools.innerHTML = tool("tUndo", "undo", _t("tool.undo")) + tool("tErase", "erase", _t("tool.erase")) + tool("tNotes", "pencil", _t("tool.notes")) + tool("tHint", "bulb", _t("tool.hint"));
    pad.querySelectorAll(".key").forEach((b) => b.addEventListener("click", () => inputDigit(+b.dataset.d)));
    $("#tErase").addEventListener("click", erase);
    $("#tNotes").addEventListener("click", toggleNotes);
  } else if (k === "takuzu") {
    pad.style.gridTemplateColumns = "1fr";
    pad.innerHTML = `<div class="legend">${_t("legend.takuzu", { sun: `<i style="background:${readColors().sun}"></i>`, moon: `<i style="background:${readColors().moon}"></i>` })}</div>`;
    tools.innerHTML = tool("tUndo", "undo", _t("tool.undo")) + tool("tHint", "bulb", _t("tool.hint"));
  } else {
    pad.style.gridTemplateColumns = "1fr";
    pad.innerHTML = `<div class="legend">${_t("legend.stars", { k: G.p.k })}</div>`;
    tools.innerHTML = tool("tUndo", "undo", _t("tool.undo")) + tool("tAuto", "dots", _t("tool.autodot")) + tool("tHint", "bulb", _t("tool.hint"));
    $("#tAuto").addEventListener("click", () => { store.settings.autodot = !store.settings.autodot; save(); updateControls(); });
  }
  $("#tUndo").addEventListener("click", undo);
  $("#tHint").addEventListener("click", hint);
  updateControls();
}
function toggleNotes() { if (!G) return; G.noteMode = !G.noteMode; updateControls(); }
function updateControls() {
  if (!G) return;
  const u = $("#tUndo");
  if (u) u.disabled = !G.undo.length || G.done;
  const nb = $("#tNotes");
  if (nb) { nb.setAttribute("aria-pressed", String(G.noteMode)); $("#pad").classList.toggle("notes", G.noteMode); }
  const ab = $("#tAuto");
  if (ab) ab.setAttribute("aria-pressed", String(!!store.settings.autodot));
  const keys = $("#pad").querySelectorAll(".key");
  if (keys.length) {
    const n = G.p.n, count = new Array(n + 1).fill(0);
    G.cells.forEach((v) => { if (v > 0) count[v]++; });
    keys.forEach((b) => {
      const d = +b.dataset.d;
      b.classList.toggle("used", count[d] >= n);
      b.querySelector("small").textContent = G.kind === "sudoku" && count[d] < n ? String(n - count[d]) : "";
    });
  }
}

/* ---------- hints ---------- */
function isWrong(i) {
  const p = G.p, v = G.cells[i];
  if (p.kind === "sudoku" || p.kind === "calcudoku") return v !== 0 && v !== p.solution[i];
  if (p.kind === "takuzu") return v >= 0 && v !== p.solution[i];
  return (v === 2 && p.solution[i] !== 1) || (v === 1 && p.solution[i] === 1);
}
let toastTimer = 0;
function toast(text, ms) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms || 3200);
}
function hint() {
  if (!G || G.done) return;
  const p = G.p, n = p.n;
  // 1. a wrong entry is the most useful thing to point out
  for (let i = 0; i < n * n; i++) {
    if (!isWrong(i)) continue;
    G.hints++;
    G.sel = i;
    G.flash = { cell: i, until: performance.now() + 1400, bad: true };
    const what = p.kind === "stars" ? (G.cells[i] === 2 ? "wrong.star" : "wrong.dot") : p.kind === "takuzu" ? "wrong.symbol" : "wrong.digit";
    toast(_t(what, { v: G.cells[i] }), 4500);
    const act = begin();
    setCell(act, i, p.kind === "takuzu" ? -1 : 0, 0);
    commit(act, "erase");
    kick();
    return;
  }
  // 2. otherwise: the next logical step
  let h = null;
  if (p.kind === "sudoku") {
    const r = GraphiteSudoku.hint(G.cells);
    if (r) h = { cell: r.cell, value: r.value, text: sudokuHintText(r) };
  } else if (p.kind === "takuzu") {
    const r = GraphiteTakuzu.hint(G.cells, n);
    if (r) h = { cell: r.cell, value: r.value, text: takuzuHintText(r, n) };
  } else if (p.kind === "calcudoku") {
    const res = GraphiteCalcudoku.solve(n, p.cages, 1, G.cells);
    let best = -1, bestN = 99;
    for (let i = 0; i < n * n; i++) {
      if (G.cells[i]) continue;
      const c = res.domains ? GraphiteCommon.popcount(res.domains[i]) : 9;
      if (c < bestN) { best = i; bestN = c; }
    }
    if (best >= 0) h = { cell: best, value: p.solution[best], text: _t(bestN === 1 ? "hint.calcuOnly" : "hint.calcuIs", { v: p.solution[best] }) };
  } else {
    // the missing star in the row with the fewest open cells
    let best = -1, bestOpen = 99;
    for (let i = 0; i < n * n; i++) {
      if (p.solution[i] !== 1 || G.cells[i] === 2) continue;
      const r = (i / n) | 0;
      let open = 0;
      for (let c = 0; c < n; c++) if (G.cells[r * n + c] === 0) open++;
      if (open < bestOpen) { best = i; bestOpen = open; }
    }
    if (best >= 0) h = { cell: best, value: 2, text: _t("hint.star") };
  }
  if (!h) {
    for (let i = 0; i < n * n; i++) {
      const want = p.kind === "stars" ? (p.solution[i] ? 2 : null) : p.solution[i];
      if (want !== null && G.cells[i] !== want) { h = { cell: i, value: want, text: _t("hint.filled") }; break; }
    }
  }
  if (!h) return;
  G.hints++;
  const act = begin();
  setCell(act, h.cell, h.value, 0);
  if (p.kind === "stars") autodot(act, h.cell);
  if (p.kind === "sudoku" || p.kind === "calcudoku") for (const j of peersOf(h.cell)) if (G.notes[j] & (1 << h.value)) setCell(act, j, G.cells[j], G.notes[j] & ~(1 << h.value));
  G.sel = h.cell;
  G.flash = { cell: h.cell, until: performance.now() + 1400, bad: false };
  toast(h.text, 5200);
  commit(act, "tick");
  kick();
}
function sudokuHintText(r) {
  const v = { v: r.value, unit: _t("unit." + r.unit) };
  if (r.how === "hidden") return _t(r.after ? "hint.hiddenAfter" : "hint.hidden", v);
  return _t(r.after ? "hint.nakedAfter" : "hint.naked", v);
}
function takuzuHintText(r, n) {
  const name = (v) => (v === 0 ? "sun" : "moon");
  const vars = {
    me: _t("sym." + name(r.value)), mes: _t("syms." + name(r.value)), others: _t("syms." + name(1 - r.value)),
    line: _t(r.line < n ? "unit.row" : "unit.column"),
  };
  return _t(r.why === "pair" || r.why === "sandwich" || r.why === "count" ? "hint." + r.why : "hint.lines", vars);
}

/* ---------- winning ---------- */
function solved() {
  const p = G.p;
  if (p.kind === "stars") return G.cells.every((v, i) => (v === 2) === (p.solution[i] === 1));
  return G.cells.every((v, i) => v === p.solution[i]);
}
function checkWin() {
  if (!G || G.done || !solved()) return;
  G.done = true;
  const stars = G.hints === 0 ? 3 : G.hints <= 2 ? 2 : 1;
  const time = Math.round(G.elapsed);
  let best = 0, newBest = false;
  if (G.date) {
    const d = (store.daily[G.date] = store.daily[G.date] || {});
    d[G.kind] = Math.max(d[G.kind] || 0, stars);
  } else {
    const pr = prog(G.kind, G.tier);
    pr.done[G.level] = Math.max(pr.done[G.level] || 0, stars);
    newBest = !pr.best || time < pr.best;
    if (newBest) pr.best = time;
    best = pr.best;
  }
  delete store.current[G.slot];
  save();
  sfx("win");
  if (window.Platform) Platform.haptic(30);
  updateControls();
  G.sel = -1;
  const show = () => showWin(stars, time, best, newBest);
  if (reduceMotion.matches) { draw(); show(); return; }
  const now = performance.now();
  G.win = { start: now, until: now + 1300 };
  kick();
  setTimeout(show, 1150);
}
function showWin(stars, time, best, newBest) {
  if (!G) return;
  const kind = KINDS[G.kind].name;
  $("#ovPill").textContent = G.date ? _t("daily", { tier: kind }) : kind + " · " + TIER_LABEL[G.tier];
  $("#ovTitle").textContent = _t("win." + stars);
  $("#ovStars").innerHTML = [1, 2, 3].map((k) => ICON.star.replace("<svg", `<svg class="${k <= stars ? "on" : ""}"`)).join("");
  let text = _t("win.text", { what: G.date ? _t("win.todays") : _t("level", { n: G.level }), time: fmtTime(time), hints: _t("hints", { n: G.hints }) });
  if (!G.date && newBest && Object.keys(prog(G.kind, G.tier).done).length > 1) text += _t("win.fastest", { tier: TIER_LABEL[G.tier] });
  else if (!G.date && best && !newBest) text += _t("win.best", { t: fmtTime(best) });
  if (G.date) {
    const s = streak();
    const left = KIND_ORDER.filter((k) => !(store.daily[G.date] || {})[k]).length;
    text += left ? _t("win.dailiesLeft", { n: left }) : _t("win.dailiesDone");
    if (s > 1) text += _t("win.streak", { n: s });
  }
  $("#ovText").textContent = text;
  const acts = $("#ovActions");
  acts.innerHTML = "";
  const btn = (label, primary, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn2" + (primary ? " primary" : ""); b.textContent = label;
    b.addEventListener("click", fn);
    acts.appendChild(b);
  };
  if (G.date) {
    btn(_t("back"), true, () => { closeOverlay(); goHome(); });
  } else {
    const kind = G.kind, tier = G.tier, next = G.level + 1;
    btn(_t("levels"), false, () => { closeOverlay(); goHome(); });
    btn(_t("nextLevel"), true, () => { closeOverlay(); startGame({ kind, tier, level: next }); });
  }
  $("#overlay").hidden = false;
  acts.querySelector(".primary").focus();
}
function closeOverlay() { $("#overlay").hidden = true; }

function confirmRestart() {
  if (!G || G.done) return;
  $("#ovPill").textContent = KINDS[G.kind].name;
  $("#ovTitle").textContent = _t("restart.title");
  $("#ovStars").innerHTML = "";
  $("#ovText").textContent = _t("restart.body");
  const acts = $("#ovActions");
  acts.innerHTML = "";
  const mk = (label, primary, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn2" + (primary ? " primary" : ""); b.textContent = label;
    b.addEventListener("click", fn); acts.appendChild(b);
  };
  mk(_t("cancel"), false, closeOverlay);
  mk(_t("restart.ok"), true, () => {
    closeOverlay();
    const act = begin();
    const init = initialCells(G.p);
    for (let i = 0; i < init.length; i++) setCell(act, i, init[i], 0);
    commit(act, "erase");
  });
  $("#overlay").hidden = false;
}

/* ---------- views & navigation ---------- */
function showView(v) {
  $("#home").hidden = v !== "game" ? false : true;
  $("#game").hidden = v !== "game";
  placeNav(v);
  if (v === "game" && !(history.state && history.state.graphite)) history.pushState({ graphite: 1 }, "");
}
function goHome() {
  if (history.state && history.state.graphite) history.back();
  else leaveGame();
}
function leaveGame() {
  persist();
  // open the level list on the page of the level just played
  if (G && !G.date) store.ui.page[G.kind + ":" + G.tier] = Math.floor((G.done ? G.level : G.level - 1) / PAGE);
  loadToken++;
  G = null;
  $("#overlay").hidden = true;
  $("#game").hidden = true;
  $("#home").hidden = false;
  placeNav("home");
  document.body.dataset.kind = store.ui.kind;
  renderHome();
}
window.addEventListener("popstate", () => { if (!$("#game").hidden) leaveGame(); });

/* ---------- home ---------- */
function curTier(kind) { return store.ui.tier[kind] || "easy"; }
function renderHome() {
  const kind = store.ui.kind, tier = curTier(kind), K = KINDS[kind];
  document.body.dataset.kind = kind;

  // today
  const date = today(), dt = dailyTier(date), rec = store.daily[date] || {};
  $("#todayRow").innerHTML = KIND_ORDER.map((k) => {
    const done = !!rec[k], wip = store.current[k + ":daily"] && store.current[k + ":daily"].key === keyOf(k, dt, 0, date);
    return `<button type="button" class="day${done ? " done" : ""}" data-kind="${k}" style="--k:var(--c-${k})" aria-label="${_t(done ? "day.ariaSolved" : "day.aria", { kind: KINDS[k].name, tier: TIER_LABEL[dt] })}">
      <span class="ico">${ICON[k]}</span><b>${KINDS[k].name}</b><small>${done ? _t("day.solved") : wip ? _t("day.wip") : TIER_LABEL[dt]}</small>
      ${done ? `<span class="check">${ICON.check}</span>` : ""}</button>`;
  }).join("");
  $("#todayRow").querySelectorAll(".day").forEach((b) => b.addEventListener("click", () => startGame({ kind: b.dataset.kind, tier: dt, date })));
  const s = streak();
  const doneToday = KIND_ORDER.filter((k) => rec[k]).length;
  $("#streak").textContent = s > 1 ? _t("streak", { n: s }) : doneToday ? _t("doneToday", { n: doneToday }) : _t("newEveryDay");

  // kinds
  $("#kinds").innerHTML = KIND_ORDER.map((k) => `<button type="button" class="kind" role="tab" data-kind="${k}" style="--k:var(--c-${k})" aria-selected="${k === kind}" aria-controls="panel"><span class="ico">${ICON[k]}</span>${KINDS[k].name}</button>`).join("");
  $("#kinds").querySelectorAll(".kind").forEach((b) => b.addEventListener("click", () => { store.ui.kind = b.dataset.kind; save(); renderHome(); }));

  $("#kindName").textContent = K.name;
  $("#kindDesc").textContent = K.desc;
  $("#tiers").innerHTML = TIERS.map((t, k) => `<button type="button" role="radio" data-tier="${t}" aria-checked="${t === tier}">${TIER_LABEL[t]}<span class="pips">${"●".repeat(k + 1)}</span></button>`).join("");
  $("#tiers").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { store.ui.tier[kind] = b.dataset.tier; save(); renderHome(); }));

  const pr = prog(kind, tier), solvedCount = Object.keys(pr.done).length;
  $("#tierMeta").textContent = K.tiers[tier] + (solvedCount ? _t("tier.solved", { n: solvedCount }) + (pr.best ? _t("tier.best", { t: fmtTime(pr.best) }) : "") + "." : "");
  const cur = store.current[kind + ":" + tier];
  const curLevel = cur ? +cur.key.split(":")[2] : 0;
  const next = nextLevel(kind, tier);
  const playLevel = curLevel || next;
  $("#playBtn").innerHTML = `<span class="ico">${ICON.play}</span>${_t(curLevel ? "play.continue" : "play.play", { n: playLevel })}`;
  $("#playBtn").onclick = () => startGame({ kind, tier, level: playLevel });

  // level grid
  const pageKey = kind + ":" + tier;
  if (store.ui.page[pageKey] === undefined) store.ui.page[pageKey] = Math.floor((playLevel - 1) / PAGE);
  const page = store.ui.page[pageKey];
  const first = page * PAGE + 1;
  let h = "";
  for (let l = first; l < first + PAGE; l++) {
    const st = pr.done[l] || 0;
    const cls = ["lvl", st ? "done" : "", l === next ? "next" : "", l === curLevel ? "wip" : ""].join(" ");
    const pips = st ? [1, 2, 3].map((k) => ICON.star.replace("<svg", `<svg class="${k <= st ? "on" : ""}"`)).join("") : "";
    h += `<button type="button" class="${cls}" data-l="${l}" aria-label="${st ? _t("lvl.ariaStars", { n: l, s: st }) : _t("lvl.aria", { n: l })}">${l}<small>${pips}</small></button>`;
  }
  $("#levelGrid").innerHTML = h;
  $("#levelGrid").querySelectorAll(".lvl").forEach((b) => b.addEventListener("click", () => startGame({ kind, tier, level: +b.dataset.l })));
  $("#pageLabel").textContent = `${first}–${first + PAGE - 1}`;
  $("#prevPage").disabled = page === 0;
  $("#prevPage").onclick = () => { store.ui.page[pageKey] = Math.max(0, page - 1); save(); renderHome(); };
  $("#nextPage").onclick = () => { store.ui.page[pageKey] = page + 1; save(); renderHome(); };

  $("#rulesName").textContent = K.name;
  $("#rulesBody").innerHTML = "<ul>" + K.rules.map((r) => `<li>${r}</li>`).join("") + "</ul>";
}

/* ---------- navigation: back (top left) and the menu drawer (top right) ---------- */
// The drawer holds the settings, and in a puzzle also "start over" and the rules.
function setting(key, icon) {
  return {
    icon, label: _t("set." + key), note: _t("set." + key + ".note"), checked: !!store.settings[key],
    onToggle(on) { store.settings[key] = on; save(); updateTimer(); if (G) { draw(); updateControls(); } },
  };
}
const nav = GameNav.create({
  title: "Graphite",
  items: () => {
    const inGame = !$("#game").hidden && G;
    const K = KINDS[inGame ? G.kind : store.ui.kind];
    return [
      inGame && { icon: "restart", label: _t("restart.ok"), onSelect: confirmRestart, disabled: G.done },
      inGame && { icon: "help", label: _t("howTo") + " " + K.name, html: "<ul>" + K.rules.map((r) => `<li>${r}</li>`).join("") + "</ul>" },
      { heading: _t("settings") },
      {
        icon: "theme", label: _t("appearance"), value: store.settings.theme,
        options: ["auto", "light", "dark"].map((v) => ({ value: v, label: _t("theme." + v) })),
        onChoose(v) { store.settings.theme = v; save(); applyTheme(); },
      },
      setting("mistakes", "mistakes"),
      setting("timer", "timer"),
      setting("autodot", "dots"),
      setting("sound", "sound"),
      !inGame && GameNav.language(),
    ];
  },
});
function placeNav(view) {
  if (view === "game") {
    $(".gbar").prepend(nav.back);
    $(".gbar").append(nav.menu);
    nav.setBack(goHome, _t("backToLevels"));
  } else {
    $("#homeBar").append(nav.back, nav.menu);
    nav.setBack();
  }
}

/* ---------- boot ---------- */
fillIcons();
applyTheme();
placeNav("home");
renderHome();
// Fonts arrive a moment after first paint; redraw so the board uses them.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (G) draw(); });
})();
