import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/drag-rotate-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const item = page.getByRole('button', { name: /便携修补片/ });
  const grid = page.locator('.inventory-grid-warehouse');
  const itemBox = await item.boundingBox();
  const gridBox = await grid.boundingBox();
  assert(itemBox && gridBox, 'Warehouse item or grid was not visible.');

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(itemBox.x + itemBox.width / 2 + 12, itemBox.y + itemBox.height * 0.75, { steps: 3 });
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyR');
  await page.mouse.move(gridBox.x + gridBox.width * (6.5 / 9), gridBox.y + gridBox.height * (0.5 / 10), { steps: 6 });

  const preview = page.locator('.inventory-grid-warehouse .inventory-drop-preview');
  await assert.doesNotReject(() => preview.waitFor({ state: 'visible' }));
  await page.screenshot({ path: path.join(outputDir, '01-rotated-preview.png'), fullPage: true });
  const previewStyle = await preview.getAttribute('style');
  assert.match(previewStyle ?? '', /grid-area:\s*1\s*\/\s*\d+\s*\/\s*span\s*1\s*\/\s*span\s*2/i, `Preview did not rotate to 2×1: ${previewStyle}`);

  await page.mouse.up();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  const patch = profile.warehouse.find((entry) => entry.itemId === 'repair_patch');
  assert.equal(patch?.rotated, true, `Drop did not retain the rotated footprint: ${JSON.stringify(patch)}`);
  assert.equal(patch?.y, 0, `Drop did not retain the target row: ${JSON.stringify(patch)}`);
  await page.screenshot({ path: path.join(outputDir, '02-rotated-drop.png'), fullPage: true });

  assert.equal(errors.length, 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, rotatedDuringDrag: true, errors }, null, 2));
} finally {
  await browser.close();
}
