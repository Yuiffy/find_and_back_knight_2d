import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/progression-pass-flow');
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
  warehouse: [
    { uid: 'legacy-warehouse', itemId: 'survey_lens', quantity: 1, x: 0, y: 0, rotated: false },
  ],
  loadout: { weapon: 'storm_feather', armor: null, head: 'flower_hat', shoes: 'soft_boots', backpack: 'field_pack' },
  backpack: {
    width: 4,
    height: 5,
    items: [
      { uid: 'test-tonic', itemId: 'echo_tonic', quantity: 1, x: 0, y: 0, rotated: false },
      { uid: 'legacy-pack', itemId: 'survey_lens', quantity: 1, x: 1, y: 0, rotated: false },
    ],
  },
  armorCondition: 0,
  raidsStarted: 0,
  successfulExtractions: 1,
  deaths: 0,
  credits: 45,
  discoveredItems: ['rust_nail', 'stream_shell', 'survey_lens', 'flower_hat', 'soft_boots', 'field_pack', 'echo_tonic', 'storm_feather'],
  discoveredClues: ['arrival'],
  mapUnlocked: true,
  shortcutUnlocked: false,
  bossDefeated: false,
  endingUnlocked: false,
  endingSeen: false,
  lostEcho: { mapId: 'hollow_01', x: 390, y: 2020, items: [{ itemId: 'survey_lens', quantity: 1 }], createdAtRaid: 1 },
  activeRaid: null,
};

function assert(condition, message) { if (!condition) throw new Error(message); }
async function state() { return JSON.parse(await page.evaluate(() => window.render_game_to_text())); }

try {
  await page.goto('http://127.0.0.1:4175/knight/', { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(value)), profile);
  await page.reload({ waitUntil: 'networkidle' });

  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(migrated.loadout.head === 'flower_hat', 'The equipped Flower Hat was unexpectedly changed during migration.');
  assert(migrated.warehouse.every((item) => item.itemId !== 'survey_lens'), 'Legacy warehouse lens was not migrated.');
  assert(migrated.backpack.items.every((item) => item.itemId !== 'survey_lens'), 'Legacy backpack lens was not migrated.');
  assert(migrated.lostEcho.items.every((item) => item.itemId !== 'survey_lens'), 'Legacy lost-echo lens was not migrated.');
  assert(migrated.discoveredItems.includes('blue_hood'), 'Legacy discovery did not migrate to Blue Hood.');

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(750);

  let current = await state();
  assert(current.dash?.mode === 'normal', `Soft Boots should expose normal dash mode: ${JSON.stringify(current.dash)}.`);
  assert(current.backpack.some((item) => item.itemId === 'echo_tonic'), 'Seeded Echo Tonic was missing.');
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(160);
  current = await state();
  assert(current.backpack.some((item) => item.itemId === 'echo_tonic'), 'Tonic was consumed at full health.');

  await page.keyboard.press('KeyK');
  await page.waitForTimeout(60);
  current = await state();
  assert(current.dash?.mode === 'normal' && current.dash.active, `Normal dash did not activate: ${JSON.stringify(current.dash)}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, 'progression-pass.png') });
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, migratedLegacyLens: true, tonicFullHealthGuard: true, normalDash: current.dash, errors }, null, 2));
} finally {
  await browser.close();
}
