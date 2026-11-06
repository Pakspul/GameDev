// Handcrafted walls: the 30 Puzzle walls and the Time Attack walls. Drawn as text, 12 characters
// per row, and turned into the same level JSON as generated walls (levels.js).
//
//   .  empty          n  normal        2 3 4  tough (hits)      S  steel
//   X  explosive      g  ghost         A a    portal pair 1     B b  portal pair 2
//
// Puzzle par and shot limits come from the solver (npm run wallbreaker:puzzles), which plays every
// wall headless and stores the shots it needed in puzzles.gen.js; the test replays them.
import { hash32 } from "./rng.js";
import { CONFIG } from "./config.js";

const TYPES = { n: ["normal", 1], "2": ["tough", 2], "3": ["tough", 3], "4": ["tough", 4], S: ["steel", 0], X: ["explosive", 1], g: ["ghost", 1], A: ["portal", 0], a: ["portal", 0], B: ["portal", 0], b: ["portal", 0] };
const PAIR = { A: 1, a: 1, B: 2, b: 2 };

/** Turn rows of text into level JSON. */
export function parseWall(rows, { kind, number, name }) {
  const bricks = [];
  let id = 0;
  rows.forEach((line, r) => {
    if (line.length !== 12) throw new Error(`wall ${name}: row ${r} is ${line.length} wide, not 12`);
    [...line].forEach((ch, c) => {
      if (ch === ".") return;
      const t = TYPES[ch];
      if (!t) throw new Error(`wall ${name}: unknown "${ch}"`);
      const b = { id: id++, t: t[0], hp: t[1], c, r, w: 1, h: 1 };
      if (PAIR[ch]) b.pair = PAIR[ch];
      bricks.push(b);
    });
  });
  return { kind, number, seed: hash32(kind, name), salt: 0, cellH: CONFIG.world.cellH, name, bricks, groups: [] };
}

// ---- Puzzle: aim and fire, clear within N shots ------------------------------------------------------
// launch: launcher x as a column (0–11, fractions allowed; default centre). balls: per shot (default 1).
export const PUZZLES = [
  { name: "first-shot", rows: ["............", "............", "..nnnnnnnn..", "..nnnnnnnn.."] },
  { name: "corners", rows: ["nn........nn", "nn........nn", "............", "............", "....SSSS...."] },
  { name: "chain", rows: ["nnnnnnnnnnnn", "nXnnXnnXnnXn", "nnnnnnnnnnnn"] },
  { name: "tough-room", rows: ["..22222222..", "..2......2..", "..2.nnnn.2..", "..2......2..", "..22....22.."] },
  { name: "behind-steel", rows: [".nnnnnnnnnn.", ".nnnnnnnnnn.", "............", "SSSS....SSSS"] },
  { name: "the-gate", rows: ["nnnnnnnnnnnn", "nnnnnnnnnnnn", "............", "SSSSS..SSSSS"] },
  { name: "fuse", rows: ["XXXXXXXXXXXX", "............", "............", "............", ".....nn....."] },
  { name: "twin-towers", rows: ["..n......n..", "..n......n..", "..n......n..", "..n......n..", "..n......n..", "..n......n..", "..S......S.."] },
  { name: "side-door", rows: ["nnnnnnnnnnnn", "nnnnnnnnnnnn", ".SSSSSSSSSS.", "............", "............", "....SSSS...."] },
  { name: "portal-intro", rows: ["nnnnnnnnnnna", "SSSSSSSSSSSS", "............", "............", "A..........."] },
  { name: "checker", rows: ["n.n.n.n.n.n.", ".n.n.n.n.n.n", "n.n.n.n.n.n.", ".n.n.n.n.n.n"] },
  { name: "shelter", rows: ["....nnnn....", "....nnnn....", "...S....S...", "..S......S..", ".S........S."] },
  { name: "ghost-row", rows: ["gggggggggggg", "............", "nnnnnnnnnnnn", "............", "....SSSS...."] },
  { name: "bunker", rows: ["SSSSSSSSSSSS", "S.nnnnnnnn.S", "S.nnnnnnnn.S", "S..........S", "SSSSS..SSSSS"] },
  { name: "detonator", rows: ["222222222222", "2X22X22X22X2", "222222222222", "............", "............", ".....X......"] },
  { name: "pinball", rows: ["n..........n", "..S..nn..S..", "n..........n", "....S..S....", "n..........n", "..S......S..", "n..........n"] },
  { name: "two-rooms", rows: ["SSSSSSSSSSSS", "SnnnnSSnnnnS", "SnnnnSSnnnnS", "Sa..SSSS..bS", "SSSSSSSSSSSS", "............", "A..........B"] },
  { name: "funnel", rows: ["nnnnnnnnnnnn", "Snnnnnnnnnn.", ".Snnnnnnnn..", "..Snnnnnn...", "...S........", "....S......."] },
  { name: "stack", rows: [".....44.....", ".....33.....", ".....22.....", ".....nn.....", "....SnnS...."] },
  { name: "ladder", rows: ["3.........3.", "S.3.....3.S.", "..S.3.3.S...", "....S.S.....", "............", "............"] },
  { name: "vault", rows: ["............", ".SSSSSSSSSS.", ".S22222222S.", ".S2XXXXXX2S.", ".S22222222S.", ".SSSSS.SSSS."] },
  { name: "split-wall", rows: ["nnnnnSnnnnnn", "nnnnnSnnnnnn", "nnnnnSnnnnnn", ".....S......", ".....S......", "............"] },
  { name: "lanterns", rows: [".X...X...X..", ".n...n...n..", "gggggggggggg", "............", "..S..S..S..S"] },
  { name: "mirror", rows: ["a...........", "SSSSSnnSSSSS", "....SnnS....", "....SnnS....", "....SSSS....", "............", "...........A"] },
  { name: "crossfire", rows: ["X..........X", "n2n2n2n2n2n2", "............", "2n2n2n2n2n2n", "X..........X", "............", "...SS..SS..."] },
  { name: "deep-pocket", rows: ["SnnnnnnnnnnS", "SnnnnnnnnnnS", "S2222222222S", "SSSSSS.SSSSS", "............", "............", "SSS......SSS"] },
  { name: "relay", rows: ["B.3333.3333a", "SSSSSSSSSSSS", "............", "b.3333.3333.", "SSSSSSSSSSSS", "............", "A..........."] },
  { name: "cluster-bomb", rows: ["333333333333", "3X3X3X3X3X33", "333333333333", "............", "............", "...SSSSSS..."] },
  { name: "keyhole", rows: ["333333333333", "nnnnnnnnnnnn", "SSSSS..SSSSS", "............", "............", "..SSSSSSSS.."] },
  { name: "finale", rows: ["4X44X44X44X4", "333333333333", "a2222222222A", "SSSSS..SSSSS", "....g..g....", "...S....S...", "B..........b"] },
];

/** Puzzle i (0-based) as level JSON. */
export function puzzleLevel(i) {
  const p = PUZZLES[i];
  return { ...parseWall(p.rows, { kind: "puzzle", number: i + 1, name: p.name }), launch: p.launch, balls: p.balls || 1 };
}

// ---- Time Attack: clear a set wall as fast as you can ------------------------------------------------
// Medal times in seconds (lost balls add 5 s each). Each wall unlocks with a medal on the one before.
export const TIME_ATTACK = [
  { name: "sprint", gold: 40, silver: 60, bronze: 90, rows: ["............", "nnnnnnnnnnnn", "nnnnnnnnnnnn", "nnnnnnnnnnnn"] },
  { name: "zigzag", gold: 50, silver: 75, bronze: 110, rows: ["nn..nn..nn..", ".nn..nn..nn.", "..nn..nn..nn", ".nn..nn..nn.", "nn..nn..nn.."] },
  { name: "powder", gold: 35, silver: 55, bronze: 85, rows: ["nnnnnnnnnnnn", "nnXnnnnnnXnn", "nnnnnXXnnnnn", "nnXnnnnnnXnn", "nnnnnnnnnnnn"] },
  { name: "armour", gold: 60, silver: 90, bronze: 130, rows: ["222222222222", "2nnnnnnnnnn2", "2n33333333n2", "2nnnnnnnnnn2", "222222222222"] },
  { name: "pillars", gold: 55, silver: 80, bronze: 120, rows: ["nnnnnnnnnnnn", "nnnnnnnnnnnn", "S..S....S..S", "n..n....n..n", "n..n....n..n", "S..S....S..S"] },
  { name: "phantom", gold: 55, silver: 85, bronze: 125, rows: ["gggggggggggg", "g2g2g2g2g2g2", "gggggggggggg", "............", "..nnnnnnnn.."] },
  { name: "wormhole", gold: 50, silver: 75, bronze: 115, rows: ["a..........b", "nnnnnnnnnnnn", "n2n2n2n2n2n2", "SSSSS..SSSSS", "............", "............", "A..........B"] },
  { name: "fortress", gold: 70, silver: 105, bronze: 150, rows: ["XnnnnnnnnnnX", "n3333333333n", "n3SnnnnnnS3n", "n3nXnnnnXn3n", "n3333333333n", "nnnn....nnnn"] },
];

export function timeAttackLevel(i) {
  const w = TIME_ATTACK[i];
  return { ...parseWall(w.rows, { kind: "timeattack", number: 4 + i, name: w.name }) };
}
