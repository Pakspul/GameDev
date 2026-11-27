// The autoplayer: tries every aim (and the swapped bubble, and each power in the tray), plays out each
// shot on a copy of the board with the real rules, and takes the best. Greedy, one shot ahead.
// Levels use it to prove a board can be finished and to set its shot budget; the tests use it to play.
import { CONFIG } from "./config.js";
import { trace, resolve, snap, NORMAL, STONE } from "./grid.js";

const ANGLES = 72;

/** The best next move: { angle, swap, arm (tray slot or -1), v }. */
export function bestMove(game) {
  const g = game.grid, L = game.launcher();
  const options = [{ swap: false, arm: -1, shot: { c: game.current } }];
  if (game.next !== game.current) options.push({ swap: true, arm: -1, shot: { c: game.next } });
  game.tray.forEach((p, i) => { if (p !== "freeze") options.push({ swap: false, arm: i, shot: { p } }); });
  let best = null;
  options.forEach((o, oi) => {
    const seen = new Set();
    for (let i = 0; i <= ANGLES; i++) {
      const a = -CONFIG.maxAngle + (2 * CONFIG.maxAngle * i) / ANGLES;
      const tr = trace(g, L.x, L.y, a, o.shot.p === "comet");
      const s = snap(g, tr.x, tr.y);
      const sig = o.shot.p === "comet" ? tr.passed.join(",") : s[0] * 16 + s[1] + "/" + (tr.hit ? tr.hit[0] * 16 + tr.hit[1] : -1);
      if (seen.has(sig)) continue;
      seen.add(sig);
      const after = g.clone();
      const out = resolve(after, tr, o.shot);
      const v = value(game, after, out, o.shot) - oi * 0.001;
      if (!best || v > best.v) best = { v, angle: a, swap: o.swap, arm: o.arm };
    }
  });
  return best;
}

function value(game, after, out, shot) {
  const goal = game.goal;
  let v = out.popped.length + out.dropped.length * 1.5;
  for (const q of out.popped.concat(out.dropped)) {
    if (q.b.crit) v += 12;
    if (q.b.p) v += 3;
    if (q.b.k === STONE) v += 1;
    if (goal && goal.type === "collect" && q.b.k !== STONE && q.b.c === goal.colour) v += 1.5;
  }
  if (out.placed && !out.popped.length) {
    // A shot that pops nothing: best next to its own colour, so the next one can pop the lot.
    const [r, c] = out.placed, col = after.get(r, c).c;
    let same = 0;
    for (const [a, b] of after.neighbours(r, c)) { const n = after.get(a, b); if (n && n.k === NORMAL && n.c === col) same++; }
    v += same * 0.45 - 0.6;
    if (game.mode !== "levels") v -= Math.max(0, r + game.ceil - 8) * 0.3; // stay away from the line
  }
  if (shot.p) v -= 5; // keep a power for a shot where it really helps
  if (!after.count()) v += 100;
  return v;
}

/** Play `game` until it ends (or `maxShots` coloured shots). Classic goes on through its stages. */
export function autoplay(game, maxShots = 300, maxStages = Infinity) {
  while (game.status === "play" || game.status === "stage") {
    if (game.status === "stage") { if (game.stage >= maxStages) break; game.advance(); continue; }
    if (game.shots >= maxShots) break;
    const m = bestMove(game);
    if (m.swap) game.swap();
    if (m.arm >= 0) game.arm(m.arm);
    game.fire(m.angle);
    game.land();
    game.events.length = 0;
  }
  return game;
}
