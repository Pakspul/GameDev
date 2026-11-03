#!/usr/bin/env node
// Assembles the playable web build in dist/ — this folder is what Capacitor copies into
// the Android (and later iOS) app, and what gets published to GitHub Pages.
//
// No bundler needed (yet): the games are plain HTML/CSS/JS, so a build is a clean copy
// of the files the player needs, leaving out tooling and source-only files.
import { cp, rm, mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const INCLUDE = ["index.html", "manifest.webmanifest", "games", "shared"];
const SKIP_FILES = new Set(["google-fonts.txt", "README.md", ".DS_Store"]); // source-only files

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST);
for (const entry of INCLUDE) {
  await cp(join(ROOT, entry), join(DIST, entry), { recursive: true, filter: (src) => !SKIP_FILES.has(basename(src)) });
}

// Report size per top-level part so growth is visible over time.
async function size(p) {
  const s = await stat(p);
  if (!s.isDirectory()) return s.size;
  let n = 0;
  for (const f of await readdir(p)) n += await size(join(p, f));
  return n;
}
const kb = (b) => (b / 1024).toFixed(0).padStart(5) + " KB";
console.log("dist/ built:");
for (const g of await readdir(join(DIST, "games"))) console.log(`  games/${g.padEnd(16)} ${kb(await size(join(DIST, "games", g)))}`);
console.log(`  shared/                ${kb(await size(join(DIST, "shared")))}`);
console.log(`  total                  ${kb(await size(DIST))}`);
