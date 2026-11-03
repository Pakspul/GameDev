// Camper Crew: road generator. Pure logic, no rendering, so it also runs in Node for tests.
//
// A level is a road from the start to the campsite, built from straights and bends, plus
// rain zones (leaks), potholes (bumps that throw the luggage off the shelf) and the times
// the passenger gets hungry. Same seed, same road, forever: that is what makes a daily road
// possible without a server.
//
// Units: 1 unit is roughly 0.5 m. The camper cruises at ~12 units/s.
(function (root) {
  "use strict";

  function rng(seed) {
    // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(n) {
    var h = 2166136261 >>> 0;
    var s = "camper-crew:" + n;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h;
  }

  var CRUISE = 12; // units per second at full speed
  var STEP = 1; // road sample spacing

  /**
   * Build road number `n` (1, 2, 3, …). Higher numbers: longer road, sharper and more
   * frequent bends, more rain, more potholes.
   */
  function makeLevel(n) {
    n = Math.max(1, n | 0);
    var r = rng(hashSeed(n));
    var tier = Math.min(1, (n - 1) / 9); // 0 at road 1, 1 from road 10 on

    var length = Math.round(1500 + 300 * tier + r() * 150);
    // Time until sunset: a perfect drive takes length / CRUISE seconds; the rest is slack.
    var sunset = Math.round(length / CRUISE + 50 - 15 * tier);

    // Road shape: alternate straights and bends. The first 120 units are straight so the
    // player has a moment to look around.
    var pieces = [];
    var s = 0;
    pieces.push({ s0: 0, len: 120, curv: 0 });
    s = 120;
    while (s < length - 140) {
      var straight = Math.round(lerp(150, 70, tier) + r() * 90);
      pieces.push({ s0: s, len: straight, curv: 0 });
      s += straight;
      if (s >= length - 140) break;
      var radius = lerp(55, 26, tier) + r() * 25;
      var bendLen = Math.round(30 + r() * lerp(35, 60, tier));
      var dir = r() < 0.5 ? -1 : 1;
      pieces.push({ s0: s, len: bendLen, curv: dir / radius });
      s += bendLen;
    }
    pieces.push({ s0: s, len: length - s + 60, curv: 0 }); // run-out past the campsite

    // Sample the centre line.
    var count = Math.ceil((length + 60) / STEP) + 1;
    var xs = new Float32Array(count), ys = new Float32Array(count), hs = new Float32Array(count), ks = new Float32Array(count);
    var x = 0, y = 0, h = 0, pi = 0;
    for (var i = 0; i < count; i++) {
      var si = i * STEP;
      while (pi < pieces.length - 1 && si >= pieces[pi].s0 + pieces[pi].len) pi++;
      var k = pieces[pi].curv;
      xs[i] = x; ys[i] = y; hs[i] = h; ks[i] = k;
      h += k * STEP;
      x += Math.cos(h) * STEP;
      y += Math.sin(h) * STEP;
    }

    // Rain zones: one on road 1, up to three later.
    var rain = [];
    var rainCount = n === 1 ? 1 : 1 + Math.round(r() * (1 + tier));
    for (var j = 0; j < rainCount; j++) {
      var start = 250 + r() * (length - 550);
      rain.push([Math.round(start), Math.round(start + 180 + r() * 160)]);
    }
    rain.sort(function (a, b) { return a[0] - b[0]; });

    // Potholes: each one shakes the camper and may knock luggage off the shelf.
    var bumps = [];
    var gap = lerp(260, 130, tier);
    for (var b = 180 + r() * 120; b < length - 60; b += gap * (0.6 + r() * 0.8)) bumps.push(Math.round(b));

    // Hunger: seconds into the level at which the passenger asks for food.
    var hunger = [];
    for (var t = 18 + r() * 10; t < sunset - 15; t += lerp(48, 34, tier) + r() * 14) hunger.push(Math.round(t));

    return {
      n: n,
      length: length,
      sunset: sunset,
      cruise: CRUISE,
      step: STEP,
      pieces: pieces,
      xs: xs, ys: ys, hs: hs, ks: ks,
      rain: rain,
      bumps: bumps,
      hunger: hunger,
      seed: hashSeed(n),
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /** Road pose at distance s: { x, y, h (heading), k (curvature) }, linearly interpolated. */
  function sample(level, s) {
    var f = Math.max(0, Math.min(level.xs.length - 1.001, s / level.step));
    var i = Math.floor(f), t = f - i;
    return {
      x: level.xs[i] + (level.xs[i + 1] - level.xs[i]) * t,
      y: level.ys[i] + (level.ys[i + 1] - level.ys[i]) * t,
      h: level.hs[i] + (level.hs[i + 1] - level.hs[i]) * t,
      k: level.ks[i],
    };
  }

  /** The next bend after distance s within `ahead` units: { dist, dir } or null. */
  function nextBend(level, s, ahead) {
    for (var i = 0; i < level.pieces.length; i++) {
      var p = level.pieces[i];
      if (p.curv === 0) continue;
      if (p.s0 + p.len < s) continue;
      var d = p.s0 - s;
      if (d > ahead) return null;
      return { dist: Math.max(0, d), dir: p.curv > 0 ? 1 : -1, inside: d <= 0, sharp: Math.abs(p.curv) };
    }
    return null;
  }

  function inRain(level, s) {
    for (var i = 0; i < level.rain.length; i++) if (s >= level.rain[i][0] && s <= level.rain[i][1]) return true;
    return false;
  }

  root.CamperLevels = { makeLevel: makeLevel, sample: sample, nextBend: nextBend, inRain: inRain, rng: rng, hashSeed: hashSeed };
})(typeof window !== "undefined" ? window : globalThis);
