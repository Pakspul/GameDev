import test from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../../games/slots/src/engine/rng.js";
import { validateMachine, prepare } from "../../games/slots/src/engine/config.js";
import { evaluateGrid, evaluateScatter } from "../../games/slots/src/engine/evaluate.js";
import { resolveSpin } from "../../games/slots/src/engine/spin.js";
import { anticipationPlan } from "../../games/slots/src/engine/anticipation.js";
import { MACHINE_IDS, loadMachine, loadGame, clone, rigged, gridMachine } from "./helpers.mjs";

// ---- RNG (MATH-02) ---------------------------------------------------------------------------
test("RNG: the same seed gives the same sequence, different seeds differ", () => {
  const a = new Rng(42), b = new Rng(42), c = new Rng(43);
  const sa = Array.from({ length: 50 }, () => a.next32());
  assert.deepEqual(sa, Array.from({ length: 50 }, () => b.next32()));
  assert.notDeepEqual(sa, Array.from({ length: 50 }, () => c.next32()));
});

test("RNG: a fresh generator is seeded from the cryptographic source, and its seed replays it", () => {
  const a = new Rng(), b = new Rng();
  assert.equal(a.seed.length, 4);
  assert.notDeepEqual(a.seed, b.seed);
  assert.equal(new Rng(a.seed).next32(), new Rng(a.seed).next32());
});

test("RNG: state can be saved and restored", () => {
  const a = new Rng(7); a.next32();
  const state = a.state();
  const next = a.next32();
  const b = new Rng(1); b.restore(state);
  assert.equal(b.next32(), next);
});

test("RNG: stop positions are uniformly distributed per reel (chi-square)", () => {
  // Goodness of fit for every reel of every machine. The bound is about the 99.99th percentile of the
  // chi-square distribution, so a correct generator passes with a fixed seed and a biased one fails clearly.
  const critical = (df) => df + 3.72 * Math.sqrt(2 * df) + 2.6;
  for (const id of MACHINE_IDS) {
    const cfg = loadMachine(id);
    const rng = new Rng("chi:" + id);
    cfg.strips.base.forEach((strip, r) => {
      const n = strip.length, N = 200000, counts = new Array(n).fill(0);
      for (let i = 0; i < N; i++) counts[rng.int(n)]++;
      const e = N / n;
      const chi = counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
      assert.ok(chi < critical(n - 1), `${id} reel ${r + 1}: chi-square ${chi.toFixed(1)} too high for ${n - 1} degrees of freedom`);
    });
  }
});

test("RNG: a biased generator would be caught by the same chi-square bound", () => {
  const critical = (df) => df + 3.72 * Math.sqrt(2 * df) + 2.6;
  const n = 60, N = 200000, counts = new Array(n).fill(0), rng = new Rng(3);
  for (let i = 0; i < N; i++) counts[Math.min(n - 1, Math.floor(rng.float() ** 1.05 * n))]++; // slightly skewed
  const e = N / n;
  assert.ok(counts.reduce((s, c) => s + (c - e) ** 2 / e, 0) > critical(n - 1));
});

test("RNG: int() has no modulo bias on awkward ranges and rejects bad input", () => {
  const rng = new Rng(5);
  const counts = new Array(3).fill(0);
  for (let i = 0; i < 90000; i++) counts[rng.int(3)]++;
  for (const c of counts) assert.ok(Math.abs(c - 30000) < 700);
  assert.throws(() => rng.int(0));
});

// ---- config validation (MATH-03) --------------------------------------------------------------
test("both shipped machine configs are valid", () => {
  for (const id of MACHINE_IDS) assert.deepEqual(validateMachine(loadMachine(id)), [], id);
});

test("an invalid config fails validation: unknown symbol, line outside the grid, missing paytable entry", () => {
  const base = loadMachine("crystal-fortune");
  let c = clone(base); c.strips.base[0][3] = "NOPE";
  assert.ok(validateMachine(c).some((e) => e.includes("unknown symbol NOPE")));
  c = clone(base); c.paylines[4] = [0, 1, 3, 1, 0];
  assert.ok(validateMachine(c).some((e) => e.includes("outside the grid")));
  c = clone(base); delete c.paytable.KING;
  assert.ok(validateMachine(c).some((e) => e.includes("missing entry for KING")));
  c = clone(base); c.betLevels[1] = 41;
  assert.ok(validateMachine(c).some((e) => e.includes("not a multiple of betDivisor")));
  c = clone(base); c.strips.base[0][0] = "WILD";
  assert.ok(validateMachine(c).some((e) => e.includes("not allowed on reel 1")));
  assert.throws(() => prepare(c), /Invalid machine config/);
});

test("the grid can be 3-6 reels by 3-5 rows, and nothing else", () => {
  const c = clone(loadMachine("crystal-fortune"));
  c.grid.reels = 7;
  assert.ok(validateMachine(c).some((e) => e.includes("grid.reels")));
  c.grid.reels = 5; c.grid.rows = 6;
  assert.ok(validateMachine(c).some((e) => e.includes("grid.rows")));
});

test("ECO-01: the starting balance covers at least 200 spins at every machine's default bet", () => {
  const game = loadGame();
  for (const id of MACHINE_IDS) assert.ok(game.startingBalance >= 200 * loadMachine(id).defaultBet, id);
});

test("MATH-03/04/05: every machine's targets follow the specification's defaults", () => {
  for (const id of MACHINE_IDS) {
    const cfg = loadMachine(id);
    assert.equal(cfg.targets.rtp, 0.96);
    assert.deepEqual(cfg.targets.hitFrequency, [0.25, 0.35]);
    assert.deepEqual(cfg.targets.freeSpinsEvery, [150, 200]);
    assert.equal(cfg.maxWin, 5000);
  }
});

// ---- evaluation fixtures (PAY-06): every paytable entry ----------------------------------------
for (const id of MACHINE_IDS) {
  test(`PAY-06: every paytable entry of ${id} pays exactly its multiplier`, () => {
    const cfg = loadMachine(id), prep = prepare(cfg);
    const filler = Object.keys(cfg.symbols).find((s) => ["coin", "collect", "bonus"].includes(cfg.symbols[s].kind));
    const { reels, rows } = prep;
    let checked = 0;
    for (const bet of [cfg.betLevels[0], cfg.betLevels[3]]) {
      for (const [sym, table] of Object.entries(cfg.paytable)) {
        for (const [countStr, mult] of Object.entries(table)) {
          const count = Number(countStr);
          const grid = Array.from({ length: reels }, () => new Array(rows).fill(filler));
          if (cfg.symbols[sym].kind === "scatter") {
            for (let i = 0; i < count; i++) grid[i % reels][Math.floor(i / reels)] = sym;
            assert.equal(evaluateScatter(prep, grid, bet, sym).amount, mult * bet, `${sym} x${count}`);
          } else {
            for (let r = 0; r < count; r++) grid[r][0] = sym; // the top row: one line, one single way
            const ev = evaluateGrid(prep, grid, bet);
            assert.equal(ev.amount, mult * (bet / cfg.betDivisor), `${sym} x${count} at bet ${bet}`);
            assert.equal(ev.wins.length, 1, `${sym} x${count}: exactly one win`);
          }
          checked++;
        }
      }
    }
    assert.ok(checked >= 20);
  });
}

// ---- evaluation edge cases (PAY-06) ------------------------------------------------------------
const row1 = (...syms) => syms.map((s) => ["K", s, "K"]); // the middle row carries the symbols
const evalCols = (cols, patch, bet = 3) => {
  const cfg = gridMachine(cols, patch);
  return evaluateGrid(prepare(cfg), cols, bet);
};

test("a line needs 3 or more identical symbols from the leftmost reel", () => {
  assert.equal(evalCols(row1("A", "A", "B", "A", "A")).amount, 0);
  assert.equal(evalCols(row1("B", "A", "A", "A", "A")).amount, 0);
  assert.equal(evalCols(row1("A", "A", "A", "B", "B")).amount, 5);
  assert.equal(evalCols(row1("A", "A", "A", "A", "B")).amount, 20);
});

test("wild plus symbol: the wild substitutes for regular symbols", () => {
  assert.equal(evalCols(row1("A", "W", "A", "B", "B")).amount, 5);
  assert.equal(evalCols(row1("W", "A", "A", "B", "B")).amount, 5);
  assert.equal(evalCols(row1("W", "W", "A", "A", "B")).amount, 20);
});

test("wild-only line pays the wild entry when it is higher than the substituted result; only the highest win per line", () => {
  assert.equal(evalCols(row1("W", "W", "W", "A", "B")).amount, 50); // wilds x3 = 50 beats A x4 = 20
  assert.equal(evalCols(row1("W", "W", "W", "W", "C")).amount, 200); // wilds x4 = 200 beats C x5 = 20
  const ev = evalCols(row1("W", "W", "W", "A", "A")); // A x5 = 100 beats wilds x3 = 50
  assert.equal(ev.amount, 100);
  assert.equal(ev.wins.length, 1);
});

test("a wild never substitutes for scatter, bonus or coin symbols", () => {
  assert.equal(evalCols(row1("A", "W", "S", "A", "A")).amount, 0);
  assert.equal(evalCols(row1("A", "W", "K", "A", "A")).amount, 0);
  assert.equal(evalCols(row1("A", "W", "N", "A", "A")).amount, 0);
});

test("two lines sharing symbols are paid separately", () => {
  const cols = [["A", "A", "K"], ["A", "A", "K"], ["A", "A", "K"], ["K", "K", "K"], ["K", "K", "K"]];
  const ev = evalCols(cols);
  assert.equal(ev.wins.length, 2);
  assert.equal(ev.amount, 10);
});

test("line win = paytable multiplier x line bet, and scales with the bet", () => {
  assert.equal(evalCols(row1("A", "A", "A", "B", "B"), {}, 30).amount, 50); // line bet 10
});

test("multiplier wilds multiply (or add, per machine config) on one line", () => {
  assert.equal(evalCols(row1("A", "X2", "X3", "B", "B")).amount, 5 * 6);
  assert.equal(evalCols(row1("A", "X2", "X3", "B", "B"), { wild: { combine: "add" } }).amount, 5 * 5);
  assert.equal(evalCols(row1("A", "X2", "A", "B", "B")).amount, 5 * 2);
});

test("scatter plus line win are added; scatters pay anywhere as a multiple of the total bet", () => {
  const cols = [["A", "S", "K"], ["A", "K", "S"], ["A", "K", "K"], ["K", "S", "K"], ["K", "K", "K"]];
  const o = resolveSpin(prepare(gridMachine(cols)), rigged([0, 0, 0, 0, 0]), { bet: 3 });
  assert.equal(o.lineWin, 5);
  assert.equal(o.scatter.count, 3);
  assert.equal(o.scatterWin, 6);
  assert.equal(o.totalWin, 11);
});

function waysMachine(cols, patch = {}) {
  const cfg = gridMachine(cols, { mode: "ways", paytable: { A: { 3: 6, 4: 10, 5: 20 }, B: { 3: 1 }, C: { 3: 1 }, S: { 3: 2 } }, ...patch });
  delete cfg.paylines;
  return cfg;
}

test("ways mode: counts every adjacent combination", () => {
  const cols = [["A", "A", "K"], ["A", "K", "K"], ["A", "A", "A"], ["K", "K", "K"], ["K", "K", "K"]];
  const ev = evaluateGrid(prepare(waysMachine(cols)), cols, 3);
  assert.equal(ev.wins.length, 1);
  assert.equal(ev.wins[0].ways, 2 * 1 * 3);
  assert.equal(ev.amount, 6 * 1 * 6);
});

// ---- spin resolution -----------------------------------------------------------------------------
for (const id of MACHINE_IDS) {
  test(`REEL-03/FAIR-05: the visible grid of ${id} is exactly the real strip at the stops`, () => {
    const cfg = loadMachine(id), prep = prepare(cfg), rng = new Rng("grid:" + id);
    for (let i = 0; i < 2000; i++) {
      const o = resolveSpin(prep, rng, { bet: cfg.defaultBet });
      o.stops.forEach((stop, r) => {
        const strip = cfg.strips.base[r];
        for (let row = 0; row < prep.rows; row++) assert.equal(o.gridStart[r][row], strip[(stop + row) % strip.length]);
      });
      assert.ok(o.totalWin <= cfg.maxWin * cfg.defaultBet);
    }
  });
}

test("MATH-01: resolving a spin is a pure function of the RNG: same seed, same outcome", () => {
  const prep = prepare(loadMachine("neon-tumble"));
  assert.deepEqual(resolveSpin(prep, new Rng(9), { bet: 50 }), resolveSpin(prep, new Rng(9), { bet: 50 }));
});

test("expanding wilds fill their reel before evaluation (WILD-02) but leave special symbols alone", () => {
  const cols = [["A", "K", "K"], ["A", "EW", "S"], ["A", "K", "K"], ["K", "K", "K"], ["K", "K", "K"]];
  const cfg = gridMachine(cols, { paytable: { A: { 3: 5, 4: 20, 5: 100 }, B: { 3: 4 }, C: { 3: 2 }, EW: { 3: 7 }, S: { 3: 2 } } });
  delete cfg.symbols.W; delete cfg.symbols.X2; delete cfg.symbols.X3;
  const o = resolveSpin(prepare(cfg), rigged([0, 0, 0, 0, 0]), { bet: 3 });
  assert.deepEqual(o.expanded, [{ reel: 1, symbol: "EW" }]);
  assert.deepEqual(o.grid[1], ["EW", "EW", "S"]); // the scatter stays
  assert.deepEqual(o.gridStart[1], ["A", "EW", "S"]); // what landed is kept for the animation
  assert.equal(o.lineWin, 5); // A, wild, A on the top row
});

test("sticky wilds stay in place for the rest of a feature (WILD-03) and are reported", () => {
  const cols = [["K", "K", "K"], ["K", "W", "K"], ["K", "K", "K"], ["K", "K", "K"], ["K", "K", "K"]];
  const first = resolveSpin(prepare(gridMachine(cols)), rigged([0, 0, 0, 0, 0]), { bet: 3, mode: "free", sticky: {} });
  assert.deepEqual(first.sticky, { "1,1": "W" });
  const empty = Array.from({ length: 5 }, () => ["K", "K", "K"]);
  const second = resolveSpin(prepare(gridMachine(empty)), rigged([0, 0, 0, 0, 0]), { bet: 3, mode: "free", sticky: first.sticky });
  assert.equal(second.grid[1][1], "W");
  assert.deepEqual(second.sticky, { "1,1": "W" });
});

test("cascading reels: winners vanish, symbols drop, refills come from the strip (CASC-01)", () => {
  const cols = [["A", "A", "A"], ["A", "A", "A"], ["A", "A", "A"], ["K", "K", "K"], ["K", "K", "K"]];
  const cfg = waysMachine(cols, { paytable: { A: { 3: 3, 4: 5, 5: 10 }, B: { 3: 1 }, C: { 3: 1 }, S: { 3: 2 } }, cascade: { enabled: true, multipliers: [1, 2, 3, 5] } });
  const o = resolveSpin(prepare(cfg), rigged([0, 0, 0, 0, 0]), { bet: 3 });
  assert.equal(o.steps.length, 2);
  assert.equal(o.steps[0].removed.length, 9);
  assert.deepEqual(o.steps[0].refill[0], ["K", "K", "K"]); // the symbols just above the stop (cyclic strip)
  assert.equal(o.steps[0].amount, 3 * 27);
  assert.equal(o.steps[1].amount, 0);
  assert.equal(o.totalWin, 81);
});

test("cascade multiplier increases per cascade and resets with the next spin (CASC-01)", () => {
  const cols = [["A", "A", "A"], ["A", "A", "A"], ["A", "A", "A"], ["K", "K", "K"], ["K", "K", "K"]];
  const cfg = waysMachine(cols, { paytable: { A: { 3: 3, 4: 5, 5: 10 }, B: { 3: 1 }, C: { 3: 1 }, S: { 3: 2 } }, cascade: { enabled: true, multipliers: [1, 2, 3, 5] } });
  for (let r = 0; r < 3; r++) cfg.strips.base[r] = ["A", "A", "A", "K", "K", "K", "K", "K", "K", "A", "A", "A"];
  const prep = prepare(cfg);
  const o = resolveSpin(prep, rigged([0, 0, 0, 0, 0]), { bet: 3 });
  assert.deepEqual(o.steps.map((s) => s.cascadeMultiplier), [1, 2, 3]);
  assert.equal(o.steps[1].amount, o.steps[1].baseAmount * 2);
  assert.equal(resolveSpin(prep, rigged([0, 0, 0, 0, 0]), { bet: 3 }).steps[0].cascadeMultiplier, 1);
});

test("MATH-05: a win above the cap is cut to the cap and flagged", () => {
  const cols = Array.from({ length: 5 }, () => ["A", "A", "A"]);
  const o = resolveSpin(prepare(gridMachine(cols, { maxWin: 10 })), rigged([0, 0, 0, 0, 0]), { bet: 3 });
  assert.equal(o.totalWin, 30);
  assert.equal(o.capped, true);
});

// ---- anticipation (FEEL-01) ----------------------------------------------------------------------
test("anticipation: only while the trigger is still possible, and never leaks the outcome", () => {
  const cfg = loadMachine("crystal-fortune"), prep = prepare(cfg);
  const make = (cols) => cols.map((col) => col.map((x) => (x ? "SCATTER" : "TEN")));
  // two scatters landed on reels 1 and 2: reels 3-5 spin longer
  const gridA = make([[1, 0, 0], [1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  assert.deepEqual(anticipationPlan(prep, gridA), [false, false, true, true, true]);
  // whether the third scatter lands or not must not change the plan for the reels before it
  const gridB = make([[1, 0, 0], [1, 0, 0], [1, 0, 0], [0, 0, 0], [0, 0, 0]]);
  assert.deepEqual(anticipationPlan(prep, gridA).slice(0, 3), anticipationPlan(prep, gridB).slice(0, 3));
  assert.deepEqual(anticipationPlan(prep, gridB), [false, false, true, false, false]); // trigger reached: nothing more to wait for
  assert.deepEqual(anticipationPlan(prep, make([[1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]])), [false, false, false, false, false]);
  // two scatters on reels 4 and 5 only: no longer possible
  assert.deepEqual(anticipationPlan(prep, make([[0, 0, 0], [0, 0, 0], [0, 0, 0], [1, 0, 0], [1, 0, 0]])), [false, false, false, false, false]);
  // the remaining reels carry no scatter at all: impossible, so no anticipation on them
  const stripped = clone(cfg);
  stripped.strips.base[3] = stripped.strips.base[3].map((s) => (s === "SCATTER" ? "TEN" : s));
  stripped.strips.base[4] = stripped.strips.base[4].map((s) => (s === "SCATTER" ? "TEN" : s));
  assert.deepEqual(anticipationPlan(prepare(stripped), gridA), [false, false, true, false, false]);
});

test("anticipation for the pick bonus follows the required reels only", () => {
  const prep = prepare(loadMachine("neon-tumble"));
  const mk = (marks) => marks.map((m) => [m ? "BONUS" : "CIRCLE", "CIRCLE", "CIRCLE"]);
  const plan = anticipationPlan(prep, mk([1, 0, 1, 0, 0]));
  assert.equal(plan[4], true);
  assert.equal(plan[3], false);
  assert.deepEqual(anticipationPlan(prep, mk([0, 0, 1, 0, 0])).filter(Boolean), []); // reel 1 already missed
});
