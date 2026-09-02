import { chromium } from 'playwright';
const BASE = 'http://localhost:4178';
const STATE = '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/auth-state.json';
const browser = await chromium.launch();
const context = await browser.newContext({ storageState: STATE });
const page = await context.newPage();
page.on('console', (msg) => console.log('CONSOLE:', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
await page.goto(`${BASE}/recruit/candidates`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const err = document.querySelector('.rq-error');
  const pagerText = document.querySelector('.fo-pager, [class*=pager]')?.textContent;
  return { errorText: err?.textContent, pagerText, rowCount: document.querySelectorAll('table tbody tr').length };
});
console.log(info);
await browser.close();
