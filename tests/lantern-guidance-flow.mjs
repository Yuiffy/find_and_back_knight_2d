import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/';
const output = path.resolve('.tmp/test-artifacts/lantern-guidance');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('sui-lantern-run.save.v1')));
async function tick(ms) { await page.evaluate((ms) => window.advanceTime(ms), ms); return state(); }
async function hold(keys, ms) {
  for (const key of Array.isArray(keys) ? keys : [keys]) await page.keyboard.down(key);
  await tick(ms);
  for (const key of Array.isArray(keys) ? keys : [keys]) await page.keyboard.up(key);
  return tick(40);
}
async function moveTo(x) {
  for (let i = 0; i < 25; i++) {
    const current = await state();
    const dx = x - current.player.x;
    if (Math.abs(dx) < 15) return;
    await hold(dx > 0 ? 'KeyD' : 'KeyA', Math.min(180, Math.max(40, Math.abs(dx) * 2.6)));
  }
  throw new Error(`Cannot reach ${x}: ${JSON.stringify((await state()).player)}`);
}
async function grounded() {
  for (let i = 0; i < 20; i++) { if ((await state()).player.grounded) return; await tick(70); }
  throw new Error(`Never landed: ${JSON.stringify((await state()).player)}`);
}
async function jumpTo(x, maxY) {
  await grounded();
  const s = await state();
  const key = x > s.player.x ? 'KeyD' : 'KeyA';
  await page.keyboard.down(key);
  await page.keyboard.down('Space');
  for (let i = 0; i < 24; i++) {
    const next = await tick(50);
    if (Math.abs(next.player.x - x) < 15 || (key === 'KeyD' ? next.player.x > x : next.player.x < x)) break;
  }
  await page.keyboard.up(key);
  await page.keyboard.up('Space');
  await tick(360);
  await grounded();
  assert((await state()).player.y < maxY, `Jump to ${x} missed its surface`);
}
async function screenshot(name) {
  await page.evaluate(() => window.advanceTime(0));
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(output, name), animations: 'disabled' });
  await tick(1);
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
  assert.equal((await state()).guidance.lesson, 'move');
  assert(await page.getByRole('navigation', { name: '操作栏' }).isVisible());
  await screenshot('01-movement-guide.png');
  await page.getByRole('button', { name: '隐藏操作提示' }).click();
  assert.equal(await page.getByRole('navigation', { name: '操作栏' }).count(), 0);
  assert.equal((await saved()).controlsVisible, false);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
  assert.equal(await page.getByRole('navigation', { name: '操作栏' }).count(), 0);
  await page.getByRole('button', { name: '显示操作提示' }).click();
  const right = await page.getByRole('button', { name: '向右（操作栏）' }).boundingBox();
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
  await page.mouse.down();
  await tick(260);
  await page.mouse.up();
  await tick(40);
  assert.equal((await state()).guidance.lesson, 'attack');
  await screenshot('02-attack-guide.png');
  await page.getByRole('button', { name: '攻击（操作栏）' }).click();
  await tick(130);
  assert((await saved()).learnedControls.includes('attack'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
  assert((await state()).guidance.learned.includes('move') && (await state()).guidance.learned.includes('attack'));
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('checkbox', { name: '操作提示' }).uncheck();
  assert.equal((await saved()).controlsVisible, false);
  await page.getByRole('button', { name: '重看操作提示' }).click();
  assert((await saved()).controlsVisible);
  assert.deepEqual((await saved()).learnedControls, []);
  await page.getByRole('button', { name: '继续旅途' }).click();
  assert.equal((await state()).guidance.lesson, 'move');
  await page.getByRole('button', { name: '进入温室' }).click();

  // Cross the early patrols without trading health, then exercise the full-health tea branch.
  await moveTo(745);
  await hold(['Space', 'KeyD'], 950);
  await grounded();
  await moveTo(1190);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '重看操作提示' }).click();
  await page.getByRole('button', { name: '继续旅途' }).click();
  await moveTo(1230);
  assert.equal((await state()).guidance.lesson, 'jump');
  await screenshot('03-jump-guide.png');
  await jumpTo(1400, 620);
  assert((await state()).guidance.learned.includes('jump'));
  await moveTo(1540);
  await jumpTo(1760, 660);
  await jumpTo(2100, 530);
  await moveTo(2230);
  await jumpTo(2460, 650);
  const before = await state();
  assert.equal(before.health, 6, 'Full-health tea scenario took damage before arriving');
  assert.equal(before.guidance.lesson, 'interact');
  assert.equal(before.interaction.id, 'rest');
  assert(before.interaction.enabled);
  await screenshot('04-tea-interaction.png');
  await page.keyboard.press('KeyE');
  await tick(90);
  const full = await state();
  assert.equal(full.health, 6);
  assert.equal(full.restUsed, false);
  assert(full.message.includes('生命已满') && full.message.includes('原处'));
  assert((await saved()).learnedControls.includes('interact'));
  await screenshot('05-full-health-tea.png');
  await page.getByRole('button', { name: '喝一口雨歇茶', exact: true }).click();
  assert.equal((await state()).restUsed, false);
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = { ok: true, contextualHints: true, liveControlStrip: true, preferencePersists: true, lessonReplay: true, fullHealthTeaPreserved: true, errors };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, state: await state().catch(() => null), errors }, null, 2));
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined);
  throw error;
} finally { await browser.close(); }
