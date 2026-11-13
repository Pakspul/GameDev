import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { SLOTS, MACHINE_IDS, loadMachine, loadGame } from "./helpers.mjs";

// Load strings.js the way the page does, with a stand-in for the shared I18n layer.
const dicts = {};
vm.runInNewContext(readFileSync(join(SLOTS, "strings.js"), "utf8"), {
  I18n: { add(d) { for (const l of Object.keys(d)) dicts[l] = { ...(dicts[l] || {}), ...d[l] }; }, apply() {} },
});

test("NFR-10: Dutch and English have exactly the same keys, and no text is empty", () => {
  const en = Object.keys(dicts.en), nl = Object.keys(dicts.nl);
  assert.deepEqual(en.filter((k) => !(k in dicts.nl)), [], "missing in Dutch");
  assert.deepEqual(nl.filter((k) => !(k in dicts.en)), [], "missing in English");
  for (const l of ["en", "nl"]) for (const [k, v] of Object.entries(dicts[l])) assert.ok(String(v).trim(), `${l}:${k} is empty`);
});

test("NFR-10: placeholders match between languages", () => {
  const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(dicts.en)) assert.equal(ph(dicts.nl[k]), ph(dicts.en[k]), k);
});

test("NFR-10: every key the code asks for exists (all strings are externalised)", () => {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".js") && !p.endsWith("strings.js")) files.push(p); } };
  walk(join(SLOTS, "src", "ui")); files.push(join(SLOTS, "game.js"));
  const keys = new Set();
  const dynamic = new Set();
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/\b(?:t|_t)\(\s*"([\w.]+)"\s*([+,)])/g)) (m[2] === "+" ? dynamic : keys).add(m[1]);
    for (const m of text.matchAll(/["'](tier\.\w+)["']/g)) keys.add(m[1]);
    for (const m of text.matchAll(/\bt\([^()]*\? "([\w.]+)" : "([\w.]+)"/g)) { keys.add(m[1]); keys.add(m[2]); }
  }
  const game = loadGame();
  const expand = {
    "ach.": game.achievements.map((a) => a.id), "mission.": game.missions.pool.map((m) => m.id),
    "jp.": ["mini", "minor", "major", "grand"], "info.tab.": ["pay", "lines", "features", "jackpots"],
    "info.combine.": ["multiply", "add"], "info.per.": ["spin", "win"], "info.meter.": ["freeSpins", "pick"],
    "rank.": game.xp.ranks.list.map((r) => r.id),
    "ch.": [...new Set(game.challenges.pool.map((c) => c.metric))],
    "chain.": [...new Set(game.chains.flatMap((c) => c.steps.map((s) => s.metric)))],
    "chainname.": game.chains.map((c) => c.id),
    "gem.": game.gems.list.map((g) => g.id), "gemhow.": game.gems.list.map((g) => g.id),
    "frame.": game.frames.map((f) => f.id),
    "fs.opt.": MACHINE_IDS.flatMap((id) => (loadMachine(id).features.freeSpins.choice || []).map((o) => o.id)),
  };
  for (const prefix of dynamic) {
    assert.ok(expand[prefix], `dynamic key prefix ${prefix} has no known expansion; add it to this test`);
    for (const id of expand[prefix]) keys.add(prefix + id);
  }
  const missing = [...keys].filter((k) => !(k in dicts.en));
  assert.deepEqual(missing, []);
  assert.ok(keys.size > 150);
});
