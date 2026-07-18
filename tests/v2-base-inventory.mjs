import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/v2-base-inventory');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.version === 2, 'Fresh profile was not upgraded to v2.');
  assert(saved.warehouseSize.width === 9 && saved.warehouseSize.height === 10, 'Warehouse is not 9x10.');
  assert(saved.backpack.width === 4 && saved.backpack.height === 5, 'Equipped field pack is not 4x5.');

  const patchItem = page.getByRole('button', { name: /便携修补片/ });
  const bagGrid = page.getByRole('grid', { name: /随身背包/ });
  await patchItem.dragTo(bagGrid, { targetPosition: { x: 35, y: 45 } });
  await page.waitForTimeout(250);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.backpack.items.some((item) => item.itemId === 'repair_patch'), 'Dragged item did not enter carried backpack.');
  assert(!saved.warehouse.some((item) => item.itemId === 'repair_patch'), 'Dragged item remained in safe warehouse.');
  await page.screenshot({ path: path.join(outputDir, '01-item-in-pack.png'), fullPage: true });

  const carriedPatch = page.getByRole('button', { name: /便携修补片/ });
  const warehouseGrid = page.getByRole('grid', { name: /基地仓库/ });
  await carriedPatch.dragTo(warehouseGrid, { targetPosition: { x: 190, y: 45 } });
  await page.waitForTimeout(250);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(!saved.backpack.items.some((item) => item.itemId === 'repair_patch'), 'Item remained in backpack after unloading.');
  assert(saved.warehouse.some((item) => item.itemId === 'repair_patch'), 'Item did not return to safe warehouse.');

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('dialog').waitFor();
  assert(await page.getByRole('button', { name: /失落前庭/ }).isEnabled(), 'Foyer entry is not selectable.');
  assert(!(await page.getByRole('button', { name: /维护电梯深层站/ }).isEnabled()), 'Locked lift entry is unexpectedly enabled.');
  await page.screenshot({ path: path.join(outputDir, '02-entry-dialog.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, warehouse: '9x10', backpack: '4x5', dragInAndOut: true, entryDialog: true, errors }, null, 2));
} finally {
  await browser.close();
}
