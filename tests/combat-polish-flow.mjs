import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/combat-polish-flow');
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
  loadout: { weapon: 'rust_nail', armor: 'stream_shell', head: 'cat_cap', shoes: 'soft_boots', backpack: 'field_pack' },
  backpack: {
    width: 4,
    height: 5,
    items: [
      { uid: 'test-patch', itemId: 'repair_patch', quantity: 1, x: 1, y: 0, rotated: false },
      { uid: 'test-lance', itemId: 'echo_lance', quantity: 1, x: 0, y: 0, rotated: false },
    ],
  },
  armorCondition: 1,
  raidsStarted: 0,
  successfulExtractions: 0,
  deaths: 0,
  credits: 45,
  discoveredItems: ['rust_nail', 'stream_shell', 'cat_cap', 'soft_boots', 'field_pack', 'repair_patch', 'echo_lance'],
  discoveredClues: ['arrival'],
  mapUnlocked: false,
  shortcutUnlocked: false,
  bossDefeated: false,
  endingUnlocked: false,
  endingSeen: false,
  lostEcho: null,
  activeRaid: null,
};

function assert(condition, message) { if (!condition) throw new Error(message); }
async function state() { return JSON.parse(await page.evaluate(() => window.render_game_to_text())); }

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(value)), profile);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);

  let current = await state();
  assert(current.player.armor === 1, 'Seeded damaged armor was not loaded.');
  assert(current.backpack.some((item) => item.itemId === 'repair_patch'), 'Repair patch was missing before use.');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(180);
  current = await state();
  assert(current.player.armor === 2, 'R did not restore one armor point.');
  assert(!current.backpack.some((item) => item.itemId === 'repair_patch'), 'Used repair patch was not consumed.');

  await page.keyboard.press('Tab');
  await page.waitForTimeout(180);
  current = await state();
  assert(current.flags?.inventoryOpen, `Raid inventory did not open: ${JSON.stringify(current)}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '00-before-rotation.png') });
  await page.locator('canvas').click({ position: { x: 518, y: 188 } });
  await page.waitForTimeout(180);
  current = await state();
  assert(current.backpack.find((item) => item.uid === 'test-lance')?.rotated === true, `Raid rotate control did not rotate the backpack item: ${JSON.stringify(current)}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-repaired-and-rotated.png') });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, repairPatchConsumed: true, armorRestored: true, raidRotation: true, errors }, null, 2));
} finally {
  await browser.close();
}
