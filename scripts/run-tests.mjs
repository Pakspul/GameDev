// Runs every *.test.mjs in a folder with the Node test runner: node scripts/run-tests.mjs tests/slots
// It exists because `node --test tests/slots/*.test.mjs` only works where the shell expands the *
// (Linux and macOS): in the Windows shell nothing expands it, and older Node versions don't either.
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dir = process.argv[2];
if (!dir) { console.error("usage: node scripts/run-tests.mjs <folder>"); process.exit(2); }

const files = readdirSync(resolve(dir)).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => join(dir, f));
if (!files.length) { console.error(`no *.test.mjs files in ${dir}`); process.exit(2); }

const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
