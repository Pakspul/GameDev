#!/usr/bin/env node
// Checks the wiring of Unscrew's 3D models (games/unscrew/models/, see docs/UNSCREW-MODELS.md) without a browser:
//   1. index.html loads three.js, then models/kit.js, every category file, models/order.js, then game.js;
//   2. every registered model is in MODEL_ORDER exactly once, and every name in MODEL_ORDER is registered;
//   3. a model is registered under the category of its file (houses.js registers 'houses');
//   4. MODEL_ORDER only ever grows at the end: the level shuffle depends on the position of each model;
//   5. every model has a name ("obj.<name>") in every language.
//
//   node tests/unscrew.mjs
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..", "games", "unscrew");
// MODEL_ORDER as it stands. Appending to MODEL_ORDER needs no change here; reordering it would reshuffle every level.
const FIXED = ["cottage", "room", "mill", "castle", "rocket", "robot", "villa", "giraffe", "camper", "watertower", "turtle", "canalhouse"];

let failures = 0;
const fail = (m) => { failures++; console.log(`✗ ${m}`); };

// 1. script order
const html = await readFile(join(GAME, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const cats = (await readdir(join(GAME, "models"))).filter((f) => f.endsWith(".js") && f !== "kit.js" && f !== "order.js");
const at = (s) => scripts.indexOf(s);
const three = scripts.findIndex((s) => s.endsWith("three.min.js"));
if (!(three >= 0 && three < at("models/kit.js") && at("models/kit.js") < at("models/order.js") && at("models/order.js") < at("game.js")))
  fail("index.html must load three.min.js, then models/kit.js, then models/order.js, then game.js");
for (const f of cats) {
  const i = at(`models/${f}`);
  if (i < 0) fail(`index.html doesn't load models/${f}`);
  else if (!(at("models/kit.js") < i && i < at("models/order.js"))) fail(`index.html must load models/${f} between models/kit.js and models/order.js`);
}

// 2 and 3. registry against MODEL_ORDER
const registered = [];
for (const f of cats) {
  const src = await readFile(join(GAME, "models", f), "utf8");
  for (const [, name, cat] of src.matchAll(/^model\('(\w+)','(\w+)',/gm)) {
    registered.push(name);
    if (cat !== f.slice(0, -3)) fail(`models/${f} registers "${name}" under category "${cat}"`);
  }
}
const orderSrc = await readFile(join(GAME, "models", "order.js"), "utf8");
const order = JSON.parse(orderSrc.match(/const MODEL_ORDER=(\[[^\]]*\])/)[1].replaceAll("'", '"'));
for (const n of new Set([...registered, ...order])) {
  const r = registered.filter((x) => x === n).length, o = order.filter((x) => x === n).length;
  if (r !== 1) fail(`"${n}" is registered ${r} times in models/`);
  if (o !== 1) fail(`"${n}" is ${o} times in MODEL_ORDER (models/order.js)`);
}

// 4. append-only
if (FIXED.some((n, i) => order[i] !== n)) fail(`MODEL_ORDER must start with ${FIXED.join(", ")}: add new models at the end, never reorder`);

// 5. translations
const langs = {};
vm.runInNewContext(await readFile(join(GAME, "strings.js"), "utf8"), { I18n: { add: (o) => Object.assign(langs, o), apply() {} } });
for (const [lang, t] of Object.entries(langs)) for (const n of order) if (!t[`obj.${n}`]) fail(`strings.js (${lang}) has no "obj.${n}"`);

console.log(failures ? `\n${failures} problem(s) in Unscrew's models.` : `✓ Unscrew: ${order.length} models in ${cats.length} categories, wired up and named in ${Object.keys(langs).join(" and ")}`);
process.exit(failures ? 1 : 0);
