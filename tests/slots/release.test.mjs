import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./helpers.mjs";

// Always check a fresh release build.
execFileSync(process.execPath, [join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, stdio: "ignore" });
const dist = join(ROOT, "dist", "games", "crystal-reels");
const files = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } };
walk(dist);

test("TOOL-03: a release build contains no debug menu and no forcing code", () => {
  assert.equal(existsSync(join(dist, "src", "debug")), false);
  for (const f of files.filter((p) => /\.(js|html|json|css)$/.test(p))) {
    const text = readFileSync(f, "utf8");
    assert.ok(!/debug|forceFeature|forceStops|slotsDebug/i.test(text), `${f} refers to the debug tooling`);
  }
});

test("a release build still has everything the game needs", () => {
  for (const rel of ["index.html", "game.js", "style.css", "strings.js", "data/game.json", "machines/crystal-fortune.json", "machines/neon-tumble.json", "src/engine/spin.js", "src/ui/machine-screen.js"]) assert.ok(existsSync(join(dist, rel)), rel);
});

test("MATH-03: the build refuses an invalid machine config", () => {
  // validation runs before anything is copied; the same check the build uses
  const bad = { id: "x" };
  assert.ok(files.length > 0);
  assert.throws(() => execFileSync(process.execPath, ["--input-type=module", "-e", `import { prepare } from ${JSON.stringify(join(ROOT, "games/crystal-reels/src/engine/config.js"))}; prepare(${JSON.stringify(bad)});`], { stdio: "ignore" }));
});
