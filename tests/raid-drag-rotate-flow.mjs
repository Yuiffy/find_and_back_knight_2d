import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/raid-drag-rotate-flow');
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
  backpack: { width: 4, height: 5, items: [{ uid: 'test-lance', itemId: 'echo_lance', quantity: 1, x: 0, y: 0, rotated: false }] },
  armorCondition: 2,
  raidsStarted: 0,
  successfulExtractions: 0,
  deaths: 0,
  credits: 45,
  discoveredItems: ['rust_nail', 'stream_shell', 'cat_cap', 'soft_boots', 'field_pack', 'echo_lance'],
  discoveredClues: ['arrival'],
  mapUnlocked: false,
  shortcutUnlocked: false,
  bossDefeated: false,
  endingUnlocked: false,
  endingSeen: false,
  lostEcho: null,
  activeRaid: null,
};

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(value)), profile);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭/ }).click();
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);

  await page.mouse.move(532, 264);
  await page.mouse.down();
  await page.mouse.move(656, 202, { steps: 8 });
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(120);
  await canvas.screenshot({ path: path.join(outputDir, '01-horizontal-grid-preview.png') });
  await page.mouse.up();
  await page.waitForTimeout(180);

  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const lance = state.backpack.find((item) => item.uid === 'test-lance');
  assert.deepEqual(
    { rotated: lance?.rotated, x: lance?.x, y: lance?.y },
    { rotated: true, x: 0, y: 0 },
    `Raid drop did not keep the rotated footprint: ${JSON.stringify(lance)}`,
  );
  assert.equal(errors.length, 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, raidDragRotation: true, errors }, null, 2));
} finally {
  await browser.close();
}
