import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SLOTS = join(ROOT, "games", "crystal-reels");
export const MACHINE_IDS = ["crystal-fortune", "neon-tumble"];
export const loadJson = (rel) => JSON.parse(readFileSync(join(SLOTS, rel), "utf8"));
export const loadMachine = (id) => loadJson(`machines/${id}.json`);
export const loadGame = () => loadJson("data/game.json");
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** A fake RNG that returns chosen stops for int() and fixed numbers for float()/weighted(). */
export function rigged(stops, floats = []) {
  const s = stops.slice(), f = floats.slice();
  return {
    seed: [1, 2, 3, 4],
    int(n) { const v = s.length ? s.shift() : 0; if (v >= n) throw new Error(`rigged stop ${v} out of range ${n}`); return v; },
    float() { return f.length ? f.shift() : 0.999; },
    weighted() { return 0; },
  };
}

/**
 * A small machine whose first three symbols on every reel are `cols[r]`, so with stops [0,0,0,0,0]
 * the grid is exactly `cols`. Filler is K (a coin symbol: it never pays and never substitutes).
 */
export function gridMachine(cols, patch = {}, fill = "K") {
  const filler = Array.from({ length: 9 }, () => fill);
  const strips = cols.map((c) => c.concat(filler));
  const cfg = {
    schema: 1, id: "fixture", version: 1, name: "Fixture",
    grid: { reels: cols.length, rows: 3 }, mode: "lines", betDivisor: 3,
    betLevels: [3, 30], betUnlockLevels: [1, 1], defaultBet: 3,
    symbols: {
      A: { kind: "regular" }, B: { kind: "regular" }, C: { kind: "regular" },
      W: { kind: "wild" }, X2: { kind: "wild", multiplier: 2 }, X3: { kind: "wild", multiplier: 3 }, EW: { kind: "wild", expanding: true },
      S: { kind: "scatter" }, K: { kind: "coin" }, G: { kind: "collect" }, N: { kind: "bonus" },
    },
    paylines: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2]],
    paytable: {
      A: { 3: 5, 4: 20, 5: 100 }, B: { 3: 4, 4: 10, 5: 50 }, C: { 3: 2, 4: 5, 5: 20 },
      W: { 3: 50, 4: 200, 5: 1000 }, S: { 3: 2, 4: 10, 5: 50 },
    },
    wild: { combine: "multiply" },
    strips: { base: strips },
    featureOrder: [], maxWin: 5000,
    winTiers: { win: 1, big: 10, mega: 25, epic: 50 },
    anticipation: { extraMs: 1000, triggers: [] },
    targets: { rtp: 0.96, hitFrequency: [0.25, 0.35], freeSpinsEvery: [150, 200], volatility: "medium", rtpTolerance: 0.005 },
  };
  return Object.assign(cfg, patch);
}
