// Draws a World with three.js (r128, the global THREE from shared/vendor). Top-down, orthographic.
//
// World units are cells: three.js x = cell x, three.js y = -cell y (the grid's y points down).
//
// Land: the owner grid is a tiny texture (one texel per cell). On every change, a shader turns it
// into a smooth picture of the land at RES pixels per cell (render target `landRT`): it weighs a
// 4 × 4 neighbourhood of cells with a smooth (B-spline) kernel and paints each pixel in the colour
// of the heaviest owner, so blocky cells become rounded shapes. Its alpha holds that owner's smooth
// weight rather than a hard edge, so the plane that shows it every frame can cut it at 0.5 and stay
// crisp however far the picture is stretched; that pass also adds the darker "side" under every
// patch of land, which gives it a little height. Only the part that changed is redrawn (a scissor
// rectangle).
//
// Trails are ribbons that grow as the path grows; heads are small ink blobs with eyes.
const THREE = window.THREE;
const RES = 5;               // land picture: pixels per cell
const SIDE = 0.45;           // height of the land's side, in cells
const PAPER = 0xf7f3ea, DOT = 0xe2dac8, DESK = 0x2b3441, RIM = 0x1d242e;
const VIEW = 30;             // cells across the shorter side of the screen

const hex = (c) => new THREE.Color(c);
function shade(c, f) { const k = hex(c); return k.multiplyScalar(f); }
function tint(c, f) { const k = hex(c); return k.lerp(new THREE.Color(0xffffff), f); }

const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const LAND_FS = `
precision highp float;
uniform sampler2D own;
uniform sampler2D pal;
uniform float N;
uniform vec3 paper;
varying vec2 vUv;
float idAt(vec2 c) {
  if (c.x < 0.0 || c.y < 0.0 || c.x >= N || c.y >= N) return 0.0;
  return floor(texture2D(own, (c + 0.5) / N).r * 255.0 + 0.5);
}
float bs(float t) {
  t = abs(t);
  if (t < 1.0) return (4.0 - 6.0 * t * t + 3.0 * t * t * t) / 6.0;
  if (t < 2.0) { float u = 2.0 - t; return u * u * u / 6.0; }
  return 0.0;
}
vec3 colour(float id) { return texture2D(pal, vec2((id + 0.5) / 16.0, 0.5)).rgb; }
// At point g (in cells): the colour of the heaviest owner among the four nearest cells (nobody
// doesn't count), and that owner's smoothed weight. The weight runs smoothly from 1 inside the
// land to 0 outside, so the final pass can cut it at 0.5 with a crisp edge at any zoom.
void main() {
  vec2 g = vec2(vUv.x * N, (1.0 - vUv.y) * N);
  vec2 p = g - 0.5;
  vec2 b = floor(p);
  vec2 f = p - b;
  float c0 = idAt(b), c1 = idAt(b + vec2(1.0, 0.0)), c2 = idAt(b + vec2(0.0, 1.0)), c3 = idAt(b + vec2(1.0, 1.0));
  if (c0 == c1 && c0 == c2 && c0 == c3) {
    // The inner four always outweigh the rest; no land near: paper.
    gl_FragColor = c0 > 0.5 ? vec4(colour(c0), 1.0) : vec4(paper, 0.0);
    return;
  }
  float w0 = 0.0, w1 = 0.0, w2 = 0.0, w3 = 0.0;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(float(i - 1), float(j - 1));
      float id = idAt(b + o);
      float w = bs(o.x - f.x) * bs(o.y - f.y);
      if (id == c0) w0 += w;
      if (id == c1) w1 += w;
      if (id == c2) w2 += w;
      if (id == c3) w3 += w;
    }
  }
  float best = 0.0, bw = 0.0;
  if (c0 > 0.5 && w0 > bw) { best = c0; bw = w0; }
  if (c1 > 0.5 && w1 > bw) { best = c1; bw = w1; }
  if (c2 > 0.5 && w2 > bw) { best = c2; bw = w2; }
  if (c3 > 0.5 && w3 > bw) { best = c3; bw = w3; }
  gl_FragColor = best > 0.5 ? vec4(colour(best), bw) : vec4(paper, 0.0);
}`;

// Every frame: cut the smooth weight at 0.5 (crisp at any zoom), and draw the darker side under
// each patch of land: where the land just north of here is a different colour, or there's no land here.
const SHOW_FS = `
precision highp float;
uniform sampler2D land;
uniform float shift;
varying vec2 vUv;
float cut(float a) { float e = fwidth(a) * 0.7 + 0.002; return smoothstep(0.5 - e, 0.5 + e, a); }
void main() {
  vec4 c = texture2D(land, vUv);
  vec4 u = texture2D(land, vUv + vec2(0.0, shift));
  float top = cut(c.a);
  float above = cut(u.a);
  float other = step(0.12, distance(u.rgb, c.rgb));
  float sideMask = above * max(1.0 - top, other);
  vec3 col = mix(c.rgb, u.rgb * 0.72, sideMask);
  gl_FragColor = vec4(col, max(top, sideMask));
}`;

const BOARD_FS = `
precision highp float;
uniform vec3 paper;
uniform vec3 dot;
varying vec2 vUv;
uniform float N;
void main() {
  vec2 g = vUv * N;
  vec2 q = fract(g / 4.0) - 0.5;
  float d = length(q * 4.0);
  float a = 1.0 - smoothstep(0.12, 0.2, d);
  gl_FragColor = vec4(mix(paper, dot, a), 1.0);
}`;
const BOARD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** A trail: a flat ribbon through the path points, then on to the head. */
class Ribbon {
  constructor(color, cap = 4096) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 2 * 3);
    const idx = new Uint16Array((cap - 1) * 6);
    for (let i = 0; i < cap - 1; i++) {
      const a = i * 2;
      idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", this.attr);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: tint(color, 0.35), side: THREE.DoubleSide }));
    this.mesh.position.z = 0.02;
    this.mesh.frustumCulled = false;
    this.version = -1;
    this.written = 0;
  }
  /** Bring the ribbon up to date with p.path (+ the head). */
  update(p) {
    const path = p.path;
    if (p.pathVersion !== this.version) { this.version = p.pathVersion; this.written = 0; }
    const n = Math.min(path.length, this.cap - 1);
    if (!p.alive || n === 0) { this.geo.setDrawRange(0, 0); return; }
    const pt = (k) => (k < n ? path[k] : p);
    const from = Math.max(0, this.written - 1);
    for (let k = from; k <= n; k++) this.writePoint(k, pt, n + 1);
    this.written = n;
    this.attr.needsUpdate = true;
    this.geo.setDrawRange(0, n * 6);
  }
  writePoint(k, pt, total) {
    const a = pt(Math.max(0, k - 1)), b = pt(Math.min(total - 1, k + 1)), c = pt(k);
    let dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const h = 0.42, nx = -dy * h, ny = dx * h;
    const o = k * 6;
    this.pos[o] = c.x + nx; this.pos[o + 1] = -(c.y + ny); this.pos[o + 2] = 0;
    this.pos[o + 3] = c.x - nx; this.pos[o + 4] = -(c.y - ny); this.pos[o + 5] = 0;
  }
}

/** A head: an ink blob with a shadow, and two eyes looking where it goes. The blob and its shadow
 *  stay put (the light doesn't turn); only the eyes (group.userData.eyes) turn with the heading. */
function makeHead(color) {
  const g = new THREE.Group();
  const circle = (r, c, opacity) => new THREE.Mesh(new THREE.CircleGeometry(r, 28),
    new THREE.MeshBasicMaterial(opacity != null ? { color: c, transparent: true, opacity } : { color: c }));
  const shadow = circle(0.95, 0x000000, 0.18); shadow.position.set(0.18, -0.32, -0.02);
  const base = circle(0.95, shade(color, 0.7)); base.position.set(0, -0.08, -0.01);
  const top = circle(0.85, color); top.position.set(0, 0.06, 0);
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.06, 0.01);
  for (const s of [-1, 1]) {
    const eye = circle(0.27, 0xffffff); eye.position.set(0.3, s * 0.32, 0);
    const pupil = circle(0.13, 0x1b1f27); pupil.position.set(0.41, s * 0.32, 0.01);
    eyes.add(eye, pupil);
  }
  g.add(shadow, base, top, eyes);
  g.userData.eyes = eyes; // the eyes look along local +x
  return g;
}

export class Renderer {
  constructor(canvas, labels) {
    this.canvas = canvas;
    this.labels = labels;
    const r = (this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setClearColor(DESK);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.camera.position.z = 5;
    this.cam = { x: 0, y: 0 };
    this.world = null;
    this.resize();
  }

  /** Build everything for a new match. */
  setWorld(world, colors) {
    this.dispose();
    this.world = world;
    this.colors = colors;
    const N = world.N;
    const root = (this.root = new THREE.Group());
    this.scene.add(root);

    // The desk rim and the paper.
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(N + 2, N + 2), new THREE.MeshBasicMaterial({ color: RIM }));
    rim.position.set(N / 2 + 0.3, -N / 2 - 0.5, -0.03);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.ShaderMaterial({
      vertexShader: BOARD_VS, fragmentShader: BOARD_FS,
      uniforms: { paper: { value: hex(PAPER) }, dot: { value: hex(DOT) }, N: { value: N } },
    }));
    board.position.set(N / 2, -N / 2, -0.02);
    root.add(rim, board);

    // Land: owner texture → smoothing pass → land picture.
    this.ownData = new Uint8Array(N * N * 4);
    this.ownTex = new THREE.DataTexture(this.ownData, N, N, THREE.RGBAFormat);
    this.ownTex.magFilter = this.ownTex.minFilter = THREE.NearestFilter;
    const pal = new Uint8Array(16 * 4);
    colors.forEach((c, i) => { const k = hex(c); pal.set([k.r * 255, k.g * 255, k.b * 255, 255], i * 4); });
    this.palTex = new THREE.DataTexture(pal, 16, 1, THREE.RGBAFormat);
    this.palTex.magFilter = this.palTex.minFilter = THREE.NearestFilter;
    this.palTex.needsUpdate = true;
    const size = N * RES;
    this.landRT = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
    this.landScene = new THREE.Scene();
    this.landCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.landScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: LAND_FS, blending: THREE.NoBlending, depthTest: false, depthWrite: false,
      uniforms: { own: { value: this.ownTex }, pal: { value: this.palTex }, N: { value: N }, paper: { value: hex(PAPER) } },
    })));
    const land = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.ShaderMaterial({
      vertexShader: BOARD_VS, fragmentShader: SHOW_FS, transparent: true, extensions: { derivatives: true },
      uniforms: { land: { value: this.landRT.texture }, shift: { value: SIDE / N } },
    }));
    land.position.set(N / 2, -N / 2, 0);
    root.add(land);
    this.drawLand({ x0: 0, y0: 0, x1: N - 1, y1: N - 1 });
    world.dirty = null;

    // Trails and heads.
    this.ribbons = [null];
    this.heads = [null];
    this.tags = [null];
    this.fade = [null];
    for (let id = 1; id < world.players.length; id++) {
      const c = colors[id];
      const rb = new Ribbon(c);
      root.add(rb.mesh);
      this.ribbons.push(rb);
      const h = makeHead(c);
      h.position.z = 0.05;
      root.add(h);
      this.heads.push(h);
      this.fade.push(1);
      const tag = document.createElement("span");
      tag.textContent = world.players[id].name;
      this.labels.append(tag);
      this.tags.push(tag);
    }
    const focus = world.players[1];
    this.cam.x = focus.x; this.cam.y = focus.y;
  }

  /** Redraw the land picture inside a rectangle of cells. */
  drawLand(d) {
    const { world } = this;
    const N = world.N, own = world.owner, data = this.ownData;
    for (let i = 0; i < N * N; i++) data[i * 4] = own[i];
    this.ownTex.needsUpdate = true;
    const m = 3; // the kernel reaches this far past the change
    const x0 = Math.max(0, d.x0 - m), x1 = Math.min(N - 1, d.x1 + m);
    const y0 = Math.max(0, d.y0 - m), y1 = Math.min(N - 1, d.y1 + m);
    const rt = this.landRT;
    rt.scissor.set(x0 * RES, (N - 1 - y1) * RES, (x1 - x0 + 1) * RES, (y1 - y0 + 1) * RES);
    rt.scissorTest = true;
    this.gl.setRenderTarget(rt);
    this.gl.render(this.landScene, this.landCam);
    this.gl.setRenderTarget(null);
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.gl.setSize(w, h, false);
    this.w = w; this.h = h;
    const scale = VIEW / Math.min(w, h); // cells per CSS pixel
    this.ppc = 1 / scale;
    const c = this.camera;
    c.left = (-w / 2) * scale; c.right = (w / 2) * scale;
    c.top = (h / 2) * scale; c.bottom = (-h / 2) * scale;
    c.updateProjectionMatrix();
  }

  /** Cell coordinates → CSS pixels on screen. */
  project(x, y) {
    return { x: (x - this.cam.x) * this.ppc + this.w / 2, y: (y - this.cam.y) * this.ppc + this.h / 2 };
  }

  /** Draw one frame. `focus` is the player the camera follows; dt for smoothing and fades. */
  draw(dt, focus) {
    const { world } = this;
    if (!world) return;
    if (world.dirty) { this.drawLand(world.dirty); world.dirty = null; }
    const k = Math.min(1, dt * 7);
    if (focus) { this.cam.x += (focus.x - this.cam.x) * k; this.cam.y += (focus.y - this.cam.y) * k; }
    this.camera.position.set(this.cam.x, -this.cam.y, 5);
    const halfW = this.w / this.ppc / 2 + 2, halfH = this.h / this.ppc / 2 + 2;
    for (let id = 1; id < world.players.length; id++) {
      const p = world.players[id];
      this.ribbons[id].update(p);
      const h = this.heads[id];
      if (!p.alive) this.fade[id] = Math.max(0, this.fade[id] - dt * 3);
      const f = this.fade[id];
      h.visible = f > 0;
      h.position.set(p.x, -p.y, 0.05 + id * 0.001);
      h.userData.eyes.rotation.z = -p.angle;
      h.scale.setScalar(0.4 + 0.6 * f);
      const tag = this.tags[id];
      const on = id !== 1 && f > 0 && Math.abs(p.x - this.cam.x) < halfW && Math.abs(p.y - this.cam.y) < halfH;
      tag.hidden = !on;
      if (on) {
        const s = this.project(p.x, p.y);
        tag.style.transform = `translate(${s.x.toFixed(1)}px, ${(s.y - this.ppc * 1.5).toFixed(1)}px) translate(-50%, -100%)`;
        tag.style.opacity = f.toFixed(2);
      }
    }
    this.gl.render(this.scene, this.camera);
  }

  dispose() {
    if (!this.root) return;
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map = null; o.material.dispose(); }
    });
    this.landRT.dispose(); this.ownTex.dispose(); this.palTex.dispose();
    this.landScene.children[0].material.dispose();
    this.landScene.children[0].geometry.dispose();
    this.labels.replaceChildren();
    this.root = null;
  }
}

/** The small overview map: everyone's land and heads, and the part of the board on screen. */
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.src = document.createElement("canvas");
  }
  setWorld(world, colors) {
    this.world = world;
    const N = world.N;
    this.src.width = this.src.height = N;
    this.sctx = this.src.getContext("2d");
    this.img = this.sctx.createImageData(N, N);
    const paper = hex(PAPER);
    this.rgb = colors.map((c, i) => { const k = i ? hex(c) : paper; return [k.r * 255, k.g * 255, k.b * 255]; });
    this.t = 0;
  }
  draw(dt, view) {
    if (!this.world) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.25;
    const { world, img, rgb } = this;
    const N = world.N, d = img.data, own = world.owner;
    for (let i = 0; i < N * N; i++) {
      const c = rgb[own[i]], o = i * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    this.sctx.putImageData(img, 0, 0);
    const cv = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = cv.clientWidth * dpr;
    if (cv.width !== S) cv.width = cv.height = S;
    const ctx = this.ctx, k = S / N;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.src, 0, 0, S, S);
    for (let id = 1; id < world.players.length; id++) {
      const p = world.players[id];
      if (!p.alive) continue;
      ctx.beginPath();
      ctx.arc(p.x * k, p.y * k, (id === 1 ? 3.2 : 2.2) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = id === 1 ? "#ffffff" : "#1b1f27";
      ctx.fill();
      if (id === 1) { ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = "#1b1f27"; ctx.stroke(); }
    }
    if (view) {
      ctx.strokeStyle = "rgba(27,31,39,.55)";
      ctx.lineWidth = 1 * dpr;
      ctx.strokeRect((view.x - view.w / 2) * k, (view.y - view.h / 2) * k, view.w * k, view.h * k);
    }
  }
}
