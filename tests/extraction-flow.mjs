import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchExtractionBrowser } from './extraction-browser.mjs';
const output = '.tmp/test-artifacts/extraction';
fs.mkdirSync(output, { recursive: true });
const browser = await launchExtractionBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/';
const state = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = async (ms) => {
  await page.evaluate((ms) => window.advanceTime(ms), ms);
  await page.waitForTimeout(60);
  return state();
};
async function hold(keys, ms) {
  for (const k of [].concat(keys)) await page.keyboard.down(k);
  await tick(ms);
  for (const k of [].concat(keys)) await page.keyboard.up(k);
  return tick(20);
}
async function move(x, z) {
  for (let n = 0; n < 120; n++) {
    const s = await state();
    assert.equal(s.phase, 'raid', JSON.stringify(s));
    const dx = x - s.player.x,
      dz = z - s.player.z;
    if (Math.hypot(dx, dz) < 0.5) return s;
    const keys = [];
    if (Math.abs(dx) > 0.25) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dz) > 0.25) keys.push(dz > 0 ? 'KeyS' : 'KeyW');
    await hold(keys, Math.min(180, (Math.hypot(dx, dz) / 5.2) * 1000));
  }
  throw Error(
    `Move failed ${x},${z}: ${JSON.stringify((await state()).player)}`,
  );
}
try {
  await page.goto(url);
  await page.waitForFunction(() =>
    window.render_game_to_text?.().includes('"phase":"base"'),
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${output}/01-base.png` });
  await page.getByRole('button', { name: '准备部署', exact: false }).click();
  await page.screenshot({ path: `${output}/02-loadout.png` });
  await page.locator('#ex-deploy').click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).phase === 'raid',
  );
  await tick(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/03-insertion.png` });
  assert.equal((await state()).profile.guns.kestrel, 0);
  await move(-29, 34.5);
  await page.keyboard.press('KeyE');
  await tick(2300);
  assert.equal((await state()).search?.id, 'dock');
  await page.getByRole('button', { name: '收纳已识别物资' }).click();
  assert.equal((await state()).bag.length, 3);
  await page.getByRole('gridcell', { name: /^背包 精密电路/ }).click();
  await page.getByRole('button', { name: '保护精密电路', exact: true }).click();
  assert.equal((await state()).secure, 'electronics');
  await page.screenshot({ path: `${output}/04-search.png` });
  await page.keyboard.press('Escape');
  await tick(20);
  await page.keyboard.press('Escape');
  await tick(20);
  const before = (await state()).elapsed;
  await tick(5000);
  assert.equal((await state()).elapsed, before);
  await page.getByRole('button', { name: '继续行动' }).click();
  await tick(10);
  await move(-32, 41);
  await tick(7000);
  assert.equal((await state()).phase, 'won');
  assert.equal((await state()).profile.contract, 1);
  await page.screenshot({ path: `${output}/05-extracted.png` });
  await page.getByRole('button', { name: '返回基地' }).click();
  await page.getByRole('button', { name: '03 仓库 / 后勤' }).click();
  await page.screenshot({ path: `${output}/06-stash.png` });
  const oldCredits = (await state()).profile.credits;
  await page.getByRole('button', { name: '出售', exact: true }).first().click();
  assert((await state()).profile.credits > oldCredits);
  await page.reload();
  await page.waitForFunction(() =>
    window.render_game_to_text?.().includes('"phase":"base"'),
  );
  assert.equal((await state()).profile.wins, 1);
  assert.equal((await state()).profile.stash.length, 2);
  // Normal keyboard + mouse combat; no in-page mutation or teleport.
  await page.getByRole('button', { name: '准备部署', exact: false }).click();
  await page.locator('#ex-deploy').click();
  await tick(0);
  await move(-32, 26);
  for (let n = 0; n < 40 && (await state()).kills < 1; n++) {
    let s = await state();
    const e = s.enemies.find((e) => e.id === 0);
    if (!e) break;
    const screen = s.screen.enemies.find((e) => e.id === 0);
    await page.mouse.move(screen.x, screen.y);
    await page.waitForTimeout(50);
    await page.mouse.down();
    await tick(160);
    await page.mouse.up();
  }
  assert(
    (await state()).kills >= 1,
    'Real pointer shooting should defeat patrol',
  );
  await page.keyboard.press('KeyR');
  await tick(2500);
  assert.equal((await state()).player.mag, 24);
  await page.screenshot({ path: `${output}/07-combat.png` });
  await page.keyboard.press('KeyM');
  await tick(20);
  const mapTime = (await state()).elapsed;
  await tick(1000);
  assert((await state()).elapsed >= mapTime + .99, 'Tactical map must keep the raid live');
  await page.screenshot({ path: `${output}/08-map.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await tick(30);
  await page.getByRole('button', { name: '放弃本次行动', exact: true }).click();
  await page
    .getByRole('button', { name: '确认放弃：失去装备和普通物资' })
    .click();
  await tick(10);
  assert.equal((await state()).phase, 'lost');
  await page.screenshot({ path: `${output}/09-lost.png` });
  await page.getByRole('button', { name: '返回基地' }).click();
  const lost = (await state()).profile.lost;
  assert(lost);
  await page.reload();
  await page.waitForFunction(() =>
    window.render_game_to_text?.().includes('"phase":"base"'),
  );
  assert.deepEqual((await state()).profile.lost, lost);
  fs.writeFileSync(
    `${output}/state.json`,
    JSON.stringify(await state(), null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(
    'Extraction browser flow PASS',
    JSON.stringify({ errors, profile: (await state()).profile }),
  );
} finally {
  await browser.close();
}
