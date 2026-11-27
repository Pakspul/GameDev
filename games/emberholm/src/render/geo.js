// Building blocks for low-poly models made in code: coloured shapes, placed and merged into one
// geometry (one draw call). Colours are per vertex, so a whole tree or house is one mesh.
import * as THREE from "../../../../shared/vendor/three-r186/three.module.js";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();

/**
 * A shape with a colour, moved into place: part(geometry, "#hex", { x, y, z, rx, ry, rz, sx, sy, sz }).
 * Returns a non-indexed geometry with a colour attribute.
 */
export function part(geo, color, t = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
  _q.setFromEuler(_e);
  _m.compose(new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0), _q,
    new THREE.Vector3(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1));
  g.applyMatrix4(_m);
  _c.set(color);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "color" && k !== "normal") g.deleteAttribute(k);
  return g;
}

/** Many parts into one geometry. */
export function merge(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Triangles from a flat list of points [[x, y, z], ...], three per triangle (counter-clockwise from outside). */
export function tris(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(points.flat()), 3));
  return g;
}

/** A gable roof: length w along x, depth d along z, ridge height h, sitting on y = 0. */
export function roof(w, d, h) {
  const x = w / 2, z = d / 2;
  const A = [-x, 0, z], B = [x, 0, z], C = [x, h, 0], D = [-x, h, 0], E = [-x, 0, -z], F = [x, 0, -z];
  return tris([A, B, C, A, C, D, F, E, D, F, D, C, B, F, C, E, A, D]);
}

/** Small deterministic wobble of a geometry's points, so rocks aren't perfect shapes. */
export function wobble(geo, amount, seed = 1) {
  const p = geo.attributes.position;
  const key = (x, y, z) => Math.round(x * 100) * 73856093 ^ Math.round(y * 100) * 19349663 ^ Math.round(z * 100) * 83492791 ^ seed;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.imul(key(x, y, z), 2654435761) >>> 0;
    const f = 1 + ((h % 1000) / 1000 - 0.5) * amount;
    p.setXYZ(i, x * f, y * f, z * f);
  }
  return geo;
}

export { THREE };
