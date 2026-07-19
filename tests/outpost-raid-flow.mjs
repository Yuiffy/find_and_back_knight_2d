import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4185/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/outpost-raid-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

function assert(condition, message) { if (!condition) throw new Error(message); }
async function state(page) { return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')); }
async function enterOutpost(page, priorRaidsStarted) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate((raidsStarted) => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...profile, raidsStarted, activeRaid: null, lostEcho: { mapId: 'relay_01', x: 450, y: 1510, items: [{ itemId: 'echo_dust', quantity: 1 }], createdAtRaid: 1 } }));
  }, priorRaidsStarted);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /随机潜入投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(1300);
  return state(page);
}

async function hold(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function moveX(page, targetX, tolerance = 35) {
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const current = await state(page);
    const distance = targetX - current.player.x;
    if (Math.abs(distance) <= tolerance) return current;
    await hold(page, distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(220, Math.max(70, Math.abs(distance) * 1.5)));
  }
  return state(page);
}

function assertSupported(state, expectedSpawn, expectedTop) {
  assert(state.player.grounded, `Spawn ${JSON.stringify(expectedSpawn)} never settled on terrain: ${JSON.stringify(state.player)}`);
  assert(Math.abs(state.player.x - expectedSpawn.x) < 180, `Spawn ${JSON.stringify(expectedSpawn)} drifted to x=${state.player.x}.`);
  assert(state.player.y < expectedSpawn.y + 180, `Spawn ${JSON.stringify(expectedSpawn)} fell too far to y=${state.player.y}.`);
  const foot = state.player.collisionY + state.player.bodyHeight / 2;
  assert(state.nearbyTerrain.some((terrain) => terrain.left <= state.player.collisionX && terrain.right >= state.player.collisionX && Math.abs(terrain.top - foot) < 8 && Math.abs(terrain.top - expectedTop) < 8), `Spawn ${JSON.stringify(expectedSpawn)} is not supported by its expected surface y=${expectedTop}: ${JSON.stringify({ player: state.player, nearbyTerrain: state.nearbyTerrain })}`);
}

try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  const expectedSpawns = [
    { spawn: { x: 420, y: 2260 }, top: 2361 },
    { spawn: { x: 1480, y: 2080 }, top: 2181 },
    { spawn: { x: 2900, y: 1700 }, top: 1801 },
    { spawn: { x: 4450, y: 1500 }, top: 1621 },
    { spawn: { x: 6100, y: 1090 }, top: 1221 },
    { spawn: { x: 7200, y: 700 }, top: 831 },
  ];

  let first;
  for (const [index, expected] of expectedSpawns.entries()) {
    const current = await enterOutpost(page, index);
    assert(current.mapId === 'outpost_01', `Outpost did not load: ${current.mapId}`);
    assert(current.coordinateSystem.includes('7800x2600'), `Outpost dimensions incorrect: ${current.coordinateSystem}`);
    assert(current.spawn.x === expected.spawn.x && current.spawn.y === expected.spawn.y, `Spawn rotation ${index + 1} was incorrect: ${JSON.stringify(current.spawn)}`);
    assertSupported(current, expected.spawn, expected.top);
    if (index === 0) first = current;
  }

  assert(first.outpost?.scavengersAlive >= 3, `Expected at least three safely separated virtual scavengers: ${JSON.stringify(first.outpost)}`);
  assert(first.visibleEnemies.some((entry) => entry.kind === 'scavenger') || first.outpost.scavengersAlive >= 3, 'Virtual scavenger state was not published.');
  const nearestOpeningScavenger = first.visibleEnemies.filter((entry) => entry.kind === 'scavenger').reduce((nearest, entry) => Math.min(nearest, Math.hypot(entry.x - first.spawn.x, entry.y - first.spawn.y)), Number.POSITIVE_INFINITY);
  assert(nearestOpeningScavenger > 1000 || !Number.isFinite(nearestOpeningScavenger), `Opening scavenger spawned too close: ${nearestOpeningScavenger}`);
  const farDistance = Math.hypot(first.outpost.targetExtraction.x - first.spawn.x, first.outpost.targetExtraction.y - first.spawn.y);
  assert(farDistance > 4000, `Extraction was not far from random spawn: ${farDistance}`);

  const market = await enterOutpost(page, 3);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '03-market-arrival-bridge.png') });
  const atExtraction = await moveX(page, 3750, 45);
  assert(atExtraction.player.grounded && atExtraction.player.y < 1700, `Market arrival dropped below the main floor: ${JSON.stringify(atExtraction.player)}`);
  assert(atExtraction.nearbyInteraction.includes('安全撤离'), `Market extraction was not reachable: ${JSON.stringify(atExtraction)}`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '03-market-extraction.png') });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3400);
  const settled = await state(page);
  assert(settled.mode === 'base', `Market extraction did not settle the raid back at base: ${JSON.stringify(settled)}`);

  const mapState = await enterOutpost(page, 0);
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(outputDir, '01-outpost-map-qhd.png') });
  await page.keyboard.press('KeyM');
  assert(mapState.spawn.x === first.spawn.x && mapState.spawn.y === first.spawn.y, 'First spawn changed after map check.');
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, map: first.mapId, spawns: expectedSpawns.map((entry) => entry.spawn), marketExtraction: { x: 3750, y: 1565 }, target: first.outpost.targetExtraction, scavengers: first.outpost.scavengersAlive, errors }, null, 2));
} finally { await browser.close(); }
