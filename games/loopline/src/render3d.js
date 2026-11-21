// Drawing Orbit: the sculpture in 3D (three.js, one instanced mesh for every block), the loop as a
// rail round it on a turntable plate, and the critters as little voxel creatures that face the
// sculpture as they slide round. The bays and lanes stay flat, drawn on the 2D canvas on top in the
// same pixel style as Critters, so they are easy to tap. Drag anywhere else to turn the view.
//
// Same interface as Renderer (render.js), so game.js drives both the same way.
import { PALETTE } from "./config.js";
import { BAY } from "./engine.js";
import { UI, CRITTER, HIDDEN, FONT, shade, colorOf, sprite, blit, label, rr, along, ease, lerp, clamp } from "./render.js";

const THREE = globalThis.THREE;
const TAU = Math.PI * 2;
const HEX = PALETTE.map((p) => p.hex);

/** A little canvas texture: a block face with a light rim at the top left and a dark one at the bottom right. */
function blockTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const x = c.getContext("2d");
  x.fillStyle = "#c4c4c4"; x.fillRect(0, 0, 16, 16);
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 15, 15);
  x.fillStyle = "#f0f0f0"; x.fillRect(2, 2, 12, 12);
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 15, 2);
  x.fillStyle = "#e4e4e4"; x.fillRect(14, 1, 1, 14); x.fillRect(1, 14, 14, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
/** The pop beam: bright at the critter, fading towards the sculpture and towards the top. */
function beamTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0.15)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = "destination-in";
  const v = x.createLinearGradient(0, 0, 0, 64);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(0.35, "rgba(0,0,0,0.6)"); v.addColorStop(1, "rgba(0,0,0,1)");
  x.fillStyle = v; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, "rgba(8,9,30,0.55)"); g.addColorStop(0.6, "rgba(8,9,30,0.3)"); g.addColorStop(1, "rgba(8,9,30,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
/** A rounded rectangle centred on the origin as a three.js path (in x, y; laid flat later). */
function roundRect(path, hw, hd, r) {
  path.moveTo(-hw + r, -hd);
  path.lineTo(hw - r, -hd); path.quadraticCurveTo(hw, -hd, hw, -hd + r);
  path.lineTo(hw, hd - r); path.quadraticCurveTo(hw, hd, hw - r, hd);
  path.lineTo(-hw + r, hd); path.quadraticCurveTo(-hw, hd, -hw, hd - r);
  path.lineTo(-hw, -hd + r); path.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return path;
}
/** A flat slab: a rounded rectangle (with an optional hole) extruded `h` up from y = y0. */
function slab(hw, hd, r, h, y0, hole) {
  const s = roundRect(new THREE.Shape(), hw, hd, r);
  if (hole) s.holes.push(roundRect(new THREE.Path(), hole[0], hole[1], hole[2]));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

export class Renderer3D {
  constructor(canvas, glCanvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.glc = glCanvas;
    this.gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.gl.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 400);
    this.scene.add(new THREE.HemisphereLight(0xe6e8ff, 0x30346a, 0.78));
    const sun = new THREE.DirectionalLight(0xffffff, 0.62);
    sun.position.set(-0.55, 1, 0.75);
    this.scene.add(sun);
    this.boxGeo = new THREE.BoxGeometry(0.97, 0.97, 0.97);
    this.blockMat = new THREE.MeshLambertMaterial({ map: blockTexture() });
    this.board = new THREE.Group();
    this.scene.add(this.board);
    // Flying blocks: each popped block flies to the critter that took it.
    this.flyMesh = new THREE.InstancedMesh(this.boxGeo, this.blockMat, 900);
    this.flyMesh.count = 0;
    this.flyMesh.frustumCulled = false;
    this.flyMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.scene.add(this.flyMesh);
    this.flies = [];
    this.mats = new Map();
    this.models = new Map(); // mover -> its 3D critter
    this.fx = []; this.tweens = new Map(); this.shakes = new Map();
    this.hint = -1; this.hintT0 = 0;
    this.game = null; this.levelKey = "";
    this.top = 64; this.bottom = 0;
    this.yaw = -0.62; this.pitch = 0.5; this.zoom = 1; this.vYaw = 0; this.drag = null;
    this.tmpM = new THREE.Matrix4(); this.tmpV = new THREE.Vector3(); this.tmpC = new THREE.Color();
    this.resize();
  }

  // ---- A level -------------------------------------------------------------------------------------------------
  setGame(game, mode) {
    this.game = game; this.mode = mode;
    const lv = game.level, key = `${lv.diff}:${lv.n}:${lv.picture}`;
    if (key !== this.levelKey) { this.yaw = -0.62; this.pitch = 0.5; this.zoom = 1; this.vYaw = 0; this.levelKey = key; }
    this.clearFx();
    this.build();
    this.layout();
  }
  clearFx() {
    this.fx = []; this.tweens.clear(); this.shakes.clear(); this.hint = -1;
    this.flies = []; this.flyMesh.count = 0;
    for (const md of this.models.values()) md.group.visible = false;
  }

  /** The plate, the rail, the sculpture's blocks, the critters' models. */
  build() {
    const g = this.game, lv = g.level, { w, h, d } = lv;
    for (const o of this.board.children.slice()) {
      this.board.remove(o);
      o.traverse((x) => { if (x.geometry && x.geometry !== this.boxGeo) x.geometry.dispose(); });
      if (o.isInstancedMesh && o.dispose) o.dispose();
    }
    for (const md of this.models.values()) this.scene.remove(md.group);
    this.models.clear();
    this.S = clamp(Math.max(w, d) / 8, 1.5, 2.8);      // critter size
    this.G = 1.1 + this.S * 0.95;                       // block edge to the rail's middle
    const G = this.G, hw = w / 2, hd = d / 2, railW = 0.55 + this.S * 0.28;
    this.railW = railW;
    // The plate (a turntable), its lip, the rail on it.
    const out = G + railW + 1.1;
    const lip = new THREE.Mesh(slab(hw + out + 0.25, hd + out + 0.25, 2.6, 0.5, -1.25), this.mat(0x1a1d3f));
    const plate = new THREE.Mesh(slab(hw + out, hd + out, 2.4, 0.9, -0.9), this.mat(0x2b2f62));
    const inner = new THREE.Mesh(slab(hw + 0.6, hd + 0.6, 0.8, 0.06, 0), this.mat(0x1a1d3e));
    const rc = Math.min(G, 3);
    const railE = new THREE.Mesh(slab(hw + G + railW / 2 + 0.16, hd + G + railW / 2 + 0.16, rc + railW / 2, 0.14, 0, [hw + G - railW / 2 - 0.16, hd + G - railW / 2 - 0.16, Math.max(0.2, rc - railW / 2)]), this.mat(0x6f76bb));
    const rail = new THREE.Mesh(slab(hw + G + railW / 2, hd + G + railW / 2, rc + railW / 2, 0.24, 0, [hw + G - railW / 2, hd + G - railW / 2, Math.max(0.2, rc - railW / 2)]), this.mat(0xb4b9e4));
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.08; blob.scale.set(w * 1.5 + 2, d * 1.5 + 2, 1);
    this.board.add(lip, plate, inner, railE, rail, blob);
    // Chevrons on the rail that run while critters ride.
    const chev = new THREE.Shape();
    chev.moveTo(-0.22, -0.3); chev.lineTo(0.12, 0); chev.lineTo(-0.22, 0.3); chev.lineTo(-0.06, 0.3); chev.lineTo(0.28, 0); chev.lineTo(-0.06, -0.3);
    const chevGeo = new THREE.ShapeGeometry(chev);
    chevGeo.rotateX(-Math.PI / 2);
    this.loop = this.loopPath(hw + G, hd + G, rc);
    const nChev = Math.max(12, Math.round(this.loop.len / 1.7));
    this.chev = new THREE.InstancedMesh(chevGeo, new THREE.MeshBasicMaterial({ color: 0xe3e6ff, transparent: true, opacity: 0.8 }), nChev);
    this.chevOff = 0;
    this.placeChevrons();
    this.board.add(this.chev);
    // The blocks.
    const cells = lv.cells, n = cells.reduce((a, v) => a + (v ? 1 : 0), 0);
    this.blocks = new THREE.InstancedMesh(this.boxGeo, this.blockMat, Math.max(1, n));
    this.blocks.frustumCulled = false;
    this.inst = new Int32Array(cells.length).fill(-1);
    this.shown = new Uint8Array(cells.length);
    const plane = w * d;
    let k = 0;
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      this.inst[i] = k;
      this.blocks.setColorAt(k, this.tmpC.set(HEX[cells[i] - 1]));
      this.blocks.setMatrixAt(k, this.tmpM.makeTranslation(...this.cellXYZ(i, plane)));
      this.shown[i] = 1;
      k++;
    }
    this.blocks.instanceColor.needsUpdate = true;
    this.board.add(this.blocks);
    this.beams = new Map();
  }

  mat(hex) {
    let m = this.mats.get(hex);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: hex }); this.mats.set(hex, m); }
    return m;
  }
  cellXYZ(i, plane = this.game.w * this.game.d) {
    const { w, d } = this.game, y = Math.floor(i / plane), r = i - y * plane, z = Math.floor(r / w), x = r - z * w;
    return [x - w / 2 + 0.5, y + 0.5, z - d / 2 + 0.5];
  }

  /** The rail's middle as a closed path, clockwise seen from above (same way round as the track). */
  loopPath(hw, hd, r) {
    const pts = [];
    const arc = (cx, cz, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
    arc(-hw + r, -hd + r, Math.PI); arc(hw - r, -hd + r, -Math.PI / 2); arc(hw - r, hd - r, 0); arc(-hw + r, hd - r, Math.PI / 2);
    pts.push(pts[0]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1];
    return {
      len,
      at(f) {
        let dd = (((f % 1) + 1) % 1) * len, i = 1;
        while (i < cum.length - 1 && cum[i] < dd) i++;
        const a = pts[i - 1], b = pts[i], s = cum[i] - cum[i - 1] || 1, t = (dd - cum[i - 1]) / s;
        return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0])];
      },
    };
  }
  placeChevrons() {
    const n = this.chev.count, o = new THREE.Object3D();
    for (let k = 0; k < n; k++) {
      const [x, z, a] = this.loop.at((k + this.chevOff) / n);
      o.position.set(x, 0.26, z); o.rotation.set(0, -a, 0); o.updateMatrix();
      this.chev.setMatrixAt(k, o.matrix);
    }
    this.chev.instanceMatrix.needsUpdate = true;
  }

  // ---- Points ----------------------------------------------------------------------------------------------------
  /** World point [x, z] of a track step (corners on the rounded rail). */
  stepXZ(t) {
    const { w, d } = this.game, G = this.G;
    let x = t.x < 0 ? -w / 2 - G : t.x >= w ? w / 2 + G : t.x - w / 2 + 0.5;
    let z = t.y < 0 ? -d / 2 - G : t.y >= d ? d / 2 + G : t.y - d / 2 + 0.5;
    if (!t.line) {
      const r = Math.min(this.G, 3) * (1 - Math.SQRT1_2);
      x += t.x < 0 ? r : -r; z += t.y < 0 ? r : -r;
    }
    return [x, z];
  }
  /** World point of track position pos (fractions blend). */
  trackXZ(pos) {
    const T = this.game.track, L = T.length, p0 = Math.floor(pos), f = pos - p0;
    const a = this.stepXZ(T[((p0 % L) + L) % L]), b = this.stepXZ(T[(p0 + 1) % L]);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }
  trackPoint(pos) { return pos; }
  /** Screen point of a world point. */
  project(x, y, z) {
    const v = this.tmpV.set(x, y, z).project(this.camera);
    return [(v.x + 1) / 2 * this.W, this.view.y + (1 - v.y) / 2 * this.view.h];
  }
  entrance() { const [x, z] = this.stepXZ(this.game.track[0]); return this.project(x, 0.9 * this.S, z); }
  bayPoint(b) { const s = this.slots[b]; return [s.x + s.s / 2, s.y + s.s / 2]; }
  yardPoint(m) {
    const g = this.game, Y = this.yard;
    for (let k = 0; k < g.lanes.length; k++) {
      const i = g.lanes[k].indexOf(m);
      if (i >= 0) return [Y.x + (k + 0.5) * this.laneW, Y.y + (i + 0.5) * this.rowH];
    }
    return [Y.x + Y.w / 2, Y.y];
  }

  // ---- Size and layout -----------------------------------------------------------------------------------------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = this.cv.clientWidth || window.innerWidth;
    this.H = this.cv.clientHeight || window.innerHeight;
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.gl.setPixelRatio(dpr);
    if (this.game) this.layout();
  }
  /** From the bottom up: the lanes, the bays, and the 3D view gets the rest. */
  layout() {
    const g = this.game, W = this.W, pad = 14;
    const bot = this.H - (this.bottom || 0);
    const compact = bot - this.top < 600;
    const nL = g.lanes.length, rows = 3;
    this.laneW = Math.floor(Math.min(84, (W - 2 * pad) / nL));
    this.rowH = compact ? 42 : 54;
    const yardW = this.laneW * nL, yardH = this.rowH * rows;
    this.yard = { x: Math.round((W - yardW) / 2), y: bot - pad - yardH, w: yardW, h: yardH };
    const nS = g.bays.length, slotS = compact ? 46 : 54, gap = compact ? 8 : 10;
    const sw = nS * slotS + (nS - 1) * gap, sy = this.yard.y - (compact ? 16 : 22) - slotS;
    this.slots = Array.from({ length: nS }, (_, i) => ({ x: Math.round((W - sw) / 2) + i * (slotS + gap), y: sy, s: slotS }));
    this.moverSize = compact ? 30 : 36;
    this.compact = compact;
    const vy = this.top, vh = Math.max(120, sy - 10 - vy);
    this.view = { x: 0, y: vy, w: W, h: vh };
    const st = this.glc.style;
    st.top = vy + "px"; st.height = vh + "px"; st.width = W + "px";
    this.gl.setSize(W, vh, false);
    this.camera.aspect = W / vh;
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }
  placeCamera() {
    const lv = this.game.level, out = this.G + this.railW + 1.1;
    const rx = lv.w / 2 + out, rz = lv.d / 2 + out;
    const R = Math.sqrt(rx * rx + rz * rz + (lv.h * 0.55) ** 2);
    const vf = (this.camera.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    const dist = (R / Math.sin(Math.min(vf, hf))) * 0.88 * this.zoom;
    const ty = lv.h * 0.4;
    const c = this.camera, cp = Math.cos(this.pitch);
    c.position.set(Math.sin(this.yaw) * cp * dist, ty + Math.sin(this.pitch) * dist, Math.cos(this.yaw) * cp * dist);
    c.lookAt(0, ty - 0.6, 0);
  }

  // ---- Turning the view --------------------------------------------------------------------------------------------
  beginDrag(x, y) { this.drag = { x, y, yaw: this.yaw, pitch: this.pitch, lx: x, lt: performance.now() }; this.vYaw = 0; }
  moveDrag(x, y) {
    const D = this.drag;
    if (!D) return false;
    const t = performance.now(), dt = Math.max(8, t - D.lt);
    const yaw = D.yaw - (x - D.x) * 0.009;
    this.vYaw = lerp(this.vYaw, (yaw - this.yaw) / dt, 0.5);
    this.yaw = yaw;
    this.pitch = clamp(D.pitch + (y - D.y) * 0.006, 0.12, 1.3);
    D.lt = t;
    return true;
  }
  endDrag() { if (!this.drag) return false; this.drag = null; if (Math.abs(this.vYaw) < 0.0004) this.vYaw = 0; return true; }
  wheel(dy) { this.zoom = clamp(this.zoom * Math.exp(dy * 0.001), 0.55, 1.6); }

  // ---- Effects from the engine's events --------------------------------------------------------------------------
  onLaunch(m, e, now) {
    const pts = e.from.bay != null ? [this.bayPoint(e.from.bay)] : [[this.yard.x + (e.from.lane + 0.5) * this.laneW, this.yard.y + 0.5 * this.rowH]];
    this.tweens.set(m, { pts, t0: now, dur: 0.32, kind: "in" });
  }
  onTake(m, cell, now) {
    const [x, y, z] = this.cellXYZ(cell);
    this.flies.push({ m, x, y, z, t0: now, dur: 0.26 + Math.random() * 0.08, c: this.game.level.cells[cell] });
    const md = this.models.get(m);
    if (md) { md.popT = now; md.beamT = now; }
  }
  onEnter() {}
  onPark(m, bay, now) { this.tweens.set(m, { pts: [this.entrance(), this.bayPoint(bay)], t0: now, dur: 0.38, kind: "park" }); }
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
    const V = this.view;
    for (let k = 0; k < 90; k++) {
      const color = HEX[Math.floor(Math.random() * 10)];
      this.fx.push({ kind: "spark", x: V.w * (0.15 + Math.random() * 0.7), y: V.y + V.h * (0.3 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 160, vy: -90 - Math.random() * 160, g: 300, t0: now + Math.random() * 0.3, dur: 1.3, color, s: 6 });
    }
    this.spinT = now;
  }
  shake(m, now) { this.shakes.set(m, now); }
  showHint(m, now) { this.hint = m; this.hintT0 = now; }

  busy(now) {
    if (this.drag || Math.abs(this.vYaw) > 0.00005) return true;
    if (this.flies.length || this.fx.some((f) => now < f.t0 + f.dur)) return true;
    for (const t of this.tweens.values()) if (now < t.t0 + t.dur) return true;
    for (const t0 of this.shakes.values()) if (now < t0 + 0.4) return true;
    for (const md of this.models.values()) if (md.group.visible && now < md.beamT + 0.3) return true;
    if (this.spinT && now < this.spinT + 2) return true;
    if (this.hint >= 0 && now < this.hintT0 + 4) return true;
    return false;
  }

  hit(x, y) {
    const g = this.game;
    for (let b = 0; b < this.slots.length; b++) {
      const s = this.slots[b];
      if (g.bays[b] >= 0 && x >= s.x - 4 && x <= s.x + s.s + 4 && y >= s.y - 4 && y <= s.y + s.s + 4) return { m: g.bays[b] };
    }
    const Y = this.yard;
    if (x < Y.x - 6 || x > Y.x + Y.w + 6 || y < Y.y - 8 || y > Y.y + Y.h + 8) return null;
    const k = clamp(Math.floor((x - Y.x) / this.laneW), 0, g.lanes.length - 1);
    return g.lanes[k].length ? { m: g.lanes[k][0], lane: k } : null;
  }

  // ---- Critters in 3D --------------------------------------------------------------------------------------------
  model(m) {
    let md = this.models.get(m);
    if (md) return md;
    const hex = colorOf(this.game.color(m)), group = new THREE.Group(), body = new THREE.Group();
    const box = (sx, sy, sz, x, y, z, color) => { const b = new THREE.Mesh(this.boxGeo, this.mat(color)); b.scale.set(sx, sy, sz); b.position.set(x, y, z); body.add(b); return b; };
    const c = parseInt(hex.slice(1), 16), dark = parseInt(shade(hex, -0.45).slice(1), 16), light = parseInt(shade(hex, 0.5).slice(1), 16);
    box(1.5, 1.15, 1.15, 0, 0.78, 0, c);                    // body
    box(1.3, 0.16, 0.95, 0, 1.42, 0, parseInt(shade(hex, 0.22).slice(1), 16)); // a lighter top
    for (const sx of [-1, 1]) {
      box(0.36, 0.42, 0.4, sx * 0.48, 1.62, 0, c);          // ears
      box(0.38, 0.42, 0.06, sx * 0.36, 0.95, 0.6, 0xffffff); // eyes
      box(0.2, 0.26, 0.07, sx * 0.31, 0.92, 0.63, 0x16182c);
      box(0.22, 0.12, 0.05, sx * 0.58, 0.66, 0.6, light);    // cheeks
      box(0.42, 0.24, 0.55, sx * 0.42, 0.12, 0.05, dark);    // feet
    }
    group.add(body);
    // The count over its head.
    const lc = document.createElement("canvas");
    lc.width = 128; lc.height = 64;
    const tex = new THREE.CanvasTexture(lc);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    tag.renderOrder = 10;
    tag.position.y = 2.6;
    tag.scale.set(1.9, 0.95, 1);
    group.add(tag);
    // A light curtain from the critter into the sculpture while it pops.
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: c, map: this.beamTex || (this.beamTex = beamTexture()), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    group.add(beam);
    group.scale.setScalar(this.S);
    group.visible = false;
    this.scene.add(group);
    md = { group, body, tag, lc, tex, beam, text: "", popT: -9, beamT: -9 };
    this.models.set(m, md);
    return md;
  }
  setTag(md, text) {
    if (md.text === text) return;
    md.text = text;
    const x = md.lc.getContext("2d");
    x.clearRect(0, 0, 128, 64);
    x.font = `46px ${FONT}`;
    x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
    x.lineWidth = 12; x.strokeStyle = UI.ink; x.strokeText(text, 64, 34);
    x.fillStyle = "#fff"; x.fillText(text, 64, 34);
    md.tex.needsUpdate = true;
  }
  /** Put critter m at track position pos, facing in. */
  placeCritter(m, pos, now, alpha = 1) {
    const g = this.game, md = this.model(m), [x, z] = this.trackXZ(pos);
    const { w, d } = g, tx = clamp(x, -w / 2, w / 2), tz = clamp(z, -d / 2, d / 2);
    const face = Math.atan2(tx - x, tz - z);
    md.group.visible = alpha > 0;
    const hop = Math.abs(Math.sin(now * 13 + m)) * 0.12 * this.S;
    md.group.position.set(x, 0.24 + hop, z);
    md.body.rotation.y = face;
    const pop = now - md.popT < 0.12 ? 1.12 : 1;
    md.body.scale.set(pop, 2 - pop, pop);
    this.setTag(md, g.left[m] ? String(g.left[m]) : "✓");
    // The beam: from the critter to the sculpture's side, as tall as the sculpture.
    const dist = Math.hypot(tx - x, tz - z), b = md.beam, fade = clamp(1 - (now - md.beamT) / 0.3, 0, 1);
    b.visible = fade > 0;
    if (fade > 0) {
      const H = (g.h + 0.6) / this.S, L = dist / this.S + 0.2;
      b.scale.set(L, H, 1);
      b.position.set(Math.sin(face) * L / 2, H / 2, Math.cos(face) * L / 2);
      b.rotation.y = face - Math.PI / 2;
      b.material.opacity = 0.55 * fade;
    }
  }

  // ---- Drawing ---------------------------------------------------------------------------------------------------
  draw(frac, now) {
    const g = this.game;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (!g) return;
    // The view: drag, then a little glide.
    if (!this.drag && this.vYaw) { this.yaw += this.vYaw * 16; this.vYaw *= 0.92; if (Math.abs(this.vYaw) < 0.00005) this.vYaw = 0; }
    let spin = 0;
    if (this.spinT && now < this.spinT + 2) spin = ease((now - this.spinT) / 2) * TAU; else this.spinT = 0;
    const yaw0 = this.yaw;
    this.yaw += spin;
    this.placeCamera();
    this.yaw = yaw0;
    this.syncBlocks();
    // Chevrons run while critters ride.
    if (g.belt.length) { this.chevOff = (now * 1.8) % 1; this.placeChevrons(); }
    // Critters on the loop, and the ones waiting to get on.
    const live = new Set();
    for (const b of g.belt) {
      live.add(b.m);
      const tw = this.tweens.get(b.m);
      if (tw && tw.kind === "in" && now < tw.t0 + tw.dur) { this.model(b.m).group.visible = false; continue; }
      this.placeCritter(b.m, Math.min(b.pos + frac, g.L), now);
    }
    g.queue.forEach((m, i) => {
      live.add(m);
      const tw = this.tweens.get(m);
      if (tw && tw.kind === "in" && now < tw.t0 + tw.dur) { this.model(m).group.visible = false; return; }
      this.placeCritter(m, 0, now);
      const md = this.models.get(m), [x, z] = this.stepXZ(g.track[0]);
      md.beam.visible = false;
      md.group.position.set(x - (i + 1) * 0.8 * this.S, 0.24, z + (i + 1) * 0.9 * this.S);
    });
    for (const [m, md] of this.models) if (!live.has(m)) md.group.visible = false;
    this.updateFlies(now);
    this.gl.render(this.scene, this.camera);
    // Flat on top: bays, lanes, critters on their way, effects, the hint.
    this.drawSlots(now);
    this.drawLanes(now);
    for (const m of [...g.belt.map((b) => b.m), ...g.queue]) {
      const tw = this.tweens.get(m);
      if (tw && tw.kind === "in" && now < tw.t0 + tw.dur) this.drawCritter(m, null, now, "fly", false, this.entranceOf(m));
    }
    this.drawFx(now);
    if (this.hint >= 0) this.drawHint(now);
  }
  entranceOf() { return this.entrance(); }

  /** Show exactly the blocks the game still has (after pops, undo or restart). */
  syncBlocks() {
    const cells = this.game.cells, shown = this.shown, inst = this.inst;
    let changed = false;
    const plane = this.game.w * this.game.d;
    for (let i = 0; i < cells.length; i++) {
      const on = cells[i] ? 1 : 0;
      if (on === shown[i] || inst[i] < 0) continue;
      shown[i] = on;
      changed = true;
      if (on) this.blocks.setMatrixAt(inst[i], this.tmpM.makeTranslation(...this.cellXYZ(i, plane)));
      else this.blocks.setMatrixAt(inst[i], this.tmpM.makeScale(0, 0, 0));
    }
    if (changed) this.blocks.instanceMatrix.needsUpdate = true;
  }

  updateFlies(now) {
    const keep = [], fm = this.flyMesh;
    let k = 0;
    for (const f of this.flies) {
      const t = (now - f.t0) / f.dur;
      if (t >= 1) continue;
      keep.push(f);
      if (k >= fm.instanceMatrix.count) continue;
      const md = this.models.get(f.m);
      const tx = md && md.group.visible ? md.group.position.x : f.x, tz = md && md.group.visible ? md.group.position.z : f.z, ty = 1.1 * this.S;
      const e = ease(Math.max(0, t)), s = 1 - 0.65 * e;
      this.tmpM.makeScale(s, s, s);
      this.tmpM.setPosition(lerp(f.x, tx, e), lerp(f.y, ty, e) + Math.sin(Math.max(0, t) * Math.PI) * 1.6, lerp(f.z, tz, e));
      fm.setMatrixAt(k, this.tmpM);
      fm.setColorAt(k, this.tmpC.set(HEX[f.c - 1]));
      k++;
    }
    this.flies = keep;
    fm.count = k;
    if (k) { fm.instanceMatrix.needsUpdate = true; fm.instanceColor.needsUpdate = true; }
  }

  drawSlots(now) {
    const ctx = this.ctx, g = this.game;
    this.slots.forEach((s, b) => {
      ctx.fillStyle = UI.slotEdge;
      ctx.beginPath(); rr(ctx, s.x, s.y, s.s, s.s, 12); ctx.fill();
      ctx.fillStyle = UI.slot;
      ctx.beginPath(); rr(ctx, s.x + 3, s.y + 4, s.s - 6, s.s - 6, 10); ctx.fill();
      const m = g.bays[b];
      if (m >= 0) this.drawCritter(m, this.bayPoint(b), now, "bay");
    });
  }
  drawLanes(now) {
    const ctx = this.ctx, g = this.game, Y = this.yard, c = this.laneW, rows = Math.round(Y.h / this.rowH);
    for (let k = 0; k < g.lanes.length; k++) {
      ctx.fillStyle = UI.lane;
      ctx.beginPath(); rr(ctx, Y.x + k * c + 4, Y.y - 6, c - 8, Y.h + 12, 16); ctx.fill();
      const lane = g.lanes[k];
      for (let i = Math.min(lane.length, rows) - 1; i >= 0; i--) {
        const at = [Y.x + (k + 0.5) * c, Y.y + (i + 0.5) * this.rowH];
        if (i === rows - 1 && lane.length > rows) { label(ctx, "+" + (lane.length - rows + 1), at[0], at[1], 18); continue; }
        this.drawCritter(lane[i], at, now, i === 0 ? "front" : "lane", g.level.hidden && i > 0);
      }
    }
  }
  /** A flat critter. where: front | lane | bay | fly (on its way to the loop; `to` is where it lands). */
  drawCritter(m, p, now, where, hidden = false, to = null) {
    const g = this.game, tw = this.tweens.get(m), ctx = this.ctx;
    let x, y;
    if (where === "fly") {
      const t = ease((now - tw.t0) / tw.dur), q = along(tw.pts.concat([to]), t);
      x = q[0]; y = q[1];
    } else {
      [x, y] = p;
      if (where === "bay" && tw && tw.kind === "park" && now < tw.t0 + tw.dur) { const q = along(tw.pts, ease((now - tw.t0) / tw.dur)); x = q[0]; y = q[1]; }
    }
    const sh = this.shakes.get(m);
    if (sh != null && now < sh + 0.4) x += Math.sin((now - sh) * 50) * 5 * (1 - (now - sh) / 0.4);
    const hex = hidden ? "#8a8fb8" : colorOf(g.color(m));
    const text = hidden ? "?" : g.left[m] ? String(g.left[m]) : "✓";
    const big = where === "front" ? 1.08 : where === "lane" ? 0.9 : 1;
    const size = (where === "bay" ? this.slots[0].s * 0.78 : where === "fly" ? this.moverSize : Math.min(this.laneW * 0.72, this.rowH * 0.92)) * big;
    ctx.save();
    ctx.translate(x, y);
    blit(ctx, sprite(hidden ? "hid" : "crit", hidden ? HIDDEN : CRITTER, hex), size);
    label(ctx, text, 0, hidden ? 0 : size * 0.2, clamp(size * 0.38, 12, 22));
    if (where === "lane" && !hidden) { ctx.globalAlpha = 0.28; ctx.fillStyle = UI.panel; ctx.beginPath(); ctx.arc(0, 0, size * 0.56, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  drawFx(now) {
    const ctx = this.ctx, keep = [];
    for (const f of this.fx) {
      const t = (now - f.t0) / f.dur;
      if (t >= 1) continue;
      keep.push(f);
      if (t < 0) continue;
      if (f.kind === "spark") {
        const s = now - f.t0, x = f.x + f.vx * s, y = f.y + f.vy * s + 0.5 * (f.g || 0) * s * s;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = f.color;
        ctx.fillRect(Math.round(x - f.s / 2), Math.round(y - f.s / 2), Math.round(f.s), Math.round(f.s)); ctx.globalAlpha = 1;
      } else if (f.kind === "ring") {
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
    else if (g.where[m] === 0) p = this.yardPoint(m);
    else { this.hint = -1; return; }
    const ctx = this.ctx, k = 3 * Math.sin(t * 7), r = 30;
    ctx.globalAlpha = Math.min(1, 4 - t);
    ctx.strokeStyle = UI.ink; ctx.lineWidth = 7;
    ctx.beginPath(); rr(ctx, p[0] - r - k, p[1] - r - k, 2 * (r + k), 2 * (r + k), 12); ctx.stroke();
    ctx.strokeStyle = UI.glow; ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
