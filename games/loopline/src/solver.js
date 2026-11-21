// A solver for hints and tests, for both modes: depth-first search over whole sends (send a mover,
// let everything run until it stops, repeat), best-looking sends first, never visiting the same
// position twice. It plays one send at a time, which a player can always do too, so a solution it
// finds can really be played.
import { BAY } from "./engine.js";

/** The sends that clear the level from here, or null if none was found within `budget` positions. */
export function solve(game, { budget = 20000 } = {}) {
  const g = game.clone();
  g.settle();
  if (g.status === "won") return [];
  if (g.status !== "play") return null;
  const seen = new Set();
  const depot = g.kind === "depot";
  let nodes = 0;

  function dfs(path) {
    if (++nodes > budget) return null;
    const k = g.key();
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
        const score = took * 10 + (done ? 60 : 0) + g.freeBays() * (depot ? 25 : 4) - (took === 0 ? 50 : 0);
        moves.push({ m, score, snap: g.snapshot() });
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
