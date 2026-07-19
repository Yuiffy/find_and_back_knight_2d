import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4175/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/container-auto-search');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...profile, raidsStarted: 1, bossDefeated: true, endingUnlocked: true, activeRaid: null }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭随机投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
    const delta = 390 - state.player.x;
    if (Math.abs(delta) < 48) break;
    await page.keyboard.down(delta > 0 ? 'KeyD' : 'KeyA');
    await page.waitForTimeout(Math.min(280, Math.max(70, Math.abs(delta) * 1.4)));
    await page.keyboard.up(delta > 0 ? 'KeyD' : 'KeyA');
  }
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  assert(state.nearbyInteraction?.includes('搜索'), `Container interaction did not appear: ${state.nearbyInteraction}`);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(180);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  assert(state.flags?.inventoryOpen && state.containerSearch?.searching, `Container did not open in searching state: ${JSON.stringify(state)}`);
  assert(state.containerSearch.revealed.filter((entry) => entry.active).length === 1, `Expected exactly one active search entry: ${JSON.stringify(state.containerSearch)}`);
  await page.screenshot({ path: path.join(outputDir, '01-single-active-spinner.png') });

  const firstIndex = state.containerSearch.activeIndex;
  await page.waitForTimeout(1300);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  assert(state.containerSearch.revealed[firstIndex]?.revealed, `First container item did not reveal: ${JSON.stringify(state.containerSearch)}`);
  assert(state.containerSearch.revealed.filter((entry) => entry.active).length <= 1, `More than one loading item was reported: ${JSON.stringify(state.containerSearch)}`);
  await page.screenshot({ path: path.join(outputDir, '02-search-advanced.png') });
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, automaticContainerSearch: true, errors }, null, 2));
} finally { await browser.close(); }
