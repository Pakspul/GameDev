// Drawing the machine with three.js (r128, the arcade's shared copy, loaded as the global THREE).
// Coins are instanced: one draw call per coin kind, so 250 standard coins cost one call. Prizes are
// small groups of primitives. Nothing here changes the simulation; it reads the board's items and
// interpolates between the last two physics steps so motion stays smooth at any frame rate.
import { CONFIG } from "./config.js";
import { THEMES, FIGURES } from "./themes.js";
import { gemRings } from "./shapes.js";

const THREE = globalThis.THREE;
const KINDS = ["coin", "gold", "lucky", "bomb", "jackpot"];
const CAP = { coin: 300, gold: 80, lucky: 8, bomb: 20, jackpot: 4 };
const B = CONFIG.board;

// ---- Coin faces, drawn once on a canvas: heads on the left half, tails on the right ----------------------
const FACE = {
  coin: { a: "#f4f6fa", b: "#9aa1ad", rim: "#d5d9e0", ink: "#6c7380", heads: "star", tails: "1", rimDots: false },
  gold: { a: "#fff1b0", b: "#c48a12", rim: "#f2c94c", ink: "#8a5a00", heads: "crown", tails: "5", rimDots: true },
  lucky: { a: "#c9ffd8", b: "#1f9a4a", rim: "#7fe0a0", ink: "#0d5a2a", heads: "clover", tails: "clover", rimDots: true },
  bomb: { a: "#6b6f7a", b: "#1b1d22", rim: "#3b3e46", ink: "#ffb347", heads: "fuse", tails: "!", rimDots: false },
  jackpot: { a: "#fff6c8", b: "#d08a00", rim: "#ffd447", ink: "#8a4a00", heads: "star", tails: "50", rimDots: true },
};

function coinTexture(kind) {
  const f = FACE[kind], S = 256;
  const cv = document.createElement("canvas");
  cv.width = S * 2; cv.height = S;
  const g = cv.getContext("2d");
  for (let side = 0; side < 2; side++) {
    const cx = S * side + S / 2, cy = S / 2, R = S / 2 - 2;
    const grad = g.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
    grad.addColorStop(0, f.a); grad.addColorStop(1, f.b);
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // raised rim, with dots on gold-type coins (so gold and silver differ in marking, not only colour)
    g.lineWidth = 14; g.strokeStyle = f.rim; g.beginPath(); g.arc(cx, cy, R - 9, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.strokeStyle = f.ink; g.globalAlpha = 0.5; g.beginPath(); g.arc(cx, cy, R - 17, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    if (f.rimDots) {
      g.fillStyle = f.ink;
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9), 2.6, 0, Math.PI * 2); g.fill(); }
    }
    const mark = side === 0 ? f.heads : f.tails;
    g.fillStyle = f.ink; g.strokeStyle = f.ink;
    if (mark === "star") star(g, cx, cy, R * 0.45, R * 0.2, 5);
    else if (mark === "crown") crown(g, cx, cy, R * 0.5);
    else if (mark === "clover") clover(g, cx, cy, R * 0.22);
    else if (mark === "fuse") fuse(g, cx, cy, R * 0.4);
    else {
      g.font = `900 ${mark.length > 1 ? R * 0.8 : R * 1.05}px system-ui, sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(mark, cx, cy + R * 0.06);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}
function star(g, cx, cy, r1, r2, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? r2 : r1; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.closePath(); g.fill();
}
function crown(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx - s, cy + s * 0.5); g.lineTo(cx - s, cy - s * 0.4); g.lineTo(cx - s * 0.5, cy + s * 0.05); g.lineTo(cx, cy - s * 0.6);
  g.lineTo(cx + s * 0.5, cy + s * 0.05); g.lineTo(cx + s, cy - s * 0.4); g.lineTo(cx + s, cy + s * 0.5); g.closePath(); g.fill();
}
function clover(g, cx, cy, r) {
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.beginPath(); g.arc(cx + dx * r * 0.62, cy + dy * r * 0.62, r * 0.75, 0, Math.PI * 2); g.fill();
  }
  g.lineWidth = r * 0.3; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + r * 0.6, cy + r * 1.6, cx + r * 1.4, cy + r * 2); g.stroke();
}
function fuse(g, cx, cy, r) {
  g.beginPath(); g.arc(cx, cy + r * 0.2, r * 0.75, 0, Math.PI * 2); g.fill();
  g.lineWidth = r * 0.16; g.beginPath(); g.moveTo(cx + r * 0.4, cy - r * 0.35); g.quadraticCurveTo(cx + r * 0.9, cy - r * 1.1, cx + r * 1.2, cy - r * 0.8); g.stroke();
  g.fillStyle = "#ffe08a";
  star(g, cx + r * 1.25, cy - r * 0.85, r * 0.4, r * 0.16, 6);
}

/** A cylinder whose caps sample the heads/tails halves of the face texture and whose edge samples the rim. */
function coinGeometry(diameter, thickness) {
  const geo = new THREE.CylinderGeometry(diameter / 2, diameter / 2, thickness, 32, 1);
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const r = diameter / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), ny = nor.getY(i);
    if (ny > 0.5) uv.setXY(i, 0.25 + (x / r) * 0.245, 0.5 - (z / r) * 0.49);
    else if (ny < -0.5) uv.setXY(i, 0.75 - (x / r) * 0.245, 0.5 - (z / r) * 0.49);
    else { const a = Math.atan2(z, x); uv.setXY(i, 0.25 + Math.cos(a) * 0.23, 0.5 - Math.sin(a) * 0.46); }
  }
  uv.needsUpdate = true;
  return geo;
}

function gemGeometry(colour) {
  const rings = gemRings(colour);
  const v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  for (let k = 0; k < rings.length - 1; k++) {
    const r0 = rings[k], r1 = rings[k + 1], n = r0.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(r0[i], r1[j], r1[i]);
      tri(r0[i], r0[j], r1[j]);
    }
  }
  const top = rings[rings.length - 1], bot = rings[0];
  const c = (ring) => ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length, s[2] + p[2] / ring.length], [0, 0, 0]);
  const ct = c(top), cb = c(bot);
  for (let i = 0; i < top.length; i++) { const j = (i + 1) % top.length; tri(ct, top[i], top[j]); tri(cb, bot[j], bot[i]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

function softDot() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.35, "rgba(255,255,255,0.6)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

function stripeTexture(a, b) {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 32;
  const g = cv.getContext("2d");
  g.fillStyle = a; g.fillRect(0, 0, 256, 32);
  g.fillStyle = b;
  for (let x = -32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  return t;
}

const hex = (c) => "#" + c.toString(16).padStart(6, "0");

// ---- Figures from their part lists (themes.js) ----------------------------------------------------------
const geoCache = new Map(), matCache = new Map();
function partGeometry(p) {
  const key = JSON.stringify([p[0], p[1], p[4] && p[4].half]);
  if (geoCache.has(key)) return geoCache.get(key);
  let g;
  const s = p[1];
  if (p[0] === "sph") g = new THREE.SphereGeometry(s, 14, 10);
  else if (p[0] === "box") g = new THREE.BoxGeometry(s[0], s[1], s[2]);
  else if (p[0] === "cyl") g = new THREE.CylinderGeometry(s[0], s[1], s[2], 16, 1, false, 0, p[4] && p[4].half ? Math.PI : Math.PI * 2);
  else if (p[0] === "cone") g = new THREE.ConeGeometry(s[0], s[1], 16);
  else g = new THREE.TorusGeometry(s[0], s[1], 8, 20, s[2] || Math.PI * 2);
  geoCache.set(key, g);
  return g;
}
function partMaterial(colour, o = {}) {
  const key = colour + (o.glow ? "g" : "") + (o.clear ? "c" : "");
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshPhongMaterial({ color: colour, shininess: 50, specular: 0x333333 });
  if (o.glow) m.emissive = new THREE.Color(colour).multiplyScalar(0.55);
  if (o.clear) { m.transparent = true; m.opacity = 0.78; m.shininess = 110; m.specular = new THREE.Color(0xffffff); }
  matCache.set(key, m);
  return m;
}
export function buildFigure(theme, index, scale = CONFIG.prizes.figure.height / 0.88) {
  const parts = (FIGURES[theme] || FIGURES.classic)[index % 8] || FIGURES.classic[0];
  const g = new THREE.Group();
  for (const p of parts) {
    const o = p[4] || {};
    for (const at of [p[2], ...(o.many || [])]) {
      const m = new THREE.Mesh(partGeometry(p), partMaterial(p[3], o));
      m.position.set(at[0], at[1], at[2]);
      if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
      if (o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2]);
      m.castShadow = true;
      g.add(m);
    }
  }
  const outer = new THREE.Group();
  g.scale.setScalar(scale);
  outer.add(g);
  return outer;
}

const gemGeoCache = new Map();
export function buildGem(theme, colour) {
  if (!gemGeoCache.has(colour)) gemGeoCache.set(colour, gemGeometry(colour));
  const c = (THEMES[theme] || THEMES.classic).gems[colour];
  const m = new THREE.MeshPhongMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.25), specular: 0xffffff, shininess: 140, flatShading: true, transparent: true, opacity: 0.93 });
  const mesh = new THREE.Mesh(gemGeoCache.get(colour), m);
  mesh.castShadow = true;
  return mesh;
}

// ---- The renderer --------------------------------------------------------------------------------------------
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 120);
    this.theme = null;
    this.quality = 0;          // index into config.performance.particleLevels
    this.shakeAmp = 0;
    this.shakeOn = true;
    this.prizeMeshes = new Map();
    this.ghosts = [];          // coins leaving the board: still drawn for a moment as they drop and shrink
    this.parts = [];           // particles
    this.view = { w: 1, h: 1, top: 0, bottom: 0 };
    this.tmpM = new THREE.Matrix4(); this.tmpP = new THREE.Vector3(); this.tmpQ = new THREE.Quaternion(); this.tmpS = new THREE.Vector3(1, 1, 1);
    this.build();
  }

  build() {
    const s = this.scene, W = B.width, D = B.depth;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x3a3440, 0.5);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff4e6, 0.62);
    sun.position.set(-4, 14, 8);
    sun.target.position.set(0, 0, 0.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -6; sc.right = 6; sc.top = 8; sc.bottom = -8; sc.near = 4; sc.far = 30;
    sun.shadow.bias = -0.0015;
    s.add(sun, sun.target);
    this.sun = sun;
    this.feverLight = new THREE.PointLight(0xffcc33, 0, 18);
    this.feverLight.position.set(0, 6, 1);
    s.add(this.feverLight);

    const M = (c, o = {}) => new THREE.MeshPhongMaterial({ color: c, shininess: 40, ...o });
    this.mats = {
      shelf: M(0xffffff, { shininess: 80, specular: 0x555555 }),
      cabinet: M(0xffffff), back: M(0xffffff), trim: M(0xffffff, { shininess: 120, specular: 0xaaaaaa }),
      pusher: M(0xffffff, { shininess: 70 }), pusherFace: new THREE.MeshPhongMaterial({ color: 0xffffff }),
      chrome: M(0xdfe4ec, { shininess: 140, specular: 0xffffff }),
      glass: new THREE.MeshPhongMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.16, shininess: 120, specular: 0xffffff, depthWrite: false }),
      wide: new THREE.MeshBasicMaterial({ color: 0x7cf7ff, transparent: true, opacity: 0, depthWrite: false }),
      dark: M(0x08080c), bulb: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    };
    const box = (w, h, d, mat, x, y, z, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = shadow;
      s.add(m);
      return m;
    };
    // Shelf and the trim along its front edge.
    box(W, 1, D + 1, this.mats.shelf, 0, -0.5, 0.5 - 0.5);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W, 12), this.mats.chrome);
    lip.rotation.z = Math.PI / 2; lip.position.set(0, -0.02, D / 2);
    s.add(lip);
    // Payout tray below the front edge.
    box(W + 1.6, 0.3, 2.2, this.mats.dark, 0, -2.4, D / 2 + 1.2, false);
    box(W + 1.6, 1.6, 0.15, this.mats.cabinet, 0, -1.6, D / 2 + 2.3);
    // Cabinet sides (with the gutters between them and the shelf) and the back.
    for (const sx of [-1, 1]) {
      box(0.5, 4.2, D + 4, this.mats.cabinet, sx * (W / 2 + 0.85), -0.4, 0.4);
      box(0.6, 0.2, D + 4, this.mats.dark, sx * (W / 2 + 0.3), -1.4, 0.4, false);       // gutter floor
    }
    box(W + 2.2, 9, 0.4, this.mats.back, 0, 3.4, -D / 2 - 0.5);
    // The back wall above the pusher: it sweeps riders off as the pusher retracts.
    const wallBottom = B.pusherHeight + 0.04;
    box(W, 1.0, 0.3, this.mats.cabinet, 0, wallBottom + 0.5, -D / 2 - 0.15);
    box(W, 0.08, 0.36, this.mats.trim, 0, wallBottom + 1.0, -D / 2 - 0.15);
    // Acrylic side rails (physics: board.js) and the Wide Shelf panels over the gutters.
    const railLen = B.sideOpenFrom + D / 2;
    for (const sx of [-1, 1]) {
      const r = box(0.06, B.railHeight, railLen, this.mats.glass, sx * (W / 2 + 0.05), B.railHeight / 2, -D / 2 + railLen / 2, false);
      r.renderOrder = 2;
      box(0.1, 0.08, railLen, this.mats.chrome, sx * (W / 2 + 0.05), B.railHeight, -D / 2 + railLen / 2);
      const openLen = D / 2 - B.sideOpenFrom;
      const w = box(0.08, B.railHeight, openLen, this.mats.wide, sx * (W / 2 + 0.05), B.railHeight / 2, B.sideOpenFrom + openLen / 2, false);
      w.renderOrder = 3;
    }
    // Bulbs along the back panel: they chase slowly, and glow with the fever.
    this.bulbs = [];
    const bulbGeo = new THREE.SphereGeometry(0.11, 10, 8);
    for (let i = 0; i < 15; i++) {
      const b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      b.position.set(-W / 2 - 0.3 + (i / 14) * (W + 0.6), 2.6, -D / 2 - 0.25);
      s.add(b);
      this.bulbs.push(b);
    }
    // Pusher.
    const pl = B.stroke + 2.2;
    this.pusherLen = pl;
    const faceTex = stripeTexture("#ffffff", "#dddddd");
    this.mats.pusherFace.map = faceTex;
    this.pusher = new THREE.Mesh(new THREE.BoxGeometry(W - 0.01, B.pusherHeight, pl),
      [this.mats.pusher, this.mats.pusher, this.mats.pusher, this.mats.pusher, this.mats.pusherFace, this.mats.pusher]);
    this.pusher.castShadow = true; this.pusher.receiveShadow = true;
    s.add(this.pusher);

    // Coins: one instanced mesh per kind.
    this.coinMeshes = {};
    const C = CONFIG.coin;
    for (const k of KINDS) {
      const geo = k === "jackpot" ? coinGeometry(C.jackpotDiameter, C.jackpotThickness) : coinGeometry(1, C.thickness);
      const mat = new THREE.MeshPhongMaterial({ map: coinTexture(k), specular: k === "bomb" ? 0x1a1a1a : 0x3a3a3a, shininess: 28 });
      if (k === "lucky") mat.emissive = new THREE.Color(0x0a3a18);
      const im = new THREE.InstancedMesh(geo, mat, CAP[k]);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = true; im.receiveShadow = true;
      s.add(im);
      this.coinMeshes[k] = im;
    }

    // Aim: a ghost coin and a thin guide line down to the shelf.
    this.ghost = new THREE.Mesh(coinGeometry(1, C.thickness), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    this.guide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    this.marker.rotation.x = -Math.PI / 2;
    s.add(this.ghost, this.guide, this.marker);

    // Particles.
    this.maxParts = 500;
    const pg = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.maxParts * 3);
    this.pCol = new Float32Array(this.maxParts * 3);
    pg.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute("color", new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.28, map: softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    s.add(this.points);
  }

  setTheme(id) {
    if (this.theme === id) return;
    this.theme = id;
    const T = THEMES[id] || THEMES.classic;
    this.scene.background = new THREE.Color(T.bg);
    this.scene.fog = new THREE.Fog(T.bg, 26, 60);
    this.mats.shelf.color.setHex(T.shelf);
    this.mats.cabinet.color.setHex(T.cabinet);
    this.mats.back.color.setHex(T.back);
    this.mats.trim.color.setHex(T.trim);
    this.mats.pusher.color.setHex(T.pusher);
    this.mats.pusherFace.map = stripeTexture(hex(T.pusher), hex(T.pusherFace));
    this.mats.pusherFace.needsUpdate = true;
    this.mats.wide.color.setHex(T.bulbs);
    this.feverLight.color.setHex(T.bulbs);
    this.bulbColor = new THREE.Color(T.bulbs);
    for (const m of this.prizeMeshes.values()) this.scene.remove(m.obj);
    this.prizeMeshes.clear();   // rebuilt with the new theme's figures and gem colours on the next frame
  }

  setQuality(level) { this.quality = Math.max(0, Math.min(CONFIG.performance.particleLevels.length - 1, level)); }

  /** Fit the board to the screen: the shelf's width fills the width in portrait; landscape letterboxes. */
  resize(w, h, top = 0, bottom = 0) {
    this.view = { w, h, top, bottom };
    this.gl.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = w / h;
    const usableH = Math.max(100, h - top - bottom * 0.35);
    // Tilt ~60° looking down at the shelf.
    const tilt = 60 * Math.PI / 180;
    const vfov = 40 * Math.PI / 180;
    cam.fov = 40;
    const halfW = B.width / 2 + 0.8;
    const hfovHalf = Math.atan(Math.tan(vfov / 2) * (w / usableH));
    const dW = halfW / Math.tan(hfovHalf);
    const dH = (B.depth * Math.sin(tilt) * 0.5 + 1.6) / Math.tan(vfov / 2);
    const d = Math.max(dW, dH);
    const target = new THREE.Vector3(0, 0, 0.6);
    cam.position.set(0, target.y + Math.sin(tilt) * d, target.z + Math.cos(tilt) * d);
    cam.lookAt(target);
    // Shift the picture so the board sits between the top bar and the controls.
    const shift = (top - bottom * 0.65) / 2;
    cam.setViewOffset(w, h, 0, -shift, w, h);
    cam.updateProjectionMatrix();
    this.baseCamPos = cam.position.clone();
  }

  /** Screen point of a world point, in CSS pixels. */
  toScreen(x, y, z) {
    const v = this.tmpP.set(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * this.view.w, y: (1 - v.y) / 2 * this.view.h };
  }

  /** The aim position (shelf x) under a screen x: the ghost coin sits right above the finger. */
  aimFromScreen(px) {
    const lim = B.width / 2 - B.aimMargin;
    const a = this.toScreen(-lim, B.dropHeight, B.dropZ).x, b = this.toScreen(lim, B.dropHeight, B.dropZ).x;
    return -lim + ((px - a) / (b - a)) * 2 * lim;
  }

  shake(amount) {
    if (!this.shakeOn) return;
    this.shakeAmp = Math.min(CONFIG.feedback.shakeMax, Math.max(this.shakeAmp, amount));
  }

  // ---- Effects ---------------------------------------------------------------------------------------------
  /** Sparkles: n particles of a colour from a point. */
  burst(x, y, z, colour, n, speed = 2.5, up = 2.5) {
    n = Math.round(n * CONFIG.performance.particleLevels[this.quality]);
    const c = new THREE.Color(colour);
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.maxParts) this.parts.shift();
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: up * (0.4 + Math.random() * 0.8), vz: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.45, r: c.r, g: c.g, b: c.b });
    }
  }

  /** A coin leaving the board keeps falling (into the tray or a gutter) and shrinks away. */
  leave(item, life = 0.45) {
    const v = [(item.x - item.px) * 60, (item.y - item.py) * 60, (item.z - item.pz) * 60];
    this.ghosts.push({ kind: item.kind, id: item.id, x: item.x, y: item.y, z: item.z, q: [item.qx, item.qy, item.qz, item.qw], v, t: 0, life, sub: item.sub, prize: item.kind === "gem" || item.kind === "figure" });
  }

  // ---- A frame ---------------------------------------------------------------------------------------------
  /**
   * board: the physics board; alpha: interpolation [0, 1] between the last two steps; dt: frame seconds.
   * o: { aim, showAim, fever (0..1 strength), wide, time }
   */
  render(board, alpha, dt, o = {}) {
    const lerp = (a, b) => a + (b - a) * alpha;
    // Pusher.
    const pz = lerp(board.pz0 ?? board.pusherZ(board.phase), board.pz1 ?? board.pusherZ(board.phase));
    this.pusher.position.set(0, B.pusherHeight / 2, pz);

    // Coins and prizes.
    const counts = { coin: 0, gold: 0, lucky: 0, bomb: 0, jackpot: 0 };
    const seen = new Set();
    for (const it of board.items.values()) {
      this.tmpP.set(lerp(it.px, it.x), lerp(it.py, it.y), lerp(it.pz, it.z));
      let qx = it.qx, qy = it.qy, qz = it.qz, qw = it.qw;
      if (alpha < 1) {
        const dot = it.pqx * qx + it.pqy * qy + it.pqz * qz + it.pqw * qw, sg = dot < 0 ? -1 : 1;
        qx = it.pqx * sg + (qx - it.pqx * sg) * alpha; qy = it.pqy * sg + (qy - it.pqy * sg) * alpha;
        qz = it.pqz * sg + (qz - it.pqz * sg) * alpha; qw = it.pqw * sg + (qw - it.pqw * sg) * alpha;
      }
      this.tmpQ.set(qx, qy, qz, qw).normalize();
      if (counts[it.kind] !== undefined) {
        const im = this.coinMeshes[it.kind];
        if (counts[it.kind] >= CAP[it.kind]) continue;
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS.set(1, 1, 1));
        im.setMatrixAt(counts[it.kind]++, this.tmpM);
      } else {
        seen.add(it.id);
        let pm = this.prizeMeshes.get(it.id);
        if (!pm) {
          const obj = it.kind === "gem" ? buildGem(this.theme, it.sub) : buildFigure(this.theme, it.sub);
          this.scene.add(obj);
          pm = { obj };
          this.prizeMeshes.set(it.id, pm);
        }
        pm.obj.position.copy(this.tmpP);
        pm.obj.quaternion.copy(this.tmpQ);
        pm.obj.scale.setScalar(1);
      }
    }
    // Leaving coins and prizes: keep falling, shrink away.
    const g = CONFIG.physics.gravity;
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const gh = this.ghosts[i];
      gh.t += dt;
      gh.v[1] -= g * dt;
      gh.x += gh.v[0] * dt; gh.y += gh.v[1] * dt; gh.z += gh.v[2] * dt;
      const k = Math.max(0, 1 - gh.t / gh.life);
      if (k <= 0) {
        this.ghosts.splice(i, 1);
        if (gh.prize) { const pm = this.prizeMeshes.get(gh.id); if (pm) { this.scene.remove(pm.obj); this.prizeMeshes.delete(gh.id); } }
        continue;
      }
      this.tmpP.set(gh.x, gh.y, gh.z);
      this.tmpQ.set(gh.q[0], gh.q[1], gh.q[2], gh.q[3]);
      if (gh.prize) {
        seen.add(gh.id);
        const pm = this.prizeMeshes.get(gh.id);
        if (pm) { pm.obj.position.copy(this.tmpP); pm.obj.scale.setScalar(k); }
      } else if (counts[gh.kind] !== undefined && counts[gh.kind] < CAP[gh.kind]) {
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS.set(k, k, k));
        this.coinMeshes[gh.kind].setMatrixAt(counts[gh.kind]++, this.tmpM);
      }
    }
    for (const k of KINDS) {
      const im = this.coinMeshes[k];
      im.count = counts[k];
      im.instanceMatrix.needsUpdate = true;
    }
    for (const [id, pm] of this.prizeMeshes) if (!seen.has(id)) { this.scene.remove(pm.obj); this.prizeMeshes.delete(id); }

    // Aim.
    const show = !!o.showAim;
    this.ghost.visible = this.guide.visible = this.marker.visible = show;
    if (show) {
      const x = o.aim || 0;
      this.ghost.position.set(x, B.dropHeight, B.dropZ);
      const bottom = B.pusherHeight + 0.02;
      this.guide.scale.y = B.dropHeight - bottom;
      this.guide.position.set(x, (B.dropHeight + bottom) / 2, B.dropZ);
      this.marker.position.set(x, bottom, B.dropZ);
    }

    // Wide Shelf panels and the fever glow (a smooth pulse, about once a second: no flashing).
    const t = o.time || 0;
    this.mats.wide.opacity = o.wide ? 0.22 + 0.08 * Math.sin(t * 3) : 0;
    const fever = o.fever || 0;
    this.feverLight.intensity = fever * (0.9 + 0.5 * Math.sin(t * Math.PI * 2));
    for (let i = 0; i < this.bulbs.length; i++) {
      const wave = 0.5 + 0.5 * Math.sin(t * (fever ? 4 : 1.6) - i * 0.7);
      const c = this.bulbs[i].material.color;
      c.copy(this.bulbColor || new THREE.Color(0xffd166)).multiplyScalar(0.35 + 0.65 * wave);
    }

    // Particles.
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy -= 9 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = 1 - p.life / p.max;
      this.pPos[n * 3] = p.x; this.pPos[n * 3 + 1] = p.y; this.pPos[n * 3 + 2] = p.z;
      this.pCol[n * 3] = p.r * k; this.pCol[n * 3 + 1] = p.g * k; this.pCol[n * 3 + 2] = p.b * k;
      n++;
    }
    this.points.geometry.setDrawRange(0, n);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    // Camera shake, capped and decaying.
    const cam = this.camera;
    if (this.baseCamPos) {
      cam.position.copy(this.baseCamPos);
      if (this.shakeAmp > 0.001) {
        cam.position.x += (Math.random() * 2 - 1) * this.shakeAmp;
        cam.position.y += (Math.random() * 2 - 1) * this.shakeAmp;
        this.shakeAmp *= Math.exp(-dt * 9);
      } else this.shakeAmp = 0;
    }
    this.gl.render(this.scene, cam);
  }
}

// ---- Thumbnails for the collection and the Workshop ------------------------------------------------------
let thumb = null;
/** A small picture of a collection item (index 0–3 gems, 4–11 figures), as a data URL. */
export function thumbnail(theme, index) {
  if (!thumb) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    gl.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 0.9));
    const d = new THREE.DirectionalLight(0xffffff, 0.8);
    d.position.set(-2, 3, 4);
    scene.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 0.55, 2.2);
    cam.lookAt(0, 0, 0);
    thumb = { gl, scene, cam, cache: new Map() };
  }
  const key = theme + ":" + index;
  if (thumb.cache.has(key)) return thumb.cache.get(key);
  const obj = index < 4 ? buildGem(theme, ["red", "blue", "green", "yellow"][index]) : buildFigure(theme, index - 4, 1);
  if (index < 4) { obj.scale.setScalar(1.05); obj.rotation.set(0.5, 0.4, 0); }
  else obj.rotation.y = -0.45;
  thumb.scene.add(obj);
  thumb.gl.render(thumb.scene, thumb.cam);
  const url = thumb.gl.domElement.toDataURL("image/png");
  thumb.scene.remove(obj);
  thumb.cache.set(key, url);
  return url;
}
