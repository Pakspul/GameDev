#!/usr/bin/env node
// Validates every slot machine config (MATH-03): unknown symbols, paylines outside the grid, missing
// paytable entries and so on. `npm run build` runs the same check; so does `npm test`.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateMachine } from "../games/slots/src/engine/config.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "games", "slots", "machines");
let bad = 0;
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".json"))) {
  const errors = validateMachine(JSON.parse(readFileSync(join(DIR, f), "utf8")));
  if (errors.length) { bad++; console.log(`✗ ${f}\n  ` + errors.join("\n  ")); } else console.log(`✓ ${f}`);
}
process.exit(bad ? 1 : 0);
