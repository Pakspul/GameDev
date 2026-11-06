// Swept circle against axis-aligned rectangles: the ball is a moving circle, and we find the exact
// moment it first touches a brick along its path this step. Because the whole path is tested (not
// just where the ball ends up), a fast ball can never tunnel through a thin brick.
//
// The shape the ball's centre may not enter is the rectangle grown by the radius with rounded
// corners. We test the grown box with the slab method, and if the entry point lies in a corner
// region, against that corner's circle instead.

/**
 * @returns {{t:number, nx:number, ny:number}|null} first contact in [0, 1] along (dx, dy), with the
 *          surface normal at that point, or null if the path misses. A ball that already overlaps
 *          the rectangle and moves deeper gets t = 0 with the push-out normal.
 */
export function sweepRect(px, py, dx, dy, r, x0, y0, x1, y1) {
  // Already overlapping?
  const qx = px < x0 ? x0 : px > x1 ? x1 : px;
  const qy = py < y0 ? y0 : py > y1 ? y1 : py;
  const ox = px - qx, oy = py - qy;
  const d2 = ox * ox + oy * oy;
  if (d2 < r * r - 1e-7) {
    let nx, ny;
    if (d2 > 1e-12) {
      const d = Math.sqrt(d2);
      nx = ox / d; ny = oy / d;
    } else {
      const l = px - x0, rr = x1 - px, t = py - y0, b = y1 - py;
      const m = Math.min(l, rr, t, b);
      nx = m === l ? -1 : m === rr ? 1 : 0;
      ny = nx ? 0 : m === t ? -1 : 1;
    }
    return dx * nx + dy * ny < 0 ? { t: 0, nx, ny } : null;
  }

  const ex0 = x0 - r, ey0 = y0 - r, ex1 = x1 + r, ey1 = y1 + r;
  let tmin = 0, tmax = 1, nx = 0, ny = 0;
  if (dx === 0) {
    if (px < ex0 || px > ex1) return null;
  } else {
    const inv = 1 / dx;
    let t1 = (ex0 - px) * inv, t2 = (ex1 - px) * inv, n = -1;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = n; ny = 0; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (dy === 0) {
    if (py < ey0 || py > ey1) return null;
  } else {
    const inv = 1 / dy;
    let t1 = (ey0 - py) * inv, t2 = (ey1 - py) * inv, n = -1;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; ny = n; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  const hx = px + dx * tmin, hy = py + dy * tmin;
  const inX = hx >= x0 && hx <= x1, inY = hy >= y0 && hy <= y1;
  if (!inX && !inY) {
    // Corner region: the rounded corner is a circle of radius r around the rectangle's corner.
    const cx = hx < x0 ? x0 : x1, cy = hy < y0 ? y0 : y1;
    const t = rayCircle(px, py, dx, dy, cx, cy, r);
    if (t === null) return null;
    const ix = px + dx * t - cx, iy = py + dy * t - cy;
    const len = Math.hypot(ix, iy) || 1;
    return { t, nx: ix / len, ny: iy / len };
  }
  if (nx === 0 && ny === 0) return null;
  return { t: tmin, nx, ny };
}

/** Smallest t in [0, 1] where p + d·t is at distance r from c, or null. */
export function rayCircle(px, py, dx, dy, cx, cy, r) {
  const fx = px - cx, fy = py - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Does a circle overlap a rectangle? */
export function circleRect(px, py, r, x0, y0, x1, y1) {
  const qx = px < x0 ? x0 : px > x1 ? x1 : px;
  const qy = py < y0 ? y0 : py > y1 ? y1 : py;
  return (px - qx) ** 2 + (py - qy) ** 2 < r * r;
}
