// The player's character: rigid low-poly parts (legs, body, arms, head) animated in code.
// No animation files: walking is legs and arms swinging on a phase that follows the speed.
// Faces -z; the group's rotation.y is the player's yaw.
import { THREE, part, merge } from "./geo.js";

const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (rt, rb, h, n = 6) => new THREE.CylinderGeometry(rt, rb, h, n);

const SKIN = "#e2b48c", TUNIC = "#6a4b2f", TROUSERS = "#4a4f57", BOOT = "#3a2c22", CLOAK = "#8e2f2b",
  BEARD = "#c47a3c", IRON = "#8d939a", WOOD = "#7a5531", BELT = "#2d2620";

export class Hero {
  constructor() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = (geo) => new THREE.Mesh(geo, mat);
    this.root = new THREE.Group();
    this.body = new THREE.Group();         // everything above the hips; bobs and leans
    this.root.add(this.body);

    // Legs: pivot at the hip, the leg hangs down from it.
    this.legs = [-1, 1].map((sx) => {
      const g = new THREE.Group();
      g.position.set(sx * 0.15, 0.92, 0);
      g.add(mesh(merge([
        part(Box(0.21, 0.62, 0.24), TROUSERS, { y: -0.31 }),
        part(Box(0.22, 0.3, 0.27), BOOT, { y: -0.77, z: -0.02 }),
      ])));
      this.root.add(g);
      return g;
    });

    // Body, head, cloak, the shield on the back.
    this.torso = mesh(merge([
      part(Box(0.6, 0.66, 0.36), TUNIC, { y: 1.27 }),
      part(Box(0.62, 0.1, 0.38), BELT, { y: 0.98 }),
      part(Box(0.12, 0.08, 0.06), "#b48a3c", { y: 0.98, z: -0.2 }),             // buckle
      part(Box(0.34, 0.32, 0.32), SKIN, { y: 1.8 }),                             // head
      part(Box(0.3, 0.2, 0.1), BEARD, { y: 1.66, z: -0.17 }),                    // beard
      part(Cyl(0.0, 0.25, 0.26, 7), IRON, { y: 2.06 }),                          // helmet
      part(Cyl(0.25, 0.22, 0.1, 7), IRON, { y: 1.95 }),
      part(Box(0.04, 0.16, 0.05), IRON, { y: 1.84, z: -0.18 }),                  // nose guard
      part(Box(0.05, 0.05, 0.02), "#1d1a18", { x: -0.08, y: 1.8, z: -0.165 }),   // eyes
      part(Box(0.05, 0.05, 0.02), "#1d1a18", { x: 0.08, y: 1.8, z: -0.165 }),
      part(Box(0.66, 0.95, 0.06), CLOAK, { y: 1.12, z: 0.22, rx: 0.08 }),        // cloak
      part(Box(0.7, 0.14, 0.42), CLOAK, { y: 1.56 }),                            // cloak over the shoulders
      part(Cyl(0.4, 0.4, 0.07, 10), WOOD, { y: 1.25, z: 0.29, rx: Math.PI / 2 }), // round shield on the back
      part(Cyl(0.1, 0.1, 0.1, 8), IRON, { y: 1.25, z: 0.33, rx: Math.PI / 2 }),
    ]));
    this.body.add(this.torso);

    // Arms: pivot at the shoulder. The right hand holds the axe.
    this.arms = [-1, 1].map((sx) => {
      const g = new THREE.Group();
      g.position.set(sx * 0.39, 1.53, 0);
      const parts = [
        part(Box(0.17, 0.5, 0.19), TUNIC, { y: -0.23 }),
        part(Box(0.15, 0.16, 0.16), SKIN, { y: -0.55 }),
      ];
      if (sx > 0) parts.push(
        part(Cyl(0.035, 0.035, 0.85, 5), WOOD, { y: -0.58, z: -0.28, rx: Math.PI / 2 }),
        part(Box(0.05, 0.26, 0.2), IRON, { y: -0.48, z: -0.66 }),
      );
      g.add(mesh(merge(parts)));
      this.body.add(g);
      return g;
    });

    // A soft round shadow under the feet (cheaper than real shadows).
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    shadow.renderOrder = 1;
    this.root.add(shadow);

    this.phase = 0;
    this.t = 0;
  }

  /** Animate for speed (m/s) over dt seconds. */
  update(dt, speed, wading) {
    this.t += dt;
    const moving = Math.min(1, speed / 1.5);
    const run = Math.max(0, Math.min(1, (speed - 4.6) / 2.4));
    this.phase += dt * (3.2 + speed * 1.25);
    const swing = Math.sin(this.phase) * (0.55 + run * 0.35) * moving;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.8;
    this.arms[1].rotation.x = swing * 0.6 - 0.25 * moving;      // the axe arm swings less
    const breathe = Math.sin(this.t * 2.2) * 0.012 * (1 - moving);
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.06 * moving + breathe - (wading ? 0.05 : 0);
    this.body.rotation.x = -0.12 * run;                         // lean into a run
    this.torso.rotation.z = Math.sin(this.phase) * 0.04 * moving;
  }
}
