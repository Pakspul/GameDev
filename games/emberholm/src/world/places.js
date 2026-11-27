// The hand-placed places of The Strand, stamped into the generated island (see terrain.js).
// Plain data: positions in metres, north is -z. `name` areas show the place's name when you walk in;
// `clear` keeps trees and rocks away; `flat` levels the ground; structures are what stands there.
//
// Structures (collision and drawing): { kind, x, z, rot, ... } relative to the place.
//   house  { w, d }         a longhouse, w along its length
//   fire   { r }            the great fire (village) or a camp fire
//   stone  {}               a waystone
//   tower  { r, h }         round stone tower (beacon, watchtower)
//   tent   { r }            raider tent
//   wreck  {}               the boat you came on
//   mill   {}               the old mill
//   barrow {}               the stone door of a burial mound (the mound itself is terrain)
//   fence  { len }          a short wooden fence along x

export const PLACES = [
  {
    id: "wreck", x: 72, z: 528, name: 34, clear: 16,
    structures: [{ kind: "wreck", x: 4, z: 8, rot: 0.5 }],
  },
  {
    id: "brandvik", x: 24, z: 318, name: 62, clear: 50, flat: 46,
    structures: [
      { kind: "fire", x: 0, z: 0, r: 2.4 },
      { kind: "house", x: -19, z: -11, rot: 0.35, w: 16, d: 7 },
      { kind: "house", x: 19, z: -12, rot: -0.3, w: 15, d: 7 },
      { kind: "house", x: -20, z: 14, rot: -0.25, w: 14, d: 6.5 },
      { kind: "house", x: 21, z: 13, rot: 0.2, w: 13, d: 6.5 },
      { kind: "house", x: 1, z: -27, rot: 0, w: 18, d: 8 },
      { kind: "fence", x: -36, z: 0, rot: 1.5708, len: 14 },
      { kind: "fence", x: 37, z: 1, rot: 1.5708, len: 12 },
      { kind: "stone", x: 34, z: 26, rot: 0.3 },
    ],
  },
  {
    id: "mill", x: -170, z: 175, name: 30, clear: 18, flat: 16,
    structures: [{ kind: "mill", x: 0, z: 0, rot: 0.8 }, { kind: "stone", x: 14, z: 12, rot: 0 }],
  },
  {
    id: "barrows", x: 205, z: 55, name: 48, clear: 34, flat: 40,
    // Three mounds raised into the ground, each with a stone door facing south.
    mounds: [{ x: -14, z: -6, r: 11, h: 3.6 }, { x: 12, z: -14, r: 9, h: 3 }, { x: 10, z: 13, r: 12, h: 4 }],
    structures: [
      { kind: "barrow", x: -14, z: 4.2, rot: 0 }, { kind: "barrow", x: 12, z: -5.4, rot: 0 }, { kind: "barrow", x: 10, z: 24.5, rot: 0 },
      { kind: "stone", x: -30, z: 24, rot: 0.6 },
    ],
  },
  {
    id: "blackmire", x: 300, z: 240, name: 85, bog: 110,
    structures: [],
  },
  {
    id: "ravenpoint", x: -365, z: 205, name: 42, clear: 30, flat: 28,
    structures: [
      { kind: "tent", x: -8, z: -4, r: 2 }, { kind: "tent", x: 7, z: -7, r: 1.8 }, { kind: "tent", x: 2, z: 9, r: 2.2 },
      { kind: "fire", x: 0, z: 0, r: 1.2, camp: true },
      { kind: "fence", x: -14, z: 12, rot: 0.9, len: 10 }, { kind: "fence", x: 14, z: 10, rot: -0.8, len: 9 },
    ],
  },
  {
    id: "copper", x: -250, z: -110, name: 40, clear: 20,
    structures: [{ kind: "stone", x: 22, z: 18, rot: 0.2 }],
  },
  {
    id: "watchtower", x: 330, z: -140, name: 30, clear: 14, flat: 14,
    structures: [{ kind: "tower", x: 0, z: 0, r: 3.2, h: 13 }],
  },
  {
    id: "beacon", x: -55, z: -205, name: 45, clear: 22, flat: 18, hill: { r: 110, h: 24 },
    structures: [{ kind: "tower", x: 0, z: 0, r: 3.6, h: 9, beacon: true }, { kind: "stone", x: 16, z: 22, rot: -0.4 }],
  },
];

export const byId = Object.fromEntries(PLACES.map((p) => [p.id, p]));

/** Every structure in world coordinates: [{ ...s, x, z, rot, place }]. */
export const STRUCTURES = PLACES.flatMap((p) => (p.structures || []).map((s) => ({ ...s, x: p.x + s.x, z: p.z + s.z, rot: s.rot || 0, place: p.id })));

/** Where a new game starts: on the beach next to the wreck, facing the village. */
export const START = { x: 62, z: 515, yaw: 0.1 };

/** North of this line you're in the Fells, the mountain wall to the next zone (no way through yet). */
export const FELLS_Z = -300;
