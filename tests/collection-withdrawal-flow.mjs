import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4181/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/collection-withdrawal-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function saved() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
}

async function seed(profile) {
  await page.evaluate((next) => {
    localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(next));
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });
}

async function profileWith(mutator) {
  const profile = await saved();
  await seed(mutator(profile));
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await profileWith((profile) => ({
    ...profile,
    collectionItems: [],
    warehouse: [{ uid: 'hotpot-display', itemId: 'sichuan_hotpot', quantity: 1, x: 0, y: 0, rotated: false }],
  }));
  await page.getByRole('button', { name: '收藏室' }).click();
  await page.locator('.display-candidate').filter({ hasText: '四川火锅底料' }).getByRole('button', { name: '陈列' }).click();
  let profile = await saved();
  assert(profile.collectionItems.includes('sichuan_hotpot') && !profile.warehouse.some((item) => item.itemId === 'sichuan_hotpot'), 'Exhibiting should move one collectible out of warehouse.');

  await page.getByRole('button', { name: '取回到仓库' }).click();
  await page.getByRole('status').filter({ hasText: '已取回到仓库' }).waitFor();
  profile = await saved();
  assert(!profile.collectionItems.includes('sichuan_hotpot') && profile.warehouse.some((item) => item.itemId === 'sichuan_hotpot' && item.quantity === 1), 'Withdrawal should restore one collectible to warehouse.');
  await page.screenshot({ path: path.join(outputDir, 'withdrawn-to-warehouse.png'), fullPage: true });

  await page.reload({ waitUntil: 'networkidle' });
  profile = await saved();
  assert(!profile.collectionItems.includes('sichuan_hotpot') && profile.warehouse.some((item) => item.itemId === 'sichuan_hotpot' && item.quantity === 1), 'Withdrawn collectible should persist after reload.');

  await profileWith((profile) => ({
    ...profile,
    collectionItems: ['sichuan_hotpot'],
    warehouse: Array.from({ length: profile.warehouseSize.width * profile.warehouseSize.height }, (_, index) => ({
      uid: `full-dust-${index}`,
      itemId: 'echo_dust',
      quantity: 99,
      x: index % profile.warehouseSize.width,
      y: Math.floor(index / profile.warehouseSize.width),
      rotated: false,
    })),
  }));
  await page.getByRole('button', { name: '收藏室' }).click();
  await page.getByRole('button', { name: '取回到仓库' }).click();
  await page.getByRole('status').filter({ hasText: '仓库没有足够的连续空间收回该藏品' }).waitFor();
  profile = await saved();
  assert(profile.collectionItems.includes('sichuan_hotpot'), 'Full warehouse failure must keep the collectible displayed.');
  assert(profile.warehouse.length === profile.warehouseSize.width * profile.warehouseSize.height && profile.warehouse.every((item) => item.itemId === 'echo_dust' && item.quantity === 99), 'Full warehouse failure must leave warehouse unchanged.');
  await page.screenshot({ path: path.join(outputDir, 'withdrawal-blocked-by-capacity.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, exhibit: true, withdraw: true, persistence: true, atomicCapacityFailure: true, errors }, null, 2));
} finally {
  await browser.close();
}
