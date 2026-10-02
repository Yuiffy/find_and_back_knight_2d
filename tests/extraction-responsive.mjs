import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const out = '.tmp/test-artifacts/extraction-responsive';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [width, height] of [
    [2560, 1440],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:4175/knight/');
    await page.waitForFunction(() =>
      window.render_game_to_text?.().includes('"phase":"base"'),
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${width}-base.png` });
    const outOfBounds = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('.ex-app button,.ex-app a'))
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width && r.height && (r.left < -1 || r.right > innerWidth + 1)
            );
          })
          .map((e) => e.textContent),
      );
    assert.deepEqual(await outOfBounds(), []);
    await page.getByRole('button', { name: '准备部署' }).click();
    await page.locator('#ex-deploy').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${width}-loadout.png` });
    await page.locator('#ex-deploy').click();
    await page.waitForFunction(
      () => JSON.parse(window.render_game_to_text()).phase === 'raid',
    );
    await page.evaluate(() => window.advanceTime(0));
    await page.waitForTimeout(200);
    const before = JSON.parse(
      await page.evaluate(() => window.render_game_to_text()),
    );
    if (width < 1000) {
      const stick = page.getByLabel('移动摇杆');
      const rect = await stick.boundingBox();
      assert(rect);
      await stick.dispatchEvent('pointerdown', {
        pointerId: 1,
        clientX: rect.x + rect.width * 0.85,
        clientY: rect.y + rect.height / 2,
        pointerType: 'touch',
      });
      await page.evaluate(() => window.advanceTime(600));
      await stick.dispatchEvent('pointerup', {
        pointerId: 1,
        pointerType: 'touch',
      });
    } else {
      await page.keyboard.down('KeyD');
      await page.evaluate(() => window.advanceTime(600));
      await page.keyboard.up('KeyD');
    }
    const after = JSON.parse(
      await page.evaluate(() => window.render_game_to_text()),
    );
    assert(after.player.x > before.player.x + 1);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}/${width}-raid.png` });
    if (width < 1000) {
      const aim = page.getByLabel('瞄准射击摇杆'),
        move = page.getByLabel('移动摇杆'),
        a = await aim.boundingBox(),
        m = await move.boundingBox(),
        cdp = await context.newCDPSession(page);
      const aimPoint = { x: a.x + a.width * 0.9, y: a.y + a.height / 2, id: 2 },
        movePoint = { x: m.x + m.width / 2, y: m.y + m.height / 2, id: 1 };
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [movePoint, aimPoint],
      });
      await page.evaluate(() => window.advanceTime(200));
      const ammo1 = JSON.parse(
        await page.evaluate(() => window.render_game_to_text()),
      ).player.mag;
      assert(ammo1 < after.player.mag);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [movePoint],
      });
      await page.evaluate(() => window.advanceTime(250));
      assert(
        JSON.parse(await page.evaluate(() => window.render_game_to_text()))
          .player.mag < ammo1,
        'Releasing movement must not cancel another finger shooting',
      );
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [aimPoint],
      });
      await cdp.detach();
    }
    assert.deepEqual(await outOfBounds(), []);
    const canvas = await page
      .locator('canvas')
      .evaluate((c) => ({ w: c.width, h: c.height }));
    assert.equal(canvas.w, width);
    assert.equal(canvas.h, height);
    await page.getByRole('button', { name: '打开战术地图' }).click();
    await page.screenshot({ path: `${out}/${width}-map.png` });
    await page.getByRole('button', { name: '关闭面板' }).click();
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.screenshot({ path: `${out}/${width}-pause.png` });
    assert.deepEqual(errors, []);
    results.push({ width, height, canvas, errors });
    await context.close();
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log('Responsive and real inputs PASS', JSON.stringify(results));
} finally {
  await browser.close();
}
