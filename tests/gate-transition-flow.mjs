import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/gate-transition-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

const profile = {
  version: 2,
  updatedAt: new Date().toISOString(),
  warehouseSize: { width: 9, height: 10 },
  warehouse: [],
  loadout: { weapon: 'echo_lance', armor: 'stream_shell', head: null, shoes: 'soft_boots', backpack: 'field_pack' },
  backpack: { width: 4, height: 5, items: [{ uid: 'gate-tonic', itemId: 'echo_tonic', quantity: 1, x: 0, y: 0, rotated: false }] },
  armorCondition: 1,
  raidsStarted: 7,
  successfulExtractions: 3,
  deaths: 0,
  credits: 45,
  discoveredItems: ['echo_lance', 'stream_shell', 'soft_boots', 'field_pack', 'echo_tonic'],
  discoveredClues: ['arrival', 'map-trace', 'lift-trace', 'warden-trace', 'home-trace'],
  mapUnlocked: true,
  shortcutUnlocked: true,
  bossDefeated: true,
  endingUnlocked: true,
  endingSeen: false,
  lostEcho: null,
  activeRaid: null,
};

function assert(condition, message) { if (!condition) throw new Error(message); }
async function state() { return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')); }
async function hold(key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}
async function moveX(targetX) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const current = await state();
    const distance = targetX - current.player.x;
    if (Math.abs(distance) < 45) return;
    await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(240, Math.max(65, Math.abs(distance) * 1.5)));
  }
}

try {
  await page.goto('http://127.0.0.1:4175/knight/', { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(value)), profile);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /西侧随机接驳/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(750);
  await moveX(620);
  let current = await state();
  assert(current.nearbyInteraction?.includes('空洞折跃门'), `Relay gate was not reachable: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').mapId === 'hollow_01', undefined, { timeout: 3500 });
  current = await state();
  assert(current.loadout.weapon === 'echo_lance' && current.player.armor === 1, `Gate lost equipped state: ${JSON.stringify(current)}.`);
  assert(current.backpack.some((item) => item.itemId === 'echo_tonic'), 'Gate lost carried loot.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-relay-to-hollow.png') });

  await moveX(4040);
  current = await state();
  assert(current.nearbyInteraction?.includes('深场折跃门'), `Hollow gate was not reachable: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').mapId === 'relay_01', undefined, { timeout: 3500 });
  current = await state();
  assert(current.loadout.weapon === 'echo_lance' && current.player.armor === 1, 'Return gate lost equipped state.');
  assert(current.backpack.some((item) => item.itemId === 'echo_tonic'), 'Return gate lost carried loot.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-hollow-to-relay.png') });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, crossedBothWays: true, statePreserved: true, errors }, null, 2));
} finally {
  await browser.close();
}
