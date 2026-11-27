// Day and night. A day is CONFIG.time.day seconds of play: daylight first (sunrise at t = 0),
// then night. The clock only moves while you play. On the island's clock the sun rises at 06:00
// and sets at 20:00 (14 hours, as 14 of the 24 minutes are daylight).
import { CONFIG } from "../config.js";

const T = CONFIG.time;
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export class Clock {
  /** t: share of the day gone (0..1), day: which day (1 = the first). */
  constructor(t = T.start, day = 1) { this.t = t; this.day = day; }
  advance(dt) {
    this.t += dt / T.day;
    while (this.t >= 1) { this.t -= 1; this.day++; }
  }
  /** Hours on the island's clock, 0..24. */
  get hours() { return (6 + this.t * 24) % 24; }
  get text() {
    const m = Math.floor(this.hours * 60);
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  get night() { return light(this.t) < 0.35; }
  /** Jump to an hour on the island's clock (a testing tool, and later: resting by a fire). */
  setHours(hh) { this.t = (((hh - 6) / 24) % 1 + 1) % 1; }
}

/** How light it is: 1 in daylight, 0 at night, smooth through dawn and dusk. */
export function light(t) {
  const D = T.daylight, tw = T.twilight;
  // In the second half of the night, count towards the coming dawn (t just below 1 = just before 0).
  if (t > (D + 1) / 2) return smooth(-tw, tw, t - 1);
  return Math.min(smooth(-tw, tw, t), 1 - smooth(D - tw, D + tw, t));
}

// Colours (sRGB, 0..1) at night, in daylight, and at sunrise/sunset.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const PALETTE = {
  night: { fog: hex("#13203a"), sky: hex("#34507e"), ground: hex("#141a22"), sun: hex("#9db4e6"), sunI: 0.75, hemiI: 0.9 },
  day: { fog: hex("#b8cdd4"), sky: hex("#e4f1fb"), ground: hex("#6b6a45"), sun: hex("#fff1d6"), sunI: 2.4, hemiI: 1.25 },
  warm: { fog: hex("#d8a07a"), sky: hex("#f3c49a"), ground: hex("#5a4838"), sun: hex("#ffad6b"), sunI: 1.5, hemiI: 1.0 },
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * The sky at time t: where the sun (or moon) is and the colours of light and fog.
 * { light, warm, dir: [x, y, z] towards the light, fog, sky, ground, sun, sunI, hemiI }
 */
export function sky(t) {
  const D = T.daylight;
  const L = light(t);
  // Closeness to sunrise or sunset, for the warm colours.
  const edge = Math.min(Math.abs(t), Math.abs(1 - t), Math.abs(t - D));
  const warm = Math.max(0, 1 - edge / (T.twilight * 2.4));
  // The sun crosses the sky by day, the moon by night; both from east (+x) to west, leaning south (+z).
  const p = t < D ? t / D : (t - D) / (1 - D);
  const a = Math.PI * Math.max(0.04, Math.min(0.96, p));
  const dir = [Math.cos(a), 0.25 + Math.sin(a) * 0.9, 0.45];
  const n = Math.hypot(...dir);
  const out = { light: L, warm, dir: dir.map((v) => v / n) };
  for (const k of ["fog", "sky", "ground", "sun"]) out[k] = mix(mix(PALETTE.night[k], PALETTE.day[k], L), PALETTE.warm[k], warm * 0.75);
  for (const k of ["sunI", "hemiI"]) {
    const base = PALETTE.night[k] + (PALETTE.day[k] - PALETTE.night[k]) * L;
    out[k] = base + (PALETTE.warm[k] - base) * warm * 0.75;
  }
  return out;
}
