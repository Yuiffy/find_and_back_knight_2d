import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/gameplay-overhaul');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
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
async function moveX(targetX, tolerance = 40) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const current = await state();
    const distance = targetX - current.player.x;
    if (Math.abs(distance) <= tolerance) return current;
    await hold(distance > 0 ? 'ArrowRight' : 'ArrowLeft', Math.min(260, Math.max(65, Math.abs(distance) * 1.5)));
  }
  return state();
}

async function jumpToward(takeoffX, targetX, targetY, directionHold = 900) {
  await moveX(takeoffX, 35);
  const before = await state();
  const direction = targetX >= before.player.x ? 'KeyD' : 'KeyA';
  await page.keyboard.down(direction);
  await page.waitForTimeout(80);
  await page.keyboard.down('Space');
  await page.waitForTimeout(430);
  await page.keyboard.up('Space');
  await page.waitForTimeout(Math.max(0, directionHold - 430));
  await page.keyboard.up(direction);
  await page.waitForTimeout(420);
  const current = await state();
  assert(current.player.y <= targetY + 70, `Relay traversal missed ledge near ${targetY}: ${JSON.stringify(current.player)}.`);
  return current;
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...profile,
      successfulExtractions: 4,
      mapUnlocked: true,
      shortcutUnlocked: true,
      bossDefeated: true,
      endingUnlocked: true,
      discoveredClues: [...new Set([...profile.discoveredClues, 'map-trace', 'lift-trace', 'warden-trace', 'home-trace'])],
      lostEcho: { mapId: 'relay_01', x: 450, y: 1510, items: [{ itemId: 'echo_dust', quantity: 2 }], createdAtRaid: 3 },
      activeRaid: null,
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /失落前庭入口/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.locator('canvas').click({ position: { x: 1280, y: 720 } });
  await page.waitForTimeout(800);

  let current = await state();
  assert(current.mapId === 'hollow_01', `Expected hollow map id, got ${current.mapId}.`);
  assert(current.render?.renderScale === 2, `Expected QHD render scale 2, got ${JSON.stringify(current.render)}.`);
  assert(current.render.backingWidth === 2560 && current.render.backingHeight === 1440, 'Canvas backing dimensions were not capped at QHD.');
  const canvasSize = await page.locator('canvas').evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
  assert(canvasSize.width === 2560 && canvasSize.height === 1440, `Unexpected canvas backing size ${JSON.stringify(canvasSize)}.`);

  const manifest = current.visibleStoryEchoes?.find((echo) => echo.id === 'foyer-manifest');
  assert(manifest && manifest.x === 350 && manifest.y === 1995, `Foyer manifest is not at its reachable open-floor position: ${JSON.stringify(manifest)}.`);
  const overlappingEnemy = current.visibleEnemies?.find((enemy) => Math.hypot(enemy.x - manifest.x, enemy.y - manifest.y) < 140);
  assert(!overlappingEnemy, `Enemy ${overlappingEnemy?.id} still overlaps foyer manifest.`);
  assert(!current.flags?.recoveredEcho && !current.nearbyInteraction?.includes('遗失回声'), 'Relay lost echo appeared on the hollow map.');

  await moveX(350);
  current = await state();
  if (!current.nearbyInteraction?.includes('聆听')) {
    await hold('ArrowRight', 80);
    current = await state();
  }
  assert(current.nearbyInteraction?.includes('聆听'), `Manifest was not interactable at player ${JSON.stringify(current.player)}: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  current = await state();
  const heardManifest = current.visibleStoryEchoes.find((echo) => echo.id === 'foyer-manifest');
  assert(heardManifest.heard && !heardManifest.pulsing, `First listen did not immediately stabilize echo: ${JSON.stringify(heardManifest)}.`);
  assert(current.nearbyInteraction?.includes('重听'), `Heard echo prompt did not switch to replay: ${current.nearbyInteraction}.`);
  await page.screenshot({ path: path.join(outputDir, '01-qhd-foyer-echo.png') });

  // Return without settling, then seed away the active raid so destination selection can be tested independently.
  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...profile,
      bossDefeated: true,
      endingUnlocked: true,
      lostEcho: { mapId: 'relay_01', x: 450, y: 1510, items: [{ itemId: 'echo_dust', quantity: 2 }], createdAtRaid: 3 },
      activeRaid: null,
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  assert(await page.getByText('天线深场', { exact: false }).first().isVisible(), 'Relay destination did not unlock after bringing back the core.');
  await page.getByRole('button', { name: /西侧接驳台/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  current = await state();
  assert(current.mapId === 'relay_01', `Second raid did not load relay_01: ${JSON.stringify(current)}.`);
  assert(current.zoneId === 'west-array', `Relay entry did not resolve to west-array: ${JSON.stringify(current.zoneReveal)}.`);
  assert(current.visibleEnemies.some((enemy) => enemy.id === 'husk-relay-west'), 'Relay map enemies were not created.');
  assert(current.visibleStoryEchoes.some((echo) => echo.id === 'relay-arrival-log'), 'Relay story echoes were not created.');
  await moveX(450);
  current = await state();
  assert(current.nearbyInteraction?.includes('遗失回声'), `Matching relay lost echo did not appear on relay_01: ${JSON.stringify(current)}.`);
  await moveX(760);
  current = await state();
  assert(current.nearbyInteraction?.includes('校准西向'), `West relay calibration was not reachable: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  current = await state();
  assert(current.objective.includes('东向阵列'), `West calibration did not advance objective: ${current.objective}.`);
  await jumpToward(980, 1125, 1405, 760);
  await jumpToward(1250, 1575, 1265, 820);
  await jumpToward(1800, 2100, 1395, 820);
  await jumpToward(2240, 2525, 1185, 820);
  await moveX(2525);
  current = await state();
  assert(current.nearbyInteraction?.includes('校准东向'), `East relay calibration was not reachable: ${current.nearbyInteraction}.`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  current = await state();
  assert(current.objective.includes('冠顶终端'), `East calibration did not advance objective: ${current.objective}.`);
  await page.screenshot({ path: path.join(outputDir, '02-relay-map-qhd.png') });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, foyerManifestReachable: true, storyEchoState: true, relayLoadedPerRaid: true, qhdBacking: canvasSize, errors }, null, 2));
} finally {
  await browser.close();
}
