#!/usr/bin/env node
// Report on Unscrew's 3D models (see docs/UNSCREW-MODELS.md). It loads the real game in a headless
// browser and generates each model at every difficulty and a spread of levels, then prints:
//   - screws: how many screws the level has (compare with the other models);
//   - kept:   the share of built parts that survived. finalize() silently drops a part that gets no
//             screw (a slot too close to another screw, a cover plate too thin, a deadlock between two
//             parts). A dropped part is a hole in the model, so aim for 90% or more;
//   - tries:  how many seeds generation needed (1 is normal; 10 failures is an error).
// With --drops it also lists every dropped part (its shape, size and position), to find out why.
// With --shots it saves a front and a back screenshot per model and difficulty in
// test-results/unscrew-models/, to check by eye.
//
//   node scripts/unscrew-models.mjs                    every model
//   node scripts/unscrew-models.mjs villa,giraffe      only these
//   node scripts/unscrew-models.mjs giraffe --drops    plus the parts that were dropped
//   node scripts/unscrew-models.mjs giraffe --shots    plus screenshots
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "test-results", "unscrew-models");
const args = process.argv.slice(2);
const shots = args.includes("--shots"), drops = args.includes("--drops");
const only = args.find((a) => !a.startsWith("--"))?.split(",");
const DIFFS = ["easy", "normal", "hard", "expert"], LEVELS = [1, 4, 8, 12, 20];

const server = await startServer({ dir: ROOT, port: 0, host: "127.0.0.1" });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const url = `http://127.0.0.1:${server.address().port}/games/unscrew/index.html`;
await page.goto(url);
await page.waitForTimeout(500);

const names = only || (await page.evaluate(() => GENS3D.map((g) => g[0])));
const report = await page.evaluate(({ names, DIFFS, LEVELS }) => names.map((name) => {
  const g = GENS3D.find((g) => g[0] === name);
  if (!g) return { name, missing: true };
  const f = (n) => n.toFixed(2), at = (v) => `(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
  const describe = (p) => `${p.box ? `box ${f(p.box.w)} x ${f(p.box.h)} x ${f(p.box.d)}` : p.cyl ? `cylinder r ${f(p.cyl.r)} h ${f(p.cyl.h)}` : p.mesh.geometry.type.replace("Geometry", "").toLowerCase()} at ${at(p.mesh.position)}, ${p.slots.length} slot(s)`;
  return { name, rows: DIFFS.map((diff) => LEVELS.map((level) => {
    const cfg = cfgFor(diff, level);
    for (let attempt = 0; attempt < 10; attempt++) {
      const R = rng(`3d|${diff}|${level}|report|${attempt}`);
      BLD = { group: new THREE.Group(), parts: [] }; g[1](R, cfg);
      const built = BLD.parts.filter((p) => !p.static), lv = finalize(R, cfg, "3d");
      if (lv) {
        const live = new Set(lv.parts), lost = built.filter((p) => !live.has(p)).map(describe);
        disposeTree(lv.group); return { diff, level, screws: lv.screws.length, kept: 1 - lost.length / built.length, tries: attempt + 1, lost };
      }
      disposeTree(BLD.group);
    }
    return { diff, level, failed: true };
  })) };
}), { names, DIFFS, LEVELS });

let failures = 0;
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("model", 12) + DIFFS.map((d) => pad(d, 22)).join(""));
for (const m of report) {
  if (m.missing) { failures++; console.log(`✗ ${m.name}: no such model in GENS3D`); continue; }
  const cells = m.rows.map((row) => {
    const ok = row.filter((r) => !r.failed);
    failures += row.length - ok.length;
    if (!ok.length) return pad("FAILED", 22);
    const sc = ok.map((r) => r.screws), kept = Math.min(...ok.map((r) => r.kept)), tries = Math.max(...ok.map((r) => r.tries));
    return pad(`${Math.min(...sc)}-${Math.max(...sc)} scr, ${Math.round(kept * 100)}%${tries > 1 ? ` ${tries}t` : ""}${ok.length < row.length ? " FAIL" : ""}`, 22);
  });
  console.log(pad(m.name, 12) + cells.join(""));
}
console.log("\nscr = screws per level (lowest-highest), % = lowest share of parts kept, Nt = most seeds needed");
if (drops) for (const m of report.filter((m) => m.rows)) {
  console.log(`\nDropped parts: ${m.name}`);
  const lines = m.rows.flat().filter((r) => r.lost?.length).map((r) => `  ${r.diff} ${r.level}:\n${r.lost.map((l) => `      ${l}`).join("\n")}`);
  console.log(lines.length ? lines.join("\n") : "  none");
}

if (shots) {
  await mkdir(OUT, { recursive: true });
  for (const name of names) for (const [diff, level] of [["easy", 1], ["normal", 6], ["expert", 20]]) {
    await page.goto(url);
    await page.waitForTimeout(500);
    await page.evaluate(([name, diff, level]) => {
      const g = GENS3D.find((g) => g[0] === name); GENS3D.length = 0; GENS3D.push(g);
      newRun(); Object.assign(G, { mode: "3d", diff, level }); startLevel();
    }, [name, diff, level]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, `${name}-${diff}-${level}-front.png`) });
    await page.evaluate(() => { orbit.az += Math.PI; });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${name}-${diff}-${level}-back.png`) });
  }
  console.log(`Screenshots in ${OUT}`);
}
if (errors.length) { failures += errors.length; console.log("Errors:\n  " + errors.join("\n  ")); }
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
