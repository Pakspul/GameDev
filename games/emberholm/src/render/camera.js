// The high chase camera: behind and above the player, looking down. Drag to turn it; while you
// walk and haven't turned it for a moment, it swings slowly round behind you. It never goes into
// the ground.
import { THREE } from "./geo.js";
import { CONFIG } from "../config.js";
import { height } from "../world/terrain.js";

const K = CONFIG.camera;

export class ChaseCamera {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(CONFIG.view.fov, aspect, 0.3, 400);
    this.yaw = 0;            // 0 = behind a player facing north (the camera south of them)
    this.pitch = K.pitch;
    this.dist = K.distance;
    this.target = new THREE.Vector3();
  }

  /** Turn the camera to look over the player's shoulder at once. */
  snap(player) {
    this.yaw = player.yaw;
    this.target.set(player.x, player.y + K.lookHeight, player.z);
    this.place();
  }

  update(dt, player, drag, input, sinceLook) {
    this.yaw -= drag[0] * K.dragYaw;
    this.pitch = Math.max(K.pitchMin, Math.min(K.pitchMax, this.pitch + drag[1] * K.dragPitch));
    this.yaw += input.camX * 1.8 * dt;
    this.pitch = Math.max(K.pitchMin, Math.min(K.pitchMax, this.pitch + input.camY * 1.2 * dt));
    // Follow: swing round behind a player who walks, unless the camera was turned by hand just now,
    // or they walk towards the camera (then turning would spin the world round).
    if (player.speed > 1 && sinceLook > K.followPause) {
      let d = player.yaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) this.yaw += d * Math.min(1, K.follow * dt) * Math.min(1, player.speed / 4);
    }
    // The target eases after the player a little, which softens bumps.
    const k = 1 - Math.exp(-14 * dt);
    this.target.x += (player.x - this.target.x) * k;
    this.target.z += (player.z - this.target.z) * k;
    this.target.y += (Math.max(player.y, -0.6) + K.lookHeight - this.target.y) * (1 - Math.exp(-8 * dt));
    this.place();
  }

  place() {
    const c = Math.cos(this.pitch), s = Math.sin(this.pitch);
    const p = this.cam.position;
    p.set(this.target.x + Math.sin(this.yaw) * c * this.dist, this.target.y + s * this.dist, this.target.z + Math.cos(this.yaw) * c * this.dist);
    const floor = Math.max(height(p.x, p.z), 0) + K.clearance;
    if (p.y < floor) p.y = floor;
    this.cam.lookAt(this.target);
  }

  /** The stick (screen x right, y down) as a direction on the ground: [x, z]. */
  toWorld(x, y) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);   // forward, away from the camera
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);    // right on screen
    return [rx * x - fx * y, rz * x - fz * y];
  }
}
