import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchExtractionBrowser } from './extraction-browser.mjs';
import { freshProfile, SAVE_KEY } from '../src/extraction/model.ts';
const out = '.tmp/test-artifacts/extraction-persistence';
fs.mkdirSync(out, { recursive: true });
const browser = await launchExtractionBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = async (ms) => {
  await page.evaluate((ms) => window.advanceTime(ms), ms);
  await page.waitForTimeout(60);
  return state();
};
const ready = () =>
  page.waitForFunction(() =>
    window.render_game_to_text?.().includes('"phase":"base"'),
  );
try {
  await page.goto('http://127.0.0.1:4175/knight/');
  await ready();
  const p = freshProfile();
  p.guns.kestrel = 0;
  p.armors = 0;
  p.meds = 0;
  p.credits = 4500;
  p.lost = { x: -32, z: 37, items: ['gold', 'medicine'], weapon: 'heron' };
  await page.evaluate(
    ({ p, key }) => {
      localStorage.setItem(key, JSON.stringify(p));
      localStorage.setItem(
        'sui-lantern-run.save.v1',
        '{"version":1,"returns":7}',
      );
      localStorage.setItem(
        'sui-echoes-below.save.v1',
        '{"sentinel":"preserve"}',
      );
    },
    { p, key: SAVE_KEY },
  );
  await page.reload();
  await ready();
  await page.getByRole('button', { name: '准备部署' }).click();
  await page.getByRole('button', { name: '领取免费救援装备' }).click();
  await page.locator('#ex-deploy').click();
  await tick(0);
  await page.keyboard.press('KeyE');
  await tick(100);
  assert((await state()).recovered);
  await page.getByRole('button', { name: '收纳已识别物资' }).click();
  await page.keyboard.press('Escape');
  await tick(20);
  await page.keyboard.down('KeyS');
  await tick(1000);
  await page.keyboard.up('KeyS');
  await tick(6500);
  assert.equal((await state()).phase, 'won');
  assert.equal((await state()).profile.guns.heron, 1);
  assert.equal((await state()).profile.lost, null);
  await page.screenshot({ path: `${out}/recovered.png` });
  await page.getByRole('button', { name: '返回基地' }).click();
  await page.getByRole('button', { name: '03 仓库 / 后勤' }).click();
  for (const price of [360, 220, 65, 300, 800, 600])
    await page.getByRole('button', { name: `₭ ${price}`, exact: true }).click();
  let saved = (await state()).profile;
  assert.equal(saved.packLevel, 1);
  assert.equal(saved.stashLevel, 1);
  assert.equal(saved.suppressors, 1);
  assert.equal(saved.guns.shrike, 1);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /音效/ }).click();
  await page.getByRole('button', { name: /画质/ }).click();
  await page.getByRole('button', { name: /减少.*动态/ }).click();
  await page.getByRole('button', { name: '关闭面板' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出存档' }).click();
  const download = await downloadPromise;
  const path = `${out}/export.json`;
  await download.saveAs(path);
  const exported = JSON.parse(fs.readFileSync(path, 'utf8'));
  assert(exported.settings.muted);
  assert.equal(exported.settings.quality, 'low');
  assert(exported.settings.reducedMotion);
  await page.getByRole('button', { name: '出售', exact: true }).first().click();
  assert((await state()).profile.credits > exported.credits);
  await page.locator('input[type=file]').setInputFiles(path);
  await page.waitForFunction(
    (credits) =>
      JSON.parse(window.render_game_to_text()).profile.credits === credits,
    exported.credits,
  );
  assert.deepEqual((await state()).profile, exported);
  await page.reload();
  await ready();
  assert.deepEqual((await state()).profile, exported);
  await page.getByRole('button', { name: '准备部署' }).click();
  await page.locator('#ex-deploy').click();
  await tick(0);
  assert.equal((await state()).capacity, 30);
  // Tab and map shortcuts cannot resume a paused simulation.
  await page.keyboard.press('Escape');
  await tick(0);
  const t = (await state()).elapsed;
  await page.keyboard.press('Tab');
  await page.keyboard.press('KeyM');
  await tick(4000);
  assert.equal((await state()).elapsed, t);
  assert.equal((await state()).panel, 'pause');
  await page.getByRole('button', { name: '继续行动' }).click();
  await tick(0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await tick(0);
  const blurTime = (await state()).elapsed;
  await tick(1000);
  assert.equal((await state()).elapsed, blurTime);
  assert.equal((await state()).panel, 'pause');
  // Refresh consumes the single deployed kit exactly once; another refresh is idempotent.
  await page.reload();
  await ready();
  const interrupted = (await state()).profile;
  assert.equal(interrupted.active, null);
  assert(interrupted.last.reason.includes('中断'));
  await page.reload();
  await ready();
  assert.deepEqual((await state()).profile, interrupted);
  assert.equal(
    await page.evaluate(() => localStorage.getItem('sui-lantern-run.save.v1')),
    '{"version":1,"returns":7}',
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('sui-echoes-below.save.v1')),
    '{"sentinel":"preserve"}',
  );
  await page.getByRole('button', { name: '03 仓库 / 后勤' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":99}'),
    });
  await page.waitForTimeout(100);
  assert.deepEqual((await state()).profile, interrupted);
  await page.evaluate(key => localStorage.setItem(key, 'broken-json'), SAVE_KEY);
  await page.reload();
  await ready();
  assert(await page.getByRole('alert').isVisible());
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), 'broken-json');
  await page.getByRole('button', { name: '备份旧记录并启用保存' }).click();
  assert.equal(await page.evaluate(key => localStorage.getItem(`${key}.backup`), SAVE_KEY), 'broken-json');
  assert.deepEqual(errors, []);
  console.log(
    'Recovery, purchases, upgrades, settings, export/import, paused shortcuts, interruption, save isolation PASS',
  );
} finally {
  await browser.close();
}
