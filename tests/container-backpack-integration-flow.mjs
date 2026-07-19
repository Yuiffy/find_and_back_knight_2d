import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4175/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/container-backpack-integration');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
async function state(page) { return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')); }

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...profile, raidsStarted: 1, activeRaid: null }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭随机投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await state(page);
    const delta = 390 - current.player.x;
    if (Math.abs(delta) < 48) break;
    await page.keyboard.down(delta > 0 ? 'KeyD' : 'KeyA');
    await page.waitForTimeout(Math.min(280, Math.max(70, Math.abs(delta) * 1.4)));
    await page.keyboard.up(delta > 0 ? 'KeyD' : 'KeyA');
  }
  let current = await state(page);
  assert(current.nearbyInteraction?.includes('搜索'), `Container interaction did not appear: ${current.nearbyInteraction}`);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1100);
  current = await state(page);
  assert(current.flags?.inventoryOpen && current.containerSearch, `Container backpack panel did not open: ${JSON.stringify(current)}`);
  const revealed = current.containerSearch.revealed.findIndex((entry) => entry.revealed);
  assert(revealed >= 0, `No container item revealed: ${JSON.stringify(current.containerSearch)}`);
  await page.screenshot({ path: path.join(outputDir, '01-container-ready.png') });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box.');
  const point = (x, y) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });
  const from = point(878, 202);
  const to = point(530, 200);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(240);
  current = await state(page);
  assert(current.backpack.some((entry) => entry.itemId === 'echo_dust'), `Container item was not dragged into backpack: ${JSON.stringify(current.backpack)}`);
  assert(current.containerSearch.revealed.length < 3, `Container source did not shrink after transfer: ${JSON.stringify(current.containerSearch)}`);

  // The opened-container view keeps nearby ground loot in the lower right panel.
  assert(Array.isArray(current.nearbyLoot), `Nearby loot state disappeared while container stayed open: ${JSON.stringify(current)}`);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(260);
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(120);
  current = await state(page);
  assert(current.flags?.inventoryOpen && current.containerSearch, 'Container panel unexpectedly closed while moving near ground loot.');
  await page.screenshot({ path: path.join(outputDir, '02-container-item-dragged.png') });
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, containerDragToBackpack: true, errors }, null, 2));
} finally { await browser.close(); }
