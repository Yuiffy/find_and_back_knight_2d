import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/quick-buy-flow');
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

async function seed(mutator) {
  await page.evaluate((source) => {
    const key = 'sui-echoes-below.save.v1';
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(source(current)));
  }, mutator.toString());
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '拾荒交易台' }).click();

  const lastLoadoutButton = page.getByRole('button', { name: '暂无整备' });
  assert(await lastLoadoutButton.isDisabled(), 'Fresh profile should not offer a last-loadout rebuy.');
  const starterButton = page.getByRole('button', { name: /一键购买 · ◈ 110/ });
  assert(await starterButton.isDisabled(), 'Fresh profile should not afford the 110-credit starter kit.');

  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const current = JSON.parse(localStorage.getItem(key));
    current.credits = 500;
    localStorage.setItem(key, JSON.stringify(current));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '拾荒交易台' }).click();
  const beforeStarter = await saved();
  await page.getByRole('button', { name: /一键购买 · ◈ 110/ }).click();
  let profile = await saved();
  assert(profile.credits === 390, `Starter kit price should deduct 110 credits, got ${profile.credits}.`);
  assert(profile.warehouse.filter((item) => item.itemId === 'rust_nail').length === 1, 'Starter kit should add one rust nail to warehouse.');
  assert(profile.warehouse.filter((item) => item.itemId === 'field_pack').length === 1, 'Starter kit should add one field pack to warehouse.');
  assert(JSON.stringify(profile.loadout) === JSON.stringify(beforeStarter.loadout), 'Starter quick buy must not auto-equip or alter current loadout.');

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /失落前庭随机投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  profile = await saved();
  assert(JSON.stringify(profile.lastDeployedLoadout) === JSON.stringify(beforeStarter.loadout), 'Starting an expedition should persist the equipment worn at deployment for rebuy.');
  await page.reload({ waitUntil: 'networkidle' });

  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const current = JSON.parse(localStorage.getItem(key));
    current.credits = 500;
    current.lastDeployedLoadout = { weapon: 'rust_nail', armor: null, head: null, shoes: null, backpack: 'field_pack' };
    localStorage.setItem(key, JSON.stringify(current));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '拾荒交易台' }).click();
  const rebuyButton = page.getByRole('button', { name: /一键复购 · ◈ 110/ });
  assert(await rebuyButton.isEnabled(), 'Valid partial prior loadout should be eligible for rebuy.');
  const warehouseCountBefore = (await saved()).warehouse.length;
  await rebuyButton.click();
  profile = await saved();
  assert(profile.credits === 390, `Last-loadout rebuy price should deduct 110 credits, got ${profile.credits}.`);
  assert(profile.warehouse.length >= warehouseCountBefore + 2, 'Rebuy should add both non-empty historical equipment items.');
  await page.screenshot({ path: path.join(outputDir, 'market-quick-buy.png'), fullPage: true });

  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const current = JSON.parse(localStorage.getItem(key));
    current.credits = 500;
    current.warehouseSize = { width: 9, height: 10 };
    current.warehouse = Array.from({ length: 90 }, (_, index) => ({
      uid: `dust-${index}`,
      itemId: 'echo_dust',
      quantity: 1,
      x: index % 9,
      y: Math.floor(index / 9),
      rotated: false,
    }));
    current.lastDeployedLoadout = { weapon: 'rust_nail', armor: null, head: null, shoes: null, backpack: 'field_pack' };
    localStorage.setItem(key, JSON.stringify(current));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '拾荒交易台' }).click();
  await page.getByRole('button', { name: /一键复购 · ◈ 110/ }).click();
  profile = await saved();
  assert(profile.credits === 500, 'A full warehouse must not deduct credits for an atomic quick-buy failure.');
  assert(profile.warehouse.length === 90 && profile.warehouse.every((item) => item.itemId === 'echo_dust'), 'Atomic quick-buy failure must not partially deliver equipment.');
  assert(await page.getByRole('status').filter({ hasText: '仓库没有足够的连续空间' }).isVisible(), 'Capacity failure should show a clear status notice.');

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, starterKit: true, lastLoadoutRebuy: true, atomicCapacityFailure: true, errors }, null, 2));
} finally {
  await browser.close();
}
