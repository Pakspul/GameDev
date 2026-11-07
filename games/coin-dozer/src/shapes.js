// Shapes shared by the physics and the renderer, so a prize looks exactly as big as it collides.
//
// A gem is a stack of rings (regular polygons) from its bottom point to its table. The four colours
// have four different cuts, so they can be told apart without colour (docs/COIN-DOZER.md, UI rules).
import { CONFIG } from "./config.js";

export const GEM_COLOURS = ["red", "blue", "green", "yellow"];

// sides: polygon corners; sx: stretch along x; rings: [radius, y] as fractions of size and height.
export const GEM_CUTS = {
  red: { sides: 8, sx: 1, rings: [[0, -0.5], [0.5, 0.08], [0.47, 0.2], [0.3, 0.5]] },        // round brilliant
  blue: { sides: 4, sx: 1.35, rot: Math.PI / 4, rings: [[0.18, -0.5], [0.5, -0.05], [0.5, 0.15], [0.34, 0.5]] }, // emerald (step) cut
  green: { sides: 6, sx: 1, rings: [[0.22, -0.5], [0.5, -0.12], [0.5, 0.18], [0.32, 0.5]] },  // hexagon
  yellow: { sides: 3, sx: 1, rot: Math.PI / 2, rings: [[0, -0.5], [0.56, 0.05], [0.5, 0.18], [0.3, 0.5]] }, // trillion
};

/** The rings of a gem cut as [[x, y, z], ...] per ring, in world units. */
export function gemRings(colour) {
  const cut = GEM_CUTS[colour];
  const { size, height } = CONFIG.prizes.gem;
  const out = [];
  for (const [r, y] of cut.rings) {
    const ring = [];
    for (let i = 0; i < cut.sides; i++) {
      const a = (cut.rot || 0) + (i / cut.sides) * Math.PI * 2;
      ring.push([Math.cos(a) * r * size * cut.sx, y * height, Math.sin(a) * r * size]);
    }
    out.push(ring);
  }
  return out;
}

/** Every corner of a gem, flat, for a convex hull collider. */
export function gemPoints(colour) {
  const pts = [];
  for (const ring of gemRings(colour)) for (const p of ring) pts.push(p[0], p[1], p[2]);
  return new Float32Array(pts);
}
