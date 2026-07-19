import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/lost-echo-flow');
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

function profileWithLostEcho() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    stashCapacity: 12,
    backpackCapacity: 6,
    stash: [{ itemId: 'echo_dust', quantity: 2 }],
    loadout: { weapon: 'rust_nail', armor: null, head: null, shoes: 'soft_boots', backpack: 'field_pack' },
    armorCondition: 0,
    raidsStarted: 1,
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
        { itemId: 'echo_lance', quantity: 1 },
        { itemId: 'stream_shell', quantity: 1 },
        { itemId: 'cat_cap', quantity: 1 },
        { itemId: 'echo_dust', quantity: 3 },
        { itemId: 'echo_core', quantity: 1 },
        { itemId: 'shiori_library_parcel', quantity: 1 },
        { itemId: 'airlift_firecloud', quantity: 1 },
        { itemId: 'inn_leather_shoes', quantity: 1 },
        { itemId: 'sichuan_hotpot', quantity: 1 },
        { itemId: 'rtx_3050', quantity: 1 },
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
    if (Math.abs(distance) < 15) return;
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
  let current = await state();
  assert(current.nearbyInteraction?.includes('打开遗失遗体'), `Lost corpse was not interactable: ${JSON.stringify({ player: current.player, nearbyInteraction: current.nearbyInteraction })}.`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-lost-corpse-found.png') });

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flags?.lostCorpseOpen === true, undefined, { timeout: 800 });
  current = await state();
  assert(current.flags.lostCorpseOpen, 'Lost corpse did not open as an immediate container.');
  assert(current.flags.lostCorpseRemaining, 'Opened corpse unexpectedly had no remaining items.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-corpse-open-immediate.png') });

  await page.mouse.click(1010, 548);
  await page.waitForTimeout(260);
  current = await state();
  assert(current.backpack.some((item) => item.itemId === 'echo_lance'), `One-click corpse transfer did not place equipment in backpack: ${JSON.stringify(current)}.`);
  assert(current.flags.lostCorpseRemaining, 'One-click transfer should leave items that do not fit in the field pack.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '03-corpse-partially-looted.png') });

  await page.keyboard.press('Tab');
  await page.waitForTimeout(120);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flags?.lostCorpseOpen === true, undefined, { timeout: 800 });
  current = await state();
  assert(current.flags.lostCorpseRemaining, 'Closing and reopening erased the partial corpse contents.');

  await page.keyboard.press('Tab');
  await moveNear(520);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3400);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.lostEcho?.items?.length > 0, 'Partial corpse should persist after extraction.');
  assert(saved.backpack.items.some((item) => item.itemId === 'echo_lance'), 'Looted corpse weapon did not persist in the raid backpack after extraction.');
  await page.screenshot({ path: path.join(outputDir, '04-partial-corpse-at-base.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, corpseOpened: true, partialCorpsePersisted: true, errors }, null, 2));
} finally {
  await browser.close();
}
