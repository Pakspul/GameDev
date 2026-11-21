// A solver for hints and tests, for every mode: depth-first search over whole sends (send a mover,
// let everything run until it stops, repeat), best-looking sends first, never visiting the same
// position twice. It plays one send at a time, which a player can always do too, so a solution it
// finds can really be played.
//
// Every level comes with a made solution (levels.js). The positions along it are known to be good, so
// the moment the search reaches one of them it's done: the rest of the made solution finishes it.
import { BAY } from "./engine.js";

/** A 53-bit hash of a position key (Orbit's keys are tens of thousands of characters long). */
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** The positions (hashed keys) along a level's made solution, each with the sends that finish from there. */
const known = new WeakMap();
function knownFor(game) {
  const lv = game.level;
  if (!lv.solution) return null;
  let k = known.get(lv);
  if (k) return k;
  k = new Map();
  const g = game.clone();
  g.reset();
  g.settle();
  for (let i = 0; i <= lv.solution.length && g.status === "play"; i++) {
    const h = hash(g.key());
    if (!k.has(h)) k.set(h, i);
    if (i === lv.solution.length || g.launch(lv.solution[i]) !== "ok") break;
    g.settle();
  }
  known.set(lv, k);
  return k;
}

/** How promising a send looks: Critters and Orbit like a critter that uses its pops and keeps a bay
 *  free; Depot likes pixels boarding and free docks. */
function score(g, s, m, took, done, depot) {
  if (depot) return took * 10 + (done ? 60 : 0) + g.freeBays() * 25 - (took === 0 ? 50 : 0);
  return (took / Math.max(1, s.left[m])) * 100 + (done ? 60 : 0) + g.freeBays() * 30 - (took === 0 ? 200 : 0);
}

/** The sends that clear the level from here, or null if none was found within `budget` positions
 *  (or `ms` milliseconds). `known: false` searches without the made solution's shortcut (tests). */
export function solve(game, { budget = 20000, ms = Infinity, known: useKnown = true } = {}) {
  const g = game.clone();
  g.settle();
  if (g.status === "won") return [];
  if (g.status !== "play") return null;
  const seen = new Set();
  const depot = g.kind === "depot";
  const path0 = useKnown ? knownFor(game) : null, sol = game.level.solution;
  const until = performance.now() + ms;
  let nodes = 0;

  function dfs(path) {
    if (++nodes > budget || ((nodes & 15) === 0 && performance.now() > until)) { nodes = Infinity; return null; }
    const k = g.key(), h = path0 && hash(k);
    if (path0 && path0.has(h)) return [...path, ...sol.slice(path0.get(h))];
    if (seen.has(k)) return null;
    seen.add(k);
    const s = g.snapshot();
    const moves = [];
    for (const m of g.ready()) {
      if (g.launch(m) !== "ok") continue;
      g.settle();
      if (g.status === "won") { g.restore(s); return [...path, m]; }
      const took = s.remaining - g.remaining;
      // Critters: a parked mover that takes nothing just parks again, never useful.
      if (g.status === "play" && !(!depot && s.where[m] === BAY && took === 0)) {
        const done = depot ? g.where[m] === 4 : g.left[m] === 0;
        moves.push({ m, score: score(g, s, m, took, done, depot), snap: g.snapshot() });
      }
      g.restore(s);
    }
    moves.sort((a, b) => b.score - a.score);
    for (const mv of moves) {
      g.restore(mv.snap);
      const r = dfs([...path, mv.m]);
      if (r) return r;
      if (nodes > budget) break;
    }
    g.restore(s);
    return null;
  }
  return dfs([]);
}
