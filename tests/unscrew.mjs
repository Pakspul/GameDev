#!/usr/bin/env node
// Checks the wiring of Unscrew's 3D models (games/unscrew/models/, see docs/UNSCREW-MODELS.md) without a browser:
//   1. index.html loads three.js, then models/kit.js, every category file, models/order.js, then game.js;
//   2. every registered model is in MODEL_ORDER exactly once, and every name in MODEL_ORDER is registered;
//   3. a model is registered under the category of its file (houses.js registers 'houses');
//   4. MODEL_ORDER only ever grows at the end: the level shuffle depends on the position of each model;
//   5. every model has a name ("obj.<name>") in every language;
//   6. realism mode (real/real.js, docs/UNSCREW-BLENDER.md): GLTFLoader and real.js load in the right place, every
//      model's .glb exists and follows the rules for parts (one mesh with one material, screws, closed proxies).
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

// 6. realism models
const loader = scripts.findIndex((s) => s.endsWith("GLTFLoader.js"));
if (!(three < loader && loader < at("real/real.js") && at("models/order.js") < at("real/real.js") && at("real/real.js") < at("game.js")))
  fail("index.html must load three.min.js, GLTFLoader.js, then real/real.js after models/order.js and before game.js");
const realSrc = await readFile(join(GAME, "real", "real.js"), "utf8");
const reals = [...realSrc.matchAll(/\{name:'(\w+)',cat:'(\w+)',file:'([^']+)'/g)].map(([, name, cat, file]) => ({ name, cat, file }));
if (!reals.length) fail("real/real.js lists no models in REAL_MODELS");
for (const [lang, t] of Object.entries(langs)) for (const { name } of reals) if (!t[`obj.${name}`]) fail(`strings.js (${lang}) has no "obj.${name}"`);
let realParts = 0;
for (const { name, file } of reals) {
  let buf;
  try { buf = await readFile(join(GAME, file)); } catch { fail(`real/real.js lists ${file} for "${name}", but there is no such file`); continue; }
  // A .glb: a 12-byte header, then a JSON chunk that describes the scene
  if (buf.readUInt32LE(0) !== 0x46546c67) { fail(`${file} isn't a binary glTF (.glb)`); continue; }
  const gl = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
  const node = (i) => gl.nodes[i], label = (n) => n.name || "(unnamed)";
  for (const i of gl.scenes[gl.scene || 0].nodes) {
    const n = node(i), kids = (n.children || []).map(node), x = n.extras || {};
    realParts++;
    if (n.mesh === undefined) { fail(`${file}: top-level object "${label(n)}" isn't a mesh, so it can't be a part`); continue; }
    if (gl.meshes[n.mesh].primitives.length !== 1) fail(`${file}: part "${label(n)}" has ${gl.meshes[n.mesh].primitives.length} materials; a part has one (make the rest child objects)`);
    const screws = kids.filter((k) => /^screw/i.test(k.name || ""));
    if (!x.static && !screws.length) fail(`${file}: part "${label(n)}" has no screw empties, so it would never be in a level`);
    if (x.static && screws.length) fail(`${file}: static part "${label(n)}" has screw empties; static parts never get screws`);
    for (const k of screws) if (k.mesh !== undefined) fail(`${file}: "${label(k)}" on "${label(n)}" is a mesh; screws are empties`);
    // the shape screws and rays see: the "_proxy" child, else the part itself. It must be closed: every edge shared
    // by an even number of triangles (glTF splits vertices along seams, so corners are matched by position)
    const proxy = kids.find((k) => /_proxy$/.test(k.name || ""));
    if (proxy && proxy.mesh === undefined) { fail(`${file}: "${label(proxy)}" isn't a mesh`); continue; }
    const shape = proxy || n, p = gl.meshes[shape.mesh].primitives[0], bin = 20 + buf.readUInt32LE(12) + 8;
    const view = (a) => bin + (gl.bufferViews[a.bufferView].byteOffset || 0) + (a.byteOffset || 0);
    const acc = gl.accessors[p.indices], off = view(acc), pos = gl.accessors[p.attributes.POSITION], poff = view(pos);
    const read = acc.componentType === 5125 ? (j) => buf.readUInt32LE(off + 4 * j) : (j) => buf.readUInt16LE(off + 2 * j);
    const key = (j) => [0, 1, 2].map((c) => buf.readFloatLE(poff + 12 * j + 4 * c).toFixed(4)).join(",");
    const edges = new Map();
    for (let t = 0; t < acc.count; t += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const ka = key(read(t + a)), kb = key(read(t + b));
      if (ka !== kb) { const e = ka < kb ? ka + "|" + kb : kb + "|" + ka; edges.set(e, (edges.get(e) || 0) + 1); }
    }
    const open = [...edges.values()].filter((c) => c % 2).length;
    if (open) fail(`${file}: the collision shape of "${label(n)}" ${proxy ? `("${label(proxy)}") ` : ""}isn't closed (${open} open edges), so screws can't tell inside from outside`);
  }
}

console.log(failures ? `\n${failures} problem(s) in Unscrew's models.` : `✓ Unscrew: ${order.length} models in ${cats.length} categories, wired up and named in ${Object.keys(langs).join(" and ")}; ${reals.length} realism model(s) with ${realParts} parts`);
process.exit(failures ? 1 : 0);
