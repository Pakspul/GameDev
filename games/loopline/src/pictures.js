// The pictures. A few drawn by hand (one letter per cell, see PALETTE in config.js, "." is empty),
// then endless ones made from a seed: symmetric little creatures, quilts and waves.
//
// The order of DRAWN is part of every level: append new pictures at the end only.
import { COLOR_OF } from "./config.js";

export const DRAWN = [
  { id: "heart", art: [
    ".RR...RR.",
    "RRRR.RRRR",
    "RKKRRRRRR",
    "RKRRRRRRR",
    ".RRRRRRR.",
    "..RRRRR..",
    "...RRR...",
    "....R....",
  ] },
  { id: "fish", art: [
    "....YYYY....",
    "..OOOOOOO..Y",
    ".ODOOOOOOOYY",
    "OOOOOOOOOYYY",
    "OOOOOOOOOYYY",
    ".OOOOOOOOOYY",
    "..OOOOOOO..Y",
    "....YYY.....",
  ] },
  { id: "mushroom", art: [
    "...RRRR...",
    "..RRWWRR..",
    ".RWWRRRRR.",
    "RRRRRRWWRR",
    "RWWRRRWWRR",
    "RRRRRRRRRR",
    "...FFFF...",
    "...FFFF...",
    "...FFFF...",
    "..NNNNNN..",
  ] },
  { id: "tree", art: [
    "....GG....",
    "...GGGG...",
    "..GGLGGG..",
    ".GGGGGLGG.",
    "..GGGGGG..",
    ".GLGGGGGG.",
    "GGGGGGLGGG",
    ".GGGGGGGG.",
    "....NN....",
    "....NN....",
    "..NNNNNN..",
  ] },
  { id: "apple", art: [
    "....N.....",
    "....NLL...",
    ".RRRNRRRR.",
    "RRWRRRRRRR",
    "RWRRRRRRRR",
    "RRRRRRRRRR",
    "RRRRRRRRRR",
    ".RRRRRRRR.",
    ".RRRRRRRR.",
    "..RRR.RR..",
  ] },
  { id: "house", art: [
    ".....R.....",
    "....RRR....",
    "...RRRRR...",
    "..RRRRRRR..",
    ".RRRRRRRRR.",
    "..WWWWWWW..",
    "..WSSWWNW..",
    "..WSSWWNW..",
    "..WWWWWNW..",
    "..WWWWWNW..",
    "GGGGGGGGGGG",
  ] },
  { id: "cactus", art: [
    "....GG....",
    "...GLGG...",
    "...GGGG.G.",
    ".G.GGLG.GG",
    "GG.GGGG.GG",
    "GG.GGGGGGG",
    "GGGGGLGGG.",
    ".GGGGGG...",
    "...GGGG...",
    "..OOOOOO..",
    "..OOOOOO..",
    "...OOOO...",
  ] },
  { id: "duck", art: [
    "....YYY.....",
    "...YYYYY....",
    "...YYDYYOO..",
    "...YYYYYOOO.",
    "....YYYY....",
    ".Y..YYYYY...",
    "YYYYYYYYYY..",
    "YYYYYYYYYYY.",
    ".YYYYYYYYY..",
    "SSSSSSSSSSSS",
  ] },
  { id: "flower", art: [
    "...KK.KK...",
    "..KKKKKKK..",
    ".KKKYYYKKK.",
    "..KKYYYKK..",
    ".KKKYYYKKK.",
    "..KKKKKKK..",
    "...KK.KK...",
    ".....G.....",
    ".LL..G.....",
    "..LL.G.LL..",
    "...LLGLL...",
    ".....G.....",
  ] },
  { id: "boat", art: [
    ".....W......",
    ".....WW.....",
    ".....WWW....",
    ".....WWWW...",
    "....RWWWWW..",
    "...RRWWWWWW.",
    "..RRRWWWWWWW",
    ".RRRRN......",
    ".....N......",
    "NNNNNNNNNNNN",
    ".NNNNNNNNNN.",
    "SSSSSSSSSSSS",
  ] },
  { id: "cat", art: [
    ".O........O.",
    ".OO......OO.",
    ".OKO....OKO.",
    ".OOOOOOOOOO.",
    "OOOOOOOOOOOO",
    "OOGDOOOOGDOO",
    "OOOOOKKOOOOO",
    "OOOOWWWWOOOO",
    ".OOWWWWWWOO.",
    "..OOOOOOOO..",
    "...OOOOOO...",
  ] },
  { id: "icecream", art: [
    "..KKKKK..",
    ".KKWKKKK.",
    "KKKKKKKKK",
    "KKKKKKKKK",
    ".LLLLLLL.",
    "LLWLLLLLL",
    "LLLLLLLLL",
    ".OOOOOOO.",
    ".ONONONO.",
    "..OOOOO..",
    "..ONONO..",
    "...OOO...",
    "....O....",
  ] },
  { id: "butterfly", art: [
    ".....D.D.....",
    ".PP.......PP.",
    "PKKP.....PKKP",
    "PKKKP.D.PKKKP",
    "PKKKKPDPKKKKP",
    ".PKKKPDPKKKP.",
    "..PPPPDPPPP..",
    ".PKKKPDPKKKP.",
    "PKKKKPDPKKKKP",
    "PKKKP.D.PKKKP",
    ".PP.......PP.",
  ] },
  { id: "bus", art: [
    "..YYYYYYYYYYY.",
    ".YSSYSSYSSYSSY",
    ".YSSYSSYSSYSSY",
    ".YYYYYYYYYYYYY",
    "YYYYYYYYYYYYYY",
    "WYYYYYYYYYYYYR",
    "YYYYYYYYYYYYYY",
    "..DDD....DDD..",
    "..DDD....DDD..",
  ] },
  { id: "rocket", art: [
    "....RR....",
    "...RWWR...",
    "...WWWW...",
    "..WWSSWW..",
    "..WSBBSW..",
    "..WSBBSW..",
    "..WWSSWW..",
    "..WWWWWW..",
    "..WWWWWW..",
    ".RWWWWWWR.",
    "RRWWWWWWRR",
    "RR.WWWW.RR",
    "....OO....",
    "...OYYO...",
  ] },
];

/** A drawn picture as { id, w, h, cells }. */
export function fromArt(id, art) {
  const h = art.length, w = art[0].length;
  const cells = new Uint8Array(w * h);
  art.forEach((row, y) => {
    if (row.length !== w) throw new Error(`picture ${id}: row ${y} is ${row.length} wide, not ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      if (!COLOR_OF[ch]) throw new Error(`picture ${id}: unknown colour "${ch}"`);
      cells[y * w + x] = COLOR_OF[ch];
    }
  });
  return { id, w, h, cells };
}

// ---- Pictures from a seed ----------------------------------------------------------------------------------
const BRIGHT = ["R", "O", "Y", "L", "G", "T", "S", "B", "P", "K"];
function pickColors(rng, n, extra = []) {
  const pool = BRIGHT.filter((c) => !extra.includes(c));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}
const mk = (w, h) => ({ w, h, cells: new Uint8Array(w * h) });

/** A symmetric little creature: a body, a belly band, eyes, sometimes feet. */
function creature(rng, size) {
  const w = size | 1, h = size;
  const p = mk(w, h), half = (w + 1) >> 1;
  const [body, band, feet] = pickColors(rng, 3);
  const mask = [];
  for (let y = 0; y < h; y++) {
    mask.push([]);
    for (let x = 0; x < half; x++) {
      const dx = (half - 1 - x) / half, dy = Math.abs(y - (h - 1) / 2) / (h / 2);
      const r = dx * dx + dy * dy * 0.9;
      mask[y].push(r < 0.55 + rng.float() * 0.35);
    }
  }
  // Ears or horns on top, sometimes.
  if (rng.chance(0.6)) { const ex = 1 + rng.int(Math.max(1, half - 2)); mask[0][ex] = true; if (h > 1) mask[1][ex] = true; }
  const bandFrom = Math.floor(h * (0.5 + rng.float() * 0.15)), bandTo = bandFrom + 1 + rng.int(2);
  const eyeY = Math.max(1, Math.floor(h * 0.3)), eyeX = Math.max(0, half - 2 - rng.int(Math.max(1, half - 2)));
  for (let y = 0; y < h; y++) for (let x = 0; x < half; x++) {
    if (!mask[y][x]) continue;
    let c = body;
    if (y >= bandFrom && y <= bandTo) c = band;
    if (y === h - 1 && rng.chance(0.7)) c = feet;
    if (y === eyeY && x === eyeX) c = "D";
    if (y === eyeY - 1 && x === eyeX) c = "W";
    const v = COLOR_OF[c];
    p.cells[y * w + x] = v;
    p.cells[y * w + (w - 1 - x)] = v;
  }
  return p;
}

/** Concentric rings (squares, diamonds or circles) in 3–5 colours. */
function quilt(rng, size) {
  const w = size, h = size, p = mk(w, h);
  const cols = pickColors(rng, 3 + rng.int(3));
  const kind = rng.int(3), cx = (w - 1) / 2, cy = (h - 1) / 2, step = 1 + rng.int(2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
    const d = kind === 0 ? Math.max(dx, dy) : kind === 1 ? (dx + dy) * 0.7 : Math.hypot(dx, dy);
    if (kind === 2 && d > cx + 0.6) continue;
    p.cells[y * w + x] = COLOR_OF[cols[Math.floor(d / step) % cols.length]];
  }
  return p;
}

/** Wavy stripes. */
function waves(rng, size) {
  const w = size + 2, h = size, p = mk(w, h);
  const cols = pickColors(rng, 3 + rng.int(2));
  const amp = 1 + rng.float() * 1.5, freq = 0.35 + rng.float() * 0.4, band = 2 + rng.int(2), vertical = rng.chance(0.4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [a, b] = vertical ? [y, x] : [x, y];
    const off = b + amp * Math.sin(a * freq);
    p.cells[y * w + x] = COLOR_OF[cols[((Math.floor(off / band) % cols.length) + cols.length) % cols.length]];
  }
  return p;
}

const MAKERS = [creature, quilt, waves];
/** An endless picture number k (0, 1, 2...) of a given size. */
export function madePicture(rng, k, size) {
  const p = MAKERS[k % MAKERS.length](rng, size);
  return { id: `made-${k}`, ...p };
}
