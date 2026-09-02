import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4178';
const STATE = '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/auth-state.json';

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function measure5(page, fn, setupFn) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    if (setupFn) await page.evaluate(setupFn, i);
    const t = await page.evaluate(fn, i);
    times.push(t);
  }
  return { median: median(times), runs: times };
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STATE });
  const results = {};

  // ---- /recruit/candidates interactions ----
  const cpage = await context.newPage();
  await cpage.goto(`${BASE}/recruit/candidates`, { waitUntil: 'networkidle' });
  await cpage.waitForSelector('table tbody tr', { timeout: 15000 });

  // 1. Sortable column header click (toggle "Name" sort each time)
  results.sortHeaderClick = await measure5(cpage, async () => {
    const ths = Array.from(document.querySelectorAll('th.sortable'));
    const th = ths.find((t) => t.textContent.trim().startsWith('Name'));
    const t0 = performance.now();
    th.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  });

  // 2. Search box keystroke latency (type one char, clearing between runs via setup)
  results.searchKeystroke = await measure5(
    cpage,
    async () => {
      const el = document.querySelector('input[aria-label="Search Candidates: Home"]');
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const t0 = performance.now();
      setter.call(el, el.value + 'a');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    },
    async () => {
      // reset search box to empty before each keystroke measurement
      const el = document.querySelector('input[aria-label="Search Candidates: Home"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
    },
  );

  // 3. Filter toggle in filter rail (Grade select: cycle between '' and '1')
  results.filterToggle = await measure5(cpage, async (i) => {
    const labels = Array.from(document.querySelectorAll('label.field-label'));
    const label = labels.find((l) => l.textContent.trim() === 'Grade');
    const select = document.getElementById(label.htmlFor);
    const value = i % 2 === 0 ? '1' : '';
    const t0 = performance.now();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  });

  // reset filter
  await cpage.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label.field-label'));
    const label = labels.find((l) => l.textContent.trim() === 'Grade');
    const select = document.getElementById(label.htmlFor);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(select, '');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // 4. Star rating click (toggle 1-star on first editable row, on/off each run)
  results.starClick = await measure5(cpage, async () => {
    const btn = document.querySelector('.star-grade.editable button[role="radio"]');
    const t0 = performance.now();
    btn.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  });

  await cpage.close();

  // ---- /sales/deals kanban<->table toggle ----
  const dpage = await context.newPage();
  await dpage.goto(`${BASE}/sales/deals`, { waitUntil: 'networkidle' });
  await dpage.waitForSelector('.sales-view-toggle', { timeout: 15000 });

  results.dealsViewToggle = await measure5(dpage, async (i) => {
    const group = document.querySelector('.sales-view-toggle');
    const buttons = Array.from(group.querySelectorAll('button'));
    const target = i % 2 === 0
      ? buttons.find((b) => b.textContent.trim() === 'Table')
      : buttons.find((b) => b.textContent.trim() === 'Kanban');
    const t0 = performance.now();
    target.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  });

  await dpage.close();
  await browser.close();

  fs.writeFileSync(
    '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/interaction-results.json',
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
