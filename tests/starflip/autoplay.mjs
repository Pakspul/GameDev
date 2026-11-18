// A simple computer player for Starflip, for tests and tuning: it flips when a ball comes down
// onto a flipper, and plunges with a random pull. Not clever, but it keeps balls alive long
// enough to make shots, start missions and visit bonus tables.
//
//   node tests/starflip/autoplay.mjs [games] [seed]     plays whole games and prints a summary
import { Game } from "../../games/starflip/src/rules.js";

/** Advance a game by `seconds`, playing it. Returns the fx that happened. */
export function autoplay(g, seconds, { dt = 1 / 60, rand = Math.random } = {}) {
  const fx = [];
  let hold = 0, pull = 0;
  const held = { L: 0, R: 0 }, rest = { L: 0, R: 0 };
  for (let t = 0; t < seconds && g.phase !== "over"; t += dt) {
    if (g.ready && !g.charging && hold <= 0) { g.plunge(true); pull = 0.2 + rand() * 1.1; }
    if (g.charging && (pull -= dt) <= 0) g.plunge(false);
    for (const f of g.world.flippers) {
      const near = g.world.balls.some((b) => !b.held && b.vy > -50 && Math.abs(b.y - (f.y + 10)) < 40 &&
        (f.side === "L" ? b.x > f.x - 10 && b.x < f.x + 85 : b.x < f.x + 10 && b.x > f.x - 85));
      // Flip at a ball coming down; let go after a moment (a cradled ball rolls down and gets flipped again).
      if (g.input[f.side]) held[f.side] += dt; else rest[f.side] += dt;
      if (near && !g.input[f.side] && rest[f.side] > 0.2 + rand() * 0.3) { g.flip(f.side, true); held[f.side] = 0; }
      else if (g.input[f.side] && held[f.side] > 0.3 + rand() * 0.3) { g.flip(f.side, false); rest[f.side] = 0; }
    }
    g.update(dt);
    fx.push(...g.fx);
    g.fx.length = 0;
  }
  return fx;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = +(process.argv[2] || 5), seed = +(process.argv[3] || 1);
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  for (let i = 0; i < games; i++) {
    const g = new Game({ seed: seed + i });
    const fx = autoplay(g, 1200, { rand });
    const count = (type) => fx.filter((f) => f.type === type).length;
    console.log(`game ${i + 1}: score ${g.score.toLocaleString("en")} in ${g.t.toFixed(0)}s, missions started ${count("missionStart")}, done ${count("missionDone")}, failed ${count("missionFail")}, ` +
      `bonus tables ${count("miniStart")}, saves ${count("saved")}, nudges ${count("nudge")}, skill ${count("skill")}, mult ${count("mult")}`);
    for (const f of fx.filter((f) => f.type === "miniEnd")) console.log(`   bonus table ${f.mini}: ${f.score.toLocaleString("en")} (${f.why})`);
  }
}
