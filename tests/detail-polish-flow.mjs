import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/detail-polish-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function saved() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  let profile = await saved();
  assert(profile.credits === 45, `Fresh profile credits mismatch: ${JSON.stringify(profile)}.`);

  const patchItem = page.getByRole('button', { name: /便携修补片/ });
  await patchItem.click({ button: 'right' });
  profile = await saved();
  let patchStack = profile.warehouse.find((item) => item.itemId === 'repair_patch');
  assert(patchStack?.rotated === true, 'Right-click did not rotate the 1x2 patch to 2x1.');

  await page.getByRole('button', { name: /空响尘/ }).click();
  await page.getByRole('button', { name: /拆分堆叠/ }).click();
  profile = await saved();
  assert(profile.warehouse.filter((item) => item.itemId === 'echo_dust').length === 2, 'Stack split did not create a second dust stack.');
  assert(profile.warehouse.filter((item) => item.itemId === 'echo_dust').every((item) => item.quantity === 1), 'Stack split did not divide quantity 2 into 1 + 1.');

  await page.getByRole('button', { name: '拾荒交易台' }).click();
  await page.locator('.offer-row', { hasText: '空响尘' }).getByRole('button', { name: /×5/ }).click();
  profile = await saved();
  assert(profile.warehouse.filter((item) => item.itemId === 'echo_dust').reduce((sum, item) => sum + item.quantity, 0) === 7, 'Batch purchase did not add five dust.');
  assert(profile.credits === 5, `Batch purchase balance mismatch: ${profile.credits}.`);
  await page.screenshot({ path: path.join(outputDir, '00-batch-market.png'), fullPage: true });
  await page.locator('.sell-row', { hasText: '空响尘' }).getByRole('button', { name: /整组/ }).click();
  profile = await saved();
  assert(profile.warehouse.filter((item) => item.itemId === 'echo_dust').reduce((sum, item) => sum + item.quantity, 0) === 1, 'Sell-all removed the wrong dust quantity.');
  assert(profile.credits === 23, `Sell-all balance mismatch: ${profile.credits}.`);

  await page.locator('.offer-row', { hasText: '便携修补片' }).getByRole('button', { name: /×1/ }).click();
  profile = await saved();
  patchStack = profile.warehouse.find((item) => item.itemId === 'repair_patch');
  assert(profile.warehouse.filter((item) => item.itemId === 'repair_patch').length === 1, 'Purchased patch did not merge into the existing stack.');
  assert(patchStack.quantity === 2, `Merged patch stack did not reach quantity 2: ${JSON.stringify(profile.warehouse)}.`);
  assert(profile.credits === 1, `Purchase balance mismatch: ${profile.credits}.`);

  const patchSellRow = page.locator('.sell-row', { hasText: '便携修补片' });
  await patchSellRow.getByRole('button', { name: /卖 1/ }).click();
  profile = await saved();
  patchStack = profile.warehouse.find((item) => item.itemId === 'repair_patch');
  assert(patchStack.quantity === 1 && profile.credits === 10, 'Selling one stacked patch changed the wrong quantity or balance.');
  await page.screenshot({ path: path.join(outputDir, '01-market.png'), fullPage: true });

  await page.getByRole('button', { name: '装备与仓库' }).click();
  await page.getByRole('button', { name: /便携修补片/ }).dispatchEvent('dblclick');
  profile = await saved();
  assert(profile.backpack.items.some((item) => item.itemId === 'repair_patch'), `Double-click did not auto-transfer the patch to the backpack: ${JSON.stringify(profile)}.`);
  assert(!profile.warehouse.some((item) => item.itemId === 'repair_patch'), 'Quick-transferred patch remained in warehouse.');

  await page.getByRole('button', { name: '线索簿' }).click();
  assert(await page.getByText('岁己的线索簿').isVisible(), 'Clue journal did not open.');
  assert(await page.getByText('绿色信号圈').isVisible(), 'Starting clue was not recorded.');
  assert(await page.locator('.signal-button').count() === 0, 'The old direct-ending button still exists.');
  await page.screenshot({ path: path.join(outputDir, '02-clue-journal.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, rotated: true, splitStack: true, batchPurchase: true, soldGroup: true, stackedPurchase: true, soldOne: true, quickTransfer: true, clueJournal: true, errors }, null, 2));
} finally {
  await browser.close();
}
