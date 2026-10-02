import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { freshProfile, SAVE_KEY } from '../src/extraction/model.ts';
import { blocked } from '../src/extraction/map.ts';
const output = '.tmp/test-artifacts/extraction-campaign';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = async (ms) => {
  await page.evaluate((ms) => window.advanceTime(ms), ms);
  await page.waitForTimeout(5);
  return state();
};
async function shot(e) {
  const s = await state(),
    point = s.screen.enemies.find((p) => p.id === e.id);
  assert(
    point && point.x > 0 && point.x < 1440 && point.y > 90 && point.y < 740,
    `Target off playfield ${JSON.stringify({ e, point })}`,
  );
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(35);
  await page.mouse.down({ button: 'right' });
  await page.mouse.down();
  await tick(180);
  await page.mouse.up();
  await page.mouse.up({ button: 'right' });
}
async function fight() {
  for (let n = 0; n < 140; n++) {
    const s = await state();
    assert.equal(s.phase, 'raid', `Died: ${JSON.stringify(s.player)}`);
    const enemy = s.enemies
      .filter(
        (e) =>
          Math.hypot(e.x - s.player.x, e.z - s.player.z) < 20 &&
          // Advance around cover instead of repeatedly shooting a subpixel
          // sightline at its corner. Inputs still follow physical map routes.
          !blocked(e.x, e.z, s.player.x, s.player.z) &&
          !blocked(e.x, e.z, s.player.x + .35, s.player.z) &&
          !blocked(e.x, e.z, s.player.x - .35, s.player.z) &&
          !blocked(e.x, e.z + .35, s.player.x, s.player.z) &&
          !blocked(e.x, e.z - .35, s.player.x, s.player.z),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - s.player.x, a.z - s.player.z) -
          Math.hypot(b.x - s.player.x, b.z - s.player.z),
      )[0];
    if (!enemy) return;
    const pt = s.screen.enemies.find((e) => e.id === enemy.id);
    if (pt.y < 100 || pt.y > 730 || pt.x < 10 || pt.x > 1400) return;
    if (!s.player.mag) {
      await page.keyboard.press('KeyR');
      await tick(2450);
    } else await shot(enemy);
  }
  throw Error('Fight exhausted');
}
async function move(x, z) {
  for (let n = 0; n < 220; n++) {
    await fight();
    const s = await state(),
      dx = x - s.player.x,
      dz = z - s.player.z;
    if (Math.hypot(dx, dz) < 0.4) {
      console.log(
        'Waypoint',
        x,
        z,
        'HP',
        Math.ceil(s.player.hp),
        'kills',
        s.kills,
      );
      return;
    }
    const keys = [];
    if (Math.abs(dx) > 0.22) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dz) > 0.22) keys.push(dz > 0 ? 'KeyS' : 'KeyW');
    for (const k of keys) await page.keyboard.down(k);
    await tick(Math.min(400, (Math.hypot(dx, dz) / 5.2) * 1000));
    for (const k of keys) await page.keyboard.up(k);
    await tick(1);
  }
  throw Error(
    `Move blocked ${x},${z}: ${JSON.stringify((await state()).player)}`,
  );
}
async function heal() {
  const s = await state();
  if (s.player.hp < 85 && s.player.meds) {
    await page.keyboard.press('KeyH');
    await tick(2700);
  }
}
async function loot(id) {
  await page.keyboard.press('KeyE');
  await tick(2400);
  assert.equal((await state()).search?.id, id);
  await page.getByRole('button', { name: '收纳已识别物资' }).click();
  await page.keyboard.press('Escape');
  await tick(1);
}
try {
  await page.goto('http://127.0.0.1:4175/knight/');
  await page.waitForFunction(() => window.render_game_to_text);
  // Adjacent chapter save scenario: normalized by the same application repository, not runtime mutation.
  const p = freshProfile();
  p.contract = 1;
  p.credits = 3200;
  p.meds = 9;
  p.armors = 3;
  p.guns.heron = 1;
  await page.evaluate(
    ({ key, p }) => localStorage.setItem(key, JSON.stringify(p)),
    { key: SAVE_KEY, p },
  );
  await page.reload();
  await page.waitForFunction(() =>
    window.render_game_to_text?.().includes('"phase":"base"'),
  );
  await page.getByRole('button', { name: '准备部署' }).click();
  await page.getByRole('button', { name: /精确步枪 库存/ }).click();
  await page.getByLabel('携带医疗包数量').selectOption('3');
  await page.locator('#ex-deploy').click();
  await tick(0);
  // Eastern approach uses the road, then the opening in the medical station's west wall.
  await move(-32, 32);
  await move(-9, 32);
  await move(-9, 25);
  await move(8, 25);
  await move(8, 0);
  await heal();
  await move(25, 0);
  await move(28, 12);
  await heal();
  await loot('med');
  assert((await state()).bag.includes('sample'));
  await page.screenshot({
    path: `output/medical.png`.replace('output', output),
  });
  console.log('Medical secured', JSON.stringify((await state()).player));
  await move(28, 0);
  await move(8, 0);
  await move(8, 25);
  await move(-9, 25);
  await move(-9, 34);
  await move(-32, 34);
  await move(-32, 42);
  await tick(6500);
  assert.equal((await state()).phase, 'won');
  assert.equal((await state()).profile.contract, 2);
  await page.screenshot({ path: `${output}/chapter2.png` });
  await page.getByRole('button', { name: '返回基地' }).click();
  await page.getByRole('button', { name: '准备部署' }).click();
  await page.getByLabel('携带医疗包数量').selectOption('3');
  await page.locator('#ex-deploy').click();
  await tick(0);
  await move(-32, 26);
  await move(-32, 7);
  await move(-17, 7);
  await move(-17, -17);
  await heal();
  await page.keyboard.press('KeyE');
  await tick(3200);
  assert((await state()).powered);
  await page.screenshot({ path: `${output}/power.png` });
  await move(-17, -19);
  await move(0, -19);
  await move(16, -17);
  await move(16, -26);
  await fight();
  await heal();
  await move(21, -31);
  await page.keyboard.press('KeyE');
  await tick(4300);
  assert((await state()).radar);
  await move(22.5, -32);
  await loot('signal-core');
  assert((await state()).bag.includes('core'));
  await page.screenshot({ path: `${output}/radar.png` });
  await move(16, -26);
  await move(16, -17);
  await move(16, -19);
  await move(38, -19);
  await heal();
  await move(39, -38);
  await tick(7000);
  assert.equal((await state()).phase, 'won');
  assert.equal((await state()).profile.contract, 3);
  await page.waitForTimeout(2800);
  assert.equal(await page.locator('.ex-ending strong').evaluate(e => getComputedStyle(e).opacity), '1');
  await page.screenshot({ path: `${output}/ending.png` });
  await page.getByRole('button', { name: '返回基地' }).click();
  await page.reload();
  await page.waitForFunction(() =>
    window.render_game_to_text?.().includes('"phase":"base"'),
  );
  assert.equal((await state()).profile.contract, 3);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${output}/state.json`,
    JSON.stringify(await state(), null, 2),
  );
  console.log('Campaign chapter 2 -> chapter 3 -> ending -> reload PASS');
} catch (e) {
  await page.screenshot({ path: `${output}/failure.png` });
  fs.writeFileSync(
    `${output}/failure.json`,
    JSON.stringify(await state(), null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
