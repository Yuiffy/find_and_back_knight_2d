import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/responsive-visual');
fs.mkdirSync(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function state(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
}

async function assertInsideViewport(locator, label) {
  const box = await locator.boundingBox();
  assert(box, `${label} has no visible bounds.`);
  const viewport = locator.page().viewportSize();
  assert(viewport, 'Viewport size is unavailable.');
  assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `${label} exceeds ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}.`);
}

const browser = await chromium.launch({ headless: true });
const portraitContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await portraitContext.newPage();
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('sui-echoes-below.save.v1'));
  await page.reload({ waitUntil: 'networkidle' });
  const baseOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(baseOverflow <= 1, `Portrait base overflows horizontally by ${baseOverflow}px.`);
  await page.screenshot({ path: path.join(outputDir, '01-base-portrait.png'), fullPage: true });

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  const dialog = page.getByRole('dialog', { name: '选择地图与入口' });
  await dialog.waitFor({ state: 'visible' });
  await assertInsideViewport(dialog, 'Deployment dialog');
  await page.screenshot({ path: path.join(outputDir, '02-contract-portrait.png') });

  await page.getByRole('button', { name: /失落前庭随机投放/ }).click();
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible' });
  await page.getByLabel('触屏游戏操作').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  assert((await state(page)).mode === 'raid', 'Portrait deployment did not enter the raid.');
  await assertInsideViewport(canvas, 'Portrait game canvas');
  const portraitMetrics = await page.evaluate(() => ({
    inner: { width: window.innerWidth, height: window.innerHeight },
    visual: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height } : null,
    shell: document.querySelector('.raid-shell')?.getBoundingClientRect().toJSON(),
    canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON(),
  }));
  for (const label of ['跳跃', '攻击', '冲刺', '互动', '地图', '背包', '修补', '糖浆', '暂停']) {
    await assertInsideViewport(page.getByRole('button', { name: label }), `Touch control ${label}`);
  }
  await page.screenshot({ path: path.join(outputDir, '03-raid-portrait.png') });

  await portraitContext.close();

  const landscapeContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const landscapePage = await landscapeContext.newPage();
  landscapePage.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  landscapePage.on('pageerror', (error) => errors.push(error.message));
  await landscapePage.goto(baseUrl, { waitUntil: 'networkidle' });
  await landscapePage.evaluate(() => localStorage.removeItem('sui-echoes-below.save.v1'));
  await landscapePage.reload({ waitUntil: 'networkidle' });
  await landscapePage.getByRole('button', { name: '选择入口并开始远征' }).click();
  await landscapePage.getByRole('button', { name: /失落前庭随机投放/ }).click();
  const landscapeCanvas = landscapePage.locator('canvas');
  await landscapeCanvas.waitFor({ state: 'visible' });
  await landscapePage.getByLabel('触屏游戏操作').waitFor({ state: 'visible' });
  await landscapePage.waitForTimeout(800);
  await assertInsideViewport(landscapeCanvas, 'Landscape game canvas');
  const landscapeMetrics = await landscapePage.evaluate(() => ({
    inner: { width: window.innerWidth, height: window.innerHeight },
    visual: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height } : null,
    shell: document.querySelector('.raid-shell')?.getBoundingClientRect().toJSON(),
    canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON(),
  }));
  await landscapePage.getByRole('button', { name: '跳跃' }).tap();
  await landscapePage.waitForTimeout(180);
  const afterJump = await state(landscapePage);
  assert(afterJump.expedition?.onboarding.jumped, `Touch jump did not reach the scene: ${JSON.stringify(afterJump.expedition?.onboarding)}.`);
  await landscapePage.screenshot({ path: path.join(outputDir, '04-raid-landscape.png') });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, portraitBase: true, portraitContract: true, portraitRaid: true, landscapeRaid: true, touchJump: true, portraitMetrics, landscapeMetrics, errors }, null, 2));
} finally {
  await browser.close();
}
