import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/pause-guard-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

function assert(condition, message) { if (!condition) throw new Error(message); }
async function state() { return JSON.parse(await page.evaluate(() => window.render_game_to_text())); }
async function saved() { return page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1'))); }

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);

  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(180);
  let current = await state();
  assert(current.mode === 'raid' && current.flags?.paused, 'Tapping Q did not open the safe pause confirmation.');
  assert((await saved()).deaths === 0, 'Tapping Q still counted as a death.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-safe-pause.png') });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  current = await state();
  assert(!current.flags?.paused, 'Escape did not resume the raid.');

  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(100);
  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(400);
  current = await state();
  assert(current.flags?.abandonHoldActive, 'Held Q was not detected on the pause confirmation.');
  await page.waitForTimeout(950);
  await page.keyboard.up('KeyQ');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-held-confirmation.png') });
  await page.waitForTimeout(1200);
  const profile = await saved();
  assert(profile.deaths === 1, `Holding Q did not abandon exactly one raid: ${profile.deaths}.`);
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, tapProtected: true, pauseResumed: true, holdConfirmedAbandon: true, errors }, null, 2));
} finally {
  await browser.close();
}
