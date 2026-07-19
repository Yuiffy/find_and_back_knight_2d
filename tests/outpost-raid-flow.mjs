import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4184/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/outpost-raid-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

function assert(condition, message) { if (!condition) throw new Error(message); }
async function state(page) { return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')); }
async function enterOutpost(page, raidCount) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate((raidsStarted) => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...profile, raidsStarted, activeRaid: null, lostEcho: { mapId: 'relay_01', x: 450, y: 1510, items: [{ itemId: 'echo_dust', quantity: 1 }], createdAtRaid: 1 } }));
  }, raidCount);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /随机潜入投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  return state(page);
}

try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  const first = await enterOutpost(page, 1);
  assert(first.mapId === 'outpost_01', `Outpost did not load: ${first.mapId}`);
  assert(first.coordinateSystem.includes('7800x2600'), `Outpost dimensions incorrect: ${first.coordinateSystem}`);
  assert(first.outpost?.scavengersAlive === 4, `Expected four virtual scavengers: ${JSON.stringify(first.outpost)}`);
  assert(first.visibleEnemies.some((entry) => entry.kind === 'scavenger') || first.outpost.scavengersAlive === 4, 'Virtual scavenger state was not published.');
  const firstSpawn = first.spawn;
  const farDistance = Math.hypot(first.outpost.targetExtraction.x - firstSpawn.x, first.outpost.targetExtraction.y - firstSpawn.y);
  assert(farDistance > 4000, `Extraction was not far from random spawn: ${farDistance}`);
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(outputDir, '01-outpost-map-qhd.png') });
  await page.keyboard.press('KeyM');
  const second = await enterOutpost(page, 3);
  assert(second.spawn.x !== firstSpawn.x || second.spawn.y !== firstSpawn.y, `Randomized spawn did not rotate: ${JSON.stringify(firstSpawn)} => ${JSON.stringify(second.spawn)}`);
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, map: second.mapId, firstSpawn, secondSpawn: second.spawn, target: second.outpost.targetExtraction, scavengers: second.outpost.scavengersAlive, errors }, null, 2));
} finally { await browser.close(); }
