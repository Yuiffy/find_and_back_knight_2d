import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/gameplay-variety');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
}

async function seedRaid(page, raidsStarted, shortcutUnlocked = false) {
  await page.goto('http://127.0.0.1:4175/knight/', { waitUntil: 'networkidle' });
  await page.evaluate(({ raidsStarted: raidCount, shortcut }) => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...profile,
      raidsStarted: raidCount,
      successfulExtractions: Math.max(profile.successfulExtractions, shortcut ? 2 : 0),
      mapUnlocked: shortcut || profile.mapUnlocked,
      shortcutUnlocked: shortcut,
      activeRaid: null,
    }));
  }, { raidsStarted, shortcut: shortcutUnlocked });
  await page.reload({ waitUntil: 'networkidle' });
}

async function enter(page, buttonName) {
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: buttonName }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
}

try {
  const spawns = [];
  let sawFoyerSpikes = false;
  for (const raidsStarted of [0, 1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await seedRaid(page, raidsStarted);
    await enter(page, /失落前庭随机投放/);
    const state = await readState(page);
    spawns.push(`${state.spawn.x},${state.spawn.y}`);
    sawFoyerSpikes ||= state.visibleHazards.some((hazard) => hazard.id === 'foyer-spikes');
    await page.close();
  }
  assert(new Set(spawns).size === 3, `Expected three rotating foyer spawns, got ${spawns.join(' | ')}.`);
  assert(sawFoyerSpikes, 'Foyer spikes were not visible from any rotating spawn.');

  const liftPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  liftPage.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  liftPage.on('pageerror', (error) => errors.push(error.message));
  await seedRaid(liftPage, 5, true);
  await enter(liftPage, /维护电梯深层站/);
  const lift = await readState(liftPage);
  assert(lift.spawn.x === 2780 && lift.spawn.y === 850, `Deep lift did not move to the far region: ${JSON.stringify(lift.spawn)}.`);
  assert(lift.player.x >= 2780 && lift.player.y < 1000, `Deep lift player spawn was incorrect: ${JSON.stringify(lift.player)}.`);
  await liftPage.close();

  for (const [width, height] of [[1280, 720], [1920, 1080], [2560, 1440]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await seedRaid(page, 0);
    await enter(page, /失落前庭随机投放/);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const canvas = page.locator('canvas');
    const bounds = await canvas.boundingBox();
    const state = await readState(page);
    assert(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 0.5 && bounds.y + bounds.height <= height + 0.5,
      `Canvas overflowed ${width}x${height}: ${JSON.stringify(bounds)}.`);
    assert(state.flags.inventoryOpen, `Inventory did not open at ${width}x${height}.`);
    assert(await canvas.evaluate((element) => element.width === 1280 && element.height === 720), `Logical canvas changed at ${width}x${height}.`);
    await page.screenshot({ path: path.join(outputDir, `inventory-${width}x${height}.png`) });
    await page.close();
  }

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, rotatingSpawns: spawns, deepLift: lift.spawn, layouts: ['1280x720', '1920x1080', '2560x1440'], errors }, null, 2));
} finally {
  await browser.close();
}
