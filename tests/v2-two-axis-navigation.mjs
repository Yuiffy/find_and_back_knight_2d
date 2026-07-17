import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/v2-two-axis-navigation');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
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

async function moveX(target, tolerance = 24) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const current = await state();
    const dx = target - current.player.x;
    if (Math.abs(dx) <= tolerance) return current;
    await hold(dx > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(180, Math.max(55, Math.abs(dx) * 1.35)));
  }
  return state();
}

async function attackBurst() {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(380);
  }
}

async function jumpToward(targetX, targetY, directionHold = 500) {
  const before = await state();
  const direction = targetX >= before.player.x ? 'KeyD' : 'KeyA';
  await page.keyboard.down(direction);
  await page.waitForTimeout(300);
  await page.keyboard.down('Space');
  await page.waitForTimeout(350);
  await page.keyboard.up('Space');
  await page.waitForTimeout(Math.max(0, directionHold - 350));
  await page.keyboard.up(direction);
  await page.waitForTimeout(430);
  const after = await state();
  assert(after.player.y <= targetY + 35, `Could not reach platform near (${targetX}, ${targetY}); landed at (${after.player.x}, ${after.player.y}).`);
  return after;
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭/ }).click();
  await page.waitForFunction(() => window.render_game_to_text?.().includes('"mode":"raid"'));
  await page.locator('canvas').click({ position: { x: 640, y: 360 } });
  await page.waitForTimeout(700);

  await moveX(620);
  await attackBurst();
  await moveX(620);
  await jumpToward(780, 1925, 650);
  await jumpToward(900, 1820, 650);
  await jumpToward(780, 1715, 650);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-mid-shaft.png') });
  await jumpToward(900, 1610, 650);
  await jumpToward(780, 1505, 650);
  await jumpToward(900, 1405, 650);
  const reached = await state();
  assert(reached.player.y < 1500, `Player did not climb vertically; y=${reached.player.y}.`);
  assert(Math.abs(reached.player.y - 2033) > 400, 'Camera route still behaves like a flat horizontal strip.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-upper-foyer.png') });

  await page.keyboard.press('KeyM');
  await page.waitForTimeout(180);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '03-two-axis-map.png') });
  await page.keyboard.press('KeyM');

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, startY: 2033, reached: { x: reached.player.x, y: reached.player.y }, climbedPixels: 2033 - reached.player.y, errors }, null, 2));
} finally {
  await browser.close();
}
