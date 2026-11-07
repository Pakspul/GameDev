// Coin Dozer: the headless simulation criteria (docs/COIN-DOZER.md).
//   AC8:  with a full board and default settings, a chain of 5+ coins falls in about 1 in 6 advances
//         (measured over 200 advances, accepted 1 in 10 to 1 in 3).
//   AC28: a seeded run ends with no exceptions, no NaN positions and no coins outside the board.
//         npm test runs the 230 cycles below; the full 10,000 cycles run in CI
//         (npm run coin-dozer:sim -- --cycles 10000 --check, about half an hour).
import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "./sim.mjs";

test("AC8 + AC28: cascade rate over 200 advances, and a clean seeded run", async () => {
  const r = await simulate({ cycles: 200, warmup: 30, seed: 20261107 });
  assert.deepEqual(r.problems, []);
  assert.equal(r.advances, 200);
  assert.ok(r.cascadeRate >= 1 / 10 && r.cascadeRate <= 1 / 3, `cascades of 5+ in ${r.cascades} of 200 advances (1 in ${(200 / r.cascades).toFixed(1)})`);
  assert.ok(r.maxCoins <= 250);
});
