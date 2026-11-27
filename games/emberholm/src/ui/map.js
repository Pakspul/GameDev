// The map: a picture of the island made from the same terrain as the 3D world, drawn a few rows
// per frame so it never holds the game up. The minimap shows the area around you; tap it for the
// whole island with the places' names.
import { CONFIG } from "../config.js";
import { height, ground, KINDS } from "../world/terrain.js";
import { PLACES } from "../world/places.js";

const SIZE = CONFIG.world.size;
const N = 224;                         // pixels across the island picture
const PX = SIZE / N;                   // metres per pixel
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const COLORS = Object.fromEntries(Object.entries(KINDS).map(([k, [a, b]]) => [k, [rgb(a), rgb(b)]]));

export class IslandMap {
  constructor() {
    this.img = document.createElement("canvas");
    this.img.width = this.img.height = N;
    this.ctx = this.img.getContext("2d");
    this.data = this.ctx.createImageData(N, N);
    this.row = 0;
    this.prev = new Float32Array(N + 1);   // heights of the row above, for slopes
    this.done = false;
  }

  /** Draw a few more rows of the picture; returns true once it's complete. */
  work(rows = 6) {
    if (this.done) return true;
    const d = this.data.data;
    for (let r = 0; r < rows && this.row < N; r++, this.row++) {
      const j = this.row, z = (j + 0.5) * PX - SIZE / 2;
      let left = height(-SIZE / 2, z);
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) * PX - SIZE / 2;
        const h = height(x, z);
        const sl = j ? Math.hypot(h - left, h - this.prev[i]) / PX : 0;
        this.prev[i] = h; left = h;
        let c;
        if (h < 0) {
          const deep = Math.min(1, -h / 10);
          c = [62 - 30 * deep, 106 - 40 * deep, 118 - 30 * deep];
        } else {
          const g = ground(x, z, h, sl);
          const [a, b] = COLORS[g.kind];
          const light = 0.88 + Math.min(0.22, h / 300);
          c = a.map((v, k) => (v + (b[k] - v) * g.shade) * light);
        }
        const o = (j * N + i) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    this.ctx.putImageData(this.data, 0, 0);
    this.done = this.row >= N;
    return this.done;
  }

  /** The minimap: radius metres around the player, north up. */
  drawMini(cv, player, radius = 130) {
    const ctx = cv.getContext("2d");
    const w = cv.width, h = cv.height;
    ctx.fillStyle = "#24424d";
    ctx.fillRect(0, 0, w, h);
    const sx = (player.x + SIZE / 2) / PX, sz = (player.z + SIZE / 2) / PX, r = radius / PX;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.img, sx - r, sz - r, r * 2, r * 2, 0, 0, w, h);
    const scale = w / (radius * 2);
    for (const p of PLACES) {
      const x = w / 2 + (p.x - player.x) * scale, y = h / 2 + (p.z - player.z) * scale;
      if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
      dot(ctx, x, y, p.id === "brandvik" ? 5 : 3.5, p.id === "brandvik" ? "#ffb25a" : "#f4ead6");
    }
    arrow(ctx, w / 2, h / 2, player.yaw, w / 14);
  }

  /** The whole island, fitted into the canvas, with names. */
  drawFull(cv, player, names, seen) {
    const ctx = cv.getContext("2d");
    const w = cv.width, h = cv.height, s = Math.min(w, h);
    const ox = (w - s) / 2, oy = (h - s) / 2;
    ctx.fillStyle = "#24424d";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    // Show the island, not the whole square of sea around it.
    const V = 1260, cut = (SIZE - V) / 2;
    ctx.drawImage(this.img, cut / PX, cut / PX, V / PX, V / PX, ox, oy, s, s);
    const k = s / V, dpr = w / cv.clientWidth || 1;
    ctx.font = `700 ${Math.round(12 * dpr)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    for (const p of PLACES) {
      const x = ox + (p.x + V / 2) * k, y = oy + (p.z + V / 2) * k;
      const known = seen.has(p.id);
      dot(ctx, x, y, (p.id === "brandvik" ? 5 : 3.5) * dpr, known ? (p.id === "brandvik" ? "#ffb25a" : "#f4ead6") : "rgba(244,234,214,.45)");
      if (!known) continue;
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = "rgba(20,24,28,.75)";
      ctx.strokeText(names(p.id), x, y - 9 * dpr);
      ctx.fillStyle = "#f4ead6";
      ctx.fillText(names(p.id), x, y - 9 * dpr);
    }
    arrow(ctx, ox + (player.x + V / 2) * k, oy + (player.z + V / 2) * k, player.yaw, 9 * dpr);
  }
}

function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(20,24,28,.7)";
  ctx.stroke();
}

function arrow(ctx, x, y, yaw, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-yaw);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, r * 0.75);
  ctx.lineTo(0, r * 0.35);
  ctx.lineTo(-r * 0.7, r * 0.75);
  ctx.closePath();
  ctx.fillStyle = "#ffd36a";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a1f14";
  ctx.stroke();
  ctx.restore();
}
