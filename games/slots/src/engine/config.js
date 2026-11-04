// Machine config: validation (MATH-03) and a prepared form the engine can use quickly.
// The engine contains no machine-specific numbers: everything comes from a config like
// games/slots/machines/crystal-fortune.json.

export const SYMBOL_KINDS = ["regular", "wild", "scatter", "coin", "bonus", "collect"];
export const JACKPOT_TIERS = ["mini", "minor", "major", "grand"];
export const PICK_ITEM_TYPES = ["coins", "extraPick", "multiplier", "collect", "jackpot"];
export const FEATURE_TYPES = ["holdSpin", "freeSpins", "pick"];

const isInt = Number.isInteger;
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/** Returns a list of human-readable problems; empty when the config is valid. */
export function validateMachine(cfg) {
  const errors = [];
  const err = (msg) => errors.push(msg);
  if (!cfg || typeof cfg !== "object") return ["config is not an object"];
  const need = (cond, msg) => { if (!cond) err(msg); return cond; };

  need(typeof cfg.id === "string" && /^[a-z0-9-]+$/.test(cfg.id), "id must be a lowercase slug");
  need(isInt(cfg.version) && cfg.version >= 1, "version must be a positive integer");
  need(typeof cfg.name === "string" && cfg.name, "name is required");

  // ---- grid -------------------------------------------------------------------------------
  const reels = cfg.grid && cfg.grid.reels, rows = cfg.grid && cfg.grid.rows;
  if (!need(isInt(reels) && reels >= 3 && reels <= 6, "grid.reels must be an integer from 3 to 6")) return errors;
  if (!need(isInt(rows) && rows >= 3 && rows <= 5, "grid.rows must be an integer from 3 to 5")) return errors;
  const mode = cfg.mode;
  need(mode === "lines" || mode === "ways", 'mode must be "lines" or "ways"');

  // ---- symbols ----------------------------------------------------------------------------
  const symbols = cfg.symbols || {};
  const ids = Object.keys(symbols);
  need(ids.length > 0, "symbols is empty");
  for (const id of ids) {
    const s = symbols[id];
    if (!SYMBOL_KINDS.includes(s.kind)) err(`symbol ${id}: unknown kind "${s.kind}"`);
    if (s.kind === "wild") {
      if (s.multiplier !== undefined && !(isInt(s.multiplier) && s.multiplier >= 2)) err(`symbol ${id}: multiplier must be an integer >= 2`);
    } else if (s.expanding || s.multiplier) err(`symbol ${id}: only wilds can expand or carry a multiplier`);
  }
  const kind = (id) => symbols[id] && symbols[id].kind;
  const symbolsOfKind = (k) => ids.filter((id) => kind(id) === k);

  // ---- bet --------------------------------------------------------------------------------
  const div = cfg.betDivisor;
  need(isInt(div) && div >= 1, "betDivisor must be a positive integer");
  const levels = cfg.betLevels;
  if (need(Array.isArray(levels) && levels.length >= 2, "betLevels needs at least two levels")) {
    levels.forEach((b, i) => {
      if (!isInt(b) || b <= 0) err(`betLevels[${i}] must be a positive integer`);
      else if (isInt(div) && b % div !== 0) err(`betLevels[${i}]=${b} is not a multiple of betDivisor ${div}`);
      if (i > 0 && b <= levels[i - 1]) err("betLevels must be ascending");
    });
    need(levels.includes(cfg.defaultBet), "defaultBet must be one of betLevels");
    if (need(Array.isArray(cfg.betUnlockLevels) && cfg.betUnlockLevels.length === levels.length, "betUnlockLevels needs one entry per bet level")) {
      cfg.betUnlockLevels.forEach((l, i) => {
        if (!isInt(l) || l < 1) err(`betUnlockLevels[${i}] must be an integer >= 1`);
        else if (i > 0 && l < cfg.betUnlockLevels[i - 1]) err("betUnlockLevels must not decrease");
      });
    }
  }
  need(isNum(cfg.maxWin) && cfg.maxWin > 0, "maxWin must be a positive number");
  if (cfg.timing !== undefined) need(isNum(cfg.timing.staggerMs) && cfg.timing.staggerMs >= 0 && cfg.timing.staggerMs <= 600, "timing.staggerMs must be 0-600");

  // ---- paylines ---------------------------------------------------------------------------
  if (mode === "lines") {
    const lines = cfg.paylines;
    if (need(Array.isArray(lines) && lines.length > 0, "paylines are required in lines mode")) {
      need(lines.length === div, `betDivisor (${div}) must equal the number of paylines (${lines.length}) in lines mode`);
      lines.forEach((line, i) => {
        if (!Array.isArray(line) || line.length !== reels) return err(`payline ${i + 1}: needs one row per reel (${reels})`);
        line.forEach((r, c) => { if (!isInt(r) || r < 0 || r >= rows) err(`payline ${i + 1}: reel ${c + 1} uses row ${r}, outside the grid`); });
      });
    }
  }

  // ---- paytable ---------------------------------------------------------------------------
  const pay = cfg.paytable || {};
  for (const id of Object.keys(pay)) {
    if (!symbols[id]) { err(`paytable: unknown symbol ${id}`); continue; }
    if (["coin", "bonus", "collect"].includes(kind(id))) err(`paytable: ${id} (${kind(id)}) cannot pay`);
    let prev = 0;
    for (const [count, mult] of Object.entries(pay[id])) {
      const n = Number(count);
      if (!isInt(n) || n < 2 || n > (kind(id) === "scatter" ? reels * rows : reels)) err(`paytable ${id}: bad count "${count}"`);
      if (!(isInt(mult) && mult > 0)) err(`paytable ${id}[${count}]: multiplier must be a positive integer`);
      if (mult < prev) err(`paytable ${id}: pays must not decrease with count`);
      prev = mult;
    }
  }
  for (const id of ids) {
    if ((kind(id) === "regular" || kind(id) === "scatter") && !pay[id]) err(`paytable: missing entry for ${id}`);
  }
  if (mode === "ways") {
    const wildPays = symbolsOfKind("wild").filter((id) => pay[id]);
    if (wildPays.length) err("ways mode: wilds cannot have their own paytable entry (they only substitute)");
  }
  const combine = (cfg.wild && cfg.wild.combine) || "multiply";
  need(combine === "multiply" || combine === "add", 'wild.combine must be "multiply" or "add"');
  if (mode === "ways" && combine === "add") err('ways mode only supports wild.combine "multiply"');
  const wildReels = cfg.wild && cfg.wild.reels;
  if (wildReels !== undefined) need(Array.isArray(wildReels) && wildReels.every((r) => isInt(r) && r >= 0 && r < reels), "wild.reels must be reel indexes inside the grid");

  // ---- strips -----------------------------------------------------------------------------
  const stripSets = cfg.strips || {};
  if (!need(stripSets.base, "strips.base is required")) return errors;
  for (const setName of Object.keys(stripSets)) {
    if (setName !== "base" && setName !== "free") { err(`strips: unknown set "${setName}"`); continue; }
    const set = stripSets[setName];
    if (!Array.isArray(set) || set.length !== reels) { err(`strips.${setName}: needs ${reels} reels`); continue; }
    set.forEach((strip, r) => {
      if (!Array.isArray(strip) || strip.length < rows * 3) return err(`strips.${setName}[${r}]: needs at least ${rows * 3} symbols`);
      strip.forEach((id, i) => {
        if (!symbols[id]) return err(`strips.${setName}[${r}][${i}]: unknown symbol ${id}`);
        if (kind(id) === "wild" && wildReels && !wildReels.includes(r)) err(`strips.${setName}[${r}]: wild ${id} is not allowed on reel ${r + 1}`);
        if (setName === "free" && ["coin", "bonus", "collect"].includes(kind(id))) err(`strips.free[${r}]: ${id} (${kind(id)}) is not allowed in free spins`);
      });
    });
  }

  // ---- cascade ----------------------------------------------------------------------------
  if (cfg.cascade && cfg.cascade.enabled) {
    const m = cfg.cascade.multipliers;
    need(Array.isArray(m) && m.length > 0 && m.every((x) => isInt(x) && x >= 1), "cascade.multipliers must be a list of integers >= 1");
  }

  // ---- jackpots ---------------------------------------------------------------------------
  const jp = cfg.jackpots || {};
  const f = cfg.features || {};
  const usesJackpots = (f.holdSpin) || (f.pick && (f.pick.pool || []).some((p) => p.type === "jackpot"));
  if (usesJackpots || cfg.jackpots) {
    for (const tier of JACKPOT_TIERS) {
      const j = jp[tier];
      if (!need(j, `jackpots.${tier} is missing`)) continue;
      if (j.type === "fixed") need(isNum(j.value) && j.value > 0, `jackpots.${tier}.value must be > 0`);
      else if (j.type === "progressive") {
        need(isNum(j.seed) && j.seed > 0, `jackpots.${tier}.seed must be > 0`);
        need(isNum(j.contribution) && j.contribution >= 0, `jackpots.${tier}.contribution must be >= 0`);
      } else err(`jackpots.${tier}.type must be "fixed" or "progressive"`);
    }
  }

  // ---- features ---------------------------------------------------------------------------
  const baseHas = (id) => stripSets.base.some((strip) => Array.isArray(strip) && strip.includes(id));
  const order = cfg.featureOrder;
  if (need(Array.isArray(order) && order.every((t) => FEATURE_TYPES.includes(t)), "featureOrder must list feature types")) {
    for (const t of Object.keys(f)) need(order.includes(t), `featureOrder is missing "${t}"`);
  }
  if (f.freeSpins) {
    const fs = f.freeSpins;
    if (need(kind(fs.trigger && fs.trigger.symbol) === "scatter", "freeSpins.trigger.symbol must be a scatter symbol")) {
      need(baseHas(fs.trigger.symbol), "freeSpins: the trigger symbol never appears on the base strips");
      const awards = fs.trigger.awards || {};
      const counts = Object.keys(awards).map(Number);
      need(counts.length > 0 && counts.every((n) => isInt(n) && n >= 2 && n <= reels * rows), "freeSpins.trigger.awards needs scatter counts");
      Object.values(awards).forEach((n) => need(isInt(n) && n > 0, "freeSpins awards must be positive integers"));
      need(isNum(fs.trigger.minCount) && fs.trigger.minCount === Math.min(...counts), "freeSpins.trigger.minCount must equal the lowest awarded count");
    }
    if (fs.retrigger && fs.retrigger.enabled) {
      need(isInt(fs.retrigger.spins) && fs.retrigger.spins > 0, "freeSpins.retrigger.spins must be a positive integer");
      need(isInt(fs.retrigger.cap) && fs.retrigger.cap > 0, "freeSpins.retrigger.cap (total spin cap) must be a positive integer");
    }
    const mod = fs.modifiers || {};
    if (mod.multiplier !== undefined) need(isInt(mod.multiplier) && mod.multiplier >= 1, "freeSpins.modifiers.multiplier must be an integer >= 1");
    if (mod.progressive) {
      const p = mod.progressive;
      need(p.per === "spin" || p.per === "win", 'freeSpins progressive.per must be "spin" or "win"');
      need(isInt(p.start) && isInt(p.step) && isInt(p.max) && p.start >= 1 && p.step >= 1 && p.max >= p.start, "freeSpins progressive start/step/max must be integers");
    }
    if (fs.choice) {
      need(fs.choice.length >= 2 && fs.choice.length <= 3, "freeSpins.choice needs 2 or 3 options");
      fs.choice.forEach((o, i) => need(isInt(o.spins) && o.spins > 0 && isInt(o.multiplier) && o.multiplier >= 1 && typeof o.id === "string", `freeSpins.choice[${i}] needs id, spins and multiplier`));
      need(fs.choiceScale && Object.keys(fs.choiceScale).length > 0, "freeSpins.choiceScale (scatter count -> factor) is required with choice");
    }
  }
  if (f.holdSpin) {
    const hs = f.holdSpin;
    need(kind(hs.trigger && hs.trigger.symbol) === "coin", "holdSpin.trigger.symbol must be a coin symbol");
    need(isInt(hs.trigger && hs.trigger.count) && hs.trigger.count >= 2 && hs.trigger.count <= reels * rows, "holdSpin.trigger.count must fit the grid");
    need(baseHas(hs.trigger && hs.trigger.symbol), "holdSpin: the coin symbol never appears on the base strips");
    need(isInt(hs.respins) && hs.respins >= 1, "holdSpin.respins must be >= 1");
    need(isNum(hs.landChance) && hs.landChance > 0 && hs.landChance < 1, "holdSpin.landChance must be between 0 and 1");
    if (need(Array.isArray(hs.coinValues) && hs.coinValues.length > 0, "holdSpin.coinValues is required")) {
      hs.coinValues.forEach((c, i) => {
        need(isNum(c.weight) && c.weight > 0, `holdSpin.coinValues[${i}].weight must be > 0`);
        if (c.jackpot !== undefined) need(["mini", "minor", "major"].includes(c.jackpot), `holdSpin.coinValues[${i}].jackpot must be mini, minor or major`);
        else need(isInt(c.value) && c.value > 0, `holdSpin.coinValues[${i}].value must be a positive integer`);
      });
    }
  }
  if (f.pick) {
    const pk = f.pick;
    need(kind(pk.trigger && pk.trigger.symbol) === "bonus", "pick.trigger.symbol must be a bonus symbol");
    need(Array.isArray(pk.trigger && pk.trigger.reels) && pk.trigger.reels.length >= 1 && pk.trigger.reels.every((r) => isInt(r) && r >= 0 && r < reels), "pick.trigger.reels must be reel indexes");
    need(baseHas(pk.trigger && pk.trigger.symbol), "pick: the bonus symbol never appears on the base strips");
    need(isInt(pk.items) && pk.items >= 4, "pick.items must be an integer >= 4");
    need(isInt(pk.startPicks) && pk.startPicks >= 1 && pk.startPicks <= pk.items, "pick.startPicks must fit in items");
    if (need(Array.isArray(pk.pool) && pk.pool.length > 0, "pick.pool is required")) {
      pk.pool.forEach((p, i) => {
        if (!PICK_ITEM_TYPES.includes(p.type)) err(`pick.pool[${i}]: unknown type ${p.type}`);
        need(isNum(p.weight) && p.weight > 0, `pick.pool[${i}].weight must be > 0`);
        if (["coins", "extraPick", "multiplier"].includes(p.type)) need(isInt(p.value) && p.value > 0, `pick.pool[${i}].value must be a positive integer`);
        if (p.type === "jackpot") need(JACKPOT_TIERS.includes(p.tier), `pick.pool[${i}].tier must be a jackpot tier`);
      });
      need(pk.pool.some((p) => p.type === "collect"), "pick.pool needs a collect item so the bonus can end");
    }
  }
  if (cfg.meter) {
    const m = cfg.meter;
    need(kind(m.symbol) === "collect", "meter.symbol must be a collect symbol");
    need(baseHas(m.symbol), "meter: the collect symbol never appears on the base strips");
    need(isInt(m.target) && m.target >= 2, "meter.target must be an integer >= 2");
    if (m.reward && m.reward.type === "freeSpins") {
      need(f.freeSpins, "meter reward freeSpins needs the freeSpins feature");
      need(isInt(m.reward.spins) && m.reward.spins > 0, "meter.reward.spins must be a positive integer");
    } else if (m.reward && m.reward.type === "pick") need(f.pick, "meter reward pick needs the pick feature");
    else err('meter.reward.type must be "freeSpins" or "pick"');
  }

  // ---- anticipation, tiers, targets ------------------------------------------------------
  const ant = cfg.anticipation;
  if (need(ant && isNum(ant.extraMs) && ant.extraMs >= 0, "anticipation.extraMs is required")) {
    for (const [i, a] of (ant.triggers || []).entries()) {
      need(symbols[a.symbol], `anticipation.triggers[${i}]: unknown symbol`);
      need(isInt(a.needed) && isInt(a.minLanded) && a.minLanded >= 1 && a.minLanded < a.needed, `anticipation.triggers[${i}]: minLanded must be below needed`);
    }
  }
  const t = cfg.winTiers;
  need(t && isNum(t.win) && isNum(t.big) && isNum(t.mega) && isNum(t.epic) && t.win < t.big && t.big < t.mega && t.mega < t.epic, "winTiers must ascend: win < big < mega < epic");
  const tg = cfg.targets;
  if (need(tg, "targets are required")) {
    need(isNum(tg.rtp) && tg.rtp > 0 && tg.rtp < 1.5, "targets.rtp must be a fraction like 0.96");
    need(Array.isArray(tg.hitFrequency) && tg.hitFrequency.length === 2, "targets.hitFrequency must be [min, max]");
    need(Array.isArray(tg.freeSpinsEvery) && tg.freeSpinsEvery.length === 2, "targets.freeSpinsEvery must be [min, max]");
    need(["low", "medium", "high"].includes(tg.volatility), "targets.volatility must be low, medium or high");
    need(isNum(tg.rtpTolerance) && tg.rtpTolerance > 0, "targets.rtpTolerance must be > 0");
  }
  return [...new Set(errors)];
}

const cache = new WeakMap();

/** The config in a form the engine can use without lookups: cached per config object. */
export function prepare(cfg) {
  let p = cache.get(cfg);
  if (p) return p;
  const errors = validateMachine(cfg);
  if (errors.length) throw new Error(`Invalid machine config "${cfg && cfg.id}":\n  ` + errors.join("\n  "));
  const reels = cfg.grid.reels, rows = cfg.grid.rows;
  const kindOf = {}, wild = {};
  for (const [id, s] of Object.entries(cfg.symbols)) {
    kindOf[id] = s.kind;
    if (s.kind === "wild") wild[id] = { multiplier: s.multiplier || 1, expanding: !!s.expanding };
  }
  const payByCount = {}, minCount = {};
  for (const [id, table] of Object.entries(cfg.paytable)) {
    const arr = new Array(reels * rows + 1).fill(0);
    const counts = Object.keys(table).map(Number).sort((a, b) => a - b);
    for (const c of counts) arr[c] = table[c];
    // counts above the highest listed pay the highest entry (scatters can exceed the listed counts)
    for (let c = counts[counts.length - 1] + 1; c < arr.length; c++) arr[c] = table[counts[counts.length - 1]];
    // counts between listed ones pay the lower entry
    for (let c = counts[0] + 1; c < arr.length; c++) if (!arr[c]) arr[c] = arr[c - 1];
    payByCount[id] = arr;
    minCount[id] = counts[0];
  }
  const wildIds = Object.keys(wild);
  const wildPayKey = wildIds.find((id) => cfg.paytable[id]) || null;
  p = {
    cfg, reels, rows, mode: cfg.mode,
    kindOf, wild, wildIds, wildPayKey, payByCount, minCount,
    combine: (cfg.wild && cfg.wild.combine) || "multiply",
    lines: cfg.paylines || null,
    divisor: cfg.betDivisor,
    strips: { base: cfg.strips.base, free: cfg.strips.free || cfg.strips.base },
    features: cfg.features || {},
    featureOrder: cfg.featureOrder || [],
    cascade: cfg.cascade && cfg.cascade.enabled ? cfg.cascade.multipliers : null,
    regularIds: Object.keys(kindOf).filter((id) => kindOf[id] === "regular"),
    maxWin: cfg.maxWin,
  };
  cache.set(cfg, p);
  return p;
}
