import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchExtractionBrowser } from './extraction-browser.mjs';

const out = '.tmp/test-artifacts/extraction-art';
fs.mkdirSync(out, { recursive: true });
const browser = await launchExtractionBrowser();
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const ready = () => page.waitForFunction(() => {
  const s = JSON.parse(window.render_game_to_text?.() || '{}');
  return s.visual?.triangles > 0 && s.visual?.drawCalls > 0;
});
const shot = async (name) => {
  await ready();
  await page.waitForTimeout(350);
  return page.locator('canvas').screenshot({ path: `${out}/${name}.png` });
};
const settings = () => page.getByRole('button', { name: /^(设置|音效与画质)$/ }).click();
const close = () => page.getByRole('button', { name: '关闭面板' }).click();
const quality = () => page.getByRole('button', { name: /画质/ }).click();

try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4175/knight/');
  await ready();
  const front = await shot('front');
  const yaw = (await state()).operatorYaw;
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '向右旋转岁己' }).click();
  const side = await shot('side');
  assert((await state()).operatorYaw > yaw + 1, 'The visible rotation control must rotate the operator');
  assert(!front.equals(side), 'Rotation must change the rendered character');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '向右旋转岁己' }).click();
  await shot('back');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '向左旋转岁己' }).click();
  assert(Math.abs((await state()).operatorYaw - yaw) < 0.001);

  await settings();
  await page.getByRole('button', { name: /减少.*动态/ }).click();
  await quality();
  await close();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).visual?.quality === 'low');
  const low = await shot('base-low-reduced');
  await page.waitForTimeout(800);
  const still = await shot('base-low-still');
  assert(low.equals(still), 'Reduced motion must stop decorative animation in the base canvas');
  await settings();
  await quality();
  await close();
  await shot('base-high-reduced');
  assert.equal((await state()).visual.quality, 'high');
  await page.reload();
  await ready();
  assert.equal((await state()).visual.reducedMotion, true);
  assert.equal((await state()).visual.quality, 'high');

  await page.getByRole('button', { name: '准备部署' }).click();
  await page.locator('#ex-deploy').click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'raid');
  await page.evaluate(() => window.advanceTime(0));
  await page.waitForTimeout(2000);
  const highRaid = (await state()).visual;
  const renderer = await page.locator('canvas').evaluate((c) => {
    const gl = c.getContext('webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  await shot('raid-high');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await settings();
  await quality();
  await close();
  await page.waitForTimeout(1200);
  await shot('raid-low');
  const lowRaid = (await state()).visual;
  assert.equal(lowRaid.quality, 'low');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await settings();
  await quality();
  await close();
  await shot('raid-high-restored');
  assert.equal((await state()).visual.quality, 'high');
  assert.deepEqual(errors, []);
  const report = { renderer, highRaid, lowRaid, reducedMotionCanvasStable: true, errors };
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log('Operator rotation, quality switching and reduced-motion persistence PASS', JSON.stringify(report));
} finally {
  await browser.close();
}
