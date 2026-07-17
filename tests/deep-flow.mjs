import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/deep-flow-v2');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

const seededProfile = {
  version: 1,
  updatedAt: new Date().toISOString(),
  stashCapacity: 16,
  backpackCapacity: 8,
  stash: [{ itemId: 'echo_dust', quantity: 12 }],
  loadout: {
    weapon: 'echo_lance',
    armor: 'miner_shell',
    head: 'cat_cap',
    shoes: 'shadow_boots',
  },
  armorCondition: 4,
  raidsStarted: 4,
  successfulExtractions: 3,
  deaths: 0,
  mapUnlocked: true,
  shortcutUnlocked: true,
  bossDefeated: false,
  endingUnlocked: false,
  endingSeen: false,
  lostEcho: null,
  activeRaid: null,
};

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
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const current = await state();
    const distance = targetX - current.player.x;
    if (Math.abs(distance) <= tolerance) return current;
    await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(220, Math.max(70, Math.abs(distance) * 1.5)));
  }
  return state();
}

async function jumpToward(takeoffX, targetX, targetY, directionHold = 1050) {
  await moveX(takeoffX, 24);
  const before = await state();
  const direction = targetX >= before.player.x ? 'KeyD' : 'KeyA';
  await page.keyboard.down(direction);
  await page.waitForTimeout(100);
  await page.keyboard.down('Space');
  await page.waitForTimeout(430);
  await page.keyboard.up('Space');
  await page.waitForTimeout(Math.max(0, directionHold - 430));
  await page.keyboard.up(direction);
  await page.waitForTimeout(430);
  let current = await state();
  for (let wait = 0; wait < 10 && !current.player.grounded; wait += 1) {
    await page.waitForTimeout(160);
    current = await state();
  }
  assert(current.player.grounded, `Player never landed after the solid-terrain jump from (${before.player.x}, ${before.player.y}).`);
  assert(current.player.y <= targetY + 55 && current.player.y < before.player.y - 70, `Solid-terrain route failed from (${before.player.x}, ${before.player.y}) to (${current.player.x}, ${current.player.y}); expected ledge near y=${targetY}.`);
  return current;
}

async function attackBurst(count = 3) {
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(235);
  }
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate((profile) => localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(profile)), seededProfile);
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /维护电梯中层站/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.locator('canvas').click({ position: { x: 640, y: 360 } });
  await page.waitForTimeout(700);

  let current = await state();
  assert(current.mode === 'raid' && current.player.x > 1380 && current.player.y > 1200, 'Lift entry did not spawn in the middle room.');
  await jumpToward(1700, 2000, 1188, 1100);
  await jumpToward(2100, 2450, 1003, 1050);
  await jumpToward(2400, 2700, 883, 980);
  await attackBurst(3);
  await jumpToward(2700, 3250, 783, 1250);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-two-axis-deep-route.png') });
  current = await state();
  assert(current.zone === '静默机房', `Expected machine room, got ${current.zone}.`);

  for (let strike = 0; strike < 12; strike += 1) {
    current = await state();
    assert(current.mode === 'raid', 'Player died during the boss fight.');
    const boss = current.visibleEnemies.find((enemy) => enemy.kind === 'warden');
    if (!boss) break;
    const distance = boss.x - current.player.x;
    if (Math.abs(distance) > 135) await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(150, Math.abs(distance) * 1.1));
    else await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', 35);
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(500);
  }
  current = await state();
  assert(current.mode === 'raid', 'Player died before the boss result could be collected.');
  const survivingBoss = current.visibleEnemies.find((enemy) => enemy.kind === 'warden');
  assert(!survivingBoss, `Boss remained alive after the combat sequence with ${survivingBoss?.health} health.`);

  for (let pickup = 0; pickup < 4; pickup += 1) {
    current = await state();
    const nextLoot = current.visibleLoot.find((loot) => loot.itemId === 'echo_core') ?? current.visibleLoot[0];
    if (!nextLoot) break;
    await moveX(nextLoot.x, 45);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
  }
  current = await state();
  assert(current.backpack.some((item) => item.itemId === 'echo_core'), '3x3 Echo Core was not placed in the 4x5 backpack.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-boss-loot-in-grid-pack.png') });

  if (current.player.y > 820) {
    await jumpToward(2700, 3250, 783, 1250);
  }
  await moveX(3620, 65);
  current = await state();
  assert(Math.abs(current.player.x - 3620) < 100, `Player missed machine-room extraction at x=${current.player.x}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3400);

  await page.getByRole('button', { name: '任务与地图' }).click();
  await page.locator('.signal-button').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(outputDir, '03-ending-ready.png'), fullPage: true });
  await page.locator('.signal-button').click();
  await page.waitForTimeout(700);
  assert(await page.getByText('收到请回答', { exact: true }).isVisible(), 'Ending title did not render.');
  assert(await page.getByText('结局一 · 尚未归巢', { exact: true }).isVisible(), 'Ending label did not render.');
  await page.screenshot({ path: path.join(outputDir, '04-ending.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, finalMode: 'ending', migratedSave: 2, twoAxisRoute: true, errors }, null, 2));
} finally {
  await browser.close();
}
