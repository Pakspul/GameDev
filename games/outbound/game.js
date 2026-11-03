(function () {
"use strict";
const G = OutboundGen, G3 = OutboundGen3D, GS = OutboundShapes;
const $ = (s) => document.querySelector(s);
const _t = I18n.t;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const ALL_TIERS = Object.assign({}, G.TIERS, G3.TIERS, GS.TIERS);
const kindOf = (t) => (t.indexOf("c-") === 0 ? "box" : t.indexOf("s-") === 0 ? "shape" : "flat");
// "c-hard" and "s-hard" share the "hard" name; the generators never read .name.
for (const t in ALL_TIERS) ALL_TIERS[t].name = _t("tier." + t.replace(/^[cs]-/, ""));
const MODE_LABEL = { flat: "", box: _t("modeLabel.box"), shape: _t("modeLabel.shape") };

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3 1.8-1.9 3.3-3 5.4-3 3.6 0 5.7 3.7 4.2 7.1C19.5 16.4 12 21 12 21z"/></svg>',
  heartPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.3-8.9-8.8C1.7 8 3.7 4.5 7 4.5c2 0 3.4 1 5 2.8 1.6-1.8 3-2.8 5-2.8 3.3 0 5.3 3.5 3.9 6.7"/><path d="M18 14v6M15 17h6" stroke-linecap="round"/></svg>',
  probe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6l7 6-7 6zM12 6l7 6-7 6z"/><path d="M20 5v14"/></svg>',
  lane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M4 18h5v-6h5"/><path d="M16 12h1M19.5 12h.5"/><path d="M11 9.5l3 2.5-3 2.5" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>',
  gem: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 8-8 12L4 10z"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  reset3d: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 8h5v4M16 16h-5"/><path d="M14.5 10.5L13 12l-1.5-1.5"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
  shapes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20V9h6v5h6v6z"/><path d="M15 14c0-4 2-6 6-6v12h-6"/></svg>'
};

const TIER_INFO = {
  easy:   { pips: 1 },
  medium: { pips: 2 },
  hard:   { pips: 3 },
  extra:  { pips: 4 },
  insane: { pips: 5 },
  master: { pips: 6 },
  grandmaster: { pips: 7 },
  "c-easy":   { pips: 1 },
  "c-medium": { pips: 2 },
  "c-hard":   { pips: 3 },
  "c-extra":  { pips: 4 },
  "c-insane": { pips: 5 },
  "s-easy":   { pips: 1 },
  "s-medium": { pips: 2 },
  "s-hard":   { pips: 3 },
  "s-extra":  { pips: 4 },
  "s-insane": { pips: 5 }
};
const TIER_PTS = { easy: 10, medium: 20, hard: 30, extra: 45, insane: 65, master: 90, grandmaster: 120,
  "c-easy": 15, "c-medium": 25, "c-hard": 40, "c-extra": 55, "c-insane": 75,
  "s-easy": 20, "s-medium": 35, "s-hard": 50, "s-extra": 70, "s-insane": 95 };
// Daily puzzle by weekday (0 = Sunday)
const DAILY = [
  { tier: "s-insane", level: 12 }, { tier: "hard", level: 40 }, { tier: "s-hard", level: 20 }, { tier: "extra", level: 30 },
  { tier: "c-extra", level: 12 }, { tier: "s-extra", level: 16 }, { tier: "master", level: 20 }
];
const SHOP = [
  { id: "probe", kind: "item", price: 40, icon: "probe" },
  { id: "heart", kind: "item", price: 60, icon: "heartPlus" },
  { id: "skip", kind: "item", price: 120, icon: "skip" },
  { id: "lane", kind: "unlock", price: 300, icon: "lane" },
  { id: "skin-rainbow", kind: "skin", price: 250 },
  { id: "skin-blueprint", kind: "skin", price: 150 },
  { id: "skin-ember", kind: "skin", price: 150 }
];
SHOP.forEach((s) => { s.name = _t("item." + s.id); s.desc = _t("item." + s.id + ".desc"); });
const PRICE = {}; SHOP.forEach((s) => (PRICE[s.id] = s.price));
const PAGE = 40;

/* ---------- theme + skins ---------- */
const root = document.documentElement;
let hostTheme = root.getAttribute("data-theme");
let ourTheme = hostTheme;
const SKINS = {
  ink: { name: "Ink" },
  rainbow: { name: "Rainbow", rainbow: true },
  blueprint: { name: "Blueprint", light: { board: "#24548f", arrow: "#f2f7ff", edge: "#8fb2dc" }, dark: { board: "#163661", arrow: "#dce9ff", edge: "#4f77ad" } },
  ember: { name: "Ember", light: { board: "#fbe8da", arrow: "#8d2e0c", edge: "#e2b495" }, dark: { board: "#2c1810", arrow: "#ffb28c", edge: "#5d3626" } }
};
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
const Theme = {
  c: {}, dark: false,
  read() {
    const cs = getComputedStyle(root);
    for (const k of ["ink", "board", "accent", "danger", "good", "line", "muted", "star", "surface", "bg"]) this.c[k] = cs.getPropertyValue("--" + k).trim();
    this.dark = lum(this.c.bg) < 0.4;
    for (const b of Board.all) { if (b.recolor) b.recolor(); b.draw(); }
  },
  apply(choice) {
    ourTheme = choice === "light" || choice === "dark" ? choice : hostTheme;
    if (ourTheme) root.setAttribute("data-theme", ourTheme); else root.removeAttribute("data-theme");
    this.read();
  }
};
function rainbowColor(id) { const h = (id * 137.508) % 360; return Theme.dark ? "hsl(" + h.toFixed(1) + ", 72%, 70%)" : "hsl(" + h.toFixed(1) + ", 68%, 36%)"; }
const Skin = {
  get id() { const s = Store.settings.skin; return SKINS[s] && (s === "ink" || Store.owns("skin-" + s)) ? s : "ink"; },
  pal(id) { const s = SKINS[id || this.id]; return s.light ? (Theme.dark ? s.dark : s.light) : null; },
  board() { const p = this.pal(); return p ? p.board : Theme.c.board; },
  edge() { const p = this.pal(); return p ? p.edge : Theme.c.muted; },
  arrow(id) {
    if (SKINS[this.id].rainbow) return rainbowColor(id);
    const p = this.pal(); return p ? p.arrow : Theme.c.ink;
  }
};

/* ---------- storage + economy ---------- */
const LS_PROGRESS = "outbound.progress.v1", LS_DATA = "outbound.data.v2", LS_SETTINGS = "outbound.settings.v1";
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function dayNum(s) { const [y, m, d] = s.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function starValue(t, st) { const b = TIER_PTS[t] || 0; return st >= 3 ? b : st === 2 ? Math.round(b * 0.6) : 0; }
function flawValue(t) { return Math.round((TIER_PTS[t] || 0) * 0.25); }
function fmtDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(I18n.lang === "nl" ? "nl-NL" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const Store = {
  data: { tiers: {}, flaw: {}, daily: {}, bought: {}, used: {}, owned: {} },
  settings: { smartTap: true, tier: "easy", tier3: "c-easy", tierS: "s-easy", mode: "flat", theme: "auto", skin: "ink", laneTrace: true },
  remote: null, writing: false, dirty: false,
  load() {
    const d = lsGet(LS_DATA), p = lsGet(LS_PROGRESS);
    this.data = this.merge(d, p ? { tiers: p } : null);
    const s = lsGet(LS_SETTINGS); if (s && typeof s === "object") Object.assign(this.settings, s);
    if (!G.TIERS[this.settings.tier]) this.settings.tier = "easy";
    if (!G3.TIERS[this.settings.tier3]) this.settings.tier3 = "c-easy";
    if (!GS.TIERS[this.settings.tierS]) this.settings.tierS = "s-easy";
    if (["flat", "3d", "shapes"].indexOf(this.settings.mode) < 0) this.settings.mode = "flat";
    if (["auto", "light", "dark"].indexOf(this.settings.theme) < 0) this.settings.theme = "auto";
    if (!SKINS[this.settings.skin]) this.settings.skin = "ink";
  },
  saveSettings() { lsSet(LS_SETTINGS, this.settings); },
  save() { lsSet(LS_DATA, this.data); lsSet(LS_PROGRESS, this.data.tiers); this.push(); },
  curTier() { const m = this.settings.mode; return m === "3d" ? this.settings.tier3 : m === "shapes" ? this.settings.tierS : this.settings.tier; },
  stars(tier, lv) { return (this.data.tiers[tier] && this.data.tiers[tier][lv]) || 0; },
  maxDone(tier) { const t = this.data.tiers[tier]; let m = 0; if (t) for (const k in t) if (t[k] > 0) m = Math.max(m, +k); return m; },
  unlocked(tier) { return this.maxDone(tier) + 1; },
  record(tier, lv, stars, flawless) {
    const before = this.balance();
    const t = this.data.tiers[tier] || (this.data.tiers[tier] = {});
    const prev = t[lv] || 0;
    if (stars > prev) t[lv] = stars;
    if (flawless && stars >= 2) { const f = this.data.flaw[tier] || (this.data.flaw[tier] = {}); f[lv] = 1; }
    this.save();
    return { prev, gained: this.balance() - before };
  },
  recordDaily(date, stars) {
    const before = this.balance();
    if (stars > (this.data.daily[date] || 0)) this.data.daily[date] = stars;
    this.save();
    return this.balance() - before;
  },
  streakAt(date) {
    let n = 0, d = dayNum(date);
    const set = new Set(Object.keys(this.data.daily).filter((k) => this.data.daily[k] > 0).map(dayNum));
    while (set.has(d)) { n++; d--; }
    return n;
  },
  currentStreak() { const t = todayStr(); if (this.data.daily[t]) return this.streakAt(t); const y = new Date(); y.setDate(y.getDate() - 1); return this.streakAt(todayStr(y)); },
  earned() {
    let e = 0;
    for (const t in this.data.tiers) for (const lv in this.data.tiers[t]) e += starValue(t, this.data.tiers[t][lv]);
    for (const t in this.data.flaw) for (const lv in this.data.flaw[t]) if (this.data.flaw[t][lv]) e += flawValue(t);
    for (const d in this.data.daily) { const st = this.data.daily[d]; if (st > 0) e += (st >= 3 ? 60 : 40) + 10 * Math.min(this.streakAt(d) - 1, 6); }
    return e;
  },
  spent() {
    let s = 0;
    for (const k in this.data.bought) s += (this.data.bought[k] || 0) * (PRICE[k] || 0);
    for (const k in this.data.owned) if (this.data.owned[k]) s += PRICE[k] || 0;
    return s;
  },
  balance() { return this.earned() - this.spent(); },
  count(item) { return Math.max(0, (this.data.bought[item] || 0) - (this.data.used[item] || 0)); },
  owns(id) { return !!this.data.owned[id]; },
  buy(id) {
    const it = SHOP.find((x) => x.id === id);
    if (!it || this.balance() < it.price) return false;
    if (it.kind === "item") this.data.bought[id] = (this.data.bought[id] || 0) + 1;
    else { if (this.owns(id)) return false; this.data.owned[id] = 1; }
    this.save();
    return true;
  },
  use(item) { if (this.count(item) < 1) return false; this.data.used[item] = (this.data.used[item] || 0) + 1; this.save(); return true; },
  // Every field only ever grows, so taking the max of each value merges devices safely.
  merge(a, b) {
    const out = { tiers: {}, flaw: {}, daily: {}, bought: {}, used: {}, owned: {} };
    const clamp = (v, hi) => Math.max(0, Math.min(hi, Math.floor(+v || 0)));
    for (const src of [a, b]) {
      if (!src || typeof src !== "object") continue;
      for (const field of ["tiers", "flaw"]) {
        const S = src[field]; if (!S || typeof S !== "object") continue;
        for (const tier in S) {
          if (!ALL_TIERS[tier] || typeof S[tier] !== "object") continue;
          const o = out[field][tier] || (out[field][tier] = {});
          for (const lv in S[tier]) { const v = clamp(S[tier][lv], field === "tiers" ? 3 : 1); if (v > (o[lv] || 0)) o[lv] = v; }
        }
      }
      if (src.daily && typeof src.daily === "object") for (const d in src.daily) { if (!/^\d{4}-\d\d-\d\d$/.test(d)) continue; const v = clamp(src.daily[d], 3); if (v > (out.daily[d] || 0)) out.daily[d] = v; }
      for (const field of ["bought", "used", "owned"]) {
        const S = src[field]; if (!S || typeof S !== "object") continue;
        for (const k in S) { if (!(k in PRICE)) continue; const v = clamp(S[k], field === "owned" ? 1 : 1e6); if (v > (out[field][k] || 0)) out[field][k] = v; }
      }
    }
    return out;
  },
  async sync() {
    if (!window.claude || typeof window.claude.use !== "function") return;
    try {
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      this.remote = db.doc("data/users/" + uid + "/progress");
      const snap = await this.remote.get();
      const remoteData = snap.exists ? snap.data() : null;
      const merged = this.merge(this.data, remoteData);
      const changed = JSON.stringify(merged) !== JSON.stringify(this.merge(remoteData, null));
      this.data = merged;
      lsSet(LS_DATA, merged); lsSet(LS_PROGRESS, merged.tiers);
      $("#syncNote").textContent = _t("sync.claude");
      if (changed) this.push();
      if (App.view === "home") Home.render(); else Game.renderHud();
    } catch (e) { this.remote = null; }
  },
  async push() {
    if (!this.remote) return;
    if (this.writing) { this.dirty = true; return; }
    this.writing = true;
    try { await this.remote.set(JSON.parse(JSON.stringify(this.data))); }
    catch (e) { if (e && (e.code === "not_granted" || e.code === "permission_denied" || e.code === "revoked")) this.remote = null; }
    this.writing = false;
    if (this.dirty) { this.dirty = false; this.push(); }
  }
};

/* ---------- shared pointer gestures: tap, hold, drag, pinch, wheel ---------- */
function bindGestures(target, h) {
  const ptrs = new Map();
  let gest = null, holdT = 0;
  const pos = (e) => { const r = target.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const clearHold = () => { clearTimeout(holdT); holdT = 0; };
  target.addEventListener("pointerdown", (e) => {
    if (!h.ready()) return;
    try { target.setPointerCapture(e.pointerId); } catch (_) {}
    const p = pos(e);
    ptrs.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, lx: p.x, ly: p.y, type: e.pointerType });
    if (ptrs.size === 1) {
      gest = { mode: "tap", start: h.panStart() };
      clearHold();
      holdT = setTimeout(() => { if (gest && gest.mode === "tap" && h.hold(p.x, p.y, e.pointerType)) gest.mode = "hold"; }, 380);
    } else if (ptrs.size === 2) {
      clearHold();
      if (gest && gest.mode === "hold") h.holdEnd();
      const [a, b] = [...ptrs.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      gest = { mode: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx0: mx, my0: my, start: h.pinchStart(mx, my) };
    }
  });
  target.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p || !gest) return;
    const q = pos(e); p.x = q.x; p.y = q.y;
    if (gest.mode === "tap" && Math.hypot(p.x - p.x0, p.y - p.y0) > 9) { clearHold(); gest.mode = h.canDrag() ? "drag" : "none"; }
    if (gest.mode === "drag") h.drag(p.x - p.x0, p.y - p.y0, p.x - p.lx, p.y - p.ly, gest.start);
    else if (gest.mode === "pinch" && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      h.pinch(Math.hypot(a.x - b.x, a.y - b.y) / gest.d0, (a.x + b.x) / 2, (a.y + b.y) / 2, gest.mx0, gest.my0, gest.start);
    }
    p.lx = p.x; p.ly = p.y;
  });
  const end = (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    ptrs.delete(e.pointerId);
    clearHold();
    if (gest && gest.mode === "hold" && ptrs.size === 0) h.holdEnd();
    else if (gest && gest.mode === "tap" && e.type === "pointerup" && ptrs.size === 0) h.tap(p.x, p.y, p.type);
    if (ptrs.size === 0) gest = null;
    else if (gest && gest.mode === "pinch") {
      const r = [...ptrs.values()][0]; r.x0 = r.x; r.y0 = r.y; r.lx = r.x; r.ly = r.y;
      gest = { mode: h.canDrag() ? "drag" : "none", start: h.panStart() };
    }
  };
  target.addEventListener("pointerup", end);
  target.addEventListener("pointercancel", end);
  target.addEventListener("wheel", (e) => { if (!h.ready()) return; e.preventDefault(); const p = pos(e); h.wheel(p.x, p.y, e.deltaY); }, { passive: false });
  target.addEventListener("contextmenu", (e) => e.preventDefault());
}

/* ---------- flat board ---------- */
class Board {
  constructor(canvas, opts) {
    opts = opts || {};
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    this.pad = opts.pad != null ? opts.pad : 14;
    this.lv = null; this.scale = 1; this.fit = 1; this.atFit = true; this.ox = 0; this.oy = 0;
    this.cw = 0; this.ch = 0; this.dpr = 1;
    this.anims = []; this.flash = new Map(); this.good = new Map(); this.hintId = -1; this.laneId = -1; this.raf = 0;
    this.onTap = null; this.onHold = null; this.onHoldEnd = null;
    Board.all.push(this);
    new ResizeObserver(() => this.resize()).observe(canvas);
    if (opts.interactive) bindGestures(canvas, {
      ready: () => !!this.lv,
      panStart: () => ({ ox: this.ox, oy: this.oy }),
      canDrag: () => !this.atFit,
      drag: (dx, dy, _a, _b, st) => { this.ox = st.ox + dx; this.oy = st.oy + dy; this.clampView(); this.draw(); },
      pinchStart: (mx, my) => ({ s0: this.scale, bx: (mx - this.ox) / this.scale, by: (my - this.oy) / this.scale }),
      pinch: (f, mx, my, _x, _y, st) => {
        const ns = Math.max(this.fit, Math.min(this.maxScale, st.s0 * f));
        this.scale = ns; this.atFit = Math.abs(ns - this.fit) < 1e-3;
        this.ox = mx - st.bx * ns; this.oy = my - st.by * ns;
        if (this.atFit) this.fitView(); else this.clampView();
        this.draw();
      },
      tap: (x, y, t) => this.onTap && this.onTap(x, y, t),
      hold: (x, y, t) => !!(this.onHold && this.onHold(x, y, t)),
      holdEnd: () => this.onHoldEnd && this.onHoldEnd(),
      wheel: (x, y, dy) => this.zoomAt(x, y, this.scale * Math.exp(-dy * 0.0016))
    });
  }
  setLevel(lv) {
    this.lv = lv;
    const n = lv.snakes.length;
    this.alive = new Uint8Array(n).fill(1);
    this.aliveCount = n;
    this.occ = G.buildOcc(lv.snakes, lv.W, lv.H);
    this.anims = []; this.flash.clear(); this.good.clear(); this.hintId = -1; this.laneId = -1;
    this.atFit = true;
    this.resize(true);
  }
  dropSilently(id) {
    if (!this.alive[id]) return;
    this.alive[id] = 0; this.aliveCount--;
    for (const c of this.lv.snakes[id]) this.occ[c] = -1;
  }
  resize(force) {
    const r = this.cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (!force && r.width === this.cw && r.height === this.ch && dpr === this.dpr) return;
    this.dpr = dpr; this.cw = r.width; this.ch = r.height;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    if (!this.lv) return;
    this.fit = Math.max(0.5, Math.min((this.cw - 2 * this.pad) / this.lv.W, (this.ch - 2 * this.pad) / this.lv.H));
    if (this.atFit) this.fitView(); else { this.scale = Math.max(this.scale, this.fit); this.clampView(); }
    this.draw();
  }
  get maxScale() { return Math.max(this.fit * 6, 46); }
  fitView() {
    this.scale = this.fit; this.atFit = true;
    this.ox = (this.cw - this.lv.W * this.scale) / 2;
    this.oy = (this.ch - this.lv.H * this.scale) / 2;
  }
  resetView() { if (this.lv) { this.fitView(); this.draw(); } }
  zoomBy(f) { this.zoomAt(this.cw / 2, this.ch / 2, this.scale * f); }
  clampView() {
    const bw = this.lv.W * this.scale, bh = this.lv.H * this.scale, slack = this.scale * 1.5;
    this.ox = bw <= this.cw ? (this.cw - bw) / 2 : Math.min(slack, Math.max(this.cw - bw - slack, this.ox));
    this.oy = bh <= this.ch ? (this.ch - bh) / 2 : Math.min(slack, Math.max(this.ch - bh - slack, this.oy));
  }
  zoomAt(px, py, ns) {
    if (!this.lv) return;
    ns = Math.max(this.fit, Math.min(this.maxScale, ns));
    const bx = (px - this.ox) / this.scale, by = (py - this.oy) / this.scale;
    this.scale = ns; this.atFit = Math.abs(ns - this.fit) < 1e-3;
    this.ox = px - bx * ns; this.oy = py - by * ns;
    if (this.atFit) this.fitView(); else this.clampView();
    this.draw();
  }
  focus(id) {
    const sn = this.lv.snakes[id], cell = sn[sn.length - 1];
    const W = this.lv.W, x = cell % W, y = (cell / W) | 0;
    if (this.fit < 12 && this.scale < 16) this.zoomAt(this.ox + (x + 0.5) * this.scale, this.oy + (y + 0.5) * this.scale, 16);
    const px = this.ox + (x + 0.5) * this.scale, py = this.oy + (y + 0.5) * this.scale;
    const m = this.scale * 2;
    if (px < m || py < m || px > this.cw - m || py > this.ch - m) {
      this.ox = this.cw / 2 - (x + 0.5) * this.scale;
      this.oy = this.ch / 2 - (y + 0.5) * this.scale;
      this.clampView();
    }
    this.kick();
  }
  showHint(id) { this.hintId = id; this.focus(id); }
  showLane(id) { this.laneId = id; this.draw(); }
  hideLane() { this.laneId = -1; this.draw(); }
  markGood(id) { this.good.set(id, performance.now() + 1500); this.kick(); }
  blockerOf(id) { return G.rayBlocker(this.lv.snakes[id], this.occ, this.lv.W, this.lv.H); }
  isFree(id) { return this.blockerOf(id) === -2; }
  distTo(id, bx, by) {
    const s = this.lv.snakes[id], W = this.lv.W;
    let best = 1e9, px = s[0] % W + 0.5, py = ((s[0] / W) | 0) + 0.5;
    const seg = (ax, ay, cx, cy) => {
      const dx = cx - ax, dy = cy - ay, L = dx * dx + dy * dy;
      let t = L ? ((bx - ax) * dx + (by - ay) * dy) / L : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(bx - (ax + dx * t), by - (ay + dy * t));
      if (d < best) best = d;
    };
    for (let i = 1; i < s.length; i++) { const x = s[i] % W + 0.5, y = ((s[i] / W) | 0) + 0.5; seg(px, py, x, y); px = x; py = y; }
    const d = G.dirOf(s[s.length - 2], s[s.length - 1], W);
    seg(px, py, px + G.DX[d] * 0.35, py + G.DY[d] * 0.35);
    return best;
  }
  pickScreen(px, py, type, smart) {
    const bx = (px - this.ox) / this.scale, by = (py - this.oy) / this.scale;
    const tol = Math.max(0.55, Math.min(1.6, (type === "mouse" ? 7 : 15) / this.scale + 0.15));
    let best = -1, bd = 1e9, bestFree = -1, bfd = 1e9;
    for (let id = 0; id < this.alive.length; id++) {
      if (!this.alive[id]) continue;
      const d = this.distTo(id, bx, by);
      if (d > tol) continue;
      if (d < bd) { bd = d; best = id; }
      if (smart && d < bfd && this.isFree(id)) { bfd = d; bestFree = id; }
    }
    return smart && bestFree >= 0 ? bestFree : best;
  }
  bumping(id) { return this.anims.some((a) => a.id === id && a.kind === "bump"); }
  ext(id, extra) {
    const s = this.lv.snakes[id], W = this.lv.W, H = this.lv.H;
    const pts = s.map((c) => [c % W, (c / W) | 0]);
    const d = G.dirOf(s[s.length - 2], s[s.length - 1], W);
    const [hx, hy] = pts[pts.length - 1];
    const edge = d === 0 ? hy + 1 : d === 1 ? W - hx : d === 2 ? H - hy : hx + 1;
    const n = extra != null ? extra : edge + s.length + 3;
    for (let k = 1; k <= n; k++) pts.push([hx + G.DX[d] * k, hy + G.DY[d] * k]);
    return pts;
  }
  remove(id, onDone) {
    this.dropSilently(id);
    if (this.hintId === id) this.hintId = -1;
    if (this.laneId === id) this.laneId = -1;
    this.anims = this.anims.filter((a) => a.id !== id);
    if (reduceMotion.matches) { this.draw(); if (onDone) onDone(); return; }
    const ext = this.ext(id), len = this.lv.snakes[id].length;
    this.anims.push({ id, kind: "out", ext, len, t0: performance.now(), dist: ext.length - len, onDone });
    this.kick();
  }
  bump(id, onDone) {
    const s = this.lv.snakes[id], W = this.lv.W, H = this.lv.H;
    const h = s[s.length - 1], d = G.dirOf(s[s.length - 2], h, W);
    let x = h % W, y = (h / W) | 0, k = 0, blocker = -1;
    while (true) {
      x += G.DX[d]; y += G.DY[d]; k++;
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      const o = this.occ[y * W + x];
      if (o !== -1) { blocker = o; break; }
    }
    const until = performance.now() + 900;
    this.flash.set(id, until);
    if (blocker >= 0) this.flash.set(blocker, until);
    const fwd = Math.max(0.25, k - 1 + 0.3);
    const ext = this.ext(id, k + 1);
    this.anims = this.anims.filter((a) => a.id !== id);
    this.anims.push({ id, kind: "bump", ext, len: s.length, t0: performance.now(), fwd, dur: reduceMotion.matches ? 1 : Math.min(0.75, 0.22 + fwd * 0.03) * 1000, onDone });
    this.kick();
    return blocker;
  }
  flashPair(id) {
    const b = this.blockerOf(id), until = performance.now() + 1500;
    this.flash.set(id, until); if (b >= 0) this.flash.set(b, until);
    this.kick();
  }
  kick() { if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t)); }
  loop(now) {
    this.raf = 0;
    this.draw(now);
    let busy = false;
    for (const m of [this.flash, this.good]) for (const [id, u] of m) { if (u > now) busy = true; else m.delete(id); }
    if (this.anims.length || busy || this.hintId >= 0) this.kick();
  }
  colorOf(id, now) {
    if ((this.flash.get(id) || 0) > now) return Theme.c.danger;
    if ((this.good.get(id) || 0) > now) return Theme.c.good;
    return Skin.arrow(id);
  }
  draw(now) {
    if (!this.lv || !this.cw) return;
    now = now || performance.now();
    const ctx = this.ctx, c = Theme.c, s = this.scale, W = this.lv.W, H = this.lv.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    const m = s * 0.55, r = Math.min(16, s * 0.9);
    ctx.fillStyle = Skin.board();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(this.ox - m, this.oy - m, W * s + 2 * m, H * s + 2 * m, r);
    else ctx.rect(this.ox - m, this.oy - m, W * s + 2 * m, H * s + 2 * m);
    ctx.fill();
    const lw = Math.max(1.15, Math.min(6, s * 0.135));
    const animIds = new Set(this.anims.map((a) => a.id));
    for (let id = 0; id < this.alive.length; id++) {
      if (!this.alive[id] || animIds.has(id)) continue;
      const sn = this.lv.snakes[id];
      const pts = sn.map((cc) => [cc % W, (cc / W) | 0]);
      const d = G.dirOf(sn[sn.length - 2], sn[sn.length - 1], W);
      const col = this.colorOf(id, now), hot = col === c.danger || col === c.good;
      if (id === this.hintId) {
        const pulse = 0.22 + 0.16 * Math.sin(now / 180);
        this.stroke(pts, G.DX[d], G.DY[d], c.accent, lw * 4.2, pulse);
        this.stroke(pts, G.DX[d], G.DY[d], c.accent, lw * 1.25, 1);
      } else this.stroke(pts, G.DX[d], G.DY[d], col, hot ? lw * 1.25 : lw, 1);
    }
    if (this.laneId >= 0 && this.alive[this.laneId]) this.drawLane(this.laneId, lw);
    const keep = [];
    for (const a of this.anims) {
      const t = Math.max(0, (now - a.t0) / 1000);
      let pos, alpha = 1, done = false;
      if (a.kind === "out") {
        pos = 16 * t + 70 * t * t;
        if (pos >= a.dist) { pos = a.dist; done = true; }
        alpha = Math.max(0, Math.min(1, (a.dist - pos) / 4));
      } else {
        const u = Math.max(0, Math.min(1, (now - a.t0) / a.dur));
        pos = a.fwd * Math.sin(Math.PI * u);
        if (u >= 1) { pos = 0; done = true; }
      }
      const pts = this.slice(a.ext, pos, a.len);
      const hi = Math.min(a.ext.length - 2, Math.floor(pos + a.len - 1));
      const dx = a.ext[hi + 1][0] - a.ext[hi][0], dy = a.ext[hi + 1][1] - a.ext[hi][1];
      if (!done) this.stroke(pts, dx, dy, this.colorOf(a.id, now), a.kind === "bump" ? lw * 1.2 : lw, alpha);
      if (done) { if (a.kind === "bump" && this.alive[a.id]) this.drawStatic(a.id, now, lw); if (a.onDone) a.onDone(); }
      else keep.push(a);
    }
    this.anims = keep;
  }
  drawLane(id, lw) {
    const ctx = this.ctx, s = this.scale, W = this.lv.W, H = this.lv.H, sn = this.lv.snakes[id];
    const h = sn[sn.length - 1], d = G.dirOf(sn[sn.length - 2], h, W);
    const hx = h % W + 0.5, hy = ((h / W) | 0) + 0.5;
    const ex = d === 1 ? W + 0.4 : d === 3 ? -0.4 : hx, ey = d === 2 ? H + 0.4 : d === 0 ? -0.4 : hy;
    ctx.save();
    ctx.strokeStyle = Theme.c.accent; ctx.lineWidth = Math.max(1.5, lw * 0.9);
    ctx.setLineDash([Math.max(3, s * 0.32), Math.max(3, s * 0.22)]);
    ctx.beginPath();
    ctx.moveTo(this.ox + (hx + G.DX[d] * 0.45) * s, this.oy + (hy + G.DY[d] * 0.45) * s);
    ctx.lineTo(this.ox + ex * s, this.oy + ey * s);
    ctx.stroke();
    ctx.restore();
  }
  drawStatic(id, now, lw) {
    const W = this.lv.W, sn = this.lv.snakes[id];
    const d = G.dirOf(sn[sn.length - 2], sn[sn.length - 1], W);
    this.stroke(sn.map((cc) => [cc % W, (cc / W) | 0]), G.DX[d], G.DY[d], this.colorOf(id, now), lw, 1);
  }
  slice(ext, pos, len) {
    const at = (f) => {
      f = Math.max(0, f);
      const i = Math.min(ext.length - 2, Math.floor(f)), u = f - i;
      return [ext[i][0] + (ext[i + 1][0] - ext[i][0]) * u, ext[i][1] + (ext[i + 1][1] - ext[i][1]) * u];
    };
    const end = pos + len - 1, out = [at(pos)];
    for (let i = Math.floor(pos) + 1; i < end; i++) out.push(ext[i]);
    out.push(at(end));
    return out;
  }
  stroke(pts, dx, dy, color, lw, alpha) {
    const ctx = this.ctx, s = this.scale, ox = this.ox, oy = this.oy;
    const X = (p) => ox + (p[0] + 0.5) * s, Y = (p) => oy + (p[1] + 0.5) * s;
    const head = pts[pts.length - 1];
    const hx = X(head), hy = Y(head);
    const tip = s * 0.36, back = s * 0.08, hw = Math.max(lw * 1.7, s * 0.23);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = lw; ctx.lineJoin = "miter"; ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(X(pts[0]), Y(pts[0]));
    for (let i = 1; i < pts.length - 1; i++) ctx.lineTo(X(pts[i]), Y(pts[i]));
    ctx.lineTo(hx - dx * back, hy - dy * back);
    ctx.stroke();
    const bx = hx - dx * back, by = hy - dy * back;
    ctx.beginPath();
    ctx.moveTo(hx + dx * tip, hy + dy * tip);
    ctx.lineTo(bx - dy * hw, by + dx * hw);
    ctx.lineTo(bx + dy * hw, by - dx * hw);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
Board.all = [];

/* ---------- three.js loader ---------- */
let threePromise = null;
function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "../../shared/vendor/three/three.min.js";
    s.onload = () => (window.THREE ? resolve() : reject(new Error("three missing")));
    s.onerror = () => { threePromise = null; reject(new Error("load failed")); };
    document.head.appendChild(s);
  });
  return threePromise;
}

/* ---------- levels ---------- */
// Turn a box level from the original 3D generator into the shared surface format (same cells, same arrows).
function surfaceFromBox(b) {
  const T = b.T, N = T.N;
  const cen = new Float32Array(N * 3), nrm = new Int8Array(N * 3), dir = new Int8Array(N * 12), et = new Uint8Array(N * 4);
  for (let c = 0; c < N; c++) {
    const F = T.faces[T.face[c]], p = T.pos(c);
    for (let t = 0; t < 3; t++) { cen[c * 3 + t] = p[t]; nrm[c * 3 + t] = F.n[t]; }
    for (let k = 0; k < 4; k++) {
      const d = T.dirVec(F, k);
      for (let t = 0; t < 3; t++) dir[c * 12 + k * 3 + t] = d[t];
      et[c * 4 + k] = T.face[T.nb[c * 4 + k]] === T.face[c] ? 0 : 1;
    }
  }
  return { N, cen, nrm, dir, nb: T.nb, et, center: [0, 0, 0], dims: b.dims.slice(), warp: null };
}
function makeLevel(tier, level, seedKey) {
  const k = kindOf(tier);
  if (k === "flat") { const f = G.generate(tier, level, seedKey); f.kind = "flat"; f.label = f.W + "×" + f.H; return f; }
  if (k === "box") { const b = G3.generate(tier, level, seedKey); return { kind: "surface", tier, level, S: surfaceFromBox(b), snakes: b.snakes, label: _t("shape." + b.shape) + " " + b.dims.join("×") }; }
  const s = GS.generate(tier, level, seedKey);
  return { kind: "surface", tier, level, S: s.S, snakes: s.snakes, label: _t("shape." + s.shape) + " " + s.S.dims.join("×") };
}

/* ---------- 3D board ---------- */
const RIB = 0.14, TIP = 0.36, BACK = 0.08, HW = 0.24, LIFT = 0.008;
class Board3D {
  constructor(canvas) {
    const T3 = window.THREE;
    this.cv = canvas;
    this.r = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.r.setClearColor(0x000000, 0);
    this.scene = new T3.Scene();
    this.cam = new T3.PerspectiveCamera(30, 1, 0.1, 2000);
    this.group = new T3.Group();
    this.body = new T3.Group();
    this.group.add(this.body);
    this.scene.add(this.group);
    this.scene.add(new T3.AmbientLight(0xffffff, 0.58));
    const sun = new T3.DirectionalLight(0xffffff, 0.62);
    sun.position.set(0.5, 1, 0.9);
    this.scene.add(sun);
    this.ray = new T3.Raycaster();
    this.home = new T3.Quaternion().setFromEuler(new T3.Euler(0.52, -0.72, 0, "XYZ"));
    this.zoom = 1; this.panX = 0; this.panY = 0; this.fitDist = 10;
    this.anims = []; this.flash = new Map(); this.good = new Map(); this.hintId = -1; this.laneId = -1; this.raf = 0; this.turn = null;
    this.cw = 0; this.ch = 0; this.lv = null; this.onTap = null; this.onHold = null; this.onHoldEnd = null;
    Board.all.push(this);
    new ResizeObserver(() => this.resize()).observe(canvas);
    const wpp = () => 2 * Math.tan(this.cam.fov * Math.PI / 360) * (this.fitDist / this.zoom) / Math.max(1, this.ch);
    bindGestures(canvas, {
      ready: () => !!this.lv,
      panStart: () => null,
      canDrag: () => true,
      drag: (_x, _y, ddx, ddy) => this.rotate(ddx, ddy),
      pinchStart: () => ({ z0: this.zoom, px0: this.panX, py0: this.panY }),
      pinch: (f, mx, my, mx0, my0, st) => {
        this.zoom = Math.max(0.75, Math.min(5, st.z0 * f));
        const w = wpp();
        this.panX = st.px0 - (mx - mx0) * w; this.panY = st.py0 + (my - my0) * w;
        this.updateCam(); this.draw();
      },
      tap: (x, y, t) => this.onTap && this.onTap(x, y, t),
      hold: (x, y, t) => !!(this.onHold && this.onHold(x, y, t)),
      holdEnd: () => this.onHoldEnd && this.onHoldEnd(),
      wheel: (_x, _y, dy) => this.zoomBy(Math.exp(-dy * 0.0016))
    });
  }
  disposeObj(o) { this.body.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }
  setLevel(lv) {
    const T3 = window.THREE;
    for (const ch of [...this.body.children]) this.disposeObj(ch);
    this.lv = lv; const S = this.S = lv.S;
    this.body.position.set(-S.center[0], -S.center[1], -S.center[2]);
    const geo = this.shapeGeometry(S);
    this.boxMat = new T3.MeshLambertMaterial({ color: Skin.board(), side: T3.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
    this.box = new T3.Mesh(geo, this.boxMat);
    this.body.add(this.box);
    this.edgeMat = new T3.LineBasicMaterial({ color: Skin.edge(), transparent: true, opacity: 0.55 });
    this.body.add(new T3.LineSegments(new T3.EdgesGeometry(geo, 20), this.edgeMat));
    const n = lv.snakes.length;
    this.alive = new Uint8Array(n).fill(1);
    this.aliveCount = n;
    this.occ = GS.buildOcc(S, lv.snakes);
    this.lanes = lv.snakes.map((s) => GS.lane(S, s));
    this.paths = lv.snakes.map((s, i) => this.buildPath(s, this.lanes[i]));
    this.meshes = this.paths.map((p, i) => {
      const mat = new T3.MeshBasicMaterial({ color: Skin.arrow(i), side: T3.DoubleSide, transparent: true });
      const m = new T3.Mesh(this.ribbon(this.slice(p, 0, p.body), RIB, true), mat);
      this.body.add(m);
      return m;
    });
    this.glow = null; this.laneMesh = null;
    this.anims = []; this.flash.clear(); this.good.clear(); this.hintId = -1; this.laneId = -1; this.turn = null;
    this.group.quaternion.copy(this.home);
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this.resize(true);
  }
  recolor() { if (this.lv) { this.boxMat.color.set(Skin.board()); this.edgeMat.color.set(Skin.edge()); } }
  dropSilently(id) {
    if (!this.alive[id]) return;
    this.alive[id] = 0; this.aliveCount--;
    for (const c of this.lv.snakes[id]) this.occ[c] = -1;
    this.meshes[id].visible = false;
  }
  warp(x, y, z, n) { return this.S.warp ? this.S.warp(x, y, z, n[0], n[1], n[2]) : [x, y, z, n[0], n[1], n[2], 0]; }
  shapeGeometry(S) {
    const T3 = window.THREE, k = S.warp ? 3 : 1, pos = [], nor = [];
    for (let c = 0; c < S.N; c++) {
      const C = [S.cen[c * 3], S.cen[c * 3 + 1], S.cen[c * 3 + 2]], n = [S.nrm[c * 3], S.nrm[c * 3 + 1], S.nrm[c * 3 + 2]];
      const u = [S.dir[c * 12], S.dir[c * 12 + 1], S.dir[c * 12 + 2]], v = [S.dir[c * 12 + 3], S.dir[c * 12 + 4], S.dir[c * 12 + 5]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
      const P = (a, b) => this.warp(C[0] + u[0] * (a / k - 0.5) + v[0] * (b / k - 0.5), C[1] + u[1] * (a / k - 0.5) + v[1] * (b / k - 0.5), C[2] + u[2] * (a / k - 0.5) + v[2] * (b / k - 0.5), n);
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
        const tris = flip ? [p00, p11, p10, p00, p01, p11] : [p00, p10, p11, p00, p11, p01];
        for (const q of tris) { pos.push(q[0], q[1], q[2]); nor.push(q[3], q[4], q[5]); }
      }
    }
    const g = new T3.BufferGeometry();
    g.setAttribute("position", new T3.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new T3.Float32BufferAttribute(nor, 3));
    return g;
  }
  // An arrow's full path: its body, its lane up to the exit edge, then on into the air.
  buildPath(s, ln) {
    const T3 = window.THREE, S = this.S;
    const cen = (c) => [S.cen[c * 3], S.cen[c * 3 + 1], S.cen[c * 3 + 2]], nrm = (c) => [S.nrm[c * 3], S.nrm[c * 3 + 1], S.nrm[c * 3 + 2]];
    const dirv = (c, k) => [S.dir[c * 12 + k * 3], S.dir[c * 12 + k * 3 + 1], S.dir[c * 12 + k * 3 + 2]];
    const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const F = [], cells = s.concat(ln.cells), laneF = [];
    let headF = 0;
    F.push({ p: cen(cells[0]), fn: nrm(cells[0]) });
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1], b = cells[i], na = nrm(a), nb = nrm(b);
      if (!same(na, nb)) {
        let k = 0; for (let j = 0; j < 4; j++) if (S.nb[a * 4 + j] === b) k = j;
        const d = dirv(a, k), ca = cen(a);
        F.push({ p: [ca[0] + d[0] * 0.5, ca[1] + d[1] * 0.5, ca[2] + d[2] * 0.5], fn: na, n2: nb });
      }
      F.push({ p: cen(b), fn: nb });
      if (i === s.length - 1) headF = F.length - 1;
      if (i >= s.length) laneF.push(F.length - 1);
    }
    const ec = cen(ln.exitFrom), ed = dirv(ln.exitFrom, ln.exitK);
    F.push({ p: [ec[0] + ed[0] * 0.5, ec[1] + ed[1] * 0.5, ec[2] + ed[2] * 0.5], fn: nrm(ln.exitFrom) });
    const exitF = F.length - 1;
    const P = [], N = [], map = new Int32Array(F.length);
    const put = (p, fn, n2) => {
      const w = this.warp(p[0], p[1], p[2], fn);
      let n = new T3.Vector3(w[3], w[4], w[5]);
      if (!w[6] && n2) n = new T3.Vector3(fn[0] + n2[0], fn[1] + n2[1], fn[2] + n2[2]).normalize();
      P.push(new T3.Vector3(w[0], w[1], w[2])); N.push(n);
    };
    for (let i = 0; i < F.length; i++) {
      const f = F[i];
      map[i] = P.length;
      put(f.p, f.fn, f.n2 || null);
      if (i === F.length - 1) break;
      const g = F[i + 1], segN = f.n2 || f.fn;
      const len = Math.hypot(g.p[0] - f.p[0], g.p[1] - f.p[1], g.p[2] - f.p[2]);
      const m = S.warp ? Math.max(1, Math.ceil(len / 0.25)) : 1;
      for (let j = 1; j < m; j++) {
        const t = j / m;
        put([f.p[0] + (g.p[0] - f.p[0]) * t, f.p[1] + (g.p[1] - f.p[1]) * t, f.p[2] + (g.p[2] - f.p[2]) * t], segN, null);
      }
    }
    const last = P[P.length - 1], prev = P[P.length - 2];
    const tan = last.clone().sub(prev).normalize(), airN = N[P.length - 2].clone();
    N[P.length - 1] = airN.clone();
    let bodyLen = 0;
    for (let i = 1; i <= map[headF]; i++) bodyLen += P[i].distanceTo(P[i - 1]);
    for (let t = 1; t <= Math.ceil(bodyLen) + 5; t++) { P.push(last.clone().addScaledVector(tan, t)); N.push(airN.clone()); }
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
    const headW = map[headF];
    const tipDir = P[headW + 1].clone().sub(P[headW]).normalize();
    return { P, N, L, body: L[headW], headW, rayS: laneF.map((fi) => L[map[fi]]), exitS: L[map[exitF]], tipDir };
  }
  at(p, s) {
    const L = p.L;
    s = Math.max(0, Math.min(L[L.length - 1], s));
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid; }
    const len = L[hi] - L[lo], u = len > 0 ? (s - L[lo]) / len : 0;
    return { v: p.P[lo].clone().lerp(p.P[hi], u), n: p.N[lo].clone().lerp(p.N[hi], u).normalize(), i: lo };
  }
  slice(p, a, b) {
    const A = this.at(p, a), B = this.at(p, b), pts = [A.v], nrm = [A.n];
    for (let j = A.i + 1; j < p.P.length && p.L[j] < b; j++) { if (p.L[j] <= a) continue; pts.push(p.P[j]); nrm.push(p.N[j]); }
    pts.push(B.v); nrm.push(B.n);
    return { pts, nrm };
  }
  // A flat strip that follows the surface, with mitred corners and an optional arrowhead.
  ribbon(sl, w, head, out) {
    const T3 = window.THREE, h = w / 2, P = [], N = [];
    for (let i = 0; i < sl.pts.length; i++) {
      if (P.length && sl.pts[i].distanceToSquared(P[P.length - 1]) < 1e-8) continue;
      P.push(sl.pts[i].clone()); N.push(sl.nrm[i]);
    }
    const arr = out || [];
    if (P.length >= 2) {
      const n = P.length, end = P[n - 1].clone(), dEnd = P[n - 1].clone().sub(P[n - 2]).normalize();
      if (head) P[n - 1].addScaledVector(dEnd, -BACK);
      const Ls = [], Rs = [];
      for (let i = 0; i < n; i++) {
        const nn = N[i];
        const din = i > 0 ? P[i].clone().sub(P[i - 1]).normalize() : null;
        const dout = i < n - 1 ? P[i + 1].clone().sub(P[i]).normalize() : null;
        const sin = din ? new T3.Vector3().crossVectors(din, nn).normalize() : null;
        const sout = dout ? new T3.Vector3().crossVectors(dout, nn).normalize() : null;
        let sv, scale = 1;
        if (sin && sout) { sv = sin.clone().add(sout); if (sv.lengthSq() < 1e-6) sv = sin.clone(); sv.normalize(); scale = 1 / Math.max(0.5, sv.dot(sin)); }
        else sv = (sin || sout).clone();
        const base = P[i].clone().addScaledVector(nn, LIFT);
        Ls.push(base.clone().addScaledVector(sv, h * scale)); Rs.push(base.clone().addScaledVector(sv, -h * scale));
      }
      for (let i = 0; i < n - 1; i++) {
        const a = Ls[i], b = Rs[i], c = Ls[i + 1], d = Rs[i + 1];
        arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
      }
      if (head) {
        const nn = N[n - 1], side = new T3.Vector3().crossVectors(dEnd, nn).normalize().multiplyScalar(HW);
        const e = end.clone().addScaledVector(nn, LIFT * 1.5);
        const tip = e.clone().addScaledVector(dEnd, TIP), base = e.clone().addScaledVector(dEnd, -BACK);
        const l = base.clone().add(side), r = base.clone().sub(side);
        arr.push(tip.x, tip.y, tip.z, l.x, l.y, l.z, r.x, r.y, r.z);
      }
    }
    if (out) return null;
    const g = new T3.BufferGeometry();
    g.setAttribute("position", new T3.Float32BufferAttribute(arr, 3));
    return g;
  }
  setGeo(id, geo) { const m = this.meshes[id]; m.geometry.dispose(); m.geometry = geo; }
  resize(force) {
    const r = this.cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (!force && r.width === this.cw && r.height === this.ch) return;
    this.cw = r.width; this.ch = r.height;
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.r.setSize(r.width, r.height, false);
    this.cam.aspect = r.width / r.height;
    if (this.lv) {
      const [X, Y, Z] = this.S.dims;
      const R = 0.5 * Math.sqrt(X * X + Y * Y + Z * Z) + 0.4;
      const v = this.cam.fov * Math.PI / 180, hz = 2 * Math.atan(Math.tan(v / 2) * this.cam.aspect);
      this.fitDist = R * 1.04 / Math.sin(Math.min(v, hz) / 2);
    }
    this.updateCam();
    this.draw();
  }
  updateCam() {
    const R = this.lv ? 0.5 * Math.max.apply(null, this.S.dims) : 5;
    this.panX = Math.max(-R, Math.min(R, this.panX)); this.panY = Math.max(-R, Math.min(R, this.panY));
    this.cam.position.set(this.panX, this.panY, this.fitDist / this.zoom);
    this.cam.lookAt(this.panX, this.panY, 0);
    this.cam.updateProjectionMatrix();
  }
  zoomBy(f) { this.zoom = Math.max(0.75, Math.min(5, this.zoom * f)); this.updateCam(); this.draw(); }
  resetView() { this.zoom = 1; this.panX = 0; this.panY = 0; this.updateCam(); this.turnTo(this.home); }
  turnTo(q) {
    if (reduceMotion.matches) { this.group.quaternion.copy(q); this.draw(); return; }
    this.turn = { from: this.group.quaternion.clone(), to: q.clone(), t0: performance.now(), dur: 650 };
    this.kick();
  }
  rotate(dx, dy) {
    const T3 = window.THREE, k = 0.0085;
    const qa = new T3.Quaternion().setFromAxisAngle(new T3.Vector3(0, 1, 0), dx * k);
    const qb = new T3.Quaternion().setFromAxisAngle(new T3.Vector3(1, 0, 0), dy * k);
    this.group.quaternion.premultiply(qb).premultiply(qa);
    this.turn = null;
    this.draw();
  }
  // Turn so the arrow's head faces the viewer. Tries several angles and takes the first
  // where nothing else (a pillar, the far side of a tunnel) blocks the view of it.
  focus(id) {
    const T3 = window.THREE, p = this.paths[id];
    this.zoom = Math.min(this.zoom, 1.15); this.panX = 0; this.panY = 0; this.updateCam();
    const save = this.group.quaternion.clone();
    const target = p.P[Math.max(0, p.headW - 1)].clone().lerp(p.P[p.headW], 0.5);
    const wn = p.N[p.headW].clone().applyQuaternion(save).normalize();
    const wants = [[0.28, 0.32, 1], [1, 0.4, 1], [-1, 0.4, 1], [0.3, 1, 1], [0.3, -1, 1], [2, 0.3, 1], [-2, 0.3, 1], [0.3, 2, 1], [0.3, -2, 1], [1.6, 1.6, 1], [-1.6, 1.6, 1], [1.6, -1.6, 1], [-1.6, -1.6, 1], [3, 0.2, 1], [-3, 0.2, 1], [0.2, 3, 1], [0.2, -3, 1]];
    let first = null, pick = null;
    for (const w of wants) {
      const q = new T3.Quaternion().setFromUnitVectors(wn, new T3.Vector3(w[0], w[1], w[2]).normalize()).multiply(save);
      if (!first) first = q;
      this.group.quaternion.copy(q); this.group.updateMatrixWorld(true);
      const wp = this.body.localToWorld(target.clone());
      this.ray.set(this.cam.position, wp.clone().sub(this.cam.position).normalize());
      const hh = this.ray.intersectObject(this.box);
      const sp = wp.clone().project(this.cam);
      if (hh.length && Math.abs(hh[0].distance - this.cam.position.distanceTo(wp)) < 0.3 && Math.abs(sp.x) < 0.9 && Math.abs(sp.y) < 0.85) { pick = q; break; }
    }
    this.group.quaternion.copy(save); this.group.updateMatrixWorld(true);
    this.turnTo(pick || first);
  }
  blockerOf(id) { return GS.rayBlocker(this.S, this.lv.snakes[id], this.occ, this.lanes[id]); }
  isFree(id) { return this.blockerOf(id) === -2; }
  pickScreen(px, py, type, smart) {
    const T3 = window.THREE;
    this.ray.setFromCamera(new T3.Vector2(px / this.cw * 2 - 1, -(py / this.ch) * 2 + 1), this.cam);
    const hits = this.ray.intersectObject(this.box);
    if (!hits.length) return -1;
    const hit = hits[0], H = this.body.worldToLocal(hit.point.clone()), camL = this.body.worldToLocal(this.cam.position.clone());
    const wpp = 2 * Math.tan(this.cam.fov * Math.PI / 360) * this.cam.position.distanceTo(hit.point) / this.ch;
    const tol = Math.max(0.55, Math.min(1.6, (type === "mouse" ? 7 : 15) * wpp + 0.15));
    const ab = new T3.Vector3(), ap = new T3.Vector3(), q = new T3.Vector3(), mid = new T3.Vector3(), tip = new T3.Vector3();
    let best = -1, bd = 1e9, bestFree = -1, bfd = 1e9;
    for (let id = 0; id < this.alive.length; id++) {
      if (!this.alive[id]) continue;
      const p = this.paths[id];
      let d = 1e9;
      const seg = (A, B, nn) => {
        mid.copy(A).add(B).multiplyScalar(0.5);
        if (q.copy(camL).sub(mid).dot(nn) <= 0) return;
        ab.copy(B).sub(A); ap.copy(H).sub(A);
        const L2 = ab.lengthSq(); let t = L2 ? ap.dot(ab) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const dd = q.copy(A).addScaledVector(ab, t).distanceTo(H);
        if (dd < d) d = dd;
      };
      for (let i = 0; i < p.headW; i++) seg(p.P[i], p.P[i + 1], p.N[i]);
      seg(p.P[p.headW], tip.copy(p.P[p.headW]).addScaledVector(p.tipDir, 0.35), p.N[p.headW]);
      if (d > tol) continue;
      if (d < bd) { bd = d; best = id; }
      if (smart && d < bfd && this.isFree(id)) { bfd = d; bestFree = id; }
    }
    return smart && bestFree >= 0 ? bestFree : best;
  }
  bumping(id) { return this.anims.some((a) => a.id === id && a.kind === "bump"); }
  remove(id, onDone) {
    this.alive[id] = 0; this.aliveCount--;
    for (const c of this.lv.snakes[id]) this.occ[c] = -1;
    if (this.hintId === id) this.clearHint();
    if (this.laneId === id) this.hideLane();
    this.anims = this.anims.filter((a) => a.id !== id);
    if (reduceMotion.matches) { this.meshes[id].visible = false; this.draw(); if (onDone) onDone(); return; }
    const p = this.paths[id];
    this.anims.push({ id, kind: "out", t0: performance.now(), dist: p.L[p.L.length - 1] - p.body, onDone });
    this.kick();
  }
  bump(id, onDone) {
    const ln = this.lanes[id], p = this.paths[id];
    let kb = -1, blocker = -1;
    for (let j = 0; j < ln.cells.length; j++) if (this.occ[ln.cells[j]] !== -1) { kb = j; blocker = this.occ[ln.cells[j]]; break; }
    const until = performance.now() + 900;
    this.flash.set(id, until);
    if (blocker >= 0) this.flash.set(blocker, until);
    const stop = kb >= 0 ? p.rayS[kb] - 0.75 : p.exitS - 0.35;
    const fwd = Math.max(0.25, stop - p.body);
    this.anims = this.anims.filter((a) => a.id !== id);
    this.anims.push({ id, kind: "bump", t0: performance.now(), fwd, dur: reduceMotion.matches ? 1 : Math.min(0.75, 0.22 + fwd * 0.03) * 1000, onDone });
    this.kick();
    return blocker;
  }
  flashPair(id) {
    const b = this.blockerOf(id), until = performance.now() + 1500;
    this.flash.set(id, until); if (b >= 0) this.flash.set(b, until);
    this.kick();
  }
  markGood(id) { this.good.set(id, performance.now() + 1500); this.kick(); }
  showHint(id) {
    const T3 = window.THREE;
    this.clearHint();
    this.hintId = id;
    const p = this.paths[id];
    this.glow = new T3.Mesh(this.ribbon(this.slice(p, 0, p.body), RIB * 3.6, true), new T3.MeshBasicMaterial({ color: Theme.c.accent, side: T3.DoubleSide, transparent: true, opacity: 0.3, depthWrite: false }));
    this.glow.renderOrder = -1;
    this.body.add(this.glow);
    this.focus(id);
    this.kick();
  }
  clearHint() { if (this.glow) { this.disposeObj(this.glow); this.glow = null; } this.hintId = -1; }
  showLane(id) {
    const T3 = window.THREE;
    this.hideLane();
    this.laneId = id;
    const p = this.paths[id], arr = [];
    for (let s = p.body + 0.45; s < p.exitS + 0.3; s += 0.55) this.ribbon(this.slice(p, s, Math.min(s + 0.32, p.exitS + 0.3)), 0.09, false, arr);
    const g = new T3.BufferGeometry();
    g.setAttribute("position", new T3.Float32BufferAttribute(arr, 3));
    this.laneMesh = new T3.Mesh(g, new T3.MeshBasicMaterial({ color: Theme.c.accent, side: T3.DoubleSide }));
    this.body.add(this.laneMesh);
    this.draw();
  }
  hideLane() { if (this.laneMesh) { this.disposeObj(this.laneMesh); this.laneMesh = null; } this.laneId = -1; this.draw(); }
  kick() { if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t)); }
  loop(now) {
    this.raf = 0;
    this.draw(now);
    let busy = false;
    for (const m of [this.flash, this.good]) for (const [id, u] of m) { if (u > now) busy = true; else m.delete(id); }
    if (this.anims.length || busy || this.hintId >= 0 || this.turn) this.kick();
  }
  draw(now) {
    if (!this.lv || !this.cw) return;
    now = now || performance.now();
    const c = Theme.c;
    if (this.turn) {
      const u = Math.min(1, Math.max(0, (now - this.turn.t0) / this.turn.dur)), e = 1 - Math.pow(1 - u, 3);
      this.group.quaternion.copy(this.turn.from).slerp(this.turn.to, e);
      if (u >= 1) this.turn = null;
    }
    for (let id = 0; id < this.meshes.length; id++) {
      if (!this.meshes[id].visible) continue;
      const fl = (this.flash.get(id) || 0) > now, gd = (this.good.get(id) || 0) > now;
      this.meshes[id].material.color.set(id === this.hintId ? c.accent : fl ? c.danger : gd ? c.good : Skin.arrow(id));
    }
    if (this.glow) { this.glow.material.color.set(c.accent); this.glow.material.opacity = 0.22 + 0.14 * Math.sin(now / 180); }
    if (this.laneMesh) this.laneMesh.material.color.set(c.accent);
    const keep = [];
    for (const a of this.anims) {
      const p = this.paths[a.id], t = Math.max(0, (now - a.t0) / 1000);
      let pos, alpha = 1, done = false;
      if (a.kind === "out") {
        pos = 16 * t + 70 * t * t;
        if (pos >= a.dist) { pos = a.dist; done = true; }
        alpha = Math.max(0, Math.min(1, (a.dist - pos) / 4));
      } else {
        const u = Math.max(0, Math.min(1, (now - a.t0) / a.dur));
        pos = a.fwd * Math.sin(Math.PI * u);
        if (u >= 1) { pos = 0; done = true; }
      }
      const m = this.meshes[a.id];
      if (a.kind === "out" && done) m.visible = false;
      else { this.setGeo(a.id, this.ribbon(this.slice(p, pos, pos + p.body), RIB, true)); m.material.opacity = alpha; }
      if (done && a.onDone) a.onDone();
      if (!done) keep.push(a);
    }
    this.anims = keep;
    this.r.render(this.scene, this.cam);
  }
}

/* ---------- game ---------- */
const Game = {
  board: null, board2: null, board3: null, tier: "easy", level: 1, daily: null, hearts: 3, maxHearts: 3, hintUsed: false, heartUsed: false,
  mistakes: 0, over: false, toastTimer: 0, token: 0, shown3dTip: false, probeArmed: false, cache: null,
  init() {
    this.board2 = new Board($("#boardCanvas"), { interactive: true, pad: 14 });
    this.wireBoard(this.board2);
    $("#backBtn").innerHTML = ICON.back;
    $("#restartBtn").innerHTML = ICON.restart;
    $("#zoomIn").innerHTML = ICON.plus;
    $("#zoomOut").innerHTML = ICON.minus;
    $("#hintIcon").innerHTML = ICON.bulb;
    $("#backBtn").onclick = () => App.show("home");
    $("#restartBtn").onclick = () => this.start(this.tier, this.level, { daily: this.daily });
    $("#hintBtn").onclick = () => this.hint();
    $("#zoomIn").onclick = () => this.board && this.board.zoomBy(1.4);
    $("#zoomOut").onclick = () => this.board && this.board.zoomBy(1 / 1.4);
    $("#zoomFit").onclick = () => this.board && this.board.resetView();
    $("#itemProbe").onclick = () => this.useProbe();
    $("#itemHeart").onclick = () => this.useHeart();
    $("#itemSkip").onclick = () => this.askSkip();
  },
  wireBoard(b) {
    b.onTap = (x, y, t) => this.tap(x, y, t);
    b.onHold = (x, y, t) => {
      if (this.over || !Store.owns("lane") || !Store.settings.laneTrace) return false;
      const id = b.pickScreen(x, y, t, false);
      if (id < 0) return false;
      b.showLane(id);
      return true;
    };
    b.onHoldEnd = () => b.hideLane();
  },
  async start(tier, level, opts) {
    opts = opts || {};
    const token = ++this.token, kind = kindOf(tier), three = kind !== "flat";
    this.tier = tier; this.level = level; this.daily = opts.daily || null;
    this.hearts = 3; this.maxHearts = 3; this.hintUsed = false; this.heartUsed = false; this.mistakes = 0; this.over = true; this.probeArmed = false;
    Overlay.hide(); Shop.close();
    App.show("game");
    const tierName = ALL_TIERS[tier].name + MODE_LABEL[kind];
    const pill = this.daily ? _t("dailyPill", { tier: tierName }) : tierName;
    $("#gTier").textContent = pill;
    $("#gLevel").textContent = this.daily ? fmtDate(this.daily) : _t("level", { n: level });
    $("#zoomFit").innerHTML = three ? ICON.reset3d : ICON.fit;
    $("#zoomFit").setAttribute("aria-label", _t(three ? "zoomReset" : "zoomFit"));
    $("#boardCanvas").hidden = three;
    $("#glCanvas").hidden = !three;
    this.renderHud();
    $("#loading").hidden = false;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    if (three) {
      try {
        await loadThree();
        if (!this.board3) { this.board3 = new Board3D($("#glCanvas")); this.wireBoard(this.board3); }
      } catch (e) {
        $("#loading").hidden = true;
        if (token !== this.token) return;
        Overlay.show({ tier: "3D", title: _t("err3d.title"), stars: null, text: _t("err3d.text"), actions: [{ label: _t("tryAgain"), primary: true, fn: () => this.start(tier, level, opts) }, { label: "All levels", fn: () => App.show("home") }] });
        return;
      }
    }
    if (token !== this.token) return;
    const key = tier + ":" + level + ":" + (this.daily || "");
    const lv = this.cache && this.cache.key === key ? this.cache.lv : makeLevel(tier, level, this.daily ? "daily:" + this.daily : undefined);
    this.cache = { key, lv };
    $("#loading").hidden = true;
    if (token !== this.token) return;
    this.board = three ? this.board3 : this.board2;
    $("#gTier").textContent = pill + " · " + lv.label;
    this.board.setLevel(lv);
    this.over = false;
    const rs = opts.restore;
    if (rs) {
      for (const id of rs.removed || []) if (id >= 0 && id < lv.snakes.length) this.board.dropSilently(id);
      this.maxHearts = rs.maxHearts === 4 ? 4 : 3; this.heartUsed = this.maxHearts === 4;
      this.hearts = Math.max(1, Math.min(this.maxHearts, rs.hearts || 3));
      this.hintUsed = !!rs.hintUsed; this.mistakes = rs.mistakes || 0;
      this.board.draw();
    }
    this.renderHud();
    if (three && !this.shown3dTip) { this.shown3dTip = true; this.toast(_t("tip3d")); }
  },
  renderHud() {
    const hb = $("#hearts");
    if (hb.children.length !== this.maxHearts) hb.innerHTML = ICON.heart.repeat(this.maxHearts);
    [...hb.children].forEach((el, i) => el.classList.toggle("lost", i >= this.hearts));
    hb.setAttribute("aria-label", _t("heartsLeft", { n: this.hearts }));
    const n = this.board && this.board.lv ? this.board.aliveCount : 0;
    $("#leftCount").textContent = _t("arrowsLeft", { n });
    $("#hintBtn").disabled = this.hintUsed || this.over;
    $("#hintText").textContent = _t(this.hintUsed ? "hint.used" : "hint");
    $("#hintSub").textContent = _t(this.hintUsed ? "hint.usedSub" : "hint.sub");
    const item = (el, icon, id, label, disabled, pressed) => {
      const c = Store.count(id);
      el.innerHTML = ICON[icon] + '<span class="badge">' + c + "</span>";
      el.classList.toggle("empty", c === 0);
      el.disabled = disabled;
      el.setAttribute("aria-label", _t("itemLeft", { label, n: c }));
      if (pressed != null) el.setAttribute("aria-pressed", String(pressed));
    };
    item($("#itemProbe"), "probe", "probe", _t("item.probe"), this.over, this.probeArmed);
    item($("#itemHeart"), "heartPlus", "heart", _t("item.heart"), this.over || this.heartUsed);
    item($("#itemSkip"), "skip", "skip", _t("item.skip"), this.over || !!this.daily);
  },
  toast(msg, ms) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove("show"), ms || 2000);
  },
  tap(px, py, type) {
    if (this.over || !this.board) return;
    const b = this.board;
    if (this.probeArmed) {
      const pid = b.pickScreen(px, py, type, false);
      if (pid >= 0) this.probe(pid);
      return;
    }
    const id = b.pickScreen(px, py, type, Store.settings.smartTap);
    if (id < 0 || b.bumping(id)) return;
    if (b.isFree(id)) {
      b.remove(id);
      this.renderHud();
      if (b.aliveCount === 0) { this.over = true; this.renderHud(); setTimeout(() => this.win(), reduceMotion.matches ? 150 : 650); }
    } else {
      this.hearts--; this.mistakes++;
      try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
      const lostEl = [...$("#hearts").children][this.hearts];
      if (lostEl) { lostEl.classList.remove("hit"); void lostEl.offsetWidth; lostEl.classList.add("hit"); }
      if (this.hearts <= 0) { this.over = true; b.bump(id, () => setTimeout(() => this.lose(), 250)); }
      else { b.bump(id); this.toast(this.hearts === 1 ? _t("blocked.last") : _t("blocked", { n: this.hearts })); }
      this.renderHud();
    }
  },
  useProbe() {
    if (this.over) return;
    if (this.probeArmed) { this.probeArmed = false; this.renderHud(); this.toast(_t("probe.away")); return; }
    if (Store.count("probe") < 1) { Shop.open("probe"); return; }
    this.probeArmed = true; this.renderHud();
    this.toast(_t("probe.armed"), 2600);
  },
  probe(id) {
    const b = this.board;
    this.probeArmed = false;
    if (!Store.use("probe")) { this.renderHud(); return; }
    b.showLane(id);
    setTimeout(() => { if (b.laneId === id) b.hideLane(); }, 1800);
    if (b.isFree(id)) { b.markGood(id); this.toast(_t("probe.free"), 2400); }
    else { b.flashPair(id); this.toast(_t("probe.blocked"), 2400); }
    this.renderHud();
  },
  useHeart() {
    if (this.over || this.heartUsed) return;
    if (Store.count("heart") < 1) { Shop.open("heart"); return; }
    if (!Store.use("heart")) return;
    this.heartUsed = true; this.maxHearts = 4; this.hearts++;
    this.renderHud();
    this.toast(_t("heart.added"));
  },
  askSkip() {
    if (this.over || this.daily) return;
    if (Store.count("skip") < 1) { Shop.open("skip"); return; }
    Overlay.show({
      tier: ALL_TIERS[this.tier].name + MODE_LABEL[kindOf(this.tier)], title: _t("skip.title", { n: this.level }), stars: null,
      text: _t("skip.text", { n: Store.count("skip") }),
      actions: [{ label: _t("skip.ok"), primary: true, fn: () => this.skip() }, { label: _t("skip.keep"), fn: () => Overlay.hide() }]
    });
  },
  skip() {
    if (!Store.use("skip")) return Overlay.hide();
    Store.record(this.tier, this.level, 1, false);
    this.start(this.tier, this.level + 1);
  },
  hint() {
    if (this.hintUsed || this.over || !this.board) return;
    const b = this.board, n = b.lv.snakes.length;
    const blocks = new Map();
    let bestId = -1, bestScore = -1;
    for (let id = 0; id < n; id++) {
      if (!b.alive[id]) continue;
      const o = b.blockerOf(id);
      if (o >= 0) blocks.set(o, (blocks.get(o) || 0) + 1);
    }
    for (let id = 0; id < n; id++) {
      if (!b.alive[id] || !b.isFree(id)) continue;
      const sc = (blocks.get(id) || 0) * 1000 + b.lv.snakes[id].length;
      if (sc > bestScore) { bestScore = sc; bestId = id; }
    }
    if (bestId < 0) return;
    this.hintUsed = true;
    b.showHint(bestId);
    this.toast(_t(kindOf(this.tier) !== "flat" ? "hint.turned" : "hint.glow"));
    this.renderHud();
  },
  key(e) {
    if (!this.board || kindOf(this.tier) === "flat" || !$("#overlay").hidden || !$("#shop").hidden) return;
    const m = { ArrowLeft: [-22, 0], ArrowRight: [22, 0], ArrowUp: [0, -22], ArrowDown: [0, 22] }[e.key];
    if (m) { e.preventDefault(); this.board.rotate(m[0], m[1]); }
  },
  win() {
    const stars = this.hintUsed ? 2 : 3, flawless = this.mistakes === 0, tn = ALL_TIERS[this.tier].name + MODE_LABEL[kindOf(this.tier)];
    let text, gained, actions;
    if (this.daily) {
      gained = Store.recordDaily(this.daily, stars);
      const st = Store.streakAt(this.daily);
      text = _t("win.daily") + (st > 1 ? _t("win.streak", { n: st }) : "") + _t("win.tomorrow");
      actions = [{ label: _t("backToLevels"), primary: true, fn: () => App.show("home") }];
    } else {
      const r = Store.record(this.tier, this.level, stars, flawless);
      gained = r.gained;
      text = _t(this.hintUsed ? "win.withHint" : "win.noHint");
      text += this.mistakes ? _t("win.lost", { n: this.mistakes }) : _t("win.noLoss");
      if (r.prev > stars) text += _t("win.prev", { n: r.prev });
      actions = [
        { label: _t("nextLevel"), primary: true, fn: () => this.start(this.tier, this.level + 1) },
        { row: [{ label: _t("replay"), fn: () => this.start(this.tier, this.level) }, { label: _t("allLevels"), fn: () => App.show("home") }] }
      ];
    }
    Overlay.show({ tier: this.daily ? _t("dailyPill", { tier: tn }) : tn, title: _t("cleared", { what: this.daily ? fmtDate(this.daily) : _t("level", { n: this.level }) }), stars, text, gained, actions });
  },
  lose() {
    const tn = ALL_TIERS[this.tier].name + MODE_LABEL[kindOf(this.tier)];
    const actions = [{ label: _t("tryAgain"), primary: true, fn: () => this.start(this.tier, this.level, { daily: this.daily }) }];
    if (!this.daily && Store.count("skip") > 0) actions.push({ label: _t("useSkip", { n: Store.count("skip") }), fn: () => this.skip() });
    actions.push({ label: _t("allLevels"), fn: () => App.show("home") });
    Overlay.show({ tier: this.daily ? _t("dailyPill", { tier: tn }) : tn, title: _t("out.title"), stars: null,
      text: _t("out.text", { what: this.daily ? _t("todays") : _t("level", { n: this.level }) }), actions });
  },
  snapshot() {
    const b = this.board;
    if (!b || !b.lv || this.over) return null;
    const removed = [];
    for (let i = 0; i < b.alive.length; i++) if (!b.alive[i]) removed.push(i);
    return { tier: this.tier, level: this.level, daily: this.daily, removed, hearts: this.hearts, maxHearts: this.maxHearts, hintUsed: this.hintUsed, mistakes: this.mistakes };
  }
};

/* ---------- overlay ---------- */
const Overlay = {
  show(o) {
    $("#ovTier").textContent = o.tier;
    $("#ovTitle").textContent = o.title;
    const st = $("#ovStars");
    st.hidden = o.stars == null;
    st.innerHTML = o.stars == null ? "" : [0, 1, 2].map((i) => ICON.star.replace("<svg", '<svg class="' + (i < o.stars ? "on" : "") + '"')).join("");
    const p = $("#ovText");
    p.textContent = o.text;
    if (o.gained > 0) { const g = document.createElement("span"); g.className = "gplus"; g.textContent = _t("pointsN", { n: o.gained }); p.appendChild(document.createElement("br")); p.appendChild(g); }
    const box = $("#ovActions"); box.innerHTML = "";
    const mk = (a) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a.primary ? " primary" : ""); b.textContent = a.label; b.onclick = a.fn; return b; };
    for (const a of o.actions) {
      if (a.row) { const r = document.createElement("div"); r.className = "btn-row"; a.row.forEach((x) => r.appendChild(mk(x))); box.appendChild(r); }
      else box.appendChild(mk(a));
    }
    $("#overlay").hidden = false;
    const first = box.querySelector("button"); if (first) first.focus();
  },
  hide() { $("#overlay").hidden = true; }
};

/* ---------- shop ---------- */
const Shop = {
  init() {
    $("#shopClose").innerHTML = ICON.close;
    $("#gemIcon").innerHTML = ICON.gem; $("#gemIcon2").innerHTML = ICON.gem;
    $("#shopClose").onclick = () => this.close();
    $("#pointsBtn").onclick = () => this.open();
    $("#shop").addEventListener("click", (e) => { if (e.target.id === "shop") this.close(); });
    $("#shopBody").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const id = b.dataset.id, act = b.dataset.act;
      if (act === "buy") {
        if (Store.buy(id)) {
          if (id.indexOf("skin-") === 0) { Store.settings.skin = id.slice(5); Store.saveSettings(); Theme.read(); }
          if (id === "lane") { Store.settings.laneTrace = true; Store.saveSettings(); }
        }
      } else if (act === "wear") { Store.settings.skin = id; Store.saveSettings(); Theme.read(); }
      this.render(this.focusId); Home.renderPoints(); Home.renderSettings(); if (App.view === "game") Game.renderHud();
    });
  },
  open(focus) {
    this.focusId = focus || null;
    this.render(focus);
    $("#shop").hidden = false;
    const f = focus && $('#shopBody [data-id="' + focus + '"]');
    (f || $("#shopClose")).focus();
  },
  close() { $("#shop").hidden = true; },
  swatch(skin) {
    const s = SKINS[skin], pal = s.light ? (Theme.dark ? s.dark : s.light) : null;
    const bg = pal ? pal.board : Theme.c.board;
    const lines = [[6, 10, 26, 10, 26, 18], [6, 22, 18, 22, 18, 34], [30, 32, 38, 32, 38, 14]].map((l, i) => {
      const col = s.rainbow ? rainbowColor(i + 1) : pal ? pal.arrow : Theme.c.ink;
      return '<polyline points="' + l.join(",") + '" fill="none" stroke="' + col + '" stroke-width="2.6"/>';
    }).join("");
    return '<svg class="swatch" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" fill="' + bg + '"/>' + lines + "</svg>";
  },
  render(focus) {
    const bal = Store.balance();
    $("#shopPoints").textContent = bal;
    const buyBtn = (it) => '<button type="button" class="buy" data-act="buy" data-id="' + it.id + '"' + (bal < it.price ? " disabled" : "") + ' aria-label="' + _t("shop.buy", { name: it.name, price: it.price }) + '">' + ICON.gem + " " + it.price + "</button>";
    const wearBtn = (skin) => { const on = Skin.id === skin; return '<button type="button" class="buy ' + (on ? "on" : "ghost") + '" data-act="wear" data-id="' + skin + '"' + (on ? " disabled" : "") + ">" + _t(on ? "shop.inUse" : "shop.use") + "</button>"; };
    const row = (it) => {
      let ic, right;
      if (it.kind === "skin") {
        const skin = it.id.slice(5);
        ic = this.swatch(skin);
        right = Store.owns(it.id) ? wearBtn(skin) : buyBtn(it);
      } else {
        ic = '<span class="ic">' + ICON[it.icon] + "</span>";
        right = it.kind === "unlock" && Store.owns(it.id) ? '<button type="button" class="buy on" disabled>' + _t("shop.owned") + "</button>" : buyBtn(it);
      }
      const own = it.kind === "item" ? '<span class="own num">' + _t("shop.youHave", { n: Store.count(it.id) }) + "</span>" : "";
      return '<div class="shop-row"' + (focus === it.id ? ' style="border-color:var(--accent)"' : "") + ">" + ic + "<div><strong>" + it.name + "</strong><small>" + it.desc + "</small>" + own + "</div>" + right + "</div>";
    };
    const inkRow = '<div class="shop-row">' + this.swatch("ink") + "<div><strong>" + _t("skin.ink") + "</strong><small>" + _t("skin.ink.desc") + "</small></div>" + wearBtn("ink") + "</div>";
    $("#shopBody").innerHTML =
      '<p class="earn">' + _t("shop.earn") + "</p>" +
      '<section class="shop-sec"><h3>' + _t("shop.powerups") + "</h3>" + SHOP.filter((x) => x.kind === "item").map(row).join("") + "</section>" +
      '<section class="shop-sec"><h3>' + _t("shop.upgrades") + "</h3>" + SHOP.filter((x) => x.kind === "unlock").map(row).join("") + "</section>" +
      '<section class="shop-sec"><h3>' + _t("shop.skins") + "</h3>" + inkRow + SHOP.filter((x) => x.kind === "skin").map(row).join("") + "</section>";
  }
};

/* ---------- home ---------- */
const Home = {
  page: -1,
  init() {
    $("#prevPage").innerHTML = ICON.chevL;
    $("#nextPage").innerHTML = ICON.chevR;
    $("#prevPage").onclick = () => { this.page--; this.renderGrid(); };
    $("#nextPage").onclick = () => { this.page++; this.renderGrid(); };
    $("#playBtn").onclick = () => { const t = Store.curTier(); Game.start(t, Store.unlocked(t)); };
    $("#dailyBtn").onclick = () => { const d = todayStr(), cfg = DAILY[new Date().getDay()]; Game.start(cfg.tier, cfg.level, { daily: d }); };
    $("#smartTap").onclick = () => { Store.settings.smartTap = !Store.settings.smartTap; Store.saveSettings(); this.renderSettings(); };
    $("#laneTrace").onclick = () => { Store.settings.laneTrace = !Store.settings.laneTrace; Store.saveSettings(); this.renderSettings(); };
    const tb = { auto: [ICON.auto, _t("theme.auto")], light: [ICON.sun, _t("theme.light")], dark: [ICON.moon, _t("theme.dark")] };
    for (const b of document.querySelectorAll("#themeSeg button")) {
      const [ic, label] = tb[b.dataset.themeOpt];
      b.innerHTML = ic + "<span>" + label + "</span>";
      b.onclick = () => { Store.settings.theme = b.dataset.themeOpt; Store.saveSettings(); Theme.apply(Store.settings.theme); this.renderSettings(); };
    }
    const mb = { flat: [ICON.flat, _t("mode.flat")], "3d": [ICON.cube, _t("mode.3d")], shapes: [ICON.shapes, _t("mode.shapes")] };
    for (const b of document.querySelectorAll("#modeSeg button")) {
      const [ic, label] = mb[b.dataset.mode];
      b.innerHTML = ic + "<span>" + label + "</span>";
      b.onclick = () => { Store.settings.mode = b.dataset.mode; Store.saveSettings(); this.page = -1; this.render(); if (Store.settings.mode !== "flat") loadThree().catch(() => {}); };
    }
    $("#grid").addEventListener("click", (e) => {
      const b = e.target.closest(".lvl");
      if (!b || b.classList.contains("locked")) return;
      Game.start(Store.curTier(), +b.dataset.lv);
    });
    $("#tabs").addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (!b) return;
      const t = b.dataset.tier, k = kindOf(t);
      if (k === "box") Store.settings.tier3 = t; else if (k === "shape") Store.settings.tierS = t; else Store.settings.tier = t;
      Store.saveSettings();
      this.page = -1; this.render();
    });
  },
  renderPoints() { $("#pointsVal").textContent = Store.balance(); },
  renderSettings() {
    $("#smartTap").setAttribute("aria-checked", String(!!Store.settings.smartTap));
    $("#laneRow").hidden = !Store.owns("lane");
    $("#laneTrace").setAttribute("aria-checked", String(!!Store.settings.laneTrace));
    for (const b of document.querySelectorAll("#themeSeg button")) b.setAttribute("aria-checked", String(b.dataset.themeOpt === Store.settings.theme));
    for (const b of document.querySelectorAll("#modeSeg button")) b.setAttribute("aria-checked", String(b.dataset.mode === Store.settings.mode));
  },
  renderDaily() {
    const d = todayStr(), cfg = DAILY[new Date().getDay()], k = kindOf(cfg.tier);
    const st = Store.data.daily[d] || 0, streak = Store.currentStreak();
    $("#dailyEyebrow").textContent = _t("dailyDate", { date: fmtDate(d) });
    $("#dailyTitle").textContent = _t("dailyKind." + k, { tier: ALL_TIERS[cfg.tier].name });
    $("#dailyMeta").textContent = (st ? _t("dailyMeta.cleared", { n: st }) : _t("dailyMeta.pays")) + (streak ? _t("dailyMeta.streak", { n: streak }) : _t("dailyMeta.start"));
    const b = $("#dailyBtn");
    b.textContent = st ? "Replay" : "Play";
    b.classList.toggle("done", !!st);
  },
  render() {
    const mode = Store.settings.mode, order = mode === "3d" ? G3.TIER_ORDER : mode === "shapes" ? GS.TIER_ORDER : G.TIER_ORDER, cur = Store.curTier(), kind = kindOf(cur);
    const maxPips = Math.max.apply(null, order.map((t) => TIER_INFO[t].pips));
    $("#tabs").innerHTML = order.map((t) => {
      const info = TIER_INFO[t], done = Store.maxDone(t);
      let stars = 0; const p = Store.data.tiers[t] || {}; for (const k in p) stars += p[k];
      const pips = Array.from({ length: maxPips }, (_, i) => '<i class="' + (i < info.pips ? "on" : "") + '"></i>').join("");
      return '<button type="button" class="tab" role="tab" data-tier="' + t + '" aria-selected="' + (t === cur) + '">' +
        '<span class="tab-name">' + ALL_TIERS[t].name + '</span><span class="pips" aria-hidden="true">' + pips + '</span>' +
        '<span class="tab-meta num">' + (done ? _t("tab.meta", { n: done, s: stars }) : _t("tab.new")) + '</span></button>';
    }).join("");
    const T = ALL_TIERS[cur];
    $("#tierName").textContent = kind === "flat" ? T.name : _t("tierName." + kind, { tier: T.name });
    const s0 = kind === "box" ? G3.sizeFor(cur, 1) : kind === "shape" ? GS.sizeFor(cur, 1) : G.sizeFor(cur, 1), s1 = T.cap;
    $("#tierDesc").textContent = _t("desc." + cur) + _t(kind === "flat" ? "grow.flat" : "grow.cells", { a: s0, b: s1 }) + _t("tierPts", { n: TIER_PTS[cur] });
    const next = Store.unlocked(cur);
    $("#playBtn").innerHTML = ICON.play + '<span class="num">' + (next === 1 ? _t("play.start") : _t("play.level", { n: next })) + "</span>";
    const p = Store.data.tiers[cur] || {};
    let done = 0, stars = 0, perfect = 0;
    for (const k in p) { if (p[k] > 0) done++; stars += p[k]; if (p[k] === 3) perfect++; }
    $("#tierStats").innerHTML =
      '<span><b class="num">' + done + "</b>" + _t("stat.cleared") + "</span>" +
      '<span><b class="num">' + stars + "</b>" + _t("stat.stars", { n: done * 3 }) + "</span>" +
      '<span><b class="num">' + perfect + "</b>" + _t("stat.perfect") + "</span>";
    this.renderGrid();
    this.renderSettings();
    this.renderPoints();
    this.renderDaily();
  },
  renderGrid() {
    const cur = Store.curTier(), next = Store.unlocked(cur);
    const pages = Math.ceil(next / PAGE);
    if (this.page < 0 || this.page >= pages) this.page = pages - 1;
    const from = this.page * PAGE + 1, to = from + PAGE - 1;
    $("#pageLabel").textContent = from + "–" + to;
    $("#prevPage").disabled = this.page === 0;
    $("#nextPage").disabled = this.page >= pages - 1;
    let html = "";
    for (let lv = from; lv <= to; lv++) {
      const st = Store.stars(cur, lv), locked = lv > next;
      const cls = "lvl" + (locked ? " locked" : "") + (lv === next ? " next" : "") + (st === 3 ? " perfect" : "");
      const stars = st ? '<span class="st" aria-hidden="true">' + [0, 1, 2].map((i) => ICON.star.replace("<svg", '<svg style="color:var(' + (i < st ? "--star" : "--star-off") + ')"')).join("") + "</span>" : "";
      const label = locked ? _t("lvl.locked", { n: lv }) : st ? _t("lvl.stars", { n: lv, s: st }) : lv === next ? _t("lvl.next", { n: lv }) : _t("lvl", { n: lv });
      html += '<button type="button" class="' + cls + '" data-lv="' + lv + '" aria-label="' + label + '"' + (locked ? ' aria-disabled="true"' : "") + '><span class="n num">' + lv + "</span>" + stars + "</button>";
    }
    $("#grid").innerHTML = html;
  }
};

/* ---------- hero: a small board that solves itself ---------- */
const Hero = {
  board: null, n: 0, timer: 0,
  init() { this.board = new Board($("#heroCanvas"), { interactive: false, pad: 6 }); this.next(); },
  next() { this.n++; this.board.setLevel(G.generate("easy", 9000 + (this.n % 50))); this.schedule(900); },
  schedule(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.step(), ms); },
  step() {
    if (App.view !== "home" || document.hidden) return this.schedule(1000);
    if (reduceMotion.matches) return;
    const b = this.board;
    if (b.aliveCount === 0) return this.next();
    const free = [];
    for (let i = 0; i < b.alive.length; i++) if (b.alive[i] && b.isFree(i)) free.push(i);
    b.remove(free[Math.floor(Math.random() * free.length)]);
    this.schedule(b.aliveCount === 0 ? 1100 : 520);
  }
};

/* ---------- app ---------- */
const App = {
  view: "home",
  show(v) {
    this.view = v;
    $("#home").hidden = v !== "home";
    $("#game").hidden = v !== "game";
    if (v === "home") { Game.token++; Overlay.hide(); Home.render(); Hero.board.resize(true); }
    else { Game.board2.resize(true); if (Game.board3) Game.board3.resize(true); }
  }
};

function start(data) {
  Store.load();
  Theme.apply(Store.settings.theme);
  Home.init();
  Game.init();
  Shop.init();
  Hero.init();
  Home.render();
  const snap = data && data.game;
  if (snap && ALL_TIERS[snap.tier] && snap.level > 0) Game.start(snap.tier, snap.level, { restore: snap, daily: snap.daily || null });
  Theme.read();
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", () => Hero.schedule(600));
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", () => Theme.read());
  // If the viewer itself switches theme later, that newest choice wins and the page goes back to Auto.
  new MutationObserver(() => {
    const cur = root.getAttribute("data-theme");
    if (cur !== ourTheme) {
      hostTheme = cur; ourTheme = cur;
      if (Store.settings.theme !== "auto") { Store.settings.theme = "auto"; Store.saveSettings(); Home.renderSettings(); }
    }
    Theme.read();
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (App.view === "home") Home.render(); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!$("#shop").hidden) return Shop.close(); if (App.view === "game") return App.show("home"); }
    if (App.view === "game") Game.key(e);
  });
  if (Store.settings.mode !== "flat") loadThree().catch(() => {});
  Store.sync();
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ game: App.view === "game" ? Game.snapshot() : null }));
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
