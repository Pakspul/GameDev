// Draws the island around the player: terrain in chunks (finer close by, coarser far away), trees,
// rocks and grass as instanced meshes, the places' buildings, the sea, and the light of the hour.
// Only what's within the view distance exists; fog hides the edge.
import { THREE, merge } from "./geo.js";
import { CONFIG } from "../config.js";
import { height, ground, KINDS } from "../world/terrain.js";
import { chunkItems, tuftsOf, ITEM_KINDS } from "../world/scatter.js";
import { STRUCTURES } from "../world/places.js";
import { NATURE, NATURE_FAR, BUILD, flameGeometry, runeGeometry } from "./models.js";

const C = CONFIG.world.chunk;
const SKIRT = 5;          // terrain edges hang down this far, so finer and coarser chunks never show a gap

// Surface colours, as linear THREE colours.
const KIND_COLORS = Object.fromEntries(Object.entries(KINDS).map(([k, [a, b]]) => [k, [new THREE.Color(a), new THREE.Color(b)]]));
const DEEP = new THREE.Color("#2f4a55");

export class WorldView {
  constructor(scene, quality) {
    this.scene = scene;
    this.chunks = new Map();          // "cx,cz" → { mesh, res }
    this.queue = [];
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    this.natureMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.seeThrough(this.natureMat);
    this.setQuality(quality);

    // Instanced nature: per kind one detailed mesh for close by and one simple mesh for far away.
    const CAP = { pine: 5000, birch: 3500, rock: 2500, bush: 3500, deadtree: 600 };
    this.nature = {};
    this.natureFar = {};
    for (const k of ITEM_KINDS) {
      for (const [set, geo] of [[this.nature, NATURE[k]()], [this.natureFar, NATURE_FAR[k]()]]) {
        const m = new THREE.InstancedMesh(geo, this.natureMat, CAP[k]);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.count = 0;
        m.frustumCulled = false;
        scene.add(m);
        set[k] = m;
      }
    }
    this.tufts = new THREE.InstancedMesh(NATURE.tuft(), this.natureMat, 9000);
    this.tufts.count = 0;
    this.tufts.frustumCulled = false;
    scene.add(this.tufts);
    this.natureKey = "";
    this.tuftKey = "";

    this.buildPlaces();
    this.buildSea();
    this.buildLights();
  }

  setQuality(q) {
    this.q = CONFIG.view.quality[q] || CONFIG.view.quality.medium;
    this.radius = this.q.far + C * 0.75;
    this.natureKey = this.tuftKey = "";   // rebuild with the new distances
    for (const c of this.chunks.values()) c.res = -1; // re-check detail
  }

  // ---- Terrain -------------------------------------------------------------------------------------------------

  resFor(d) { return d < this.q.lod[0] ? 32 : d < this.q.lod[1] ? 16 : 8; }

  /** Builds one chunk's ground mesh at n × n quads. */
  chunkGeometry(cx, cz, n) {
    const step = C / n, x0 = cx * C, z0 = cz * C;
    // Heights with one extra ring, so slopes at the edges are right.
    const m = n + 3, hs = new Float32Array(m * m);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) hs[j * m + i] = height(x0 + (i - 1) * step, z0 + (j - 1) * step);
    const H = (i, j) => hs[(j + 1) * m + (i + 1)];
    const v = n + 1, edge = 4 * n;
    const pos = new Float32Array((v * v + edge) * 3), col = new Float32Array((v * v + edge) * 3);
    const c = new THREE.Color();
    for (let j = 0; j < v; j++) for (let i = 0; i < v; i++) {
      const x = x0 + i * step, z = z0 + j * step, h = H(i, j);
      const sl = Math.hypot(H(i + 1, j) - H(i - 1, j), H(i, j + 1) - H(i, j - 1)) / (2 * step);
      const g = ground(x, z, h, sl);
      const [a, b] = KIND_COLORS[g.kind];
      c.copy(a).lerp(b, g.shade);
      if (h < 0) c.lerp(DEEP, Math.min(1, -h / 9));
      const o = (j * v + i) * 3;
      pos[o] = x - x0; pos[o + 1] = h; pos[o + 2] = z - z0;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    }
    // The skirt: a copy of the edge loop, hanging down.
    const loop = [];
    for (let i = 0; i < n; i++) loop.push(i);                       // north edge, west → east
    for (let j = 0; j < n; j++) loop.push(j * v + n);               // east edge, north → south
    for (let i = n; i > 0; i--) loop.push(n * v + i);               // south edge, east → west
    for (let j = n; j > 0; j--) loop.push(j * v);                   // west edge, south → north
    loop.forEach((k, e) => {
      const o = (v * v + e) * 3;
      pos[o] = pos[k * 3]; pos[o + 1] = pos[k * 3 + 1] - SKIRT; pos[o + 2] = pos[k * 3 + 2];
      col[o] = col[k * 3]; col[o + 1] = col[k * 3 + 1]; col[o + 2] = col[k * 3 + 2];
    });
    const idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * v + i, b = a + 1, d = a + v, e = d + 1;
      // Alternate the diagonal for a less regular look.
      if ((i + j) & 1) idx.push(a, d, b, b, d, e); else idx.push(a, d, e, a, e, b);
    }
    for (let e = 0; e < edge; e++) {
      const a = loop[e], b = loop[(e + 1) % edge], a2 = v * v + e, b2 = v * v + (e + 1) % edge;
      idx.push(a, b, b2, a, b2, a2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  /** Call every frame: loads, refines and drops chunks around (px, pz), a few per frame. Returns true when settled. */
  update(px, pz, budget = 2) {
    const R = this.radius, want = new Map();
    const c0x = Math.floor((px - R) / C), c1x = Math.floor((px + R) / C);
    const c0z = Math.floor((pz - R) / C), c1z = Math.floor((pz + R) / C);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const d = Math.hypot((cx + 0.5) * C - px, (cz + 0.5) * C - pz) - C * 0.7;
      if (d > this.q.far) continue;
      want.set(cx + "," + cz, { cx, cz, res: this.resFor(Math.max(0, d)), d });
    }
    for (const [k, c] of this.chunks) if (!want.has(k)) {
      this.scene.remove(c.mesh); c.mesh.geometry.dispose(); this.chunks.delete(k);
    }
    // The nearest chunks that are missing or at the wrong detail first.
    const todo = [...want.entries()].filter(([k, w]) => !this.chunks.has(k) || this.chunks.get(k).res !== w.res).sort((a, b) => a[1].d - b[1].d);
    for (let i = 0; i < Math.min(budget, todo.length); i++) {
      const [k, w] = todo[i];
      const old = this.chunks.get(k);
      const geo = this.chunkGeometry(w.cx, w.cz, w.res);
      chunkItems(w.cx, w.cz); // warm the scatter cache with the same budget
      if (old) { old.mesh.geometry.dispose(); old.mesh.geometry = geo; old.res = w.res; }
      else {
        const mesh = new THREE.Mesh(geo, this.terrainMat);
        mesh.position.set(w.cx * C, 0, w.cz * C);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.scene.add(mesh);
        this.chunks.set(k, { mesh, res: w.res });
      }
    }
    const settled = todo.length <= budget;
    // Nature: rebuild the instances every ~24 m walked (which also moves the line between near and far),
    // once nothing is waiting to be built.
    const key = Math.round(px / 24) + "," + Math.round(pz / 24) + "|" + want.size;
    if (settled && key !== this.natureKey) { this.natureKey = key; this.fillNature(want, px, pz); }
    const tk = Math.round(px / 16) + "," + Math.round(pz / 16);
    if (settled && tk !== this.tuftKey) { this.tuftKey = tk; this.fillTufts(px, pz); }
    return settled;
  }

  fillNature(want, px, pz) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    const near2 = CONFIG.view.nearNature ** 2, far2 = (this.q.far + 10) ** 2;
    const counts = new Map();
    for (const w of want.values()) for (const it of chunkItems(w.cx, w.cz)) {
      const d2 = (it.x - px) ** 2 + (it.z - pz) ** 2;
      if (d2 > far2) continue;
      const mesh = (d2 < near2 ? this.nature : this.natureFar)[it.k];
      const i = counts.get(mesh) || 0;
      if (i >= mesh.instanceMatrix.count) continue;
      q.setFromAxisAngle(up, it.rot);
      p.set(it.x, it.y, it.z);
      s.set(it.s, it.s * (it.k === "rock" ? 0.8 + it.tint * 0.5 : 0.9 + it.tint * 0.25), it.s);
      mesh.setMatrixAt(i, m4.compose(p, q, s));
      const v = 0.86 + it.tint * 0.24;
      mesh.setColorAt(i, c.setRGB(v, v * (0.97 + it.tint * 0.06), v * 0.95));
      counts.set(mesh, i + 1);
    }
    for (const mesh of [...Object.values(this.nature), ...Object.values(this.natureFar)]) {
      mesh.count = counts.get(mesh) || 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  fillTufts(px, pz) {
    const R = CONFIG.view.tuftsWithin, R2 = R * R;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    let n = 0;
    const cap = this.tufts.instanceMatrix.count;
    for (let cz = Math.floor((pz - R) / C); cz <= Math.floor((pz + R) / C); cz++)
      for (let cx = Math.floor((px - R) / C); cx <= Math.floor((px + R) / C); cx++)
        for (const t of tuftsOf(cx, cz)) {
          if ((t.x - px) ** 2 + (t.z - pz) ** 2 > R2 || n >= cap) continue;
          q.setFromAxisAngle(up, t.rot);
          this.tufts.setMatrixAt(n, m4.compose(p.set(t.x, t.y, t.z), q, s.setScalar(t.s)));
          this.tufts.setColorAt(n, t.bog ? c.setRGB(0.95, 0.85, 0.6) : c.setRGB(1, 1, 1));
          n++;
        }
    this.tufts.count = n;
    this.tufts.instanceMatrix.needsUpdate = true;
    if (this.tufts.instanceColor) this.tufts.instanceColor.needsUpdate = true;
  }

  /**
   * Trees, rocks and buildings between the camera and the player fade out (dithered), so you never
   * lose sight of yourself in a forest. Done in the shader, so it costs nothing on the CPU.
   */
  seeThrough(mat) {
    this.seeU = { uCam: { value: new THREE.Vector3() }, uHero: { value: new THREE.Vector3() }, uR: { value: CONFIG.view.seeThrough } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.seeU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n{ vec4 wp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nwp = instanceMatrix * wp;\n#endif\nvWorldPos = (modelMatrix * wp).xyz; }");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos; uniform vec3 uCam; uniform vec3 uHero; uniform float uR;")
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        {
          vec3 seg = uHero - uCam; float len = length(seg); vec3 dir = seg / len;
          float t = dot(vWorldPos - uCam, dir);
          if (t > 0.0 && t < len - 0.6) {
            float d = length(vWorldPos - (uCam + dir * t));
            float fade = 1.0 - smoothstep(uR * 0.55, uR, d);
            // A 4×4 ordered dither: no sorting or blending needed.
            vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
            float th = (mod(p.x + p.y * 2.0, 4.0) * 4.0 + mod(p.y * 3.0 + p.x, 4.0) + 0.5) / 16.0;
            if (fade * 0.85 > th) discard;
          }
        }`);
    };
  }

  // ---- Places, sea, light ---------------------------------------------------------------------------------------

  buildPlaces() {
    const parts = [], flames = [], runes = [];
    const g = new THREE.Group();
    for (const s of STRUCTURES) {
      const make = BUILD[s.kind];
      if (!make) continue;
      const y = height(s.x, s.z);
      const geo = merge(make(s));
      geo.rotateY(s.rot);
      geo.translate(s.x, y, s.z);
      parts.push(geo);
      if (s.kind === "fire") flames.push({ x: s.x, y, z: s.z, s: s.camp ? 0.45 : 1 });
      if (s.kind === "stone") runes.push({ x: s.x, y, z: s.z, rot: s.rot });
    }
    const all = merge(parts.map((p) => { p.deleteAttribute("normal"); return p; }));
    this.places = new THREE.Mesh(all, this.natureMat);
    this.places.matrixAutoUpdate = false;
    this.scene.add(this.places);

    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, fog: true });
    this.flames = flames.map((f) => {
      const m = new THREE.Mesh(flameGeometry(), flameMat);
      m.position.set(f.x, f.y + 0.1, f.z);
      m.scale.setScalar(f.s);
      m.userData.s = f.s;
      this.scene.add(m);
      return m;
    });
    const runeMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    for (const r of runes) {
      const m = new THREE.Mesh(runeGeometry(), runeMat);
      m.position.set(r.x, r.y, r.z);
      m.rotation.y = r.rot;
      m.rotation.z = 0.06;
      this.scene.add(m);
    }
    // The village fire lights up the village at night.
    const big = flames.find((f) => f.s === 1);
    this.fireLight = new THREE.PointLight(0xff9a4a, 0, 38, 1.6);
    if (big) this.fireLight.position.set(big.x, big.y + 2.5, big.z);
    this.scene.add(this.fireLight);
  }

  buildSea() {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.seaMat = new THREE.MeshLambertMaterial({ color: 0x3d6574, transparent: true, opacity: 0.82 });
    this.sea = new THREE.Mesh(geo, this.seaMat);
    this.sea.renderOrder = 2;
    this.scene.add(this.sea);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xb8cdd4, 30, 170);
    this.scene.background = new THREE.Color(0xb8cdd4);
    // The lantern on your belt: lights a small circle at night.
    this.lantern = new THREE.PointLight(0xffc27a, 0, 16, 1.4);
    this.scene.add(this.lantern);
  }

  /** Per frame: the sky of the hour (see sim/time.js), the sea and fires following along. */
  frame(dt, t, sky, px, py, pz, camPos) {
    if (camPos) { this.seeU.uCam.value.copy(camPos); this.seeU.uHero.value.set(px, py + 1.1, pz); }
    const fog = this.scene.fog;
    fog.color.setRGB(...sky.fog, THREE.SRGBColorSpace);
    this.scene.background.copy(fog.color);
    const night = 1 - sky.light;
    fog.far = this.q.far * (1 - night * 0.35);
    fog.near = fog.far * 0.18;
    this.hemi.color.setRGB(...sky.sky, THREE.SRGBColorSpace);
    this.hemi.groundColor.setRGB(...sky.ground, THREE.SRGBColorSpace);
    this.hemi.intensity = sky.hemiI;
    this.sun.color.setRGB(...sky.sun, THREE.SRGBColorSpace);
    this.sun.intensity = sky.sunI;
    this.sun.position.set(sky.dir[0] * 100, sky.dir[1] * 100, sky.dir[2] * 100);
    this.seaMat.color.setRGB(0.24 + 0.1 * sky.light, 0.4 + 0.12 * sky.light, 0.46 + 0.1 * sky.light, THREE.SRGBColorSpace).multiplyScalar(0.35 + 0.65 * sky.light);
    this.sea.position.set(px, 0, pz);
    this.sea.scale.set(this.q.far * 2.4, 1, this.q.far * 2.4);
    this.lantern.position.set(px, py + 2.2, pz);
    this.lantern.intensity = night > 0.5 ? (night - 0.5) * 2 * 9 : 0;
    const flick = 0.85 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.08;
    for (const f of this.flames) { f.scale.set(f.userData.s * (0.95 + flick * 0.1), f.userData.s * flick, f.userData.s * (0.95 + flick * 0.1)); f.rotation.y += dt * 0.8; }
    this.fireLight.intensity = (8 + night * 55) * flick;
  }
}
