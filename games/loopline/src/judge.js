// Two stand-in players, for making Hard levels hard and for measuring difficulty (tests, tuning):
//   - "greedy" looks one send ahead and sends whatever takes the most right now (never a send that
//     loses on the spot). It plays a lot like a quick human, and much better than random tapping.
//   - "human" is greedy most of the time, and now and then taps something else.
// Neither uses undo. Both are deterministic for a given Rng.
//
// Hard levels are picked from a few candidates: the one these players do worst on. Every candidate is
// still solvable (levels.js checks its made solution), so a Hard level is one where the obvious send
// is often the wrong one.

/** Play a level to the end; true if won. `slip` is how often (0..1) the player taps at random. */
export function playThrough(g, rng, slip = 0, maxSends = 400) {
  g.settle();
  for (let k = 0; k < maxSends && g.status === "play"; k++) {
    if (g.stuck()) return false;
    const ready = g.ready();
    if (!ready.length) return false;
    let pick = -1;
    if (slip > 0 && rng.chance(slip)) pick = ready[rng.int(ready.length)];
    else {
      const s = g.snapshot();
      let best = -Infinity;
      for (const m of ready) {
        if (g.launch(m) !== "ok") { g.restore(s); continue; }
        g.settle();
        const sc = g.status === "won" ? Infinity : g.status === "lost" ? -1e6 : s.remaining - g.remaining + rng.float() * 0.5;
        if (sc > best) { best = sc; pick = m; }
        g.restore(s);
      }
    }
    if (pick < 0) return false;
    if (g.launch(pick) !== "ok") continue;
    g.settle();
  }
  return g.status === "won";
}
