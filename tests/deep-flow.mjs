import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('artifacts/deep-flow');
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
    weapon: 'storm_feather',
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
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? '{}');
  return JSON.parse(raw);
}

async function hold(key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function moveToward(targetX, maximumMilliseconds = 850) {
  const current = await state();
  assert(current.mode === 'raid', `Expected raid while moving, got ${current.mode}`);
  const distance = targetX - current.player.x;
  if (Math.abs(distance) < 48) return;
  const key = distance > 0 ? 'ArrowRight' : 'ArrowLeft';
  const duration = Math.min(maximumMilliseconds, Math.max(80, Math.abs(distance) / 0.25));
  await hold(key, duration);
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate((profile) => {
    localStorage.setItem('sui-echoes-below.save.v1', JSON.stringify(profile));
  }, seededProfile);
  await page.reload({ waitUntil: 'networkidle' });

  await page.locator('.shortcut-button').click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.locator('canvas').click({ position: { x: 640, y: 360 } });
  await page.waitForTimeout(650);

  let current = await state();
  assert(current.mode === 'raid' && current.player.x >= 3150, 'Deep entry did not spawn near the lift.');

  for (let approach = 0; approach < 10; approach += 1) {
    current = await state();
    if (current.player.x >= 3540) break;
    await hold('ArrowRight', 350);
  }
  current = await state();
  assert(current.player.x >= 3520 && current.player.x < 3630, `Could not stage the deep jump at x=${current.player.x}.`);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');
  await page.waitForTimeout(230);
  await page.keyboard.press('Shift');
  await page.waitForTimeout(1550);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(180);

  current = await state();
  assert(current.mode === 'raid', 'Player died while crossing from the deep entry.');
  assert(current.player.x > 3670, `Deep gap traversal stalled at x=${current.player.x}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-deep-approach.png') });

  for (let strike = 0; strike < 14; strike += 1) {
    current = await state();
    assert(current.mode === 'raid', 'Player died during the boss fight.');
    const boss = current.visibleEnemies.find((enemy) => enemy.kind === 'warden');
    if (!boss) break;
    const distance = boss.x - current.player.x;
    if (Math.abs(distance) > 62) {
      await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(260, Math.abs(distance) * 2.3));
    }
    await page.keyboard.press('b');
    await page.waitForTimeout(235);
  }

  current = await state();
  assert(current.mode === 'raid', 'Player died before defeating the boss.');
  assert(!current.visibleEnemies.some((enemy) => enemy.kind === 'warden'), 'Boss remained alive after the combat sequence.');

  for (let pickup = 0; pickup < 5; pickup += 1) {
    current = await state();
    const core = current.visibleLoot.find((loot) => loot.itemId === 'echo_core');
    const nextLoot = core ?? current.visibleLoot[0];
    if (!nextLoot) break;
    await moveToward(nextLoot.x, 420);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(160);
  }

  current = await state();
  assert(current.backpack.some((stack) => stack.itemId === 'echo_core'), 'Echo Core was not collected.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-boss-defeated.png') });

  for (let approach = 0; approach < 12; approach += 1) {
    current = await state();
    if (current.player.x >= 4260) break;
    await hold('ArrowRight', 300);
  }
  current = await state();
  assert(current.player.x >= 4235 && current.player.x < 4310, `Could not stage deep extraction jump at x=${current.player.x}.`);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');
  await page.waitForTimeout(180);
  await page.keyboard.press('Shift');
  await page.waitForTimeout(1250);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(180);
  await moveToward(4550, 520);

  current = await state();
  assert(current.mode === 'raid', 'Player died before reaching deep extraction.');
  assert(Math.abs(current.player.x - 4550) < 105, `Player missed deep extraction at x=${current.player.x}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3400);
  await page.locator('.signal-button').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(outputDir, '03-ending-ready.png'), fullPage: true });

  await page.locator('.signal-button').click();
  await page.waitForTimeout(700);
  assert(await page.getByText('收到请回答', { exact: true }).isVisible(), 'Ending title did not render.');
  assert(await page.getByText('结局一 · 尚未归巢', { exact: true }).isVisible(), 'Ending label did not render.');
  await page.screenshot({ path: path.join(outputDir, '04-ending.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, finalMode: 'ending', errors }, null, 2));
} finally {
  await browser.close();
}
