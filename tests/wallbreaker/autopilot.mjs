// A simple autopilot for the paddle, used by the tests and by `npm run wallbreaker:sim` to play
// levels headless: it moves the paddle under the ball that will land first, with an offset that
// changes per hit so the ball goes to different places. It also catches good capsules when no ball
// needs it and dodges risky ones unless told to take them.
import { Engine, DT } from "../../games/wallbreaker/src/engine.js";
import { CONFIG } from "../../games/wallbreaker/src/config.js";

const WD = CONFIG.world;

/** Where a ball will cross y (bouncing off the side walls), or null if it's going up. */
function landingX(b, y) {
  if (b.vy <= 0) return null;
  const t = (y - b.r - b.y) / b.vy;
  let x = b.x + b.vx * t;
  const L = WD.left + b.r, R = WD.right - b.r, w = R - L;
  let u = (x - L) % (2 * w);
  if (u < 0) u += 2 * w;
  return L + (u <= w ? u : 2 * w - u);
}

export function makeEngine(opts) {
  let hits = 0;
  const user = opts.events || (() => {});
  const e = new Engine({ ...opts, events: (t, d) => { if (t === "paddle") hits++; user(t, d); } });
  e._hits = () => hits;
  return e;
}

/** Play until the level ends or `limit` seconds pass. Returns the engine. */
export function autoplay(e, { limit = 400, takeRisky = false, skill = 1 } = {}) {
  const offsets = [0.35, -0.55, 0.15, -0.25, 0.7, -0.75, 0.45, -0.1, 0.6, -0.4];
  let steps = 0;
  const maxSteps = limit * CONFIG.physics.hz;
  while (!e.over && steps++ < maxSteps) {
    if ((e.state === "serve" && e.stateT > 0.2) || (e.state === "play" && e.balls.some((b) => b.stuck) && steps % 40 === 0)) e.tap();
    const p = e.paddle;
    let best = null, bestT = Infinity;
    for (const b of e.balls) {
      if (b.stuck) continue;
      const lx = landingX(b, p.y);
      if (lx == null) continue;
      const t = (p.y - b.y) / b.vy;
      if (t < bestT) { bestT = t; best = lx; }
    }
    let target = p.x;
    if (best != null) {
      const off = offsets[e._hits() % offsets.length] * (p.w / 2);
      target = best - off;
      if (skill < 1 && Math.floor(e.t * 3) % Math.round(1 / (1 - skill)) === 0) target += 40;
    } else {
      // No ball coming down: catch a capsule if one is close (and not a risky one we don't want).
      const c = e.capsules.filter((c) => takeRisky || !c.risky).sort((a, b) => b.y - a.y)[0];
      if (c) target = c.x;
    }
    // Dodge unwanted risky capsules if there's time.
    if (!takeRisky) for (const c of e.capsules) if (c.risky && c.y > p.y - 60 && Math.abs(c.x - target) < p.w / 2 + 18 && bestT > 0.4) target += c.x < target ? 40 : -40;
    const maxMove = 1400 * DT; // a fast but human thumb
    e.setPaddle(p.x + Math.max(-maxMove, Math.min(maxMove, target - p.x)));
    if (e.has("laser") && steps % 30 === 0) e.tap();
    e.step(DT);
  }
  return e;
}
