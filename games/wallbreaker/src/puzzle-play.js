// Headless Puzzle play, shared by the solver (scripts/wallbreaker-puzzles.mjs), the tests and the game
// (which uses SLACK and the launcher position).
import { Engine, DT } from "./engine.js";
import { MODES } from "./modes.js";
import { CONFIG } from "./config.js";

/** Shots allowed on top of par. */
export const SLACK = 2;

/** Launcher x in world units for a Puzzle wall. */
export function launchX(lvl) {
  const W = CONFIG.world;
  return lvl.launch != null ? W.left + (lvl.launch + 0.5) * W.cellW : (W.left + W.right) / 2;
}

/** Play a Puzzle wall with a list of aim angles (degrees from straight up). Returns the engine. */
export function playPuzzle(lvl, angles, shots) {
  const e = new Engine({ level: lvl, rules: MODES.puzzle, puzzle: { launchX: launchX(lvl), balls: lvl.balls || 1, shots } });
  for (const a of angles) {
    if (!e.fire((a * Math.PI) / 180)) break;
    let guard = 0;
    while (e.state === "volley" && guard++ < 120 * 60) e.step(DT);
    if (e.over) break;
  }
  return e;
}
