import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/';
const output = path.resolve('.tmp/test-artifacts/lantern-comfort');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
async function tick(ms) { await page.evaluate((ms) => window.advanceTime(ms), ms); return state(); }
async function hold(key, ms) { await page.keyboard.down(key); await tick(ms); await page.keyboard.up(key); return tick(20); }

try {
  await page.addInitScript(() => {
    localStorage.setItem('sui-lantern-run.save.v1', JSON.stringify({ version: 1, attempts: 2, returns: 1, relics: ['bell'], weapon: 'blade', muted: true, controlsVisible: false, learnedControls: ['move', 'attack', 'jump', 'dash', 'interact'] }));
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
  const detail = page.getByLabel('当前武器属性');
  assert((await detail.innerText()).includes('近战挥击'));
  assert((await detail.innerText()).includes('0.34'));
  assert((await detail.innerText()).includes('弹体反射'));
  await hold('KeyJ', 80);
  const blade = await state();
  assert.equal(blade.attack?.visual, 'slash');
  await page.screenshot({ path: path.join(output, '01-blade.png') });
  await tick(350);
  await page.getByRole('button', { name: '回旋羽', exact: true }).click();
  assert((await detail.innerText()).includes('远程投掷'));
  assert((await detail.innerText()).includes('0.75'));
  assert((await detail.innerText()).includes('去程与回程各命中一次'));
  await hold('KeyJ', 80);
  const feather = await state();
  assert.equal(feather.attack?.visual, 'throw');
  assert(feather.shots.some((shot) => shot.kind === 'feather' && !shot.returning));
  await page.screenshot({ path: path.join(output, '02-feather.png') });
  await tick(420);
  assert((await state()).shots.some((shot) => shot.kind === 'feather' && shot.returning));
  await tick(700);

  await page.setViewportSize({ width: 390, height: 844 });
  await tick(2200);
  const samples = [await state()];
  for (let i = 0; i < 10; i++) {
    samples.push(await hold(i % 2 === 0 ? 'KeyA' : 'KeyD', 35));
    samples.push(await tick(90));
  }
  const cameraXs = samples.map((s) => s.camera.x);
  const cameraRange = Math.max(...cameraXs) - Math.min(...cameraXs);
  const playerXs = samples.map((s) => s.player.x);
  assert(Math.max(...playerXs) - Math.min(...playerXs) < 18);
  assert(cameraRange < 16, `Rapid turning moved the camera ${cameraRange}px.`);
  assert(samples.every((s) => Math.abs(s.camera.lookAhead) < 3));
  await page.evaluate(() => window.advanceTime(0));
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(output, '03-portrait-weapon.png') });
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = { ok: true, weaponDetails: true, separateWeaponVisuals: true, returningFeather: true, cameraRange, errors };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, state: await state().catch(() => null), errors }, null, 2));
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined);
  throw error;
} finally { await browser.close(); }
