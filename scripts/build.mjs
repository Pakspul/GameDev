#!/usr/bin/env node
// Assembles the playable web build in dist/ — this folder is what Capacitor copies into
// the Android (and later iOS) app, and what gets published to GitHub Pages / Azure.
//
// No bundler needed (yet): the games are plain HTML/CSS/JS, so a build is a clean copy
// of the files the player needs, leaving out tooling and source-only files.
//
//   npm run build                       the collection: hub + every game
//   npm run build -- --game outbound    one game on its own (for a standalone app later):
//                                       no hub, the app opens straight into the game
//   npm run build -- --experimental     also include the EXPERIMENTAL games (npm test does this)
import { cp, rm, mkdir, readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const gi = process.argv.indexOf("--game");
const ONLY = gi > 0 ? process.argv[gi + 1] : null;
// Playable in `npm run dev`, but left out of production builds (and their hub card removed)
// until they're ready. Asking for one with --game still builds it.
const EXPERIMENTAL = ["camper-crew"];
const HIDDEN = ONLY || process.argv.includes("--experimental") ? [] : EXPERIMENTAL;
// staticwebapp.config.json is read by Azure Static Web Apps (MIME types, headers); harmless elsewhere.
const GAMES = (await readdir(join(ROOT, "games"))).filter((g) => !HIDDEN.includes(g)).map((g) => `games/${g}`);
const INCLUDE = ONLY ? [`games/${ONLY}`, "shared", "staticwebapp.config.json"]
  : ["index.html", "manifest.webmanifest", ...GAMES, "shared", "staticwebapp.config.json"];
const SKIP_FILES = new Set(["google-fonts.txt", "README.md", ".DS_Store"]); // source-only files
if (gi > 0 && !(await readdir(join(ROOT, "games"))).includes(ONLY)) {
  console.error(`Unknown game "${ONLY}". Choose one of: ${(await readdir(join(ROOT, "games"))).join(", ")}`);
  process.exit(1);
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST);
for (const entry of INCLUDE) {
  await cp(join(ROOT, entry), join(DIST, entry), { recursive: true, filter: (src) => !SKIP_FILES.has(basename(src)) });
}
if (HIDDEN.length) {
  const hub = join(DIST, "index.html");
  let html = await readFile(hub, "utf8");
  for (const g of HIDDEN) {
    html = html.replace(new RegExp(`\\s*<a class="card[^"]*" href="games/${g}/index\\.html">[\\s\\S]*?</a>`), "");
    if (html.includes(`games/${g}/`)) throw new Error(`Couldn't remove the hub card for ${g} from index.html`);
  }
  await writeFile(hub, html);
}
if (ONLY) {
  // Start page that jumps straight into the game. location.replace keeps it out of the
  // history, so the Android back button doesn't bounce back into this page.
  await writeFile(join(DIST, "index.html"),
    `<!doctype html><meta charset="utf-8"><script>location.replace("games/${ONLY}/index.html")</script>\n`);
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
console.log(ONLY ? `dist/ built (standalone: ${ONLY}):` : "dist/ built:");
if (HIDDEN.length) console.log(`  (left out, experimental: ${HIDDEN.join(", ")}; add --experimental to include)`);
for (const g of await readdir(join(DIST, "games"))) console.log(`  games/${g.padEnd(16)} ${kb(await size(join(DIST, "games", g)))}`);
console.log(`  shared/                ${kb(await size(join(DIST, "shared")))}`);
console.log(`  total                  ${kb(await size(DIST))}`);
