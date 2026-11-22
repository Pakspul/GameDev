// Orbit's sculptures: voxel models of 10,000 blocks and more, made from shapes in maths rather than
// drawn by hand, so one model can be built at any size. Each has a body (what is inside, which you
// meet as the outside peels away) and often a skin (what colour the outermost blocks get).
//
// Space: x left to right, y bottom to top, z back to front, each from -a to +a for the model's aspect
// a (1 = half the grid's size N). The grid is cells[(y * d + z) * w + x]; z = d - 1 is the front, which
// faces the camera at first. The footprint (x, z) is what Critters' 2D track runs round.
//
// The order of SCULPTS, and every shape in it, is part of every Orbit level: append only, and never
// change a shape without bumping the save key (see docs/LOOPLINE.md).
import { COLOR_OF } from "./config.js";

// ---- Helpers ---------------------------------------------------------------------------------------------------
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const len2 = (x, z) => Math.sqrt(x * x + z * z);
const TAU = Math.PI * 2;
/** A repeatable 0..1 from integers (for sprinkles, spots, seeds). */
function hash3(i, j, k, s = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 2147483647) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth 3D value noise, 0..1, seeded. */
function noise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm = (x, y, z, s) => 0.6 * noise3(x, y, z, s) + 0.3 * noise3(2 * x, 2 * y, 2 * z, s + 7) + 0.1 * noise3(4 * x, 4 * y, 4 * z, s + 13);
/** Distance from p to the segment a-b (both [x, y, z]). */
function segDist(px, py, pz, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy + (pz - a[2]) * dz) / (dx * dx + dy * dy + dz * dz)));
  return len3(px - a[0] - dx * t, py - a[1] - dy * t, pz - a[2] - dz * t);
}

// ---- The models -------------------------------------------------------------------------------------------------
// body(p) returns a colour letter for a solid block, or null. skin(p) (optional) gives the outermost
// blocks another colour, or null to keep the body's. p: { x, y, z, i, j, k, N } (i, j, k: grid indices).
export const SCULPTS = [
  { id: "jawbreaker", aspect: [1, 1, 1],
    body: ({ x, y, z }) => {
      const r = len3(x, y, z);
      return r > 1 ? null : r > 0.8 ? "K" : r > 0.62 ? "Y" : r > 0.45 ? "S" : r > 0.28 ? "L" : "R";
    },
    skin: ({ x, y, z }) => (Math.sin(Math.atan2(z, x) * 3 + y * 4) > 0.35 ? "W" : null),
  },
  { id: "apple", aspect: [1, 1, 1],
    body: ({ x, y, z }) => {
      const rr = len2(x, z);
      if (rr < 0.09 && y > 0.6 && y < 1.0) return "N";                    // stem
      if (len3((x - 0.24) / 1.4, y - 0.88, z / 0.55) < 0.13) return "G";   // leaf
      const dimple = 0.22 * Math.exp(-(rr * rr) / 0.05);
      const q = len3(x, (y + 0.06) / 0.88, z);
      if (q > 0.98 - (y > 0 ? dimple : dimple * 0.6)) return null;
      if (rr < 0.16 && Math.abs(y) < 0.48) return (Math.abs(y) % 0.3 < 0.12 && rr > 0.06) ? "N" : "Y"; // core and pips
      return q > 0.84 ? "R" : "W";
    },
    skin: ({ x, y, z }) => (y < 0.6 && fbm(x * 3, y * 3, z * 3, 5) > 0.66 ? "O" : null),
  },
  { id: "mushroom", aspect: [1, 1, 1],
    body: ({ x, y, z }) => {
      const rr = len2(x, z);
      if (y < -0.85 && rr < 0.95) return "G";                               // a tuft of grass
      if (y > 0.02 && len3(x, (y - 0.02) / 0.95, z) < 1) return y < 0.14 ? "F" : "R";
      if (y <= 0.14 && y >= -0.85 && rr < 0.36 - 0.06 * (y + 0.85)) return "W";
      return null;
    },
    skin: ({ x, y, z }) => (y > 0.14 && noise3(x * 4.2 + 9, y * 4.2, z * 4.2, 3) > 0.68 ? "W" : null),
  },
  { id: "cube", aspect: [0.84, 0.84, 0.84],
    body: () => "D",
    // A scrambled puzzle cube: 3 × 3 stickers on every face, colours from a fixed shuffle.
    skin: ({ x, y, z }) => {
      const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z), m = Math.max(ax, ay, az);
      const cell = (u, v) => Math.min(2, Math.floor(((u / 0.84) + 1) * 1.5)) * 3 + Math.min(2, Math.floor(((v / 0.84) + 1) * 1.5));
      let face, c;
      if (m === ay) { face = y > 0 ? 0 : 1; c = cell(x, z); }
      else if (m === az) { face = z > 0 ? 2 : 3; c = cell(x, y); }
      else { face = x > 0 ? 4 : 5; c = cell(z, y); }
      return "WYRBGO"[Math.floor(hash3(face, c, 11) * 6)];
    },
  },
  { id: "watermelon", aspect: [1, 0.72, 0.78],
    body: ({ x, y, z }) => {
      const q = len3(x, y / 0.72, z / 0.78);
      if (q > 1) return null;
      if (q > 0.84) return Math.sin(Math.atan2(y, z) * 7 + x * 1.5) > 0.2 ? "L" : "G";
      if (q > 0.74) return "W";
      return hash3(Math.round(x * 9), Math.round(y * 9), Math.round(z * 9), 21) > 0.93 ? "D" : "R";
    },
  },
  { id: "snowman", aspect: [0.7, 1, 0.7],
    body: ({ x, y, z }) => {
      if (y > 0.7 && y < 0.76 && len2(x, z) < 0.3) return "D";             // brim
      if (y >= 0.76 && y < 1 && len2(x, z) < 0.2) return y < 0.82 ? "R" : "D";
      if (segDist(x, y, z, [0, 0.52, 0.18], [0, 0.5, 0.46]) < 0.065) return "O"; // carrot
      if (y > 0.3 && y < 0.38 && len2(x, z) < 0.31) return "R";            // scarf
      if (len3(x, y - 0.52, z) < 0.24 || len3(x, y - 0.06, z) < 0.34 || len3(x, y + 0.56, z) < 0.44) return "W";
      return null;
    },
    skin: ({ x, y, z }) => {
      if (z > 0.1 && Math.abs(y - 0.6) < 0.06 && Math.abs(Math.abs(x) - 0.09) < 0.06) return "D"; // eyes
      if (z > 0.2 && Math.abs(x) < 0.07 && [0.18, 0.04, -0.1, -0.36].some((b) => Math.abs(y - b) < 0.05)) return "D"; // buttons
      return null;
    },
  },
  { id: "pumpkin", aspect: [1, 0.8, 1],
    body: ({ x, y, z }) => {
      const a = Math.atan2(z, x), rr = len2(x, z);
      if (y > 0.5 && y < 0.8 && len2(x - 0.04 * (y - 0.5), z) < 0.12) return "G";
      const R = 1 - 0.07 * (1 - Math.cos(8 * a));
      const q = len3(rr / R, y / 0.62, 0);
      if (q > 1) return null;
      if (q > 0.84) return Math.cos(8 * a) > 0.86 ? "N" : "O";
      return q > 0.55 ? "Y" : "F";
    },
    skin: ({ x, y, z }) => {
      if (z < 0.3) return null;                                           // a lantern face on the front
      if (Math.abs(Math.abs(x) - 0.33) < 0.14 - (y - 0.12) * 0.7 && y > 0.12 && y < 0.32) return "Y";
      if (y < -0.08 && y > -0.3 && Math.abs(x) < 0.5 && y > -0.3 + Math.abs(Math.sin(x * 9)) * 0.08) return "Y";
      return null;
    },
  },
  { id: "donut", aspect: [1, 0.5, 1],
    body: ({ x, y, z }) => {
      const t = len3(len2(x, z) - 0.6, y, 0);
      if (t > 0.42) return null;
      return t > 0.3 ? (y > 0.02 ? "K" : "O") : "F";
    },
    skin: ({ x, y, z, i, j, k }) => {
      if (y <= 0.06) return null;
      const h = hash3(i, j, k, 4);
      return h > 0.9 ? "Y" : h > 0.82 ? "S" : h > 0.75 ? "W" : h > 0.7 ? "L" : null;
    },
  },
  { id: "cake", aspect: [0.95, 1, 0.95],
    body: ({ x, y, z, i, k }) => {
      const rr = len2(x, z);
      if (y < -0.86) return rr < 0.95 ? "E" : null;                       // plate
      if (len3(x, y - 0.62, z) < 0.12) return "R";                        // cherry
      for (const [cx, cz] of [[0.32, 0.1], [-0.25, 0.25], [-0.05, -0.34]]) {
        if (len2(x - cx, z - cz) < 0.06 && y > 0.45 && y < 0.92) return y > 0.8 ? "Y" : "S";
      }
      if (y < -0.1 && rr < 0.88) return rr > 0.8 || y > -0.2 ? "W" : Math.abs(((y + 0.86) % 0.26) - 0.13) < 0.04 ? "R" : "F";
      if (y >= -0.1 && y < 0.5 && rr < 0.58) return rr > 0.5 || y > 0.4 ? "K" : Math.abs(((y + 0.1) % 0.2) - 0.1) < 0.03 ? "W" : "N";
      return null;
    },
  },
  { id: "tree", aspect: [0.9, 1, 0.9],
    body: ({ x, y, z }) => {
      const rr = len2(x, z);
      if (y < -0.72) return y < -0.82 && rr < 0.36 ? "R" : rr < 0.28 ? "R" : null; // pot
      if (y < -0.5) return rr < 0.14 ? "N" : null;
      if (len3(x, y - 0.95, z) < 0.09) return "Y";                        // star
      for (const [y0, y1, r0] of [[-0.5, 0.05, 0.88], [-0.1, 0.5, 0.66], [0.35, 0.92, 0.44]]) {
        if (y >= y0 && y < y1 && rr < r0 * (1 - (y - y0) / (y1 - y0 + 0.08))) return "G";
      }
      return null;
    },
    skin: ({ i, j, k, y }) => {
      if (y < -0.5 || y > 0.88) return null;
      const h = hash3(i, j, k, 9);
      return h > 0.93 ? "R" : h > 0.87 ? "Y" : h > 0.82 ? "S" : h > 0.7 ? "L" : null;
    },
  },
  { id: "planet", aspect: [1, 1, 1],
    body: ({ x, y, z }) => {
      const r = len3(x, y, z);
      if (r > 1) return null;
      if (r > 0.86) {
        if (Math.abs(y) > 0.82) return "W";
        const n = fbm(x * 2.2 + 3, y * 2.2, z * 2.2, 17);
        return n > 0.58 ? (n > 0.66 ? "L" : "G") : n > 0.54 ? "Y" : "B";
      }
      return r > 0.7 ? "N" : r > 0.45 ? "O" : r > 0.24 ? "Y" : "R";
    },
  },
  { id: "duck", aspect: [1, 0.95, 0.75],
    body: ({ x, y, z }) => {
      if (len3((x - 0.62) / 1.6, y - 0.45, z / 0.7) < 0.12) return "O";   // beak
      if (len3(x - 0.36, y - 0.45, z) < 0.32) return "Y";                // head
      const b = len3((x + 0.05) / 0.95, (y + 0.32) / 0.58, z / 0.72);
      if (b < 1) return b > 0.82 && y > -0.3 && Math.abs(z) > 0.45 && x < 0.3 ? "O" : "Y"; // wings
      if (len3(x + 0.95, y + 0.05, z / 0.6) < 0.18) return "Y";          // tail
      return null;
    },
    skin: ({ x, y, z }) => (len3(x - 0.48, y - 0.55, Math.abs(z) - 0.2) < 0.08 ? "D" : null),
  },
  // ---- Bigger, for Medium and Hard ---------------------------------------------------------------------------
  { id: "geode", aspect: [1, 0.86, 1],
    body: ({ x, y, z }) => {
      const r = len3(x, y / 0.86, z) * (0.88 + 0.24 * fbm(x * 2 + 5, y * 2, z * 2, 31));
      if (r > 1) return null;
      if (r > 0.78) return noise3(x * 6, y * 6, z * 6, 2) > 0.62 ? "N" : "E";
      if (r > 0.66) return "W";
      if (r > 0.38) return noise3(x * 7, y * 7, z * 7, 6) > 0.55 ? "K" : "P";
      return "B";
    },
  },
  { id: "lighthouse", aspect: [0.62, 1, 0.62],
    body: ({ x, y, z }) => {
      const rr = len2(x, z);
      if (y < -0.82) return rr < 0.6 ? (noise3(x * 5, y * 5, z * 5, 8) > 0.5 ? "E" : "N") : null; // rocks
      if (y < 0.48) return rr < 0.36 - 0.12 * ((y + 0.82) / 1.3) ? (Math.floor((y + 0.82) / 0.22) % 2 ? "W" : "R") : null;
      if (y < 0.54) return rr < 0.38 ? "D" : null;                        // gallery
      if (y < 0.78) return rr < 0.2 ? (rr < 0.12 ? "Y" : "S") : null;     // lantern
      if (y < 1) return rr < 0.26 * (1 - (y - 0.78) / 0.26) ? "R" : null; // roof
      return null;
    },
    skin: ({ x, y, z }) => (y > -0.4 && y < 0.3 && z > 0.12 && Math.abs(x) < 0.06 && Math.abs(((y + 0.4) % 0.33) - 0.16) < 0.06 ? "B" : null),
  },
  { id: "rocket", aspect: [0.66, 1, 0.66],
    body: ({ x, y, z }) => {
      const rr = len2(x, z), a = Math.atan2(z, x);
      if (y < -0.72 && y > -1 && rr < 0.2 * (1 + (y + 0.72) * 1.4)) return y < -0.88 ? "Y" : "O"; // flame
      if (y > -0.72 && y < -0.3 && rr < 0.62 && rr > 0.18 && Math.abs(Math.sin(2 * a)) < 0.18 && rr < 0.62 - (y + 0.72) * 0.6) return "R"; // fins
      if (y > -0.72 && y < 0.45) return rr < 0.3 ? (y < -0.6 ? "E" : "W") : null;
      if (y >= 0.45 && y < 1) return rr < 0.3 * (1 - Math.pow((y - 0.45) / 0.55, 1.6)) ? "R" : null;
      return null;
    },
    skin: ({ x, y, z }) => (len3(x, y - 0.15, z > 0 ? 0 : 1) < 0.13 ? "S" : Math.abs(y + 0.2) < 0.04 ? "B" : null),
  },
  { id: "icecream", aspect: [0.62, 1, 0.62],
    body: ({ x, y, z }) => {
      const rr = len2(x, z);
      if (len3(x, y - 0.93, z) < 0.08) return "R";
      if (y < -0.05) return rr < 0.36 * ((y + 1) / 0.95) ? "F" : null;
      if (len3(x, y - 0.08, z) < 0.42) return "N";
      if (len3(x, y - 0.42, z) < 0.38) return "W";
      if (len3(x, y - 0.72, z) < 0.3) return "K";
      return null;
    },
    skin: ({ x, y, z }) => (y < -0.05 && (Math.abs(Math.sin((Math.atan2(z, x) * 4) + y * 9)) < 0.22 || Math.abs(Math.sin(Math.atan2(z, x) * 4 - y * 9)) < 0.22) ? "N" : null),
  },
  { id: "house", aspect: [1, 0.92, 0.82],
    body: ({ x, y, z }) => {
      if (y < -0.86) return Math.abs(x) < 1 && Math.abs(z) < 0.82 ? "G" : null;
      if (x > 0.42 && x < 0.62 && Math.abs(z + 0.2) < 0.12 && y < 0.88) return "E";     // chimney
      if (y < 0.12) return Math.abs(x) < 0.8 && Math.abs(z) < 0.6 ? (y < -0.78 ? "E" : "F") : null;
      if (y < 0.92) return Math.abs(x) < 0.88 && Math.abs(z) < 0.68 - (y - 0.12) * 0.86 ? "R" : null;
      return null;
    },
    skin: ({ x, y, z }) => {
      if (y >= 0.12 || y < -0.78) return null;
      if (Math.abs(z) > 0.5 && Math.abs(x) < 0.16 && y < -0.28 && z > 0) return "N";         // door
      const wx = Math.abs(Math.abs(x) - 0.48) < 0.14, wy = Math.abs(y + 0.3) < 0.14;
      if (Math.abs(z) > 0.5 && wx && (wy || Math.abs(y + 0.3) < 0.14)) return "S";
      if (Math.abs(x) > 0.7 && Math.abs(z) < 0.18 && Math.abs(y + 0.3) < 0.14) return "S";
      return "W";
    },
  },
  { id: "fish", aspect: [1, 0.7, 0.5],
    body: ({ x, y, z }) => {
      const b = len3((x - 0.08) / 0.76, y / 0.52, z / 0.36);
      if (b < 1) return b > 0.8 ? (Math.abs(x - 0.05) < 0.1 || Math.abs(x + 0.35) < 0.08 ? "W" : "O") : "F";
      if (x < -0.6 && Math.abs(z) < 0.1 && Math.abs(y) < (-0.6 - x) * 1.3 + 0.05) return "Y"; // tail
      if (y > 0.4 && y < 0.66 && Math.abs(z) < 0.08 && Math.abs(x + 0.05) < 0.3 - (y - 0.4)) return "Y"; // fin
      return null;
    },
    skin: ({ x, y, z }) => (len3(x - 0.56, y - 0.12, Math.abs(z) - 0.22) < 0.09 ? "D" : null),
  },
  { id: "penguin", aspect: [0.8, 1, 0.72],
    body: ({ x, y, z }) => {
      if (y < -0.86 && Math.abs(Math.abs(x) - 0.22) < 0.16 && z > -0.1 && z < 0.5) return "O"; // feet
      if (len3(x / 1.5, y - 0.42, (z - 0.5) / 1.4) < 0.08) return "O";   // beak
      if (len3(x, y - 0.42, z) < 0.42) return "D";
      const b = len3(x / 0.74, (y + 0.3) / 0.62, z / 0.62);
      if (b < 1) return "D";
      if (b < 1.18 && Math.abs(x) > 0.6 && y > -0.6 && y < 0.1 && Math.abs(z) < 0.3) return "D"; // flippers
      return null;
    },
    skin: ({ x, y, z }) => {
      if (z > 0.18 && y < 0.36 && len2(x / 0.62, (y + 0.25) / 0.7) < 1) return "W"; // belly
      if (z > 0.2 && Math.abs(y - 0.52) < 0.07 && Math.abs(Math.abs(x) - 0.14) < 0.07) return "W";
      return null;
    },
  },
  { id: "saturn", aspect: [1, 0.6, 1],
    body: ({ x, y, z }) => {
      if (len3(x, y, z) < 0.56) {
        const R = len3(x, y, z);
        if (R > 0.46) return Math.floor((y + 1) * 9) % 3 === 0 ? "O" : Math.floor((y + 1) * 9) % 3 === 1 ? "F" : "Y";
        return R > 0.25 ? "N" : "R";
      }
      const rr = len2(x, z), tilt = y - 0.2 * x;
      if (Math.abs(tilt) < 0.07 && rr > 0.68 && rr < 1) return rr > 0.86 ? "E" : "W";
      return null;
    },
  },
  { id: "robot", aspect: [0.9, 1, 0.66],
    body: ({ x, y, z }) => {
      const ax = Math.abs(x);
      if (y > 0.86 && len2(x, z) < 0.06) return "E";                      // antenna
      if (len3(x, y - 0.97, z) < 0.08) return "R";
      if (y > 0.3 && y <= 0.86) return ax < 0.5 && Math.abs(z) < 0.46 ? "E" : null;  // head
      if (y > 0.2 && y <= 0.3) return ax < 0.18 && Math.abs(z) < 0.18 ? "D" : null; // neck
      if (y > -0.5 && y <= 0.2) {
        if (ax < 0.62 && Math.abs(z) < 0.4) return "B";
        if (ax >= 0.66 && ax < 0.86 && Math.abs(z) < 0.16 && y > -0.4) return "E"; // arms
        return null;
      }
      if (y > -1 && y <= -0.5) return Math.abs(ax - 0.3) < 0.16 && Math.abs(z) < 0.2 ? (y < -0.86 ? "D" : "E") : null;
      return null;
    },
    skin: ({ x, y, z }) => {
      if (z > 0.3 && y > 0.5 && y < 0.7 && Math.abs(Math.abs(x) - 0.22) < 0.1) return "S";  // eyes
      if (z > 0.3 && Math.abs(y - 0.4) < 0.04 && Math.abs(x) < 0.26) return "D";            // mouth
      if (z > 0.3 && y > -0.3 && y < 0.05 && Math.abs(x) < 0.3) return Math.abs(x) < 0.1 ? "R" : "Y"; // chest panel
      return null;
    },
  },
  { id: "owl", aspect: [0.82, 1, 0.72],
    body: ({ x, y, z }) => {
      if (y < -0.84) return Math.abs(Math.abs(x) - 0.2) < 0.14 && z > 0 && z < 0.45 ? "Y" : y < -0.9 && Math.abs(z) < 0.2 ? "N" : null; // feet, branch
      if (y > 0.62 && Math.abs(Math.abs(x) - 0.42) < 0.12 && Math.abs(z) < 0.18 && y < 0.9 - Math.abs(Math.abs(x) - 0.42)) return "N"; // ear tufts
      const b = len3(x / 0.78, (y + 0.05) / 0.82, z / 0.64);
      if (b < 1) return b > 0.8 ? "N" : "F";
      return null;
    },
    skin: ({ x, y, z }) => {
      if (z < 0.1) return null;
      const ex = Math.abs(Math.abs(x) - 0.26), ey = y - 0.38;
      if (len2(ex, ey) < 0.1) return "D";
      if (len2(ex, ey) < 0.22) return "Y";
      if (Math.abs(x) < 0.07 && y > 0.12 && y < 0.3) return "O";
      if (y < 0.08 && Math.abs(x) < 0.48) return (Math.floor(y * 12) + Math.floor(x * 10)) % 2 ? "F" : "W";
      return null;
    },
  },
  // ---- Added in the second batch (November 2026) ----------------------------------------------------------------
  { id: "burger", aspect: [1, 0.8, 1],
    body: ({ x, y, z }) => {
      const rr = len2(x, z), a = Math.atan2(z, x);
      if (y < -0.5) return rr < 0.9 - Math.max(0, -0.66 - y) * 1.6 ? (rr > 0.78 || y < -0.7 ? "O" : "F") : null; // bottom bun
      if (y < -0.25) return rr < 0.95 ? (rr > 0.8 ? "N" : "R") : null;             // patty, pink inside
      if (y < -0.16) return Math.max(Math.abs(x), Math.abs(z)) < 0.86 ? "Y" : null; // a square slice of cheese
      if (y < -0.06) return rr < 0.96 + 0.06 * Math.sin(10 * a) ? (rr > 0.84 ? "L" : "G") : null; // lettuce
      if (y < 0.04) return rr < 0.84 ? (rr > 0.7 ? "R" : "K") : null;              // tomato
      const q = len3(x, (y - 0.04) / 0.76, z);
      return q < 0.94 ? (q > 0.82 ? "O" : "F") : null;                             // top bun
    },
    skin: ({ x, y, z, i, j, k }) => (y > 0.2 && hash3(i, j, k, 23) > 0.86 ? "W" : null), // sesame
  },
  { id: "turtle", aspect: [1, 0.62, 0.86],
    body: ({ x, y, z }) => {
      if (len3(x - 0.76, y + 0.18, z) < 0.18) return "L";                          // head
      for (const [lx, lz] of [[0.42, 0.4], [0.42, -0.4], [-0.42, 0.4], [-0.42, -0.4]]) {
        if (y < -0.24 && len2(x - lx, z - lz) < 0.14) return "L";                   // legs
      }
      if (len3(x + 0.8, y + 0.32, z) < 0.09) return "L";                           // tail
      if (y > -0.36 && y < -0.24) return len2(x / 0.74, z / 0.62) < 1 ? "Y" : null; // the plate underneath
      if (y < -0.24) return null;
      const q = len3(x / 0.74, (y + 0.24) / 0.84, z / 0.62);
      if (q > 1) return null;
      return q > 0.86 ? "G" : q > 0.6 ? "N" : "F";
    },
    skin: ({ x, y, z }) => {
      if (len3(x - 0.86, y + 0.12, Math.abs(z) - 0.08) < 0.06) return "D";        // eyes
      if (y < -0.2) return null;
      const u = Math.atan2(z, x) * 3, v = y * 7;
      return Math.abs(Math.sin(u)) < 0.16 || Math.abs(Math.sin(v)) < 0.14 ? "L" : null; // shell plates
    },
  },
  { id: "strawberry", aspect: [0.86, 1, 0.86],
    body: ({ x, y, z }) => {
      const rr = len2(x, z), a = Math.atan2(z, x);
      if (y > 0.5 && y < 0.95 && rr < 0.07) return "G";                            // stem
      if (y > 0.46 && y < 0.62 && rr < 0.62 * (0.55 + 0.45 * Math.cos(5 * a))) return "G"; // leaves
      const t = (y + 1) / 1.52;
      if (t < 0 || t > 1) return null;
      const r = 0.84 * Math.sqrt(Math.sin(t * Math.PI * 0.64)) * (1 - 0.18 * t * t);
      if (rr > r) return null;
      return rr > r - 0.12 ? "R" : rr < r * 0.32 ? "W" : "K";
    },
    skin: ({ y, i, j, k }) => (y < 0.44 && hash3(i, j, k, 29) > 0.82 ? "Y" : null), // seeds
  },
  { id: "cupcake", aspect: [0.9, 1, 0.9],
    body: ({ x, y, z }) => {
      const rr = len2(x, z), a = Math.atan2(z, x);
      if (len3(x, y - 0.84, z) < 0.14) return "R";                                // cherry
      if (y > 0.9 && y < 1 && len2(x - 0.04, z) < 0.035) return "G";
      if (y < -0.15) {
        const r = 0.6 + 0.2 * ((y + 1) / 0.85);
        if (rr > r) return null;
        return rr > r - 0.1 ? (Math.cos(14 * a) > 0 ? "S" : "W") : "N";           // wrapper, chocolate cake
      }
      const t = (y + 0.15) / 0.92;
      const r = 0.86 * Math.pow(1 - t, 0.75) * (0.92 + 0.08 * Math.sin(t * 18 + a * 2));
      return rr < r ? (rr > r - 0.14 ? "K" : "W") : null;                        // a swirl of frosting
    },
    skin: ({ y, i, j, k }) => {
      if (y < -0.12 || y > 0.7) return null;
      const h = hash3(i, j, k, 31);
      return h > 0.94 ? "Y" : h > 0.9 ? "S" : h > 0.87 ? "L" : null;               // sprinkles
    },
  },
  { id: "ladybug", aspect: [1, 0.6, 0.82],
    body: ({ x, y, z }) => {
      if (y < -0.56) return Math.abs(Math.abs(x) - 0.28) < 0.06 && Math.abs(z) < 0.62 ? "D" : null; // legs
      if (len3(x - 0.66, y + 0.24, z) < 0.26) return "D";                        // head
      if (y < -0.5) return len2(x / 0.76, z / 0.68) < 1 ? "D" : null;
      const q = len3(x / 0.76, (y + 0.5) / 1.06, z / 0.68);
      if (q > 1) return null;
      return q > 0.84 ? "R" : q > 0.5 ? "O" : "Y";
    },
    skin: ({ x, y, z }) => {
      if (len3(x - 0.82, y + 0.14, Math.abs(z) - 0.12) < 0.07) return "W";        // eyes
      if (x > 0.5 || y < -0.48) return null;
      if (Math.abs(z) < 0.035 && x > -0.7) return "D";                            // where the wings meet
      for (const [sx, sz] of [[0.2, 0.3], [-0.2, 0.4], [-0.45, 0.18], [0.3, 0.05], [-0.1, 0.1], [0, 0.55]]) {
        if (len2(x - sx, Math.abs(z) - sz) < 0.13) return "D";                    // spots, both sides
      }
      return null;
    },
  },
  { id: "frog", aspect: [1, 0.8, 0.92],
    body: ({ x, y, z }) => {
      const rr = len2(x, z);
      if (y < -0.68) return rr < 0.98 && !(z > 0.2 && Math.abs(x) < z * 0.35) ? (y < -0.74 ? "G" : "L") : null; // lily pad
      for (const s of [-1, 1]) {
        if (len3(x - s * 0.3, y - 0.3, z - 0.2) < 0.2) return "L";                // eyes on top
        if (len3((x - s * 0.58) / 0.8, (y + 0.5) / 0.6, z - 0.1) < 0.24) return "L"; // back legs
        if (len3(x - s * 0.36, y + 0.6, z - 0.5) < 0.1) return "L";               // front feet
      }
      const q = len3(x / 0.7, (y + 0.2) / 0.52, z / 0.64);
      if (q > 1) return null;
      return q > 0.84 ? "L" : q > 0.5 ? "G" : "Y";
    },
    skin: ({ x, y, z }) => {
      const ex = Math.abs(x) - 0.3;
      if (len3(ex, y - 0.34, z - 0.36) < 0.09) return "D";                        // pupils
      if (len3(ex, y - 0.32, z - 0.3) < 0.15 && z > 0.25) return "W";
      if (z > 0.3 && y < -0.05 && y > -0.5 && len2(x / 0.55, (y + 0.3) / 0.25) < 1) return "Y"; // belly
      if (z > 0.4 && Math.abs(y - 0.06) < 0.035 && Math.abs(x) < 0.34) return "K"; // smile
      return null;
    },
  },
  { id: "castle", aspect: [1, 0.9, 1],
    body: ({ x, y, z }) => {
      const ax = Math.abs(x), az = Math.abs(z), m = Math.max(ax, az);
      if (y < -0.78) return m < 0.98 ? "G" : null;                                // the hill
      for (const [tx, tz] of [[0.66, 0.66], [-0.66, 0.66], [0.66, -0.66], [-0.66, -0.66]]) {
        const r = len2(x - tx, z - tz);
        if (r < 0.24 && y < 0.42) return "E";                                      // corner towers
        if (y >= 0.42 && y < 0.86 && r < 0.27 * (1 - (y - 0.42) / 0.44)) return "R"; // their roofs
      }
      if (m > 0.52 && m < 0.68 && y < 0.1) return "E";                            // walls
      if (m > 0.52 && m < 0.68 && y < 0.22) return (Math.floor((x + z + 2) * 7) % 2) ? "E" : null; // battlements
      if (m <= 0.52 && y < -0.6) return "N";                                     // the yard
      if (ax < 0.3 && az < 0.3 && y < 0.5) return y < -0.2 ? "N" : "W";           // the keep
      if (y >= 0.5 && y < 0.96 && len2(x, z) < 0.34 * (1 - (y - 0.5) / 0.46)) return "B";
      return null;
    },
    skin: ({ x, y, z }) => {
      if (z > 0.6 && Math.abs(x) < 0.16 && y < -0.3 && y > -0.78) return "N";     // the gate
      if (y > -0.2 && y < 0.05 && Math.abs(Math.abs(x) - 0.3) < 0.07 && Math.max(Math.abs(x), Math.abs(z)) > 0.6) return "D";
      if (y > 0.1 && y < 0.3 && Math.max(Math.abs(x), Math.abs(z)) < 0.31 && (Math.abs(x) < 0.06 || Math.abs(z) < 0.06)) return "D"; // keep windows
      return null;
    },
  },
  { id: "balloon", aspect: [0.84, 1, 0.84],
    body: ({ x, y, z }) => {
      const rr = len2(x, z), a = Math.atan2(z, x);
      if (y < -0.72) return Math.max(Math.abs(x), Math.abs(z)) < 0.2 ? (y > -0.78 ? "D" : "N") : null; // basket
      if (y < -0.3) {                                                             // ropes
        const f = (y + 0.72) / 0.42, rx = 0.17 + f * 0.2;
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (len2(x - sx * rx, z - sz * rx) < 0.035) return "D";
        return null;
      }
      const q = len3(x, (y - 0.25) / (y < 0.25 ? 0.6 : 0.74), z) / 0.82;
      if (q > 1 || y < -0.3) return null;
      if (q < 0.55) return "Y";                                                   // the warm inside
      if (q < 0.82) return "O";
      const seg = Math.floor(((a + Math.PI) / TAU) * 10) % 5;
      return y > 0.76 ? "W" : "RYBGP"[seg];                                       // stripes
    },
    skin: ({ x, y, z }) => (Math.abs(y - 0.25) < 0.04 ? "W" : null),
  },
  { id: "gift", aspect: [0.9, 0.9, 0.9],
    body: ({ x, y, z }) => {
      const ax = Math.abs(x), az = Math.abs(z);
      for (const s of [-1, 1]) {
        const d = len3((x - s * 0.24) / 1.6, (y - 0.74) / 1, z / 0.7);
        if (d < 0.17 && d > 0.07) return "Y";                                     // the bow
      }
      if (len3(x, y - 0.7, z) < 0.08) return "Y";
      if (y > 0.4 && y < 0.62) return ax < 0.86 && az < 0.86 ? (ax < 0.12 || az < 0.12 ? "Y" : "P") : null; // the lid
      if (y < -0.9 || y >= 0.4 || ax >= 0.8 || az >= 0.8) return null;
      if (ax > 0.7 || az > 0.7 || y < -0.8) return ax < 0.12 || az < 0.12 ? "Y" : "P"; // the box
      if (len3(x, (y + 0.22) / 0.9, z) < 0.36) return len3(x, y + 0.22, z) < 0.18 ? "K" : "R"; // a surprise inside
      return "W";                                                                // tissue paper
    },
    skin: ({ x, y, z, i, j, k }) => (Math.abs(x) >= 0.12 && Math.abs(z) >= 0.12 && hash3(i >> 1, j >> 1, k >> 1, 37) > 0.8 ? "K" : null), // dots
  },
  { id: "bee", aspect: [1, 0.84, 0.76],
    body: ({ x, y, z }) => {
      if (len3(x - 0.66, y + 0.06, z) < 0.28) return "D";                         // head
      if (y > 0.86 - 0.1 && Math.abs(Math.abs(z) - 0.1) < 0.04 && Math.abs(x - 0.72) < 0.04) return "D";
      for (const s of [-1, 1]) {
        if (len3((x + 0.05) / 0.36, (y - 0.46) / 0.12, (z - s * 0.32) / 0.26) < 1) return "S"; // wings
        if (len3(x - 0.66 - 0.06 * (y - 0.24), 0, z - s * 0.1) < 0.04 && y > 0.18 && y < 0.6) return "D"; // feelers
      }
      if (x < -0.66 && len2(y + 0.1, z) < 0.12 * (1 + (x + 0.66) * 4)) return "D"; // sting
      const q = len3((x + 0.04) / 0.68, (y + 0.1) / 0.5, z / 0.5);
      if (q > 1) return null;
      if (q < 0.6) return "O";                                                    // honey
      return Math.floor((x + 1.2) * 5.5) % 2 ? "Y" : "D";                         // stripes
    },
    skin: ({ x, y, z }) => (len3(x - 0.84, y + 0.0, Math.abs(z) - 0.12) < 0.07 ? "W" : null),
  },
];

const SCULPT_BY_ID = Object.fromEntries(SCULPTS.map((s) => [s.id, s]));
export const sculptById = (id) => SCULPT_BY_ID[id];

// ---- Making a grid ----------------------------------------------------------------------------------------------
/** Build a model on a grid of size N: { id, w, h, d, cells }, cropped to what is filled. */
export function voxelize(def, N) {
  const [aw, ah, ad] = def.aspect;
  const W = Math.max(1, Math.round(N * aw)), H = Math.max(1, Math.round(N * ah)), D = Math.max(1, Math.round(N * ad));
  const half = N / 2;
  const at = (i, j, k) => ({ x: (i + 0.5 - W / 2) / half, y: (j + 0.5 - H / 2) / half, z: (k + 0.5 - D / 2) / half, i, j, k, N });
  const full = new Uint8Array(W * H * D);
  const idx = (i, j, k) => (j * D + k) * W + i;
  for (let j = 0; j < H; j++) for (let k = 0; k < D; k++) for (let i = 0; i < W; i++) {
    const c = def.body(at(i, j, k));
    if (c) full[idx(i, j, k)] = COLOR_OF[c];
  }
  if (def.skin) {
    const filled = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < W && j < H && k < D && full[idx(i, j, k)] > 0;
    const out = full.slice();
    for (let j = 0; j < H; j++) for (let k = 0; k < D; k++) for (let i = 0; i < W; i++) {
      if (!full[idx(i, j, k)]) continue;
      if (filled(i - 1, j, k) && filled(i + 1, j, k) && filled(i, j - 1, k) && filled(i, j + 1, k) && filled(i, j, k - 1) && filled(i, j, k + 1)) continue;
      const c = def.skin(at(i, j, k));
      if (c) out[idx(i, j, k)] = COLOR_OF[c];
    }
    full.set(out);
  }
  return crop({ id: def.id, w: W, h: H, d: D, cells: full });
}

/** Cut away empty borders. */
function crop(s) {
  const { w, h, d, cells } = s;
  let x0 = w, x1 = -1, y0 = h, y1 = -1, z0 = d, z1 = -1;
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    if (!cells[(y * d + z) * w + x]) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  if (x1 < 0) return s;
  const W = x1 - x0 + 1, H = y1 - y0 + 1, D = z1 - z0 + 1, out = new Uint8Array(W * H * D);
  for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) out[(y * D + z) * W + x] = cells[((y + y0) * d + (z + z0)) * w + (x + x0)];
  return { id: s.id, w: W, h: H, d: D, cells: out };
}

export const countOf = (s) => s.cells.reduce((a, v) => a + (v ? 1 : 0), 0);

/** The smallest grid size that gives a model at least `target` blocks (up to `maxN`). A rough first
 *  guess from a small grid (blocks grow with N³) saves building every size from 8 upwards. */
const made = new Map();
export function sculptFor(def, target, maxN = 64) {
  const key = SCULPT_BY_ID[def.id] === def ? `${def.id}:${target}:${maxN}` : null;
  if (key && made.has(key)) return made.get(key);
  const at = (N) => voxelize(def, Math.max(8, Math.min(maxN, N)));
  const c0 = countOf(at(16));
  let N = Math.max(8, Math.min(maxN, Math.floor(16 * Math.cbrt(target / Math.max(1, c0))) - 1));
  let best = at(N);
  while (N > 8 && countOf(best) >= target) { const s = at(N - 1); if (countOf(s) < target) break; best = s; N--; }
  while (N < maxN && countOf(best) < target) best = at(++N);
  if (key) made.set(key, best);
  return best;
}

// ---- Endless models from a seed -----------------------------------------------------------------------------------
const BRIGHT = ["R", "O", "Y", "L", "G", "T", "S", "B", "P", "K"];
function pick(rng, n, from = BRIGHT) {
  const pool = from.slice(), out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}

/** Layered candy: an egg or ball of shells, with swirls on the outside. */
function candy(rng) {
  const cols = pick(rng, 4 + rng.int(2)), sw = pick(rng, 1, ["W", "F", "D"])[0];
  const ay = 0.8 + rng.float() * 0.2, k = 2 + rng.int(4), tw = rng.range(-5, 5);
  return { id: "candy", aspect: [1, ay, 1],
    body: ({ x, y, z }) => { const r = len3(x, y / ay, z); return r > 1 ? null : cols[Math.min(cols.length - 1, Math.floor((1 - r) * cols.length * 1.15))]; },
    skin: ({ x, y, z }) => (Math.sin(Math.atan2(z, x) * k + y * tw) > 0.4 ? sw : null) };
}
/** A world: oceans, land and ice over a layered inside. */
function world(rng) {
  const [sea, land, land2, sand] = [pick(rng, 1, ["B", "T", "S", "P"])[0], ...pick(rng, 3, ["G", "L", "O", "Y", "N", "R", "K"])];
  const s = rng.int(1000), inner = pick(rng, 3, ["N", "O", "Y", "R", "D", "E"]);
  return { id: "world", aspect: [1, 1, 1],
    body: ({ x, y, z }) => {
      const r = len3(x, y, z);
      if (r > 1) return null;
      if (r > 0.86) {
        if (Math.abs(y) > 0.84) return "W";
        const n = fbm(x * 2.4 + 3, y * 2.4, z * 2.4, s);
        return n > 0.57 ? (n > 0.65 ? land2 : land) : n > 0.53 ? sand : sea;
      }
      return r > 0.62 ? inner[0] : r > 0.34 ? inner[1] : inner[2];
    } };
}
/** A block of rock strata, wavy layers top to bottom, with a crystal vein. */
function strata(rng) {
  const cols = pick(rng, 5 + rng.int(2), BRIGHT.concat(["N", "F", "E"])), s = rng.int(1000), vein = pick(rng, 1, ["W", "K", "S"])[0];
  return { id: "strata", aspect: [0.84, 0.84, 0.84],
    body: ({ x, y, z }) => {
      const t = y * 1.6 + (fbm(x * 1.5, 0, z * 1.5, s) - 0.5) * 1.6;
      if (Math.abs(x * 0.7 + z * 0.4 - y * 0.6 + (noise3(x * 3, y * 3, z * 3, s + 1) - 0.5) * 0.3) < 0.07) return vein;
      return cols[Math.max(0, Math.min(cols.length - 1, Math.floor((t + 1.4) / 2.8 * cols.length)))];
    } };
}
/** A totem: stacked rounded shapes of different colours. */
function totem(rng) {
  const n = 3 + rng.int(2), parts = [];
  let y = -1;
  for (let i = 0; i < n; i++) {
    const hgt = 2 / n, r = 0.5 + rng.float() * 0.45;
    parts.push({ y0: y, y1: y + hgt, r, c: pick(rng, 2), kind: rng.int(3) });
    y += hgt;
  }
  return { id: "totem", aspect: [0.95, 1, 0.95],
    body: ({ x, y, z }) => {
      for (const p of parts) {
        if (y < p.y0 || y >= p.y1) continue;
        const t = (y - p.y0) / (p.y1 - p.y0), rr = p.kind === 0 ? len2(x, z) : p.kind === 1 ? Math.max(Math.abs(x), Math.abs(z)) : Math.abs(x) + Math.abs(z);
        const lim = p.r * (0.75 + 0.25 * Math.sin(t * Math.PI));
        if (rr < lim) return rr > lim - 0.16 ? p.c[0] : p.c[1];
      }
      return null;
    } };
}
const MAKERS = [candy, world, strata, totem];

/** Endless model number k, with about `target` blocks. */
export function madeSculpture(rng, k, target) {
  const def = MAKERS[k % MAKERS.length](rng);
  const s = sculptFor(def, target);
  s.id = def.id + "-" + k;
  return s;
}
