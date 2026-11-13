#!/usr/bin/env node
// Math simulator for the slot machines (TOOL-01, TOOL-02, TOOL-04). It plays the very same engine
// code as the game, headless, and reports RTP per feature, hit frequency, trigger rates, the win
// distribution per celebration tier, the biggest win, jackpot frequencies and volatility.
//
//   node scripts/slots-sim.mjs                       every machine, 1 million spins
//   node scripts/slots-sim.mjs crystal-fortune --spins 10000000 --seed 2026
//   node scripts/slots-sim.mjs neon-tumble --fs-option 1     scripted player: always pick free-spins option 2
//   node scripts/slots-sim.mjs --json                machine-readable report
//   node scripts/slots-sim.mjs --check               CI: fail when a target is missed (see below)
//   node scripts/slots-sim.mjs --check --changed     CI: only the configs changed against origin/main
//   node scripts/slots-sim.mjs --verify              release gate: 10 million spins, RTP within the plain tolerance
//   node scripts/slots-sim.mjs --replay session.json replay a recorded session (seed + input log) and print the result
//
// --check allows the tolerance (±0.5 percentage point) plus two standard errors, because 1 million
// spins cannot measure an RTP that precisely; --verify (10 million spins) uses the plain tolerance, as MATH-04 asks.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { simulate, simulateFreeSpinsOption, formatReport } from "../games/crystal-reels/src/engine/simulate.js";
import { Session } from "../games/crystal-reels/src/core/session.js";
import { validateMachine } from "../games/crystal-reels/src/engine/config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "games", "crystal-reels", "machines");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes("--" + n);
const opt = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
const names = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && ["spins", "seed", "fs-option", "replay"].includes(argv[i - 1].slice(2))));

const load = (id) => JSON.parse(readFileSync(join(DIR, id + ".json"), "utf8"));
let ids = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));

if (flag("replay")) {
  const log = JSON.parse(readFileSync(opt("replay"), "utf8"));
  const s = Session.replay(load(log.machine), log);
  console.log(`Replayed ${log.inputs.length} inputs on ${log.machine}: balance ${s.balance}`);
  process.exit(0);
}

if (flag("changed")) {
  try {
    const out = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD", "--", "games/crystal-reels/machines", "games/crystal-reels/src/engine"], { cwd: ROOT, encoding: "utf8" });
    const engineChanged = out.split("\n").some((l) => l.includes("src/engine"));
    if (!engineChanged) ids = ids.filter((id) => out.includes(`machines/${id}.json`));
  } catch (e) { /* no git history here: check everything */ }
  if (!ids.length) { console.log("No changed slot configs to check."); process.exit(0); }
}
if (names.length) ids = names;

const verify = flag("verify");
const spins = Number(opt("spins", verify ? 10000000 : 1000000));
const seed = Number(opt("seed", verify ? 2026 : 2026));
const fsOption = opt("fs-option", undefined);
let failed = false;
const reports = [];

for (const id of ids) {
  const cfg = load(id);
  const errors = validateMachine(cfg);
  if (errors.length) { console.error(`${id} is invalid:\n  ` + errors.join("\n  ")); process.exit(1); }
  const t0 = Date.now();
  const r = simulate(cfg, { spins, seed, fsOption: fsOption === undefined ? 0 : Number.isNaN(Number(fsOption)) ? fsOption : Number(fsOption) });
  reports.push(r);
  if (!flag("json")) { console.log(formatReport(r, cfg)); console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }

  if (flag("check") || verify) {
    const tg = cfg.targets, problems = [];
    const slack = verify ? 0 : 2 * r.rtpStdError;
    if (Math.abs(r.rtp - tg.rtp) > tg.rtpTolerance + slack) problems.push(`RTP ${(r.rtp * 100).toFixed(2)}% is outside ${(tg.rtp * 100).toFixed(1)}% ± ${(tg.rtpTolerance * 100).toFixed(1)} points`);
    if (r.hitFrequency < tg.hitFrequency[0] || r.hitFrequency > tg.hitFrequency[1]) problems.push(`hit frequency ${(r.hitFrequency * 100).toFixed(1)}% is outside ${tg.hitFrequency.join("-")}`);
    const fsRate = r.triggerRates.freeSpins ? r.triggerRates.freeSpins.oneIn : Infinity;
    if (cfg.features.freeSpins && (fsRate < tg.freeSpinsEvery[0] || fsRate > tg.freeSpinsEvery[1])) problems.push(`free spins 1 in ${fsRate.toFixed(0)} is outside 1 in ${tg.freeSpinsEvery.join("-")}`);
    if (r.volatility !== tg.volatility) problems.push(`declared volatility "${tg.volatility}" but the simulation says "${r.volatility}" (index ${r.volatilityIndex.toFixed(2)})`);
    if (r.maxEventMultiple > cfg.maxWin + 1e-9) problems.push(`a spin or feature paid ${r.maxEventMultiple}x, above the cap`);
    if (cfg.features.freeSpins && cfg.features.freeSpins.choice) {
      // FS-04: all options are worth the same, within 2 %
      const runs = verify ? 400000 : 60000;
      const evs = cfg.features.freeSpins.choice.map((o) => simulateFreeSpinsOption(cfg, o.id, runs, 11));
      const mean = evs.reduce((a, e) => a + e.mean, 0) / evs.length;
      for (const e of evs) {
        console.log(`  Free spins option ${e.option}: ${e.spins} spins, EV ${e.mean.toFixed(1)}x bet (± ${e.stdError.toFixed(2)})`);
        if (Math.abs(e.mean - mean) > 0.02 * mean + 2 * e.stdError) problems.push(`free spins option ${e.option} is worth ${e.mean.toFixed(1)}x vs ${mean.toFixed(1)}x average (more than 2% apart)`);
      }
    }
    if (problems.length) { failed = true; console.log(`  ✗ ${id}\n    ` + problems.join("\n    ")); } else console.log(`  ✓ ${id} meets its targets`);
  }
  console.log();
}
if (flag("json")) console.log(JSON.stringify(reports, null, 2));
process.exit(failed ? 1 : 0);
