// The seven modes as rule sets for one engine, and which modifiers each one lets in.
// Fair modes (Daily, Puzzle, Time Attack) and Zen take no boosts, no Workshop upgrades and no
// risky capsules, so their results are comparable between players.
import { CONFIG } from "./config.js";

export const MODES = {
  classic: { id: "classic", play: "paddle", lives: CONFIG.lives.classic, onLost: "life", boosts: true, workshop: true, risky: true, drops: "good", credits: "full" },
  zen: { id: "zen", play: "paddle", lives: Infinity, onLost: "return", boosts: false, workshop: false, risky: false, drops: "good", credits: "zen" },
  descent: { id: "descent", play: "aim", descent: true, lives: Infinity, boosts: true, workshop: true, risky: false, drops: "descent", credits: "full" },
  run: { id: "run", play: "paddle", lives: CONFIG.lives.run, onLost: "life", boosts: false, workshop: true, risky: true, drops: "good", credits: "bank" },
  daily: { id: "daily", play: "paddle", lives: CONFIG.lives.daily, onLost: "life", boosts: false, workshop: false, risky: false, drops: "good", credits: "daily" },
  puzzle: { id: "puzzle", play: "aim", descent: false, lives: Infinity, boosts: false, workshop: false, risky: false, drops: "none", credits: "puzzle" },
  timeattack: { id: "timeattack", play: "paddle", lives: Infinity, onLost: "penalty", boosts: false, workshop: false, risky: false, drops: "good", credits: "medal" },
};
export const MODE_ORDER = ["classic", "zen", "descent", "run", "daily", "puzzle", "timeattack"];

/** Boosts that can be equipped in a mode. */
export function boostsFor(mode) {
  if (!MODES[mode].boosts) return [];
  return Object.keys(CONFIG.boosts.items).filter((id) => CONFIG.boosts.items[id].modes.includes(mode));
}

/** Workshop level of an upgrade in a save-like object, clamped to its maximum. */
export function wsLevel(workshop, id) {
  return Math.max(0, Math.min(CONFIG.workshop.items[id].max, (workshop && workshop[id]) || 0));
}

/**
 * Everything that changes the engine's numbers, for one level in one mode.
 *   workshop   { longLasting: 2, ... } owned upgrade levels
 *   boosts     ["life", "lucky"] equipped boosts (ignored where the mode doesn't allow them)
 *   perks      { wide: 2, net: 1, ... } Run perks (Run only)
 * Returns { mods, lives, creditMul }.
 */
export function buildMods(mode, { workshop = {}, boosts = [], perks = {} } = {}) {
  const M = MODES[mode];
  const W = CONFIG.workshop.items;
  const mods = { durationMul: 1, goodMul: 1, paddleMul: 1, speedMul: 1, startBalls: 1 };
  let lives = M.lives;
  let creditMul = 1;
  if (M.workshop) {
    mods.durationMul *= 1 + W.longLasting.per * wsLevel(workshop, "longLasting");
    mods.goodMul *= 1 + W.luckyCharm.per * wsLevel(workshop, "luckyCharm");
    mods.paddleMul *= 1 + W.steadyHands.per * wsLevel(workshop, "steadyHands");
    creditMul *= 1 + W.scavenger.per * wsLevel(workshop, "scavenger");
    if ((mode === "classic" || mode === "run") && wsLevel(workshop, "secondWind")) lives = 4;
  }
  const allowed = new Set(boostsFor(mode));
  const equipped = [...new Set(boosts)].filter((b) => allowed.has(b)).slice(0, CONFIG.boosts.maxEquipped);
  const B = CONFIG.boosts.items;
  for (const b of equipped) {
    if (b === "multiStart") mods.startBalls = 2;
    if (b === "life") lives = Number.isFinite(lives) ? lives + 1 : lives;
    if (b === "life" && mode === "descent") mods.descentSaves = 1;
    if (b === "wideStart") mods.startWide = B.wideStart.seconds;
    if (b === "netStart") mods.startNet = true;
    if (b === "stickyStart") mods.startSticky = B.stickyStart.catches;
    if (b === "lucky") mods.goodMul *= 1 + B.lucky.goodBonus;
  }
  if (mode === "run") {
    const R = CONFIG.run.perks;
    const k = (id) => Math.min(R[id].max, perks[id] || 0);
    mods.paddleMul *= 1 + R.wide.width * k("wide");
    if (k("net")) mods.startNet = true;
    if (k("multi")) mods.startBalls = 2;
    mods.speedMul *= Math.pow(R.slow.speed, k("slow"));
    if (k("fire")) mods.startFire = R.fire.seconds * k("fire");
    mods.goodMul *= 1 + R.luck.goodBonus * k("luck");
    mods.durationMul *= 1 + R.long.duration * k("long");
    if (k("laser")) mods.startLaser = R.laser.seconds * k("laser");
    if (k("magnet")) mods.startMagnet = R.magnet.seconds * k("magnet");
    if (k("sticky")) mods.startSticky = R.sticky.catches * k("sticky");
    if (k("bomb")) mods.startBomb = true;
    creditMul *= 1 + R.haul.credits * k("haul");
  }
  return { mods, lives, creditMul, equipped };
}

/** Puzzle stars from shots: 3 at or under par, 2 one over, 1 for any clear within the limit. */
export function puzzleStars(shots, par) {
  return shots <= par ? 3 : shots <= par + 1 ? 2 : 1;
}

/** Time Attack medal for a time (seconds, penalties included). */
export function medalFor(time, wall) {
  if (time <= wall.gold) return "gold";
  if (time <= wall.silver) return "silver";
  if (time <= wall.bronze) return "bronze";
  return null;
}
export const MEDALS = [null, "bronze", "silver", "gold"];

/** The last checkpoint at or below a level (1, 5, 10, 15, ...). */
export function checkpointFor(level) {
  const e = CONFIG.checkpointEvery;
  return level < e ? 1 : Math.floor(level / e) * e;
}
