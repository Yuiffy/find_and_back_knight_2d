import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/directional-combat');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function state() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
}
async function hold(key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}
async function moveX(targetX, tolerance = 35) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const current = await state();
    const distance = targetX - current.player.x;
    if (Math.abs(distance) <= tolerance) return current;
    await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(210, Math.max(60, Math.abs(distance) * 1.4)));
  }
  return state();
}

try {
  await page.goto('http://127.0.0.1:4175/knight/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...profile, raidsStarted: 2, activeRaid: null }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭随机投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.mode === 'raid' && Boolean(current.player);
  });

  await page.keyboard.down('KeyW');
  await page.keyboard.press('KeyJ');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(180);
  let current = await state();
  assert(current.lastAttack?.direction === 'up', `W+J did not create an upstrike: ${JSON.stringify(current.lastAttack)}.`);
  await page.waitForTimeout(420);

  await moveX(390);
  await page.keyboard.down('KeyD');
  await page.keyboard.down('Space');
  await page.waitForTimeout(160);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.mode === 'raid' && current.player && !current.player.grounded && current.player.velocityY > 0;
  }, undefined, { timeout: 1200 });
  await page.keyboard.down('KeyS');
  await page.keyboard.down('KeyJ');
  await page.waitForTimeout(80);
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('KeyS');
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(180);
  current = await state();
  assert(current.lastAttack?.direction === 'down', `S+J in air did not create a downstrike: ${JSON.stringify(current.lastAttack)}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-directional-attacks.png') });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, upstrike: true, downstrike: true, lastAttack: current.lastAttack, errors }, null, 2));
} finally {
  await browser.close();
}
