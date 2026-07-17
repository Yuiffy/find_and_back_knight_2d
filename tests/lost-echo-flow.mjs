import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('artifacts/lost-echo-flow');
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

function profileWithLostEcho(uniqueOldItem = 'echo_lance') {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    stashCapacity: 12,
    backpackCapacity: 6,
    stash: [{ itemId: 'echo_dust', quantity: 2 }],
    loadout: { weapon: 'rust_nail', armor: null, head: null, shoes: 'soft_boots' },
    armorCondition: 0,
    raidsStarted: 2,
    successfulExtractions: 1,
    deaths: 1,
    mapUnlocked: false,
    shortcutUnlocked: false,
    bossDefeated: false,
    endingUnlocked: false,
    endingSeen: false,
    lostEcho: {
      mapId: 'hollow_01',
      x: 430,
      y: 1990,
      items: [
        { itemId: uniqueOldItem, quantity: 1 },
        { itemId: 'stream_shell', quantity: 1 },
        { itemId: 'cat_cap', quantity: 1 },
        { itemId: 'echo_dust', quantity: 3 },
      ],
      createdAtRaid: 2,
    },
    activeRaid: null,
  };
}

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

async function moveNear(targetX) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await state();
    const distance = targetX - current.player.x;
    if (Math.abs(distance) < 55) return;
    await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(420, Math.max(90, Math.abs(distance) * 2.3)));
  }
}

async function seed(profile) {
  await page.evaluate((value) => {
    localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(value));
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });

  await seed(profileWithLostEcho());
  await page.locator('.deploy-button').click();
  await page.getByRole('button', { name: /失落前庭/ }).click();
  await page.locator('canvas').click({ position: { x: 640, y: 360 } });
  await page.waitForTimeout(650);
  await moveNear(430);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-echo-found.png') });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(180);
  let current = await state();
  assert(current.flags.recoveredEcho, 'Lost Echo was not marked recovered.');

  await moveNear(520);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3400);
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.lostEcho === null, 'Recovered Lost Echo remained in the profile.');
  assert(saved.warehouse.some((stack) => stack.itemId === 'echo_lance'), 'Recovered weapon did not enter warehouse.');
  assert(saved.warehouse.some((stack) => stack.itemId === 'stream_shell'), 'Recovered armor did not enter warehouse.');
  await page.screenshot({ path: path.join(outputDir, '02-recovered-at-base.png'), fullPage: true });

  await seed(profileWithLostEcho('echo_lance'));
  await page.locator('.deploy-button').click();
  await page.getByRole('button', { name: /失落前庭/ }).click();
  await page.waitForFunction(() => window.render_game_to_text?.().includes('"mode":"raid"'));
  await page.locator('canvas').click({ position: { x: 640, y: 360 } });
  await page.waitForTimeout(1000);
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.render_game_to_text?.().includes('"mode":"base"'), null, { timeout: 5000 });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.lostEcho, 'Second death did not create a replacement Lost Echo.');
  assert(!saved.lostEcho.items.some((stack) => stack.itemId === 'echo_lance'), 'Old Lost Echo survived a second death.');
  assert(saved.lostEcho.items.some((stack) => stack.itemId === 'rust_nail'), 'Replacement Lost Echo did not contain current gear.');
  await page.screenshot({ path: path.join(outputDir, '03-old-echo-overwritten.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, recovered: true, overwritten: true, errors }, null, 2));
} finally {
  await browser.close();
}
