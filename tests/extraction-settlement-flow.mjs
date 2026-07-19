import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/extraction-settlement-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

const profile = {
  version: 2,
  updatedAt: new Date().toISOString(),
  warehouseSize: { width: 9, height: 10 },
  warehouse: [],
  loadout: { weapon: 'rust_nail', armor: 'stream_shell', head: null, shoes: 'soft_boots', backpack: 'field_pack' },
  backpack: { width: 4, height: 5, items: [] },
  armorCondition: 1,
  raidsStarted: 1,
  successfulExtractions: 2,
  deaths: 0,
  credits: 45,
  discoveredItems: ['rust_nail', 'stream_shell', 'soft_boots', 'field_pack'],
  discoveredClues: ['arrival', 'map-trace', 'lift-trace', 'warden-trace', 'home-trace'],
  mapUnlocked: true,
  shortcutUnlocked: true,
  bossDefeated: true,
  endingUnlocked: true,
  endingSeen: false,
  lostEcho: null,
  activeRaid: null,
};

function assert(condition, message) { if (!condition) throw new Error(message); }
async function state() { return JSON.parse(await page.evaluate(() => window.render_game_to_text())); }
async function hold(key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}
async function moveX(targetX) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const current = await state();
    const distance = targetX - current.player.x;
    if (Math.abs(distance) < 45) return;
    await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(220, Math.max(70, Math.abs(distance) * 1.4)));
  }
}
async function enterRelay() {
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /西侧随机接驳/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  const current = await state();
  assert(current.mapId === 'relay_01', `Expected relay map: ${JSON.stringify(current)}.`);
}

try {
  await page.goto('http://127.0.0.1:4175/knight/', { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(value)), profile);
  await page.reload({ waitUntil: 'networkidle' });

  await enterRelay();
  await moveX(760);
  let current = await state();
  assert(current.nearbyInteraction?.includes('校准西向'), `West calibration was not reachable: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(160);
  current = await state();
  assert(current.objective.includes('东向阵列'), `West calibration did not advance this run: ${current.objective}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-calibrated-before-failure.png') });

  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(1450);
  await page.keyboard.up('KeyQ');
  await page.getByRole('button', { name: '选择入口并开始远征' }).waitFor({ state: 'visible', timeout: 3500 });
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(!saved.discoveredClues.includes('relay-west-calibrated'), 'Failed expedition permanently saved west relay calibration.');

  await enterRelay();
  current = await state();
  assert(current.objective.includes('西向阵列'), `Failed relay calibration incorrectly persisted: ${current.objective}.`);
  await moveX(760);
  current = await state();
  if (current.nearbyInteraction?.includes('找回遗失回声')) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  for (let attempt = 0; attempt < 5 && !current.nearbyInteraction?.includes('校准西向'); attempt += 1) {
    await hold('ArrowRight', 180);
    current = await state();
  }
  assert(current.nearbyInteraction?.includes('校准西向'), `West calibration was not available on the retry: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  for (let attempt = 0; attempt < 5 && !current.objective.includes('东向阵列'); attempt += 1) {
    await page.waitForTimeout(110);
    current = await state();
  }
  assert(current.objective.includes('东向阵列'), `Retry calibration did not advance the objective: ${current.objective}.`);
  await moveX(350);
  current = await state();
  if (current.nearbyInteraction?.includes('聆听')) {
    await page.keyboard.press('Enter');
    await hold('ArrowLeft', 150);
    current = await state();
  }
  assert(current.nearbyInteraction?.includes('安全撤离'), `West extraction was not reachable: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4800);
  current = await state();
  assert(current.mode === 'base', `Extraction did not settle the relay run: ${JSON.stringify(current)}.`);
  await page.getByRole('button', { name: '选择入口并开始远征' }).waitFor({ state: 'visible', timeout: 3500 });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.discoveredClues.includes('relay-west-calibrated'), `Extracted relay calibration was not persisted: ${JSON.stringify(saved.discoveredClues)}.`);
  await page.screenshot({ path: path.join(outputDir, '02-extracted-calibration-persisted.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, failedCalibrationDiscarded: true, extractedCalibrationPersisted: true, errors }, null, 2));
} finally {
  await browser.close();
}
