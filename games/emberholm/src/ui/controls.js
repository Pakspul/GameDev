// Input in landscape: a floating move stick under the left thumb, camera drag under the right thumb.
// With a mouse: drag to turn the camera. Keys: WASD / arrows to walk, Shift to run, Q / E to turn
// the camera, M for the map. A gamepad: left stick walks, right stick turns the camera.
import { CONFIG } from "../config.js";

const S = CONFIG.stick;

export class Controls {
  /** layer: the element that takes touches (full screen); stick/knob: the stick's look. */
  constructor(layer, stick, knob) {
    this.layer = layer; this.stickEl = stick; this.knobEl = knob;
    this.stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };   // x right, y down, -1..1
    this.look = { id: null, x: 0, y: 0 };
    this.camDX = 0; this.camDY = 0;                        // pixels dragged since the last frame
    this.lastLook = -1e9;                                  // when the camera was last turned by hand
    this.keys = new Set();
    this.enabled = false;
    this.onKey = null;                                     // (code) => void, for single presses (map, pause)

    layer.addEventListener("pointerdown", (e) => this.down(e));
    addEventListener("pointermove", (e) => this.move(e), { passive: true });
    addEventListener("pointerup", (e) => this.up(e));
    addEventListener("pointercancel", (e) => this.up(e));
    addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (!this.keys.has(e.code) && this.onKey) this.onKey(e.code);
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.release());
  }

  down(e) {
    if (!this.enabled) return;
    const half = e.clientX < innerWidth * 0.45;
    if (e.pointerType !== "mouse" && half && this.stick.id === null) {
      Object.assign(this.stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
      this.stickEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.knobEl.style.transform = "";
      this.stickEl.classList.add("on");
    } else if (this.look.id === null) {
      Object.assign(this.look, { id: e.pointerId, x: e.clientX, y: e.clientY });
    }
    e.preventDefault();
  }

  move(e) {
    if (e.pointerId === this.stick.id) {
      let dx = e.clientX - this.stick.x0, dy = e.clientY - this.stick.y0;
      const d = Math.hypot(dx, dy);
      // A thumb that wanders far drags the stick's centre along, so it never runs out of room.
      if (d > S.radius * 1.6) {
        const k = (d - S.radius * 1.6) / d;
        this.stick.x0 += dx * k; this.stick.y0 += dy * k;
        this.stickEl.style.transform = `translate(${this.stick.x0}px, ${this.stick.y0}px)`;
        dx = e.clientX - this.stick.x0; dy = e.clientY - this.stick.y0;
      }
      const len = Math.min(1, Math.hypot(dx, dy) / S.radius);
      const a = Math.atan2(dy, dx);
      this.stick.x = Math.cos(a) * len; this.stick.y = Math.sin(a) * len;
      this.knobEl.style.transform = `translate(${this.stick.x * S.radius}px, ${this.stick.y * S.radius}px)`;
    } else if (e.pointerId === this.look.id) {
      this.camDX += e.clientX - this.look.x; this.camDY += e.clientY - this.look.y;
      this.look.x = e.clientX; this.look.y = e.clientY;
      this.lastLook = performance.now();
    }
  }

  up(e) {
    if (e.pointerId === this.stick.id) this.releaseStick();
    if (e.pointerId === this.look.id) this.look.id = null;
  }

  releaseStick() {
    Object.assign(this.stick, { id: null, x: 0, y: 0 });
    this.stickEl.classList.remove("on");
  }

  release() {
    this.releaseStick();
    this.look.id = null;
    this.keys.clear();
  }

  /** The move input this frame: { x, y (screen directions, -1..1), run, camX (rad/s from keys and pad) }. */
  read() {
    let x = this.stick.x, y = this.stick.y, run = false, camX = 0, camY = 0;
    const k = this.keys;
    const kx = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const ky = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l * 0.8; y = ky / l * 0.8; }
    if (k.has("ShiftLeft") || k.has("ShiftRight")) run = true;
    camX += (k.has("KeyE") ? 1 : 0) - (k.has("KeyQ") ? 1 : 0);
    // Gamepad.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      const px = dz(p.axes[0] || 0), py = dz(p.axes[1] || 0);
      if (px || py) { x = px; y = py; }
      camX += dz(p.axes[2] || 0) * 1.4; camY += dz(p.axes[3] || 0);
      if (p.buttons[10] && p.buttons[10].pressed) run = true;
      if (camX || camY) this.lastLook = performance.now();
      break;
    }
    if (camX) this.lastLook = performance.now();
    const len = Math.hypot(x, y);
    if (len < S.dead) { x = 0; y = 0; }
    return { x, y, run, camX, camY };
  }

  /** Pixels dragged on the camera since the last call. */
  takeDrag() { const d = [this.camDX, this.camDY]; this.camDX = this.camDY = 0; return d; }
}
