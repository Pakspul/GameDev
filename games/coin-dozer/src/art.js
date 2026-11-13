// The pictures Coin Dozer draws for itself, once, on canvases: coin faces with real relief (a colour,
// a normal and a roughness/metalness map from one height drawing), brushed steel, the neon back
// panel of each theme, sparkles, and the room the metal reflects. Nothing is downloaded: the game
// stays offline and small. render.js puts these on the materials.
const THREE = globalThis.THREE;

const canvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};
const srgb = (t) => { t.encoding = THREE.sRGBEncoding; return t; };

// ---- Coins ------------------------------------------------------------------------------------------------
// The atlas: heads on the left, tails on the right (each S × S), and under them a strip for the
// edge (the reeding). render.js's coinGeometry maps the faces and the edge onto these parts.
export const COIN_ATLAS = { S: 320, strip: 64 };

// Metal colours (sRGB): base, light and dark, and the enamel inlay where a coin has one.
const METAL = {
  gold: { base: [222, 146, 22], lite: [255, 206, 84], dark: [112, 58, 4] },
  silver: { base: [205, 210, 218], lite: [250, 252, 255], dark: [104, 110, 122] },
  gunmetal: { base: [72, 76, 86], lite: [140, 146, 158], dark: [24, 26, 30] },
};

/**
 * One coin design: what is raised on each side and what colour things are.
 *   metal      the coin's metal (METAL)
 *   enamel     [r, g, b] for the coloured field inside the rim (null: plain metal)
 *   heads/tails  what is struck in the middle: "crown" | "star" | "clover" | "fuse" | a number as text
 *   beads      a ring of raised dots inside the rim
 */
export const COIN_DESIGNS = {
  coin: { metal: "gold", enamel: null, heads: "crown", tails: "1", beads: true },
  gold: { metal: "silver", enamel: [8, 92, 210], heads: "5", tails: "5", beads: true },
  lucky: { metal: "gold", enamel: [34, 170, 84], heads: "clover", tails: "clover", beads: true },
  bomb: { metal: "gunmetal", enamel: [40, 40, 46], heads: "fuse", tails: "!", beads: false },
  jackpot: { metal: "gold", enamel: [196, 30, 52], heads: "star", tails: "50", beads: true },
};

/** The raised mark in the middle of a face, drawn in white on a height canvas (and in ink on the colour). */
function mark(g, kind, cx, cy, R) {
  g.save();
  if (kind === "crown") {
    const s = R * 0.5;
    g.beginPath();
    g.moveTo(cx - s, cy + s * 0.45); g.lineTo(cx - s * 1.05, cy - s * 0.45); g.lineTo(cx - s * 0.5, cy - s * 0.02);
    g.lineTo(cx, cy - s * 0.7); g.lineTo(cx + s * 0.5, cy - s * 0.02); g.lineTo(cx + s * 1.05, cy - s * 0.45); g.lineTo(cx + s, cy + s * 0.45);
    g.closePath(); g.fill();
    g.fillRect(cx - s, cy + s * 0.55, s * 2, s * 0.22);
    for (const [dx, dy] of [[-1.05, -0.45], [0, -0.7], [1.05, -0.45]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s - s * 0.12, s * 0.13, 0, Math.PI * 2); g.fill(); }
  } else if (kind === "star") {
    star(g, cx, cy, R * 0.52, R * 0.22, 5);
  } else if (kind === "clover") {
    const r = R * 0.2;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { g.beginPath(); g.arc(cx + dx * r * 0.95, cy + dy * r * 0.95 - r * 0.3, r * 0.82, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = r * 0.32; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx, cy + r * 0.2); g.quadraticCurveTo(cx + r * 0.5, cy + r * 1.6, cx + r * 1.3, cy + r * 2.1); g.stroke();
  } else if (kind === "fuse") {
    g.beginPath(); g.arc(cx - R * 0.06, cy + R * 0.08, R * 0.34, 0, Math.PI * 2); g.fill();
    g.lineWidth = R * 0.07; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx + R * 0.16, cy - R * 0.16); g.quadraticCurveTo(cx + R * 0.4, cy - R * 0.5, cx + R * 0.52, cy - R * 0.36); g.stroke();
    star(g, cx + R * 0.55, cy - R * 0.4, R * 0.16, R * 0.06, 6);
  } else {
    g.font = `900 ${kind.length > 1 ? R * 0.78 : R * 1.02}px "Arial Black", Impact, system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(kind, cx, cy + R * 0.05);
  }
  g.restore();
}
function star(g, cx, cy, r1, r2, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? r2 : r1; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.closePath(); g.fill();
}

/** Blur a height field in place (two box passes): soft shoulders, so the relief catches light like a strike. */
function blur(h, w, H, r) {
  const tmp = new Float32Array(h.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += h[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * r + 1);
        acc += h[y * w + Math.min(w - 1, x + r + 1)] - h[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < H; y++) {
        h[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(H - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
}

/**
 * The three maps of one coin kind. Returns { map, normalMap, ormMap } (ormMap: green = roughness,
 * blue = metalness, as three.js reads them).
 */
const coinMapCache = new Map();
export function coinMaps(kind) {
  if (!coinMapCache.has(kind)) coinMapCache.set(kind, drawCoin(kind));
  return coinMapCache.get(kind);
}
function drawCoin(kind) {
  const D = COIN_DESIGNS[kind], M = METAL[D.metal], { S, strip } = COIN_ATLAS;
  const W = S * 2, H = S + strip;
  // 1. Height: rim high, beads, field low, mark raised; the edge strip gets vertical reeding.
  const hc = canvas(W, H), hg = hc.getContext("2d");
  hg.fillStyle = "#000"; hg.fillRect(0, 0, W, H);
  // 2. Where the enamel is (not metal), drawn alongside.
  const ec = canvas(W, H), eg = ec.getContext("2d");
  for (let side = 0; side < 2; side++) {
    const cx = S * side + S / 2, cy = S / 2, R = S / 2 - 1;
    hg.fillStyle = "#fff"; hg.beginPath(); hg.arc(cx, cy, R, 0, Math.PI * 2); hg.fill();              // rim
    hg.fillStyle = "#5a5a5a"; hg.beginPath(); hg.arc(cx, cy, R * 0.83, 0, Math.PI * 2); hg.fill();    // the field, recessed
    if (D.beads) {
      hg.fillStyle = "#cfcfcf";
      const n = 40;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; hg.beginPath(); hg.arc(cx + Math.cos(a) * R * 0.765, cy + Math.sin(a) * R * 0.765, R * 0.026, 0, Math.PI * 2); hg.fill(); }
    }
    if (D.enamel) {
      // The enamel sits in a dished centre inside a raised metal ring.
      hg.fillStyle = "#e6e6e6"; hg.beginPath(); hg.arc(cx, cy, R * 0.7, 0, Math.PI * 2); hg.fill();
      hg.fillStyle = "#4a4a4a"; hg.beginPath(); hg.arc(cx, cy, R * 0.64, 0, Math.PI * 2); hg.fill();
      eg.fillStyle = "#fff"; eg.beginPath(); eg.arc(cx, cy, R * 0.64, 0, Math.PI * 2); eg.fill();
    }
    hg.fillStyle = "#f2f2f2"; hg.strokeStyle = "#f2f2f2";
    mark(hg, side === 0 ? D.heads : D.tails, cx, cy, R);
    eg.globalCompositeOperation = "destination-out"; eg.fillStyle = "#000"; eg.strokeStyle = "#000";
    mark(eg, side === 0 ? D.heads : D.tails, cx, cy, R);
    eg.globalCompositeOperation = "source-over";
  }
  // Reeding on the edge: fine ridges around the coin.
  for (let x = 0; x < W; x += 6) { hg.fillStyle = "#909090"; hg.fillRect(x, S, 3, strip); hg.fillStyle = "#d0d0d0"; hg.fillRect(x + 3, S, 3, strip); }

  const hd = hg.getImageData(0, 0, W, H).data, ed = eg.getImageData(0, 0, W, H).data;
  const h = new Float32Array(W * H);
  for (let i = 0; i < h.length; i++) h[i] = hd[i * 4] / 255;
  const sharp = Float32Array.from(h);
  blur(h, W, H, 2);

  // 3. From the height: normals (Sobel), colour (metal shaded by height, darker in the recesses: baked
  //    ambient occlusion) and roughness (polished relief, satin field).
  const cc = canvas(W, H), ci = cc.getContext("2d").createImageData(W, H);
  const nc = canvas(W, H), ni = nc.getContext("2d").createImageData(W, H);
  const oc = canvas(W, H), oi = oc.getContext("2d").createImageData(W, H);
  const at = (x, y) => h[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  const strength = 3.2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4;
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      ni.data[o] = (nx * 0.5 + 0.5) * 255; ni.data[o + 1] = (ny * 0.5 + 0.5) * 255; ni.data[o + 2] = (nz * 0.5 + 0.5) * 255; ni.data[o + 3] = 255;

      const enamel = ed[o + 3] > 128 && y < S;
      const ht = h[i], occl = Math.max(0, sharp[i] - ht);            // inside corners, where the blur dips
      let r, g, b;
      if (enamel) {
        const k = 0.88 + 0.12 * ht;
        [r, g, b] = D.enamel.map((c) => c * k);
      } else {
        const t = Math.min(1, ht * 1.1);
        const mix = (a, c, k) => a + (c - a) * k;
        const k0 = Math.min(1, 0.5 + t);                               // the field nearly the full metal colour, only its floor darker
        r = mix(M.dark[0], M.base[0], k0); g = mix(M.dark[1], M.base[1], k0); b = mix(M.dark[2], M.base[2], k0);
        if (t > 0.62) { const k = (t - 0.62) / 0.38 * 0.45; r = mix(r, M.lite[0], k); g = mix(g, M.lite[1], k); b = mix(b, M.lite[2], k); }
        const ao = 1 - Math.min(0.5, occl * 1.6);
        r *= ao; g *= ao; b *= ao;
      }
      ci.data[o] = r; ci.data[o + 1] = g; ci.data[o + 2] = b; ci.data[o + 3] = 255;
      oi.data[o] = 255;
      oi.data[o + 1] = enamel ? 70 : y >= S ? 90 : ht > 0.7 ? 40 : 110;   // roughness × 255
      oi.data[o + 2] = enamel ? 0 : 255;                                   // metalness
      oi.data[o + 3] = 255;
    }
  }
  cc.getContext("2d").putImageData(ci, 0, 0);
  nc.getContext("2d").putImageData(ni, 0, 0);
  oc.getContext("2d").putImageData(oi, 0, 0);
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
  return { map: srgb(tex(cc)), normalMap: tex(nc), ormMap: tex(oc) };
}

/** A flat picture of a coin face for the HUD and buttons (CSS), as a data URL. */
export function coinIcon(kind, size = 64) {
  const { map } = coinMaps(kind), src = map.image, S = COIN_ATLAS.S;
  const c = canvas(size, size), g = c.getContext("2d");
  g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip();
  g.drawImage(src, 0, 0, S, S, 0, 0, size, size);
  const shine = g.createLinearGradient(0, 0, size, size);
  shine.addColorStop(0, "rgba(255,255,255,0.45)"); shine.addColorStop(0.45, "rgba(255,255,255,0)"); shine.addColorStop(1, "rgba(0,0,0,0.25)");
  g.fillStyle = shine; g.fillRect(0, 0, size, size);
  return c.toDataURL("image/png");
}

// ---- Steel ------------------------------------------------------------------------------------------------
/** Brushed steel: long fine streaks. Returns { map, roughnessMap }; repeat them as needed. */
export function brushed(seed = 1) {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const W = 256, H = 256;
  const c = canvas(W, H), g = c.getContext("2d");
  g.fillStyle = "rgb(200,200,200)"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    const y = rnd() * H, v = 150 + rnd() * 105 | 0, x = rnd() * W, len = 40 + rnd() * 220, th = 0.6 + rnd() * 0.9;
    g.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.35})`;
    for (const dx of [-W, 0]) g.fillRect(x + dx, y, len, th);    // wrapped, so the texture tiles without a seam
  }
  const r = canvas(W, H), rg = r.getContext("2d");
  rg.drawImage(c, 0, 0);
  rg.globalCompositeOperation = "multiply"; rg.fillStyle = "rgb(150,150,150)"; rg.fillRect(0, 0, W, H);
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  return { map: srgb(mk(c)), roughnessMap: mk(r) };
}

// ---- The back panel ------------------------------------------------------------------------------------------
/**
 * The theme's back panel: a dark glossy board with neon shapes. Returns { map, emissiveMap }: the
 * neon tubes glow (emissive) and light the coins' reflections; the board around them stays dark.
 */
export function neonPanel(theme, w = 512, h = 640) {
  const c = canvas(w, h), g = c.getContext("2d");
  const e = canvas(w, h), eg = e.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, theme.panel[0]); bg.addColorStop(1, theme.panel[1]);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  eg.fillStyle = "#000"; eg.fillRect(0, 0, w, h);
  // A faint grid of light, like a mirrored back wall.
  g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const tube = (draw, colour, width) => {
    for (const ctx of [g, eg]) {
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = colour; ctx.shadowColor = colour;
      ctx.shadowBlur = width * 3; ctx.lineWidth = width * 1.6; ctx.globalAlpha = 0.35; draw(ctx); ctx.stroke();
      ctx.shadowBlur = width * 1.5; ctx.lineWidth = width; ctx.globalAlpha = 1; draw(ctx); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.shadowBlur = 0; ctx.lineWidth = width * 0.35; draw(ctx); ctx.stroke();
      ctx.restore();
    }
  };
  const [a, b] = theme.neon.map((n) => "#" + n.toString(16).padStart(6, "0"));
  const path = (pts) => (ctx) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); };
  if (theme.motif === "chevrons") {
    for (let i = 0; i < 3; i++) {
      const y = 0.16 + i * 0.27;
      tube(path([[0.22, y], [0.5, y + 0.14], [0.78, y]]), i % 2 ? b : a, 9);
      tube(path([[0.3, y + 0.06], [0.5, y + 0.16], [0.7, y + 0.06]]), i % 2 ? a : b, 5);
    }
    tube(path([[0.06, 0.04], [0.06, 0.96]]), b, 6); tube(path([[0.94, 0.04], [0.94, 0.96]]), b, 6);
  } else if (theme.motif === "planets") {
    tube((ctx) => { ctx.beginPath(); ctx.arc(w * 0.36, h * 0.38, w * 0.2, 0, Math.PI * 2); }, a, 8);
    tube((ctx) => { ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.38, w * 0.34, w * 0.07, -0.3, 0, Math.PI * 2); }, b, 6);
    tube((ctx) => { ctx.beginPath(); ctx.arc(w * 0.76, h * 0.72, w * 0.09, 0, Math.PI * 2); }, b, 6);
    for (const [x, y] of [[0.8, 0.18], [0.14, 0.78], [0.6, 0.9], [0.9, 0.45], [0.2, 0.12]]) tube((ctx) => { ctx.beginPath(); for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2; ctx.moveTo(x * w, y * h); ctx.lineTo(x * w + Math.cos(an) * 14, y * h + Math.sin(an) * 14); } }, "#ffffff", 3);
  } else if (theme.motif === "hearts") {
    const heart = (x, y, s) => (ctx) => { ctx.beginPath(); ctx.moveTo(x * w, (y + 0.06 * s) * h); ctx.bezierCurveTo((x - 0.2 * s) * w, (y - 0.06 * s) * h, (x - 0.06 * s) * w, (y - 0.16 * s) * h, x * w, (y - 0.06 * s) * h); ctx.bezierCurveTo((x + 0.06 * s) * w, (y - 0.16 * s) * h, (x + 0.2 * s) * w, (y - 0.06 * s) * h, x * w, (y + 0.06 * s) * h); };
    tube(heart(0.5, 0.42, 1.6), a, 9);
    tube(heart(0.2, 0.18, 0.7), b, 5); tube(heart(0.8, 0.2, 0.7), b, 5);
    tube(heart(0.22, 0.78, 0.6), b, 5); tube(heart(0.78, 0.76, 0.6), b, 5);
  } else {
    for (let i = 0; i < 4; i++) {
      const y = 0.18 + i * 0.2;
      tube((ctx) => { ctx.beginPath(); for (let k = 0; k <= 40; k++) { const x = k / 40; const yy = y + Math.sin(x * Math.PI * 4 + i) * 0.03; k ? ctx.lineTo(x * w, yy * h) : ctx.moveTo(x * w, yy * h); } }, i % 2 ? b : a, 6);
    }
    tube((ctx) => { ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.48, w * 0.1, h * 0.04, 0, 0, Math.PI * 2); ctx.moveTo(w * 0.72, h * 0.48); ctx.lineTo(w * 0.8, h * 0.44); ctx.lineTo(w * 0.8, h * 0.52); ctx.closePath(); }, "#ffffff", 4);
  }
  const t1 = srgb(new THREE.CanvasTexture(c)), t2 = srgb(new THREE.CanvasTexture(e));
  t1.anisotropy = t2.anisotropy = 4;
  return { map: t1, emissiveMap: t2 };
}

/**
 * The marquee on top of the cabinet: a neon coin in the middle with rays fanning out in the theme's two
 * neon colours, on a dark board. No text. Returns { map, emissiveMap } like neonPanel.
 */
export function marquee(theme, w = 512, h = 128) {
  const c = canvas(w, h), g = c.getContext("2d");
  const e = canvas(w, h), eg = e.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, theme.panel[1]); bg.addColorStop(1, theme.panel[0]);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  eg.fillStyle = "#000"; eg.fillRect(0, 0, w, h);
  const [a, b] = theme.neon.map((n) => "#" + n.toString(16).padStart(6, "0"));
  const gold = "#ffd166";
  const glow = (draw, colour, width) => {
    for (const ctx of [g, eg]) {
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = colour; ctx.shadowColor = colour;
      ctx.shadowBlur = width * 2.5; ctx.lineWidth = width; draw(ctx); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.shadowBlur = 0; ctx.lineWidth = width * 0.35; draw(ctx); ctx.stroke();
      ctx.restore();
    }
  };
  const cx = w / 2, cy = h / 2, r = h * 0.3;
  // Rays: short neon dashes fanning out from the coin, alternating colours.
  for (let i = 0; i < 18; i++) {
    const an = Math.PI + (i / 17) * Math.PI * 2;
    const k = Math.abs(Math.cos(an));
    const r0 = r * 1.5, r1 = r * (1.9 + 2.4 * k);
    glow((ctx) => { ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r0 * 2, cy + Math.sin(an) * r0 * 0.9); ctx.lineTo(cx + Math.cos(an) * r1 * 2, cy + Math.sin(an) * Math.min(r1, h * 0.42 / 0.9) * 0.9); }, i % 2 ? a : b, 5);
  }
  // The coin: a gold ring, an inner ring and a crown.
  glow((ctx) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); }, gold, 7);
  glow((ctx) => { ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); }, gold, 3);
  glow((ctx) => {
    const s = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.5); ctx.lineTo(cx - s, cy - s * 0.45); ctx.lineTo(cx - s * 0.5, cy + s * 0.05);
    ctx.lineTo(cx, cy - s * 0.6); ctx.lineTo(cx + s * 0.5, cy + s * 0.05); ctx.lineTo(cx + s, cy - s * 0.45); ctx.lineTo(cx + s, cy + s * 0.5); ctx.closePath();
  }, gold, 3);
  const t1 = srgb(new THREE.CanvasTexture(c)), t2 = srgb(new THREE.CanvasTexture(e));
  t1.anisotropy = t2.anisotropy = 4;
  return { map: t1, emissiveMap: t2 };
}

/** A straight stripe pattern (the pusher's front plate), in two colours. */
export function stripes(a, b) {
  const c = canvas(256, 32), g = c.getContext("2d");
  g.fillStyle = a; g.fillRect(0, 0, 256, 32);
  g.fillStyle = b;
  for (let x = -32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); }
  const t = srgb(new THREE.CanvasTexture(c));
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  return t;
}

/** A four-pointed twinkle for sparkles. */
export function sparkle() {
  const c = canvas(64, 64), g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.2, "rgba(255,255,255,0.55)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(255,255,255,0.9)";
  for (const [w, h] of [[3, 30], [30, 3]]) { g.beginPath(); g.ellipse(32, 32, w, h, 0, 0, Math.PI * 2); g.fill(); }
  return new THREE.CanvasTexture(c);
}

// ---- The room the metal reflects ----------------------------------------------------------------------------
/**
 * A small dark arcade hall with bright light panels: overhead strips, a warm glow on each side and
 * the theme's neon colours. Rendered once per theme into a reflection map (PMREM), so metal looks
 * like metal. `neon` is two colours (0xrrggbb).
 */
export function environment(gl, neon) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070a);
  const panel = (w, h, colour, power, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(power), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
    scene.add(m);
  };
  panel(30, 30, 0x16141a, 1, 0, -8, 0, -Math.PI / 2);                     // floor
  panel(3, 16, 0xfff3e0, 7, -3, 12, 2, Math.PI / 2);                      // overhead light strips
  panel(3, 16, 0xfff3e0, 7, 3, 12, 2, Math.PI / 2);
  panel(10, 4, 0xffd9a0, 2.2, -14, 3, 4, 0, Math.PI / 2);                  // warm side glow
  panel(10, 4, 0xffd9a0, 2.2, 14, 3, 4, 0, -Math.PI / 2);
  panel(14, 2, neon[0], 3.5, 0, 6, -14);                                    // neon behind the machine
  panel(14, 2, neon[1], 3.5, 0, 1.5, -14);
  panel(16, 6, 0xffffff, 1.4, 0, 5, 16);                                    // the room behind the player
  panel(6, 1.2, neon[1], 3, -12, 8, -6, 0, Math.PI / 3);
  panel(6, 1.2, neon[0], 3, 12, 8, -6, 0, -Math.PI / 3);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(scene, 0.035);
  pm.dispose();
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}
