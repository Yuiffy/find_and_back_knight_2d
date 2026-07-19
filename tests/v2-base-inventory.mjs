import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/v2-base-inventory');
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4175';
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function dragTo(page, source, target, targetPosition = { x: 0.5, y: 0.5 }) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert(sourceBox && targetBox, 'Drag source or target was not visible.');

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width * targetPosition.x;
  const targetY = targetBox.y + targetBox.height * targetPosition.y;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY + 8, { steps: 2 });
  await page.mouse.move(targetX, targetY, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.version === 2, 'Fresh profile was not upgraded to v2.');
  assert(saved.warehouseSize.width === 9 && saved.warehouseSize.height === 10, 'Warehouse is not 9x10.');
  assert(saved.backpack.width === 4 && saved.backpack.height === 5, 'Equipped field pack is not 4x5.');

  const shoesSlot = page.getByRole('button', { name: /鞋/ });
  await shoesSlot.getByText('移动速度提升 12%，并解锁普通冲刺；普通冲刺不能免疫伤害。').waitFor({ state: 'visible' });

  const patchItem = page.getByRole('button', { name: /便携修补片/ });
  const bagGrid = page.getByRole('grid', { name: /随身背包/ });
  await dragTo(page, patchItem, bagGrid, { x: 0.15, y: 0.15 });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.backpack.items.some((item) => item.itemId === 'repair_patch'), 'Dragged item did not enter carried backpack.');
  assert(!saved.warehouse.some((item) => item.itemId === 'repair_patch'), 'Dragged item remained in safe warehouse.');
  await page.screenshot({ path: path.join(outputDir, '01-item-in-pack.png'), fullPage: true });

  const carriedPatch = page.getByRole('button', { name: /便携修补片/ });
  const warehouseGrid = page.getByRole('grid', { name: /基地仓库/ });
  await dragTo(page, carriedPatch, warehouseGrid, { x: 0.3, y: 0.1 });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(!saved.backpack.items.some((item) => item.itemId === 'repair_patch'), 'Item remained in backpack after unloading.');
  assert(saved.warehouse.some((item) => item.itemId === 'repair_patch'), 'Item did not return to safe warehouse.');

  await dragTo(page, shoesSlot, warehouseGrid, { x: 0.8, y: 0.8 });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.loadout.shoes === null, 'Dragging equipped shoes did not clear the loadout slot.');
  assert(saved.warehouse.some((item) => item.itemId === 'soft_boots'), 'Dragged shoes did not enter the warehouse.');

  const storedShoes = page.getByRole('button', { name: /软羽靴/ });
  await dragTo(page, storedShoes, shoesSlot);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.loadout.shoes === 'soft_boots', 'Dragging shoes back did not equip them.');
  assert(!saved.warehouse.some((item) => item.itemId === 'soft_boots'), 'Equipped shoes remained in warehouse.');

  await shoesSlot.click();
  await page.getByRole('button', { name: '卸到仓库' }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.loadout.shoes === null, 'Unload toolbar did not clear the shoes slot.');
  assert(saved.warehouse.some((item) => item.itemId === 'soft_boots'), 'Unload toolbar did not return shoes to warehouse.');
  await dragTo(page, page.getByRole('button', { name: /软羽靴/ }), shoesSlot);

  const weaponSlot = page.getByRole('button', { name: /武器/ });
  await weaponSlot.click();
  await page.getByRole('button', { name: '卸到仓库' }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.loadout.weapon === null, 'Unloading a weapon did not leave the weapon slot empty.');
  assert(saved.warehouse.filter((item) => item.itemId === 'rust_nail').reduce((total, item) => total + item.quantity, 0) === 1, 'Unloading a weapon created an extra Rust Nail.');
  await page.reload({ waitUntil: 'networkidle' });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.loadout.weapon === null, 'Reload restored a Rust Nail into an intentionally empty weapon slot.');
  assert(saved.warehouse.filter((item) => item.itemId === 'rust_nail').reduce((total, item) => total + item.quantity, 0) === 1, 'Reload duplicated the unloaded Rust Nail.');

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
