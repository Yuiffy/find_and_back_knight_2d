import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchExtractionBrowser } from './extraction-browser.mjs';
import { ITEMS, SAVE_KEY } from '../src/extraction/model.ts';

const output = '.tmp/test-artifacts/extraction-inventory';
fs.mkdirSync(output, { recursive: true });
const browser = await launchExtractionBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = async ms => { await page.evaluate(ms => window.advanceTime(ms), ms); await page.waitForTimeout(70); return state(); };
const grid = zone => page.locator(`[data-grid-zone="${zone}"]`);
const tile = (zone, item) => grid(zone).locator(`[data-item="${item}"]`).first();
const screenshot = async name => { await page.waitForTimeout(370); await page.screenshot({ path: `${output}/${name}.png` }); };
const ready = () => page.waitForFunction(() => window.render_game_to_text?.().includes('"phase":"base"'));
const deploy = async () => { await page.getByRole('button', { name: '准备部署' }).click(); await page.locator('#ex-deploy').click(); await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'raid'); await tick(0); };
async function hold(key, ms) { await page.keyboard.down(key); await tick(ms); await page.keyboard.up(key); await tick(0); }
async function clickCell(zone, x, y) {
  const r = await grid(zone).boundingBox(), s = await state();
  const columns = zone === 'bag' ? s.bagGrid.columns : zone === 'secure' ? 2 : zone === 'stash' ? 8 : s.search.grid.columns;
  const cell = (r.width - 2) / columns;
  await page.mouse.click(r.x + 1 + (x + .5) * cell, r.y + 1 + (y + .5) * cell);
  await tick(0);
}
async function dragTo(zone, item, target, x, y, capture) {
  const source = await tile(zone, item).boundingBox(), r = await grid(target).boundingBox(), s = await state();
  const columns = target === 'bag' ? s.bagGrid.columns : target === 'secure' ? 2 : s.search.grid.columns;
  const cell = (r.width - 2) / columns;
  await page.mouse.move(source.x + 7, source.y + 7); await page.mouse.down();
  await page.mouse.move(r.x + 1 + (x + .35) * cell, r.y + 1 + (y + .35) * cell, { steps: 8 });
  await page.waitForTimeout(120);
  if (capture) await capture();
  await page.mouse.up(); await tick(0);
}
function validate(s) {
  assert.equal(s.bag.length, s.bagLayout.length);
  const occupied = new Set();
  s.bag.forEach((item, i) => {
    const p = s.bagLayout[i], size = [ITEMS[item].width, ITEMS[item].height], w = p.rotated ? size[1] : size[0], h = p.rotated ? size[0] : size[1];
    assert(p.x >= 0 && p.y >= 0 && p.x + w <= s.bagGrid.columns && p.y + h <= s.bagGrid.rows);
    for (let y = p.y; y < p.y + h; y++) for (let x = p.x; x < p.x + w; x++) { const k = `${x},${y}`; assert(!occupied.has(k)); occupied.add(k); }
  });
  assert.equal(s.usedCells, occupied.size);
}
try {
  await page.goto('http://127.0.0.1:4175/knight/'); await ready(); await deploy();
  await hold('KeyD', 577); await hold('KeyW', 480);
  await page.keyboard.press('KeyE'); await tick(300);
  assert.equal((await state()).search.id, 'dock'); assert.equal((await state()).search.revealed, 0);
  assert.equal(await grid('crate').locator('[data-item]').count(), 0, 'Unknown slots must not expose item images or names');
  assert.equal(await grid('crate').getByRole('progressbar').count(), 1, 'Only the current item should scan');
  await screenshot('01-unknown');
  await tick(460); assert.equal((await state()).search.revealed, 1);
  assert.equal(await grid('crate').locator('[data-item]').count(), 1);
  const progress = (await state()).search.searched;
  await tile('crate', 'beef_jerky').dblclick(); await tick(0);
  assert.deepEqual((await state()).bag, ['beef_jerky']); assert.equal((await state()).search.searched, progress);
  await tick(660); await tile('crate', 'dq_pistachio').click({ modifiers: ['Control'] }); await tick(0);
  assert.equal((await state()).usedCells, 4);
  const partial = (await state()).search.searched;
  await page.keyboard.press('Escape'); await tick(300);
  await page.keyboard.press('KeyE'); await tick(0);
  assert.equal((await state()).search.searched, partial);
  await tick(750); await tile('crate', 'sicily_lemon').dblclick(); await tick(0);
  assert.equal((await state()).usedCells, 6); validate(await state());
  await screenshot('02-revealed-and-stored');

  const beforeBad = (await state()).bagLayout;
  const med = (await state()).bagLayout[(await state()).bag.indexOf('dq_pistachio')];
  await dragTo('bag', 'beef_jerky', 'bag', med.x, med.y, async () => {
    assert.equal(await page.locator('.ex-grid-preview.is-invalid').count(), 1); await screenshot('03-collision-preview');
  });
  assert.deepEqual((await state()).bagLayout, beforeBad);
  await dragTo('bag', 'dq_pistachio', 'bag', 4, 2, async () => {
    assert.equal(await page.locator('.ex-grid-preview.is-valid').count(), 1);
  });
  let s = await state(), index = s.bag.indexOf('dq_pistachio');
  assert.deepEqual(s.bagLayout[index], { x: 4, y: 2, rotated: false });
  await tile('bag', 'dq_pistachio').click(); await page.keyboard.press('KeyR');
  await clickCell('bag', 0, 2);
  s = await state(); index = s.bag.indexOf('dq_pistachio');
  assert.deepEqual(s.bagLayout[index], { x: 0, y: 2, rotated: true });
  assert.equal(s.player.reload, 0, 'Inventory R must not start weapon reload');
  await dragTo('bag', 'dq_pistachio', 'crate', 0, 0);
  assert.equal((await state()).search.identified.at(-1), true);
  await tile('crate', 'dq_pistachio').dblclick(); await tick(0);
  assert.equal((await state()).bag.length, 3); validate(await state());

  await tile('bag', 'sicily_lemon').click(); await page.getByRole('button', { name: '保护西西里柠檬柚', exact: true }).click(); await tick(0);
  assert.equal((await state()).secure, 'sicily_lemon');
  await tile('secure', 'sicily_lemon').click(); await page.getByRole('button', { name: '取回背包', exact: true }).click(); await tick(0);
  assert.equal((await state()).secure, null);
  await tile('bag', 'beef_jerky').click(); await page.getByRole('button', { name: '丢弃风干牛肉干', exact: true }).click(); await tick(0);
  await page.keyboard.press('Escape'); await page.keyboard.press('KeyE'); await tick(0);
  assert((await state()).search.id.startsWith('drop-'));
  assert.equal((await state()).search.revealed, 1);
  await tile('crate', 'beef_jerky').dblclick(); await tick(0);
  await page.getByRole('button', { name: '整理背包' }).click(); await tick(0); validate(await state());
  await screenshot('04-organized');
  await page.keyboard.press('Escape');
  await hold('KeyA', 580); await hold('KeyS', 1350); await tick(6500);
  assert.equal((await state()).phase, 'won');
  assert.equal(await page.locator('.ex-loot-summary svg').count(), 3);
  await screenshot('05-extracted');
  await page.getByRole('button', { name: '返回基地' }).click(); await page.getByRole('button', { name: '03 仓库 / 后勤' }).click();
  await tile('stash', 'dq_pistachio').click(); await page.getByRole('button', { name: '旋转选中物资' }).click();
  const stashBefore = (await state()).profile.stashLayout;
  await screenshot('06-stash');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '导出存档' }).click();
  const download = await downloadPromise; await download.saveAs(`${output}/save.json`);
  const exported = JSON.parse(fs.readFileSync(`${output}/save.json`, 'utf8'));
  assert.deepEqual(exported.stashLayout, stashBefore);
  await page.getByRole('button', { name: '整理仓库' }).click();
  await page.locator('input[type=file]').setInputFiles(`${output}/save.json`);
  await page.reload(); await ready(); assert.deepEqual((await state()).profile.stashLayout, stashBefore);

  // Set a documented corpse scenario, then use the game's real recovery/search UI.
  const recovery = structuredClone((await state()).profile);
  recovery.lost = { x: -32, z: 37, weapon: 'kestrel', items: [...Array(19).fill('gold'), 'core', 'gold'] };
  await page.evaluate(({key, profile}) => localStorage.setItem(key, JSON.stringify(profile)), { key: SAVE_KEY, profile: recovery });
  await page.reload(); await ready(); await deploy(); await page.keyboard.press('KeyE'); await tick(0);
  await page.getByRole('button', { name: '收纳已识别物资' }).click(); await tick(0);
  assert.equal((await state()).bag.length, 20); assert.deepEqual((await state()).search.loot, ['core']);
  for (const [x, y] of [[0,0],[2,0],[4,0],[1,1],[3,1],[0,2]]) {
    const r = await grid('bag').boundingBox(), cell = (r.width - 2) / 5;
    await page.mouse.click(r.x + 1 + (x + .5) * cell, r.y + 1 + (y + .5) * cell);
    await page.getByRole('button', { name: '丢弃旧世纪念章', exact: true }).click(); await tick(0);
  }
  assert.equal((await state()).usedCells, 14);
  await tile('crate', 'core').dblclick(); await tick(0);
  assert.equal((await state()).usedCells, 14, 'Empty area alone is insufficient without a fitting rectangle');
  await page.getByRole('button', { name: '整理背包' }).click(); await tick(0);
  await tile('crate', 'core').dblclick(); await tick(0);
  assert((await state()).bag.includes('core')); assert.equal((await state()).usedCells, 20); validate(await state());
  await tile('bag', 'core').click(); assert(await page.getByRole('button', { name: '保护归航信号核心', exact: true }).isDisabled());
  await screenshot('07-core-and-real-capacity');
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${output}/report.json`, JSON.stringify({ actualInput: true, dragAndRotate: true, unknownPrivacy: true, partialSearch: true, transfers: true, corpseRecovery: true, capacityAndFragmentation: true, stashRoundtrip: true, errors }, null, 2));
  console.log('Grid inventory browser flow PASS', JSON.stringify({ errors }));
} finally { await browser.close(); }
