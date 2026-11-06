// Save data: on this device only, under the game's own "wallbreaker." namespace, versioned, with
// export and import. Nothing here ever leaves the device unless the player copies the export.
import { CONFIG } from "./config.js";

export const SAVE_KEY = "wallbreaker.save";
export const SAVE_VERSION = 1;

export function freshSave() {
  const owned = {}, look = {};
  for (const shelf in CONFIG.cosmetics) {
    const def = CONFIG.cosmetics[shelf][0][0];
    owned[def] = true;
    look[shelf] = def;
  }
  const boosts = {};
  for (const id in CONFIG.boosts.items) boosts[id] = 0;
  const workshop = {};
  for (const id in CONFIG.workshop.items) workshop[id] = 0;
  return {
    v: SAVE_VERSION,
    config: CONFIG.version,
    credits: 0,
    stats: { classicBest: 0, runBest: 0, bricks: 0, earned: 0, spent: 0, cleared: 0, bestTimes: {} },
    classic: { level: 1, lives: null, reached: 1, stars: {} },
    zen: { level: 1, stars: {} },
    descent: { level: 1, stars: {} },
    run: { active: null, unlocked: [], bosses: 0, best: 0 },
    daily: { best: {}, paid: null, streak: 0, last: null },
    puzzle: { stars: {} },
    ta: { best: {}, medal: {} },
    boosts,
    equip: [],
    workshop,
    owned,
    look,
    settings: {
      sound: 0.8, music: 0.35, haptics: true, palette: "default", reducedMotion: null, leftHanded: false,
      autoLaunch: false, aimAssist: true, sensitivity: 1,
    },
    seenHelp: false,
  };
}

/** Fill in anything missing (older saves, imports) without dropping what's there. */
export function migrate(data) {
  const base = freshSave();
  if (!data || typeof data !== "object") return base;
  const out = merge(base, data);
  out.v = SAVE_VERSION;
  out.config = CONFIG.version;
  out.credits = Math.max(0, Math.floor(Number(out.credits) || 0));
  return out;
}

function merge(base, data) {
  if (Array.isArray(base)) return Array.isArray(data) ? data.slice() : base;
  if (!base || typeof base !== "object") return data === undefined || (typeof data !== typeof base && base !== null) ? base : data;
  const out = { ...base };
  for (const k in data) {
    if (k in base && base[k] !== null && typeof base[k] === "object" && !Array.isArray(base[k])) out[k] = merge(base[k], data[k]);
    else if (!(k in base) || data[k] === null || typeof data[k] === typeof base[k] || base[k] === null) out[k] = data[k];
  }
  return out;
}

/** localStorage when it works, memory otherwise (private windows). */
export function makeStorage() {
  try {
    const k = "wallbreaker.probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch (e) {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), volatile: true };
  }
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return migrate(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return freshSave();
  }
}

export function writeSave(storage, save) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* full or blocked: keep playing */ }
}

/** A text the player can keep or move to another device. */
export function exportSave(save) {
  return JSON.stringify({ game: "wallbreaker", v: SAVE_VERSION, exported: new Date().toISOString(), data: save });
}

/** Read an export. Throws with a short reason if the text isn't a Wallbreaker save. */
export function importSave(text) {
  let obj;
  try { obj = JSON.parse(String(text).trim()); } catch (e) { throw new Error("not-json"); }
  if (!obj || obj.game !== "wallbreaker" || typeof obj.data !== "object") throw new Error("not-wallbreaker");
  if (obj.v > SAVE_VERSION) throw new Error("too-new");
  return migrate(obj.data);
}
