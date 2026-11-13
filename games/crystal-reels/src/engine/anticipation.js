// Anticipation (FEEL-01): which reels spin longer because a feature is still possible.
// The decision for reel r uses only the symbols that have already landed on reels before r,
// so it is the same whether the trigger will land or not: nothing is leaked, nothing is faked.

/**
 * @returns boolean[]: true when reel r should get the extra anticipation time.
 * triggers come from the config: [{ symbol, needed, minLanded, reels? }]
 *   - without `reels`: `needed` symbols anywhere on the grid (scatter, coin)
 *   - with `reels`: one symbol is needed on each of those reels (bonus)
 */
export function anticipationPlan(prep, grid) {
  const { reels, rows } = prep;
  const triggers = (prep.cfg.anticipation && prep.cfg.anticipation.triggers) || [];
  const out = new Array(reels).fill(false);
  const canHold = (strip, sym) => strip.includes(sym);
  for (const t of triggers) {
    const strips = prep.strips.base;
    for (let r = 1; r < reels; r++) {
      // state after reels 0..r-1 have stopped
      let landed = 0;
      for (let c = 0; c < r; c++) {
        const here = grid[c].filter((id) => id === t.symbol).length;
        if (t.reels) { if (t.reels.includes(c) && here > 0) landed++; } else landed += here;
      }
      let possible;
      if (t.reels) {
        const stoppedRequired = t.reels.filter((c) => c < r);
        const missed = stoppedRequired.some((c) => !grid[c].includes(t.symbol));
        const remainingCan = t.reels.filter((c) => c >= r && canHold(strips[c], t.symbol)).length;
        possible = !missed && landed + remainingCan >= t.needed;
      } else {
        let capacity = 0;
        for (let c = r; c < reels; c++) if (canHold(strips[c], t.symbol)) capacity += rows;
        possible = landed + capacity >= t.needed;
      }
      const reelIsRelevant = t.reels ? t.reels.includes(r) : canHold(strips[r], t.symbol);
      if (possible && reelIsRelevant && landed >= t.minLanded && landed < t.needed) out[r] = true;
    }
  }
  return out;
}
