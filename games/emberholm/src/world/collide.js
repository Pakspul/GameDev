// What you can't walk through: tree trunks, rocks and the places' buildings. Circles and turned
// boxes on the ground plane; the ground itself (slopes, deep water) is handled in sim/player.js.
import { chunkItems, chunkOf } from "./scatter.js";
import { STRUCTURES } from "./places.js";

/** A structure's footprint: { c: [x, z, r] } for a circle, { b: [x, z, halfW, halfD, rot] } for a box. */
export function footprint(s) {
  switch (s.kind) {
    case "house": return { b: [s.x, s.z, s.w / 2, s.d / 2, s.rot] };
    case "wreck": return { b: [s.x, s.z, 4.6, 1.6, s.rot] };
    case "mill": return { b: [s.x, s.z, 3.6, 3.6, s.rot] };
    case "barrow": return { b: [s.x, s.z, 1.7, 0.6, s.rot] };
    case "fence": return { b: [s.x, s.z, s.len / 2, 0.25, s.rot] };
    case "fire": return { c: [s.x, s.z, s.r] };
    case "tower": return { c: [s.x, s.z, s.r] };
    case "tent": return { c: [s.x, s.z, s.r * 0.9] };
    case "stone": return { c: [s.x, s.z, 0.75] };
    default: return null;
  }
}
const SHAPES = STRUCTURES.map(footprint).filter(Boolean);

/**
 * Push a circle (x, z, r) out of everything it overlaps. Returns the corrected [x, z].
 * Two passes, so being squeezed between two things settles.
 */
export function pushOut(x, z, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (let cz = chunkOf(z - r - 3); cz <= chunkOf(z + r + 3); cz++) {
      for (let cx = chunkOf(x - r - 3); cx <= chunkOf(x + r + 3); cx++) {
        for (const it of chunkItems(cx, cz)) {
          if (!it.r) continue;
          [x, z] = outOfCircle(x, z, r, it.x, it.z, it.r);
        }
      }
    }
    for (const s of SHAPES) {
      if (s.c) [x, z] = outOfCircle(x, z, r, s.c[0], s.c[1], s.c[2]);
      else [x, z] = outOfBox(x, z, r, s.b);
    }
  }
  return [x, z];
}

function outOfCircle(x, z, r, cx, cz, cr) {
  const dx = x - cx, dz = z - cz, min = r + cr;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return [x, z];
  const d = Math.sqrt(d2) || 1e-6;
  return [cx + (dx / d) * min, cz + (dz / d) * min];
}

function outOfBox(x, z, r, [bx, bz, hw, hd, rot]) {
  const dx = x - bx, dz = z - bz;
  if (Math.abs(dx) > hw + hd + r && Math.abs(dz) > hw + hd + r) return [x, z]; // far away
  const c = Math.cos(rot), s = Math.sin(rot);
  // Into the box's own frame (its length along local x).
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hd, Math.min(hd, lz));
  let ox = lx - qx, oz = lz - qz;
  const d2 = ox * ox + oz * oz;
  if (d2 >= r * r) return [x, z];
  let nx, nz;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    nx = qx + (ox / d) * r; nz = qz + (oz / d) * r;
  } else {
    // The centre is inside the box: out through the nearest side.
    const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
    if (px < pz) { nx = Math.sign(lx || 1) * (hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (hd + r); }
  }
  // Back to the world.
  return [bx + nx * c + nz * s, bz - nx * s + nz * c];
}
