// Emberholm's world and walking (games/emberholm/src), checked in Node: the island is the same every
// time (fingerprints), the places sit where they should, walking is stopped by deep water, trees and
// buildings, and a day is 14 minutes of light and 10 of night.
import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../../games/emberholm/src/config.js";
import { height, ground } from "../../games/emberholm/src/world/terrain.js";
import { chunkItems, chunkOf } from "../../games/emberholm/src/world/scatter.js";
import { PLACES, STRUCTURES, START, byId } from "../../games/emberholm/src/world/places.js";
import { Player } from "../../games/emberholm/src/sim/player.js";
import { Clock, light, sky } from "../../games/emberholm/src/sim/time.js";

const DT = 1 / 60;
function walk(p, dir, seconds, run = false) {
  for (let t = 0; t < seconds; t += DT) p.step(DT, dir, run);
}

test("the island is the same every time (frozen: changing it moves everything under players' saves)", () => {
  let h = 0;
  for (let z = -760; z <= 760; z += 40) for (let x = -760; x <= 760; x += 40) h = (Math.imul(h, 31) + Math.round(height(x, z) * 100)) | 0;
  assert.equal(h, -2018124425, "heights fingerprint");
  let n = 0, s = 0;
  for (let cz = -3; cz <= 3; cz++) for (let cx = -3; cx <= 3; cx++) for (const it of chunkItems(cx, cz)) {
    n++; s = (Math.imul(s, 31) + Math.round(it.x * 10) + Math.round(it.z * 10)) | 0;
  }
  assert.deepEqual([n, s], [4094, 288821293], "trees and rocks fingerprint");
});

test("an island: sea all round the edge, land in the middle, mountains in the north", () => {
  const E = CONFIG.world.size / 2 - 20;
  for (const [x, z] of [[-E, 0], [E, 0], [0, E], [0, -E], [E, E], [-E, -E]]) assert.ok(height(x, z) < -5, `sea at ${x}, ${z}`);
  assert.ok(height(0, 0) > 2, "land in the middle");
  let peak = 0;
  for (let x = -300; x <= 300; x += 10) peak = Math.max(peak, height(x, -380));
  assert.ok(peak > 60, `the Fells rise to ${peak.toFixed(0)} m`);
});

test("every place stands on dry land, the flat ones are level, and nothing grows in them", () => {
  for (const p of PLACES) {
    const h = height(p.x, p.z);
    assert.ok(h > (p.id === "wreck" ? 0 : 1), `${p.id} at ${h.toFixed(1)} m`);
    if (p.flat) {
      const around = [0, 1, 2, 3].map((k) => height(p.x + Math.cos(k * 1.57) * p.flat * 0.6, p.z + Math.sin(k * 1.57) * p.flat * 0.6));
      for (const a of around) assert.ok(Math.abs(a - h) < 0.6, `${p.id} is level (${a.toFixed(2)} vs ${h.toFixed(2)})`);
    }
    if (p.clear) {
      for (let cz = chunkOf(p.z - p.clear); cz <= chunkOf(p.z + p.clear); cz++)
        for (let cx = chunkOf(p.x - p.clear); cx <= chunkOf(p.x + p.clear); cx++)
          for (const it of chunkItems(cx, cz)) assert.ok(Math.hypot(it.x - p.x, it.z - p.z) >= p.clear, `a ${it.k} in ${p.id}`);
    }
  }
  assert.equal(ground(byId.blackmire.x, byId.blackmire.z).kind, "bog");
});

test("nothing grows in the sea, and the same chunk always gets the same things", () => {
  for (let cz = -6; cz <= 6; cz++) for (let cx = -6; cx <= 6; cx++) {
    const a = chunkItems(cx, cz);
    for (const it of a) assert.ok(height(it.x, it.z) > 0.3, `a ${it.k} under water at ${it.x}, ${it.z}`);
  }
});

test("walking: forward from the start towards the village, at walking speed", () => {
  const p = new Player(START.x, START.z, START.yaw);
  walk(p, [0, -0.8], 5);   // the stick most of the way (the keyboard gives 0.8); all the way runs
  const moved = START.z - p.z;
  assert.ok(moved > 15 && moved < 25, `walked ${moved.toFixed(1)} m in 5 s`);
  const q = new Player(START.x, START.z, START.yaw);
  walk(q, [0, -1], 5);
  assert.ok(START.z - q.z > moved * 1.4, "running is faster");
  assert.ok(Math.abs(p.yaw) < 0.05, "faces north");
});

test("walking: deep water stops you", () => {
  const p = new Player(START.x, START.z, START.yaw);
  walk(p, [0, 1], 30);   // straight out to sea
  assert.ok(-p.y <= CONFIG.world.deepWater + 0.05, `standing in ${(-p.y).toFixed(2)} m of water`);
  assert.ok(p.z < START.z + 80, "didn't get far out");
});

test("walking: trees, rocks and buildings stop you", () => {
  // A tree: walk right into it from 3 m away.
  const tree = chunkItems(0, 0).find((it) => it.r > 0.3);
  assert.ok(tree, "a tree near the middle");
  const p = new Player(tree.x, tree.z + 3, 0);
  walk(p, [0, -1], 3);
  assert.ok(Math.hypot(p.x - tree.x, p.z - tree.z) >= tree.r + CONFIG.player.radius - 0.01, "not inside the tree");
  // A longhouse in Brandvik: walk at it from its door side.
  const house = STRUCTURES.find((s) => s.kind === "house");
  const q = new Player(house.x, house.z + 8, 0);
  walk(q, [0, -1], 4);
  const dx = q.x - house.x, dz = q.z - house.z, c = Math.cos(house.rot), s = Math.sin(house.rot);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  assert.ok(Math.abs(lx) > house.w / 2 || Math.abs(lz) > house.d / 2, "not inside the house");
});

test("a day is 24 minutes: 14 of daylight, 10 of night, and the days count up", () => {
  assert.equal(CONFIG.time.day, 24 * 60);
  let lit = 0;
  for (let i = 0; i < 2400; i++) if (light(i / 2400) > 0.5) lit++;
  assert.ok(Math.abs(lit / 2400 - 14 / 24) < 0.01, `light ${(lit / 24).toFixed(1)}% of the day`);
  assert.equal(light(0.3), 1);
  assert.equal(light(0.8), 0);
  const c = new Clock(0.9, 1);
  c.advance(0.2 * CONFIG.time.day);
  assert.equal(c.day, 2);
  c.setHours(6);
  assert.equal(c.text, "06:00");
  assert.ok(sky(0.3).sunI > sky(0.8).sunI, "the sun is brighter than the moon");
});
