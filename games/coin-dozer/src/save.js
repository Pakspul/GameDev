// Save data: on this device only, under the game's own "coin-dozer." key, versioned.
//
// Saved: progress (credits, Workshop levels, themes, collections, milestones, stats), settings,
// and a compact snapshot of the board (bank, coins and prizes with their positions and sleeping
// state, timers), which machine is in use (pins or classic), and the parked board of the other
// machine, so switching back finds it as it was. A save from another version is migrated; if its
// board can't be used, the game starts a fresh board and keeps credits and collections. A corrupt
// save never crashes the game.
import { CONFIG } from "./config.js";
import { freshProgress, UPGRADES, THEMES } from "./economy.js";

export const SAVE_KEY = "coin-dozer.save";
export const SAVE_VERSION = 1;

export function freshSettings() {
  return { sound: true, haptics: true, shake: true, autoDefault: false };
}

export function freshSave(cfg = CONFIG) {
  return { v: SAVE_VERSION, config: cfg.version, progress: freshProgress(cfg), settings: freshSettings(), machine: cfg.defaultMachine, board: null, parked: {}, hintSeen: false, storageNotice: false };
}

const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : d);

/** Clean up progress from any source: keep what's valid, fill in the rest. */
export function cleanProgress(p, cfg = CONFIG) {
  const out = freshProgress(cfg);
  if (!isObj(p)) return out;
  out.credits = int(p.credits);
  for (const id of UPGRADES) out.workshop[id] = Math.min(cfg.economy.workshop[id].costs.length, int(p.workshop && p.workshop[id]));
  if (isObj(p.themes)) for (const t of THEMES) if (p.themes[t]) out.themes[t] = true;
  out.themes.classic = true;
  out.theme = out.themes[p.theme] ? p.theme : "classic";
  if (isObj(p.collection)) {
    for (const t of THEMES) {
      const set = p.collection[t];
      if (!isObj(set)) continue;
      for (const k in set) { const i = Number(k); if (Number.isInteger(i) && i >= 0 && i < cfg.economy.setSize) out.collection[t][i] = String(set[k]).slice(0, 10); }
    }
  }
  if (isObj(p.milestones)) for (const m of cfg.economy.milestones) if (p.milestones[m.id]) out.milestones[m.id] = true;
  if (isObj(p.stats)) for (const k in out.stats) out.stats[k] = int(p.stats[k]);
  return out;
}

/**
 * Bring any saved data up to the current version. Older versions are migrated step by step; a save
 * from an unknown (newer) version or another shelf layout keeps progress and settings but drops the board.
 */
export function migrate(data, cfg = CONFIG) {
  const base = freshSave(cfg);
  if (!isObj(data)) return base;
  let d = { ...data };
  // v0 (early builds): progress fields sat at the top level and the bank was "coins".
  if (!d.v) {
    d = { v: 1, config: d.config, progress: { credits: d.credits, workshop: d.workshop, themes: d.themes, theme: d.theme, collection: d.collection, milestones: d.milestones, stats: d.stats },
      settings: d.settings, board: isObj(d.board) ? { ...d.board, bank: d.board.bank ?? d.coins } : null, hintSeen: d.hintSeen };
  }
  const out = {
    v: SAVE_VERSION,
    config: cfg.version,
    progress: cleanProgress(d.progress, cfg),
    settings: { ...base.settings },
    machine: cfg.machines.includes(d.machine) ? d.machine : isObj(d.board) ? "classic" : cfg.defaultMachine,   // saves from before the pin wall played the classic machine
    board: null,
    parked: {},
    hintSeen: !!d.hintSeen,
    storageNotice: !!d.storageNotice,
  };
  if (isObj(d.settings)) for (const k in out.settings) if (typeof d.settings[k] === "boolean") out.settings[k] = d.settings[k];
  // The board only survives when it was written by the same version with the same shelf.
  const usable = (b) => isObj(b) && isObj(b.board) && Array.isArray(b.board.items);
  if (d.v === SAVE_VERSION && d.config === cfg.version) {
    if (usable(d.board)) out.board = d.board;
    if (isObj(d.parked)) for (const m of cfg.machines) if (m !== out.machine && usable(d.parked[m])) out.parked[m] = d.parked[m];
  }
  return out;
}

/** localStorage when it works, memory otherwise (private windows, blocked storage). */
export function makeStorage() {
  try {
    const k = "coin-dozer.probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch (e) {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), volatile: true };
  }
}

export function loadSave(storage, cfg = CONFIG) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return migrate(raw ? JSON.parse(raw) : null, cfg);
  } catch (e) {
    return freshSave(cfg);
  }
}

/** Write the save. Returns false when storage is full or blocked (the game keeps playing). */
export function writeSave(storage, save) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); return !storage.volatile; } catch (e) { return false; }
}
