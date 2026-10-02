import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

import { lanternUrl as baseUrl } from './lantern-url.mjs';
const optional = process.env.OPTIONAL_ROUTE === '1' || process.argv.includes('--optional');
const output = path.resolve(optional ? '.tmp/test-artifacts/lantern-flow-optional' : '.tmp/test-artifacts/lantern-flow');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const trace = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = async (ms) => { await page.evaluate((ms) => window.advanceTime(ms), ms); return state(); };
async function hold(keys, ms) {
  for (const key of Array.isArray(keys) ? keys : [keys]) await page.keyboard.down(key);
  await tick(ms);
  for (const key of Array.isArray(keys) ? keys : [keys]) await page.keyboard.up(key);
  return tick(40);
}
async function record(label) {
  const s = await state();
  trace.push({ label, phase: s.phase, player: s.player, health: s.health, time: s.elapsedMs, lightMs: s.lightMs, enemies: s.enemies });
  console.log(`${label}: (${s.player.x}, ${s.player.y}) HP=${s.health} ${s.phase}`);
  assert.notEqual(s.phase, 'lost', `Died during ${label}`);
  return s;
}
async function moveTo(x, tolerance = 14) {
  for (let i = 0; i < 35; i++) {
    const s = await state();
    assert.notEqual(s.phase, 'lost', `Died while moving to ${x}`);
    const dx = x - s.player.x;
    if (Math.abs(dx) <= tolerance) return s;
    await hold(dx > 0 ? 'KeyD' : 'KeyA', Math.min(180, Math.max(40, Math.abs(dx) * 2.6)));
  }
  const s = await state();
  throw new Error(`Could not move to ${x}: ${JSON.stringify(s.player)}`);
}
async function grounded() {
  for (let i = 0; i < 18; i++) { const s = await state(); if (s.player.grounded) return s; await tick(80); }
  throw new Error(`Not grounded: ${JSON.stringify((await state()).player)}`);
}
async function jumpTo(x, maxY) {
  await grounded();
  let s = await state();
  const direction = x > s.player.x ? 'KeyD' : 'KeyA';
  await page.keyboard.down(direction);
  await page.keyboard.down('Space');
  for (let i = 0; i < 20; i++) {
    s = await tick(50);
    if (Math.abs(x - s.player.x) < 15 || (direction === 'KeyD' ? s.player.x > x : s.player.x < x)) break;
  }
  await page.keyboard.up(direction);
  await page.keyboard.up('Space');
  await tick(360);
  s = await grounded();
  assert(s.player.y <= maxY, `Jump to ${x} landed too low: ${JSON.stringify(s.player)}`);
  return s;
}
async function fight(id) {
  const patterns = new Set();
  for (let i = 0; i < 100; i++) {
    const s = await state();
    assert.notEqual(s.phase, 'lost', `Died fighting ${id}`);
    const enemy = s.enemies.find((e) => e.id === id);
    if (!enemy) {
      if (id === 'bell-keeper') assert(patterns.has('wave'), 'Keeper never reached its second attack pattern.');
      return record(`defeated ${id}`);
    }
    if (enemy.phase === 'windup') patterns.add(enemy.pattern);
    const dx = enemy.x - s.player.x;
    const direction = dx > 0 ? 'KeyD' : 'KeyA';
    if (s.player.y > enemy.y + 85 && s.player.grounded) {
      await jumpTo(enemy.kind === 'keeper' ? 4460 : enemy.x, enemy.y + 45);
    } else if (enemy.kind === 'keeper' && enemy.phase === 'windup' && enemy.pattern === 'wave' && s.player.grounded) {
      await hold('KeyJ', 300);
      await hold(['Space', 'KeyJ'], 500);
    } else if (enemy.phase === 'windup' && enemy.kind !== 'sentry' && Math.abs(dx) < 145 && s.player.dashReady) {
      await hold([direction, 'KeyK'], 190);
    } else if (Math.abs(dx) > 75) {
      await hold([direction, 'KeyJ'], Math.min(135, Math.max(40, (Math.abs(dx) - 60) * 2.7)));
    } else {
      await hold(direction, 25);
      await hold('KeyJ', enemy.phase === 'recover' ? 350 : 160);
    }
  }
  throw new Error(`Enemy survived: ${id} ${JSON.stringify((await state()).enemies)}`);
}

async function reachCore() {
  await moveTo(820);
  await fight('court-guard');
  await moveTo(1200);
  assert.equal((await state()).guidance.lesson, 'jump');
  await jumpTo(1400, 610);
  await moveTo(1540);
  await grounded();
  await jumpTo(1760, 650);
  await fight('gallery-guard');
  await moveTo(1880);
  await jumpTo(2110, 520);
  await fight('gallery-sentry');
  await moveTo(2230);
  await jumpTo(2460, 640);
  const beforeTea = await state();
  assert.equal(beforeTea.interaction.id, 'rest');
  if (beforeTea.health < 6) {
    await page.keyboard.press('KeyE');
    await tick(150);
    const afterTea = await state();
    assert.equal(afterTea.health, Math.min(6, beforeTea.health + 2));
    assert(afterTea.restUsed && afterTea.message.includes('生命 +'));
    assert.equal(afterTea.interaction.label, '雨歇茶已喝完');
  }
  await record('gallery rest');
  await moveTo(2720);
  await fight('heart-guard');
  await moveTo(3270);
  await jumpTo(3400, 610);
  await fight('heart-sentry');
  await moveTo(3180);
  await grounded();
  await page.keyboard.press('KeyE');
  await tick(150);
  const core = await record('core acquired');
  assert(core.coreTaken && core.empowered && core.phase === 'returning');
  assert(core.enemies.some((e) => e.id === 'return-court'));
  await page.screenshot({ path: path.join(output, '02-route-choice.png'), animations: 'disabled' });
  await page.getByRole('button', { name: optional ? /去钟楼看看/ : /带灯芯回家/ }).click();
  await page.screenshot({ path: path.join(output, '02-core.png') });
}

async function returnHome() {
  await moveTo(2880);
  await fight('return-heart');
  await moveTo(2720);
  await jumpTo(2500, 640);
  await moveTo(2410);
  await jumpTo(2170, 540);
  await moveTo(2080);
  await jumpTo(1810, 660);
  await fight('return-gallery');
  await moveTo(1710);
  await jumpTo(1430, 640);
  await fight('return-court');
  await moveTo(245);
  await grounded();
  await page.keyboard.press('KeyE');
  await tick(1850);
  const result = await state();
  assert.equal(result.phase, 'won', `Return did not settle: ${JSON.stringify(result)}`);
  await page.waitForFunction(() => {
    const dialog = document.querySelector('.lantern-result');
    return dialog && Number(getComputedStyle(dialog).opacity) > 0.99;
  });
  await page.screenshot({ path: path.join(output, '04-result.png'), animations: 'disabled' });
  return result;
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
  await page.evaluate(() => localStorage.setItem('sui-echoes-below.save.v1', '{"legacy-marker":"untouched"}'));
  assert.equal(await page.getByRole('button', { name: '回旋羽', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '纪念品', exact: true }).count(), 0);
  assert.equal(await page.getByRole('link', { name: '原版远征' }).count(), 1);
  await page.screenshot({ path: path.join(output, '01-home.png') });
  await page.getByRole('button', { name: '进入温室' }).click();
  await reachCore();

  await page.keyboard.press('Escape');
  await tick(20);
  const paused = await state();
  await tick(3000);
  const stillPaused = await state();
  assert(stillPaused.paused);
  assert.equal(stillPaused.lightMs, paused.lightMs);
  assert.equal(stillPaused.elapsedMs, paused.elapsedMs);
  await page.getByRole('button', { name: '继续旅途' }).click();

  if (optional) {
    await moveTo(3260);
    await jumpTo(3400, 610);
    await moveTo(3670);
    await grounded();
    await jumpTo(3870, 660);
    await moveTo(3950);
    await jumpTo(4180, 540);
    await moveTo(4220);
    await jumpTo(4430, 640);
    await fight('bell-keeper');
    await moveTo(4860);
    await page.keyboard.press('KeyE');
    await tick(120);
    assert.equal((await state()).relic, 'bell');
    await page.screenshot({ path: path.join(output, '03-relic.png') });
    await moveTo(4370);
    await jumpTo(4180, 540);
    await moveTo(4100);
    await jumpTo(3860, 660);
    await moveTo(3800);
    await jumpTo(3530, 630);
    await moveTo(3210);
  }
  const result = await returnHome();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-lantern-run.save.v1')));
  assert.equal(saved.returns, 1);
  await tick(3000);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sui-lantern-run.save.v1')).returns), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('sui-echoes-below.save.v1')), '{"legacy-marker":"untouched"}');
  await page.getByRole('button', { name: '留在灯站' }).click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
  await page.getByRole('button', { name: '回旋羽', exact: true }).click();
  assert.equal((await state()).weapon, 'feather');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
  assert.equal((await state()).weapon, 'feather');
  if (optional) assert(await page.getByRole('button', { name: '纪念品', exact: true }).isVisible());
  await page.getByRole('button', { name: '进入温室' }).click();
  await hold('KeyJ', 130);
  assert((await state()).shots.some((shot) => shot.kind === 'feather'));
  await moveTo(950);
  await tick(29_000);
  await tick(29_000);
  const death = await state();
  assert.equal(death.phase, 'lost', 'Standing in repeated enemy attacks did not produce a failure.');
  await page.getByRole('button', { name: '重新出发' }).click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'outbound');
  const retried = await state();
  assert.equal(retried.health, 6);
  assert.equal(retried.weapon, 'feather');
  assert.equal(retried.player.dashReady, true);
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = { ok: true, optional, result: result.result, saved, deathAndRetry: true, legacyUntouched: true, errors };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  trace.push({ failure: error.message, state: await state().catch(() => null), errors });
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined);
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'trace.json'), JSON.stringify(trace, null, 2));
  await browser.close();
}
