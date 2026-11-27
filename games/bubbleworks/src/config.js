// Every number of Bubbleworks in one place. Tune here, not in the code.
// Prices and pay are not here: they follow the arcade's rules and live in ../economy.js.

const R = 16;                       // bubble radius, in field units
const D = R * 2;                    // bubble diameter
const RH = D * Math.sqrt(3) / 2;    // height of one hex row (27.71)

export const CONFIG = {
  // ---- The field --------------------------------------------------------------------------------------
  R, D, RH,
  cols: 11,                 // bubbles in a full row; a shifted row holds one less
  width: 11 * D,            // 352: the field is exactly one full row wide
  height: 440,              // field units from the ceiling to the bottom edge under the launcher
  lineRow: 13,              // a bubble that ends up in this screen row (or lower) is over the line
  launchY: 398,             // the launcher's centre, from the top of the field
  viewLow: 9,               // Levels: the camera scrolls so the lowest bubble sits at most in this row

  // ---- Aiming and flight ------------------------------------------------------------------------------
  maxAngle: 78 * Math.PI / 180, // from straight up; flatter than this and a shot would crawl along the walls
  step: 4,                  // flight is traced in steps this long, so a shot can never skip past a bubble
  hit: D * 0.8,             // a shot sticks when its centre is this close to a bubble's (a little forgiving,
                            // so a shot can slip past the corner of a gap, as in every bubble shooter)
  speed: 1150,              // flight speed, units per second (animation only: the outcome is known at once)
  aimAfterBounce: 150,      // the aim line goes on this far after its first bounce (Aim+ shows all of it)

  // ---- Score ------------------------------------------------------------------------------------------
  score: {
    pop: 10,                // per popped bubble
    drop: 30,               // per dropped bubble
    comboStep: 0.1,         // each shot in a row that pops something adds 10%...
    comboMax: 1,            // ...up to +100%
    stageClear: 1000,       // Classic: clearing the screen
    shotLeft: 150,          // Classic: per shot left before the next ceiling drop when a stage is cleared;
                            // Levels: per shot left at the end
  },

  // ---- Classic ----------------------------------------------------------------------------------------
  classic: {
    // The ceiling drops one row after this many shots that pop nothing, by stage: [from stage, shots].
    missesPerDrop: [[1, 8], [5, 7], [10, 6], [15, 5]],
    stageBreak: 1.3,        // seconds the "stage clear" banner shows before the next stage
  },

  // ---- Endless ----------------------------------------------------------------------------------------
  endless: {
    startRows: 6,
    pushFirst: 7,           // a new row every 7 shots at the start...
    pushMin: 3,             // ...down to every 3
    pushFaster: 12,         // one shot less after every 12 rows pushed in
    bigClear: 6,            // popping and dropping this many in one shot pushes the next row back a shot
    colours: [[0, 4], [20, 5], [50, 6]], // [rows pushed in, colours]
    powerChance: 0.14,      // chance that a new row carries a power bubble
  },

  // ---- Powers -----------------------------------------------------------------------------------------
  powers: {
    slots: 3,               // the tray holds this many
    bigDrop: 10,            // Classic and Endless: dropping this many in one shot puts a random power in the tray
    bombRadius: 2.1,        // in bubble diameters, from where the bomb lands
    freezeShots: 5,         // Freeze stops the ceiling or the push for this many shots
    // Which powers show up on the board, and how often (Classic and Endless; Levels place them by hand).
    weights: { bomb: 5, prism: 5, laser: 4, comet: 3, blackhole: 1, freeze: 3 },
  },

  // ---- Levels -----------------------------------------------------------------------------------------
  levels: {
    // Stars by the share of the shot budget used: at most 60% three stars, at most 80% two, else one.
    stars: [0.6, 0.8],
    // The budget is what the autoplayer needed, times this, plus `extra`. Early levels are kinder.
    slack: [[1, 1.7], [11, 1.5], [31, 1.4]],
    extra: 3,
    extraShots: 5,          // what the "+5 shots" help adds
    maxBotShots: 160,       // a level the autoplayer can't finish in this many shots is made again
  },

  // ---- Feel -------------------------------------------------------------------------------------------
  fallGravity: 1800,        // dropped bubbles, units/s²
  ease: 12,                 // how fast the board slides when it scrolls or a row comes in (per second)
};

/** The value from a [[from, value], ...] table for `n`. */
export function stepTable(table, n) {
  let v = table[0][1];
  for (const [from, val] of table) if (n >= from) v = val;
  return v;
}
