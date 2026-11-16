// Inkfield's computer players, in bots-only matches (tests/inkfield/sim.mjs). Not exact numbers:
// sanity bounds that catch a bot that stopped claiming land or keeps crashing into itself.
import test from "node:test";
import assert from "node:assert/strict";
import { runMatch } from "./sim.mjs";

test("bots claim land, cut each other, and rarely crash into their own trail", () => {
  let outs = 0, self = 0, cut = 0, best = 0, captures = 0;
  for (let s = 1; s <= 6; s++) {
    const r = runMatch(s * 7919, "normal", { maxTime: 180 });
    captures += r.captures;
    best += r.maxShare;
    for (const o of r.outs) { outs++; if (o.how === "self") self++; if (o.how === "cut") cut++; }
  }
  assert.ok(captures > 200, `bots should keep closing loops (${captures} captures)`);
  assert.ok(best / 6 > 0.04, `someone should reach a few percent (${(100 * best / 6).toFixed(1)}%)`);
  assert.ok(outs > 0 && cut > 0, "bots should cut each other");
  assert.ok(self / outs < 0.4, `too many bots ran into their own trail: ${self} of ${outs}`);
});
