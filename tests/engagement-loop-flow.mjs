import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/';
const outputDir = path.resolve('.tmp/test-artifacts/engagement-loop');
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function state(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
}

async function hold(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function moveX(page, targetX, tolerance = 35) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const current = await state(page);
    const distance = targetX - current.player.x;
    if (Math.abs(distance) <= tolerance) return current;
    await hold(page, distance > 0 ? 'KeyD' : 'KeyA', Math.min(220, Math.max(65, Math.abs(distance) * 1.5)));
  }
  return state(page);
}

try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('sui-echoes-below.save.v1'));
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  assert(await page.getByRole('radio', { name: '选择契约 初次回传' }).isVisible(), 'First raid did not present the guided contract.');
  assert(await page.getByRole('radio', { name: /选择契约 封箱清点/ }).count() === 0, 'Advanced contracts appeared before the first extraction.');
  assert(await page.getByRole('button', { name: /随机潜入投放/ }).count() === 0, 'High-risk outpost appeared before the guided extraction.');
  await page.screenshot({ path: path.join(outputDir, '01-first-contract.png'), fullPage: true });
  await page.getByRole('button', { name: /失落前庭随机投放/ }).click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(750);

  let current = await state(page);
  assert(current.contract?.id === 'first_signal', `Wrong first contract: ${JSON.stringify(current.contract)}`);
  assert(current.objective.includes('新手 1/5'), `First onboarding objective missing: ${current.objective}`);

  await hold(page, 'KeyD', 180);
  current = await state(page);
  assert(current.expedition?.onboarding.moved && current.objective.includes('新手 2/5'), `Movement onboarding did not advance: ${JSON.stringify(current.expedition)}`);

  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');
  await page.waitForTimeout(160);
  current = await state(page);
  assert(current.expedition?.onboarding.jumped && current.objective.includes('新手 3/5'), `Jump onboarding did not advance: ${JSON.stringify(current)}`);

  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(120);
  current = await state(page);
  assert(current.expedition?.onboarding.attacked && current.objective.includes('新手 4/5'), `Attack onboarding did not advance: ${JSON.stringify(current)}`);

  await moveX(page, 390);
  current = await state(page);
  assert(current.nearbyInteraction?.includes('搜索'), `Starter container was not reachable: ${current.nearbyInteraction}`);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => {
    const value = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return value.containerSearch?.revealed?.some((entry) => Boolean(entry.itemId) && !entry.active);
  }, undefined, { timeout: 3000 });
  current = await state(page);
  assert(current.flags?.inventoryOpen && current.containerSearch, `Container search did not open: ${JSON.stringify(current)}`);
  assert(current.expedition.onboarding.searched && current.objective.includes('新手 5/5'), `Search onboarding did not advance: ${JSON.stringify(current.expedition)}`);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box.');
  const point = (x, y) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });
  const from = point(878, 202);
  const to = point(530, 200);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').expedition?.onboarding?.looted === true, undefined, { timeout: 1200 });
  current = await state(page);
  assert(current.expedition.onboarding.looted, `Loot onboarding did not complete: ${JSON.stringify(current.expedition)}`);
  assert(current.contract.complete && current.expedition.telemetry.itemsRecovered >= 1, `First contract did not complete after taking loot: ${JSON.stringify(current.contract)}`);
  assert(current.expedition.resonance > 0 && current.expedition.exposure > 0, `Expedition pacing systems did not react to searching and looting: ${JSON.stringify(current.expedition)}`);

  await page.keyboard.press('Tab');
  await page.waitForTimeout(120);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, '02-contract-complete-hud.png') });
  await moveX(page, 520, 22);
  current = await state(page);
  assert(current.nearbyInteraction?.includes('安全撤离'), `Foyer extraction was not reachable: ${current.nearbyInteraction}`);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(3300);
  current = await state(page);
  assert(current.mode === 'base', `First raid did not settle: ${JSON.stringify(current)}`);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(saved.successfulExtractions === 1, `First extraction was not persisted: ${JSON.stringify(saved)}`);
  assert(saved.fieldXp >= 90 && saved.lastRaidReport?.contractCompleted, `License/report settlement failed: ${JSON.stringify(saved.lastRaidReport)}`);
  assert(saved.lastRaidReport.grade === 'A' || saved.lastRaidReport.grade === 'S', `Successful guided raid received an unclear grade: ${saved.lastRaidReport.grade}`);
  assert(await page.getByRole('region', { name: '最近远征战报' }).isVisible(), 'After-action report did not render at base.');
  await page.getByRole('button', { name: '工作台' }).click();
  assert(await page.getByText('探索执照 · Lv.2').count() >= 1, 'First extraction did not visibly unlock license level 2.');
  await page.screenshot({ path: path.join(outputDir, '03-first-report.png'), fullPage: true });

  await page.getByRole('button', { name: '选择入口并开始远征' }).click();
  for (const name of ['封箱清点', '静默清场', '深场测绘']) {
    assert(await page.getByRole('radio', { name: `选择契约 ${name}` }).isVisible(), `Contract ${name} was not available after onboarding.`);
  }
  assert(await page.getByRole('button', { name: /随机潜入投放/ }).isVisible(), 'High-risk outpost did not unlock after the guided extraction.');
  await page.getByRole('radio', { name: '选择契约 静默清场' }).click();
  assert(await page.getByRole('radio', { name: '选择契约 静默清场' }).getAttribute('aria-checked') === 'true', 'Hunter contract could not be selected.');
  await page.screenshot({ path: path.join(outputDir, '04-contract-choice.png'), fullPage: true });

  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({
    ok: true,
    firstContract: true,
    onboarding: current.expedition?.onboarding,
    report: saved.lastRaidReport,
    fieldXp: saved.fieldXp,
    advancedContracts: true,
    errors,
  }, null, 2));
} finally {
  await browser.close();
}
