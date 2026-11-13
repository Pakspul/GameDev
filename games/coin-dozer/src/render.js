// Drawing the machine with three.js (r128, the arcade's shared copy, loaded as the global THREE).
// Coins are instanced: one draw call per coin kind, so 250 standard coins cost one call. Prizes are
// small groups of primitives. Nothing here changes the simulation; it reads the board's items and
// interpolates between the last two physics steps so motion stays smooth at any frame rate.
//
// The look: physically based materials (metal that reflects a small arcade hall, rendered once per
// theme in art.js), coins with a raised rim and struck relief, brushed steel, a lacquered cabinet,
// a neon back panel and chasing bulbs. Colours are given in sRGB and converted, so they show as written.
import { CONFIG } from "./config.js";
import { THEMES, FIGURES } from "./themes.js";
import { gemRings } from "./shapes.js";
import * as Art from "./art.js";

const THREE = globalThis.THREE;
const KINDS = ["coin", "gold", "lucky", "bomb", "jackpot"];
const CAP = { coin: 300, gold: 80, lucky: 8, bomb: 20, jackpot: 4 };
const B = CONFIG.board, PW = CONFIG.pinWall;
const PANEL_TOP = PW.top + 2.3;   // the top of the back panel, above the pin wall's slots
const OUTER = B.width / 2 + 0.7;  // the inside of the cabinet's sides: the gutters run between the shelf and here
const MARQUEE = 1.5;              // the height of the lit sign on top of the cabinet
const lin = (c) => new THREE.Color(c).convertSRGBToLinear();

// ---- Coins ------------------------------------------------------------------------------------------------
/**
 * A coin with a raised rim, a recessed field and a rounded edge, turned around its axis. The faces
 * sample the heads/tails halves of the coin atlas (art.js), the edge samples the reeding strip.
 * Tails is mapped so it reads the right way up when a coin lands upside down.
 */
function coinGeometry(diameter, thickness, segs = 32) {
  const R = diameter / 2, H = thickness / 2, { S, strip } = Art.COIN_ATLAS, AW = S * 2, AH = S + strip;
  // The profile from the top centre, round the edge, to the bottom centre: [r, y] as shares of R and H.
  const P = [[0, 0.62], [0.83, 0.62], [0.87, 1], [0.955, 1], [1, 0.72], [1, -0.72], [0.955, -1], [0.87, -1], [0.83, -0.62], [0, -0.62]];
  const EDGE = 4;   // the band from P[4] to P[5] is the edge
  const pos = [], nor = [], uv = [];
  const uvFace = (x, z, top) => top
    ? [(S / 2 + (x / R) * (S / 2 - 1)) / AW, 1 - (S / 2 + (z / R) * (S / 2 - 1)) / AH]
    : [(S * 1.5 + (x / R) * (S / 2 - 1)) / AW, 1 - (S / 2 - (z / R) * (S / 2 - 1)) / AH];
  for (let k = 0; k < P.length - 1; k++) {
    const [r0, y0] = P[k], [r1, y1] = P[k + 1];
    let nr = -(y1 - y0) * R, ny = (r1 - r0) * H;     // the band's outward normal in the profile plane
    const l = Math.hypot(nr, ny); nr /= l; ny /= l;
    const top = (y0 + y1) / 2 > 0;
    for (let j = 0; j < segs; j++) {
      const quad = [[k, j], [k, j + 1], [k + 1, j + 1], [k + 1, j]].map(([kk, jj]) => {
        const a = (jj / segs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const r = P[kk][0] * R, y = P[kk][1] * H;
        const p = [r * c, y, r * s];
        const t = k === EDGE ? [jj / segs, (1 - S / AH) * (kk === EDGE ? 1 : 0)] : uvFace(p[0], p[2], top);
        return { p, n: [nr * c, ny, nr * s], t };
      });
      // Wind each triangle so it faces outward.
      const tri = (a, b, c) => {
        const u = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]], v = [c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]];
        const cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0];
        if (Math.abs(cx) + Math.abs(cy) + Math.abs(cz) < 1e-12) return;      // the centre of a face: degenerate
        const out = cx * a.n[0] + cy * a.n[1] + cz * a.n[2] > 0;
        for (const q of out ? [a, b, c] : [a, c, b]) { pos.push(...q.p); nor.push(...q.n); uv.push(...q.t); }
      };
      tri(quad[0], quad[1], quad[2]);
      tri(quad[0], quad[2], quad[3]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

function coinMaterial(kind) {
  const m = Art.coinMaps(kind);
  const mat = new THREE.MeshStandardMaterial({
    map: m.map, normalMap: m.normalMap, roughnessMap: m.ormMap, metalnessMap: m.ormMap,
    roughness: 1, metalness: 1, envMapIntensity: 0.95,
  });
  mat.normalScale.set(1.1, 1.1);
  if (kind === "lucky") mat.emissive = lin(0x0b3a18);
  if (kind === "jackpot") mat.emissive = lin(0x2a1400);
  return mat;
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

// ---- Figures from their part lists (themes.js) ----------------------------------------------------------
const geoCache = new Map(), matCache = new Map();
function partGeometry(p) {
  const key = JSON.stringify([p[0], p[1], p[4] && p[4].half]);
  if (geoCache.has(key)) return geoCache.get(key);
  let g;
  const s = p[1];
  if (p[0] === "sph") g = new THREE.SphereGeometry(s, 16, 12);
  else if (p[0] === "box") g = new THREE.BoxGeometry(s[0], s[1], s[2]);
  else if (p[0] === "cyl") g = new THREE.CylinderGeometry(s[0], s[1], s[2], 18, 1, false, 0, p[4] && p[4].half ? Math.PI : Math.PI * 2);
  else if (p[0] === "cone") g = new THREE.ConeGeometry(s[0], s[1], 18);
  else g = new THREE.TorusGeometry(s[0], s[1], 10, 24, s[2] || Math.PI * 2);
  geoCache.set(key, g);
  return g;
}
/** Figures are glossy painted toys: a little clear-coat shine from the room's reflections. */
function partMaterial(colour, o = {}) {
  const key = colour + (o.glow ? "g" : "") + (o.clear ? "c" : "");
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: lin(colour), roughness: 0.32, metalness: 0.05, envMapIntensity: 0.9 });
  if (o.glow) m.emissive = lin(colour).multiplyScalar(0.7);
  if (o.clear) { m.transparent = true; m.opacity = 0.78; m.roughness = 0.05; }
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
/** A gem: faceted, glassy, with an inner glow, so it reads as a jewel among the coins. */
export function buildGem(theme, colour) {
  if (!gemGeoCache.has(colour)) gemGeoCache.set(colour, gemGeometry(colour));
  const c = lin((THEMES[theme] || THEMES.classic).gems[colour]);
  const m = new THREE.MeshStandardMaterial({ color: c, emissive: c.clone().multiplyScalar(0.35), roughness: 0.04, metalness: 0.25, flatShading: true, transparent: true, opacity: 0.92, envMapIntensity: 2.6 });
  const mesh = new THREE.Mesh(gemGeoCache.get(colour), m);
  mesh.castShadow = true;
  return mesh;
}

// ---- The renderer --------------------------------------------------------------------------------------------
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.gl.setPixelRatio(this.dpr);
    this.gl.outputEncoding = THREE.sRGBEncoding;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 120);
    this.theme = null;
    this.type = "classic";
    this.quality = 0;          // index into config.performance.particleLevels; the last level also lowers the resolution
    this.shakeAmp = 0;
    this.shakeOn = true;
    this.prizeMeshes = new Map();
    this.ghosts = [];          // coins leaving the board: still drawn for a moment as they drop and shrink
    this.parts = [];           // particles
    this.view = { w: 1, h: 1, top: 0, bottom: 0 };
    // The camera (resize): the horizontal field of view it aims for, the limits on the vertical one, how
    // far it looks down (degrees), the point it looks at ([y, z]) and where spare height goes (0 all
    // below the machine, 1 all above it), per machine.
    this.lens = {
      hfov: 54, fovMin: 50, fovMax: 76,
      pitchPins: 28, targetPins: [2.8, -1], anchorPins: 0.5,
      pitchClassic: 34, targetClassic: [0.8, 0], anchorClassic: 0.8,
    };
    this.tmpM = new THREE.Matrix4(); this.tmpP = new THREE.Vector3(); this.tmpQ = new THREE.Quaternion(); this.tmpS = new THREE.Vector3(1, 1, 1);
    this.tmpC = new THREE.Color();
    this.build();
    active = this;   // thumbnails are drawn with this renderer
  }

  build() {
    const s = this.scene, W = B.width, D = B.depth, back = -D / 2;
    // Light: the room's reflections do most of it (scene.environment, set per theme); a warm key light
    // casts the shadows, a cool fill keeps the shadow side readable, and two neon lights by the back panel.
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x1a1820, 0.35);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff0dc, 1.7);
    sun.position.set(-3, 15, 9);
    sun.target.position.set(0, 0, 0.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -6; sc.right = 6; sc.top = 9; sc.bottom = -8; sc.near = 4; sc.far = 32;
    sun.shadow.bias = -0.0008;
    s.add(sun, sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xc8dcff, 0.45);
    fill.position.set(7, 5, 12);
    s.add(fill);
    this.neonLights = [-1, 1].map((sx) => { const l = new THREE.PointLight(0xffffff, 0.9, 11, 2); l.position.set(sx * 2.4, 3.2, back + 0.8); s.add(l); return l; });
    this.feverLight = new THREE.PointLight(0xffcc33, 0, 18);
    this.feverLight.position.set(0, 6, 1);
    s.add(this.feverLight);

    const steel = Art.brushed(7);
    const Std = (o) => new THREE.MeshStandardMaterial(o);
    this.mats = {
      shelf: Std({ color: lin(0xd4d9e0), map: steel.map, roughnessMap: steel.roughnessMap, metalness: 0.9, roughness: 0.55, envMapIntensity: 1 }),
      steel: Std({ color: lin(0xc9ced6), map: steel.map, roughnessMap: steel.roughnessMap, metalness: 0.9, roughness: 0.5 }),
      chrome: Std({ color: lin(0xf0f3f7), metalness: 1, roughness: 0.12 }),
      brass: Std({ color: lin(0xe6b04a), metalness: 1, roughness: 0.22 }),
      lacquer: Std({ color: 0xffffff, metalness: 0.05, roughness: 0.38, envMapIntensity: 0.35 }),
      trim: Std({ color: 0xffffff, metalness: 1, roughness: 0.2 }),
      dark: Std({ color: lin(0x09080c), roughness: 0.9, metalness: 0, envMapIntensity: 0.25 }),
      rubber: Std({ color: lin(0xd22a3a), roughness: 0.5, metalness: 0 }),
      panel: Std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.18, metalness: 0.1 }),
      marquee: Std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1 }),
      pusherFront: Std({ color: 0xffffff, metalness: 0.2, roughness: 0.3 }),
      glass: Std({ color: lin(0xdfefff), transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0, envMapIntensity: 2.2, depthWrite: false }),
      led: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      wide: new THREE.MeshBasicMaterial({ color: 0x7cf7ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    };
    steel.map.repeat.set(1.5, 2);
    steel.roughnessMap.repeat.set(1.5, 2);
    const box = (w, h, d, mat, x, y, z, o = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = o.receive !== false;
      m.castShadow = !!o.cast;
      (o.to || s).add(m);
      return m;
    };
    const rod = (r, len, mat, x, y, z, axis, to = s) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), mat);
      if (axis === "x") m.rotation.z = Math.PI / 2; else if (axis === "z") m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z);
      to.add(m);
      return m;
    };

    // The shelf (brushed steel) ends exactly where the physics shelf does, with a chrome lip on its front edge.
    const front = D / 2, shelfBack = back - B.stroke - 2, d = this.mats.dark;
    box(W, 1, front - shelfBack, [d, d, this.mats.shelf, d, d, d], 0, -0.5, (front + shelfBack) / 2);
    rod(0.06, W + 0.1, this.mats.chrome, 0, -0.03, front, "x");
    // Where coins leave the board. Over the front edge (won): the payout chute, a dark drop, with a gold
    // light along the shelf's front. Off the open sides in front of the rails (lost): the gutters, dark pits
    // with a red light along their outer wall. So it's clear where a coin will go.
    const GUT = OUTER - W / 2, chute = 0.9, pitY = -2.4;
    box(2 * OUTER, 0.2, chute, d, 0, pitY, front + chute / 2, { receive: false });
    this.mats.win = new THREE.MeshBasicMaterial({ color: lin(0xffc23d), toneMapped: false });
    this.mats.lose = new THREE.MeshBasicMaterial({ color: lin(0xff2a3c), toneMapped: false });
    box(W - 0.2, 0.1, 0.02, this.mats.win, 0, -0.18, front + 0.01, { receive: false });
    const gutFrom = B.sideOpenFrom, gutLen = front - gutFrom;
    for (const sx of [-1, 1]) {
      box(GUT, 0.2, gutLen + chute, d, sx * (W / 2 + GUT / 2), pitY, gutFrom + (gutLen + chute) / 2, { receive: false });
      box(0.04, -pitY, front + chute - shelfBack, d, sx * (OUTER - 0.02), pitY / 2, (front + chute + shelfBack) / 2, { receive: false });
      box(0.03, 0.13, gutLen + chute, this.mats.lose, sx * (OUTER - 0.05), -0.1, gutFrom + (gutLen + chute) / 2, { receive: false });
    }
    // The front apron below the chute: lacquer with a trim rod and bulbs, a little below the shelf so the
    // chute shows.
    box(2 * OUTER + 0.9, 3, 0.4, this.mats.lacquer, 0, -1.85, front + chute + 0.2);
    rod(0.07, 2 * OUTER + 0.9, this.mats.trim, 0, -0.33, front + chute + 0.4, "x");
    // The rails: solid lacquered walls with a chrome cap, from the back to where the gutters open, filling
    // the width of the gutter so nothing shows behind them. A chrome post ends each one: in front of it coins
    // can fall off the side.
    const railFrom = shelfBack, railLen = gutFrom - railFrom;
    for (const sx of [-1, 1]) {
      box(GUT, B.railHeight + 1, railLen, this.mats.lacquer, sx * (W / 2 + GUT / 2), (B.railHeight - 1) / 2, railFrom + railLen / 2);
      rod(0.06, railLen, this.mats.chrome, sx * (W / 2 + 0.05), B.railHeight, railFrom + railLen / 2, "z");
      box(0.04, 0.05, railLen, this.mats.led, sx * (W / 2 + 0.005), B.railHeight - 0.12, railFrom + railLen / 2, { receive: false });
      const post = rod(GUT / 2, B.railHeight + 0.2, this.mats.chrome, sx * (W / 2 + GUT / 2), B.railHeight / 2 + 0.1, gutFrom, "y");
      post.castShadow = true;
    }
    // The cabinet sides beyond the gutters: tall at the back, sloping down toward the player, with a trim
    // rod along the top.
    const sideBack = back - 1.2, sideFront = front + chute + 0.4, hBack = 4.2, hFront = 1.1, foot = -3.4;
    const shape = new THREE.Shape([[sideBack, foot], [sideFront, foot], [sideFront, hFront], [sideBack, hBack]].map(([u, v]) => new THREE.Vector2(u, v)));
    const sideGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false });
    sideGeo.rotateY(-Math.PI / 2);   // the shape's x runs along z; it extrudes toward -x
    const slope = Math.atan2(hBack - hFront, sideFront - sideBack), slopeLen = Math.hypot(hBack - hFront, sideFront - sideBack);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(sideGeo, this.mats.lacquer);
      m.position.x = sx > 0 ? OUTER + 0.45 : -OUTER;
      m.receiveShadow = true;
      s.add(m);
      const r = rod(0.09, slopeLen, this.mats.trim, sx * (OUTER + 0.22), (hBack + hFront) / 2, (sideBack + sideFront) / 2, "z");
      r.rotation.x = Math.PI / 2 + slope;
    }
    // The back wall above the pusher, with a steel lip where riders are swept off, and the neon panel above it.
    const wallBottom = B.pusherHeight + 0.04, panelTop = PANEL_TOP;
    box(W + 2.2, panelTop + 2, 0.4, this.mats.dark, 0, panelTop / 2 - 1, back - 0.45);
    box(W, 0.36, 0.32, this.mats.steel, 0, wallBottom + 0.18, back - 0.16);
    rod(0.04, W, this.mats.chrome, 0, wallBottom + 0.36, back, "x");
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, panelTop - wallBottom - 0.36), this.mats.panel);
    this.panel.position.set(0, (panelTop + wallBottom + 0.36) / 2, back - 0.01);
    s.add(this.panel);
    // The top of the back panel: a chrome header with a row of chasing bulbs, and the marquee above it.
    box(W + 2.2, 0.5, 0.7, this.mats.lacquer, 0, panelTop + 0.25, back - 0.1);
    rod(0.06, W + 2.2, this.mats.trim, 0, panelTop, back + 0.25, "x");
    box(W + 2.2, MARQUEE, 0.5, this.mats.lacquer, 0, panelTop + 0.5 + MARQUEE / 2, back - 0.2);
    this.marquee = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.6, MARQUEE - 0.24), this.mats.marquee);
    this.marquee.position.set(0, panelTop + 0.5 + MARQUEE / 2, back + 0.06);
    s.add(this.marquee);
    rod(0.07, W + 2.2, this.mats.trim, 0, panelTop + 0.5 + MARQUEE, back + 0.05, "x");
    // The Wide Shelf panels: glowing covers over the gutters while the event lasts.
    for (const sx of [-1, 1]) {
      const openLen = D / 2 - B.sideOpenFrom;
      const w = box(0.08, B.railHeight, openLen, this.mats.wide, sx * (W / 2 + 0.05), B.railHeight / 2, B.sideOpenFrom + openLen / 2, { receive: false });
      w.renderOrder = 3;
    }

    // Bulbs: along the header, down the sloping tops of the cabinet sides and along the front apron. One
    // instanced mesh; the colours chase in render().
    const bulbAt = [];
    for (let i = 0; i < 17; i++) bulbAt.push([-W / 2 - 0.6 + (i / 16) * (W + 1.2), panelTop + 0.25, back + 0.27]);
    for (const sx of [-1, 1]) for (let i = 0; i < 12; i++) {
      const k = (i + 0.5) / 12;
      bulbAt.push([sx * (OUTER + 0.22), hBack + (hFront - hBack) * k + 0.14, sideBack + (sideFront - sideBack) * k]);
    }
    for (let i = 0; i < 15; i++) bulbAt.push([-OUTER + (i / 14) * 2 * OUTER, -0.33, front + chute + 0.48]);
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbAt.length);
    bulbAt.forEach((p, i) => { this.tmpM.makeTranslation(p[0], p[1], p[2]); this.bulbs.setMatrixAt(i, this.tmpM); this.bulbs.setColorAt(i, this.tmpC.set(0xffffff)); });
    this.bulbs.frustumCulled = false;
    s.add(this.bulbs);

    // The pusher: brushed steel with a lacquered, striped front plate and a light strip along its top edge.
    const pl = B.stroke + 2.2;
    this.pusherLen = pl;
    const top = Std({ color: lin(0x80868f), map: steel.map, roughnessMap: steel.roughnessMap, metalness: 1, roughness: 0.4 });
    this.pusher = new THREE.Mesh(new THREE.BoxGeometry(W - 0.01, B.pusherHeight, pl),
      [this.mats.steel, this.mats.steel, top, this.mats.steel, this.mats.pusherFront, this.mats.steel]);
    this.pusher.castShadow = true; this.pusher.receiveShadow = true;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.05, 0.03), this.mats.led);
    strip.position.set(0, B.pusherHeight / 2 - 0.06, pl / 2 + 0.016);
    this.pusher.add(strip);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, W - 0.02, 12), this.mats.chrome);
    lip.rotation.z = Math.PI / 2; lip.position.set(0, B.pusherHeight / 2, pl / 2);
    this.pusher.add(lip);
    s.add(this.pusher);

    this.buildPinWall();
    this.buildRail();

    // Coins: one instanced mesh per kind.
    this.coinMeshes = {};
    const C = CONFIG.coin;
    const geoStd = coinGeometry(1, C.thickness), geoBig = coinGeometry(C.jackpotDiameter, C.jackpotThickness, 48);
    for (const k of KINDS) {
      const im = new THREE.InstancedMesh(k === "jackpot" ? geoBig : geoStd, coinMaterial(k), CAP[k]);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = true; im.receiveShadow = true;
      s.add(im);
      this.coinMeshes[k] = im;
    }

    // Aim: a see-through coin where the next one will drop, a thin guide line and a ring on the shelf.
    const ghostMat = coinMaterial("coin");
    ghostMat.transparent = true; ghostMat.opacity = 0.5; ghostMat.depthWrite = false;
    ghostMat.emissive = lin(0x6a4400);
    this.ghost = new THREE.Mesh(geoStd, ghostMat);
    this.guide = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1, 0.025), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.marker.rotation.x = -Math.PI / 2;
    s.add(this.ghost, this.guide, this.marker);

    // Particles: twinkling sparkles.
    this.maxParts = 500;
    const pg = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.maxParts * 3);
    this.pCol = new Float32Array(this.maxParts * 3);
    pg.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute("color", new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.34, map: Art.sparkle(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.points.frustumCulled = false;
    s.add(this.points);
  }

  /** The pin wall machine's parts: brass pins, rubber bumpers, the glass, its frame and the three slots. */
  buildPinWall() {
    const g = this.pinGroup = new THREE.Group(), W = B.width, back = -B.depth / 2;
    const glassZ = PW.z + 0.16, depth = glassZ - back;
    const pins = this.pinPositions();
    const pinGeo = new THREE.CylinderGeometry(PW.pinRadius, PW.pinRadius, depth, 12);
    pinGeo.rotateX(Math.PI / 2);
    const capGeo = new THREE.SphereGeometry(PW.pinRadius * 1.6, 12, 8);
    const pinMesh = new THREE.InstancedMesh(pinGeo, this.mats.brass, pins.length);
    const capMesh = new THREE.InstancedMesh(capGeo, this.mats.brass, pins.length);
    pins.forEach(([x, y], i) => {
      pinMesh.setMatrixAt(i, this.tmpM.makeTranslation(x, y, back + depth / 2));
      capMesh.setMatrixAt(i, this.tmpM.makeTranslation(x, y, back + 0.02));
    });
    pinMesh.castShadow = true;
    g.add(pinMesh, capMesh);
    for (const r of PW.bumpers) {
      for (const sx of [-1, 1]) {
        const y = PW.rowTop - r * PW.rowGap;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(PW.bumperRadius, PW.bumperRadius, depth, 20, 1, false, sx > 0 ? Math.PI : 0, Math.PI), this.mats.rubber);
        b.rotation.x = Math.PI / 2;
        b.position.set(sx * W / 2, y, back + depth / 2);
        g.add(b);
      }
    }
    const h = PW.top + 1 - PW.bottom, cy = (PW.top + 1 + PW.bottom) / 2;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, h), this.mats.glass);
    glass.position.set(0, cy, glassZ + 0.02);
    glass.renderOrder = 2;
    g.add(glass);
    // The frame: lacquered columns at the sides, a chrome strip along the bottom edge of the glass.
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.5), this.mats.lacquer);
      c.position.set(sx * (W / 2 + 0.17), cy, back + 0.2);
      g.add(c);
    }
    const bottomBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, W, 12), this.mats.chrome);
    bottomBar.rotation.z = Math.PI / 2; bottomBar.position.set(0, PW.bottom, glassZ + 0.04);
    g.add(bottomBar);
    // The slot plate across the top, with an opening and a light for each slot.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 0.68, 0.42, 0.62), this.mats.lacquer);
    plate.position.set(0, PW.top + 0.75, PW.z + 0.05);
    g.add(plate);
    for (const y of [PW.top + 0.96, PW.top + 0.54]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, W + 0.68, 12), this.mats.trim);
      r.rotation.z = Math.PI / 2; r.position.set(0, y, PW.z + 0.37);
      g.add(r);
    }
    // Each slot: a dark opening with a light strip in it (lit for the chosen slot) and an arrow above.
    this.slotLights = PW.slots.map((x) => {
      const hole = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.02), this.mats.dark);
      hole.position.set(x, PW.top + 0.75, PW.z + 0.37);
      const light = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.07), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      light.position.set(x, PW.top + 0.75, PW.z + 0.385);
      const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ color: 0xffffff, map: arrowTexture(), transparent: true, toneMapped: false }));
      arrow.position.set(x, PW.top + 1.2, PW.z + 0.37);
      light.userData.arrow = arrow;
      g.add(hole, light, arrow);
      return light;
    });
    this.scene.add(g);
  }

  /** The classic machine's drop rail: a chrome bar the see-through coin hangs under while you aim. */
  buildRail() {
    const g = this.railGroup = new THREE.Group(), W = B.width;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W + 0.6, 16), this.mats.chrome);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, B.dropHeight + 0.62, B.dropZ);
    g.add(bar);
    this.carriage = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), this.mats.trim);
    this.carriage.position.set(0, B.dropHeight + 0.62, B.dropZ);
    g.add(this.carriage);
    this.scene.add(g);
  }

  pinPositions() {
    const out = [];
    PW.rows.forEach((row, r) => { for (const x of row) out.push([x, PW.rowTop - r * PW.rowGap]); });
    return out;
  }

  setTheme(id) {
    if (this.theme === id) return;
    this.theme = id;
    const T = THEMES[id] || THEMES.classic;
    this.scene.background = lin(T.bg);
    this.scene.fog = new THREE.Fog(lin(T.bg), 30, 70);
    if (this.scene.environment) this.scene.environment.dispose();
    this.scene.environment = Art.environment(this.gl, T.neon);
    this.mats.lacquer.color.copy(lin(T.cabinet));
    this.mats.trim.color.copy(lin(T.trim));
    this.mats.pusherFront.map = Art.stripes(hexCss(T.pusherFace), hexCss(T.pusher));
    this.mats.pusherFront.needsUpdate = true;
    const art = Art.neonPanel(T);
    const sign = Art.marquee(T, 640, 96);
    for (const k of ["map", "emissiveMap"]) {
      if (this.mats.panel[k]) this.mats.panel[k].dispose();
      this.mats.panel[k] = art[k];
      if (this.mats.marquee[k]) this.mats.marquee[k].dispose();
      this.mats.marquee[k] = sign[k];
    }
    this.mats.panel.needsUpdate = this.mats.marquee.needsUpdate = true;
    this.mats.led.color.copy(lin(T.bulbs));
    this.mats.wide.color.copy(lin(T.bulbs));
    this.neonLights.forEach((l, i) => l.color.copy(lin(T.neon[i])));
    this.feverLight.color.copy(lin(T.bulbs));
    this.bulbColor = lin(T.bulbs);
    this.slotColor = lin(T.neon[1]);
    for (const m of this.prizeMeshes.values()) this.scene.remove(m.obj);
    this.prizeMeshes.clear();   // rebuilt with the new theme's figures and gem colours on the next frame
  }

  /** Show the pin wall or the drop rail, and frame the camera for that machine. */
  setMachine(type) {
    this.type = type === "pins" ? "pins" : "classic";
    this.pinGroup.visible = this.type === "pins";
    this.railGroup.visible = this.type === "classic";
    const v = this.view;
    if (v.w > 1) this.resize(v.w, v.h, v.top, v.bottom);
  }

  setQuality(level) {
    const n = CONFIG.performance.particleLevels.length;
    this.quality = Math.max(0, Math.min(n - 1, level));
    // On the slowest level, also draw fewer pixels.
    const ratio = this.quality === n - 1 ? Math.min(this.dpr, 1.25) : this.dpr;
    if (ratio !== this.gl.getPixelRatio()) { this.gl.setPixelRatio(ratio); this.gl.setSize(this.view.w, this.view.h, false); }
  }

  /**
   * Fit the machine to the screen between the top bar and the controls, the way a player stands at a
   * real pusher: a wide lens, low and close to the front edge, so the shelf runs away from you in
   * perspective (near coins big, far ones small) and the back wall faces you at the top. The front edge
   * with its chute and the open gutters fill the width; the cabinet's sides may run off the screen.
   * Landscape letterboxes.
   */
  resize(w, h, top = 0, bottom = 0) {
    this.view = { w, h, top, bottom };
    this.gl.setSize(w, h, false);
    const cam = this.camera, pins = this.type === "pins", L = this.lens;
    const usableH = Math.max(100, h - top - bottom * 0.55);
    // The lens: wide across the board whatever the screen's shape, within limits.
    const hfov = L.hfov * Math.PI / 180, aspect = w / usableH;
    cam.fov = Math.max(L.fovMin, Math.min(L.fovMax, 2 * Math.atan(Math.tan(hfov / 2) / Math.min(aspect, 1)) * 180 / Math.PI));
    cam.aspect = w / h;
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    const tilt = (pins ? L.pitchPins : L.pitchClassic) * Math.PI / 180;
    const target = new THREE.Vector3(0, pins ? L.targetPins[0] : L.targetClassic[0], pins ? L.targetPins[1] : L.targetClassic[1]);
    const dir = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt));
    const X = OUTER + 0.1, back = -B.depth / 2, front = B.depth / 2, topY = pins ? PANEL_TOP + 0.6 + MARQUEE : B.dropHeight + 2.4;
    // The front edge and its gutters fill the width (the apron below may run off the sides); the height
    // runs from the apron's top to the top of the back.
    const pts = [[-X, 0, front], [X, 0, front], [0, -0.35, front + 0.9], [-B.width / 2, topY, back], [B.width / 2, topY, back]].map((p) => new THREE.Vector3(...p));
    const bounds = () => {
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) { const v = this.tmpP.copy(p).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      return { x0, x1, y0, y1 };
    };
    let lo = 3, hi = 120;
    for (let i = 0; i < 32; i++) {
      const d = (lo + hi) / 2;
      cam.position.copy(target).addScaledVector(dir, d);
      const b = bounds();
      const fits = b.x1 - b.x0 <= 2 * 0.985 && ((b.y1 - b.y0) / 2) * h <= usableH;
      if (fits) hi = d; else lo = d;
    }
    cam.position.copy(target).addScaledVector(dir, hi);
    const b = bounds();
    // Shift the picture into the space between the top bar and the controls. Room to spare goes above and
    // below by the machine's anchor: the free drop sits low, so its short back doesn't leave a tall apron.
    const centre = ((1 - (b.y0 + b.y1) / 2) / 2) * h, contentH = ((b.y1 - b.y0) / 2) * h;
    const anchor = pins ? L.anchorPins : L.anchorClassic;
    cam.setViewOffset(w, h, 0, centre - (top + (usableH - contentH) * anchor + contentH / 2), w, h);
    cam.updateProjectionMatrix();
    this.baseCamPos = cam.position.clone();
  }

  /** Screen point of a world point, in CSS pixels. */
  toScreen(x, y, z) {
    const v = this.tmpP.set(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * this.view.w, y: (1 - v.y) / 2 * this.view.h };
  }

  /** The aim (shelf x) under a screen x: the see-through coin sits right above the finger. */
  aimFromScreen(px) {
    if (this.type === "pins") {
      const s = PW.slots, a = this.toScreen(s[0], PW.top, PW.z).x, b = this.toScreen(s[s.length - 1], PW.top, PW.z).x;
      return s[0] + ((px - a) / (b - a)) * (s[s.length - 1] - s[0]);
    }
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
    const c = lin(colour);
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

    // Aim. Classic: a see-through coin under the rail, a guide line and a ring where it lands.
    // Pin wall: the chosen slot's arrow lights up and the see-through coin waits above it, on its edge.
    const t = o.time || 0;
    const show = !!o.showAim, x = o.aim || 0;
    this.ghost.visible = show;
    this.guide.visible = this.marker.visible = show && this.type === "classic";
    if (this.type === "classic") {
      this.carriage.position.x = x;
      if (show) {
        this.ghost.rotation.set(0, 0, 0);
        this.ghost.position.set(x, B.dropHeight, B.dropZ);
        const bottom = B.pusherHeight + 0.02;
        this.guide.scale.y = B.dropHeight - bottom;
        this.guide.position.set(x, (B.dropHeight + bottom) / 2, B.dropZ);
        this.marker.position.set(x, bottom, B.dropZ);
      }
    } else {
      this.ghost.rotation.set(Math.PI / 2, 0, 0);
      this.ghost.position.set(x, PW.top + 1.85, PW.z + 0.2);
      this.slotLights.forEach((l, i) => {
        const on = show && Math.abs(PW.slots[i] - x) < 0.01;
        const k = on ? 1.6 + 0.6 * Math.sin(t * 6) : 0.18;
        l.material.color.copy(this.slotColor || this.tmpC.set(0xffffff)).multiplyScalar(k);
        l.userData.arrow.material.color.copy(l.material.color);
        l.userData.arrow.visible = on;
      });
    }

    // Wide Shelf panels and the fever glow (a smooth pulse, about once a second: no flashing).
    this.mats.wide.opacity = o.wide ? 0.22 + 0.08 * Math.sin(t * 3) : 0;
    const fever = o.fever || 0;
    this.feverLight.intensity = fever * (1.2 + 0.6 * Math.sin(t * Math.PI * 2));
    this.mats.panel.emissiveIntensity = 1.5 + fever * 0.8 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
    const n = this.bulbs.count, base = this.bulbColor || lin(0xffd166);
    for (let i = 0; i < n; i++) {
      const wave = 0.5 + 0.5 * Math.sin(t * (fever ? 5 : 2.2) - i * 0.9);
      this.bulbs.setColorAt(i, this.tmpC.copy(base).multiplyScalar(0.25 + 1.6 * wave * wave));
    }
    this.bulbs.instanceColor.needsUpdate = true;

    // Particles.
    let np = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy -= 9 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = (1 - p.life / p.max) * (0.75 + 0.25 * Math.sin(p.life * 40 + i));
      this.pPos[np * 3] = p.x; this.pPos[np * 3 + 1] = p.y; this.pPos[np * 3 + 2] = p.z;
      this.pCol[np * 3] = p.r * k * 1.6; this.pCol[np * 3 + 1] = p.g * k * 1.6; this.pCol[np * 3 + 2] = p.b * k * 1.6;
      np++;
    }
    this.points.geometry.setDrawRange(0, np);
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

const hexCss = (c) => "#" + c.toString(16).padStart(6, "0");

let arrowTex = null;
/** A downward arrow, for the lights above the pin wall's slots. */
function arrowTexture() {
  if (arrowTex) return arrowTex;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 40;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.shadowColor = "#fff"; g.shadowBlur = 6;
  g.beginPath(); g.moveTo(12, 8); g.lineTo(52, 8); g.lineTo(32, 32); g.closePath(); g.fill();
  arrowTex = new THREE.CanvasTexture(c);
  return arrowTex;
}

// ---- Thumbnails for the collection and the Workshop ------------------------------------------------------
// Drawn by the game's own renderer into an off-screen target, lit by the machine's reflections. A second
// WebGL renderer would have to build its own reflection map first, which froze the first Workshop or
// collection screen for a moment (seconds on a slow phone).
let thumb = null, active = null;
const TS = 160, SS = 2;   // thumbnail size in pixels, drawn this many times larger and scaled down (smooth edges)
/** The picture of a collection item if it has been drawn already, else null. */
export const cachedThumbnail = (theme, index) => (thumb && thumb.cache.get(theme + ":" + index)) || null;
/** A small picture of a collection item (index 0–3 gems, 4–11 figures), as a data URL. */
export function thumbnail(theme, index) {
  if (!thumb) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 0.6));
    const d = new THREE.DirectionalLight(0xffffff, 1.4);
    d.position.set(-2, 3, 4);
    scene.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 0.55, 2.2);
    cam.lookAt(0, 0, 0);
    const N = TS * SS, rt = new THREE.WebGLRenderTarget(N, N);
    rt.texture.encoding = THREE.sRGBEncoding;
    const big = document.createElement("canvas"), out = document.createElement("canvas");
    big.width = big.height = N; out.width = out.height = TS;
    thumb = { scene, cam, rt, big, out, px: new Uint8Array(N * N * 4), cache: new Map() };
  }
  const key = theme + ":" + index;
  if (thumb.cache.has(key)) return thumb.cache.get(key);
  const gl = active.gl, N = TS * SS;
  thumb.scene.environment = active.scene.environment;
  const obj = index < 4 ? buildGem(theme, ["red", "blue", "green", "yellow"][index]) : buildFigure(theme, index - 4, 1);
  if (index < 4) { obj.scale.setScalar(1.05); obj.rotation.set(0.5, 0.4, 0); }
  else obj.rotation.y = -0.45;
  thumb.scene.add(obj);
  const clear = gl.getClearColor(new THREE.Color()), alpha = gl.getClearAlpha(), exposure = gl.toneMappingExposure;
  gl.setRenderTarget(thumb.rt);
  gl.setClearColor(0x000000, 0);
  gl.toneMappingExposure = 1.2;
  gl.clear();
  gl.render(thumb.scene, thumb.cam);
  gl.readRenderTargetPixels(thumb.rt, 0, 0, N, N, thumb.px);
  gl.setRenderTarget(null);
  gl.setClearColor(clear, alpha);
  gl.toneMappingExposure = exposure;
  thumb.scene.remove(obj);
  // WebGL reads bottom up; flip into the canvas, then scale down.
  const img = new ImageData(N, N), row = N * 4;
  for (let y = 0; y < N; y++) img.data.set(thumb.px.subarray((N - 1 - y) * row, (N - y) * row), y * row);
  thumb.big.getContext("2d").putImageData(img, 0, 0);
  const g = thumb.out.getContext("2d");
  g.clearRect(0, 0, TS, TS);
  g.imageSmoothingQuality = "high";
  g.drawImage(thumb.big, 0, 0, TS, TS);
  const url = thumb.out.toDataURL("image/png");
  thumb.cache.set(key, url);
  return url;
}
