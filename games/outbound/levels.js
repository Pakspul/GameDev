/* Outbound level generator — deterministic per (tier, level). */
var OutboundGen = (function () {
  var GEN_VERSION = 1;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  var TIERS = {
    easy:    { name: "Easy",       base: 8,  grow: 4, cap: 14, minLen: 3, maxLen: 7,  lenBias: 1.0, straight: 0.55, warn: 0.6, harden: 40, mergeCap: 8 },
    medium:  { name: "Medium",     base: 12, grow: 4, cap: 20, minLen: 4, maxLen: 12, lenBias: 0.9, straight: 0.5,  warn: 0.7, harden: 150, mergeCap: 14 },
    hard:    { name: "Hard",       base: 16, grow: 3, cap: 26, minLen: 5, maxLen: 20, lenBias: 0.8, straight: 0.45, warn: 0.75, harden: 500, mergeCap: 26 },
    extra:   { name: "Extra Hard", base: 22, grow: 2, cap: 34, minLen: 6, maxLen: 30, lenBias: 0.7, straight: 0.4,  warn: 0.8, harden: 1200, mergeCap: 40 },
    insane:  { name: "Insane",     base: 30, grow: 2, cap: 40, minLen: 8, maxLen: 45, lenBias: 0.6, straight: 0.35, warn: 0.85, harden: 2500, mergeCap: 60 },
    // v2 tiers: bigger boards, tuned with a trap-aware difficulty score
    master:      { name: "Master",      base: 30, grow: 2, cap: 48, minLen: 5, maxLen: 26, lenBias: 0.7, straight: 0.4,  warn: 0.8,  harden: 5000, mergeCap: 40, v2: true },
    grandmaster: { name: "Grandmaster", base: 40, grow: 2, cap: 64, minLen: 6, maxLen: 36, lenBias: 0.6, straight: 0.35, warn: 0.85, harden: 7000, mergeCap: 56, v2: true }
  };
  var TIER_ORDER = ["easy", "medium", "hard", "extra", "insane", "master", "grandmaster"];

  function hashStr(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function sizeFor(tier, level) {
    var p = TIERS[tier];
    return Math.min(p.cap, p.base + Math.floor((level - 1) / p.grow));
  }

  // direction from cell a to adjacent cell b
  function dirOf(a, b, W) {
    var d = b - a;
    if (d === -W) return 0;
    if (d === 1) return 1;
    if (d === W) return 2;
    return 3;
  }

  function partition(W, H, p, rng) {
    var N = W * H;
    var owner = new Int32Array(N).fill(-1);
    var snakes = [];
    function emptyNbrs(c) {
      var x = c % W, y = (c / W) | 0, out = [];
      for (var d = 0; d < 4; d++) {
        var nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var n = ny * W + nx;
        if (owner[n] === -1) out.push(n);
      }
      return out;
    }
    function step(cur, prev, id) {
      var cand = emptyNbrs(cur);
      if (!cand.length) return -1;
      if (prev !== -1) {
        var straight = cur + (cur - prev);
        var sx = straight % W, cx = cur % W;
        var ok = straight >= 0 && straight < N && Math.abs(sx - cx) <= 1 && owner[straight] === -1;
        if (ok && rng() < p.straight) return straight;
      }
      if (rng() < p.warn) {
        // Warnsdorff: go where fewest exits remain, so we don't strand cells
        var best = [], bestDeg = 9;
        for (var i = 0; i < cand.length; i++) {
          owner[cand[i]] = id; // temporarily
          var deg = emptyNbrs(cand[i]).length;
          owner[cand[i]] = -1;
          if (deg < bestDeg) { bestDeg = deg; best = [cand[i]]; }
          else if (deg === bestDeg) best.push(cand[i]);
        }
        return best[Math.floor(rng() * best.length)];
      }
      return cand[Math.floor(rng() * cand.length)];
    }
    var order = shuffle(Array.from({ length: N }, function (_, i) { return i; }), rng);
    for (var oi = 0; oi < N; oi++) {
      var c = order[oi];
      if (owner[c] !== -1) continue;
      var id = snakes.length;
      var span = p.maxLen - p.minLen;
      var target = p.minLen + Math.floor(Math.pow(rng(), p.lenBias) * (span + 1));
      var path = [c];
      owner[c] = id;
      // grow forward
      while (path.length < target) {
        var n = step(path[path.length - 1], path.length > 1 ? path[path.length - 2] : -1, id);
        if (n < 0) break;
        owner[n] = id; path.push(n);
      }
      // grow backward if still short
      while (path.length < target) {
        var m = step(path[0], path.length > 1 ? path[1] : -1, id);
        if (m < 0) break;
        owner[m] = id; path.unshift(m);
      }
      if (path.length === 1) {
        // attach to a neighbouring snake end
        owner[c] = -1;
        var x = c % W, y = (c / W) | 0, attached = false;
        for (var d = 0; d < 4 && !attached; d++) {
          var nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var nb = ny * W + nx, o = owner[nb];
          if (o < 0) continue;
          var s = snakes[o];
          if (s[s.length - 1] === nb) { s.push(c); owner[c] = o; attached = true; }
          else if (s[0] === nb) { s.unshift(c); owner[c] = o; attached = true; }
        }
        continue;
      }
      snakes.push(path);
    }
    // random head end
    for (var k = 0; k < snakes.length; k++) if (rng() < 0.5) snakes[k].reverse();
    return snakes;
  }

  // ray check; returns -2 if free, otherwise the id of the first blocking snake
  function rayBlocker(cells, occ, W, H) {
    var h = cells[cells.length - 1], d = dirOf(cells[cells.length - 2], h, W);
    var x = h % W + DX[d], y = ((h / W) | 0) + DY[d];
    while (x >= 0 && y >= 0 && x < W && y < H) {
      var o = occ[y * W + x];
      if (o !== -1) return o;
      x += DX[d]; y += DY[d];
    }
    return -2;
  }

  function buildOcc(snakes, W, H) {
    var occ = new Int32Array(W * H).fill(-1);
    for (var i = 0; i < snakes.length; i++) {
      var s = snakes[i];
      if (!s) continue;
      for (var j = 0; j < s.length; j++) occ[s[j]] = i;
    }
    return occ;
  }

  // Simulate. With repair=true, mutates snakes so the board becomes solvable.
  function solve(snakes, W, H, repair, rng) {
    var occ = buildOcc(snakes, W, H);
    var alive = [];
    for (var i = 0; i < snakes.length; i++) if (snakes[i]) alive.push(i);
    var layers = 0, firstFree = -1, totalFree = 0;
    while (alive.length) {
      var free = [], rest = [];
      for (var a = 0; a < alive.length; a++) {
        var id = alive[a];
        if (rayBlocker(snakes[id], occ, W, H) === -2) free.push(id); else rest.push(id);
      }
      if (!free.length) {
        if (!repair) return null;
        var fixed = false;
        var tryOrder = shuffle(rest.slice(), rng);
        // 1) reverse a stuck snake
        for (var t = 0; t < tryOrder.length && !fixed; t++) {
          var s = snakes[tryOrder[t]];
          s.reverse();
          if (rayBlocker(s, occ, W, H) === -2) fixed = true; else s.reverse();
        }
        // 2) split a stuck snake so one piece can escape
        for (var t3 = 0; t3 < tryOrder.length && !fixed; t3++) {
          var pid = tryOrder[t3], ps = snakes[pid], n = ps.length;
          if (n < 4) continue;
          var ks = [];
          for (var kk = 1; kk <= n - 3; kk++) ks.push(kk);
          shuffle(ks, rng);
          for (var ki = 0; ki < ks.length && !fixed; ki++) {
            var k = ks[ki];
            var A = ps.slice(0, k + 1), B = ps.slice(k + 1);
            var cands = [[A, B], [A.slice().reverse(), B], [B.slice().reverse(), A]];
            for (var ci = 0; ci < cands.length && !fixed; ci++) {
              var esc = cands[ci][0], keep = cands[ci][1];
              if (rayBlocker(esc, occ, W, H) === -2) {
                var nid = snakes.length;
                snakes[pid] = keep;
                snakes.push(esc);
                for (var ec = 0; ec < esc.length; ec++) occ[esc[ec]] = nid;
                rest.push(nid);
                alive = rest;
                fixed = true;
              }
            }
          }
        }
        // 3) trim one end cell (leaves a 1-cell gap)
        for (var t2 = 0; t2 < tryOrder.length && !fixed; t2++) {
          var sid = tryOrder[t2], sn = snakes[sid];
          if (sn.length < 3) continue;
          for (var e = 0; e < 2 && !fixed; e++) {
            if (e === 1) sn.reverse();
            var cut = sn.pop();
            occ[cut] = -1;
            if (rayBlocker(sn, occ, W, H) === -2) fixed = true;
            else { sn.push(cut); occ[cut] = sid; }
            if (!fixed && e === 1) sn.reverse();
          }
        }
        // 3) delete the shortest stuck snake
        if (!fixed) {
          var shortest = rest[0];
          for (var r = 1; r < rest.length; r++) if (snakes[rest[r]].length < snakes[shortest].length) shortest = rest[r];
          var dead = snakes[shortest];
          for (var q = 0; q < dead.length; q++) occ[dead[q]] = -1;
          snakes[shortest] = null;
          alive = rest.filter(function (x) { return x !== shortest; });
        }
        continue;
      }
      if (firstFree < 0) firstFree = free.length;
      totalFree += free.length;
      for (var f = 0; f < free.length; f++) {
        var fs = snakes[free[f]];
        for (var z = 0; z < fs.length; z++) occ[fs[z]] = -1;
      }
      alive = rest;
      layers++;
    }
    return { layers: layers, firstFree: firstFree };
  }

  // Dependency analysis for v2 tiers. An arrow can leave once every arrow on its lane is gone.
  // L[i] = the round it leaves in. Score rewards long chains, few free arrows at the start,
  // and "traps": rounds in which an arrow's nearest blocker is 4+ cells away, so it looks free.
  function analyze(snakes, W, H) {
    var n = snakes.length, occ = buildOcc(snakes, W, H);
    var deps = [], start = new Int32Array(n + 1), nearEnd = new Int32Array(n);
    for (var i = 0; i < n; i++) {
      var s = snakes[i], h = s[s.length - 1], d = dirOf(s[s.length - 2], h, W);
      var x = h % W, y = (h / W) | 0, dist = 0, last = -1, ne = deps.length;
      while (true) {
        x += DX[d]; y += DY[d]; dist++;
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        var o = occ[y * W + x];
        if (o === -1 || o === last) continue;
        if (o === i) return null;
        deps.push(o); last = o;
        if (dist < 4) ne = deps.length;
      }
      nearEnd[i] = ne; start[i + 1] = deps.length;
    }
    var L = new Int32Array(n).fill(-1), st = new Uint8Array(n), cyc = false;
    function f(i) {
      if (st[i] === 2) return L[i];
      if (st[i] === 1) { cyc = true; return 0; }
      st[i] = 1;
      var m = -1;
      for (var j = start[i]; j < start[i + 1]; j++) { var v = f(deps[j]); if (cyc) return 0; if (v > m) m = v; }
      L[i] = m + 1; st[i] = 2;
      return L[i];
    }
    var layers = 0, firstFree = 0, trap = 0;
    for (var q = 0; q < n; q++) { f(q); if (cyc) return null; }
    for (var r = 0; r < n; r++) {
      if (L[r] + 1 > layers) layers = L[r] + 1;
      if (L[r] === 0) firstFree++;
      var A = -1;
      for (var k = start[r]; k < nearEnd[r]; k++) if (L[deps[k]] > A) A = L[deps[k]];
      if (L[r] - 1 - A > 0) trap += L[r] - 1 - A;
    }
    return { layers: layers, firstFree: firstFree, trap: trap, score: layers * 10 - firstFree * 8 + trap * 0.5 };
  }

  function hardenV2(snakes, W, H, p, rng) {
    var score = analyze(snakes, W, H);
    for (var i = 0; i < p.harden; i++) {
      var k = Math.floor(rng() * snakes.length);
      if (rng() < 0.55) {
        snakes[k].reverse();
        var sc = analyze(snakes, W, H);
        if (sc && sc.score >= score.score) score = sc; else snakes[k].reverse();
      } else {
        var a = snakes[k];
        if (a.length >= p.mergeCap) continue;
        var occ = buildOcc(snakes, W, H);
        var h = a[a.length - 1], hx = h % W, hy = (h / W) | 0, d0 = Math.floor(rng() * 4);
        for (var dd = 0; dd < 4; dd++) {
          var d = (d0 + dd) % 4, nx = hx + DX[d], ny = hy + DY[d];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var o = occ[ny * W + nx];
          if (o < 0 || o === k) continue;
          var b = snakes[o];
          if (a.length + b.length > p.mergeCap) continue;
          var bRev = b[0] !== ny * W + nx;
          if (bRev && b[b.length - 1] !== ny * W + nx) continue;
          var trial = snakes.slice();
          trial[k] = a.concat(bRev ? b.slice().reverse() : b);
          trial.splice(o, 1);
          var sc2 = analyze(trial, W, H);
          if (sc2 && sc2.score >= score.score) { snakes = trial; score = sc2; }
          break;
        }
      }
    }
    return { snakes: snakes, score: score };
  }

  function generate(tier, level, seedKey) {
    var p = TIERS[tier];
    var W = sizeFor(tier, level), H = W;
    var rng = mulberry32(hashStr(seedKey || ("outbound:v" + GEN_VERSION + ":" + tier + ":" + level)));
    var snakes = partition(W, H, p, rng);
    solve(snakes, W, H, true, rng);
    snakes = snakes.filter(function (s) { return s; });
    if (p.v2) {
      var hv = hardenV2(snakes, W, H, p, rng);
      return { tier: tier, level: level, W: W, H: H, snakes: hv.snakes, layers: hv.score.layers, firstFree: hv.score.firstFree, trap: hv.score.trap };
    }
    // Harden: flip or join snakes when that deepens the dependency chain
    // or leaves fewer arrows free at the start.
    var score = solve(snakes, W, H, false, rng);
    function better(sc) {
      return sc && (sc.layers > score.layers || (sc.layers === score.layers && sc.firstFree <= score.firstFree));
    }
    for (var i = 0; i < p.harden; i++) {
      var k = Math.floor(rng() * snakes.length);
      if (rng() < 0.55) {
        snakes[k].reverse();
        var sc = solve(snakes, W, H, false, rng);
        if (better(sc)) score = sc; else snakes[k].reverse();
      } else {
        // join snake k's head onto a neighbouring snake's tail
        var a = snakes[k];
        if (a.length >= p.mergeCap) continue;
        var occ = buildOcc(snakes, W, H);
        var h = a[a.length - 1], hx = h % W, hy = (h / W) | 0;
        var d0 = Math.floor(rng() * 4);
        for (var dd = 0; dd < 4; dd++) {
          var d = (d0 + dd) % 4, nx = hx + DX[d], ny = hy + DY[d];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var o = occ[ny * W + nx];
          if (o < 0 || o === k) continue;
          var b = snakes[o];
          if (a.length + b.length > p.mergeCap) continue;
          var bRev = b[0] !== ny * W + nx;
          if (bRev && b[b.length - 1] !== ny * W + nx) continue;
          var joined = a.concat(bRev ? b.slice().reverse() : b);
          var trial = snakes.slice();
          trial[k] = joined; trial.splice(o, 1);
          var sc2 = solve(trial, W, H, false, rng);
          if (better(sc2) || (sc2 && sc2.layers >= score.layers - 1 && sc2.firstFree < score.firstFree)) { snakes = trial; score = sc2; }
          break;
        }
      }
    }
    return { tier: tier, level: level, W: W, H: H, snakes: snakes, layers: score.layers, firstFree: score.firstFree };
  }

  return { generate: generate, TIERS: TIERS, TIER_ORDER: TIER_ORDER, sizeFor: sizeFor, rayBlocker: rayBlocker, dirOf: dirOf, buildOcc: buildOcc, solve: solve, analyze: analyze, DX: DX, DY: DY };
})();


/* Outbound 3D generator — snakes on the surface of a box, deterministic per (tier, level).
   Every surface cell has 4 neighbours (wrapping over edges). An arrow leaves by sliding
   straight off the edge of the face its head is on, so its "ray" never wraps. */
var OutboundGen3D = (function () {
  var GEN_VERSION = 1;

  var TIERS = {
    "c-easy":   { name: "Easy",       base: 3, grow: 5, cap: 5,  minLen: 3, maxLen: 6,  lenBias: 1.0, straight: 0.5,  warn: 0.6,  harden: 60,   mergeCap: 8 },
    "c-medium": { name: "Medium",     base: 4, grow: 4, cap: 7,  minLen: 3, maxLen: 10, lenBias: 0.9, straight: 0.5,  warn: 0.7,  harden: 200,  mergeCap: 14 },
    "c-hard":   { name: "Hard",       base: 5, grow: 3, cap: 9,  minLen: 4, maxLen: 16, lenBias: 0.8, straight: 0.45, warn: 0.75, harden: 500,  mergeCap: 22 },
    "c-extra":  { name: "Extra Hard", base: 7, grow: 3, cap: 11, minLen: 5, maxLen: 24, lenBias: 0.7, straight: 0.4,  warn: 0.8,  harden: 1000, mergeCap: 34 },
    "c-insane": { name: "Insane",     base: 9, grow: 3, cap: 13, minLen: 6, maxLen: 34, lenBias: 0.6, straight: 0.35, warn: 0.85, harden: 1800, mergeCap: 48 }
  };
  var TIER_ORDER = ["c-easy", "c-medium", "c-hard", "c-extra", "c-insane"];

  function hashStr(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function sizeFor(tier, level) {
    var p = TIERS[tier];
    return Math.min(p.cap, p.base + Math.floor((level - 1) / p.grow));
  }

  // ---- vectors ----
  function v(x, y, z) { return [x, y, z]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  var E = [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)];

  // Surface topology for an X×Y×Z box (in cells), centred on the origin.
  function buildSurface(X, Y, Z) {
    var dims = [X, Y, Z], faces = [], N = 0;
    for (var a = 0; a < 3; a++) {
      for (var si = 0; si < 2; si++) {
        var s = si === 0 ? 1 : -1, b = (a + 1) % 3, c = (a + 2) % 3;
        var n = mul(E[a], s);
        var f = { id: faces.length, a: a, s: s, n: n, u: E[b], v: E[c], nu: dims[b], nv: dims[c], center: mul(n, dims[a] / 2), off: N };
        faces.push(f);
        N += f.nu * f.nv;
      }
    }
    var face = new Int32Array(N), ci = new Int32Array(N), cj = new Int32Array(N);
    for (var fi = 0; fi < 6; fi++) {
      var F = faces[fi];
      for (var j = 0; j < F.nv; j++) for (var i = 0; i < F.nu; i++) {
        var id = F.off + j * F.nu + i;
        face[id] = fi; ci[id] = i; cj[id] = j;
      }
    }
    function pos(id) {
      var F = faces[face[id]];
      return add(add(F.center, mul(F.u, ci[id] + 0.5 - F.nu / 2)), mul(F.v, cj[id] + 0.5 - F.nv / 2));
    }
    function faceWithNormal(n) {
      for (var k = 0; k < 6; k++) if (eq(faces[k].n, n)) return faces[k];
      return null;
    }
    function cellAt(F, P) {
      var r = sub(P, F.center);
      var i = Math.floor(dot(r, F.u) + F.nu / 2), j = Math.floor(dot(r, F.v) + F.nv / 2);
      return F.off + j * F.nu + i;
    }
    // direction k on a face: 0:+u 1:+v 2:-u 3:-v
    function dirVec(F, k) { return k === 0 ? F.u : k === 1 ? F.v : k === 2 ? mul(F.u, -1) : mul(F.v, -1); }
    var nb = new Int32Array(N * 4);
    for (var id2 = 0; id2 < N; id2++) {
      var F2 = faces[face[id2]];
      for (var k = 0; k < 4; k++) {
        var di = k === 0 ? 1 : k === 2 ? -1 : 0, dj = k === 1 ? 1 : k === 3 ? -1 : 0;
        var i2 = ci[id2] + di, j2 = cj[id2] + dj;
        if (i2 >= 0 && j2 >= 0 && i2 < F2.nu && j2 < F2.nv) { nb[id2 * 4 + k] = F2.off + j2 * F2.nu + i2; continue; }
        var d = dirVec(F2, k);
        var P2 = add(add(pos(id2), mul(d, 0.5)), mul(F2.n, -0.5));
        nb[id2 * 4 + k] = cellAt(faceWithNormal(d), P2);
      }
    }
    return { dims: dims, faces: faces, N: N, face: face, ci: ci, cj: cj, nb: nb, pos: pos, dirVec: dirVec };
  }

  // direction index of the head: away from the previous cell
  function headDir(T, s) {
    var h = s[s.length - 1], p = s[s.length - 2];
    for (var k = 0; k < 4; k++) if (T.nb[h * 4 + k] === p) return (k + 2) % 4;
    return 0;
  }

  // -2 if the arrow can slide off its face, else id of the first arrow in the way
  function rayBlocker(T, s, occ) {
    var h = s[s.length - 1], d = headDir(T, s), f = T.face[h], c = h;
    while (true) {
      c = T.nb[c * 4 + d];
      if (T.face[c] !== f) return -2;
      if (occ[c] !== -1) return occ[c];
    }
  }
  // cells from the head to the face edge (including the last cell on the face)
  function stepsToEdge(T, s) {
    var h = s[s.length - 1], d = headDir(T, s), f = T.face[h], c = h, k = 0;
    while (true) { c = T.nb[c * 4 + d]; if (T.face[c] !== f) return k; k++; }
  }

  function buildOcc(T, snakes) {
    var occ = new Int32Array(T.N).fill(-1);
    for (var i = 0; i < snakes.length; i++) {
      var s = snakes[i];
      if (!s) continue;
      for (var j = 0; j < s.length; j++) occ[s[j]] = i;
    }
    return occ;
  }

  function partition(T, p, rng) {
    var N = T.N, owner = new Int32Array(N).fill(-1), snakes = [];
    function emptyNbrs(c) {
      var out = [];
      for (var k = 0; k < 4; k++) { var n = T.nb[c * 4 + k]; if (owner[n] === -1) out.push(n); }
      return out;
    }
    function step(cur, prev, id) {
      var cand = emptyNbrs(cur);
      if (!cand.length) return -1;
      if (prev !== -1) {
        var k0 = -1;
        for (var k = 0; k < 4; k++) if (T.nb[cur * 4 + k] === prev) k0 = k;
        var straight = T.nb[cur * 4 + (k0 + 2) % 4];
        if (owner[straight] === -1 && rng() < p.straight) return straight;
      }
      if (rng() < p.warn) {
        var best = [], bestDeg = 9;
        for (var i = 0; i < cand.length; i++) {
          owner[cand[i]] = id;
          var deg = emptyNbrs(cand[i]).length;
          owner[cand[i]] = -1;
          if (deg < bestDeg) { bestDeg = deg; best = [cand[i]]; }
          else if (deg === bestDeg) best.push(cand[i]);
        }
        return best[Math.floor(rng() * best.length)];
      }
      return cand[Math.floor(rng() * cand.length)];
    }
    var order = shuffle(Array.from({ length: N }, function (_, i) { return i; }), rng);
    for (var oi = 0; oi < N; oi++) {
      var c = order[oi];
      if (owner[c] !== -1) continue;
      var id = snakes.length, span = p.maxLen - p.minLen;
      var target = p.minLen + Math.floor(Math.pow(rng(), p.lenBias) * (span + 1));
      var path = [c];
      owner[c] = id;
      while (path.length < target) {
        var n = step(path[path.length - 1], path.length > 1 ? path[path.length - 2] : -1, id);
        if (n < 0) break;
        owner[n] = id; path.push(n);
      }
      while (path.length < target) {
        var m = step(path[0], path.length > 1 ? path[1] : -1, id);
        if (m < 0) break;
        owner[m] = id; path.unshift(m);
      }
      if (path.length === 1) {
        owner[c] = -1;
        var attached = false;
        for (var k = 0; k < 4 && !attached; k++) {
          var nbc = T.nb[c * 4 + k], o = owner[nbc];
          if (o < 0) continue;
          var s = snakes[o];
          if (s[s.length - 1] === nbc) { s.push(c); owner[c] = o; attached = true; }
          else if (s[0] === nbc) { s.unshift(c); owner[c] = o; attached = true; }
        }
        continue;
      }
      snakes.push(path);
    }
    for (var q = 0; q < snakes.length; q++) if (rng() < 0.5) snakes[q].reverse();
    return snakes;
  }

  function solve(T, snakes, repair, rng) {
    var occ = buildOcc(T, snakes), alive = [];
    for (var i = 0; i < snakes.length; i++) if (snakes[i]) alive.push(i);
    var layers = 0, firstFree = -1;
    while (alive.length) {
      var free = [], rest = [];
      for (var a = 0; a < alive.length; a++) {
        var id = alive[a];
        if (rayBlocker(T, snakes[id], occ) === -2) free.push(id); else rest.push(id);
      }
      if (!free.length) {
        if (!repair) return null;
        var fixed = false, tryOrder = shuffle(rest.slice(), rng);
        for (var t = 0; t < tryOrder.length && !fixed; t++) {
          var s = snakes[tryOrder[t]];
          s.reverse();
          if (rayBlocker(T, s, occ) === -2) fixed = true; else s.reverse();
        }
        for (var t3 = 0; t3 < tryOrder.length && !fixed; t3++) {
          var pid = tryOrder[t3], ps = snakes[pid], n = ps.length;
          if (n < 4) continue;
          var ks = [];
          for (var kk = 1; kk <= n - 3; kk++) ks.push(kk);
          shuffle(ks, rng);
          for (var ki = 0; ki < ks.length && !fixed; ki++) {
            var k = ks[ki], A = ps.slice(0, k + 1), B = ps.slice(k + 1);
            var cands = [[A, B], [A.slice().reverse(), B], [B.slice().reverse(), A]];
            for (var ci = 0; ci < cands.length && !fixed; ci++) {
              var esc = cands[ci][0], keep = cands[ci][1];
              if (rayBlocker(T, esc, occ) === -2) {
                var nid = snakes.length;
                snakes[pid] = keep; snakes.push(esc);
                for (var ec = 0; ec < esc.length; ec++) occ[esc[ec]] = nid;
                rest.push(nid); alive = rest; fixed = true;
              }
            }
          }
        }
        for (var t2 = 0; t2 < tryOrder.length && !fixed; t2++) {
          var sid = tryOrder[t2], sn = snakes[sid];
          if (sn.length < 3) continue;
          for (var e = 0; e < 2 && !fixed; e++) {
            if (e === 1) sn.reverse();
            var cut = sn.pop();
            occ[cut] = -1;
            if (rayBlocker(T, sn, occ) === -2) fixed = true;
            else { sn.push(cut); occ[cut] = sid; }
            if (!fixed && e === 1) sn.reverse();
          }
        }
        if (!fixed) {
          var shortest = rest[0];
          for (var r = 1; r < rest.length; r++) if (snakes[rest[r]].length < snakes[shortest].length) shortest = rest[r];
          var dead = snakes[shortest];
          for (var z = 0; z < dead.length; z++) occ[dead[z]] = -1;
          snakes[shortest] = null;
          alive = rest.filter(function (x) { return x !== shortest; });
        }
        continue;
      }
      if (firstFree < 0) firstFree = free.length;
      for (var f = 0; f < free.length; f++) {
        var fs = snakes[free[f]];
        for (var y = 0; y < fs.length; y++) occ[fs[y]] = -1;
      }
      alive = rest;
      layers++;
    }
    return { layers: layers, firstFree: firstFree };
  }

  var SHAPES = ["Cube", "Tower", "Slab", "Brick"];
  function shapeDims(name, n) {
    if (name === "Tower") return [n, Math.round(n * 1.6), n];
    if (name === "Slab") return [Math.round(n * 1.45), Math.max(2, Math.round(n * 0.45)), Math.round(n * 1.45)];
    if (name === "Brick") return [Math.round(n * 1.35), n, Math.max(2, Math.round(n * 0.75))];
    return [n, n, n];
  }

  function generate(tier, level, seedKey) {
    var p = TIERS[tier];
    var rng = mulberry32(hashStr(seedKey || ("outbound3d:v" + GEN_VERSION + ":" + tier + ":" + level)));
    var n = sizeFor(tier, level);
    var shape = level === 1 ? "Cube" : SHAPES[Math.floor(rng() * SHAPES.length)];
    var d = shapeDims(shape, n);
    var T = buildSurface(d[0], d[1], d[2]);
    var snakes = partition(T, p, rng);
    solve(T, snakes, true, rng);
    snakes = snakes.filter(function (s) { return s; });
    var score = solve(T, snakes, false, rng);
    function better(sc) { return sc && (sc.layers > score.layers || (sc.layers === score.layers && sc.firstFree <= score.firstFree)); }
    for (var i = 0; i < p.harden; i++) {
      var k = Math.floor(rng() * snakes.length);
      if (rng() < 0.55) {
        snakes[k].reverse();
        var sc = solve(T, snakes, false, rng);
        if (better(sc)) score = sc; else snakes[k].reverse();
      } else {
        var a = snakes[k];
        if (a.length >= p.mergeCap) continue;
        var occ = buildOcc(T, snakes), h = a[a.length - 1], d0 = Math.floor(rng() * 4);
        for (var dd = 0; dd < 4; dd++) {
          var nbc = T.nb[h * 4 + (d0 + dd) % 4], o = occ[nbc];
          if (o < 0 || o === k) continue;
          var b = snakes[o];
          if (a.length + b.length > p.mergeCap) continue;
          var bRev = b[0] !== nbc;
          if (bRev && b[b.length - 1] !== nbc) continue;
          var trial = snakes.slice();
          trial[k] = a.concat(bRev ? b.slice().reverse() : b);
          trial.splice(o, 1);
          var sc2 = solve(T, trial, false, rng);
          if (better(sc2) || (sc2 && sc2.layers >= score.layers - 1 && sc2.firstFree < score.firstFree)) { snakes = trial; score = sc2; }
          break;
        }
      }
    }
    return { kind: "surface", tier: tier, level: level, shape: shape, dims: d, T: T, snakes: snakes, layers: score.layers, firstFree: score.firstFree };
  }

  return { generate: generate, TIERS: TIERS, TIER_ORDER: TIER_ORDER, sizeFor: sizeFor, buildSurface: buildSurface, headDir: headDir, rayBlocker: rayBlocker, stepsToEdge: stepsToEdge, buildOcc: buildOcc, solve: solve };
})();


/* Outbound shapes — snakes on the surface of compound blocks with walls and curved sides.
   Surface cells are exposed unit faces of a voxel shape. Edge types between cells:
   0 flat, 1 sharp outside edge (an arrow leaves here), 2 curved edge (the lane carries on),
   3 inside corner (a wall: the lane is blocked for good). */
var OutboundShapes = (function () {
  var GEN_VERSION = 1;
  var E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  var TIERS = {
    "s-easy":   { name: "Easy",       base: 3, grow: 6, cap: 5,  minLen: 3, maxLen: 7,  lenBias: 1.0, straight: 0.5,  warn: 0.6,  harden: 300,  mergeCap: 9,  shapes: ["cubebar", "wave", "l", "box"] },
    "s-medium": { name: "Medium",     base: 4, grow: 5, cap: 7,  minLen: 4, maxLen: 12, lenBias: 0.9, straight: 0.5,  warn: 0.7,  harden: 800,  mergeCap: 16, shapes: ["cubebar", "wave", "l", "t", "steps", "loaf", "bent"] },
    "s-hard":   { name: "Hard",       base: 5, grow: 4, cap: 8,  minLen: 4, maxLen: 13, lenBias: 0.85, straight: 0.45, warn: 0.75, harden: 2000, mergeCap: 18, shapes: ["cubebar", "wave", "l", "t", "steps", "loaf", "bent", "arch", "cross"] },
    "s-extra":  { name: "Extra Hard", base: 6, grow: 4, cap: 10, minLen: 5, maxLen: 16, lenBias: 0.8, straight: 0.4,  warn: 0.8,  harden: 3000, mergeCap: 22, shapes: ["cubebar", "wave", "t", "steps", "loaf", "bent", "arch", "cross"] },
    "s-insane": { name: "Insane",     base: 8, grow: 4, cap: 12, minLen: 5, maxLen: 20, lenBias: 0.75, straight: 0.35, warn: 0.85, harden: 4000, mergeCap: 28, shapes: ["cubebar", "wave", "steps", "loaf", "bent", "arch", "cross"] }
  };
  var TIER_ORDER = ["s-easy", "s-medium", "s-hard", "s-extra", "s-insane"];
  var SHAPE_NAMES = { box: "Block", cubebar: "Cube and bar", wave: "Wave", l: "L-block", t: "T-block", steps: "Steps", loaf: "Loaf", bent: "Bent L", arch: "Arch", cross: "Cross" };

  function hashStr(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function sizeFor(tier, level) {
    var p = TIERS[tier];
    return Math.min(p.cap, p.base + Math.floor((level - 1) / p.grow));
  }
  function ri(x) { return Math.max(2, Math.round(x)); }

  // ---- shape templates: boxes [x0,y0,z0,x1,y1,z1] + rounded edges ----
  // round: { ax, i1, s1, i2, s2, c1, c2, lo, hi, R } — the edge between faces s1*e[i1] and s2*e[i2],
  // lying on planes coord[i1]=c1 and coord[i2]=c2, running along axis ax from lo to hi.
  function template(kind, n, rng) {
    var b = [], r = [];
    if (kind === "box") {
      var v = Math.floor(rng() * 3), d = v === 0 ? [n, n, n] : v === 1 ? [n, ri(n * 1.5), n] : [ri(n * 1.4), n, ri(n * 0.7)];
      b.push([0, 0, 0, d[0], d[1], d[2]]);
    } else if (kind === "cubebar") {
      var m = ri(n * 0.5), L = ri(n * 0.9), oy = Math.floor(rng() * (n - m + 1)), oz = Math.floor(rng() * (n - m + 1));
      b.push([0, 0, 0, n, n, n], [n, oy, oz, n + L, oy + m, oz + m]);
    } else if (kind === "wave") {
      var X = ri(n * 1.2), Y = n, Z = n, R = Math.max(2, n - 1);
      b.push([0, 0, 0, X, Y, Z]);
      r.push({ ax: 0, i1: 1, s1: 1, i2: 2, s2: 1, c1: Y, c2: Z, lo: 0, hi: X, R: R });
    } else if (kind === "loaf") {
      var X2 = ri(n * 1.3), Z2 = 2 * Math.max(2, Math.floor(n / 2)), Y2 = Math.max(Z2 / 2, n - 1), R2 = Z2 / 2;
      b.push([0, 0, 0, X2, Y2, Z2]);
      r.push({ ax: 0, i1: 1, s1: 1, i2: 2, s2: 1, c1: Y2, c2: Z2, lo: 0, hi: X2, R: R2 });
      r.push({ ax: 0, i1: 1, s1: 1, i2: 2, s2: -1, c1: Y2, c2: 0, lo: 0, hi: X2, R: R2 });
    } else if (kind === "l" || kind === "bent") {
      var t = ri(n * 0.6), a = ri(n * 1.5), h = ri(n * 1.4), dd = ri(n * 0.75);
      b.push([0, 0, 0, a, t, dd], [0, 0, 0, t, h, dd]);
      if (kind === "bent") r.push({ ax: 2, i1: 0, s1: -1, i2: 1, s2: -1, c1: 0, c2: 0, lo: 0, hi: dd, R: t });
    } else if (kind === "t") {
      var t2 = ri(n * 0.6), a2 = 2 * Math.floor(ri(n * 1.6) / 2) + (t2 % 2), h2 = ri(n * 1.4), d2 = ri(n * 0.75), s0 = (a2 - t2) / 2;
      b.push([0, h2 - t2, 0, a2, h2, d2], [s0, 0, 0, s0 + t2, h2, d2]);
    } else if (kind === "steps") {
      var s = ri(n * 0.55), d3 = ri(n * 0.8);
      b.push([0, 0, 0, 3 * s, s, d3], [s, s, 0, 3 * s, 2 * s, d3], [2 * s, 2 * s, 0, 3 * s, 3 * s, d3]);
    } else if (kind === "arch") {
      var t3 = ri(n * 0.45), w = Math.max(2 * t3 + 2, ri(n * 1.6)), h3 = ri(n * 1.1), d4 = ri(n * 0.7);
      b.push([0, 0, 0, t3, h3, d4], [w - t3, 0, 0, w, h3, d4], [0, h3, 0, w, h3 + t3, d4]);
    } else if (kind === "cross") {
      var a3 = ri(n * 0.5), d5 = ri(n * 0.7);
      b.push([0, a3, 0, 3 * a3, 2 * a3, d5], [a3, 0, 0, 2 * a3, 3 * a3, d5]);
    }
    return { boxes: b, rounds: r };
  }

  function buildSurface(tpl) {
    var boxes = tpl.boxes, rounds = tpl.rounds;
    var mx = [0, 0, 0];
    boxes.forEach(function (bx) { for (var a = 0; a < 3; a++) mx[a] = Math.max(mx[a], bx[a + 3]); });
    var GX = mx[0] + 2, GY = mx[1] + 2, GZ = mx[2] + 2;
    var fill = new Uint8Array(GX * GY * GZ);
    function vi(x, y, z) { return ((z + 1) * GY + (y + 1)) * GX + (x + 1); }
    function filled(x, y, z) { return x >= -1 && y >= -1 && z >= -1 && x <= mx[0] && y <= mx[1] && z <= mx[2] && fill[vi(x, y, z)] === 1; }
    boxes.forEach(function (bx) {
      for (var z = bx[2]; z < bx[5]; z++) for (var y = bx[1]; y < bx[4]; y++) for (var x = bx[0]; x < bx[3]; x++) fill[vi(x, y, z)] = 1;
    });
    // surface cells: voxel + outward normal (axis a, sign s) -> face code f = a*2 + (s>0?0:1)
    var ids = new Map(), vox = [], nrm = [];
    function key(x, y, z, f) { return ((vi(x, y, z)) * 6 + f); }
    for (var z = 0; z < mx[2]; z++) for (var y = 0; y < mx[1]; y++) for (var x = 0; x < mx[0]; x++) {
      if (!filled(x, y, z)) continue;
      for (var f = 0; f < 6; f++) {
        var a = f >> 1, sg = f & 1 ? -1 : 1, q = [x, y, z];
        q[a] += sg;
        if (filled(q[0], q[1], q[2])) continue;
        ids.set(key(x, y, z, f), vox.length / 3);
        vox.push(x, y, z);
        var nv = [0, 0, 0]; nv[a] = sg; nrm.push(nv[0], nv[1], nv[2]);
      }
    }
    var N = vox.length / 3;
    var cen = new Float32Array(N * 3), dir = new Int8Array(N * 12), nb = new Int32Array(N * 4), et = new Uint8Array(N * 4), nrmA = new Int8Array(nrm);
    function faceCode(n) { for (var a = 0; a < 3; a++) if (n[a]) return a * 2 + (n[a] > 0 ? 0 : 1); return 0; }
    function onRound(e, n, d) {
      for (var i = 0; i < rounds.length; i++) {
        var r = rounds[i], n1 = [0, 0, 0], n2 = [0, 0, 0];
        n1[r.i1] = r.s1; n2[r.i2] = r.s2;
        var match = (eq(n, n1) && eq(d, n2)) || (eq(n, n2) && eq(d, n1));
        if (!match) continue;
        if (Math.abs(e[r.i1] - r.c1) > 1e-6 || Math.abs(e[r.i2] - r.c2) > 1e-6) continue;
        if (e[r.ax] < r.lo - 1e-6 || e[r.ax] > r.hi + 1e-6) continue;
        return true;
      }
      return false;
    }
    for (var c = 0; c < N; c++) {
      var v = [vox[c * 3], vox[c * 3 + 1], vox[c * 3 + 2]], n = [nrm[c * 3], nrm[c * 3 + 1], nrm[c * 3 + 2]];
      var A = n[0] ? 0 : n[1] ? 1 : 2, B = (A + 1) % 3, C = (A + 2) % 3;
      for (var t = 0; t < 3; t++) cen[c * 3 + t] = v[t] + 0.5 + n[t] * 0.5;
      var dirs = [E[B], E[C], neg(E[B]), neg(E[C])];
      for (var k = 0; k < 4; k++) {
        var d = dirs[k];
        for (var t2 = 0; t2 < 3; t2++) dir[c * 12 + k * 3 + t2] = d[t2];
        var w1 = add(add(v, d), n), w2 = add(v, d), nid, ty;
        if (filled(w1[0], w1[1], w1[2])) { nid = ids.get(key(w1[0], w1[1], w1[2], faceCode(neg(d)))); ty = 3; }
        else if (filled(w2[0], w2[1], w2[2])) { nid = ids.get(key(w2[0], w2[1], w2[2], faceCode(n))); ty = 0; }
        else {
          nid = ids.get(key(v[0], v[1], v[2], faceCode(d)));
          var e = [0, 0, 0];
          for (var t3 = 0; t3 < 3; t3++) e[t3] = v[t3] + 0.5 + n[t3] * 0.5 + d[t3] * 0.5;
          ty = onRound(e, n, d) ? 2 : 1;
        }
        nb[c * 4 + k] = nid === undefined ? -1 : nid;
        et[c * 4 + k] = ty;
      }
    }
    var S = { N: N, cen: cen, nrm: nrmA, dir: dir, nb: nb, et: et, rounds: rounds, center: [mx[0] / 2, mx[1] / 2, mx[2] / 2], dims: mx.slice() };
    S.warp = rounds.length ? makeWarp(rounds) : null;
    return S;
  }
  function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function neg(a) { return [-a[0], -a[1], -a[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

  // Map flat-surface points onto the rounded edges. Returns [x,y,z,nx,ny,nz,inZone].
  function makeWarp(rounds) {
    var EPS = 1e-6, Q = Math.PI / 4;
    return function (px, py, pz, fx, fy, fz) {
      var p = [px, py, pz], fn = [fx, fy, fz];
      for (var i = 0; i < rounds.length; i++) {
        var r = rounds[i];
        if (p[r.ax] < r.lo - EPS || p[r.ax] > r.hi + EPS) continue;
        var u = (p[r.i1] - r.c1) * r.s1, w = (p[r.i2] - r.c2) * r.s2, R = r.R;
        if (u > EPS || w > EPS) continue;
        var x, y, side = false;
        if (fn[r.i1] === r.s1 && Math.abs(u) < EPS) { x = R; y = w + R; }
        else if (fn[r.i2] === r.s2 && Math.abs(w) < EPS) { y = R; x = u + R; }
        else if (fn[r.ax] !== 0 && (Math.abs(p[r.ax] - r.lo) < EPS || Math.abs(p[r.ax] - r.hi) < EPS)) { x = u + R; y = w + R; side = true; }
        else continue;
        if (x < -EPS || y < -EPS) continue;
        x = Math.max(0, x); y = Math.max(0, y);
        var m = Math.max(x, y), rho = m / R, th;
        if (m < EPS) th = Q; else th = x >= y ? (y / m) * Q : 2 * Q - (x / m) * Q;
        var cu = -R + rho * R * Math.cos(th), cw = -R + rho * R * Math.sin(th);
        var out = [p[0], p[1], p[2]];
        out[r.i1] = r.c1 + r.s1 * cu; out[r.i2] = r.c2 + r.s2 * cw;
        var nn = [fx, fy, fz];
        if (!side) { nn = [0, 0, 0]; nn[r.i1] = r.s1 * Math.cos(th); nn[r.i2] = r.s2 * Math.sin(th); }
        return [out[0], out[1], out[2], nn[0], nn[1], nn[2], 1];
      }
      return [px, py, pz, fx, fy, fz, 0];
    };
  }

  // ---- lanes ----
  function backIndex(S, c, from) {
    for (var j = 0; j < 4; j++) if (S.nb[c * 4 + j] === from) return j;
    return -1;
  }
  // Walk the lane in front of an arrow's head. Returns {cells, end: 'exit'|'wall'|'loop', exitFrom, exitK}
  function lane(S, s) {
    var h = s[s.length - 1], k = (backIndex(S, h, s[s.length - 2]) + 2) % 4, c = h, cells = [];
    for (var steps = 0; steps <= S.N; steps++) {
      var e = S.et[c * 4 + k], n2 = S.nb[c * 4 + k];
      if (e === 1) return { cells: cells, end: "exit", exitFrom: c, exitK: k };
      if (e === 3) return { cells: cells, end: "wall", exitFrom: c, exitK: k };
      var j = backIndex(S, n2, c);
      cells.push(n2); c = n2; k = (j + 2) % 4;
    }
    return { cells: cells, end: "loop", exitFrom: c, exitK: k };
  }
  // -2 free, -3 blocked for good (wall/loop), else the first arrow in the way
  function rayBlocker(S, s, occ, ln) {
    ln = ln || lane(S, s);
    for (var i = 0; i < ln.cells.length; i++) if (occ[ln.cells[i]] !== -1) return occ[ln.cells[i]];
    return ln.end === "exit" ? -2 : -3;
  }
  function buildOcc(S, snakes) {
    var occ = new Int32Array(S.N).fill(-1);
    for (var i = 0; i < snakes.length; i++) { var s = snakes[i]; if (!s) continue; for (var j = 0; j < s.length; j++) occ[s[j]] = i; }
    return occ;
  }

  function partition(S, p, rng) {
    var N = S.N, owner = new Int32Array(N).fill(-1), snakes = [];
    function emptyNbrs(c) { var out = []; for (var k = 0; k < 4; k++) { var n = S.nb[c * 4 + k]; if (n >= 0 && owner[n] === -1) out.push(n); } return out; }
    function step(cur, prev, id) {
      var cand = emptyNbrs(cur);
      if (!cand.length) return -1;
      if (prev !== -1) {
        var j = backIndex(S, cur, prev), straight = j >= 0 ? S.nb[cur * 4 + (j + 2) % 4] : -1;
        if (straight >= 0 && owner[straight] === -1 && rng() < p.straight) return straight;
      }
      if (rng() < p.warn) {
        var best = [], bestDeg = 9;
        for (var i = 0; i < cand.length; i++) {
          owner[cand[i]] = id;
          var deg = emptyNbrs(cand[i]).length;
          owner[cand[i]] = -1;
          if (deg < bestDeg) { bestDeg = deg; best = [cand[i]]; } else if (deg === bestDeg) best.push(cand[i]);
        }
        return best[Math.floor(rng() * best.length)];
      }
      return cand[Math.floor(rng() * cand.length)];
    }
    var order = shuffle(Array.from({ length: N }, function (_, i) { return i; }), rng);
    for (var oi = 0; oi < N; oi++) {
      var c = order[oi];
      if (owner[c] !== -1) continue;
      var id = snakes.length, target = p.minLen + Math.floor(Math.pow(rng(), p.lenBias) * (p.maxLen - p.minLen + 1));
      var path = [c]; owner[c] = id;
      while (path.length < target) { var n = step(path[path.length - 1], path.length > 1 ? path[path.length - 2] : -1, id); if (n < 0) break; owner[n] = id; path.push(n); }
      while (path.length < target) { var m = step(path[0], path.length > 1 ? path[1] : -1, id); if (m < 0) break; owner[m] = id; path.unshift(m); }
      if (path.length === 1) {
        owner[c] = -1;
        for (var k = 0; k < 4; k++) {
          var nbc = S.nb[c * 4 + k], o = nbc >= 0 ? owner[nbc] : -1;
          if (o < 0) continue;
          var sn = snakes[o];
          if (sn[sn.length - 1] === nbc) { sn.push(c); owner[c] = o; break; }
          if (sn[0] === nbc) { sn.unshift(c); owner[c] = o; break; }
        }
        continue;
      }
      snakes.push(path);
    }
    for (var q = 0; q < snakes.length; q++) if (rng() < 0.5) snakes[q].reverse();
    return snakes;
  }

  // Make the board solvable: reverse, split, trim, and as a last resort drop stuck arrows.
  function repair(S, snakes, rng) {
    var occ = buildOcc(S, snakes), alive = [];
    for (var i = 0; i < snakes.length; i++) if (snakes[i]) alive.push(i);
    while (alive.length) {
      var free = [], rest = [];
      for (var a = 0; a < alive.length; a++) { var id = alive[a]; if (rayBlocker(S, snakes[id], occ) === -2) free.push(id); else rest.push(id); }
      if (free.length) {
        for (var f = 0; f < free.length; f++) { var fs = snakes[free[f]]; for (var y = 0; y < fs.length; y++) occ[fs[y]] = -1; }
        alive = rest; continue;
      }
      var fixed = false, tryOrder = shuffle(rest.slice(), rng);
      for (var t = 0; t < tryOrder.length && !fixed; t++) {
        var s = snakes[tryOrder[t]]; s.reverse();
        if (rayBlocker(S, s, occ) === -2) fixed = true; else s.reverse();
      }
      for (var t3 = 0; t3 < tryOrder.length && !fixed; t3++) {
        var pid = tryOrder[t3], ps = snakes[pid], n = ps.length;
        if (n < 4) continue;
        var ks = []; for (var kk = 1; kk <= n - 3; kk++) ks.push(kk);
        shuffle(ks, rng);
        for (var ki = 0; ki < ks.length && !fixed; ki++) {
          var k = ks[ki], A = ps.slice(0, k + 1), B = ps.slice(k + 1);
          var cands = [[A, B], [A.slice().reverse(), B], [B.slice().reverse(), A]];
          for (var ci = 0; ci < cands.length && !fixed; ci++) {
            var esc = cands[ci][0], keep = cands[ci][1];
            if (rayBlocker(S, esc, occ) === -2) {
              var nid = snakes.length; snakes[pid] = keep; snakes.push(esc);
              for (var ec = 0; ec < esc.length; ec++) occ[esc[ec]] = nid;
              rest.push(nid); alive = rest; fixed = true;
            }
          }
        }
      }
      for (var t2 = 0; t2 < tryOrder.length && !fixed; t2++) {
        var sid = tryOrder[t2], sn = snakes[sid];
        if (sn.length < 3) continue;
        for (var e = 0; e < 2 && !fixed; e++) {
          if (e === 1) sn.reverse();
          var cut = sn.pop(); occ[cut] = -1;
          if (rayBlocker(S, sn, occ) === -2) fixed = true; else { sn.push(cut); occ[cut] = sid; }
          if (!fixed && e === 1) sn.reverse();
        }
      }
      if (!fixed) {
        var shortest = rest[0];
        for (var r = 1; r < rest.length; r++) if (snakes[rest[r]].length < snakes[shortest].length) shortest = rest[r];
        var dead = snakes[shortest];
        for (var z = 0; z < dead.length; z++) occ[dead[z]] = -1;
        snakes[shortest] = null;
        alive = rest.filter(function (x) { return x !== shortest; });
      }
    }
  }

  // Same dependency analysis as the flat v2 tiers, over surface lanes.
  function analyze(S, snakes) {
    var n = snakes.length, occ = buildOcc(S, snakes);
    var deps = [], start = new Int32Array(n + 1), nearEnd = new Int32Array(n);
    for (var i = 0; i < n; i++) {
      var ln = lane(S, snakes[i]);
      if (ln.end !== "exit") return null;
      var last = -1, ne = deps.length;
      for (var j = 0; j < ln.cells.length; j++) {
        var o = occ[ln.cells[j]];
        if (o === -1 || o === last) continue;
        if (o === i) return null;
        deps.push(o); last = o;
        if (j < 3) ne = deps.length;
      }
      nearEnd[i] = ne; start[i + 1] = deps.length;
    }
    var L = new Int32Array(n).fill(-1), st = new Uint8Array(n), cyc = false;
    function f(i) {
      if (st[i] === 2) return L[i];
      if (st[i] === 1) { cyc = true; return 0; }
      st[i] = 1;
      var m = -1;
      for (var j = start[i]; j < start[i + 1]; j++) { var v = f(deps[j]); if (cyc) return 0; if (v > m) m = v; }
      L[i] = m + 1; st[i] = 2; return L[i];
    }
    for (var q = 0; q < n; q++) { f(q); if (cyc) return null; }
    var layers = 0, firstFree = 0, trap = 0;
    for (var r = 0; r < n; r++) {
      if (L[r] + 1 > layers) layers = L[r] + 1;
      if (L[r] === 0) firstFree++;
      var A = -1;
      for (var k = start[r]; k < nearEnd[r]; k++) if (L[deps[k]] > A) A = L[deps[k]];
      if (L[r] - 1 - A > 0) trap += L[r] - 1 - A;
    }
    return { layers: layers, firstFree: firstFree, trap: trap, score: layers * 10 - firstFree * 8 + trap * 0.5 };
  }

  function generate(tier, level, seedKey) {
    var p = TIERS[tier];
    var rng = mulberry32(hashStr(seedKey || ("outbound-shapes:v" + GEN_VERSION + ":" + tier + ":" + level)));
    var n = sizeFor(tier, level);
    var kind = level === 1 && !seedKey ? "cubebar" : p.shapes[Math.floor(rng() * p.shapes.length)];
    var S = buildSurface(template(kind, n, rng));
    var snakes = partition(S, p, rng);
    repair(S, snakes, rng);
    snakes = snakes.filter(function (s) { return s; });
    var score = analyze(S, snakes);
    for (var i = 0; i < p.harden; i++) {
      var k = Math.floor(rng() * snakes.length);
      if (rng() < 0.55) {
        snakes[k].reverse();
        var sc = analyze(S, snakes);
        if (sc && sc.score >= score.score) score = sc; else snakes[k].reverse();
      } else {
        var a = snakes[k];
        if (a.length >= p.mergeCap) continue;
        var occ = buildOcc(S, snakes), h = a[a.length - 1], d0 = Math.floor(rng() * 4);
        for (var dd = 0; dd < 4; dd++) {
          var nbc = S.nb[h * 4 + (d0 + dd) % 4], o = nbc >= 0 ? occ[nbc] : -1;
          if (o < 0 || o === k) continue;
          var b = snakes[o];
          if (a.length + b.length > p.mergeCap) continue;
          var bRev = b[0] !== nbc;
          if (bRev && b[b.length - 1] !== nbc) continue;
          var trial = snakes.slice();
          trial[k] = a.concat(bRev ? b.slice().reverse() : b);
          trial.splice(o, 1);
          var sc2 = analyze(S, trial);
          if (sc2 && sc2.score >= score.score) { snakes = trial; score = sc2; }
          break;
        }
      }
    }
    var cells = 0; snakes.forEach(function (s) { cells += s.length; });
    return { kind: "shape", tier: tier, level: level, shape: kind, label: SHAPE_NAMES[kind], S: S, snakes: snakes, layers: score.layers, firstFree: score.firstFree, trap: score.trap, cells: cells };
  }

  return { generate: generate, TIERS: TIERS, TIER_ORDER: TIER_ORDER, sizeFor: sizeFor, buildSurface: buildSurface, template: template, lane: lane, rayBlocker: rayBlocker, buildOcc: buildOcc, analyze: analyze, SHAPE_NAMES: SHAPE_NAMES };
})();
