import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/raid-inventory-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function enterRaid(page) {
  await page.locator('.deploy-button').click();
  await page.keyboard.press('Enter');
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(850);
}

async function dragCanvas(page, from, to) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box.');
  const point = (position) => ({
    x: box.x + (position.x / 1280) * box.width,
    y: box.y + (position.y / 720) * box.height,
  });
  const start = point(from);
  const end = point(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(220);
}

async function makePage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  return page;
}

try {
  const equipmentPage = await makePage();
  await equipmentPage.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    profile.backpack.items = [
      { uid: 'test-lance', itemId: 'echo_lance', quantity: 1, x: 0, y: 0 },
      { uid: 'test-armor', itemId: 'miner_shell', quantity: 1, x: 1, y: 0 },
    ];
    localStorage.setItem(key, JSON.stringify(profile));
  });
  await equipmentPage.reload({ waitUntil: 'networkidle' });
  await enterRaid(equipmentPage);
  await equipmentPage.keyboard.press('Tab');
  await equipmentPage.waitForTimeout(600);
  await equipmentPage.screenshot({ path: path.join(outputDir, '01-loaded-inventory.png') });

  await dragCanvas(equipmentPage, { x: 532, y: 295 }, { x: 220, y: 196 });
  let state = await readState(equipmentPage);
  assert(state.loadout.weapon === 'echo_lance', 'Dragging the lance did not equip it.');
  assert(state.backpack.some((item) => item.itemId === 'rust_nail'), 'Replaced weapon did not return to the backpack.');

  await dragCanvas(equipmentPage, { x: 656, y: 264 }, { x: 220, y: 282 });
  state = await readState(equipmentPage);
  assert(state.loadout.armor === 'miner_shell', 'Dragging the armor did not equip it.');
  assert(state.player.maxArmor === 4 && state.player.armor === 4, 'Equipped armor did not apply immediately.');
  assert(state.backpack.some((item) => item.itemId === 'stream_shell'), 'Replaced armor did not return to the backpack.');
  await equipmentPage.waitForTimeout(500);
  await equipmentPage.screenshot({ path: path.join(outputDir, '02-equipped-in-raid.png') });

  await dragCanvas(equipmentPage, { x: 532, y: 264 }, { x: 625, y: 570 });
  state = await readState(equipmentPage);
  assert(state.nearbyLoot.some((item) => item.itemId === 'rust_nail'), 'Dropped weapon did not appear nearby.');
  await dragCanvas(equipmentPage, { x: 1010, y: 205 }, { x: 220, y: 196 });
  state = await readState(equipmentPage);
  assert(state.loadout.weapon === 'rust_nail', 'Ground weapon could not be equipped directly.');
  assert(state.backpack.some((item) => item.itemId === 'echo_lance'), 'Direct ground swap did not preserve the replaced weapon.');
  await equipmentPage.waitForTimeout(500);
  await equipmentPage.screenshot({ path: path.join(outputDir, '03-ground-direct-equip.png') });
  await equipmentPage.close();

  const lootPage = await makePage();
  await lootPage.evaluate(() => localStorage.clear());
  await lootPage.reload({ waitUntil: 'networkidle' });
  await enterRaid(lootPage);
  await lootPage.keyboard.down('ArrowRight');
  await lootPage.waitForTimeout(300);
  await lootPage.keyboard.up('ArrowRight');
  await lootPage.keyboard.press('b');
  await lootPage.waitForTimeout(520);
  await lootPage.keyboard.press('Tab');
  await lootPage.waitForTimeout(180);

  state = await readState(lootPage);
  assert(state.nearbyLoot.some((item) => item.itemId === 'echo_tonic'), 'Nearby loot list omitted the starter-crate Echo Tonic.');
  await dragCanvas(lootPage, { x: 1010, y: 269 }, { x: 530, y: 190 });
  state = await readState(lootPage);
  assert(state.backpack.some((item) => item.itemId === 'echo_tonic'), 'Ground loot did not enter the backpack.');
  assert(!state.nearbyLoot.some((item) => item.itemId === 'echo_tonic'), 'Picked-up loot remained on the ground.');

  await dragCanvas(lootPage, { x: 532, y: 233 }, { x: 625, y: 570 });
  state = await readState(lootPage);
  assert(!state.backpack.some((item) => item.itemId === 'echo_tonic'), 'Dropped item remained in the backpack.');
  assert(state.nearbyLoot.some((item) => item.itemId === 'echo_tonic'), 'Dropped item did not reappear in nearby loot.');
  await lootPage.waitForTimeout(500);
  await lootPage.screenshot({ path: path.join(outputDir, '04-dropped-to-ground.png') });
  await lootPage.close();

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({
    ok: true,
    equipmentSwap: true,
    directGroundEquip: true,
    armorAppliedImmediately: true,
    nearbyPickup: true,
    dropToGround: true,
    errors,
  }, null, 2));
} finally {
  await browser.close();
}
