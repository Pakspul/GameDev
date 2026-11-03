// Graphite: generates puzzles off the main thread so the screen never freezes while a
// big Star Battle or Expert Sudoku is being made. Same generator files as the page.
importScripts("levels/common.js", "levels/sudoku.js", "levels/takuzu.js", "levels/stars.js", "levels/calcudoku.js");

const GEN = {
  sudoku: self.GraphiteSudoku,
  takuzu: self.GraphiteTakuzu,
  stars: self.GraphiteStars,
  calcudoku: self.GraphiteCalcudoku,
};

self.onmessage = (e) => {
  const { id, kind, tier, seed } = e.data;
  try {
    self.postMessage({ id, puzzle: GEN[kind].generate(tier, seed) });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
