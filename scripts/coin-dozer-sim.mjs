#!/usr/bin/env node
// Coin Dozer's headless simulation (docs/COIN-DOZER.md): a seeded player keeps auto-drop on and
// wanders the aim, with the real machine and physics. It prints how often a cascade of 5+ coins
// happens per pusher advance (the feel target: about 1 in 6), the payout, and any NaN or body
// outside the board. Use it when tuning src/config.js.
//
//   npm run coin-dozer:sim                         200 measured advances (after 30 to fill the board)
//   npm run coin-dozer:sim -- --cycles 10000       the long stability run (acceptance criterion 28)
//   npm run coin-dozer:sim -- --seed 7 --check     exit 1 on a problem or a cascade rate outside 1/10–1/3
import { simulate } from "../tests/coin-dozer/sim.mjs";

const arg = (name, d) => { const i = process.argv.indexOf("--" + name); return i > 0 ? Number(process.argv[i + 1]) : d; };
const cycles = arg("cycles", 200), seed = arg("seed", 20261107), check = process.argv.includes("--check");
console.log(`Coin Dozer simulation: ${cycles} pusher cycles, seed ${seed}`);
const r = await simulate({ cycles, seed, log: (m, steps) => console.log(`  cycle ${m.board.cycles}: bank ${m.bank}, ${m.board.items.size} bodies, ${(steps / 60 / 60).toFixed(0)} min played`) });
const m = r.machine, ev = r.events;
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "-");
console.log(`  played        ${(m.time / 60).toFixed(1)} min, ${r.steps} steps, ${r.msPerStep.toFixed(2)} ms per physics step`);
console.log(`  cascades 5+   ${r.cascades} of ${r.advances} advances = 1 in ${(r.advances / Math.max(1, r.cascades)).toFixed(1)} (target 1 in 6, accepted 1 in 10 to 1 in 3)`);
console.log(`  per advance   ${Object.entries(r.histogram).map(([n, c]) => `${n}:${c}`).join(" ")}`);
console.log(`  coins         dropped ${m.progress.stats.dropped}, over the front ${ev.won || 0}, off the sides ${ev.lost || 0} (${pct(ev.lost || 0, (ev.won || 0) + (ev.lost || 0))}), faded at the cap ${ev.fade || 0}`);
console.log(`  bank          ${m.bank} (started at 50), lifelines ${ev.lifeline || 0}`);
console.log(`  prizes        ${ev.prize || 0} won, ${m.progress.credits} credits, bonus events ${ev.eventStart || 0}`);
console.log(`  bodies        at most ${r.maxCoins} coins, ${r.maxItems} bodies`);
if (r.problems.length) { console.log("  PROBLEMS:"); for (const p of r.problems) console.log("    " + p); }
else console.log("  no exceptions, no NaN positions, no body outside the board");
const rateOk = r.cascadeRate >= 1 / 10 && r.cascadeRate <= 1 / 3;
if (check && (r.problems.length || (cycles >= 100 && !rateOk))) process.exit(1);
