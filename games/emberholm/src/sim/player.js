// The player walking around: a circle on the height field. Speed follows the stick, slopes slow
// you down (too steep stops you), deep water stops you, trees, rocks and buildings push you out.
// No three.js here, so tests can walk the player around in Node.
import { CONFIG } from "../config.js";
import { height } from "../world/terrain.js";
import { pushOut } from "../world/collide.js";

const P = CONFIG.player;
const W = CONFIG.world;
const LIMIT = W.size / 2 - 40;

export class Player {
  constructor(x, z, yaw = 0) {
    this.x = x; this.z = z;
    this.y = height(x, z);
    this.vx = 0; this.vz = 0;
    this.yaw = yaw;          // the way the body faces (0 = north, -z; positive turns towards west, like the camera)
    this.speed = 0;          // actual speed over the ground, m/s
    this.depth = 0;          // water depth where you stand
  }

  /**
   * One fixed step. move: [mx, mz] in world space, length 0..1 (the stick, already turned by the camera);
   * run: true to run.
   */
  step(dt, move, run) {
    let [mx, mz] = move;
    let len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; len = 1; }
    let top = run || len > P.runAt ? P.run : P.walk * Math.min(1, len / P.runAt * 1.15);
    if (len < 0.01) top = 0;
    const dirx = len > 0.01 ? mx / len : 0, dirz = len > 0.01 ? mz / len : 0;

    // Slope: uphill slows you down, and too steep stops you.
    if (top > 0) {
      const ahead = height(this.x + dirx * 0.8, this.z + dirz * 0.8);
      const rise = (ahead - this.y) / 0.8;
      if (rise > 0) top *= Math.max(0, 1 - (rise / P.maxSlope) * P.uphillSlow);
      if (rise > P.maxSlope) top = 0;
      // Water slows you down.
      if (this.depth > 0.3) top *= W.wadeSlow;
    }
    // Speed follows the stick smoothly.
    const k = 1 - Math.exp(-P.accel * dt);
    this.vx += (dirx * top - this.vx) * k;
    this.vz += (dirz * top - this.vz) * k;

    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    // Deep water stops you (there's no swimming yet): slide along the shore instead.
    if (-height(nx, nz) > W.deepWater) {
      if (-height(nx, this.z) <= W.deepWater) nz = this.z;
      else if (-height(this.x, nz) <= W.deepWater) nx = this.x;
      else { nx = this.x; nz = this.z; }
    }
    // Too steep (a cliff you walk into sideways): don't go up it.
    const nh = height(nx, nz);
    const stepLen = Math.hypot(nx - this.x, nz - this.z);
    if (stepLen > 1e-6 && (nh - this.y) / stepLen > P.maxSlope * 1.6) { nx = this.x; nz = this.z; }

    [nx, nz] = pushOut(nx, nz, P.radius);
    nx = Math.max(-LIMIT, Math.min(LIMIT, nx));
    nz = Math.max(-LIMIT, Math.min(LIMIT, nz));

    this.speed = Math.hypot(nx - this.x, nz - this.z) / dt;
    this.vx = (nx - this.x) / dt; this.vz = (nz - this.z) / dt;
    this.x = nx; this.z = nz;
    this.y = height(nx, nz);
    this.depth = Math.max(0, -this.y);

    // Face the way you walk.
    if (this.speed > 0.3 && len > 0.01) {
      const want = Math.atan2(-dirx, -dirz);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-P.turn * dt));
    }
  }
}
