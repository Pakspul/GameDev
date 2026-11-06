// Levels as data. Every wall (the fixed level 1, generated levels, bosses, Descent walls, Puzzle
// and Time Attack walls) comes out in the same JSON format:
//
//   { kind, number, seed, cellH, bricks: [{ id, t, hp, c, r, w, h, g?, pair? }], groups: [...] }
//
//   t      brick type: normal tough steel explosive moving regen portal gift ghost core plus
//   c, r   column and row in the grid (12 columns; row 0 is the top row, rows can be negative in
//          Descent, where they wait above the top of the screen)
//   w, h   size in cells (most bricks are 1 × 1; gifts can be 2 wide, the boss core is 4 × 2)
//   g      moving group id (bricks in one group move together; see `groups`)
//   pair   portal pair id
//
// generate(worldSeed, n) is a pure function: the same inputs give the same wall on every device.
// FROZEN like rng.js: tests/wallbreaker.mjs fingerprints levels, so any change here is on purpose.
import { CONFIG } from "./config.js";
import { hash32, hash01, rng, weighted } from "./rng.js";

const C = CONFIG;
const COLS = C.world.cols;
const HALF = COLS / 2;
const I = C.intro;

/** The world seed Classic and Zen share, so level 47 is the same wall for everyone. */
export const CLASSIC_SEED = 0x5eed0001;
/** Descent's own fixed world. */
export const DESCENT_SEED = 0x5eed0d0d;

/** Types the ball must break to clear a wall. Steel and portals stay; +1 ball pickups are taken. */
export const BREAKABLE = new Set(["normal", "tough", "explosive", "moving", "regen", "gift", "ghost", "core"]);

// ---- Level 1 ---------------------------------------------------------------------------------------
/** Four rows of normal bricks and one gift brick in the middle of the bottom row. */
export function level1() {
  const bricks = [];
  let id = 0;
  for (let r = 1; r <= 4; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 4 && (c === 5 || c === 6)) continue;
      bricks.push({ id: id++, t: "normal", hp: 1, c, r, w: 1, h: 1 });
    }
  }
  bricks.push({ id: id++, t: "gift", hp: 1, c: 5, r: 4, w: 2, h: 1 });
  return { kind: "wall", number: 1, seed: hash32("wallbreaker-level-1"), salt: 0, cellH: C.world.cellH, bricks, groups: [] };
}

// ---- Templates -------------------------------------------------------------------------------------
// Each returns rows × HALF booleans for the left half; hc 0 is the outer edge, hc 5 the centre.
// The right half is the mirror image, so every generated wall is symmetric.
const TEMPLATES = {
  rows(R, r) {
    const gaps = new Set();
    for (let y = 1; y < R - 1; y++) if (r.chance(0.22)) gaps.add(y);
    return grid(R, (y) => !gaps.has(y));
  },
  pyramid(R) {
    return grid(R, (y, hc) => hc >= HALF - 1 - Math.floor(((y + 1) * HALF) / R));
  },
  funnel(R) {
    return grid(R, (y, hc) => hc >= Math.floor(((y + 1) * HALF) / (R + 1)) - 1);
  },
  rings(R, r) {
    const off = r.int(2);
    return grid(R, (y, hc) => (Math.min(y, R - 1 - y, hc) + off) % 2 === 0);
  },
  checker(R, r) {
    const off = r.int(2);
    return grid(R, (y, hc) => (y + hc + off) % 2 === 0);
  },
  columns(R, r) {
    const step = r.range(2, 3);
    const holes = new Set();
    for (let k = 0; k < R; k++) if (r.chance(0.18)) holes.add(r.int(R) * HALF + r.int(HALF));
    return grid(R, (y, hc) => hc % step !== step - 1 && !holes.has(y * HALF + hc));
  },
  diamond(R) {
    const mid = (R - 1) / 2;
    return grid(R, (y, hc) => Math.abs(y - mid) + (HALF - 1 - hc) * (R / HALF) <= mid + 1.5);
  },
  scatter(R, r) {
    return grid(R, () => r.chance(0.62));
  },
};
const TEMPLATE_WEIGHTS = { rows: 4, pyramid: 3, funnel: 2, rings: 3, checker: 2, columns: 3, diamond: 3, scatter: 2 };

function grid(R, f) {
  const g = [];
  for (let y = 0; y < R; y++) {
    const row = [];
    for (let hc = 0; hc < HALF; hc++) row.push(!!f(y, hc));
    g.push(row);
  }
  return g;
}

// ---- The generator ---------------------------------------------------------------------------------
/** Level n (n ≥ 2) of the world `worldSeed`. Level 1 is always the fixed wall. */
export function generate(worldSeed, n) {
  if (n <= 1) return level1();
  for (let salt = 0; salt < 64; salt++) {
    const lvl = n % 10 === 0 ? buildBoss(worldSeed, n, salt) : buildWall(worldSeed, n, salt);
    if (validate(lvl).ok) return lvl;
  }
  throw new Error(`wallbreaker: no valid wall for seed ${worldSeed}, level ${n}`);
}

function buildWall(worldSeed, n, salt) {
  const seed = hash32(worldSeed >>> 0, n, salt, "wall");
  const r = rng(seed);
  const R = Math.min(12, Math.max(4, 4 + Math.floor((n - 1) / 6) + r.int(3)));
  const name = r.weighted(TEMPLATE_WEIGHTS);
  let mask = TEMPLATES[name](R, r);
  if (count(mask) < 10) mask = TEMPLATES.rows(R, r);

  const portals = n >= I.portal && r.chance(0.45);
  const top = portals ? 1 : 0; // portal levels keep row 0 free for the exit portal
  const p = {
    tough: n >= I.tough ? Math.min(0.45, 0.12 + n * 0.008) : 0,
    steel: n >= I.steel ? Math.min(0.1, 0.04 + (n - I.steel) * 0.002) : 0,
    explosive: n >= I.explosive ? 0.07 : 0,
    regen: n >= I.regen ? 0.06 : 0,
    ghost: n >= I.ghost ? 0.08 : 0,
  };
  const half = [];
  for (let y = 0; y < R; y++) {
    const row = [];
    for (let hc = 0; hc < HALF; hc++) {
      if (!mask[y][hc]) { row.push(null); continue; }
      const u = r.float();
      let t = "normal", hp = 1, acc = 0;
      if (u < (acc += p.steel)) { if (y < R - 1) t = "steel"; } // never steel in the bottom row
      else if (u < (acc += p.explosive)) t = "explosive";
      else if (u < (acc += p.regen)) { t = "regen"; hp = 2; }
      else if (u < (acc += p.ghost)) t = "ghost";
      else if (u < (acc += p.tough)) { t = "tough"; hp = n >= 10 && r.chance(0.35) ? 3 : 2; }
      row.push({ t, hp });
    }
    half.push(row);
  }
  // Steel stays scattered: never next to other steel (also not across the mirror line), so it
  // makes obstacles to play around, not shelves that seal bricks off.
  for (let y = 0; y < R; y++) {
    for (let hc = 0; hc < HALF; hc++) {
      const cell = half[y][hc];
      if (!cell || cell.t !== "steel") continue;
      const nb = [half[y][hc - 1], y > 0 ? half[y - 1][hc] : null, y > 1 ? half[y - 2][hc] : null];
      if (hc === HALF - 1 || nb.some((o) => o && o.t === "steel")) { cell.t = "tough"; cell.hp = 2; }
    }
  }

  const bricks = [];
  let id = 0;
  // A gift brick in the centre (two cells wide) on about a third of the walls.
  const giftRow = n >= 2 && r.chance(0.35) ? pickCentreRow(half, r) : -1;
  for (let y = 0; y < R; y++) {
    for (let c = 0; c < COLS; c++) {
      const hc = c < HALF ? c : COLS - 1 - c;
      const cell = half[y][hc];
      if (!cell) continue;
      if (y === giftRow && (c === HALF - 1 || c === HALF)) {
        if (c === HALF - 1) bricks.push({ id: id++, t: "gift", hp: 1, c, r: y + top, w: 2, h: 1 });
        continue;
      }
      bricks.push({ id: id++, t: cell.t, hp: cell.hp, c, r: y + top, w: 1, h: 1 });
    }
  }
  let bottom = R - 1 + top;
  const groups = [];
  // A row of moving bricks under the wall.
  if (n >= I.moving && r.chance(0.45)) {
    const y = bottom + 2;
    const k = r.range(2, 3);
    const gap = k === 2 ? 3 : 2;
    const start = Math.floor((COLS - (k * 2 + (k - 1) * gap)) / 2);
    for (let i = 0; i < k; i++) bricks.push({ id: id++, t: "moving", hp: 1, c: start + i * (2 + gap), r: y, w: 2, h: 1, g: 1 });
    groups.push({ id: 1, motion: "bounce", speed: C.bricks.movingSpeed * (r.chance(0.5) ? 1 : -1) });
    bottom = y;
  }
  if (portals) {
    const left = r.chance(0.5);
    bricks.push({ id: id++, t: "portal", hp: 0, c: left ? 0 : COLS - 1, r: bottom + 3, w: 1, h: 1, pair: 1 });
    bricks.push({ id: id++, t: "portal", hp: 0, c: left ? COLS - 1 : 0, r: 0, w: 1, h: 1, pair: 1 });
  }
  return { kind: "wall", number: n, seed, salt, cellH: C.world.cellH, template: name, bricks, groups };
}

function pickCentreRow(half, r) {
  const rows = [];
  for (let y = 0; y < half.length; y++) {
    const cell = half[y][HALF - 1];
    if (cell && cell.t !== "steel") rows.push(y);
  }
  return rows.length ? rows[r.int(rows.length)] : -1;
}

function count(mask) { let k = 0; for (const row of mask) for (const v of row) if (v) k++; return k; }

// ---- Boss levels -----------------------------------------------------------------------------------
// A large structure that sweeps left and right, with a high-hit core in the middle. Its underside
// is open, and the weak spot (the eye on the bottom of the core) takes double damage.
const BOSS = [
  "TTTTTTTT",
  "TSccccST",
  "T.cccc.T",
  "ST....TS",
];
function buildBoss(worldSeed, n, salt) {
  const seed = hash32(worldSeed >>> 0, n, salt, "boss");
  const r = rng(seed);
  const k = n / 10; // which boss: 1, 2, 3...
  const bricks = [];
  let id = 0;
  // Static escort rows at the top.
  const escort = 2 + Math.min(2, Math.floor(k / 2));
  for (let y = 0; y < escort; y++) {
    for (let c = 0; c < COLS; c++) {
      let t = "normal", hp = 1;
      if (k >= 2 && (c === 0 || c === COLS - 1) && y === escort - 1) t = "explosive";
      else if (y === 0 && k >= 2) { t = "tough"; hp = 2; }
      else if (k >= 3 && (c + y) % 5 === 0) t = "ghost";
      bricks.push({ id: id++, t, hp, c, r: y, w: 1, h: 1 });
    }
  }
  const top = escort + 2;
  const coreHp = Math.min(C.bricks.coreHp.max, Math.round(C.bricks.coreHp.base + C.bricks.coreHp.perLevel * n));
  for (let y = 0; y < BOSS.length; y++) {
    for (let x = 0; x < 8; x++) {
      const ch = BOSS[y][x];
      if (ch === ".") continue;
      if (ch === "c") {
        if (y === 1 && x === 2) bricks.push({ id: id++, t: "core", hp: coreHp, c: x, r: top + y, w: 4, h: 2, g: 1 });
        continue;
      }
      let t = ch === "S" ? "steel" : "tough", hp = ch === "S" ? 0 : (k >= 3 ? 3 : 2);
      if (t === "tough" && k >= 2 && y === 0 && (x === 0 || x === 7)) { t = "explosive"; hp = 1; }
      bricks.push({ id: id++, t, hp, c: x, r: top + y, w: 1, h: 1, g: 1 });
    }
  }
  const dir = r.chance(0.5) ? 1 : -1;
  const groups = [{ id: 1, motion: "sweep", period: Math.max(4.5, C.bricks.bossPeriod - k * 0.4), phase: dir > 0 ? 0 : 0.5, range: COLS - 8 }];
  return { kind: "boss", number: n, seed, salt, cellH: C.world.cellH, bricks, groups };
}

// ---- Validation ------------------------------------------------------------------------------------
/** Every breakable brick reachable by the ball, steel at most 15% of the bricks. */
export function validate(lvl) {
  const solid = lvl.bricks.filter((b) => b.t !== "portal" && b.t !== "plus");
  const steel = solid.filter((b) => b.t === "steel").length;
  const steelShare = solid.length ? steel / solid.length : 0;
  const reasons = [];
  if (steelShare > C.bricks.steelShareMax + 1e-9) reasons.push(`steel ${(steelShare * 100).toFixed(1)}%`);
  if (!lvl.bricks.some((b) => BREAKABLE.has(b.t))) reasons.push("nothing to break");
  const unreachable = unreachableBricks(lvl);
  if (unreachable.length) reasons.push(`${unreachable.length} unreachable`);
  return { ok: reasons.length === 0, reasons, steelShare, unreachable };
}

/**
 * Flood fill over grid cells from the open space under the wall. Static steel blocks the ball;
 * everything breakable can be broken through, moving structures move out of the way, and a
 * portal leads to its partner. Diagonal gaps count as closed, so this errs on the safe side.
 */
export function unreachableBricks(lvl) {
  const minR = Math.min(0, ...lvl.bricks.map((b) => b.r)) - 1;
  const maxR = Math.max(...lvl.bricks.map((b) => b.r + b.h - 1)) + 2;
  const rows = maxR - minR + 1;
  const key = (c, r) => (r - minR) * COLS + c;
  const blocked = new Uint8Array(rows * COLS);
  const portalAt = new Map();
  for (const b of lvl.bricks) {
    for (let y = b.r; y < b.r + b.h; y++) for (let x = b.c; x < b.c + b.w; x++) {
      if (b.t === "steel" && !b.g) blocked[key(x, y)] = 1;
      if (b.t === "portal") portalAt.set(key(x, y), b);
    }
  }
  const seen = new Uint8Array(rows * COLS);
  const stack = [];
  for (let c = 0; c < COLS; c++) { seen[key(c, maxR)] = 1; stack.push([c, maxR]); }
  while (stack.length) {
    const [c, r] = stack.pop();
    const p = portalAt.get(key(c, r));
    const next = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
    if (p) {
      const q = lvl.bricks.find((b) => b.t === "portal" && b.pair === p.pair && b !== p);
      if (q) next.push([q.c, q.r]);
    }
    for (const [x, y] of next) {
      if (x < 0 || x >= COLS || y < minR || y > maxR) continue;
      const k = key(x, y);
      if (seen[k] || blocked[k]) continue;
      seen[k] = 1;
      stack.push([x, y]);
    }
  }
  return lvl.bricks.filter((b) => {
    if (!BREAKABLE.has(b.t)) return false;
    for (let y = b.r; y < b.r + b.h; y++) for (let x = b.c; x < b.c + b.w; x++) if (seen[key(x, y)]) return false;
    return true;
  });
}

// ---- Descent ---------------------------------------------------------------------------------------
/** A Descent wall: square bricks with hit counts, taller than the screen; it creeps down. */
export function generateDescent(worldSeed, n) {
  for (let salt = 0; salt < 64; salt++) {
    const lvl = buildDescent(worldSeed, n, salt);
    if (validate(lvl).ok) return lvl;
  }
  throw new Error("wallbreaker: no valid Descent wall");
}

function buildDescent(worldSeed, n, salt) {
  const seed = hash32(worldSeed >>> 0, n, salt, "descent");
  const r = rng(seed);
  const D = C.descent;
  const total = Math.min(20, 8 + Math.floor(n / 2));
  const first = D.startRows - total; // rows from `first` to startRows - 1; negative ones wait above
  const hpMax = Math.min(12, 2 + Math.floor(n / 2));
  const bricks = [];
  let id = 0;
  const DCOLS = COLS / 2; // squares are two cells wide: 6 per row
  for (let k = 0; k < total; k++) {
    const y = first + k;
    const density = 0.45 + r.float() * 0.25;
    let filled = 0;
    for (let x = 0; x < DCOLS; x++) {
      if (filled === DCOLS - 1 || !r.chance(density)) {
        if (r.chance(C.descent.plusChance * 3)) bricks.push({ id: id++, t: "plus", hp: 0, c: x * 2, r: y, w: 2, h: 1 });
        continue;
      }
      filled++;
      const t = n >= I.explosive && r.chance(0.06) ? "explosive" : "normal";
      const hp = t === "explosive" ? 1 : r.range(1, hpMax);
      bricks.push({ id: id++, t, hp, c: x * 2, r: y, w: 2, h: 1 });
    }
  }
  return { kind: "descent", number: n, seed, salt, cellH: D.rowH, bricks, groups: [] };
}

// ---- Daily -----------------------------------------------------------------------------------------
/** "2026-11-06" for a Date, in the player's own time zone (the day changes at their midnight). */
export function dateKey(d = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** The same wall for every player on the same date. */
export function dailyLevel(key) {
  const seed = hash32("daily", key);
  const n = C.daily.levelMin + (seed % C.daily.levelSpan);
  const lvl = generate(seed, n % 10 === 0 ? n + 1 : n);
  return { ...lvl, kind: "daily", date: key };
}

// ---- Capsule drops ---------------------------------------------------------------------------------
/**
 * What a brick drops, decided by the level seed and the brick id alone (plus the player's luck
 * modifiers, which Daily, Puzzle and Time Attack switch off). Returns { id, risky } or null.
 *   ctx.level       level number (for the introduction schedule)
 *   ctx.goodMul     multiplier on the good-capsule chance (Lucky Drops, Lucky Charm, Run luck)
 *   ctx.risky       risky capsules allowed in this mode
 *   ctx.table       "good" | "descent"
 */
export function dropFor(lvl, brick, ctx) {
  const D = C.drops;
  const table = ctx.table === "descent" ? D.descent : D.good;
  if (brick.t === "gift") {
    if (lvl.number === 1 && lvl.kind === "wall") return { id: D.level1Gift, risky: false };
    return { id: weighted(table, hash01(lvl.seed, brick.id, 3)), risky: false };
  }
  if (!BREAKABLE.has(brick.t) || brick.t === "core") return null;
  if (ctx.level < I.goodDrops) return null;
  const riskyOk = ctx.risky && ctx.level >= I.risky;
  const u = hash01(lvl.seed, brick.id, 1);
  const pRisky = riskyOk ? D.chance * D.riskyShare : 0;
  const pGood = D.chance * (riskyOk ? 1 - D.riskyShare : 1) * (ctx.goodMul || 1);
  if (u < pRisky) return { id: weighted(D.risky, hash01(lvl.seed, brick.id, 2)), risky: true };
  if (u < pRisky + pGood) return { id: weighted(table, hash01(lvl.seed, brick.id, 2)), risky: false };
  return null;
}

/** The capsule a pity drop gives on this brick (always a good one). */
export function pityDrop(lvl, brick, ctx) {
  const table = ctx.table === "descent" ? C.drops.descent : C.drops.good;
  return { id: weighted(table, hash01(lvl.seed, brick.id, 4)), risky: false };
}

/** Which elements a level number may contain, from the introduction table. */
export function allowedTypes(n) {
  const t = new Set(["normal", "gift"]);
  if (n >= I.tough) t.add("tough");
  if (n >= I.moving) t.add("moving");
  if (n >= I.steel) t.add("steel");
  if (n >= I.boss && n % 10 === 0) t.add("core");
  if (n >= I.explosive) t.add("explosive");
  if (n >= I.portal) t.add("portal");
  if (n >= I.regen) t.add("regen");
  if (n >= I.ghost) t.add("ghost");
  return t;
}
