// Camper Crew: grey-box prototype.
//
// The camper sits still at the origin and the world moves around it, so the interior
// (where the game happens) never moves on screen. Inside the camper everything is plain 2D
// physics on the floor plane (x = forward, z = right), drawn with three.js boxes.
//
// Coordinates
//   road / world: 2D (u, v), heading counter-clockwise; three.js world: x = u, z = -v
//   camper frame: x forward (towards the windscreen), z to the right, y up
(function () {
  "use strict";

  var L = window.CamperLevels;
  var $ = function (id) { return document.getElementById(id); };
  var _t = I18n.t;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var DEG = Math.PI / 180;

  // ---------- Tuning ----------
  var T = {
    roadHalf: 5.5,      // half width of the tarmac
    offroad: 3.2,       // |offset| above this = wheels in the grass
    verge: 9,           // the camper can't drift further out than this
    walk: 4.3,          // player speed, units/s
    grip: 14,           // player acceleration response; puddles drop it
    slipGrip: 1.6,
    pushPlayer: 0.35,   // how much bends shove the player around
    pushItems: 1.4,     // and the loose items
    g: 10,              // for friction
    fall: 22,           // for things in the air
    fuelUse: 1.05,      // % per second at cruising speed
    fuelCan: 45,
    cookTime: 6,        // seconds raw -> cooked
    burnAt: 2.3,        // cook value (1 = done) at which it catches fire
    patchTime: 1.0,
    sprayTime: 1.3,
    feed: 22,           // mood for a meal
  };

  var PR = 0.33; // player radius
  var INNER = { x0: -4.85, x1: 4.85, z0: -2.15, z1: 2.15 };

  // ---------- Renderer, scene, camera ----------
  var canvas = $("scene");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new THREE.Scene();
  var DAY = new THREE.Color(0xa9c0d0), DUSK = new THREE.Color(0xd9936a), NIGHT = new THREE.Color(0x1c2133), RAINSKY = new THREE.Color(0x7d8894);
  scene.background = DAY.clone();
  scene.fog = new THREE.Fog(scene.background.getHex(), 40, 95);
  var camera = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
  var hemi = new THREE.HemisphereLight(0xffffff, 0x58614f, 0.75);
  var sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
  sunLight.position.set(-6, 14, 8);
  scene.add(hemi, sunLight);

  var world = new THREE.Group(); // road, trees, campsite: moved every frame
  world.matrixAutoUpdate = false;
  scene.add(world);
  var camper = new THREE.Group(); // fixed at the origin
  scene.add(camper);

  var ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x8a9a7b }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.46;
  scene.add(ground);

  var MAT = {};
  function mat(hex) { if (!MAT[hex]) MAT[hex] = new THREE.MeshLambertMaterial({ color: hex }); return MAT[hex]; }
  function box(w, h, d, hex) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex)); return m; }

  // ---------- Camper interior ----------
  // Every piece of furniture is an axis-aligned box on the floor (x0..x1, z0..z1, height h).
  // label: true gives it a floating name tag; the text is "st.<id>" in strings.js.
  var OB = [
    { id: "dash", x0: 4.4, x1: 5.0, z0: -2.3, z1: 2.3, h: 0.9, color: 0x5d636e },
    { id: "wheel", x0: 3.3, x1: 4.1, z0: -2.2, z1: -0.6, h: 0.55, color: 0x8d99ae, label: true },
    { id: "passenger", x0: 3.3, x1: 4.1, z0: 0.6, z1: 2.2, h: 0.55, color: 0x8d99ae },
    { id: "counter", x0: 0.2, x1: 1.5, z0: -2.3, z1: -1.4, h: 0.9, color: 0xbfc5cc, label: true },
    { id: "stove", x0: 1.5, x1: 2.6, z0: -2.3, z1: -1.4, h: 0.9, color: 0x9aa1a9, label: true },
    { id: "fridge", x0: -1.0, x1: 0.2, z0: -2.3, z1: -1.35, h: 1.7, color: 0xe5e7eb, label: true },
    { id: "fuel", x0: 0.7, x1: 1.4, z0: 1.95, z1: 2.3, h: 0.9, color: 0xc0504d, label: true },
    { id: "table", x0: -2.3, x1: -0.9, z0: 0.8, z1: 2.3, h: 0.75, color: 0xcdbf9f, label: true },
    { id: "crate", x0: -4.1, x1: -3.0, z0: 1.3, z1: 2.3, h: 0.6, color: 0x8a6d4b, label: true },
    { id: "shelf", x0: -5.0, x1: -4.35, z0: -1.6, z1: 1.2, h: 0.9, color: 0x6f6252, label: true },
    { id: "tools", x0: -4.1, x1: -3.0, z0: -2.3, z1: -1.4, h: 0.8, color: 0xbfc5cc, label: true },
  ];
  var OBI = {};
  OB.forEach(function (o) { OBI[o.id] = o; });

  (function buildCamper() {
    var floorM = box(10.4, 0.3, 5.0, 0xd5d8dc); floorM.position.y = -0.15; camper.add(floorM);
    var skirt = box(10.6, 0.3, 5.2, 0x3f444c); skirt.position.y = -0.4; camper.add(skirt);
    var wallC = 0xaeb4bb;
    var back = box(0.2, 1.1, 5.0, wallC); back.position.set(-5.1, 0.55, 0); camper.add(back);
    var left = box(10.4, 1.1, 0.2, wallC); left.position.set(0, 0.55, -2.4); camper.add(left);
    var right = box(10.4, 1.1, 0.2, wallC); right.position.set(0, 0.55, 2.4); camper.add(right);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 4.8), new THREE.MeshLambertMaterial({ color: 0xbfe0f0, transparent: true, opacity: 0.35 }));
    glass.position.set(5.15, 1.3, 0); glass.rotation.z = -0.35; camper.add(glass);
    [[-3.4, -2.55], [-3.4, 2.55], [3.2, -2.55], [3.2, 2.55]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 16), mat(0x24272c));
      w.rotation.x = Math.PI / 2; w.position.set(p[0], -0.35, p[1]); camper.add(w);
    });
    OB.forEach(function (o) {
      var m = box(o.x1 - o.x0, o.h, o.z1 - o.z0, o.color);
      m.position.set((o.x0 + o.x1) / 2, o.h / 2, (o.z0 + o.z1) / 2);
      camper.add(m);
      o.mesh = m;
    });
    // Stove burners, fridge handle, seat backs, steering wheel, fuel cap
    var burner = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), mat(0x2d3036));
    burner.position.set(2.05, 0.92, -1.85); camper.add(burner);
    var handle = box(0.06, 0.6, 0.06, 0x7c828c); handle.position.set(-0.4, 1.0, -1.32); camper.add(handle);
    [-1.4, 1.4].forEach(function (z) { var b = box(0.18, 1.0, 1.5, 0x77839a); b.position.set(3.3, 0.8, z); camper.add(b); });
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12), mat(0x2d3036));
    cap.rotation.x = Math.PI / 2; cap.position.set(1.05, 0.7, 1.93); camper.add(cap);
    // Passenger
    var pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.75, 12), mat(0x9b8fc4));
    pBody.position.set(3.7, 0.95, 1.4); camper.add(pBody);
    var pHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(0xe2c4a8));
    pHead.position.set(3.75, 1.5, 1.4); camper.add(pHead);
  })();

  var wheelMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 20), mat(0x2d3036));
  wheelMesh.position.set(4.25, 1.15, -1.4);
  wheelMesh.rotation.y = Math.PI / 2; wheelMesh.rotation.x = 0.0;
  var wheelPivot = new THREE.Group(); wheelPivot.add(wheelMesh); camper.add(wheelPivot);
  var wheelSpoke = box(0.04, 0.04, 0.6, 0x2d3036); wheelMesh.add(wheelSpoke); wheelSpoke.rotation.y = Math.PI / 2;

  // ---------- Player ----------
  var playerMesh = new THREE.Group();
  (function () {
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.9, 14), mat(0x4f7cac));
    body.position.y = 0.45;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(0xe9cfb5));
    head.position.y = 1.12;
    var nose = box(0.14, 0.14, 0.2, 0x3a5d85); nose.position.set(0.3, 0.75, 0); nose.scale.set(1, 1, 1);
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
    playerMesh.add(body, head, nose, shadow);
  })();
  camper.add(playerMesh);

  var pointer = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  pointer.rotation.x = Math.PI;
  camper.add(pointer);

  // ---------- Item meshes ----------
  var ITEM = {
    can: { r: 0.22, mu: 0.17, h: 0.45 },
    box: { r: 0.3, mu: 0.33, h: 0.45 },
    kit: { r: 0.24, mu: 0.3, h: 0.22 },
    ext: { r: 0.18, mu: 0.22, h: 0.5 },
    food: { r: 0.22, mu: 0.26, h: 0.18 },
  };
  function itemMesh(type) {
    var g = new THREE.Group();
    if (type === "can") {
      var c = box(0.3, 0.45, 0.22, 0xc0392b); c.position.y = 0.225; g.add(c);
      var spout = box(0.06, 0.12, 0.06, 0x2d3036); spout.position.set(0.09, 0.5, 0); g.add(spout);
    } else if (type === "box") {
      var b = box(0.55, 0.45, 0.5, 0xa47148); b.position.y = 0.225; g.add(b);
      var strap = box(0.57, 0.08, 0.52, 0x6a4a2f); strap.position.y = 0.25; g.add(strap);
    } else if (type === "kit") {
      var k = box(0.45, 0.22, 0.32, 0xe1b12c); k.position.y = 0.11; g.add(k);
      var cross = box(0.2, 0.01, 0.06, 0xffffff); cross.position.y = 0.225; g.add(cross);
    } else if (type === "ext") {
      var e = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12), mat(0xd63031)); e.position.y = 0.225; g.add(e);
      var top = box(0.08, 0.08, 0.2, 0x2d3036); top.position.y = 0.5; g.add(top);
    } else if (type === "food") {
      var plate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.05, 16), mat(0xf2f2f2)); plate.position.y = 0.025; g.add(plate);
      var blob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshLambertMaterial({ color: 0xf0a0a8 }));
      blob.scale.y = 0.6; blob.position.y = 0.11; g.add(blob);
      g.userData.blob = blob;
    }
    return g;
  }
  var RAW = new THREE.Color(0xf0a0a8), COOKED = new THREE.Color(0xb86a2c), BURNT = new THREE.Color(0x2a1d16);

  // ---------- Hazard meshes ----------
  var puddleMat = new THREE.MeshBasicMaterial({ color: 0x5b8fd9, transparent: true, opacity: 0.45 });
  var puddleGeo = new THREE.CircleGeometry(1, 24);
  var dripGeo = new THREE.SphereGeometry(0.06, 6, 4);
  var dripMat = new THREE.MeshBasicMaterial({ color: 0x8fb8ff });
  var fireGroup = new THREE.Group();
  (function () {
    var cols = [0xff5a1f, 0xffa41b, 0xffd23f];
    for (var i = 0; i < 5; i++) {
      var f = new THREE.Mesh(new THREE.ConeGeometry(0.16 + (i % 3) * 0.04, 0.6, 6), new THREE.MeshBasicMaterial({ color: cols[i % 3], transparent: true, opacity: 0.9 }));
      f.position.set(Math.cos(i * 1.3) * 0.2, 0.3, Math.sin(i * 1.3) * 0.2);
      fireGroup.add(f);
    }
    fireGroup.position.set(2.05, 0.92, -1.85);
    fireGroup.visible = false;
    camper.add(fireGroup);
  })();

  // Rain: a box of streaks around the camper, only shown in rain zones
  var RAIN_N = 260;
  var rainPos = new Float32Array(RAIN_N * 6);
  var rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  var rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.5 }));
  rainLines.frustumCulled = false;
  scene.add(rainLines);
  for (var ri = 0; ri < RAIN_N; ri++) resetDrop(ri, Math.random() * 12);
  function resetDrop(i, y) {
    var x = (Math.random() - 0.5) * 30, z = (Math.random() - 0.5) * 22;
    rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
    rainPos[i * 6 + 3] = x - 0.15; rainPos[i * 6 + 4] = y - 0.7; rainPos[i * 6 + 5] = z;
  }

  // ---------- Labels (HTML, anchored to points in the camper) ----------
  var labelsEl = $("labels");
  function makeLabel(cls, text) {
    var el = document.createElement("div");
    el.className = "lbl " + (cls || "");
    if (text) el.textContent = text;
    labelsEl.appendChild(el);
    return el;
  }
  var stationLabels = OB.filter(function (o) { return o.label; }).map(function (o) {
    return { el: makeLabel("", _t("st." + o.id)), x: (o.x0 + o.x1) / 2, y: o.h + 0.15, z: (o.z0 + o.z1) / 2, ob: o };
  });
  var tmpV = new THREE.Vector3();
  function project(x, y, z, el, dy) {
    tmpV.set(x, y, z).applyMatrix4(camper.matrixWorld).project(camera);
    var sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight + (dy || 0);
    el.style.transform = "translate(" + sx.toFixed(1) + "px," + sy.toFixed(1) + "px) translate(-50%,-100%)";
  }
  var stateLabels = {
    stove: makeLabel("state hidden"),
    passenger: makeLabel("state hidden"),
    wheel: makeLabel("state hidden"),
    fire: makeLabel("state hot hidden"),
  };
  var pops = [];
  function pop(text, x, z) {
    var el = makeLabel("pop", text);
    pops.push({ el: el, x: x, z: z, t: 0 });
  }

  // ---------- Game state ----------
  var save = loadSave();
  var level = null;
  var G = null; // per-run state
  var state = "menu";
  var items = [];
  var leaks = [];
  var menuRoad = Math.min(save.unlocked, save.last || 1);

  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem("camper-crew.v1"));
      if (s && typeof s.unlocked === "number") return s;
    } catch (e) { /* ignore */ }
    return { unlocked: 1, best: {}, last: 1 };
  }
  function writeSave() {
    try { localStorage.setItem("camper-crew.v1", JSON.stringify(save)); } catch (e) { /* ignore */ }
  }

  // ---------- World building ----------
  function disposeGroup(g) {
    g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    while (g.children.length) g.remove(g.children[0]);
  }

  function buildWorld() {
    disposeGroup(world);
    var lv = level;
    var n = lv.xs.length;
    // Road surface, edge lines and centre dashes as strips along the centre line
    function strip(off0, off1, y, hex, dash) {
      var pos = [], idx = [], k = 0;
      for (var i = 0; i < n; i += 2) {
        if (dash && Math.floor(i / 4) % 2 === 1) continue;
        var j = Math.min(n - 1, i + 2);
        for (var q = 0; q < 2; q++) {
          var a = q ? j : i;
          var x = lv.xs[a], yy = lv.ys[a], h = lv.hs[a];
          var nx = -Math.sin(h), ny = Math.cos(h);
          pos.push(x + nx * off0, y, -(yy + ny * off0), x + nx * off1, y, -(yy + ny * off1));
        }
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        k += 4;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide }));
      world.add(m);
    }
    strip(-T.roadHalf - 1.2, T.roadHalf + 1.2, -0.45, 0x9c9581); // gravel shoulder
    strip(-T.roadHalf, T.roadHalf, -0.44, 0x4a4d52);
    strip(T.roadHalf - 0.45, T.roadHalf - 0.25, -0.43, 0xe8e8e8);
    strip(-T.roadHalf + 0.25, -T.roadHalf + 0.45, -0.43, 0xe8e8e8);
    strip(-0.12, 0.12, -0.43, 0xe8e8e8, true);

    // Trees and rocks, kept clear of every part of the road
    var r = L.rng(lv.seed ^ 0x51ed);
    var trees = [], rocks = [];
    for (var s = 0; s < lv.length + 40; s += 4) {
      for (var side = -1; side <= 1; side += 2) {
        if (r() > 0.55) continue;
        var p = L.sample(lv, s);
        var off = side * (14 + r() * 30);
        var x = p.x - Math.sin(p.h) * off, y = p.y + Math.cos(p.h) * off;
        if (tooClose(x, y, s, 13)) continue;
        (r() < 0.8 ? trees : rocks).push([x, y, 0.7 + r() * 0.8, r() * 6.28]);
      }
    }
    function tooClose(x, y, s, d) {
      var i0 = Math.max(0, Math.floor((s - 120) / lv.step)), i1 = Math.min(n - 1, Math.floor((s + 120) / lv.step));
      for (var i = i0; i <= i1; i += 3) {
        var dx = lv.xs[i] - x, dy = lv.ys[i] - y;
        if (dx * dx + dy * dy < d * d) return true;
      }
      return false;
    }
    var m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    function instanced(geo, hex, list, yOff) {
      var im = new THREE.InstancedMesh(geo, mat(hex), list.length);
      list.forEach(function (t, i) {
        q4.setFromAxisAngle(up, t[3]); sc.set(t[2], t[2], t[2]); ps.set(t[0], yOff * t[2] - 0.45, -t[1]);
        m4.compose(ps, q4, sc); im.setMatrixAt(i, m4);
      });
      world.add(im);
    }
    instanced(new THREE.ConeGeometry(1.6, 4.5, 7), 0x55704f, trees, 2.25);
    instanced(new THREE.CylinderGeometry(0.25, 0.3, 1.2, 6), 0x6b5643, trees, 0.1);
    instanced(new THREE.DodecahedronGeometry(1.1, 0), 0x8d8f91, rocks, 0.4);

    // Campsite: a clearing with tents and a sign at the end of the road
    var end = L.sample(lv, lv.length);
    var camp = new THREE.Group();
    camp.position.set(end.x, -0.45, -end.y);
    camp.rotation.y = end.h;
    var clearing = new THREE.Mesh(new THREE.CircleGeometry(16, 28), mat(0xa5b38c));
    clearing.rotation.x = -Math.PI / 2; clearing.position.y = 0.005; camp.add(clearing);
    [[6, 10, 0xd96c4a], [12, -11, 0x4a8bd9], [18, 9, 0xe0b440]].forEach(function (t) {
      var tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 4), mat(t[2]));
      tent.position.set(t[0], 1.3, t[1]); tent.rotation.y = Math.PI / 4; camp.add(tent);
    });
    var post = box(0.25, 3, 0.25, 0x6b5643); post.position.set(0, 1.5, -8); camp.add(post);
    var sign = box(0.2, 1.2, 3.2, 0xf0e2c0); sign.position.set(0, 3, -8); camp.add(sign);
    world.add(camp);
  }

  // ---------- Stations ----------
  // A station is a piece of furniture with behaviour: it can give items, accept items,
  // or hold them on slots (counters, the stove, the luggage shelf).
  function slotList(pts, y) { return pts.map(function (p) { return { x: p[0], z: p[1], y: y, item: null }; }); }
  var ST = {};
  function defStation(id, def) { def.id = id; def.box = OBI[id]; ST[id] = def; return def; }
  function freeSlot(st) { if (!st.slots) return null; for (var i = 0; i < st.slots.length; i++) if (!st.slots[i].item) return st.slots[i]; return null; }
  function surface(id, pts) {
    return defStation(id, {
      slots: slotList(pts, OBI[id].h),
      accepts: function (it) { return !!freeSlot(this); },
      receive: function (it, x, z) { placeOn(this, it, x, z); },
    });
  }
  surface("counter", [[0.55, -1.85], [1.15, -1.85]]);
  surface("table", [[-1.95, 1.2], [-1.25, 1.2], [-1.95, 1.9], [-1.25, 1.9]]);
  surface("tools", [[-3.8, -1.85], [-3.3, -1.85]]);
  defStation("stove", {
    slots: slotList([[2.05, -1.85]], OBI.stove.h),
    accepts: function (it) { return it.type === "food" && !G.fire && !!freeSlot(this); },
    receive: function (it, x, z) { placeOn(this, it, x, z); },
  });
  defStation("shelf", {
    slots: slotList([[-4.67, -1.25], [-4.67, -0.55], [-4.67, 0.15], [-4.67, 0.85]], OBI.shelf.h),
    accepts: function (it) { return it.type === "box" && !!freeSlot(this); },
    receive: function (it, x, z) { placeOn(this, it, x, z); if (G.time > 1) pop(_t("pop.stowed"), it.x, it.z); },
  });
  defStation("fridge", { give: function () { return spawnItem("food", -0.4, -1.1); }, giveLabel: "food" });
  defStation("crate", { give: function () { return spawnItem("can", -3.5, 1.1); }, giveLabel: "can" });
  defStation("fuel", {
    aim: true,
    accepts: function (it) { return it.type === "can"; },
    receive: function (it) { removeItem(it); G.fuel = Math.min(100, G.fuel + T.fuelCan); pop(_t("pop.fuel"), 1.0, 1.8); Platform.haptic(15); },
  });
  defStation("passenger", {
    aim: true,
    accepts: function (it) { return it.type === "food" && it.cook >= 1 && it.cook < T.burnAt && G.hungry; },
    receive: function (it) {
      removeItem(it); G.hungry = false; G.waited = 0; G.mood = Math.min(100, G.mood + T.feed); G.fed++;
      pop(_t("pop.yum"), 3.7, 1.4); Platform.haptic(15);
    },
  });
  defStation("wheel", {});
  defStation("dash", {});
  ST.stove.aim = true; ST.shelf.aim = true;

  function placeOn(st, it, x, z) {
    // nearest free slot to where it landed
    var best = null, bd = 1e9;
    st.slots.forEach(function (s) {
      if (s.item) return;
      var d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d < bd) { bd = d; best = s; }
    });
    if (!best) return;
    best.item = it; it.state = "on"; it.slot = best; it.station = st;
    it.x = best.x; it.z = best.z; it.y = best.y; it.vx = it.vz = it.vy = 0;
  }
  function takeFrom(it) {
    if (it.slot) it.slot.item = null;
    it.slot = null; it.station = null;
  }

  // ---------- Items ----------
  function spawnItem(type, x, z) {
    var it = { type: type, x: x, z: z, y: 0, vx: 0, vz: 0, vy: 0, state: "floor", slot: null, station: null, cook: 0, r: ITEM[type].r, mu: ITEM[type].mu, mesh: itemMesh(type), spin: 0 };
    camper.add(it.mesh);
    items.push(it);
    return it;
  }
  function removeItem(it) {
    takeFrom(it);
    if (G.held === it) G.held = null;
    camper.remove(it.mesh);
    var i = items.indexOf(it);
    if (i >= 0) items.splice(i, 1);
  }

  // ---------- Start a road ----------
  function startRoad(n) {
    level = L.makeLevel(n);
    save.last = n; writeSave();
    items.slice().forEach(function (it) { camper.remove(it.mesh); });
    items = [];
    leaks.forEach(function (l) { camper.remove(l.puddle); l.drips.forEach(function (d) { camper.remove(d); }); });
    leaks = [];
    Object.keys(ST).forEach(function (k) { if (ST[k].slots) ST[k].slots.forEach(function (s) { s.item = null; }); });
    G = {
      n: n, s: 0, o: 0, e: 0, v: 0, time: 0, prevH: 0, yaw: 0, aLat: 0, aLong: 0,
      fuel: 70, mood: 80, fed: 0,
      hungry: false, waited: 0, hungerIdx: 0,
      fire: null, leakTimer: 2, bumpIdx: 0, rumble: 0, shake: 0, offroadTime: 0,
      wind: 0, windT: 0,
      seated: false, held: null,
      p: { x: 2.4, z: 0.2, vx: 0, vz: 0, fx: 1, fz: 0 },
      useHeld: false, work: null, done: false,
      rnd: L.rng(level.seed ^ 0x9e3779b9),
    };
    // Luggage on the shelf, tools on the tool counter
    ST.shelf.slots.forEach(function (s) { var b = spawnItem("box", s.x, s.z); placeOn(ST.shelf, b, s.x, s.z); });
    placeOn(ST.tools, spawnItem("kit", -3.8, -1.85), -3.8, -1.85);
    placeOn(ST.tools, spawnItem("ext", -3.3, -1.85), -3.3, -1.85);
    fireGroup.visible = false;
    buildWorld();
    // rain zones on the trip bar
    var track = $("track");
    Array.prototype.slice.call(track.querySelectorAll(".rain")).forEach(function (e) { e.remove(); });
    level.rain.forEach(function (z) {
      var d = document.createElement("div");
      d.className = "rain";
      d.style.left = (100 * z[0] / level.length) + "%";
      d.style.width = (100 * (z[1] - z[0]) / level.length) + "%";
      track.appendChild(d);
    });
    updateDrive(0);
    syncMeshes(0);
  }

  // ---------- Driving ----------
  function updateDrive(dt) {
    var lv = level;
    var road = L.sample(lv, G.s);
    var off = Math.abs(G.o) > T.offroad;
    var target = G.fuel > 0 ? (off ? 5 : lv.cruise) : 0;
    if (G.done) target = 0;
    var dv = target - G.v;
    var prevV = G.v;
    G.v += clamp(dv, -6 * dt, 3.5 * dt);

    // Steering: at the wheel the camper follows the road; alone it only has a weak
    // lane assist, which can't keep up in a bend.
    var yawCmd;
    if (G.seated) {
      var eWant = clamp(-0.12 * G.o, -0.35, 0.35);
      yawCmd = clamp(road.k * G.v + 2.6 * (eWant - G.e), -1.1, 1.1);
    } else {
      G.windT -= dt;
      if (G.windT <= 0) { G.windT = 2 + G.rnd() * 3; G.wind = (G.rnd() - 0.5) * 0.05; }
      var assist = clamp(-0.02 * G.o - 0.6 * G.e, -0.06, 0.06);
      yawCmd = assist + G.wind;
    }
    G.yawCmd = yawCmd;
    if (G.v > 0.01) G.e += (yawCmd - road.k * G.v * Math.cos(G.e)) * dt;
    G.e = clamp(G.e, -1.2, 1.2);
    G.o += G.v * Math.sin(G.e) * dt;
    G.s += G.v * Math.cos(G.e) * dt;
    if (Math.abs(G.o) > T.verge) {
      G.o = Math.sign(G.o) * T.verge;
      if (Math.sign(G.e) === Math.sign(G.o)) G.e *= Math.max(0, 1 - 5 * dt);
    }

    // Pose in the world
    road = L.sample(lv, G.s);
    var h = road.h + G.e;
    var x = road.x - Math.sin(road.h) * G.o, y = road.y + Math.cos(road.h) * G.o;
    G.pose = { x: x, y: y, h: h };
    if (dt > 0) {
      var yaw = (h - G.prevH) / dt;
      G.aLat += (G.v * yaw - G.aLat) * Math.min(1, 8 * dt);
      G.aLong += ((G.v - prevV) / dt - G.aLong) * Math.min(1, 8 * dt);
    }
    G.prevH = h;
    G.off = off;

    // Potholes, and the rumble of driving on the verge
    while (G.bumpIdx < lv.bumps.length && lv.bumps[G.bumpIdx] <= G.s) { bump(1); G.bumpIdx++; }
    if (off && G.v > 1) {
      G.rumble -= dt;
      G.offroadTime += dt;
      if (G.rumble <= 0) { G.rumble = 0.7; bump(0.35); }
    }
  }

  function bump(strength) {
    G.shake = Math.max(G.shake, 0.22 * strength);
    if (strength >= 1) Platform.haptic(25);
    items.forEach(function (it) {
      if (it.state === "floor") { it.state = "air"; it.vy = (2.2 + G.rnd() * 1.8) * strength; it.vx += (G.rnd() - 0.5) * strength; it.vz += (G.rnd() - 0.5) * strength; }
    });
    var fell = 0;
    ST.shelf.slots.forEach(function (s) {
      if (!s.item) return;
      if (G.rnd() < 0.45 * strength || (strength >= 1 && fell === 0 && G.rnd() < 0.5)) {
        var it = s.item;
        takeFrom(it);
        it.state = "air"; it.x = -4.2; it.y = 0.95;
        it.vx = 1.5 + G.rnd() * 1.8; it.vz = (G.rnd() - 0.5) * 2; it.vy = 2.5;
        fell++;
      }
    });
  }

  // ---------- Collision helpers ----------
  function insideBox(o, x, z, r) { return x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r; }
  function pushOut(b, r, bounce) {
    // walls
    if (b.x < INNER.x0 + r) { b.x = INNER.x0 + r; if (b.vx < 0) b.vx *= -bounce; }
    if (b.x > INNER.x1 + 0.3 - r) { b.x = INNER.x1 + 0.3 - r; if (b.vx > 0) b.vx *= -bounce; }
    if (b.z < INNER.z0 + r) { b.z = INNER.z0 + r; if (b.vz < 0) b.vz *= -bounce; }
    if (b.z > INNER.z1 - r) { b.z = INNER.z1 - r; if (b.vz > 0) b.vz *= -bounce; }
    for (var i = 0; i < OB.length; i++) {
      var o = OB[i];
      if (b.y !== undefined && b.y > o.h) continue;
      var cx = clamp(b.x, o.x0, o.x1), cz = clamp(b.z, o.z0, o.z1);
      var dx = b.x - cx, dz = b.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        var d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
        b.x = cx + nx * r; b.z = cz + nz * r;
        var vn = b.vx * nx + b.vz * nz;
        if (vn < 0) { b.vx -= (1 + bounce) * vn * nx; b.vz -= (1 + bounce) * vn * nz; }
      } else {
        // centre inside the box: leave by the shortest side
        var pen = [b.x - o.x0 + r, o.x1 - b.x + r, b.z - o.z0 + r, o.z1 - b.z + r];
        var m = pen.indexOf(Math.min.apply(null, pen));
        if (m === 0) { b.x = o.x0 - r; b.vx = -Math.abs(b.vx) * bounce; }
        else if (m === 1) { b.x = o.x1 + r; b.vx = Math.abs(b.vx) * bounce; }
        else if (m === 2) { b.z = o.z0 - r; b.vz = -Math.abs(b.vz) * bounce; }
        else { b.z = o.z1 + r; b.vz = Math.abs(b.vz) * bounce; }
      }
    }
  }
  function boxAt(x, z) {
    for (var i = 0; i < OB.length; i++) if (insideBox(OB[i], x, z, 0)) return OB[i];
    return null;
  }

  // ---------- Player ----------
  var input = { mx: 0, mz: 0, grab: false, use: false, grabEdge: false, useEdge: false };

  function updatePlayer(dt) {
    var P = G.p;
    var mag = Math.hypot(input.mx, input.mz);
    if (G.seated) {
      if (mag > 0.55) { G.seated = false; P.x = 2.85; P.z = -1.2; }
      else { P.x = 3.7; P.z = -1.4; P.fx = 1; P.fz = 0; P.vx = P.vz = 0; return; }
    }
    var slip = false;
    leaks.forEach(function (l) { if (Math.hypot(P.x - l.x, P.z - l.z) < l.size * 0.95) slip = true; });
    G.slip = slip;
    var grip = slip ? T.slipGrip : T.grip;
    var tx = input.mx * T.walk, tz = input.mz * T.walk;
    var k = Math.min(1, grip * dt);
    P.vx += (tx - P.vx) * k + (-G.aLong * 0.5) * T.pushPlayer * dt;
    P.vz += (tz - P.vz) * k + G.aLat * T.pushPlayer * dt;
    P.x += P.vx * dt; P.z += P.vz * dt;
    if (mag > 0.2) { P.fx = input.mx / mag; P.fz = input.mz / mag; }
    pushOut(P, PR, slip ? 0.5 : 0);
    // shove loose items out of the way
    items.forEach(function (it) {
      if (it.state !== "floor") return;
      var dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz), m = PR + it.r;
      if (d < m && d > 1e-4) {
        it.x = P.x + dx / d * m; it.z = P.z + dz / d * m;
        it.vx += P.vx * 0.6; it.vz += P.vz * 0.6;
      }
    });
  }

  // Which thing would Grab act on? Returns {kind:'item'|'give'|'put'|'drop', ...}
  function reachBox(o) {
    var P = G.p;
    var cx = clamp(P.x, o.x0, o.x1), cz = clamp(P.z, o.z0, o.z1);
    var dx = cx - P.x, dz = cz - P.z, d = Math.hypot(dx, dz);
    var dot = d < 1e-4 ? 1 : (dx * P.fx + dz * P.fz) / d;
    return { d: d - PR, dot: dot };
  }
  function grabTarget() {
    var P = G.p, best = null, bs = 1e9;
    function consider(score, t) { if (score < bs) { bs = score; best = t; } }
    if (G.held) {
      Object.keys(ST).forEach(function (k) {
        var st = ST[k];
        if (!st.accepts || !st.accepts(G.held)) return;
        var r = reachBox(st.box);
        if (r.d <= 0.75 && (r.dot > 0.1 || r.d < 0.3)) consider(r.d - r.dot * 0.3, { kind: "put", st: st });
      });
      return best || { kind: "drop" };
    }
    items.forEach(function (it) {
      if (it.state !== "floor" && it.state !== "on") return;
      var dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz) - PR - it.r * 0.5;
      var dot = (dx * P.fx + dz * P.fz) / Math.max(1e-4, Math.hypot(dx, dz));
      var reach = it.state === "on" ? 0.95 : 0.85;
      if (d <= reach && (dot > -0.2 || d < 0.2)) consider(d - dot * 0.35 - (it.state === "floor" ? 0.05 : 0), { kind: "item", it: it });
    });
    Object.keys(ST).forEach(function (k) {
      var st = ST[k];
      if (!st.give) return;
      var r = reachBox(st.box);
      if (r.d <= 0.75 && (r.dot > 0.1 || r.d < 0.3)) consider(r.d - r.dot * 0.3 + 0.1, { kind: "give", st: st });
    });
    return best;
  }

  // Which thing would Use act on?
  function useTarget() {
    var P = G.p;
    if (G.seated) return { kind: "stand" };
    if (G.held && G.held.type === "kit") {
      var lk = null, ld = 1e9;
      leaks.forEach(function (l) { if (!l.active) return; var d = Math.hypot(l.x - P.x, l.z - P.z); if (d < 1.4 && d < ld) { ld = d; lk = l; } });
      if (lk) return { kind: "patch", leak: lk };
    }
    if (G.held && G.held.type === "ext" && G.fire) {
      if (reachBox(OBI.stove).d < 1.3) return { kind: "spray" };
    }
    var w = reachBox(OBI.wheel);
    if (w.d < 0.6) return { kind: "sit" };
    if (G.held) return { kind: "throw", target: throwTarget() };
    return null;
  }

  function throwTarget() {
    var P = G.p, it = G.held, best = null, bs = 1e9;
    Object.keys(ST).forEach(function (k) {
      var st = ST[k];
      if (!st.aim || !st.accepts(it)) return;
      var o = st.box, tx, tz;
      var free = st.slots && freeSlot(st);
      if (free) { tx = free.x; tz = free.z; } else { tx = (o.x0 + o.x1) / 2; tz = clamp(P.z, o.z0 + 0.15, o.z1 - 0.15); }
      if (k === "passenger") { tx = 3.7; tz = 1.4; }
      if (k === "fuel") { tx = 1.05; tz = 2.1; }
      var dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz);
      if (d > 9 || d < 0.2) return;
      var dot = (dx * P.fx + dz * P.fz) / d;
      if (dot < 0.35) return;
      var score = d * (1.6 - dot);
      if (score < bs) { bs = score; best = { st: st, x: tx, z: tz, y: o.h }; }
    });
    return best;
  }

  function doGrab() {
    if (G.seated) { G.seated = false; G.p.x = 2.85; G.p.z = -1.2; return; }
    var t = grabTarget();
    if (!t) return;
    if (t.kind === "item") { takeFrom(t.it); t.it.state = "held"; G.held = t.it; Platform.haptic(8); }
    else if (t.kind === "give") { var it = t.st.give(); takeFrom(it); it.state = "held"; G.held = it; Platform.haptic(8); }
    else if (t.kind === "put") { var h = G.held; G.held = null; h.state = "air"; t.st.receive(h, G.p.x + G.p.fx * 0.6, G.p.z + G.p.fz * 0.6); if (h.state === "air") h.state = "floor"; }
    else if (t.kind === "drop") {
      var d = G.held; G.held = null;
      d.state = "floor"; d.x = G.p.x + G.p.fx * (PR + d.r + 0.05); d.z = G.p.z + G.p.fz * (PR + d.r + 0.05); d.y = 0;
      d.vx = G.p.vx * 0.5; d.vz = G.p.vz * 0.5;
      pushOut(d, d.r, 0.2);
    }
  }

  function doUsePress() {
    var t = useTarget();
    if (!t) return;
    if (t.kind === "stand") { G.seated = false; G.p.x = 2.85; G.p.z = -1.2; }
    else if (t.kind === "sit") { G.seated = true; Platform.haptic(10); }
    else if (t.kind === "throw") throwHeld(t.target);
  }

  function throwHeld(tg) {
    var it = G.held, P = G.p;
    G.held = null;
    it.state = "air";
    it.x = P.x + P.fx * 0.3; it.z = P.z + P.fz * 0.3; it.y = 1.35;
    if (tg) {
      var dx = tg.x - it.x, dz = tg.z - it.z, d = Math.hypot(dx, dz);
      var t = clamp(d / 9, 0.3, 0.75);
      it.vx = dx / t; it.vz = dz / t;
      it.vy = (tg.y - 0.15 - it.y) / t + 0.5 * T.fall * t;
    } else {
      it.vx = P.fx * 7; it.vz = P.fz * 7; it.vy = 4;
    }
    it.spin = 8;
    Platform.haptic(8);
  }

  // ---------- Items: physics ----------
  function updateItems(dt) {
    var fx = -G.aLong * T.pushItems, fz = G.aLat * T.pushItems;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (it.state === "held") {
        it.x = G.p.x; it.z = G.p.z; it.y = 1.42;
        continue;
      }
      if (it.state === "on") continue;
      if (it.state === "air") {
        it.vy -= T.fall * dt;
        it.x += it.vx * dt; it.z += it.vz * dt; it.y += it.vy * dt;
        // a station that wants this item takes it on contact (generous on purpose)
        var taker = null;
        for (var si = 0; si < OB.length && !taker; si++) {
          var so = OB[si], sst = ST[so.id];
          if (sst && sst.accepts && it.y < so.h + 0.05 && insideBox(so, it.x, it.z, it.r) && sst.accepts(it)) taker = sst;
        }
        if (taker) { taker.receive(it, it.x, it.z); if (it.state === "air") it.state = "floor"; continue; }
        // walls
        var b = { x: it.x, z: it.z, vx: it.vx, vz: it.vz };
        if (it.x < INNER.x0 + it.r || it.x > INNER.x1 + 0.3 - it.r || it.z < INNER.z0 + it.r || it.z > INNER.z1 - it.r) {
          pushOut(Object.assign(b, { y: 99 }), it.r, 0.3);
          it.x = b.x; it.z = b.z; it.vx = b.vx; it.vz = b.vz;
        }
        // furniture that doesn't want it: bounce off
        var o = boxAt(it.x, it.z);
        if (o && it.y < o.h + 0.05) {
          if (it.vy < 0 && it.y > o.h - 0.25) {
            // landed on top of something that doesn't want it: slide off
            it.vy = 1.2;
          }
          b = { x: it.x, z: it.z, vx: it.vx, vz: it.vz, y: 0 };
          pushOut(b, it.r, 0.3);
          it.x = b.x; it.z = b.z; it.vx = b.vx; it.vz = b.vz;
        }
        // catch: a thrown or falling item flying into empty hands
        if (!G.held && !G.seated && it.spin > 0 && it.vy < 2 && it.y > 0.6 && it.y < 1.9 && Math.hypot(it.x - G.p.x, it.z - G.p.z) < 0.45 && it.flightT > 0.25) {
          it.state = "held"; G.held = it; it.spin = 0; Platform.haptic(10);
          continue;
        }
        it.flightT = (it.flightT || 0) + dt;
        if (it.y <= 0) {
          it.y = 0; it.vy = 0; it.vx *= 0.5; it.vz *= 0.5; it.state = "floor"; it.spin = 0; it.flightT = 0;
        }
        continue;
      }
      // floor: sliding with the camper's swings, plus friction
      it.vx += fx * dt; it.vz += fz * dt;
      var sp = Math.hypot(it.vx, it.vz), fr = it.mu * T.g * dt;
      if (sp <= fr) { it.vx = it.vz = 0; } else { it.vx *= (sp - fr) / sp; it.vz *= (sp - fr) / sp; }
      it.x += it.vx * dt; it.z += it.vz * dt;
      var fb = { x: it.x, z: it.z, vx: it.vx, vz: it.vz, y: 0 };
      pushOut(fb, it.r, 0.35);
      it.x = fb.x; it.z = fb.z; it.vx = fb.vx; it.vz = fb.vz;
    }
    // loose items don't overlap each other
    for (var a = 0; a < items.length; a++) {
      var A = items[a];
      if (A.state !== "floor") continue;
      for (var c = a + 1; c < items.length; c++) {
        var C = items[c];
        if (C.state !== "floor") continue;
        var dx = C.x - A.x, dz = C.z - A.z, d = Math.hypot(dx, dz), m = A.r + C.r;
        if (d < m && d > 1e-4) {
          var p = (m - d) / 2, nx = dx / d, nz = dz / d;
          A.x -= nx * p; A.z -= nz * p; C.x += nx * p; C.z += nz * p;
        }
      }
    }
  }

  // ---------- Hazards, hunger, mood ----------
  var LEAK_SPOTS = [[2.6, 0.1], [1.0, 1.1], [-0.4, -0.5], [-2.6, -0.4], [-3.5, 0.5], [0.5, 0.2], [2.4, 1.4], [-1.6, -0.1], [1.9, -0.9], [-2.9, 0.9]];

  function updateHazards(dt) {
    var raining = L.inRain(level, G.s);
    G.raining = raining;
    if (raining) {
      G.leakTimer -= dt;
      var active = leaks.filter(function (l) { return l.active; }).length;
      if (G.leakTimer <= 0 && active < 3) {
        G.leakTimer = 6 + G.rnd() * 6;
        var free = LEAK_SPOTS.filter(function (p) { return !leaks.some(function (l) { return Math.hypot(l.x - p[0], l.z - p[1]) < 1.6; }); });
        if (free.length) {
          var p = free[Math.floor(G.rnd() * free.length)];
          var pd = new THREE.Mesh(puddleGeo, puddleMat); pd.rotation.x = -Math.PI / 2; pd.position.set(p[0], 0.012, p[1]); pd.scale.setScalar(0.01);
          camper.add(pd);
          var drips = [0, 1, 2].map(function (i) { var d = new THREE.Mesh(dripGeo, dripMat); d.position.set(p[0], 2.6 - i * 0.9, p[1]); camper.add(d); return d; });
          leaks.push({ x: p[0], z: p[1], size: 0.2, prog: 0, active: true, puddle: pd, drips: drips, label: makeLabel("state hot") });
        }
      }
    } else {
      G.leakTimer = Math.min(G.leakTimer, 2);
    }
    for (var i = leaks.length - 1; i >= 0; i--) {
      var l = leaks[i];
      if (l.active) l.size = Math.min(1.2, l.size + 0.09 * dt);
      else l.size -= 0.12 * dt;
      if (l.size <= 0.05) {
        camper.remove(l.puddle); l.drips.forEach(function (d) { camper.remove(d); }); l.label.remove();
        leaks.splice(i, 1);
      }
    }

    // Stove
    var pan = ST.stove.slots[0].item;
    if (pan && !G.fire) {
      pan.cook += dt / T.cookTime;
      if (pan.cook >= T.burnAt) {
        removeItem(pan);
        G.fire = { prog: 0 };
        Platform.haptic(40);
      }
    }
    fireGroup.visible = !!G.fire;

    // Hunger
    var hs = level.hunger;
    while (G.hungerIdx < hs.length && hs[G.hungerIdx] <= G.time) {
      if (!G.hungry) { G.hungry = true; G.waited = 0; }
      G.hungerIdx++;
    }
    if (G.hungry) G.waited += dt;

    // Mood
    var drain = 0;
    if (G.hungry) drain += G.waited < 15 ? 0.3 : 0.9;
    leaks.forEach(function (l) { if (l.active) drain += 0.5; });
    items.forEach(function (it) { if (it.type === "box" && it.state === "floor") drain += 0.12; });
    if (G.fire) drain += 2.5;
    if (G.off && G.v > 1) drain += 1.2;
    if (G.fuel <= 0) drain += 0.6;
    G.mood = clamp(G.mood - drain * dt + (drain === 0 ? 0.25 * dt : 0), 0, 100);

    // Fuel
    G.fuel = Math.max(0, G.fuel - T.fuelUse * (G.v / level.cruise) * dt);
  }

  // Holding Use: patching a leak or spraying a fire
  function updateWork(dt) {
    G.work = null;
    if (!input.use || G.seated) return;
    var t = useTarget();
    if (!t) return;
    if (t.kind === "patch") {
      t.leak.prog += dt / T.patchTime;
      G.work = t;
      if (t.leak.prog >= 1) { t.leak.active = false; t.leak.label.classList.add("hidden"); pop(_t("pop.patched"), t.leak.x, t.leak.z); Platform.haptic(15); }
    } else if (t.kind === "spray") {
      G.fire.prog += dt / T.sprayTime;
      G.work = t;
      if (G.fire.prog >= 1) { G.fire = null; pop(_t("pop.fireOut"), 2.05, -1.85); Platform.haptic(15); }
    }
  }

  // ---------- Step ----------
  function step(dt) {
    if (input.grabEdge) doGrab();
    if (input.useEdge) doUsePress();
    input.grabEdge = input.useEdge = false;

    G.time += dt;
    updateDrive(dt);
    updatePlayer(dt);
    updateWork(dt);
    updateItems(dt);
    updateHazards(dt);

    if (!G.done && G.s >= level.length) finish(true);
    else if (!G.done && G.time >= level.sunset) finish(false);
  }

  // ---------- Drawing ----------
  var camPose = new THREE.Object3D();
  var lastAlerts = "";
  var spinT = 0;

  function syncMeshes(dt) {
    spinT += dt;
    // world moves so that the camper stays at the origin
    var pose = G.pose;
    camPose.position.set(pose.x, 0, -pose.y);
    camPose.rotation.set(0, pose.h, 0);
    camPose.updateMatrix();
    world.matrix.copy(camPose.matrix).invert();
    world.matrixWorldNeedsUpdate = true;
    // slight body roll in bends
    camper.rotation.x = clamp(-G.aLat * 0.006, -0.04, 0.04);

    var P = G.p;
    playerMesh.position.set(P.x, G.seated ? 0.25 : 0, P.z);
    playerMesh.rotation.y = Math.atan2(-P.fz, P.fx);
    wheelMesh.rotation.x = clamp((G.yawCmd || 0) * 2.5, -1.5, 1.5);

    items.forEach(function (it) {
      it.mesh.position.set(it.x, it.y, it.z);
      if (it.state === "air" && it.spin) it.mesh.rotation.y += it.spin * dt;
      if (it.type === "food") {
        var c = it.cook;
        it.mesh.userData.blob.material.color.copy(c < 1 ? RAW.clone().lerp(COOKED, c) : COOKED.clone().lerp(BURNT, clamp((c - 1) / (T.burnAt - 1), 0, 1)));
      }
    });

    leaks.forEach(function (l) {
      l.puddle.scale.setScalar(Math.max(0.01, l.size));
      l.drips.forEach(function (d, i) {
        d.visible = l.active;
        d.position.y = 2.6 - ((spinT * 3 + i * 0.9) % 2.6);
      });
    });
    if (G.fire) fireGroup.children.forEach(function (f, i) { f.scale.y = 0.7 + 0.5 * Math.abs(Math.sin(spinT * 9 + i * 2)); });

    // Target pointer above whatever Grab/Use would act on
    var tgt = null;
    if (state === "play" && !G.seated) {
      var u = useTarget(), g = grabTarget();
      if (u && u.kind === "patch") tgt = [u.leak.x, 0.6, u.leak.z];
      else if (u && u.kind === "spray") tgt = [2.05, 1.6, -1.85];
      else if (u && u.kind === "throw" && u.target) tgt = [u.target.x, u.target.y + 0.9, u.target.z];
      else if (g && g.kind === "item") tgt = [g.it.x, g.it.y + 0.9, g.it.z];
      else if (g && (g.kind === "give" || g.kind === "put")) { var o = g.st.box; tgt = [(o.x0 + o.x1) / 2, o.h + 0.7, (o.z0 + o.z1) / 2]; }
      else if (u && u.kind === "sit") tgt = [3.7, 1.3, -1.4];
      setButtons(g, u);
    } else if (state === "play") setButtons(null, { kind: "stand" });
    pointer.visible = !!tgt;
    if (tgt) pointer.position.set(tgt[0], tgt[1] + Math.sin(spinT * 6) * 0.08, tgt[2]);

    // Sky: day, dusk, night; greyer in the rain
    var f = G.time / level.sunset;
    var sky = f < 0.7 ? DAY.clone() : f < 0.92 ? DAY.clone().lerp(DUSK, (f - 0.7) / 0.22) : DUSK.clone().lerp(NIGHT, clamp((f - 0.92) / 0.08, 0, 1));
    if (G.raining) sky.lerp(RAINSKY, 0.55);
    scene.background.lerp(sky, Math.min(1, dt * 2 + (dt === 0 ? 1 : 0)));
    scene.fog.color.copy(scene.background);
    var light = f < 0.85 ? 1 : 1 - 0.55 * clamp((f - 0.85) / 0.15, 0, 1);
    hemi.intensity = 0.75 * light; sunLight.intensity = 0.6 * light * (G.raining ? 0.5 : 1);

    // Rain streaks
    rainLines.visible = !!G.raining;
    if (G.raining) {
      for (var i = 0; i < RAIN_N; i++) {
        var y = rainPos[i * 6 + 1] - 18 * dt;
        if (y < -0.4) resetDrop(i, 9 + Math.random() * 3);
        else { rainPos[i * 6 + 1] = y; rainPos[i * 6 + 4] = y - 0.7; }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // Camera (with shake)
    G.shake = Math.max(0, G.shake - dt * 0.8);
    placeCamera();
    if (G.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake));
  }

  var portrait = false;
  function placeCamera() {
    var w = innerWidth, h = innerHeight, asp = w / h;
    portrait = asp < 0.9;
    camera.aspect = asp;
    var tilt = 60 * DEG, half = camera.fov * DEG / 2;
    var Wd = portrait ? 3.2 : 7.0, Hd = portrait ? 7.2 : 4.7;
    var dist = Math.max(Hd * Math.sin(tilt) / Math.tan(half), Wd / (Math.tan(half) * asp)) * 1.08;
    var target = portrait ? new THREE.Vector3(-0.6, 0, 0) : new THREE.Vector3(0, 0, -0.25);
    var dir = portrait ? new THREE.Vector3(-Math.cos(tilt), Math.sin(tilt), 0) : new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt));
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function fmtTime(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }

  function drawHud() {
    $("marker").style.left = (100 * clamp(G.s / level.length, 0, 1)) + "%";
    $("fuelBar").style.width = G.fuel + "%";
    $("moodBar").style.width = G.mood + "%";
    $("fuelBar").parentNode.parentNode.classList.toggle("low", G.fuel < 20);
    $("moodBar").parentNode.parentNode.classList.toggle("low", G.mood < 35);
    var left = level.sunset - G.time;
    var sun = $("sun");
    sun.textContent = fmtTime(left);
    sun.classList.toggle("late", left < 40 && left >= 15);
    sun.classList.toggle("very-late", left < 15);

    // Alerts, most urgent first
    var a = [];
    var bend = L.nextBend(level, G.s, G.v * 4.5 + 12);
    if (!G.seated && G.off) a.push([_t("alert.offRoad"), true]);
    else if (!G.seated && bend) a.push([_t(bend.inside ? "alert.bendIn" : "alert.bendAhead", { dir: _t(bend.dir > 0 ? "dir.left" : "dir.right") }), true]);
    if (G.fire) a.push([_t("alert.fire"), true]);
    if (G.fuel <= 0) a.push([_t("alert.noFuel"), true]);
    else if (G.fuel < 20) a.push([_t("alert.lowFuel"), false]);
    if (G.hungry && G.waited > 4) a.push([_t("alert.hungry"), G.waited > 15]);
    if (leaks.some(function (l) { return l.active; })) a.push([_t("alert.leak"), false]);
    var floorBoxes = items.filter(function (it) { return it.type === "box" && it.state === "floor"; }).length;
    if (floorBoxes >= 2) a.push([_t("alert.luggage"), false]);
    a = a.slice(0, 2);
    var key = a.map(function (x) { return x[0] + x[1]; }).join("|");
    if (key !== lastAlerts) {
      lastAlerts = key;
      $("alerts").innerHTML = "";
      a.forEach(function (x) { var d = document.createElement("div"); d.className = "alert" + (x[1] ? " hot" : ""); d.textContent = x[0]; $("alerts").appendChild(d); });
    }

    // World labels
    camper.updateMatrixWorld();
    stationLabels.forEach(function (l) { project(l.x, l.y, l.z, l.el); });
    var sl = stateLabels;
    var pan = ST.stove.slots[0].item;
    if (pan) {
      sl.stove.classList.remove("hidden");
      var c = pan.cook, burning = c > 1.6;
      sl.stove.className = "lbl state" + (burning ? " hot" : c >= 1 ? " good" : "");
      sl.stove.innerHTML = _t(c < 1 ? "lbl.cooking" : burning ? "lbl.burning" : "lbl.ready") + '<span class="bar"><b style="width:' + Math.min(100, (c < 1 ? c : (c - 1) / (T.burnAt - 1)) * 100) + '%"></b></span>';
      project(2.05, 1.6, -1.85, sl.stove);
    } else sl.stove.classList.add("hidden");
    if (G.hungry) {
      sl.passenger.classList.remove("hidden");
      sl.passenger.className = "lbl state" + (G.waited > 15 ? " hot" : "");
      sl.passenger.textContent = _t(G.waited > 15 ? "lbl.starving" : "lbl.hungry");
      project(3.75, 2.1, 1.4, sl.passenger);
    } else sl.passenger.classList.add("hidden");
    if (G.seated || bend || G.off) {
      sl.wheel.classList.remove("hidden");
      sl.wheel.className = "lbl state" + (!G.seated ? " hot" : " good");
      sl.wheel.textContent = _t(G.seated ? "lbl.driving" : "lbl.takeWheel");
      project(3.7, 2.0, -1.4, sl.wheel);
    } else sl.wheel.classList.add("hidden");
    if (G.fire) {
      sl.fire.classList.remove("hidden");
      sl.fire.innerHTML = _t("lbl.fire") + (G.fire.prog > 0 ? '<span class="bar"><b style="width:' + G.fire.prog * 100 + '%"></b></span>' : "");
      project(2.05, 1.95, -1.85, sl.fire);
    } else sl.fire.classList.add("hidden");
    leaks.forEach(function (l) {
      if (!l.active) return;
      l.label.innerHTML = _t("lbl.leak") + (l.prog > 0 ? '<span class="bar"><b style="width:' + l.prog * 100 + '%"></b></span>' : "");
      project(l.x, 1.2, l.z, l.label);
    });
    for (var i = pops.length - 1; i >= 0; i--) {
      var p = pops[i];
      p.t += 1 / 60;
      project(p.x, 1.6 + p.t * 1.2, p.z, p.el);
      p.el.style.opacity = String(1 - p.t);
      if (p.t >= 1) { p.el.remove(); pops.splice(i, 1); }
    }
  }

  var btnGrab = $("btnGrab"), btnUse = $("btnUse");
  var lastBtn = "";
  function setButtons(g, u) {
    var gl = _t(!g ? (G.held ? "btn.drop" : "btn.grab") : g.kind === "put" ? "btn.put" : g.kind === "drop" ? "btn.drop" : "btn.grab");
    if (G.seated) gl = "Stand";
    var ul = _t(!u ? "btn.use" : "btn." + u.kind);
    var key = gl + "|" + ul + "|" + !!g + "|" + !!u;
    if (key === lastBtn) return;
    lastBtn = key;
    btnGrab.firstChild.textContent = gl;
    btnUse.firstChild.textContent = ul;
    btnGrab.classList.toggle("ready", !!g && g.kind !== "drop");
    btnUse.classList.toggle("ready", !!u && u.kind !== "throw" || !!(u && u.target));
  }

  // ---------- Loop ----------
  var running = false, lastT = 0;
  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    pollGamepad();
    readKeys();
    if (state === "play") {
      var sub = dt > 0.025 ? 2 : 1;
      for (var i = 0; i < sub; i++) step(dt / sub);
    }
    syncMeshes(dt);
    drawHud();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function startLoop() { if (running) return; running = true; lastT = 0; requestAnimationFrame(frame); }
  function stopLoop() { running = false; }
  function renderOnce() {
    resize();
    syncMeshes(0);
    drawHud();
    renderer.render(scene, camera);
  }

  // ---------- Flow: menu, play, pause, result ----------
  function show(id, on) { $(id).hidden = !on; }
  function setState(s) {
    state = s;
    document.body.className = "state-" + s;
    show("menu", s === "menu");
    show("result", s === "result");
    // Pausing opens the menu drawer, and closing the drawer resumes (see nav below).
    if (s === "pause") nav.open(); else if (nav.isOpen()) nav.close();
    placeNav();
    if (s === "play") startLoop(); else { stopLoop(); renderOnce(); }
  }

  // ---------- Back (top left) and the menu drawer (top right) ----------
  // On a road, back goes to the start screen and the drawer is the pause menu.
  var nav = GameNav.create({
    title: function () { return state === "pause" ? _t("paused") : "Camper Crew"; },
    onOpen: function () { if (state === "play") setState("pause"); },
    onClose: function () { if (state === "pause") setState("play"); },
    items: function () {
      var onRoad = state === "pause";
      return [
        onRoad && { icon: "play", label: _t("resume"), onSelect: function () {} },
        onRoad && { icon: "restart", label: _t("restartRoad"), onSelect: function () { startRoad(G.n); setState("play"); } },
        { icon: "help", label: _t("how"), html: "<ul>" + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return "<li>" + _t("how." + n) + "</li>"; }).join("") + "</ul><p>" + _t("how.stars") + "</p>" },
        state === "menu" && GameNav.language(),
      ];
    },
  });
  var navBar = GameNav.bar(nav);
  document.body.appendChild(navBar);
  function toMenu() {
    if (state === "result") { $("resultMenuBtn").click(); return; }
    menuRoad = G.n; refreshMenu(); setState("menu");
  }
  function placeNav() {
    if (state === "menu") { navBar.append(nav.back, nav.menu); nav.setBack(); }
    else { $("hud").prepend(nav.back); $("hud").append(nav.menu); nav.setBack(toMenu, _t("backToMenu")); }
  }

  function finish(arrived) {
    G.done = true;
    var spare = level.sunset - G.time;
    var stars = 0;
    if (arrived) { stars = 1; if (G.mood >= 50) stars++; if (spare >= 20) stars++; }
    if (arrived) {
      save.best[G.n] = Math.max(save.best[G.n] || 0, stars);
      save.unlocked = Math.max(save.unlocked, G.n + 1);
      writeSave();
    }
    $("resultTitle").textContent = _t(arrived ? "res.arrived" : "res.sunset");
    $("resultStars").innerHTML = [0, 1, 2].map(function (i) { return '<span class="' + (i < stars ? "" : "off") + '">★</span>'; }).join("");
    $("resultText").textContent = arrived
      ? _t("res.arrivedText", { t: fmtTime(spare), m: Math.round(G.mood), f: G.fed })
      : _t("res.sunsetText", { p: Math.round(100 * G.s / level.length), s: Math.round(G.offroadTime) });
    show("nextBtn", arrived);
    setTimeout(function () { setState("result"); }, arrived ? 600 : 300);
  }

  function refreshMenu() {
    $("roadName").textContent = _t("road", { n: menuRoad });
    var b = save.best[menuRoad] || 0;
    $("roadStars").textContent = b ? "★".repeat(b) + "☆".repeat(3 - b) : "";
    $("prevRoad").disabled = menuRoad <= 1;
    $("nextRoad").disabled = menuRoad >= save.unlocked;
  }

  $("prevRoad").onclick = function () { menuRoad = Math.max(1, menuRoad - 1); refreshMenu(); startRoad(menuRoad); renderOnce(); };
  $("nextRoad").onclick = function () { menuRoad = Math.min(save.unlocked, menuRoad + 1); refreshMenu(); startRoad(menuRoad); renderOnce(); };
  $("playBtn").onclick = function () { startRoad(menuRoad); setState("play"); };
  $("retryBtn").onclick = function () { startRoad(G.n); setState("play"); };
  $("nextBtn").onclick = function () { menuRoad = G.n + 1; startRoad(G.n + 1); setState("play"); };
  $("resultMenuBtn").onclick = function () { menuRoad = Math.min(save.unlocked, G.n + (save.best[G.n] ? 1 : 0)); refreshMenu(); startRoad(menuRoad); setState("menu"); };
  document.addEventListener("visibilitychange", function () { if (document.hidden && state === "play") setState("pause"); });

  // ---------- Input: keyboard ----------
  var keys = {};
  addEventListener("keydown", function (e) {
    if (e.repeat) { if (["Space", "KeyE"].indexOf(e.code) >= 0) e.preventDefault(); return; }
    keys[e.code] = true;
    if (state !== "play") {
      var onButton = document.activeElement && document.activeElement.tagName === "BUTTON";
      if ((e.code === "Enter" || e.code === "Space") && state === "menu" && !onButton) { e.preventDefault(); $("playBtn").click(); }
      else if ((e.code === "Escape" || e.code === "KeyP") && state === "pause") setState("play");
      return;
    }
    if (e.code === "Space" || e.code === "KeyJ") { input.grabEdge = true; e.preventDefault(); }
    if (e.code === "KeyE" || e.code === "KeyK" || e.code === "ShiftLeft") { input.useEdge = true; e.preventDefault(); }
    if (e.code === "Escape" || e.code === "KeyP") setState("pause");
  });
  addEventListener("keyup", function (e) { keys[e.code] = false; });
  addEventListener("blur", function () { keys = {}; });

  // ---------- Input: touch stick and buttons ----------
  var stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  var stickEl = $("stick"), knobEl = $("knob");
  var zone = $("stickZone");
  zone.addEventListener("pointerdown", function (e) {
    if (stick.id !== null) return;
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
    zone.setPointerCapture(e.pointerId);
    stickEl.style.left = e.clientX + "px"; stickEl.style.top = e.clientY + "px";
    stickEl.classList.add("on");
    e.preventDefault();
  });
  zone.addEventListener("pointermove", function (e) {
    if (e.pointerId !== stick.id) return;
    var dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx *= max / d; dy *= max / d; }
    stick.x = dx / max; stick.y = dy / max;
    knobEl.style.transform = "translate(" + dx + "px," + dy + "px)";
  });
  function stickUp(e) {
    if (e.pointerId !== stick.id) return;
    stick.id = null; stick.x = stick.y = 0;
    knobEl.style.transform = "";
    stickEl.classList.remove("on");
    stickEl.style.left = ""; stickEl.style.top = "";
  }
  zone.addEventListener("pointerup", stickUp);
  zone.addEventListener("pointercancel", stickUp);

  var touchUse = false;
  function bindButton(el, onDown, onUp) {
    el.addEventListener("pointerdown", function (e) { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add("down"); onDown(); });
    var up = function () { el.classList.remove("down"); if (onUp) onUp(); };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  bindButton(btnGrab, function () { input.grabEdge = true; });
  bindButton(btnUse, function () { input.useEdge = true; touchUse = true; }, function () { touchUse = false; });

  // ---------- Input: gamepad ----------
  var padPrev = {};
  var padUse = false, padX = 0, padY = 0;
  function pollGamepad() {
    padX = padY = 0; padUse = false;
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      if (!p) continue;
      var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { padX = ax; padY = ay; }
      if (p.buttons[14] && p.buttons[14].pressed) padX = -1;
      if (p.buttons[15] && p.buttons[15].pressed) padX = 1;
      if (p.buttons[12] && p.buttons[12].pressed) padY = -1;
      if (p.buttons[13] && p.buttons[13].pressed) padY = 1;
      var a = p.buttons[0] && p.buttons[0].pressed;
      var b = (p.buttons[1] && p.buttons[1].pressed) || (p.buttons[2] && p.buttons[2].pressed);
      var start = p.buttons[9] && p.buttons[9].pressed;
      var prev = padPrev[i] || {};
      if (state === "play") {
        if (a && !prev.a) input.grabEdge = true;
        if (b && !prev.b) input.useEdge = true;
        if (start && !prev.start) setState("pause");
      } else if ((a || start) && !prev.a && !prev.start) {
        if (state === "menu") $("playBtn").click();
        else if (state === "pause") setState("play");
        else if (state === "result") ($("nextBtn").hidden ? $("retryBtn") : $("nextBtn")).click();
      }
      if (b) padUse = true;
      padPrev[i] = { a: a, b: b, start: start };
    }
  }

  // Combine keyboard, stick and gamepad into one screen-relative direction,
  // then turn it into camper coordinates for the current camera.
  function readKeys() {
    var sx = 0, sy = 0;
    if (keys.KeyA || keys.ArrowLeft) sx -= 1;
    if (keys.KeyD || keys.ArrowRight) sx += 1;
    if (keys.KeyW || keys.ArrowUp) sy -= 1;
    if (keys.KeyS || keys.ArrowDown) sy += 1;
    if (stick.id !== null) { sx += stick.x; sy += stick.y; }
    sx += padX; sy += padY;
    var m = Math.hypot(sx, sy);
    if (m > 1) { sx /= m; sy /= m; }
    if (m < 0.15) { sx = sy = 0; }
    // landscape: screen right = +x, screen up = -z; portrait: screen right = +z, screen up = +x
    if (portrait) { input.mx = -sy; input.mz = sx; }
    else { input.mx = sx; input.mz = sy; }
    input.use = !!(keys.KeyE || keys.KeyK || keys.ShiftLeft || touchUse || padUse);
  }

  // ---------- Resize ----------
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    placeCamera();
  }
  addEventListener("resize", function () { resize(); if (!running) renderOnce(); });

  // Handle for automated tests and tuning from the browser console; not used by the game.
  window.CamperDebug = {
    get G() { return G; }, get level() { return level; }, get items() { return items; }, get leaks() { return leaks; },
    ST: ST, T: T, input: input, step: step,
  };

  // ---------- Boot ----------
  refreshMenu();
  startRoad(menuRoad);
  setState("menu");
})();
