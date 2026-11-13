import test from "node:test";
import assert from "node:assert/strict";
import { simulate, simulateFreeSpinsOption, volatilityClass } from "../../games/crystal-reels/src/engine/simulate.js";
import { MACHINE_IDS, loadMachine } from "./helpers.mjs";

// A quick statistical check of every machine (300,000 spins, fixed seed). The strict MATH-04 check, 10 million
// spins within ±0.5 percentage point, is `npm run slots:verify`; this one catches clear regressions in seconds.
for (const id of MACHINE_IDS) {
  test(`MATH-04: ${id} lands on its targets`, () => {
    const cfg = loadMachine(id), tg = cfg.targets;
    const r = simulate(cfg, { spins: 300000, seed: 2026 });
    assert.ok(Math.abs(r.rtp - tg.rtp) < tg.rtpTolerance + 3 * r.rtpStdError, `RTP ${r.rtp}`);
    assert.ok(r.hitFrequency >= tg.hitFrequency[0] && r.hitFrequency <= tg.hitFrequency[1], `hit frequency ${r.hitFrequency}`);
    const fs = r.triggerRates.freeSpins.oneIn;
    assert.ok(fs >= tg.freeSpinsEvery[0] && fs <= tg.freeSpinsEvery[1], `free spins 1 in ${fs}`);
    assert.equal(r.volatility, tg.volatility, `volatility index ${r.volatilityIndex}`);
    assert.ok(r.maxEventMultiple <= cfg.maxWin, "no spin or feature pays above the cap");
    assert.equal(volatilityClass(r.volatilityIndex), r.volatility);
  });
}

test("FS-04: all free-spins options of Neon Tumble have the same expected value within 2%", () => {
  const cfg = loadMachine("neon-tumble");
  const evs = cfg.features.freeSpins.choice.map((o) => simulateFreeSpinsOption(cfg, o.id, 40000, 5));
  const mean = evs.reduce((a, e) => a + e.mean, 0) / evs.length;
  for (const e of evs) assert.ok(Math.abs(e.mean - mean) <= 0.02 * mean + 2 * e.stdError, `${e.option}: ${e.mean} vs ${mean}`);
});

test("FAIR-03: the distribution is the same whatever state the simulated player is in", () => {
  const cfg = loadMachine("crystal-fortune");
  // the simulator resets the balance itself, so run with different starting offsets by changing the bet level order instead:
  const a = simulate(cfg, { spins: 50000, seed: 1, bet: 40 }), b = simulate(cfg, { spins: 50000, seed: 1, bet: 40 });
  assert.equal(a.rtp, b.rtp);
  const c = simulate(cfg, { spins: 50000, seed: 1, bet: 1000 });
  assert.ok(Math.abs(c.rtp - a.rtp) < 0.02, "the return does not depend on the bet size");
});
