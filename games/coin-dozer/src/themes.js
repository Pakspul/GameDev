// Machine themes: colours, the sound palette and the collection set (4 gems + 8 figures).
// neon: the two colours of the back panel's neon tubes (they also tint the reflections); motif: what
// the tubes draw (art.js neonPanel); panel: the back board's gradient, top to bottom.
// Themes change how the machine looks and sounds and which figures it drops, never the physics:
// every figure shares one collider (config.prizes.figure), whatever it looks like.
//
// A figure is a list of parts, built by render.js from three.js primitives. Units are coin
// diameters; the figure stands in a cylinder of radius 0.3 from y = -0.44 to y = 0.44.
//   ["sph", r, pos, colour, opts]            sphere
//   ["box", [w, h, d], pos, colour, opts]    box
//   ["cyl", [rTop, rBottom, h], pos, colour, opts]
//   ["cone", [r, h], pos, colour, opts]
//   ["tor", [R, r, arc?], pos, colour, opts] torus (in the x-y plane, facing the player)
// opts: { rot: [x, y, z], scale: [x, y, z], glow: true, clear: true, many: [[pos], ...] }
const PI = Math.PI;

export const THEME_IDS = ["classic", "space", "candy", "ocean"];

export const THEMES = {
  classic: {
    bg: 0x1a0f1c, cabinet: 0x7a1f2b, trim: 0xd9b45a, shelf: 0x7d828f, pusher: 0xb8862e, pusherFace: 0x8a2230,
    back: 0x2a1420, bulbs: 0xffd166,
    neon: [0xff2d75, 0x2de2ff], motif: "chevrons", panel: ["#12081a", "#2a0b20"], glow: "#ffcf4d", css: { bg: "#1a0f1c", panel: "#2a1621", accent: "#ffcf4d", ink: "#fff6e8" },
    gems: { red: 0xe0233c, blue: 0x2b6fff, green: 0x17b26a, yellow: 0xffc21a },
    sound: { wave: "triangle", root: 523.25, scale: [0, 4, 7, 12, 16, 19, 24, 28] },
  },
  space: {
    bg: 0x050817, cabinet: 0x1b2a5c, trim: 0x8fe9ff, shelf: 0x2f3754, pusher: 0x9fb0d4, pusherFace: 0x24305e,
    back: 0x0b1030, bulbs: 0x7cf7ff,
    neon: [0x7cf7ff, 0xb56cff], motif: "planets", panel: ["#040818", "#0d1440"], glow: "#7cf7ff", css: { bg: "#050817", panel: "#121a3a", accent: "#7cf7ff", ink: "#eef6ff" },
    gems: { red: 0xff4d6d, blue: 0x6f8bff, green: 0x5cffb0, yellow: 0xffe066 },
    sound: { wave: "sine", root: 440, scale: [0, 3, 7, 10, 12, 15, 19, 22] },
  },
  candy: {
    bg: 0x2a0f2e, cabinet: 0xff6fb1, trim: 0xfff07a, shelf: 0xd9a9c4, pusher: 0x86d3ff, pusherFace: 0xff9ad0,
    back: 0x5a1f5e, bulbs: 0xfff07a,
    neon: [0xff5fcf, 0xfff07a], motif: "hearts", panel: ["#22082a", "#46104e"], glow: "#ff9ad5", css: { bg: "#2a0f2e", panel: "#3d1742", accent: "#ff9ad5", ink: "#fff3fa" },
    gems: { red: 0xff3d7f, blue: 0x5bb6ff, green: 0x6ee67a, yellow: 0xffd84d },
    sound: { wave: "square", root: 659.25, scale: [0, 2, 4, 7, 9, 12, 14, 16] },
  },
  ocean: {
    bg: 0x03202d, cabinet: 0x0e5d74, trim: 0x6ff0d0, shelf: 0x8fb3b0, pusher: 0xe9c387, pusherFace: 0x0b4a5c,
    back: 0x062f40, bulbs: 0x6ff0d0,
    neon: [0x3ff0d0, 0x57a8ff], motif: "waves", panel: ["#021620", "#073446"], glow: "#57e3ff", css: { bg: "#03202d", panel: "#0a3445", accent: "#57e3ff", ink: "#eafcff" },
    gems: { red: 0xff6b5a, blue: 0x3fa9ff, green: 0x3fe0b0, yellow: 0xffcf5a },
    sound: { wave: "sine", root: 392, scale: [0, 2, 5, 7, 9, 12, 14, 17] },
  },
};

// Shared colours.
const BLACK = 0x15151a, WHITE = 0xf4f4f0, GOLD = 0xe7b53c, SILVER = 0xc4c9d2, WOOD = 0x8a5a2b, RED = 0xd8323c;
const base = (c = WOOD) => ["cyl", [0.22, 0.25, 0.08], [0, -0.4, 0], c];

export const FIGURES = {
  classic: [
    // Rubber duck
    [base(0x3aa6d9), ["sph", 0.25, [0, -0.17, -0.02], 0xffd23f, { scale: [1, 0.8, 1.2] }], ["sph", 0.15, [0, 0.12, 0.08], 0xffd23f],
      ["box", [0.14, 0.05, 0.13], [0, 0.09, 0.25], 0xff8c1a], ["sph", 0.028, [0.07, 0.17, 0.2], BLACK, { many: [[-0.07, 0.17, 0.2]] }]],
    // Teddy bear
    [["sph", 0.21, [0, -0.22, 0], 0x9a6233], ["sph", 0.16, [0, 0.12, 0], 0x9a6233], ["sph", 0.06, [0.12, 0.26, 0], 0x9a6233, { many: [[-0.12, 0.26, 0]] }],
      ["sph", 0.07, [0, 0.09, 0.13], 0xd9b38c], ["sph", 0.025, [0, 0.11, 0.2], BLACK], ["sph", 0.022, [0.06, 0.17, 0.13], BLACK, { many: [[-0.06, 0.17, 0.13]] }],
      ["sph", 0.07, [0.19, -0.15, 0.07], 0x9a6233, { many: [[-0.19, -0.15, 0.07]] }], ["sph", 0.08, [0.11, -0.38, 0.1], 0x9a6233, { many: [[-0.11, -0.38, 0.1]] }]],
    // Toy robot
    [["box", [0.1, 0.2, 0.12], [0.08, -0.34, 0], 0x7d8597, { many: [[-0.08, -0.34, 0]] }], ["box", [0.34, 0.28, 0.24], [0, -0.1, 0], SILVER],
      ["box", [0.24, 0.2, 0.2], [0, 0.17, 0], SILVER], ["sph", 0.035, [0.06, 0.19, 0.1], 0x35e0ff, { glow: true, many: [[-0.06, 0.19, 0.1]] }],
      ["cyl", [0.012, 0.012, 0.12], [0, 0.32, 0], 0x7d8597], ["sph", 0.035, [0, 0.39, 0], RED, { glow: true }],
      ["cyl", [0.04, 0.04, 0.24], [0.21, -0.1, 0], 0x7d8597, { many: [[-0.21, -0.1, 0]] }], ["box", [0.18, 0.08, 0.02], [0, -0.06, 0.125], 0xff5a3c]],
    // Spinning top
    [["cone", [0.24, 0.3], [0, -0.28, 0], RED, { rot: [PI, 0, 0] }], ["cyl", [0.29, 0.29, 0.07], [0, -0.1, 0], 0xffc21a],
      ["sph", 0.2, [0, -0.05, 0], RED, { scale: [1, 0.55, 1] }], ["cyl", [0.04, 0.04, 0.3], [0, 0.18, 0], WOOD], ["sph", 0.05, [0, 0.34, 0], WOOD]],
    // Crown on a cushion
    [["cyl", [0.24, 0.27, 0.28], [0, -0.3, 0], WOOD], ["box", [0.44, 0.12, 0.44], [0, -0.1, 0], 0xb3182e], ["cyl", [0.2, 0.18, 0.16], [0, 0.04, 0], GOLD],
      ["cone", [0.05, 0.13], [0.19, 0.18, 0], GOLD, { many: [[-0.19, 0.18, 0], [0, 0.18, 0.19], [0, 0.18, -0.19], [0.135, 0.18, 0.135], [-0.135, 0.18, 0.135], [0.135, 0.18, -0.135], [-0.135, 0.18, -0.135]] }],
      ["sph", 0.035, [0, 0.05, 0.19], 0xe0233c, { glow: true, many: [[0.19, 0.05, 0], [-0.19, 0.05, 0]] }]],
    // Trophy
    [["box", [0.34, 0.12, 0.34], [0, -0.38, 0], 0x3b2a1e], ["cyl", [0.05, 0.08, 0.2], [0, -0.22, 0], GOLD], ["cyl", [0.25, 0.1, 0.32], [0, 0.04, 0], GOLD],
      ["tor", [0.08, 0.022], [0.25, 0.07, 0], GOLD, { many: [[-0.25, 0.07, 0]] }], ["box", [0.18, 0.06, 0.01], [0, -0.38, 0.172], GOLD]],
    // Snowman
    [["sph", 0.23, [0, -0.21, 0], WHITE], ["sph", 0.16, [0, 0.05, 0], WHITE], ["sph", 0.12, [0, 0.25, 0], WHITE],
      ["cyl", [0.14, 0.14, 0.02], [0, 0.35, 0], BLACK], ["cyl", [0.09, 0.09, 0.12], [0, 0.42, 0], BLACK], ["cone", [0.025, 0.1], [0, 0.25, 0.15], 0xff8c1a, { rot: [PI / 2, 0, 0] }],
      ["sph", 0.022, [0, 0.07, 0.155], BLACK, { many: [[0, 0.0, 0.16], [0, -0.12, 0.22]] }], ["tor", [0.13, 0.03], [0, 0.17, 0], RED, { rot: [PI / 2, 0, 0] }]],
    // Piggy bank
    [["sph", 0.26, [0, -0.12, 0], 0xff9fbd, { scale: [1, 0.85, 1.15] }], ["cyl", [0.08, 0.08, 0.06], [0, -0.1, 0.31], 0xff86ab, { rot: [PI / 2, 0, 0] }],
      ["cone", [0.06, 0.1], [0.12, 0.13, 0.12], 0xff86ab, { many: [[-0.12, 0.13, 0.12]] }], ["box", [0.12, 0.012, 0.035], [0, 0.1, 0], BLACK],
      ["cyl", [0.05, 0.05, 0.16], [0.12, -0.36, 0.14], 0xff86ab, { many: [[-0.12, -0.36, 0.14], [0.12, -0.36, -0.14], [-0.12, -0.36, -0.14]] }],
      ["sph", 0.025, [0.08, 0.02, 0.27], BLACK, { many: [[-0.08, 0.02, 0.27]] }]],
  ],
  space: [
    // Astronaut
    [["box", [0.1, 0.22, 0.12], [0.08, -0.33, 0], WHITE, { many: [[-0.08, -0.33, 0]] }], ["box", [0.3, 0.28, 0.22], [0, -0.09, 0], WHITE],
      ["box", [0.26, 0.26, 0.1], [0, -0.07, -0.15], 0x9aa3b5], ["sph", 0.17, [0, 0.2, 0], WHITE], ["sph", 0.13, [0, 0.2, 0.06], 0x1c2c5a, { scale: [1, 0.8, 0.8] }],
      ["cyl", [0.045, 0.045, 0.24], [0.2, -0.1, 0], WHITE, { many: [[-0.2, -0.1, 0]] }], ["box", [0.1, 0.06, 0.01], [0, -0.04, 0.115], 0xff6b3d]],
    // Rocket
    [["cyl", [0.13, 0.15, 0.46], [0, -0.06, 0], WHITE], ["cone", [0.13, 0.22], [0, 0.28, 0], RED], ["sph", 0.06, [0, 0.04, 0.12], 0x4cc3ff, { glow: true }],
      ["box", [0.04, 0.18, 0.16], [0.17, -0.26, 0], RED, { many: [[-0.17, -0.26, 0]] }], ["box", [0.16, 0.18, 0.04], [0, -0.26, 0.17], RED, { many: [[0, -0.26, -0.17]] }],
      ["cone", [0.08, 0.14], [0, -0.37, 0], 0xffa62b, { rot: [PI, 0, 0], glow: true }]],
    // Flying saucer
    [["cone", [0.2, 0.3], [0, -0.29, 0], 0xb8ff6a, { glow: true, clear: true }], ["sph", 0.3, [0, -0.04, 0], SILVER, { scale: [1, 0.24, 1] }],
      ["sph", 0.14, [0, 0.04, 0], 0x7cf7ff, { clear: true }], ["sph", 0.03, [0.24, -0.04, 0.1], 0xffe066, { glow: true, many: [[-0.24, -0.04, 0.1], [0, -0.04, 0.26], [0.1, -0.04, -0.24], [-0.1, -0.04, -0.24]] }]],
    // Satellite
    [base(0x6b7488), ["cyl", [0.03, 0.03, 0.3], [0, -0.22, 0], 0x6b7488], ["box", [0.2, 0.2, 0.2], [0, 0.02, 0], GOLD],
      ["box", [0.17, 0.3, 0.02], [0.2, 0.02, 0], 0x2b5cff, { many: [[-0.2, 0.02, 0]] }], ["cone", [0.11, 0.08], [0, 0.18, 0], WHITE, { rot: [PI, 0, 0] }], ["cyl", [0.01, 0.01, 0.12], [0, 0.25, 0], WHITE]],
    // Ringed planet
    [base(0x6b7488), ["cyl", [0.03, 0.03, 0.26], [0, -0.24, 0], 0x6b7488], ["sph", 0.21, [0, 0.08, 0], 0xf0a04b],
      ["tor", [0.3, 0.025], [0, 0.08, 0], 0xf3dfb0, { rot: [PI / 2.5, 0, 0.2] }], ["sph", 0.215, [0, 0.11, 0], 0xd9783a, { scale: [1, 0.25, 1] }]],
    // Alien
    [["cyl", [0.13, 0.19, 0.34], [0, -0.27, 0], 0x5fd35f], ["sph", 0.19, [0, 0.1, 0], 0x6fe36f, { scale: [1.1, 1, 1] }],
      ["sph", 0.07, [0.08, 0.12, 0.14], BLACK, { scale: [1.4, 0.8, 0.5], many: [[-0.08, 0.12, 0.14]] }], ["cyl", [0.01, 0.01, 0.14], [0.08, 0.32, 0], 0x5fd35f, { many: [[-0.08, 0.32, 0]] }],
      ["sph", 0.03, [0.08, 0.4, 0], 0xff4dd2, { glow: true, many: [[-0.08, 0.4, 0]] }]],
    // Moon rover
    [["box", [0.44, 0.1, 0.32], [0, -0.28, 0], SILVER], ["cyl", [0.08, 0.08, 0.06], [0.24, -0.36, 0.12], 0x2a2d36, { rot: [0, 0, PI / 2], many: [[-0.24, -0.36, 0.12], [0.24, -0.36, -0.12], [-0.24, -0.36, -0.12]] }],
      ["box", [0.26, 0.16, 0.22], [0, -0.15, 0], WHITE], ["box", [0.4, 0.02, 0.24], [0, -0.04, 0], 0x2b5cff], ["cyl", [0.015, 0.015, 0.22], [0.1, 0.07, 0], SILVER],
      ["sph", 0.08, [0.1, 0.2, 0], WHITE, { scale: [1, 0.4, 1] }]],
    // Comet
    [base(0x6b7488), ["cone", [0.15, 0.5], [0, -0.1, 0], 0xff9f43, { rot: [PI, 0, 0], clear: true, glow: true }], ["sph", 0.16, [0, 0.2, 0], 0xcff4ff, { glow: true }],
      ["sph", 0.05, [0.08, 0.3, 0.1], WHITE, { glow: true }]],
  ],
  candy: [
    // Lollipop
    [base(0xff9ad0), ["cyl", [0.025, 0.025, 0.5], [0, -0.16, 0], WHITE], ["cyl", [0.22, 0.22, 0.07], [0, 0.2, 0], 0xff4f9a, { rot: [PI / 2, 0, 0] }],
      ["tor", [0.13, 0.03], [0, 0.2, 0.04], WHITE], ["tor", [0.06, 0.025], [0, 0.2, 0.04], 0xfff07a]],
    // Cupcake
    [["cyl", [0.22, 0.16, 0.24], [0, -0.32, 0], 0xff7eb6], ["sph", 0.23, [0, -0.17, 0], 0x8a4b2a, { scale: [1, 0.55, 1] }],
      ["cone", [0.22, 0.32], [0, 0.03, 0], 0xfff0f6], ["sph", 0.065, [0, 0.22, 0], RED, { glow: true }]],
    // Gumdrop
    [["cyl", [0.15, 0.27, 0.36], [0, -0.26, 0], 0x4fd36a, { clear: true }], ["sph", 0.15, [0, -0.08, 0], 0x4fd36a, { clear: true }],
      ["sph", 0.02, [0.1, -0.2, 0.2], WHITE, { many: [[-0.12, -0.3, 0.2], [0.05, -0.02, 0.13], [-0.06, -0.12, 0.2], [0.17, -0.35, 0.12]] }]],
    // Candy cane
    [base(0xfff07a), ["cyl", [0.05, 0.05, 0.15], [0.08, -0.3, 0], RED], ["cyl", [0.05, 0.05, 0.15], [0.08, -0.15, 0], WHITE],
      ["cyl", [0.05, 0.05, 0.15], [0.08, 0.0, 0], RED], ["cyl", [0.05, 0.05, 0.12], [0.08, 0.13, 0], WHITE], ["tor", [0.1, 0.05, PI], [-0.02, 0.19, 0], RED]],
    // Ice cream
    [["cone", [0.15, 0.42], [0, -0.22, 0], 0xd9a35c, { rot: [PI, 0, 0] }], ["sph", 0.15, [0, 0.04, 0], 0xff9fc6], ["sph", 0.13, [0, 0.23, 0], 0x9ff0c8],
      ["sph", 0.05, [0, 0.37, 0], RED, { glow: true }]],
    // Donut
    [base(0xff9ad0), ["cyl", [0.03, 0.03, 0.18], [0, -0.28, 0], WHITE], ["tor", [0.16, 0.09], [0, 0.03, 0], 0xc98a4b], ["tor", [0.16, 0.07], [0, 0.03, 0.03], 0xff6fb1],
      ["box", [0.05, 0.015, 0.015], [0.1, 0.13, 0.08], 0xfff07a, { many: [[-0.12, 0.08, 0.09], [0.15, -0.03, 0.09], [-0.05, -0.1, 0.09]] }]],
    // Gingerbread man
    [["box", [0.24, 0.3, 0.08], [0, -0.06, 0], 0xb86b2f], ["cyl", [0.12, 0.12, 0.08], [0, 0.2, 0], 0xb86b2f, { rot: [PI / 2, 0, 0] }],
      ["box", [0.42, 0.09, 0.08], [0, 0.0, 0], 0xb86b2f], ["box", [0.09, 0.26, 0.08], [0.07, -0.3, 0], 0xb86b2f, { many: [[-0.07, -0.3, 0]] }],
      ["sph", 0.025, [0, -0.02, 0.045], WHITE, { many: [[0, -0.1, 0.045], [0.04, 0.22, 0.045], [-0.04, 0.22, 0.045]] }], ["tor", [0.05, 0.012, PI], [0, 0.18, 0.045], WHITE, { rot: [0, 0, PI] }]],
    // Jelly bear
    [["sph", 0.2, [0, -0.22, 0], 0xff3d5a, { clear: true }], ["sph", 0.15, [0, 0.1, 0], 0xff3d5a, { clear: true }], ["sph", 0.055, [0.11, 0.22, 0], 0xff3d5a, { clear: true, many: [[-0.11, 0.22, 0]] }],
      ["sph", 0.07, [0.17, -0.15, 0.06], 0xff3d5a, { clear: true, many: [[-0.17, -0.15, 0.06]] }], ["sph", 0.08, [0.1, -0.38, 0.08], 0xff3d5a, { clear: true, many: [[-0.1, -0.38, 0.08]] }]],
  ],
  ocean: [
    // Octopus
    [["sph", 0.2, [0, 0.12, 0], 0xb05fd8, { scale: [1, 1.2, 1] }], ["sph", 0.04, [0.08, 0.1, 0.17], WHITE, { many: [[-0.08, 0.1, 0.17]] }],
      ["sph", 0.02, [0.08, 0.1, 0.205], BLACK, { many: [[-0.08, 0.1, 0.205]] }],
      ["cyl", [0.045, 0.025, 0.36], [0.14, -0.24, 0], 0xb05fd8, { rot: [0, 0, 0.3], many: [[-0.14, -0.24, 0], [0, -0.24, 0.14], [0, -0.24, -0.14], [0.1, -0.24, 0.1], [-0.1, -0.24, 0.1], [0.1, -0.24, -0.1], [-0.1, -0.24, -0.1]] }]],
    // Crab
    [["sph", 0.21, [0, -0.25, 0], 0xe8483a, { scale: [1.3, 0.6, 1] }], ["cyl", [0.03, 0.03, 0.18], [0.2, -0.17, 0.08], 0xe8483a, { rot: [0, 0, -0.9], many: [[-0.2, -0.17, 0.08]] }],
      ["sph", 0.09, [0.27, -0.08, 0.1], 0xe8483a, { scale: [1, 1.3, 0.7], many: [[-0.27, -0.08, 0.1]] }], ["cyl", [0.015, 0.015, 0.12], [0.06, -0.08, 0.1], 0xe8483a, { many: [[-0.06, -0.08, 0.1]] }],
      ["sph", 0.035, [0.06, -0.01, 0.1], WHITE, { many: [[-0.06, -0.01, 0.1]] }], ["sph", 0.017, [0.06, -0.01, 0.13], BLACK, { many: [[-0.06, -0.01, 0.13]] }]],
    // Pufferfish
    [base(0x3a8fa8), ["sph", 0.24, [0, 0.02, 0], 0xffd23f], ["sph", 0.18, [0, -0.04, 0.08], 0xfff1b8, { scale: [1, 0.7, 0.9] }],
      ["cone", [0.025, 0.08], [0, 0.29, 0], 0xd9a020, { many: [[0.21, 0.2, 0], [-0.21, 0.2, 0], [0.26, 0.02, 0], [-0.26, 0.02, 0], [0, 0.2, -0.2], [0.15, 0.16, 0.15], [-0.15, 0.16, 0.15]] }],
      ["sph", 0.045, [0.09, 0.08, 0.2], WHITE, { many: [[-0.09, 0.08, 0.2]] }], ["sph", 0.022, [0.09, 0.08, 0.24], BLACK, { many: [[-0.09, 0.08, 0.24]] }]],
    // Seahorse
    [base(0x3a8fa8), ["sph", 0.12, [0, -0.04, 0], 0xff9a3c, { scale: [1, 1.6, 1] }], ["sph", 0.09, [0, 0.24, 0.03], 0xff9a3c],
      ["cyl", [0.025, 0.035, 0.13], [0, 0.23, 0.14], 0xff9a3c, { rot: [PI / 2, 0, 0] }], ["tor", [0.07, 0.035, PI * 1.4], [0, -0.26, 0.02], 0xff9a3c, { rot: [0, PI / 2, 0] }],
      ["sph", 0.02, [0.05, 0.27, 0.08], BLACK, { many: [[-0.05, 0.27, 0.08]] }], ["cone", [0.05, 0.12], [0, 0.0, -0.13], 0xffd23f, { rot: [-PI / 2, 0, 0] }]],
    // Lighthouse
    [["cyl", [0.12, 0.2, 0.62], [0, -0.13, 0], WHITE], ["cyl", [0.15, 0.172, 0.1], [0, -0.1, 0], RED], ["cyl", [0.181, 0.197, 0.1], [0, -0.33, 0], RED],
      ["cyl", [0.1, 0.1, 0.1], [0, 0.23, 0], 0xfff07a, { glow: true }], ["cone", [0.14, 0.12], [0, 0.34, 0], RED]],
    // Anchor
    [["cyl", [0.035, 0.035, 0.55], [0, 0.0, 0], 0x3b4250], ["tor", [0.07, 0.025], [0, 0.33, 0], 0x3b4250], ["box", [0.3, 0.04, 0.05], [0, 0.2, 0], 0x3b4250],
      ["tor", [0.2, 0.035, PI], [0, -0.08, 0], 0x3b4250, { rot: [0, 0, PI] }], ["cone", [0.05, 0.1], [0.2, -0.04, 0], 0x3b4250, { many: [[-0.2, -0.04, 0]] }], base(0xd9c08a)],
    // Treasure chest
    [["box", [0.44, 0.26, 0.3], [0, -0.31, 0], 0x8a5a2b], ["cyl", [0.15, 0.15, 0.44, 1], [0, -0.18, 0], 0x7a4a22, { rot: [0, 0, PI / 2], half: true }],
      ["box", [0.05, 0.27, 0.31], [0.14, -0.31, 0], GOLD, { many: [[-0.14, -0.31, 0]] }], ["box", [0.07, 0.09, 0.02], [0, -0.2, 0.16], GOLD],
      ["cyl", [0.06, 0.06, 0.015], [0.06, -0.02, 0.05], GOLD, { many: [[-0.08, 0.0, 0.0], [0.0, 0.02, -0.06]] }]],
    // Turtle
    [["sph", 0.25, [0, -0.25, 0], 0x6c8a3a, { scale: [1, 0.55, 1.2] }], ["sph", 0.2, [0, -0.18, 0], 0x3f9a4a, { scale: [1, 0.55, 1.1] }],
      ["sph", 0.09, [0, -0.24, 0.31], 0x9ac46a], ["sph", 0.06, [0.2, -0.36, 0.18], 0x9ac46a, { scale: [1.6, 0.5, 1], many: [[-0.2, -0.36, 0.18], [0.2, -0.36, -0.18], [-0.2, -0.36, -0.18]] }],
      ["sph", 0.018, [0.04, -0.21, 0.39], BLACK, { many: [[-0.04, -0.21, 0.39]] }]],
  ],
};
