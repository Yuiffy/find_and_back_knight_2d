import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/';
const output = path.resolve('.tmp/test-artifacts/lantern-responsive');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const results = [];
try {
  for (const device of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'qhd', width: 2560, height: 1440 },
    { name: 'portrait', width: 390, height: 844, mobile: true },
    { name: 'small-portrait', width: 375, height: 667, mobile: true },
    { name: 'compact-portrait', width: 320, height: 568, mobile: true },
    { name: 'landscape', width: 844, height: 390, mobile: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height }, deviceScaleFactor: device.mobile ? 2 : 1, hasTouch: Boolean(device.mobile), isMobile: Boolean(device.mobile) });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${device.name}: ${error.message}`));
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
    await page.screenshot({ path: path.join(output, `${device.name}-home.png`) });
    await page.evaluate(() => {
      const key = 'sui-lantern-run.save.v1';
      const profile = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...profile, returns: 1, relics: ['bell'], weapon: 'feather' }));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').phase === 'home');
    const weaponDetail = page.getByLabel('当前武器属性');
    assert((await weaponDetail.innerText()).includes('远程投掷'));
    const homeLayout = await page.evaluate(() => [...document.querySelectorAll('.lantern-tools button, .lantern-weapon-detail, .lantern-home-copy > button')].filter((element) => {
      const r = element.getBoundingClientRect();
      return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || element.scrollWidth > element.clientWidth + 3);
    }).map((element) => element.getAttribute('aria-label') ?? element.textContent));
    assert.deepEqual(homeLayout, [], `${device.name}: weapon selection overflow`);
    const obscured = await page.evaluate(() => {
      const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
      const coach = document.querySelector('.lantern-control-coach')?.getBoundingClientRect();
      const archive = document.querySelector('.lantern-archive')?.getBoundingClientRect();
      const entry = document.querySelector('.lantern-home-copy > button')?.getBoundingClientRect();
      const s = JSON.parse(window.render_game_to_text());
      const player = {
        left: (s.player.x - s.camera.x - 40.5) * s.camera.zoom,
        right: (s.player.x - s.camera.x + 40.5) * s.camera.zoom,
        top: (s.player.y - s.camera.y - 29) * s.camera.zoom,
        bottom: (s.player.y - s.camera.y + 29) * s.camera.zoom,
      };
      return { archive: Boolean(coach && archive && intersects(coach, archive)), player: Boolean(entry && intersects(entry, player)) };
    });
    assert(!obscured.archive && !obscured.player, `${device.name}: home controls overlap ${JSON.stringify(obscured)}`);
    await page.screenshot({ path: path.join(output, `${device.name}-weapon.png`) });
    assert(await page.getByRole('link', { name: '原版远征' }).isVisible());
    if (device.mobile) assert.equal(await page.locator('.lantern-touch-button').count(), 6);
    await page.getByRole('button', { name: '进入温室' }).click();
    const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    if (device.mobile) {
      const button = page.getByRole('button', { name: '向右', exact: true });
      const bounds = await button.boundingBox();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }] });
      await page.evaluate(() => window.advanceTime(300));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.keyboard.down('KeyD');
      await page.evaluate(() => window.advanceTime(300));
      await page.keyboard.up('KeyD');
    }
    await page.evaluate(() => window.advanceTime(30));
    const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert(after.player.x > before.player.x + 40, `${device.name}: movement did not reach Phaser`);
    const pixels = await page.evaluate(async () => {
      await window.advanceTime(17);
      const canvas = document.querySelector('canvas');
      const copy = document.createElement('canvas');
      copy.width = 64;
      copy.height = 64;
      const ctx = copy.getContext('2d');
      ctx.drawImage(canvas, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const colors = new Set();
      let opaque = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 100) opaque++;
        colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
      }
      return { opaque, colors: colors.size, width: canvas.width, height: canvas.height };
    });
    assert(pixels.opaque > 3000 && pixels.colors > 25, `${device.name}: blank or unvaried canvas ${JSON.stringify(pixels)}`);
    assert.equal(pixels.width, device.width);
    assert.equal(pixels.height, device.height);
    // Resume rendering after WebGL readback so screenshots capture a fresh live frame.
    await page.evaluate(() => window.advanceTime(0));
    await page.waitForTimeout(150);
    const layout = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      return { overflow: document.documentElement.scrollWidth - innerWidth, escaped: [...document.querySelectorAll('.lantern-game button, .lantern-objective, .lantern-vitals')].filter(visible).filter((element) => {
        const r = element.getBoundingClientRect();
        return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1 || element.scrollWidth > element.clientWidth + 3;
      }).map((element) => element.getAttribute('aria-label') ?? element.textContent) };
    });
    assert(layout.overflow <= 1 && layout.escaped.length === 0, `${device.name}: layout issue ${JSON.stringify(layout)}`);
    await page.screenshot({ path: path.join(output, `${device.name}-gameplay.png`) });
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    assert(await page.getByRole('dialog', { name: '暂停', exact: true }).isVisible());
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.lantern-dialog')).opacity) > 0.99);
    await page.screenshot({ path: path.join(output, `${device.name}-pause.png`) });
    results.push({ device: device.name, pixels, layout });
    await context.close();
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ok: true, results, errors }, null, 2));
  console.log(JSON.stringify({ ok: true, results, errors }, null, 2));
} finally { await browser.close(); }
