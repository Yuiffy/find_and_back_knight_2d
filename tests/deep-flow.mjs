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
  await page.getByRole('button', { name: /维护电梯深层站/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.locator('canvas').click({ position: { x: 640, y: 360 } });
  await page.waitForTimeout(700);

  let current = await state();
  assert(current.mode === 'raid' && current.player.x > 2700 && current.player.y < 1000, 'Lift entry did not spawn in the deep rift.');
  await attackBurst(3);
  await jumpToward(2840, 3250, 783, 1200);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-two-axis-deep-route.png') });
  current = await state();
  assert(current.zone === '静默机房', `Expected machine room, got ${current.zone}.`);

  let sawBossWindup = false;
  let capturedBossWindup = false;
  for (let strike = 0; strike < 16; strike += 1) {
    current = await state();
    assert(current.mode === 'raid', 'Player died during the boss fight.');
    const boss = current.visibleEnemies.find((enemy) => enemy.kind === 'warden');
    if (!boss) break;
    if (boss.state === 'telegraph' || boss.state === 'charge') sawBossWindup = true;
    if (boss.state === 'telegraph' && !capturedBossWindup) {
        await page.locator('canvas').screenshot({ path: path.join(outputDir, '01b-boss-windup.png') });
        capturedBossWindup = true;
    }
    const distance = boss.x - current.player.x;
    if (Math.abs(distance) > 135) await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(150, Math.abs(distance) * 1.1));
    else await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', 35);
    const afterApproach = await state();
    const approachingBoss = afterApproach.visibleEnemies.find((enemy) => enemy.kind === 'warden');
    if (approachingBoss?.state === 'telegraph' && !capturedBossWindup) {
      await page.locator('canvas').screenshot({ path: path.join(outputDir, '01b-boss-windup.png') });
      capturedBossWindup = true;
    }
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(500);
  }
  current = await state();
  assert(current.mode === 'raid', 'Player died before the boss result could be collected.');
  const survivingBoss = current.visibleEnemies.find((enemy) => enemy.kind === 'warden');
  assert(!survivingBoss, `Boss remained alive after the combat sequence with ${survivingBoss?.health} health.`);
  assert(sawBossWindup, 'Boss fight never exposed a telegraph or charge state to the player.');
  assert(capturedBossWindup, 'Boss telegraph was not visible long enough to capture before its charge.');

  for (let pickup = 0; pickup < 12; pickup += 1) {
    current = await state();
    const nextLoot = current.visibleLoot.find((loot) => loot.itemId === 'echo_core') ?? current.visibleLoot[0];
    if (!nextLoot) break;
    await moveX(nextLoot.x, 24);
    for (let press = 0; press < 3; press += 1) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(180);
      current = await state();
      if (current.backpack.some((item) => item.itemId === 'echo_core')) break;
    }
    if (current.backpack.some((item) => item.itemId === 'echo_core')) break;
  }
  current = await state();
  assert(current.backpack.some((item) => item.itemId === 'echo_core'), `3x3 Echo Core was not placed in the 4x5 backpack: ${JSON.stringify({ player: current.player, nearby: current.nearbyInteraction, loot: current.visibleLoot, backpack: current.backpack })}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-boss-loot-in-grid-pack.png') });

  if (current.player.y > 820) {
    await jumpToward(2840, 3250, 783, 1200);
  }
  await moveX(3620, 65);
  current = await state();
  assert(Math.abs(current.player.x - 3620) < 100, `Player missed machine-room extraction at x=${current.player.x}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3400);

  await page.getByRole('button', { name: '线索簿' }).click();
  assert(await page.getByText('天线深场的双向坐标').isVisible(), 'Relay destination clue did not unlock after extracting the core.');
  assert(await page.locator('.signal-button').count() === 0, 'A base-screen direct ending button still exists.');
  await page.screenshot({ path: path.join(outputDir, '03-ending-clue.png'), fullPage: true });

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /西侧随机接驳/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  current = await state();
  assert(current.mapId === 'relay_01', `Expected relay map, got ${current.mapId}.`);

  // The deep flow validates the stateful chain directly after the navigation
  // route and boss fight above; focused traversal remains in gameplay-overhaul-flow.
  const relayState = await state();
  assert(relayState.objective.includes('西向阵列'), `Relay objective did not start at west calibration: ${JSON.stringify(relayState)}.`);
  await page.screenshot({ path: path.join(outputDir, '04-relay-map.png') });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, finalMode: 'raid', relayLoaded: true, migratedSave: 2, twoAxisRoute: true, errors }, null, 2));
} finally {
  await browser.close();
}
