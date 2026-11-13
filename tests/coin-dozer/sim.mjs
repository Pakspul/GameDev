// A seeded headless player for Coin Dozer: auto-drop on, the aim wandering over the shelf (on the pin
// wall: from slot to slot), the real machine and physics. Shared by the tests (rules.test.mjs, sim.test.mjs) and scripts/coin-dozer-sim.mjs.
import { initPhysics, isCoin } from "../../games/coin-dozer/src/board.js";
import { Machine } from "../../games/coin-dozer/src/machine.js";
import { CONFIG } from "../../games/coin-dozer/src/config.js";
import { freshProgress } from "../../games/coin-dozer/src/economy.js";
import { Rng } from "../../games/coin-dozer/src/rng.js";

const B = CONFIG.board;
/** Where a body may be while it's on the board (falling off the edges included). */
export function inBounds(it) {
  return Math.abs(it.x) <= B.width / 2 + 1.5 && it.z >= -B.depth / 2 - B.stroke - 3 && it.z <= B.depth / 2 + 3 && it.y >= B.killBelow && it.y <= 12;
}

/**
 * Play `cycles` pusher cycles. Returns stats; `problems` lists every NaN or out-of-bounds body and
 * every exception (an empty list is a pass).
 */
export async function simulate({ cycles = 200, warmup = 30, seed = 20261107, cfg = CONFIG, progress = freshProgress(cfg), type = "classic", log = null } = {}) {
  await initPhysics();
  const events = {};
  const m = new Machine({ cfg, progress, type, onEvent: (t) => { events[t] = (events[t] || 0) + 1; }, date: () => "2026-11-07" });
  m.newBoard(seed);
  const player = new Rng(seed ^ 0x9e3779b9);
  const problems = [];
  let steps = 0, maxCoins = 0, maxItems = 0;
  const t0 = performance.now();
  const total = warmup + cycles;
  try {
    while (m.board.cycles < total) {
      if (steps % 240 === 0) m.setAim(player.range(-2.6, 2.6));
      if (!m.auto) m.setAuto(true);
      m.step();
      steps++;
      if (steps % 30 === 0) {
        let coins = 0;
        for (const it of m.board.items.values()) {
          if (![it.x, it.y, it.z, it.qx, it.qy, it.qz, it.qw].every(Number.isFinite)) problems.push(`NaN on ${it.kind} #${it.id} at step ${steps}`);
          else if (!inBounds(it)) problems.push(`${it.kind} #${it.id} outside the board at step ${steps}: ${it.x.toFixed(2)}, ${it.y.toFixed(2)}, ${it.z.toFixed(2)}`);
          if (isCoin(it.kind)) coins++;
        }
        maxCoins = Math.max(maxCoins, coins);
        maxItems = Math.max(maxItems, m.board.items.size);
        if (problems.length > 20) break;
      }
      if (log && steps % (CONFIG.physics.hz * CONFIG.board.cycle * 500) === 0) log(m, steps);
    }
  } catch (e) {
    problems.push(`exception at step ${steps}: ${e.stack || e}`);
  }
  const measured = m.cascades.slice(warmup);
  const big = measured.filter((n) => n >= CONFIG.events.cascadeMin).length;
  return {
    machine: m, events, problems, steps, maxCoins, maxItems,
    msPerStep: (performance.now() - t0) / Math.max(1, steps),
    advances: measured.length, cascades: big, cascadeRate: big / Math.max(1, measured.length),
    histogram: measured.reduce((h, n) => ((h[n] = (h[n] || 0) + 1), h), {}),
  };
}
