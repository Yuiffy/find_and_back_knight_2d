import fs from 'node:fs';
import assert from 'node:assert/strict';
import { freshProfile, SAVE_KEY } from '../src/extraction/model.ts';
import { launchExtractionBrowser } from './extraction-browser.mjs';

const out = '.tmp/test-artifacts/extraction-inventory-responsive';
fs.mkdirSync(out, { recursive: true });
const browser = await launchExtractionBrowser(), results = [];
try {
  for (const [width, height] of [[2560,1440],[1280,720],[390,844],[320,568],[844,390]]) {
    const touch = width < 1000;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const tick = async ms => { await page.evaluate(ms => window.advanceTime(ms), ms); await page.waitForTimeout(100); };
    const screenshot = async name => { await page.waitForTimeout(380); await page.screenshot({ path: `${out}/${width}-${name}.png` }); };
    const grid = zone => page.locator(`[data-grid-zone="${zone}"]`);
    const tile = (zone, item) => grid(zone).locator(`[data-item="${item}"]`).first();
    const act = locator => touch ? locator.tap() : locator.click();
    await page.goto('http://127.0.0.1:4175/knight/');
    await page.waitForFunction(() => window.render_game_to_text?.().includes('"phase":"base"'));
    const seed = freshProfile();
    seed.settings.reducedMotion = true;
    seed.lost = { x: -32, z: 37, weapon: 'kestrel', items: ['scrap','electronics','medicine','sample','core','gold'] };
    await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify(profile)), { key: SAVE_KEY, profile: seed });
    await page.reload();
    await act(page.getByRole('button', { name: '准备部署' })); await act(page.locator('#ex-deploy')); await tick(0);
    await page.keyboard.press('KeyE'); await tick(0);
    assert.equal((await state()).search.revealed, 6);
    assert.equal(await grid('crate').locator('.ex-item-art').count(), 6);
    assert.equal(await tile('crate', 'medicine').evaluate(e => getComputedStyle(e).animationName), 'none');
    await screenshot('search');
    await act(tile('crate', 'medicine')); await act(page.getByRole('button', { name: '旋转选中物资' }));
    await act(grid('bag').getByRole('gridcell', { name: '背包空格 4,1', exact: true })); await tick(0);
    let s = await state();
    assert.deepEqual(s.bag, ['medicine']); assert.deepEqual(s.bagLayout[0], { x: 3, y: 0, rotated: true });
    const source = await tile('crate', 'scrap').boundingBox(), board = await grid('bag').boundingBox(), cell = (board.width - 2) / 5;
    const end = { x: board.x + 1 + .35 * cell, y: board.y + 1 + 2.35 * cell };
    if (touch) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source.x + 5, y: source.y + 5, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 1 }] });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.ex-grid-preview.is-valid').count(), 1);
      await screenshot('touch-preview');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    } else {
      await page.mouse.move(source.x + 5, source.y + 5); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 8 });
      assert.equal(await page.locator('.ex-grid-preview.is-valid').count(), 1); await page.mouse.up();
    }
    await tick(0); s = await state(); assert.equal(s.usedCells, 4); assert(s.bag.includes('scrap'));
    await act(tile('crate', 'core')); await act(page.getByRole('button', { name: '收纳', exact: true })); await tick(0);
    assert((await state()).bag.includes('core'));
    await act(tile('bag', 'core'));
    assert(await page.getByRole('button', { name: '保护归航信号核心', exact: true }).isDisabled());
    await screenshot('core');
    const overflow = await page.evaluate(() => ({
      horizontal: document.querySelector('.ex-modal').scrollWidth > document.querySelector('.ex-modal').clientWidth + 1,
      controls: [...document.querySelectorAll('.ex-field-inventory button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1); }).map(e => e.getAttribute('aria-label') || e.textContent),
    }));
    assert(!overflow.horizontal); assert.deepEqual(overflow.controls, []);
    await act(page.getByRole('button', { name: '关闭面板' })); await act(page.getByRole('button', { name: '打开战术背包' }));
    await screenshot('bag'); assert.equal(await grid('crate').count(), 0);
    assert.deepEqual(errors, []);
    results.push({ width, height, touch, tapPlacement: true, drag: true, footprint: (await state()).bagLayout, errors });
    await context.close();
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
  console.log('Inventory responsive, actual pointer/touch, reduced motion PASS', JSON.stringify(results));
} finally { await browser.close(); }
