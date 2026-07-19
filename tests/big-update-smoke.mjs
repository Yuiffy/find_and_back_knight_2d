import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4181/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/big-update-smoke');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
}

async function seed(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...profile,
      credits: 999,
      warehouseLevel: 1,
      workshopLevel: 1,
      collectionItems: [],
      lostEcho: { mapId: 'relay_01', x: 450, y: 1510, items: [{ itemId: 'echo_dust', quantity: 1 }], createdAtRaid: 2 },
      warehouse: [
        { uid: 'hotpot-display', itemId: 'sichuan_hotpot', quantity: 1, x: 0, y: 0, rotated: false },
        { uid: 'dust-stack', itemId: 'echo_dust', quantity: 3, x: 2, y: 0, rotated: false },
      ],
      backpack: { ...profile.backpack, items: [{ uid: 'bag-food', itemId: 'beef_jerky', quantity: 1, x: 0, y: 0, rotated: false }] },
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function hold(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function moveX(page, targetX) {
  for (let attempt = 0; attempt < 26; attempt += 1) {
    const state = await readState(page);
    const delta = targetX - state.player.x;
    if (Math.abs(delta) < 48) return;
    await hold(page, delta > 0 ? 'KeyD' : 'KeyA', Math.min(280, Math.max(70, Math.abs(delta) * 1.4)));
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await seed(page);

  assert(await page.getByRole('button', { name: '一键入库' }).isEnabled(), 'Backpack deposit button did not render enabled.');
  await page.getByRole('button', { name: '一键入库' }).click();
  await page.getByText(/一键入库完成/).waitFor();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.backpack.items.length === 0 && saved.warehouse.some((item) => item.itemId === 'beef_jerky'), 'One-click deposit did not move backpack loot into warehouse.');

  await page.getByRole('button', { name: '工作台' }).click();
  await page.getByRole('button', { name: /扩建 · ◈ 90/ }).click();
  await page.getByRole('button', { name: /升级 · ◈ 120/ }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.warehouseLevel === 2 && saved.workshopLevel === 2 && saved.credits === 789, `Home upgrades failed: ${JSON.stringify(saved)}`);

  await page.getByRole('button', { name: '收藏室' }).click();
  await page.locator('.display-candidate').filter({ hasText: '四川火锅底料' }).getByRole('button', { name: '陈列' }).click();
  await page.getByText('四川火锅底料').first().waitFor();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.collectionItems.includes('sichuan_hotpot') && !saved.warehouse.some((item) => item.itemId === 'sichuan_hotpot'), 'Collectible was not permanently exhibited.');
  await page.screenshot({ path: path.join(outputDir, '01-collection-room.png'), fullPage: true });

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭随机投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  let state = await readState(page);
  assert(state.render?.backingWidth === 1280 && state.render?.backingHeight === 720, 'QHD logical backing surface regressed.');
  await moveX(page, 390);
  state = await readState(page);
  assert(state.nearbyInteraction?.includes('搜索'), `Container interaction did not appear: ${state.nearbyInteraction}`);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2100);
  state = await readState(page);
  assert(state.visibleLoot.length >= 2 && state.visibleLoot.some((item) => item.itemId === 'echo_dust' || item.itemId === 'echo_tonic'), `Container search did not reveal its loot: ${JSON.stringify(state.visibleLoot)}`);
  await page.screenshot({ path: path.join(outputDir, '02-container-search.png') });

  await page.keyboard.press('KeyM');
  await page.waitForTimeout(140);
  await page.screenshot({ path: path.join(outputDir, '03-map-overlay.png') });
  await page.keyboard.press('KeyM');

  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...profile, activeRaid: null, bossDefeated: true, endingUnlocked: true, discoveredClues: [...new Set([...(profile.discoveredClues ?? []), 'home-trace'])] }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /西侧随机接驳/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(600);
  await hold(page, 'KeyA', 1800);
  await page.waitForTimeout(500);
  state = await readState(page);
  assert(state.mapId === 'hollow_01', `Walk-through edge passage failed: ${JSON.stringify(state)}`);
  await page.screenshot({ path: path.join(outputDir, '04-boundary-transition.png') });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, home: true, collection: true, containerSearch: true, boundaryPassage: true, errors }, null, 2));
} finally {
  await browser.close();
}
