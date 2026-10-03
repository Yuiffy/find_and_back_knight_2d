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
const { blocked, collides, OBSTACLES, POWER, RADAR } =
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
assert.equal(raid.secure, 'electronics');
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
assert.equal(source.loot[0], 'medicine');
assert(gridRaid.transfer('bag', 0, 'crate'));
assert.equal(source.identified.at(-1), true, 'Returning a known item must not conceal it again');
tick(gridRaid, 1);
gridRaid.takeAll();
assert.equal(gridRaid.bag.length, 3);
assert.equal(gridRaid.usedCells, 8, 'Capacity counts the actual item rectangles');
validateGrid(gridRaid.inventories.bag);
assert(gridRaid.insure(gridRaid.bag.indexOf('electronics')));
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
console.log(
  'Extraction rules: deployment, inventory, armour, healing, all weapons, cover, AI hearing, both exits, campaign ending, death recovery, persistence PASS',
);
