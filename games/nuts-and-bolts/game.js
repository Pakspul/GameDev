function NBCore() {
  // Seeded RNG so every level is identical for every player.
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  // Colour ids, most distinct first.
  const ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 9, 8, 10, 11];

  const DIFF_KEYS = ["easy", "medium", "hard", "expert"];
  const ramp = (from, to, every) => L => Math.min(from + Math.floor((L - 1) / every), to);

  // Level shapes per difficulty.
  //  mixed:   bolts of different lengths
  //  tall:    few long bolts, lots of nuts per colour
  //  short:   many 3-nut bolts
  //  mystery: mixed, but nuts under the top one are hidden until uncovered
  const SHAPES = {
    mixed: {
      easy:   { colors: ramp(3, 5, 5),  caps: [3, 4, 4],    extra: [4, 4], keepEmpty: 2, maxSame: 0.34, cand: 1 },
      medium: { colors: ramp(5, 7, 6),  caps: [3, 4, 5],    extra: [5, 4], keepEmpty: 2, maxSame: 0.25, cand: 2 },
      hard:   { colors: ramp(7, 9, 8),  caps: [4, 5, 6],    extra: [6, 5], keepEmpty: 1, maxSame: 0.2,  cand: 3 },
      expert: { colors: ramp(9, 11, 10), caps: [4, 5, 6, 6], extra: [6, 4], keepEmpty: 1, maxSame: 0.15, cand: 4 }
    },
    tall: {
      easy:   { colors: ramp(3, 3, 99), caps: [6],    extra: [6, 6], keepEmpty: 2, maxSame: 0.42, cand: 3 },
      medium: { colors: ramp(3, 4, 10), caps: [7],    extra: [7, 7], keepEmpty: 2, maxSame: 0.36, cand: 4 },
      hard:   { colors: ramp(4, 5, 12), caps: [8],    extra: [8, 8], keepEmpty: 1, maxSame: 0.3,  cand: 5 },
      expert: { colors: ramp(5, 6, 15), caps: [8, 9], extra: [9, 8], keepEmpty: 1, maxSame: 0.26, cand: 6 }
    },
    short: {
      easy:   { colors: ramp(4, 6, 8),  caps: [3], extra: [3, 3], keepEmpty: 2, maxSame: 0.3,  cand: 3 },
      medium: { colors: ramp(6, 8, 8),  caps: [3], extra: [3, 3], keepEmpty: 2, maxSame: 0.22, cand: 4 },
      hard:   { colors: ramp(8, 10, 10), caps: [3], extra: [3, 3], keepEmpty: 1, maxSame: 0.18, cand: 5 },
      expert: { colors: ramp(10, 12, 12), caps: [3], extra: [3, 3], keepEmpty: 1, maxSame: 0.14, cand: 6 }
    }
  };
  SHAPES.mystery = SHAPES.mixed;
  const TYPE_CYCLE = ["mixed", "short", "tall", "mixed", "mystery"];
  function typeFor(level) {
    if (level <= 2) return "mixed";
    return TYPE_CYCLE[(level - 1) % TYPE_CYCLE.length];
  }

  function isComplete(b, counts) {
    if (!b.length || b.length !== counts[b[0]]) return false;
    for (let k = 1; k < b.length; k++) if (b[k] !== b[0]) return false;
    return true;
  }

  function topGroup(b) {
    if (!b.length) return 0;
    const c = b[b.length - 1]; let g = 1;
    while (g < b.length && b[b.length - 1 - g] === c) g++;
    return g;
  }

  function canMove(bolts, caps, counts, i, j) {
    if (i === j) return false;
    const a = bolts[i], b = bolts[j];
    if (!a.length || isComplete(a, counts) || isComplete(b, counts)) return false;
    if (b.length >= caps[j]) return false;
    return !b.length || b[b.length - 1] === a[a.length - 1];
  }

  function solve(bolts0, caps, counts, limit) {
    const n = bolts0.length;
    const bolts = bolts0.map(b => b.slice());
    const colorSet = new Set();
    bolts.forEach(b => b.forEach(c => colorSet.add(c)));
    const need = colorSet.size;
    const visited = new Set();
    let nodes = 0, exhausted = false;
    const path = [];

    function key() {
      const parts = new Array(n);
      for (let i = 0; i < n; i++) {
        let s = caps[i] + ':';
        const b = bolts[i];
        for (let k = 0; k < b.length; k++) s += String.fromCharCode(97 + b[k]);
        parts[i] = s;
      }
      parts.sort();
      return parts.join('|');
    }
    function done() {
      let c = 0;
      for (let i = 0; i < n; i++) if (isComplete(bolts[i], counts)) c++;
      return c === need;
    }
    function dfs(depth) {
      if (done()) return true;
      if (nodes++ > limit) { exhausted = true; return false; }
      if (depth > 500) return false;
      const k = key();
      if (visited.has(k)) return false;
      visited.add(k);
      const moves = [];
      for (let i = 0; i < n; i++) {
        const b = bolts[i];
        if (!b.length || isComplete(b, counts)) continue;
        const top = b[b.length - 1];
        const g = topGroup(b);
        const homo = g === b.length;
        const seenEmpty = new Set();
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const t = bolts[j];
          const room = caps[j] - t.length;
          if (room <= 0 || isComplete(t, counts)) continue;
          let s = 0;
          const m = Math.min(g, room);
          if (t.length) {
            if (t[t.length - 1] !== top) continue;
            const tHomo = topGroup(t) === t.length;
            s += 10;
            if (tHomo) { s += 6; if (t.length + m === counts[top]) s += 60; }
            if (homo && !tHomo) s -= 8;
          } else {
            if (seenEmpty.has(caps[j])) continue;
            seenEmpty.add(caps[j]);
            if (homo && caps[j] <= caps[i]) continue;
            s -= 2;
            if (caps[j] >= counts[top]) s += 2;
          }
          if (m === g) s += 3; else s -= 5;
          if (!homo && m === g) s += 1;
          moves.push(i, j, m, s);
        }
      }
      const order = [];
      for (let q = 0; q < moves.length; q += 4) order.push(q);
      order.sort((a, b) => moves[b + 3] - moves[a + 3]);
      for (const q of order) {
        const i = moves[q], j = moves[q + 1], m = moves[q + 2];
        for (let x = 0; x < m; x++) bolts[j].push(bolts[i].pop());
        path.push({ from: i, to: j, n: m });
        if (dfs(depth + 1)) return true;
        path.pop();
        for (let x = 0; x < m; x++) bolts[i].push(bolts[j].pop());
        if (exhausted) return false;
      }
      return false;
    }
    const solved = dfs(0);
    return { solved, moves: solved ? path.slice() : [], nodes, exhausted };
  }

  function build(D, level, r) {
    const nc = D.colors(level);
    const pool = ORDER.slice(0, Math.max(nc + 2, 8)).slice(0, 12);
    shuffle(pool, r);
    const colors = pool.slice(0, nc);
    const counts = {};
    const specs = [];
    colors.forEach(c => {
      const cap = D.caps[Math.floor(r() * D.caps.length)];
      counts[c] = cap;
      specs.push({ cap, empty: false });
    });
    const extra = shuffle(D.extra.slice(), r);
    extra.forEach((cap, k) => specs.push({ cap, empty: k < D.keepEmpty }));
    shuffle(specs, r);

    const total = colors.reduce((s, c) => s + counts[c], 0);
    const fills = specs.map(s => (s.empty ? 0 : s.cap));
    let holes = fills.reduce((a, b) => a + b, 0) - total;
    let guard = 0;
    while (holes > 0 && guard++ < 1000) {
      const i = Math.floor(r() * specs.length);
      if (fills[i] > 1) { fills[i]--; holes--; }
    }
    if (holes > 0) return null;

    const nuts = [];
    colors.forEach(c => { for (let k = 0; k < counts[c]; k++) nuts.push(c); });
    shuffle(nuts, r);
    const bolts = specs.map(() => []);
    let p = 0;
    specs.forEach((s, i) => { for (let k = 0; k < fills[i]; k++) bolts[i].push(nuts[p++]); });

    let same = 0, pairs = 0;
    for (const b of bolts) {
      if (isComplete(b, counts)) return null;
      for (let k = 1; k < b.length; k++) { pairs++; if (b[k] === b[k - 1]) same++; }
    }
    if (pairs && same / pairs > D.maxSame) return null;
    return { bolts, caps: specs.map(s => s.cap), counts };
  }

  // seedKey defaults to diff+level, so a level number is the same puzzle for everyone.
  function generate(diff, level, type, seedKey) {
    type = type || typeFor(level);
    const D = SHAPES[type][diff];
    const seed = seedKey || ("nuts-bolts:" + diff + ":" + level);
    let best = null, found = 0;
    for (let attempt = 0; attempt < 120 && found < D.cand; attempt++) {
      const r = rng(hash(seed + ":" + type + ":" + attempt));
      const lvl = build(D, level, r);
      if (!lvl) continue;
      const res = solve(lvl.bolts, lvl.caps, lvl.counts, 60000);
      if (!res.solved) continue;
      found++;
      if (!best || res.nodes > best.nodes) best = Object.assign(lvl, { nodes: res.nodes, solution: res.moves.length });
    }
    if (best) {
      best.type = type;
      best.par = best.solution + Math.ceil(best.solution * 0.12);
    }
    return best;
  }

  return { DIFF_KEYS, SHAPES, typeFor, generate, solve, canMove, isComplete, topGroup, hash, rng };
}


(function () {
  "use strict";
  const C = NBCore();
  const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPEED = RM ? 0.6 : 1;

  // ================================================================ data
  const COLORS = [
    { hex: "#e8283f", icon: "heart" },
    { hex: "#ff7d1f", icon: "bolt" },
    { hex: "#ffc727", icon: "sun" },
    { hex: "#25a842", icon: "club" },
    { hex: "#22c4f0", icon: "diamond" },
    { hex: "#2163e6", icon: "drop" },
    { hex: "#ff6cb0", icon: "crown" },
    { hex: "#9550ec", icon: "star" },
    { hex: "#a3d62c", icon: "leaf" },
    { hex: "#eceef5", icon: "moon" },
    { hex: "#15b49b", icon: "spade" },
    { hex: "#a65f2e", icon: "paw" }
  ];
  const DIFF_KEYS = C.DIFF_KEYS;
  const DIFF_INFO = {
    easy:   { name: "Easy",   meta: "3–6 colours, roomy",         star: 8 },
    medium: { name: "Medium", meta: "4–8 colours, 2 empty bolts", star: 15 },
    hard:   { name: "Hard",   meta: "5–10 colours, tight",        star: 25 },
    expert: { name: "Expert", meta: "6–12 colours, very tight",   star: 40 }
  };
  const TYPE_NAME = { mixed: "Mixed bolts", tall: "Tall bolts", short: "Short bolts", mystery: "Mystery nuts" };
  const HINT_COST = 15;
  const SPARE_COSTS = [40, 80];
  const DAILY_STAR = 50, DAILY_STREAK = 10, DAILY_STREAK_CAP = 10;

  const BOARDS = [
    { id: "night",     name: "Night shift", price: 0,   pat: "pegs",   v: { board: "#241940", deep: "#150e27", peg: "#120a22", glow: "rgba(140,104,220,0.22)", panel: "#2f2352", line: "#463872", muted: "#b8a7da" } },
    { id: "blueprint", name: "Blueprint",   price: 200, pat: "grid",   v: { board: "#143563", deep: "#0b2041", peg: "rgba(170,210,255,0.13)", glow: "rgba(120,180,255,0.18)", panel: "#1b3d6d", line: "#2f5a90", muted: "#a6c4e8" } },
    { id: "garage",    name: "Garage",      price: 350, pat: "pegs",   v: { board: "#0f3b3d", deep: "#082426", peg: "#06201f", glow: "rgba(70,210,190,0.16)", panel: "#164649", line: "#256466", muted: "#9fd2cc" } },
    { id: "bench",     name: "Workbench",   price: 500, pat: "planks", v: { board: "#4a2e1d", deep: "#2c1a10", peg: "rgba(20,10,4,0.55)", glow: "rgba(255,190,120,0.16)", panel: "#4f3424", line: "#6e4a33", muted: "#dcbfa5" } },
    { id: "redline",   name: "Redline",     price: 600, pat: "grid",   v: { board: "#4a1424", deep: "#2b0a14", peg: "rgba(255,150,170,0.1)", glow: "rgba(255,90,120,0.16)", panel: "#521a2b", line: "#74304a", muted: "#e3aebb" } },
    { id: "plate",     name: "Tread plate", price: 800, pat: "plate",  v: { board: "#2b2e35", deep: "#17191d", peg: "rgba(255,255,255,0.06)", glow: "rgba(200,210,230,0.12)", panel: "#30343c", line: "#4a4f5a", muted: "#b5bcc9" } }
  ];
  const FINISHES = [
    { id: "gunmetal", name: "Gunmetal",      price: 0,   shaft: "#555a6b", base: "#3d4150", spec: 0x5a5a5a, shine: 60 },
    { id: "oxide",    name: "Black oxide",   price: 150, shaft: "#3c3e48", base: "#2a2b32", spec: 0x6a6a6a, shine: 90 },
    { id: "bronze",   name: "Bronze",        price: 300, shaft: "#8f6c3c", base: "#634726", spec: 0x8a7050, shine: 80 },
    { id: "copper",   name: "Copper",        price: 450, shaft: "#a85c3a", base: "#713a22", spec: 0x9a6a50, shine: 85 },
    { id: "blued",    name: "Blued steel",   price: 550, shaft: "#3e5385", base: "#2a3659", spec: 0x7080a0, shine: 90 },
    { id: "chrome",   name: "Bright chrome", price: 700, shaft: "#d9dde8", base: "#c9ccd6", spec: 0x9a9a9a, shine: 95 }
  ];

  // ================================================================ storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem("nutsbolts:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("nutsbolts:" + k, JSON.stringify(v)); } catch (e) {} }
  };
  const progress = Object.assign({ easy: 1, medium: 1, hard: 1, expert: 1 }, store.get("progress", {}));
  const eco = Object.assign({
    washers: 60, earned: 0, best: {}, cleared: 0, stars: 0,
    owned: { board: ["night"], finish: ["gunmetal"] },
    equip: { board: "night", finish: "gunmetal" },
    daily: { last: null, streak: 0, bestStreak: 0, done: {} }
  }, store.get("eco", {}));
  const saveEco = () => store.set("eco", eco);
  let current = store.get("current", { mode: "level", diff: "medium", level: 1 });
  if (current.mode !== "daily") current.mode = "level";
  if (!DIFF_KEYS.includes(current.diff)) current.diff = "medium";
  current.level = Math.max(1, Math.min(current.level | 0 || 1, progress[current.diff] || 1));

  // ================================================================ dates
  const pad = n => (n < 10 ? "0" : "") + n;
  const dayKey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => dayKey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  function dailyType(key) {
    const p = key.split("-").map(Number);
    const n = Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
    return ["mixed", "tall", "mystery", "short"][n % 4];
  }
  function liveStreak() {
    return eco.daily.last === today() || eco.daily.last === yesterday() ? eco.daily.streak : 0;
  }

  // ================================================================ worker
  let worker = null, reqId = 0;
  const pending = new Map();
  function runLocal(msg) {
    return msg.type === "gen" ? C.generate(msg.diff, msg.level, msg.ltype, msg.seed) : C.solve(msg.bolts, msg.caps, msg.counts, msg.limit);
  }
  try {
    const src = "const C=(" + NBCore.toString() + ")();onmessage=function(e){var d=e.data;var out=d.type==='gen'?C.generate(d.diff,d.level,d.ltype,d.seed):C.solve(d.bolts,d.caps,d.counts,d.limit);postMessage({id:d.id,out:out});};";
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    worker.onmessage = e => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p.res(e.data.out); } };
    worker.onerror = () => {
      worker = null;
      for (const [id, p] of pending) { pending.delete(id); p.res(runLocal(p.msg)); }
    };
  } catch (e) { worker = null; }
  function call(msg) {
    return new Promise(res => {
      if (worker) { const id = ++reqId; pending.set(id, { res, msg }); worker.postMessage(Object.assign({ id }, msg)); }
      else setTimeout(() => res(runLocal(msg)), 20);
    });
  }

  // ================================================================ dom
  const $ = id => document.getElementById(id);
  const app = $("app"), stage = $("stage"), glCanvas = $("gl"), fxCanvas = $("fx"), veil = $("veil"), toastEl = $("toast");
  const fx = fxCanvas.getContext("2d");
  const starSvg = (on, cls) => '<svg class="' + (on ? "on" : "off") + (cls ? " " + cls : "") + '"><use href="#i-star"/></svg>';
  const washerSvg = '<svg class="washer"><use href="#i-washer"/></svg>';
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

  // ================================================================ three
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  const TILT = 11 * Math.PI / 180;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3b2a63, 0.72));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.78); keyLight.position.set(-4, 9, 11); scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xdccdff, 0.32); rimLight.position.set(7, 3, -5); scene.add(rimLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.22); fillLight.position.set(4, -3, 9); scene.add(fillLight);

  const NUT = { R: 0.6, bevel: 0.06, depth: 0.3, hole: 0.3 };
  const HN = NUT.depth + 2 * NUT.bevel;
  const PITCH = HN + 0.012;
  const BASE_TOP = 0.175;
  const SX = 1.95;
  const ROW_GAP = 0.3;
  const SPIN = (2 * Math.PI) / 0.8;
  const SIXTH = Math.PI / 3;
  const shaftLen = cap => cap * PITCH + 0.3;
  const shaftTop = cap => BASE_TOP + shaftLen(cap);
  const hoverY = cap => shaftTop(cap) + HN / 2 + 0.2;
  const slotY = k => BASE_TOP + HN / 2 + 0.006 + k * PITCH;
  const rowHeight = cap => cap * PITCH + 1.32;

  function mix(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
    const ch = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")";
  }

  const nutGeo = (function () {
    const s = new THREE.Shape();
    for (let k = 0; k < 6; k++) {
      const a = k * SIXTH, x = Math.cos(a) * NUT.R, y = Math.sin(a) * NUT.R;
      if (k) s.lineTo(x, y); else s.moveTo(x, y);
    }
    s.closePath();
    const h = new THREE.Path();
    h.absarc(0, 0, NUT.hole, 0, Math.PI * 2, true);
    s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: NUT.depth, bevelEnabled: true, bevelThickness: NUT.bevel, bevelSize: NUT.bevel, bevelSegments: 3, curveSegments: 28 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -NUT.depth / 2, 0);
    return g;
  })();

  const decalGeo = (function () {
    const r = NUT.R * Math.cos(Math.PI / 6) + NUT.bevel + 0.008, h = 0.165;
    const pos = [], nor = [], uv = [], idx = [];
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (let j = 0; j < 6; j++) {
      const phi = Math.PI / 6 + j * SIXTH;
      const nx = Math.cos(phi), nz = -Math.sin(phi);
      const cx = nx * r, cz = nz * r, tx = nz, tz = -nx;
      for (const c of corners) { pos.push(cx + tx * h * c[0], c[1] * h, cz + tz * h * c[0]); nor.push(nx, 0, nz); uv.push(c[2], c[3]); }
      const b = j * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  })();

  function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function cut(c, draw) { c.save(); c.globalCompositeOperation = "destination-out"; draw(); c.restore(); }
  const ICONS = {
    heart(c) { c.beginPath(); c.moveTo(50, 84); c.bezierCurveTo(14, 60, 8, 40, 16, 28); c.bezierCurveTo(24, 14, 44, 14, 50, 30); c.bezierCurveTo(56, 14, 76, 14, 84, 28); c.bezierCurveTo(92, 40, 86, 60, 50, 84); c.fill(); },
    bolt(c) { poly(c, [[60, 8], [24, 56], [46, 56], [38, 92], [78, 40], [55, 40], [66, 8]]); },
    sun(c) {
      circle(c, 50, 50, 17);
      for (let k = 0; k < 8; k++) { c.save(); c.translate(50, 50); c.rotate(k * Math.PI / 4); poly(c, [[-6.5, -24], [6.5, -24], [0, -39]]); c.restore(); }
    },
    club(c) { circle(c, 50, 31, 15); circle(c, 31, 55, 15); circle(c, 69, 55, 15); circle(c, 50, 49, 11); poly(c, [[50, 46], [37, 89], [63, 89]]); },
    diamond(c) {
      poly(c, [[30, 22], [70, 22], [88, 42], [50, 86], [12, 42]]);
      cut(c, () => { c.lineWidth = 3.5; c.lineJoin = "round"; c.beginPath(); c.moveTo(12, 42); c.lineTo(88, 42); c.moveTo(39, 22); c.lineTo(33, 42); c.lineTo(50, 86); c.lineTo(67, 42); c.lineTo(61, 22); c.stroke(); });
    },
    drop(c) { c.beginPath(); c.moveTo(50, 10); c.bezierCurveTo(60, 30, 78, 46, 78, 62); c.arc(50, 62, 28, 0, Math.PI, false); c.bezierCurveTo(22, 46, 40, 30, 50, 10); c.fill(); },
    crown(c) { poly(c, [[14, 72], [14, 28], [33, 50], [50, 18], [67, 50], [86, 28], [86, 72]]); c.fillRect(14, 77, 72, 10); },
    star(c) { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 17 : 41; p.push([50 + Math.cos(a) * r, 54 + Math.sin(a) * r]); } poly(c, p); },
    leaf(c) {
      c.beginPath(); c.moveTo(16, 84); c.bezierCurveTo(14, 40, 46, 14, 88, 14); c.bezierCurveTo(88, 58, 58, 86, 16, 84); c.fill();
      cut(c, () => { c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(24, 76); c.quadraticCurveTo(50, 52, 76, 26); c.stroke(); });
    },
    moon(c) { circle(c, 50, 52, 35); cut(c, () => circle(c, 67, 38, 28)); },
    spade(c) { c.save(); c.translate(0, 100); c.scale(1, -1); c.translate(0, 12); ICONS.heart(c); c.restore(); poly(c, [[50, 54], [37, 92], [63, 92]]); },
    paw(c) { c.beginPath(); c.ellipse(50, 65, 20, 17, 0, 0, Math.PI * 2); c.fill(); circle(c, 24, 44, 9.5); circle(c, 40, 27, 9.5); circle(c, 60, 27, 9.5); circle(c, 76, 44, 9.5); },
    question(c) {
      c.lineWidth = 13; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(30, 34); c.bezierCurveTo(30, 12, 70, 12, 70, 34); c.bezierCurveTo(70, 50, 50, 50, 50, 64); c.stroke();
      circle(c, 50, 85, 7.5);
    }
  };
  function iconTexture(hex, icon) {
    const S = 128;
    const mk = () => { const cv = document.createElement("canvas"); cv.width = cv.height = S; return cv; };
    const mask = mk(), m = mask.getContext("2d");
    m.scale(S / 100, S / 100); m.fillStyle = "#fff"; m.strokeStyle = "#fff";
    ICONS[icon](m);
    const tint = col => { const t = mk(), x = t.getContext("2d"); x.drawImage(mask, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = col; x.fillRect(0, 0, S, S); return t; };
    const out = mk(), o = out.getContext("2d");
    o.drawImage(tint(mix(hex, "#ffffff", 0.5)), 2.5, 3.5);
    o.drawImage(tint(mix(hex, "#1a0b2e", hex === "#eceef5" ? 0.3 : 0.36)), 0, 0);
    const tex = new THREE.CanvasTexture(out);
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }
  function nutMats(hex, icon) {
    const col = new THREE.Color(hex);
    return {
      body: new THREE.MeshPhongMaterial({ color: col, shininess: 70, specular: 0x4a4a4a }),
      glow: new THREE.MeshPhongMaterial({ color: col, shininess: 70, specular: 0x6a6a6a, emissive: 0x3c3c3c }),
      decal: new THREE.MeshPhongMaterial({ map: iconTexture(hex, icon), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, shininess: 70, specular: 0x333333 })
    };
  }
  const MATS = COLORS.map(c => nutMats(c.hex, c.icon));
  const HIDDEN = nutMats("#5b566b", "question");

  // bolts
  const steelMat = new THREE.MeshPhongMaterial({ color: 0x555a6b, shininess: 60, specular: 0x5a5a5a });
  const baseMat = new THREE.MeshPhongMaterial({ color: 0x3d4150, shininess: 50, specular: 0x555555 });
  const brassMat = new THREE.MeshPhongMaterial({ color: 0xffc23a, shininess: 110, specular: 0xffffff, emissive: 0x2a1600 });
  const spareBaseMat = new THREE.MeshPhongMaterial({ color: 0xe0a526, shininess: 90, specular: 0xbbbbbb, emissive: 0x1a0d00 });
  const baseGeo = new THREE.LatheGeometry([
    [0.001, 0], [0.72, 0], [0.8, 0.015], [0.835, 0.05], [0.842, 0.09], [0.82, 0.135], [0.77, 0.166], [0.7, BASE_TOP], [0.001, BASE_TOP]
  ].map(p => new THREE.Vector2(p[0], p[1])), 40);
  const shaftGeos = {};
  function shaftGeo(cap) {
    if (shaftGeos[cap]) return shaftGeos[cap];
    const len = shaftLen(cap), r0 = 0.198, r1 = 0.232, step = 0.042;
    const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(r0, 0)];
    let y = 0.02, up = true;
    while (y < len - 0.13) { pts.push(new THREE.Vector2(up ? r1 : r0, y)); y += step; up = !up; }
    for (let a = 0; a <= 8; a++) { const t = (a / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(t) * r0), len - 0.1 + Math.sin(t) * 0.1)); }
    return (shaftGeos[cap] = new THREE.LatheGeometry(pts, 28));
  }
  const shadowTex = (function () {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const x = cv.getContext("2d"), g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, "rgba(8,3,20,0.6)"); g.addColorStop(0.6, "rgba(8,3,20,0.3)"); g.addColorStop(1, "rgba(8,3,20,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const shadowGeo = new THREE.PlaneGeometry(2.3, 2.3);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const ringGeo = new THREE.RingGeometry(0.92, 1.06, 48);
  const acornHexGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.16, 6);
  const acornDomeGeo = new THREE.LatheGeometry((function () {
    const p = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.3, 0)];
    for (let a = 0; a <= 10; a++) { const t = (a / 10) * Math.PI / 2; p.push(new THREE.Vector2(Math.max(0.001, Math.cos(t) * 0.3), Math.sin(t) * 0.3)); }
    return p;
  })(), 28);

  function makeBoltView(cap, spare) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(baseGeo, spare ? spareBaseMat : baseMat);
    const shaft = new THREE.Mesh(shaftGeo(cap), steelMat); shaft.position.y = BASE_TOP;
    const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = -0.03; sh.renderOrder = -1;
    group.add(sh, base, shaft);
    scene.add(group);
    return { group, cap, x: 0, y: 0, acorn: null, acornToken: 0, ring: null };
  }
  function makeNutView(color, hidden) {
    const obj = new THREE.Group();
    const m = hidden ? HIDDEN : MATS[color];
    const body = new THREE.Mesh(nutGeo, m.body);
    const decal = new THREE.Mesh(decalGeo, m.decal); decal.renderOrder = 1;
    obj.add(body, decal);
    scene.add(obj);
    return { obj, body, decal, color, hidden: !!hidden, rot: 0 };
  }

  // ================================================================ state
  // M: { mode, diff, level, type, par, day, caps, bolts, hid, counts, history, spares, hints, initial, won }
  let M = null;
  let V = { bolts: [], nuts: [] };
  let sel = -1;
  let version = 0;
  let winTimer = 0, hintBusy = false, loading = false;
  const anims = new Map();
  let effects = [];
  let particles = [];
  let dirty = true;
  const now = () => performance.now() / 1000;

  // ================================================================ themes
  function applyTheme() {
    const b = BOARDS.find(x => x.id === eco.equip.board) || BOARDS[0];
    const r = document.documentElement.style;
    r.setProperty("--board", b.v.board); r.setProperty("--board-deep", b.v.deep); r.setProperty("--peg", b.v.peg);
    r.setProperty("--glow", b.v.glow); r.setProperty("--panel", b.v.panel); r.setProperty("--panel-line", b.v.line); r.setProperty("--muted", b.v.muted);
    app.className = "pat-" + b.pat;
    const f = FINISHES.find(x => x.id === eco.equip.finish) || FINISHES[0];
    steelMat.color.set(f.shaft); steelMat.specular.setHex(f.spec); steelMat.shininess = f.shine;
    baseMat.color.set(f.base);
    dirty = true;
  }

  // revealed nuts of the same colour on top of a bolt
  function groupSize(bi) {
    const b = M.bolts[bi], h = M.hid[bi];
    if (!b.length) return 0;
    const c = b[b.length - 1]; let g = 0;
    for (let k = b.length - 1; k >= 0 && b[k] === c && !h[k]; k--) g++;
    return g;
  }

  // ================================================================ layout
  const tanHalf = Math.tan((camera.fov / 2) * Math.PI / 180);
  function layout() {
    const w = Math.max(stage.clientWidth, 1), h = Math.max(stage.clientHeight, 1), aspect = w / h;
    const caps = M.caps, N = caps.length;
    let best = null;
    for (let cols = 1; cols <= N; cols++) {
      const rows = Math.ceil(N / cols);
      const base = Math.floor(N / rows), extra = N % rows;
      const counts = []; for (let r = 0; r < rows; r++) counts.push(base + (r < extra ? 1 : 0));
      const realCols = Math.max.apply(null, counts);
      let idx = 0, H = 0; const hs = [];
      for (let r = 0; r < rows; r++) { const rh = rowHeight(Math.max.apply(null, caps.slice(idx, idx + counts[r]))); hs.push(rh); H += rh; idx += counts[r]; }
      H += (rows - 1) * ROW_GAP;
      const W = realCols * SX;
      const dist = Math.max(H / 2 / tanHalf, W / 2 / (tanHalf * aspect)) * 1.05 + 1.2;
      if (!best || dist < best.dist - 1e-6) best = { dist, counts, hs, H };
    }
    let idx = 0, top = best.H / 2;
    best.counts.forEach((cnt, r) => {
      const baseY = top - best.hs[r] + 0.16;
      for (let k = 0; k < cnt; k++) { const b = V.bolts[idx++]; b.x = (k - (cnt - 1) / 2) * SX; b.y = baseY; b.group.position.set(b.x, b.y, 0); }
      top -= best.hs[r] + ROW_GAP;
    });
    camera.aspect = aspect;
    camera.position.set(0, Math.sin(TILT) * best.dist, Math.cos(TILT) * best.dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    snapAll();
  }
  const hoverPoint = bi => ({ x: V.bolts[bi].x, y: V.bolts[bi].y + hoverY(V.bolts[bi].cap), z: 0 });
  const slotPoint = (bi, k) => ({ x: V.bolts[bi].x, y: V.bolts[bi].y + slotY(k), z: 0 });
  const snapRot = r => Math.round(r / SIXTH) * SIXTH;

  function snapAll() {
    anims.clear();
    V.nuts.forEach((arr, bi) => arr.forEach((nut, k) => {
      const p = sel === bi && k === arr.length - 1 ? hoverPoint(bi) : slotPoint(bi, k);
      nut.obj.position.set(p.x, p.y, 0);
      nut.obj.scale.set(1, 1, 1);
      nut.rot = snapRot(nut.rot); nut.obj.rotation.y = nut.rot;
    }));
    V.bolts.forEach(b => { if (b.acorn) b.acorn.position.set(b.x, b.y + shaftTop(b.cap) - 0.1, 0); if (b.ring) b.ring.position.set(b.x, b.y + 0.02, 0); });
    dirty = true;
  }

  function resize() {
    const w = Math.max(stage.clientWidth, 1), h = Math.max(stage.clientHeight, 1);
    renderer.setSize(w, h, false);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fxCanvas.width = Math.round(w * dpr); fxCanvas.height = Math.round(h * dpr);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (M) layout(); else dirty = true;
  }

  // ================================================================ animation
  const ease = {
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: t => 1 - Math.pow(1 - t, 3)
  };
  function planTo(nut, srcBi, dstBi, target, delay) {
    const o = nut.obj.position;
    let p = { x: o.x, y: o.y, z: o.z }, r = nut.rot;
    const segs = [];
    const dst = V.bolts[dstBi], src = V.bolts[srcBi];
    const dh = hoverPoint(dstBi);
    const end = target === "hover" ? dh : slotPoint(dstBi, target);
    const onDst = Math.abs(p.x - dst.x) < 0.01 && Math.abs(p.z) < 0.01;
    if (!onDst) {
      const sh = hoverPoint(srcBi);
      if (Math.abs(p.x - src.x) < 0.01 && Math.abs(p.z) < 0.01 && p.y < sh.y - 0.005) {
        const d = sh.y - p.y;
        segs.push({ type: "line", p0: p, p1: sh, r0: r, r1: r + d * SPIN, dur: (0.07 + d / 15) * SPEED, e: ease.inOut });
        r += d * SPIN; p = sh;
      }
      const dist = Math.hypot(dh.x - p.x, dh.y - p.y);
      segs.push({ type: "arc", p0: p, p1: dh, apex: Math.max(p.y, dh.y) + 0.5 + dist * 0.05, r0: r, r1: r, dur: Math.min(0.2 + dist * 0.028, 0.42) * SPEED, e: ease.inOut });
      p = dh;
    }
    const dy = end.y - p.y;
    if (Math.abs(dy) > 0.003) {
      const r1 = dy > 0 ? r + dy * SPIN : snapRot(r + dy * SPIN);
      segs.push({ type: "line", p0: p, p1: end, r0: r, r1, dur: (0.07 + Math.abs(dy) / (dy > 0 ? 15 : 12.5)) * SPEED, e: dy > 0 ? ease.inOut : ease.out });
    } else if (target !== "hover" && Math.abs(snapRot(r) - r) > 1e-3) {
      segs.push({ type: "line", p0: p, p1: end, r0: r, r1: snapRot(r), dur: 0.08 * SPEED, e: ease.out });
    }
    if (!segs.length) { anims.delete(nut); return 0; }
    const total = segs.reduce((s, g) => s + g.dur, 0);
    anims.set(nut, { t0: now() + delay, segs, total });
    return delay + total;
  }
  function applySeg(nut, s, t) {
    const q = s.e(Math.min(Math.max(t, 0), 1));
    let x = s.p0.x + (s.p1.x - s.p0.x) * q, y, z = s.p0.z + (s.p1.z - s.p0.z) * q;
    if (s.type === "arc") {
      const cy = 2 * s.apex - (s.p0.y + s.p1.y) / 2;
      y = (1 - q) * (1 - q) * s.p0.y + 2 * (1 - q) * q * cy + q * q * s.p1.y;
      z += Math.sin(Math.PI * q) * 0.7;
    } else y = s.p0.y + (s.p1.y - s.p0.y) * q;
    nut.obj.position.set(x, y, z);
    nut.rot = s.r0 + (s.r1 - s.r0) * q;
    nut.obj.rotation.y = nut.rot;
  }
  function stepAnim(nut, a, e) {
    let acc = 0;
    for (const s of a.segs) {
      if (e <= acc + s.dur) { applySeg(nut, s, (e - acc) / s.dur); return; }
      acc += s.dur;
    }
    applySeg(nut, a.segs[a.segs.length - 1], 1);
  }
  function addEffect(delay, dur, fn, done) { const f = { t0: now() + delay, dur, fn, done }; effects.push(f); return f; }

  function tick() {
    requestAnimationFrame(tick);
    const t = now();
    let active = false;
    for (const [nut, a] of anims) {
      const e = t - a.t0;
      if (e < 0) { active = true; continue; }
      stepAnim(nut, a, e);
      if (e >= a.total) { anims.delete(nut); dirty = true; } else active = true;
    }
    if (effects.length) {
      const keep = [];
      for (const f of effects) {
        const e = t - f.t0;
        if (e < 0) { keep.push(f); active = true; continue; }
        const p = Math.min(e / f.dur, 1);
        f.fn(p);
        if (p < 1) { keep.push(f); active = true; } else { dirty = true; if (f.done) f.done(); }
      }
      effects = keep;
    }
    if (particles.length || fxDirty) drawParticles();
    if (active || dirty) { renderer.render(scene, camera); dirty = false; }
  }

  // ================================================================ particles
  let fxDirty = false;
  function project(x, y, z) {
    const v = new THREE.Vector3(x, y, z || 0).project(camera);
    return { x: (v.x + 1) / 2 * stage.clientWidth, y: (1 - v.y) / 2 * stage.clientHeight };
  }
  function burst(sx, sy, palette, count, power) {
    if (RM) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * power;
      particles.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - power * 0.6, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1, decay: 0.012 + Math.random() * 0.012, col: palette[i % palette.length] });
    }
    fxDirty = true;
  }
  function drawParticles() {
    const w = stage.clientWidth, h = stage.clientHeight;
    fx.clearRect(0, 0, w, h);
    fxDirty = false;
    particles = particles.filter(p => p.life > 0 && p.y < h + 30);
    for (const p of particles) {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      fx.save();
      fx.globalAlpha = Math.max(p.life, 0);
      fx.translate(p.x, p.y); fx.rotate(p.rot);
      fx.fillStyle = p.col;
      fx.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * SIXTH; const px = Math.cos(a) * p.r, py = Math.sin(a) * p.r; if (k) fx.lineTo(px, py); else fx.moveTo(px, py); }
      fx.closePath(); fx.fill();
      fx.restore();
    }
    if (particles.length) fxDirty = true;
  }

  // ================================================================ scene build
  function clearScene() {
    anims.clear(); effects = []; particles = []; fxDirty = true;
    V.bolts.forEach(b => { scene.remove(b.group); if (b.acorn) scene.remove(b.acorn); if (b.ring) scene.remove(b.ring); });
    V.nuts.forEach(arr => arr.forEach(n => scene.remove(n.obj)));
    V = { bolts: [], nuts: [] };
  }
  function buildScene() {
    clearScene();
    sel = -1;
    const firstSpare = M.caps.length - M.spares;
    M.caps.forEach((cap, i) => V.bolts.push(makeBoltView(cap, i >= firstSpare)));
    M.bolts.forEach((b, bi) => V.nuts.push(b.map((c, k) => makeNutView(c, M.hid[bi][k]))));
    layout();
    M.bolts.forEach((b, bi) => { if (C.isComplete(b, M.counts)) setAcorn(bi, true, 0, true); });
    updateHud();
  }

  function setAcorn(bi, on, delay, instant) {
    const b = V.bolts[bi];
    b.acornToken++;
    if (!on) {
      if (b.acorn) { scene.remove(b.acorn); b.acorn = null; dirty = true; }
      return;
    }
    if (b.acorn) scene.remove(b.acorn);
    const g = new THREE.Group();
    const hex = new THREE.Mesh(acornHexGeo, brassMat); hex.position.y = 0.08;
    const dome = new THREE.Mesh(acornDomeGeo, brassMat); dome.position.y = 0.16;
    g.add(hex, dome);
    b.acorn = g; scene.add(g);
    const restY = () => b.y + shaftTop(b.cap) - 0.1;
    g.position.set(b.x, restY(), 0);
    if (instant) { dirty = true; return; }
    g.visible = false;
    const token = b.acornToken;
    addEffect(delay, 0.42 * SPEED, p => {
      if (b.acornToken !== token) return;
      g.visible = true;
      const q = ease.out(p);
      const bounce = p < 1 ? Math.sin(p * Math.PI) * 0.06 : 0;
      g.position.set(b.x, restY() + (1 - q) * 1.4 + bounce, 0);
      g.rotation.y = -(1 - q) * Math.PI * 2;
    }, () => {
      if (b.acornToken !== token) return;
      const s = project(b.x, restY() + 0.3, 0);
      const col = COLORS[M.bolts[bi][0]];
      burst(s.x, s.y, [col ? col.hex : "#ffc93c", "#ffc93c", "#ffffff"], 26, 5);
    });
  }

  function paintNut(nut, glow) {
    const m = nut.hidden ? HIDDEN : MATS[nut.color];
    nut.body.material = glow && !nut.hidden ? m.glow : m.body;
    nut.decal.material = m.decal;
    dirty = true;
  }
  function setHighlight(bi, on) {
    if (bi < 0) return;
    const arr = V.nuts[bi], g = on ? groupSize(bi) : 0;
    for (let k = 0; k < arr.length; k++) paintNut(arr[k], on && k >= arr.length - g);
  }
  // A mystery nut flips to its colour once it reaches the top.
  function revealTop(bi, delay) {
    const b = M.bolts[bi], h = M.hid[bi];
    if (!b.length || !h[b.length - 1]) return;
    h[b.length - 1] = false;
    const nut = V.nuts[bi][b.length - 1];
    let painted = false;
    addEffect(delay, 0.36 * SPEED, p => {
      const s = 1 + Math.sin(p * Math.PI) * 0.18;
      nut.obj.scale.set(s, 1 + Math.sin(p * Math.PI) * 0.1, s);
      if (p >= 0.5 && !painted) { painted = true; nut.hidden = false; paintNut(nut, false); }
    }, () => {
      nut.obj.scale.set(1, 1, 1);
      nut.hidden = false;
      if (sel >= 0) setHighlight(sel, true); else paintNut(nut, false);
    });
  }
  function revealAll(bi, delay) {
    const h = M.hid[bi];
    V.nuts[bi].forEach((nut, k) => {
      if (!h[k]) return;
      h[k] = false;
      addEffect(delay + k * 0.04, 0.3, p => { if (p >= 0.5 && nut.hidden) { nut.hidden = false; paintNut(nut, false); } });
    });
  }

  // ================================================================ game actions
  function select(i) {
    sel = i;
    const arr = V.nuts[i];
    planTo(arr[arr.length - 1], i, i, "hover", 0);
    setHighlight(i, true);
  }
  function deselect() {
    const i = sel;
    if (i < 0) return;
    sel = -1;
    setHighlight(i, false);
    const arr = V.nuts[i];
    if (arr.length) planTo(arr[arr.length - 1], i, i, arr.length - 1, 0);
  }
  function doMove(from, to) {
    const a = M.bolts[from], b = M.bolts[to];
    const m = Math.min(groupSize(from), M.caps[to] - b.length);
    setHighlight(from, false);
    sel = -1;
    let end = 0;
    for (let k = 0; k < m; k++) {
      b.push(a.pop()); M.hid[to].push(M.hid[from].pop());
      const nut = V.nuts[from].pop(); V.nuts[to].push(nut);
      end = Math.max(end, planTo(nut, from, to, b.length - 1, k * 0.075 * SPEED));
    }
    M.history.push({ from, to, n: m });
    revealTop(from, 0.18 * SPEED);
    changed();
    if (C.isComplete(b, M.counts)) {
      revealAll(to, end);
      setAcorn(to, true, end);
      if (isSolved()) { clearTimeout(winTimer); winTimer = setTimeout(showWin, (end + 0.75) * 1000); }
    }
  }
  function undo() {
    if (!M || !M.history.length || loading) return;
    if (sel >= 0) deselect();
    clearTimeout(winTimer);
    $("win").hidden = true;
    const h = M.history.pop();
    if (C.isComplete(M.bolts[h.to], M.counts)) setAcorn(h.to, false);
    for (let k = 0; k < h.n; k++) {
      M.bolts[h.from].push(M.bolts[h.to].pop()); M.hid[h.from].push(M.hid[h.to].pop());
      const nut = V.nuts[h.to].pop(); V.nuts[h.from].push(nut);
      planTo(nut, h.to, h.from, M.bolts[h.from].length - 1, k * 0.06 * SPEED);
    }
    changed();
  }
  const isSolved = () => M.bolts.every(b => !b.length || C.isComplete(b, M.counts));

  function tapBolt(i) {
    if (!M || loading) return;
    const B = M.bolts;
    const selectable = j => B[j].length && !C.isComplete(B[j], M.counts);
    if (sel < 0) {
      if (selectable(i)) select(i);
      else if (B[i].length) nudgeAcorn(i);
      return;
    }
    if (sel === i) { deselect(); return; }
    if (C.canMove(B, M.caps, M.counts, sel, i)) { doMove(sel, i); return; }
    if (selectable(i)) { deselect(); select(i); return; }
    shakeSelected();
  }
  function shakeSelected() {
    const arr = V.nuts[sel]; if (!arr.length) return;
    const nut = arr[arr.length - 1], bi = sel;
    if (anims.has(nut)) return;
    addEffect(0, 0.3, p => {
      if (sel !== bi) return;
      nut.obj.position.x = hoverPoint(bi).x + Math.sin(p * Math.PI * 6) * (1 - p) * 0.12;
    }, () => { if (sel === bi) nut.obj.position.x = hoverPoint(bi).x; });
  }
  function nudgeAcorn(bi) {
    const b = V.bolts[bi]; if (!b.acorn || effects.length) return;
    const y0 = b.y + shaftTop(b.cap) - 0.1;
    addEffect(0, 0.3, p => { if (b.acorn) b.acorn.position.y = y0 + Math.sin(p * Math.PI) * 0.18; });
  }

  // ---------------------------------------------------------------- washers
  function flashChip(cls) { const chip = $("washerChip"); chip.classList.remove("bump", "deny"); void chip.offsetWidth; chip.classList.add(cls); }
  function canPay(cost) {
    if (eco.washers >= cost) return true;
    toast("You need " + cost + " washers and have " + eco.washers + ". Clear levels to earn more.");
    flashChip("deny");
    return false;
  }
  function pay(cost) { eco.washers -= cost; saveEco(); renderWashers(); }
  function renderWashers(gain) {
    $("washerCount").textContent = eco.washers;
    $("shopBalance").textContent = eco.washers;
    if (gain) flashChip("bump");
  }

  async function hint() {
    if (!M || hintBusy || loading || isSolved()) return;
    if (!canPay(HINT_COST)) return;
    hintBusy = true; updateHud();
    const v = version;
    const res = await call({ type: "solve", bolts: M.bolts, caps: M.caps, counts: M.counts, limit: 150000 });
    hintBusy = false; updateHud();
    if (!M || v !== version) return;
    if (!res || !res.solved) {
      toast("No way out found from here, so no washers were charged. Undo a few moves and try again.");
      return;
    }
    pay(HINT_COST);
    M.hints++;
    changed();
    const mv = res.moves[0];
    if (sel !== mv.from) { if (sel >= 0) deselect(); select(mv.from); }
    pulseRing(mv.to);
  }
  function pulseRing(bi) {
    const b = V.bolts[bi];
    if (b.ring) scene.remove(b.ring);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, mat); ring.rotation.x = -Math.PI / 2; ring.position.set(b.x, b.y + 0.02, 0);
    b.ring = ring; scene.add(ring);
    addEffect(0, 2.4, p => { mat.opacity = 0.85 * Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p * 0.3); }, () => { if (b.ring === ring) { scene.remove(ring); b.ring = null; } mat.dispose(); });
  }
  function addSpare() {
    if (!M || loading || isSolved()) return;
    if (M.spares >= SPARE_COSTS.length) { toast("Two spare bolts is the limit for one level."); return; }
    const cost = SPARE_COSTS[M.spares];
    if (!canPay(cost)) return;
    pay(cost);
    if (sel >= 0) deselect();
    M.spares++;
    M.caps.push(1); M.bolts.push([]); M.hid.push([]); V.nuts.push([]);
    const bv = makeBoltView(1, true); V.bolts.push(bv);
    layout();
    bv.group.scale.setScalar(0.01);
    addEffect(0, 0.35, p => { bv.group.scale.setScalar(0.01 + ease.out(p) * 0.99); });
    toast("Spare bolt added. It holds one nut.");
    changed();
  }
  function restart() {
    if (!M || loading) return;
    clearTimeout(winTimer);
    $("win").hidden = true;
    M.bolts = M.initial.bolts.map(b => b.slice());
    M.hid = M.initial.hid.map(b => b.slice());
    M.caps = M.initial.caps.slice();
    for (let s = 0; s < M.spares; s++) { M.caps.push(1); M.bolts.push([]); M.hid.push([]); }
    M.history = []; M.won = false;
    buildScene();
    changed();
  }

  // ---------------------------------------------------------------- stars
  function starsFor(moves, par, hints, spares) {
    let s = 3;
    if (moves > par) s--;
    if (hints || spares) s--;
    if (moves > Math.round(par * 1.5)) s--;
    return Math.max(1, s);
  }
  const liveStars = () => starsFor(M.history.length, M.par, M.hints, M.spares);

  function changed() {
    version++;
    updateHud();
    saveState();
  }
  function updateHud() {
    renderWashers();
    if (!M) return;
    if (M.mode === "daily") {
      const d = new Date(M.day + "T12:00:00");
      $("diffPill").textContent = "Daily · " + TYPE_NAME[M.type];
      $("levelTitle").textContent = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    } else {
      $("diffPill").textContent = DIFF_INFO[M.diff].name + " · " + TYPE_NAME[M.type];
      $("levelTitle").textContent = "Level " + M.level;
    }
    $("moveCount").textContent = plural(M.history.length, "move");
    $("parCount").textContent = M.par;
    const s = liveStars();
    $("liveStars").innerHTML = [1, 2, 3].map(k => starSvg(k <= s)).join("");
    $("liveStars").setAttribute("aria-label", s + " of 3 stars if you finish now");
    $("undoBtn").disabled = !M.history.length;
    $("hintBtn").disabled = hintBusy || isSolved();
    const maxed = M.spares >= SPARE_COSTS.length;
    $("spareBtn").disabled = maxed || isSolved();
    $("spareCost").textContent = maxed ? "max" : SPARE_COSTS[M.spares];
  }
  function snapshotM() {
    return M && { mode: M.mode, diff: M.diff, level: M.level, type: M.type, par: M.par, day: M.day, caps: M.caps, bolts: M.bolts, hid: M.hid, counts: M.counts, history: M.history, spares: M.spares, hints: M.hints, initial: M.initial, won: M.won };
  }
  function saveState() { if (M) store.set("state:" + M.mode, snapshotM()); }

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.hidden = true), 3200);
  }

  // ================================================================ levels
  function adopt(data) {
    M = {
      mode: data.mode, diff: data.diff, level: data.level, type: data.type, par: data.par, day: data.day || null,
      caps: data.caps.slice(), bolts: data.bolts.map(b => b.slice()), hid: data.hid.map(b => b.slice()), counts: data.counts,
      history: (data.history || []).slice(), spares: data.spares | 0, hints: data.hints | 0, won: !!data.won,
      initial: data.initial || { caps: data.caps.slice(), bolts: data.bolts.map(b => b.slice()), hid: data.hid.map(b => b.slice()) }
    };
    current = M.mode === "daily" ? { mode: "daily", diff: current.diff, level: current.level } : { mode: "level", diff: M.diff, level: M.level };
    store.set("current", current);
    buildScene();
    changed();
  }
  const hiddenMask = (bolts, type) => bolts.map(b => b.map((c, k) => type === "mystery" && k < b.length - 1));
  let loadToken = 0;
  async function loadPuzzle(msg, meta) {
    clearTimeout(winTimer);
    $("win").hidden = true;
    loading = true; veil.hidden = false;
    const token = ++loadToken;
    if (M) { clearScene(); M = null; dirty = true; }
    const gen = await call(msg);
    if (token !== loadToken) return;
    loading = false; veil.hidden = true;
    if (!gen) { toast("This puzzle could not be built. Try the next one."); return; }
    adopt(Object.assign({ caps: gen.caps, bolts: gen.bolts, hid: hiddenMask(gen.bolts, gen.type), counts: gen.counts, type: gen.type, par: gen.par }, meta));
  }
  function startLevel(diff, level) {
    current = { mode: "level", diff, level }; store.set("current", current);
    $("diffPill").textContent = DIFF_INFO[diff].name + " · " + TYPE_NAME[C.typeFor(level)];
    $("levelTitle").textContent = "Level " + level;
    loadPuzzle({ type: "gen", diff, level }, { mode: "level", diff, level });
  }
  function startDaily() {
    const day = today();
    current = { mode: "daily", diff: current.diff, level: current.level }; store.set("current", current);
    const saved = store.get("state:daily", null);
    if (valid(saved) && saved.day === day) {
      loadToken++; loading = false; veil.hidden = true;
      adopt(saved);
      if (isSolved()) setTimeout(showWin, 300);
      return;
    }
    $("diffPill").textContent = "Daily · " + TYPE_NAME[dailyType(day)];
    $("levelTitle").textContent = "Today";
    loadPuzzle({ type: "gen", diff: "hard", level: 16, ltype: dailyType(day), seed: "daily:" + day }, { mode: "daily", diff: "hard", level: 16, day });
  }
  function resumeLevels() {
    const saved = store.get("state:level", null);
    const c = { diff: current.diff, level: current.level };
    if (valid(saved) && saved.diff === c.diff && saved.level === c.level) {
      loadToken++; loading = false; veil.hidden = true;
      adopt(saved);
      if (isSolved() && !M.won) setTimeout(showWin, 400);
    } else startLevel(c.diff, c.level);
  }

  function showWin() {
    if (!M || !isSolved()) return;
    const stars = liveStars();
    const firstWin = !M.won;
    let gain = 0, meta = "";
    M.won = true;
    if (M.mode === "daily") {
      const day = M.day, prev = eco.daily.done[day] || 0;
      if (!prev) {
        eco.daily.streak = eco.daily.last === yesterday() ? eco.daily.streak + 1 : 1;
        eco.daily.last = day;
        eco.daily.bestStreak = Math.max(eco.daily.bestStreak || 0, eco.daily.streak);
        gain = DAILY_STAR * stars + DAILY_STREAK * Math.min(eco.daily.streak, DAILY_STREAK_CAP);
        eco.daily.done[day] = stars;
      } else if (stars > prev) {
        gain = DAILY_STAR * (stars - prev);
        eco.daily.done[day] = stars;
      }
      $("winTitle").textContent = "Daily puzzle solved";
      meta = plural(M.history.length, "move") + ", par " + M.par + " · streak " + plural(eco.daily.streak, "day") + "<br>A new daily puzzle arrives at midnight.";
      $("nextBtn").textContent = "Back to levels";
    } else {
      const key = M.diff + ":" + M.level, prev = eco.best[key] || 0;
      if (stars > prev) {
        gain = DIFF_INFO[M.diff].star * (stars - prev);
        eco.best[key] = stars;
        eco.stars += stars - prev;
        if (!prev) eco.cleared++;
      }
      progress[M.diff] = Math.max(progress[M.diff] || 1, M.level + 1);
      store.set("progress", progress);
      $("winTitle").textContent = "Level " + M.level + " cleared";
      meta = plural(M.history.length, "move") + ", par " + M.par + (prev ? " · best before: " + plural(prev, "star") : "");
      if (M.hints || M.spares) meta += "<br>Solve it without a hint or spare bolt for the third star.";
      $("nextBtn").textContent = "Next level";
    }
    if (gain) { eco.washers += gain; eco.earned += gain; }
    saveEco();
    saveState();
    renderWashers(gain);
    $("winStars").innerHTML = [1, 2, 3].map(k => starSvg(k <= stars, k <= stars ? "pop" : "")).join("");
    [...$("winStars").children].forEach((el, k) => (el.style.animationDelay = (0.15 + k * 0.18) + "s"));
    $("winReward").innerHTML = gain ? washerSvg + "+" + gain + " washers" : '<span class="none">No new stars this time</span>';
    $("winMeta").innerHTML = meta;
    $("win").hidden = false;
    if (firstWin) {
      const w = stage.clientWidth;
      burst(w * 0.25, stage.clientHeight * 0.3, ["#ffc93c", "#ff6cb0", "#22c4f0", "#25a842"], 40, 7);
      burst(w * 0.75, stage.clientHeight * 0.3, ["#e8283f", "#ff7d1f", "#2163e6", "#ffffff"], 40, 7);
    }
    $("nextBtn").focus({ preventScroll: true });
  }

  // ================================================================ input
  function pickBolt(px, py) {
    let best = -1, bd = 1e9;
    V.bolts.forEach((b, i) => {
      const p0 = project(b.x, b.y - 0.15), p1 = project(b.x, b.y + hoverY(b.cap) + HN / 2), pr = project(b.x + SX * 0.48, b.y);
      const hw = Math.abs(pr.x - p0.x);
      const top = Math.min(p0.y, p1.y), bot = Math.max(p0.y, p1.y);
      const dx = Math.max(0, Math.abs(px - p0.x) - hw), dy = Math.max(0, top - py, py - bot);
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = i; }
    });
    return bd < 26 ? best : -1;
  }
  stage.addEventListener("pointerdown", e => {
    if (e.button && e.button !== 0) return;
    requestWake();
    const r = stage.getBoundingClientRect();
    const i = pickBolt(e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) tapBolt(i);
    else if (sel >= 0) deselect();
  });

  $("undoBtn").addEventListener("click", undo);
  $("hintBtn").addEventListener("click", hint);
  $("spareBtn").addEventListener("click", addSpare);
  $("restartBtn").addEventListener("click", restart);
  $("replayBtn").addEventListener("click", restart);
  $("nextBtn").addEventListener("click", () => {
    if (!M) return;
    $("win").hidden = true;
    if (M.mode === "daily") { current.mode = "level"; resumeLevels(); }
    else startLevel(M.diff, M.level + 1);
  });

  // fullscreen
  const root = document.documentElement;
  const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (!fsSupported) $("fsBtn").hidden = true;
  async function toggleFs() {
    try {
      if (fsElement()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch (e) { toast("Full screen isn't allowed here. Open the page on its own to use it."); }
  }
  function updateFsIcon() {
    const on = !!fsElement();
    $("fsIcon").innerHTML = on ? '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>' : '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
    $("fsBtn").setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
  }
  $("fsBtn").addEventListener("click", toggleFs);
  document.addEventListener("fullscreenchange", updateFsIcon);
  document.addEventListener("webkitfullscreenchange", updateFsIcon);

  let wakeLock = null;
  async function requestWake() {
    if (wakeLock || !navigator.wakeLock || document.visibilityState !== "visible") return;
    try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); } catch (e) {}
  }

  // ---------------------------------------------------------------- menu
  let menuDiff = current.diff;
  const maxLevel = d => progress[d] || 1;
  function renderDiffs() {
    const box = $("diffs"); box.innerHTML = "";
    DIFF_KEYS.forEach((k, i) => {
      const b = document.createElement("button");
      b.className = "diff"; b.type = "button"; b.setAttribute("aria-pressed", String(k === menuDiff));
      b.innerHTML = '<span class="name">' + DIFF_INFO[k].name + '<span class="pips">' + [0, 1, 2, 3].map(j => '<b class="' + (j <= i ? "on" : "") + '"></b>').join("") + '</span></span><span class="meta">' + DIFF_INFO[k].meta + '</span><span class="reach">Unlocked to level ' + maxLevel(k) + "</span>";
      b.addEventListener("click", () => { menuDiff = k; setLevelInput(current.mode === "level" && k === current.diff ? current.level : maxLevel(k)); renderDiffs(); });
      box.appendChild(b);
    });
  }
  function setLevelInput(v) {
    const max = maxLevel(menuDiff);
    v = Math.min(max, Math.max(1, v | 0 || 1));
    const inp = $("levelInput");
    inp.value = v; inp.max = max;
    $("lvlMinus").disabled = v <= 1; $("lvlPlus").disabled = v >= max;
    $("levelType").innerHTML = "Level " + v + " · <b>" + TYPE_NAME[C.typeFor(v)] + "</b>";
    const best = eco.best[menuDiff + ":" + v] || 0;
    $("levelBest").innerHTML = best ? '<span class="stars">' + [1, 2, 3].map(k => starSvg(k <= best)).join("") + "</span>" : v === max ? "<b>New</b>" : "";
  }
  function renderDaily() {
    const d = new Date(), day = today();
    $("calMonth").textContent = d.toLocaleDateString("en-GB", { month: "short" });
    $("calDay").textContent = d.getDate();
    const done = eco.daily.done[day], streak = liveStreak();
    $("dailyMeta").textContent = TYPE_NAME[dailyType(day)] + " · " + (done ? "solved with " + plural(done, "star") : streak ? "streak " + plural(streak, "day") : "start a streak");
  }
  function renderStats() {
    $("stCleared").textContent = eco.cleared;
    $("stStars").textContent = eco.stars;
    $("stStreak").textContent = liveStreak();
    $("stEarned").textContent = eco.earned;
  }
  function openMenu() {
    menuDiff = current.diff;
    setLevelInput(current.mode === "level" ? current.level : maxLevel(menuDiff));
    renderDiffs(); renderDaily(); renderStats();
    $("shop").hidden = true;
    $("menu").hidden = false;
    $("playBtn").focus({ preventScroll: true });
  }
  const closeMenu = () => { $("menu").hidden = true; };
  const levelValue = () => { const v = parseInt($("levelInput").value, 10); return Math.min(maxLevel(menuDiff), Math.max(1, isNaN(v) ? 1 : v)); };
  $("menuBtn").addEventListener("click", openMenu);
  $("menuCancel").addEventListener("click", closeMenu);
  $("lvlMinus").addEventListener("click", () => setLevelInput(levelValue() - 1));
  $("lvlPlus").addEventListener("click", () => setLevelInput(levelValue() + 1));
  $("levelInput").addEventListener("change", () => setLevelInput(levelValue()));
  $("levelInput").addEventListener("keydown", e => { if (e.key === "Enter") $("playBtn").click(); });
  $("playBtn").addEventListener("click", () => { closeMenu(); startLevel(menuDiff, levelValue()); });
  $("dailyBtn").addEventListener("click", () => { closeMenu(); startDaily(); });
  $("menuShop").addEventListener("click", () => { closeMenu(); openShop(); });
  $("menu").addEventListener("pointerdown", e => { if (e.target === $("menu")) closeMenu(); });

  // ---------------------------------------------------------------- shop
  function itemButton(kind, it) {
    const owned = eco.owned[kind].includes(it.id), on = eco.equip[kind] === it.id;
    if (on) return '<button class="on" disabled>Equipped</button>';
    if (owned) return '<button class="equip" data-k="' + kind + '" data-id="' + it.id + '">Use</button>';
    const short = eco.washers < it.price;
    return '<button class="' + (short ? "short" : "") + '" data-k="' + kind + '" data-id="' + it.id + '" aria-label="Buy ' + it.name + " for " + it.price + ' washers">' + washerSvg + it.price + "</button>";
  }
  function renderShop() {
    $("shopBalance").textContent = eco.washers;
    $("boardGrid").innerHTML = BOARDS.map(b =>
      '<div class="item' + (eco.equip.board === b.id ? " equipped" : "") + '"><div class="swatch pat-' + b.pat + '" style="--board:' + b.v.board + ";--peg:" + b.v.peg + ";--glow:" + b.v.glow + '"></div><span class="iname">' + b.name + "</span>" + itemButton("board", b) + "</div>").join("");
    $("finishGrid").innerHTML = FINISHES.map(f => {
      const g = "linear-gradient(90deg," + mix(f.shaft, "#000000", 0.35) + "," + mix(f.shaft, "#ffffff", 0.25) + " 40%," + mix(f.shaft, "#000000", 0.3) + ")";
      return '<div class="item' + (eco.equip.finish === f.id ? " equipped" : "") + '"><div class="swatch" style="background:rgba(0,0,0,0.28)"><span class="mini" style="height:30px;background:' + g + '"></span><span class="mini" style="height:20px;background:' + g + '"></span><span class="mini" style="height:40px;background:' + g + '"></span></div><span class="iname">' + f.name + "</span>" + itemButton("finish", f) + "</div>";
    }).join("");
  }
  function onShopClick(e) {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    const kind = b.dataset.k, id = b.dataset.id;
    const it = (kind === "board" ? BOARDS : FINISHES).find(x => x.id === id);
    if (!eco.owned[kind].includes(id)) {
      if (eco.washers < it.price) { toast(it.name + " costs " + it.price + " washers. You have " + eco.washers + "."); flashChip("deny"); return; }
      eco.washers -= it.price; eco.owned[kind].push(id);
    }
    eco.equip[kind] = id;
    saveEco(); applyTheme(); renderShop(); renderWashers();
  }
  $("boardGrid").addEventListener("click", onShopClick);
  $("finishGrid").addEventListener("click", onShopClick);
  function openShop() { renderShop(); $("menu").hidden = true; $("shop").hidden = false; $("shopClose").focus({ preventScroll: true }); }
  const closeShop = () => { $("shop").hidden = true; };
  $("washerChip").addEventListener("click", openShop);
  $("shopClose").addEventListener("click", closeShop);
  $("shop").addEventListener("pointerdown", e => { if (e.target === $("shop")) closeShop(); });

  document.addEventListener("keydown", e => {
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "Escape") {
      if (!$("menu").hidden) closeMenu(); else if (!$("shop").hidden) closeShop(); else if (sel >= 0) deselect();
      return;
    }
    if (!$("menu").hidden || !$("win").hidden || !$("shop").hidden) return;
    const k = e.key.toLowerCase();
    if (k === "u" || ((e.ctrlKey || e.metaKey) && k === "z")) { e.preventDefault(); undo(); }
    else if (k === "h") hint();
    else if (k === "r") restart();
    else if (k === "b") addSpare();
    else if (k === "m") openMenu();
    else if (k === "s") openShop();
    else if (k === "f" && fsSupported) toggleFs();
  });

  // ================================================================ boot
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);

  function valid(s) {
    return !!(s && (s.mode === "level" || s.mode === "daily") && DIFF_KEYS.includes(s.diff) && Array.isArray(s.bolts) && Array.isArray(s.caps) && Array.isArray(s.hid) &&
      s.bolts.length === s.caps.length && s.hid.length === s.bolts.length && s.counts && s.initial && s.initial.hid && TYPE_NAME[s.type] && s.par > 0);
  }
  function start(data) {
    applyTheme();
    resize();
    requestAnimationFrame(tick);
    const hot = data && data.state;
    if (valid(hot)) { veil.hidden = true; adopt(hot); return; }
    if (current.mode === "daily") startDaily(); else resumeLevels();
  }
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    window.claude.hot.snapshot(() => ({ state: snapshotM() }));
  }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
