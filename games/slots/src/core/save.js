// Saving (PERS-01, PERS-05): everything is stored locally, atomically and with a version number.
//
// Atomic: a save goes to the slot that is NOT the newest one, and only counts once it is complete
// and its checksum matches. A crash in the middle of a save therefore leaves the previous save intact.
// The older slot doubles as the backup: if the newest slot is corrupted, the game falls back to it
// and tells the player.
//
// Versioning: every save carries SAVE_VERSION; each version change ships a migration in MIGRATIONS.

export const SAVE_VERSION = 1;

/** MIGRATIONS[n] upgrades a save from version n to n + 1. */
export const MIGRATIONS = {
  // Version 0 was the format of the first prototype: coins instead of balance, one flat settings object.
  0: (d) => {
    const out = { ...d, v: 1 };
    if (out.balance === undefined && out.coins !== undefined) out.balance = out.coins;
    delete out.coins;
    out.settings = { ...(out.settings || {}) };
    out.machines = out.machines || {};
    out.totals = out.totals || { wagered: 0, won: 0, spins: 0 };
    out.achievements = out.achievements || {};
    return out;
  },
};

export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** Upgrade old data step by step; returns null when it comes from a newer game than this one. */
export function migrate(data) {
  let d = data;
  let v = typeof d.v === "number" ? d.v : 0;
  if (v > SAVE_VERSION) return null;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    d = step(d);
    v = d.v;
  }
  return d;
}

export class SaveStore {
  /** @param storage something with getItem/setItem/removeItem (localStorage, or a fake in tests) */
  constructor(storage, key = "honest-arcade.slots.save") {
    this.storage = storage;
    this.key = key;
  }
  _slotKey(i) { return `${this.key}.${i}`; }

  _read(i) {
    let raw;
    try { raw = this.storage.getItem(this._slotKey(i)); } catch (e) { return { present: false }; }
    if (raw === null || raw === undefined) return { present: false };
    try {
      const wrap = JSON.parse(raw);
      if (typeof wrap.data !== "string" || wrap.sum !== checksum(wrap.data) || !Number.isInteger(wrap.seq)) return { present: true, ok: false };
      const parsed = JSON.parse(wrap.data);
      const data = migrate(parsed);
      if (!data) return { present: true, ok: false };
      return { present: true, ok: true, seq: wrap.seq, data, migrated: (parsed.v || 0) !== SAVE_VERSION };
    } catch (e) {
      return { present: true, ok: false };
    }
  }

  /**
   * @returns { profile, recovered, corrupt, migrated }
   *   recovered: true when the newest save was unreadable and the backup was used instead
   *   corrupt: true when saves existed but none could be read (the game starts fresh)
   */
  load() {
    const slots = [this._read(0), this._read(1)];
    const valid = slots.map((s, i) => ({ ...s, i })).filter((s) => s.ok).sort((a, b) => b.seq - a.seq);
    const anyPresent = slots.some((s) => s.present);
    if (!valid.length) return { profile: null, recovered: false, corrupt: anyPresent, migrated: false };
    const best = valid[0];
    // Was a newer slot present but unreadable? Then we are using the backup.
    const brokenNewer = slots.some((s, i) => s.present && !s.ok && i !== best.i);
    this._seq = best.seq;
    this._next = 1 - best.i;
    return { profile: best.data, recovered: brokenNewer, corrupt: false, migrated: !!best.migrated };
  }

  /** Write the profile atomically. Returns false when storage refused (full, blocked). */
  save(profile) {
    if (this._seq === undefined) { // never loaded: continue after whatever is there
      const s = [this._read(0), this._read(1)];
      const best = s.map((x, i) => ({ ...x, i })).filter((x) => x.ok).sort((a, b) => b.seq - a.seq)[0];
      this._seq = best ? best.seq : 0;
      this._next = best ? 1 - best.i : 0;
    }
    const data = JSON.stringify(profile);
    const wrap = JSON.stringify({ v: SAVE_VERSION, seq: this._seq + 1, sum: checksum(data), data });
    try {
      this.storage.setItem(this._slotKey(this._next), wrap);
    } catch (e) {
      return false;
    }
    this._seq += 1;
    this._next = 1 - this._next;
    return true;
  }

  /** Reset progress: remove both slots. */
  clear() {
    for (const i of [0, 1]) { try { this.storage.removeItem(this._slotKey(i)); } catch (e) { /* ignore */ } }
    this._seq = undefined;
  }
}
