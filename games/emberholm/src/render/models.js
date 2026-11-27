// The low-poly models of the world, built in code: trees, rocks, bushes, grass, and the places'
// buildings. Each returns one geometry with colours per vertex. Models face -z (north) and stand on y = 0.
import { THREE, part, merge, roof, wobble } from "./geo.js";

const Cyl = (rt, rb, h, n = 6) => new THREE.CylinderGeometry(rt, rb, h, n);
const Cone = (r, h, n = 6) => new THREE.ConeGeometry(r, h, n);
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const Dode = (r) => new THREE.DodecahedronGeometry(r, 0);

// ---- Nature (drawn instanced) ----------------------------------------------------------------------------------

export const NATURE = {
  pine: () => merge([
    part(Cyl(0.16, 0.26, 1.8, 5), "#5a4230", { y: 0.9 }),
    part(Cone(1.55, 2.3, 7), "#2e5634", { y: 2.3 }),
    part(Cone(1.2, 2.0, 7), "#35603a", { y: 3.35, ry: 0.4 }),
    part(Cone(0.8, 1.7, 7), "#3d6b40", { y: 4.35, ry: 0.8 }),
  ]),
  birch: () => merge([
    part(Cyl(0.1, 0.17, 3.4, 5), "#e6e1d5", { y: 1.7 }),
    part(Box(0.2, 0.08, 0.2), "#3b3a36", { y: 1.1, ry: 0.5 }),
    part(Box(0.16, 0.06, 0.18), "#3b3a36", { y: 2.2, ry: 1.1 }),
    part(Ico(1.25), "#8aa847", { y: 3.7, sy: 1.15 }),
    part(Ico(0.9), "#9bb552", { x: 0.55, y: 4.5, z: 0.15 }),
    part(Ico(0.8), "#7f9d42", { x: -0.6, y: 3.3, z: -0.3 }),
  ]),
  rock: () => merge([part(wobble(Dode(1), 0.3, 7), "#8b8d87", { sy: 0.72, sz: 1.12 })]),
  bush: () => merge([
    part(wobble(Ico(0.75), 0.25, 3), "#4b7638", { y: 0.45, sy: 0.75 }),
    part(wobble(Ico(0.5), 0.25, 4), "#578342", { x: 0.45, y: 0.35, z: 0.2, sy: 0.8 }),
  ]),
  deadtree: () => merge([
    part(Cyl(0.08, 0.2, 3.2, 5), "#4a4038", { y: 1.6, rz: 0.06 }),
    part(Cyl(0.04, 0.08, 1.4, 4), "#4a4038", { x: 0.45, y: 2.3, rz: -0.9 }),
    part(Cyl(0.03, 0.07, 1.1, 4), "#4a4038", { x: -0.35, y: 2.75, rz: 0.8 }),
  ]),
  tuft: () => merge([
    part(Cone(0.07, 0.7, 3), "#6f9142", { x: 0, y: 0.32, rz: 0.15 }),
    part(Cone(0.06, 0.55, 3), "#7e9e4a", { x: 0.12, y: 0.25, z: 0.05, rz: -0.35 }),
    part(Cone(0.06, 0.6, 3), "#66883c", { x: -0.1, y: 0.28, z: -0.06, rx: 0.3 }),
  ]),
};

// Far away the same things with far fewer triangles (beyond CONFIG.view.nearNature metres).
export const NATURE_FAR = {
  pine: () => merge([
    part(Cyl(0.2, 0.2, 1.4, 3), "#5a4230", { y: 0.7 }),
    part(Cone(1.5, 4.0, 5), "#325d37", { y: 3.0 }),
  ]),
  birch: () => merge([
    part(Cyl(0.13, 0.13, 3.0, 3), "#e6e1d5", { y: 1.5 }),
    part(new THREE.OctahedronGeometry(1.45), "#8aa847", { y: 3.9, sy: 1.1 }),
  ]),
  rock: () => merge([part(new THREE.OctahedronGeometry(1), "#8b8d87", { sy: 0.6, sz: 1.1 })]),
  bush: () => merge([part(new THREE.OctahedronGeometry(0.75), "#4b7638", { y: 0.4, sy: 0.7 })]),
  deadtree: () => merge([part(Cyl(0.06, 0.18, 3.2, 3), "#4a4038", { y: 1.6 })]),
};

// ---- The places' buildings (merged into one static mesh) -------------------------------------------------------

const WOOD = "#5c4431", DARK = "#3a2c22", TURF = "#6b7b44", STONE = "#8a8983", HIDE = "#a58a63";

function house(s) {
  const { w, d } = s;
  const out = [
    part(Box(w, 2.4, d), WOOD, { y: 1.2 }),
    part(roof(w + 1.2, d + 1.6, 3.2), TURF, { y: 2.3 }),
    part(Box(1.3, 1.9, 0.12), DARK, { y: 0.95, z: d / 2 + 0.03 }),                 // door
  ];
  // Crossed gable boards at both ends of the ridge.
  for (const sx of [-1, 1]) {
    out.push(part(Cyl(0.08, 0.08, 1.7, 4), DARK, { x: sx * (w / 2 + 0.6), y: 5.75, z: -0.35, rx: -0.65 }));
    out.push(part(Cyl(0.08, 0.08, 1.7, 4), DARK, { x: sx * (w / 2 + 0.6), y: 5.75, z: 0.35, rx: 0.65 }));
  }
  return out;
}

function greatFire(s) {
  const out = [];
  const n = s.camp ? 6 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(part(wobble(Dode(s.camp ? 0.3 : 0.45), 0.3, i), STONE, { x: Math.cos(a) * s.r, y: 0.15, z: Math.sin(a) * s.r, sy: 0.7 }));
  }
  const L = s.camp ? 1.4 : 2.6;
  for (let i = 0; i < 3; i++) out.push(part(Cyl(0.14, 0.14, L, 5), DARK, { y: 0.25, rz: Math.PI / 2, ry: (i / 3) * Math.PI }));
  return out;
}

function waystone() {
  return [
    part(wobble(Box(0.85, 2.7, 0.5), 0.12, 5), "#7d8790", { y: 1.25, rz: 0.06 }),
    part(wobble(Dode(0.5), 0.3, 9), STONE, { x: 0.5, y: 0.1, z: 0.3, sy: 0.6 }),
  ];
}

function tower(s) {
  const out = [
    part(Cyl(s.r * 0.9, s.r, s.h, 8), STONE, { y: s.h / 2 }),
    part(Cyl(s.r * 1.08, s.r * 1.08, 0.6, 8), "#7a7973", { y: s.h + 0.3 }),
    part(Box(1.1, 2, 0.2), DARK, { y: 1, z: s.r - 0.05 }),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    out.push(part(Box(0.7, 0.7, 0.5), "#7a7973", { x: Math.cos(a) * s.r, y: s.h + 0.95, z: Math.sin(a) * s.r, ry: -a }));
  }
  if (s.beacon) {
    out.push(part(Cone(1.4, 1.2, 8), "#2b2826", { y: s.h + 1.3, rx: Math.PI }));
    out.push(part(Cyl(0.15, 0.15, 1.6, 5), DARK, { y: s.h + 1.7, rz: 1.2 }), part(Cyl(0.15, 0.15, 1.6, 5), DARK, { y: s.h + 1.7, rz: -1.2, ry: 1 }));
  }
  return out;
}

function tent(s) {
  return [
    part(Cone(s.r, 2.5, 6), HIDE, { y: 1.25 }),
    part(Cyl(0.05, 0.05, 0.8, 4), DARK, { y: 2.7 }),
    part(Box(0.8, 1.2, 0.1), DARK, { y: 0.6, z: s.r * 0.72, rx: -0.38 }),
  ];
}

function wreck() {
  // A longship on its side, half in the sand: hull, ribs, a broken mast, a torn sail.
  return [
    part(Box(9, 1.3, 2.8), "#4d3a2b", { y: 0.5, rz: 0.06, rx: 0.32 }),
    part(Cone(1.45, 2.2, 4), "#4d3a2b", { x: 5.4, y: 0.6, rz: -Math.PI / 2, rx: 0.32, sz: 0.5 }),
    part(Cone(1.45, 2.2, 4), "#4d3a2b", { x: -5.4, y: 0.6, rz: Math.PI / 2, rx: 0.32, sz: 0.5 }),
    part(Cyl(0.08, 0.08, 3, 4), DARK, { x: 6.4, y: 1.9, rz: -0.5 }),
    part(Cyl(0.14, 0.16, 3.6, 5), "#6a5038", { x: 0.5, y: 1.4, z: -1.8, rx: -1.15 }),
    part(Box(2.6, 1.8, 0.05), "#c9b796", { x: 0.2, y: 0.45, z: -3.6, rx: -1.45, rz: 0.2 }),
    part(Box(0.6, 0.15, 0.7), "#8a6b45", { x: -2.5, y: 0.1, z: 2.4 }),                   // a crate washed up
  ];
}

function mill() {
  return [
    ...house({ w: 7, d: 6.5 }),
    part(Cyl(2.4, 2.4, 0.4, 10), "#6a5038", { x: 4.1, y: 2.2, rz: Math.PI / 2 }),
    part(Box(0.3, 4.6, 0.3), DARK, { x: 4.35, y: 2.2 }),
    part(Box(0.3, 0.3, 4.6), DARK, { x: 4.35, y: 2.2 }),
  ];
}

function barrowDoor() {
  return [
    part(Box(0.5, 1.9, 0.5), STONE, { x: -0.9, y: 0.75 }),
    part(Box(0.5, 1.9, 0.5), STONE, { x: 0.9, y: 0.75 }),
    part(Box(2.5, 0.45, 0.65), "#7b7a74", { y: 1.85 }),
    part(Box(1.3, 1.6, 0.1), "#17130f", { y: 0.65, z: -0.2 }),
  ];
}

function fence(s) {
  const out = [];
  const n = Math.max(2, Math.round(s.len / 1.6));
  for (let i = 0; i <= n; i++) out.push(part(Box(0.16, 1.3, 0.16), DARK, { x: -s.len / 2 + (i / n) * s.len, y: 0.55 }));
  out.push(part(Box(s.len, 0.1, 0.08), WOOD, { y: 0.9 }), part(Box(s.len, 0.1, 0.08), WOOD, { y: 0.45 }));
  return out;
}

export const BUILD = { house, fire: greatFire, stone: waystone, tower, tent, wreck, mill, barrow: barrowDoor, fence };

/** Flames: two cones, drawn with an unlit material and flickered by scaling. */
export function flameGeometry() {
  return merge([
    part(Cone(0.9, 2.4, 6), "#ff8a2a", { y: 1.2 }),
    part(Cone(0.55, 1.8, 6), "#ffd36a", { y: 0.95, ry: 0.5 }),
  ]);
}

/** The glowing runes on a waystone (unlit). */
export function runeGeometry() {
  return merge([
    part(Box(0.08, 1.1, 0.04), "#8fd3ff", { y: 1.5, z: 0.27 }),
    part(Box(0.5, 0.07, 0.04), "#8fd3ff", { y: 1.75, z: 0.27, rz: 0.5 }),
    part(Box(0.4, 0.07, 0.04), "#8fd3ff", { y: 1.3, z: 0.27, rz: -0.6 }),
  ]);
}
