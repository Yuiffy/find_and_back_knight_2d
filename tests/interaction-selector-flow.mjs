import { legacyUrl } from './legacy-url.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/interaction-selector-flow');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
}

async function hold(key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function startFreshRaid() {
  await page.goto(legacyUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const profile = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...profile,
      successfulExtractions: 2,
      shortcutUnlocked: true,
      bossDefeated: true,
      endingUnlocked: true,
      endingSeen: false,
      lostEcho: null,
      discoveredClues: [...new Set([...(profile.discoveredClues ?? []), 'map-trace', 'lift-trace', 'warden-trace', 'home-trace'])],
      activeRaid: null,
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  await page.getByRole('button', { name: /深场折跃门返程/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
}

async function moveTo(targetX) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await readState();
    const distance = targetX - current.player.x;
    if (Math.abs(distance) < 8) return current;
    await hold(distance > 0 ? 'KeyD' : 'KeyA', Math.min(180, Math.max(65, Math.abs(distance) * 1.35)));
  }
  return readState();
}

function selectedId(state) {
  return state.interactionSelector?.selectedId ?? null;
}

async function selectCandidate(id) {
  const current = await readState();
  const index = current.nearbyInteractions.findIndex((candidate) => candidate.id === id);
  assert(index >= 0, `Candidate ${id} is not nearby: ${JSON.stringify(current.nearbyInteractions)}`);
  await page.keyboard.press(`Digit${index + 1}`);
  await page.waitForTimeout(80);
  const selected = await readState();
  assert(selectedId(selected) === id, `Could not select ${id}: ${JSON.stringify(selected.interactionSelector)}`);
  return selected;
}

try {
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await startFreshRaid();
  // Clear the nearby patrol so the selector assertions are not racing contact knockback.
  await hold('KeyA', 90);
  for (let strike = 0; strike < 5; strike += 1) {
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(150);
  }
  const atOverlap = await moveTo(3970);
  await page.waitForTimeout(160);
  let current = await readState();
  const ids = current.nearbyInteractions?.map((candidate) => candidate.id) ?? [];
  assert(ids.includes('container-crate-graveyard') && ids.includes('echo-graveyard-terminal') && ids.includes('extraction-墓园远距天线'),
    `Expected crate, echo and extraction at the overlap: ${JSON.stringify({ atOverlap: atOverlap.player, interactions: current.nearbyInteractions })}`);
  assert(current.interactionSelector?.open && current.interactionSelector.count >= 3, `Selector did not open for overlapping targets: ${JSON.stringify(current.interactionSelector)}`);
  assert(current.nearbyInteractions.filter((candidate) => candidate.selected).length === 1, 'Selector exposed more than one selected candidate.');
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '01-three-way-overlap.png') });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  assert(box, 'Canvas has no bounding box for pointer selector test.');
  const scaleX = box.width / 1280;
  const scaleY = box.height / 720;
  const selectorBounds = current.interactionSelector.bounds;
  assert(selectorBounds, 'Interaction selector did not expose pointer bounds.');
  const echoIndex = current.nearbyInteractions.findIndex((candidate) => candidate.id === 'echo-graveyard-terminal');
  const echoRowY = selectorBounds.top + 10 + 34 + echoIndex * 34 + 17;
  const echoRowX = selectorBounds.left + 180;
  await page.mouse.move(box.x + echoRowX * scaleX, box.y + echoRowY * scaleY);
  await page.waitForTimeout(80);
  await page.mouse.click(box.x + echoRowX * scaleX, box.y + echoRowY * scaleY);
  await page.waitForTimeout(180);
  current = await readState();
  assert(current.visibleStoryEchoes.some((echo) => echo.id === 'graveyard-terminal' && echo.heard), `Clicking the reading-point row did not confirm it: ${JSON.stringify(current.interactionSelector)}`);

  const firstSelected = current.interactionSelector.selectedId;
  await page.keyboard.press('KeyS');
  await page.waitForTimeout(120);
  current = await readState();
  assert(current.interactionSelector.selectedId !== firstSelected, `S did not cycle the interaction selector: ${JSON.stringify(current.interactionSelector)}`);
  await selectCandidate('echo-graveyard-terminal');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(180);
  current = await readState();
  assert(current.visibleStoryEchoes.some((echo) => echo.id === 'graveyard-terminal' && echo.heard), 'Confirming the echo option did not hear the reading point.');
  assert(!current.flags?.inventoryOpen, 'Confirming the reading point unexpectedly opened the inventory.');

  await selectCandidate('extraction-墓园远距天线');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(120);
  current = await readState();
  assert(current.flags?.extracting, `Confirming the extraction option did not start extraction: ${JSON.stringify(current)}`);
  await hold('KeyA', 260);
  await page.waitForTimeout(120);
  current = await readState();
  assert(!current.flags?.extracting, 'Leaving the extraction point did not cancel the extraction.');

  await moveTo(3970);
  await page.waitForTimeout(160);
  current = await readState();
  await selectCandidate('container-crate-graveyard');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(180);
  current = await readState();
  assert(current.flags?.inventoryOpen && current.containerSearch?.searching, `Confirming the crate option did not open its search: ${JSON.stringify(current)}`);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-crate-confirmed.png') });
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({
    ok: true,
    overlapOptions: ids,
    keyboardSelection: true,
    extractionSelection: true,
    crateSelection: true,
    pointerSelection: true,
    errors,
  }, null, 2));
} finally {
  await browser.close();
}
