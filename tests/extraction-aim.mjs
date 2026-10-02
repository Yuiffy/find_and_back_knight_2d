import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const state = () => p.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = async (ms) => {
  await p.evaluate((ms) => window.advanceTime(ms), ms);
  await p.waitForTimeout(35);
};
async function move(x, z) {
  for (let i = 0; i < 100; i++) {
    const s = await state(),
      dx = x - s.player.x,
      dz = z - s.player.z;
    if (Math.hypot(dx, dz) < 0.3) return;
    const keys = [];
    if (Math.abs(dx) > 0.2) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dz) > 0.2) keys.push(dz > 0 ? 'KeyS' : 'KeyW');
    for (const k of keys) await p.keyboard.down(k);
    await tick(Math.min(250, (Math.hypot(dx, dz) / 5.2) * 1000));
    for (const k of keys) await p.keyboard.up(k);
    await tick(1);
  }
}
try {
  await p.goto('http://127.0.0.1:4175/knight/');
  await p.getByRole('button', { name: '准备部署' }).click();
  await p.locator('#ex-deploy').click();
  await tick(0);
  await move(-32, 24);
  await move(-25, 24);
  await move(-25, 21);
  for (let i = 0; i < 15; i++) {
    let s = await state();
    if (s.kills) break;
    const e = s.screen.enemies.find((e) => e.id === 0);
    await p.mouse.move(e.x, e.y - 14);
    await p.waitForTimeout(40);
    await p.mouse.down({ button: 'right' });
    await p.mouse.down();
    await tick(180);
    await p.mouse.up();
    await p.mouse.up({ button: 'right' });
  }
  const s = await state();
  assert(s.kills >= 1, 'Aim at upper torso across camera must hit');
  assert.deepEqual(errors, []);
  await p.screenshot({ path: '.tmp/test-artifacts/extraction/aim-torso.png' });
  console.log('Torso aim + simultaneous ADS/fire PASS', {
    kills: s.kills,
    ammo: s.player.mag,
    errors,
  });
} finally {
  await b.close();
}
