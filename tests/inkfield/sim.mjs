// Bot-only matches in Node, for tuning and for the tests: `node tests/inkfield/sim.mjs [matches] [difficulty]`
// prints how long matches last and how players go out.
import { World } from "../../games/inkfield/src/sim.js";
import { makeBots } from "../../games/inkfield/src/bots.js";
import { Rng } from "../../games/inkfield/src/rng.js";
import { CONFIG } from "../../games/inkfield/src/config.js";

/** One match of bots only (the "human" slot is a bot too). Ends when one is left or after maxTime seconds. */
export function runMatch(seed, difficulty = "normal", { maxTime = 600, players } = {}) {
  const n = players || CONFIG.difficulty[difficulty].bots + 1;
  const w = new World({ seed, players: n });
  const bots = makeBots(w, difficulty, new Rng(seed ^ 0x5bd1e995), 1);
  const dt = 1 / CONFIG.hz;
  const outs = [];
  let captures = 0, maxShare = 0;
  while (w.time < maxTime && w.winner() === undefined) {
    for (const b of bots) b.update(dt);
    w.step(dt);
    for (const e of w.events) {
      if (e.type === "out") outs.push({ ...e, t: w.time });
      if (e.type === "capture") captures++;
    }
    w.events.length = 0;
    for (const p of w.alive) maxShare = Math.max(maxShare, w.share(p));
  }
  return { time: w.time, outs, captures, maxShare, winner: w.winner(), world: w };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const matches = +(process.argv[2] || 10), diff = process.argv[3] || "normal";
  const how = {};
  let total = 0, tsum = 0, firstOut = 0, maxShare = 0, unfinished = 0;
  const t0 = performance.now();
  for (let s = 1; s <= matches; s++) {
    const r = runMatch(s * 7919, diff);
    tsum += r.time;
    if (r.winner === undefined) unfinished++;
    firstOut += r.outs.length ? r.outs[0].t : r.time;
    maxShare += r.maxShare;
    for (const o of r.outs) { how[o.how] = (how[o.how] || 0) + 1; total++; }
  }
  console.log(`${matches} ${diff} matches in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`  average length ${(tsum / matches).toFixed(0)} s, first out after ${(firstOut / matches).toFixed(0)} s, unfinished ${unfinished}`);
  console.log(`  biggest share reached (average) ${(100 * maxShare / matches).toFixed(1)}%`);
  console.log(`  how players went out:`, Object.fromEntries(Object.entries(how).map(([k, v]) => [k, `${v} (${(100 * v / total).toFixed(0)}%)`])));
}
