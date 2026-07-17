import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('.tmp/test-artifacts/save-roundtrip');
fs.mkdirSync(outputDir, { recursive: true });
const exportPath = path.join(outputDir, 'exported-save.json');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置' }).click();
  await page.getByText('已创建新的本地存档。').waitFor();
  const seeded = await page.evaluate(() => {
    const key = 'sui-echoes-below.save.v1';
    const current = JSON.parse(localStorage.getItem(key));
    const next = {
      ...current,
      successfulExtractions: 7,
      mapUnlocked: true,
      shortcutUnlocked: true,
      stashCapacity: 16,
      backpackCapacity: 8,
      activeRaid: null,
    };
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  await page.reload({ waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出' }).click();
  const download = await downloadPromise;
  await download.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  assert(exported.successfulExtractions === seeded.successfulExtractions, 'Export changed profile progress.');
  assert(exported.mapUnlocked === true && exported.shortcutUnlocked === true, 'Export omitted unlock flags.');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置' }).click();
  await page.getByText('已创建新的本地存档。').waitFor();
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(stored.successfulExtractions === 0, 'Reset did not restore default progress.');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(exportPath);
  await page.getByText('存档导入成功。').waitFor();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sui-echoes-below.save.v1')));
  assert(stored.successfulExtractions === 7, 'Imported progress did not replace the reset profile.');
  assert(stored.mapUnlocked === true && stored.shortcutUnlocked === true, 'Imported unlock flags were not restored.');

  await page.screenshot({ path: path.join(outputDir, '01-import-restored.png'), fullPage: true });
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, exported: true, reset: true, imported: true, errors }, null, 2));
} finally {
  await browser.close();
}
