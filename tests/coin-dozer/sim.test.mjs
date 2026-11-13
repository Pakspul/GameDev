// Coin Dozer: the headless simulation criteria (docs/COIN-DOZER.md).
//   AC8:  with a full board and default settings, a chain of 5+ coins falls in about 1 in 6 advances
//         (measured over 200 advances, accepted 1 in 10 to 1 in 3), on both machines.
//   AC28: a seeded run ends with no exceptions, no NaN positions and no coins outside the board.
//         npm test runs the 230 cycles below per machine; the full 10,000 cycles run in CI
//         (npm run coin-dozer:sim -- --cycles 10000 --check, about half an hour).
//   Each machine takes about 30 s at full length, so on a developer machine the run is short: 40 cycles, checking
//   only the clean run (AC28). CI (CI=true), or COIN_DOZER_FULL=1 anywhere, runs the full 200 advances and AC8.
import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "./sim.mjs";

const FULL = Boolean(process.env.CI || process.env.COIN_DOZER_FULL);

for (const type of ["classic", "pins"]) {
  test(`AC8 + AC28 (${type} machine): ${FULL ? "cascade rate over 200 advances, and a clean seeded run" : "a clean seeded run (short; COIN_DOZER_FULL=1 adds the 200-advance cascade rate)"}`, async () => {
    const cycles = FULL ? 200 : 40;
    const r = await simulate({ cycles, warmup: FULL ? 30 : 20, seed: 20261107, type });
    assert.deepEqual(r.problems, []);
    assert.equal(r.advances, cycles);
    assert.ok(r.maxCoins <= 250);
    // The rate needs the full 200 advances: over fewer it is too noisy to hold to the 1-in-10 to 1-in-3 band.
    if (FULL) assert.ok(r.cascadeRate >= 1 / 10 && r.cascadeRate <= 1 / 3, `cascades of 5+ in ${r.cascades} of 200 advances (1 in ${(200 / r.cascades).toFixed(1)})`);
  });
}
