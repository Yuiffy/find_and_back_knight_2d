import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
const dir = path.resolve('.tmp/extraction-rules');
fs.mkdirSync(dir, { recursive: true });
for (const name of ['items', 'inventory', 'model', 'map', 'simulation']) {
  const source = fs.readFileSync(`src/extraction/${name}.ts`, 'utf8');
  const code = stripTypeScriptTypes(source)
    .replace(/'\.\/(items|inventory|model|map)(?:\.ts)?'/g, "'./$1.mjs'");
  fs.writeFileSync(path.join(dir, `${name}.mjs`), code);
}
const {
  freshProfile,
  deploy,
  settle,
  normalizeProfile,
  recoverInterrupted,
  canDeploy,
  WEAPONS,
} = await import('../.tmp/extraction-rules/model.mjs');
const { Raid } = await import('../.tmp/extraction-rules/simulation.mjs');
const { ITEMS } = await import('../.tmp/extraction-rules/items.mjs');
const { emptyInventory, normalizeInventory, fits, findSpace, planTransfer, arrange, occupiedCells, itemSize, bagGrid, stashGrid } = await import('../.tmp/extraction-rules/inventory.mjs');
const { blocked, collides, bulletWallHit, segmentCircleHit, CRATES, OBSTACLES, POWER, RADAR } =
  await import('../.tmp/extraction-rules/map.mjs');
const kit = { weapon: 'kestrel', armor: true, meds: 2, suppressor: false };
const tick = (r, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 60)
    r.update(Math.min(1 / 60, seconds - t));
};
let p = freshProfile(),
  deployed = deploy(p, kit),
  raid = new Raid(deployed, kit);
assert.equal(deployed.guns.kestrel, 0);
assert.equal(deployed.armors, 0);
assert.equal(deployed.meds, 1);
assert(!canDeploy(deployed, kit));
assert(!blocked(-35, 34, -28, 34));
assert(blocked(-23, 20, -23, 35));
assert(collides(-23, 28));
for (const c of raid.crates)
  assert(!collides(c.x, c.z, 0.1), `Crate inside geometry: ${c.id}`);
for (const e of raid.enemies)
  assert(!collides(e.x, e.z), `Enemy inside geometry ${e.id}`);
// Physical boundary and sprint weight influence.
raid.enemies = [];
raid.player.x = -32;
raid.player.z = 28;
raid.input.x = 1;
tick(raid, 3);
assert(raid.player.x < -29.5);
raid.input.x = 0;
raid.player.x = -29;
raid.player.z = 34;
raid.interact();
tick(raid, 2.2);
assert.equal(raid.search, 'dock');
raid.takeAll();
assert.equal(raid.bag.length, 3);
raid.insure(2);
assert.equal(raid.secure, 'sicily_lemon');
assert.equal(raid.bag.length, 2);
raid.take(999);
assert.equal(raid.bag.length, 2);
const beforePause = raid.elapsed;
raid.paused = true;
tick(raid, 8);
assert.equal(raid.elapsed, beforePause);
raid.paused = false;
raid.search = null;
raid.player.x = -32;
raid.player.z = 42;
tick(raid, 3);
assert(raid.extraction > 2);
raid.player.z = 37;
tick(raid, 0.1);
assert.equal(raid.extraction, 0);
raid.player.z = 42;
tick(raid, 3);
raid.hurt(5);
assert.equal(raid.extraction, 0);
tick(raid, 7.2);
assert.equal(raid.phase, 'won');
p = settle(deployed, raid.result());
assert.equal(p.contract, 1);
assert.equal(p.wins, 1);
assert.equal(p.guns.kestrel, 1);
assert.equal(p.stash.length, 3);
assert.equal(p.credits, 1970);
assert.deepEqual(settle(p, raid.result()), p, 'Settlement must be idempotent');
// Death, secure item, interrupted action and exactly one previous corpse.
deployed = deploy(p, kit);
raid = new Raid(deployed, kit);
raid.bag = ['sample', 'gold'];
raid.secure = 'electronics';
raid.finish(false, 'test');
const dead = settle(deployed, raid.result());
assert.equal(dead.stash.at(-1), 'electronics');
assert.deepEqual(dead.lost.items, ['sample', 'gold']);
assert.equal(dead.guns.kestrel, 0);
const restocked = {
  ...dead,
  guns: { ...dead.guns, kestrel: 1 },
  armors: 1,
  meds: 3,
};
const retry = deploy(restocked, kit),
  corpseRaid = new Raid(retry, kit);
corpseRaid.player.x = dead.lost.x;
corpseRaid.player.z = dead.lost.z;
corpseRaid.interact();
assert(corpseRaid.recovered);
corpseRaid.takeAll();
corpseRaid.enemies = [];
corpseRaid.player.x = -32;
corpseRaid.player.z = 42;
tick(corpseRaid, 7);
const recovered = settle(retry, corpseRaid.result());
assert.equal(recovered.guns.kestrel, 2);
assert.equal(recovered.lost, null);
const interrupted = recoverInterrupted(retry);
assert(!interrupted.active);
assert.equal(interrupted.wins, dead.wins);
assert.deepEqual(interrupted.lost.items, []);
// Heal cancelled by moving; reload commits only when complete; armour mitigation.
raid = new Raid(deploy(freshProfile(), kit), kit);
raid.enemies = [];
raid.player.hp = 50;
raid.player.bleed = true;
raid.heal();
raid.input.x = 1;
tick(raid, 0.2);
assert.equal(raid.healing, 0);
assert.equal(raid.meds, 2);
raid.input.x = 0;
raid.heal();
tick(raid, 2.6);
assert.equal(raid.meds, 1);
assert(!raid.player.bleed);
assert(raid.player.hp > 98);
raid.mag = 1;
raid.startReload();
tick(raid, 1);
assert.equal(raid.mag, 1);
tick(raid, 1);
assert.equal(raid.mag, 24);
assert.equal(raid.ammo, 97);
const hp = raid.player.hp;
raid.hurt(20);
assert.equal(raid.player.hp, hp - 6);
assert.equal(raid.player.armor, 61);
// Real simulation combat: hits, obstruction, hearing and kill drops.
for (const weapon of Object.keys(WEAPONS)) {
  const l = { ...kit, weapon },
    r = new Raid(freshProfile(), l);
  r.enemies = [r.enemies[0]];
  const e = r.enemies[0];
  e.x = -32;
  e.z = 33;
  e.homeX = e.x;
  e.homeZ = e.z;
  r.input.aimX = e.x;
  r.input.aimZ = e.z;
  r.input.ads = true;
  r.input.fire = true;
  tick(r, 2.2);
  assert.equal(r.kills, 1, `${weapon} failed to kill target`);
  assert(r.crates.some((c) => c.id === 'enemy-0'));
}
raid = new Raid(freshProfile(), kit);
raid.enemies = [raid.enemies[0]];
raid.player.x = -23;
raid.player.z = 34;
raid.enemies[0].x = -23;
raid.enemies[0].z = 22;
raid.input.aimX = -23;
raid.input.aimZ = 22;
raid.input.fire = true;
tick(raid, 1);
assert.equal(raid.enemies[0].hp, 78);
assert.equal(raid.enemies[0].mode, 'investigate');
// Powered northern extraction and final campaign requirements.
p = freshProfile();
p.contract = 2;
deployed = deploy(p, kit);
raid = new Raid(deployed, kit);
raid.enemies = [];
raid.player.x = 39;
raid.player.z = -38;
tick(raid, 7);
assert.equal(raid.phase, 'raid');
assert.equal(raid.extraction, 0);
raid.player.x = POWER.x;
raid.player.z = POWER.z + 2;
raid.interact();
tick(raid, 3.1);
assert(raid.powered);
raid.player.x = RADAR.x;
raid.player.z = RADAR.z + 2;
raid.interact();
tick(raid, 4.1);
assert(raid.radar);
raid.player.x = RADAR.x + 1.5;
raid.player.z = RADAR.z + 1;
raid.interact();
raid.takeAll();
assert(raid.bag.includes('core'));
raid.player.x = 39;
raid.player.z = -38;
tick(raid, 6.1);
assert.equal(raid.phase, 'won');
const ending = settle(deployed, raid.result());
assert.equal(ending.contract, 3);
raid = new Raid(freshProfile(), kit);
raid.elapsed = 599;
tick(raid, 2);
assert.equal(raid.phase, 'lost');
assert.throws(() => normalizeProfile({ version: 99 }));
const corrupt = normalizeProfile({
  version: 1,
  credits: Infinity,
  stash: ['oops', 'gold'],
  guns: { kestrel: -1 },
  packLevel: 999,
});
assert.equal(corrupt.credits, 0);
assert.equal(corrupt.guns.kestrel, 0);
assert.deepEqual(corrupt.stash, ['gold']);
assert.equal(corrupt.packLevel, 2);
assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(ending))), ending);
// Capacity and weight change travel decisions, while a secure-slot swap stays lossless.
const light = new Raid(freshProfile(), kit),
  heavy = new Raid(freshProfile(), kit);
light.enemies = [];
heavy.enemies = [];
heavy.bag = Array(10).fill('scrap');
light.input.x = heavy.input.x = 1;
tick(light, 1);
tick(heavy, 1);
assert(light.player.x - heavy.player.x > 1.5);
heavy.input.x = 0;
heavy.player.x = -29;
heavy.player.z = 34;
heavy.interact();
tick(heavy, 3);
heavy.takeAll();
assert.equal(heavy.bag.length, 10);
heavy.insure(0);
assert.equal(heavy.bag.length, 9);
heavy.bag[0] = 'gold';
heavy.insure(0);
assert.equal(heavy.secure, 'gold');
assert.equal(heavy.bag.length, 9);
assert.equal(heavy.bag.at(-1), 'scrap');
heavy.drop(0); heavy.drop(0);
assert.equal(new Set(heavy.crates.map(c => c.id)).size, heavy.crates.length, 'Rapid drops have unique identities');
// Loud reports reach distant patrols; a suppressor materially changes that decision.
for (const suppressor of [false, true]) {
  const r = new Raid(freshProfile(), { ...kit, suppressor });
  r.enemies = [r.enemies[0]];
  r.enemies[0].x = -12;
  r.enemies[0].z = 37;
  r.input.aimX = -32;
  r.input.aimZ = 45;
  r.input.fire = true;
  tick(r, 0.02);
  assert.equal(r.enemies[0].mode, suppressor ? 'patrol' : 'investigate');
}
const full = freshProfile();
full.stash = Array(24).fill('scrap');
const fullRaid = new Raid(deploy(full, kit), kit);
fullRaid.bag = ['gold'];
fullRaid.finish(true, 'capacity');
const fullResult = settle(deploy(full, kit), fullRaid.result());
assert.equal(fullResult.stash.length, 24);
assert.equal(fullResult.credits, full.credits + 120 + 650);
const endgame = freshProfile();
endgame.contract = 3;
assert.equal(new Raid(endgame, kit).enemies.length, 12);

// True grid occupancy, rotation, partial search and lossless transfers.
const validateGrid = (inventory) => {
  assert.equal(inventory.slots.length, inventory.items.length);
  assert.equal(inventory.known.length, inventory.items.length);
  for (let index = 0; index < inventory.items.length; index++)
    assert(fits(inventory, inventory.items[index], inventory.slots[index], index), JSON.stringify(inventory));
};
const room = emptyInventory({ columns: 2, rows: 1 });
assert(!fits(room, 'medicine', { x: 0, y: 0, rotated: false }));
assert(fits(room, 'medicine', { x: 0, y: 0, rotated: true }));
assert(!fits(room, 'scrap', { x: 1, y: 0, rotated: false }));
assert(!fits(room, 'gold', { x: .5, y: 0, rotated: false }));
assert(!fits(room, 'gold', { x: -1, y: 0, rotated: false }));
const unknown = normalizeInventory(['gold'], { columns: 2, rows: 2 }).inventory;
unknown.known[0] = false;
assert.equal(planTransfer(unknown, 0, room), null);
const gridRaid = new Raid(freshProfile(), kit);
gridRaid.enemies = []; gridRaid.player.x = -29; gridRaid.player.z = 34; gridRaid.interact();
tick(gridRaid, .9);
const source = gridRaid.crates.find(c => c.id === 'dock');
assert.equal(source.revealed, 1);
const partial = source.searched;
assert(gridRaid.take(0));
assert.equal(source.searched, partial, 'Taking one item must preserve the next scan progress');
tick(gridRaid, .51);
assert(source.identified[0]);
assert.equal(source.loot[0], 'dq_pistachio');
assert(gridRaid.transfer('bag', 0, 'crate'));
assert.equal(source.identified.at(-1), true, 'Returning a known item must not conceal it again');
tick(gridRaid, 1);
gridRaid.takeAll();
assert.equal(gridRaid.bag.length, 3);
assert.equal(gridRaid.usedCells, 6, 'Capacity counts the actual item rectangles');
validateGrid(gridRaid.inventories.bag);
assert(gridRaid.insure(gridRaid.bag.indexOf('sicily_lemon')));
assert(gridRaid.transfer('secure', 0, 'bag'));
assert.equal(gridRaid.secure, null);
validateGrid(gridRaid.inventories.bag);
gridRaid.bag = Array(20).fill('gold'); gridRaid.bagLayout = [];
gridRaid.secure = 'electronics'; gridRaid.secureLayout = { x: 0, y: 0, rotated: false };
void gridRaid.inventories;
const occupiedBeforeSwap = JSON.stringify({ bag: gridRaid.bag, slots: gridRaid.bagLayout, secure: gridRaid.secure });
assert(!gridRaid.insure(0), 'A secure replacement must fit back into its source');
assert.equal(JSON.stringify({ bag: gridRaid.bag, slots: gridRaid.bagLayout, secure: gridRaid.secure }), occupiedBeforeSwap);
// Six fragmented free cells are insufficient; sorting should create a full 2x3 rectangle.
const holes = normalizeInventory(Array(20).fill('gold'), bagGrid(freshProfile())).inventory;
for (const i of [10, 8, 6, 4, 2, 0]) { holes.items.splice(i, 1); holes.slots.splice(i, 1); holes.known.splice(i, 1); }
assert.equal(20 - occupiedCells(holes.items), 6);
assert.equal(findSpace(holes, 'core'), null);
const packed = arrange(holes);
assert(packed); validateGrid(packed); assert(findSpace(packed, 'core'));
const coreSource = normalizeInventory(['core'], { columns: 5, rows: 4 }).inventory;
const takenCore = planTransfer(coreSource, 0, packed);
assert(takenCore); assert.equal(takenCore.source.items.length, 0); validateGrid(takenCore.target);
const safeBox = { ...emptyInventory({ columns: 2, rows: 2 }), single: true };
assert.equal(planTransfer(coreSource, 0, safeBox), null);

// Invalid and older stash layouts preserve total owned value and normalize once.
const legacyGridSave = freshProfile(); legacyGridSave.stash = Array(24).fill('core'); delete legacyGridSave.stashLayout;
const migratedGrid = normalizeProfile(legacyGridSave);
assert.equal(migratedGrid.credits + migratedGrid.stash.reduce((n, id) => n + ITEMS[id].value, 0), legacyGridSave.credits + 24 * ITEMS.core.value);
assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(migratedGrid))), migratedGrid);
const invalidLayout = freshProfile(); invalidLayout.stash = ['medicine', 'electronics', 'gold'];
invalidLayout.stashLayout = [{ x: -1, y: 0, rotated: false }, { x: 0, y: 0, rotated: false }, { x: 0, y: 0, rotated: false }];
const repaired = normalizeProfile(invalidLayout);
assert.deepEqual(repaired.stash, invalidLayout.stash);
validateGrid({ grid: stashGrid(repaired), items: repaired.stash, slots: repaired.stashLayout, known: repaired.stash.map(() => true) });

// Repeated moves of identical instances remain bounded, non-overlapping and lossless.
let first = normalizeInventory(['scrap', 'gold', 'medicine', 'sample', 'electronics'], { columns: 5, rows: 4 }).inventory;
let second = emptyInventory({ columns: 5, rows: 4 });
const owned = [...first.items].sort();
for (let n = 0; n < 120; n++) {
  const from = n % 2 ? second : first, to = n % 2 ? first : second;
  if (!from.items.length) continue;
  const index = n % from.items.length, next = planTransfer(from, index, to, undefined, !!(n % 3));
  if (next) { if (n % 2) { second = next.source; first = next.target; } else { first = next.source; second = next.target; } }
  validateGrid(first); validateGrid(second);
  assert.deepEqual([...first.items, ...second.items].sort(), owned);
}
console.log('Grid inventory: footprints, overlap, rotation, progressive search, reversible transfers, secure swap, sorting, legacy migration and conservation PASS');

// A shot creates a moving bullet; it does not damage a target at fire time.
function combatScenario() {
  const r = new Raid(freshProfile(), kit);
  r.player.angle = Math.PI; r.input.aimX = -32; r.input.aimZ = 10; r.input.ads = true;
  const template = r.enemies[0];
  const target = (id, z) => ({ ...template, id, x: -32, z, homeX: -32, homeZ: z, targetX: -32, targetZ: z, cooldown: 99, alert: 0 });
  r.enemies = [target(1, 22), target(0, 29)];
  return r;
}
let flight = combatScenario();
flight.fire();
assert.equal(flight.shotCount, 1); assert.equal(flight.mag, 23);
assert.equal(flight.bullets.length, 1);
assert(flight.enemies.every(e => e.hp === 78), 'No hitscan damage at emission');
const emitted = { ...flight.bullets[0] };
tick(flight, .03);
assert(flight.bullets[0].z < emitted.z - 2, 'The bullet must travel across frames');
assert(flight.enemies.every(e => e.hp === 78), 'Distant impact must be delayed');
const frozenFlight = JSON.stringify(flight.text().ballistics); flight.paused = true; tick(flight, 1);
assert.equal(JSON.stringify(flight.text().ballistics), frozenFlight, 'Pause freezes projectiles and effects');
flight.paused = false; tick(flight, .2);
assert.equal(flight.enemies.find(e => e.id === 0).hp, 52);
assert.equal(flight.enemies.find(e => e.id === 1).hp, 78, 'Nearest target intercepts regardless of array order');
assert.equal(flight.bullets.length, 0);

flight = combatScenario(); flight.fire(); flight.enemies.find(e => e.id === 0).x = -29;
flight.enemies = [flight.enemies.find(e => e.id === 0)]; tick(flight, .5);
assert.equal(flight.enemies[0].hp, 78, 'A target that leaves the trajectory is not hit by an old shot');

flight = combatScenario(); flight.player.x = -23; flight.player.z = 36; flight.input.aimX = -23; flight.input.aimZ = 20;
flight.enemies = [{ ...flight.enemies[0], x: -23, z: 22, targetX: -23, homeX: -23 }];
flight.fire(); flight.update(.3);
assert.equal(flight.enemies[0].hp, 78, 'A large simulation step cannot tunnel through a container');
assert(flight.impacts.some(f => f.kind === 'wall' && Math.abs(f.z - 30.035) < .01));
assert.equal(bulletWallHit(-23, 36, -23, 22), (36 - 30.035) / 14);
assert(segmentCircleHit(-10, 0, 10, 0, 0, 0, .65) < .5, 'Swept circle catches a crossing bullet even when endpoints miss');
assert.equal(segmentCircleHit(-10, 2, 10, 2, 0, 0, .65), null);
flight = combatScenario(); flight.enemies = [];
flight.bullets.push({ id: 1, x: -42, z: 37, vx: 72, vz: 0, life: .5, damage: 14, enemy: true, weapon: 'kestrel', travelled: 0, trail: .95, bornAt: -1 });
flight.update(.3);
assert(Math.abs(flight.player.hp - 95.8) < .001, 'Enemy bullet crosses the player between endpoints and applies armour');
assert.equal(flight.bullets.length, 0);
flight = combatScenario(); flight.player.x = -23; flight.player.z = 22; flight.enemies = [];
flight.bullets.push({ id: 1, x: -23, z: 36, vx: 0, vz: -96, life: .5, damage: 22, enemy: true, weapon: 'heron', travelled: 0, trail: 1, bornAt: -1 });
flight.update(.3); assert.equal(flight.player.hp, 100, 'Cover intercepts an enemy bullet before a player behind it');

flight = combatScenario(); flight.enemies = [{ ...flight.enemies[1], z: 36.2 }]; flight.input.aimZ = 36.2;
flight.fire(); assert.equal(flight.enemies[0].hp, 78); tick(flight, .03);
assert(flight.enemies[0].hp < 78, 'A target closer than the barrel still receives a delayed point-blank impact');

// Every weapon has finite flight, recovery, armour mitigation and a single kill.
for (const weapon of Object.keys(WEAPONS)) {
  const r = new Raid(freshProfile(), { ...kit, weapon });
  r.player.x = -43; r.player.z = 0; r.player.angle = 0; r.input.aimX = -43; r.input.aimZ = 40; r.input.ads = true;
  r.enemies = []; r.fire(); const shot = r.bullets[0];
  assert.equal(Math.round(Math.hypot(shot.vx, shot.vz)), WEAPONS[weapon].bulletSpeed);
  assert(shot.trail < 2 && shot.life < .6); tick(r, .7); assert.equal(r.bullets.length, 0, 'Range exhaustion removes bullets');
  assert.equal(r.recoil, 0);
}
flight = combatScenario(); flight.enemies = [flight.enemies[1]]; flight.enemies[0].hp = 15; flight.enemies[0].armor = 10;
flight.fire(); tick(flight, .2);
assert.equal(flight.kills, 1); assert.equal(flight.ammo, 132); assert.equal(flight.crates.filter(c => c.id === 'enemy-0').length, 1);
assert(flight.hitFeedback?.kind === 'kill');

// User-named items must appear in normal map sources, not just test fixtures.
const namedLoot = ['dq_pistachio','beef_jerky','sicily_lemon','rtx_3050','rtx_5070ti','cpu_9800x3d','cat_food','cat_litter','swim_pass','gym_pass'];
const sources = CRATES.flatMap(c => [...c.loot, ...(c.bonus ?? [])]);
for (const id of namedLoot) { assert(sources.includes(id), `Missing map source: ${id}`); assert(ITEMS[id].description.length > 15); }
const newAndOld = [...namedLoot, 'sample', 'core', 'electronics'];
const mixedProfile = freshProfile(); mixedProfile.stash = newAndOld;
const saved = normalizeProfile(mixedProfile);
assert.deepEqual(saved.stash, newAndOld); assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(saved))), saved);
const snack = new Raid(freshProfile(), kit); snack.bag = ['beef_jerky', 'rtx_3050']; snack.player.hp = 70; snack.player.stamina = 50; snack.player.bleed = true;
assert(snack.consume('bag', 0)); assert.equal(snack.player.hp, 82); assert.equal(snack.player.stamina, 70); assert(snack.player.bleed);
assert.deepEqual(snack.bag, ['rtx_3050']); assert(!snack.consume('bag', 0));
snack.secure = 'sicily_lemon'; assert(snack.consume('secure', 0)); assert.equal(snack.secure, null);
snack.bag = ['dq_pistachio']; snack.bagLayout = []; snack.player.hp = 100; snack.player.stamina = 100;
assert(!snack.consume('bag', 0)); assert.deepEqual(snack.bag, ['dq_pistachio'], 'Full status preserves food');
snack.player.stamina = 0; snack.paused = true; assert(!snack.consume('bag', 0)); snack.paused = false;
assert(snack.consume('bag', 0)); assert.equal(snack.player.stamina, 45); assert.equal(snack.bag.length, 0);
console.log('Flying bullets: delayed hits, sweep, cover, nearest target, moving dodge, range, pause, recoil, kill; familiar loot and food conservation PASS');
console.log(
  'Extraction rules: deployment, inventory, armour, healing, all weapons, cover, AI hearing, both exits, campaign ending, death recovery, persistence PASS',
);
