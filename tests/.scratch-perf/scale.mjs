import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4178';
const STATE = '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/auth-state.json';
const LABEL = process.argv[2] || 'unlabeled';

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const INIT_SCRIPT = () => {
  window.__vitals = { lcp: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__vitals.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
};

async function measureLcpOnce(context) {
  const page = await context.newPage();
  await page.addInitScript(INIT_SCRIPT);
  await page.goto(`${BASE}/recruit/candidates`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const lcp = await page.evaluate(() => window.__vitals.lcp);
  await page.close();
  return lcp;
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STATE });

  const lcpRuns = [];
  for (let i = 0; i < 5; i++) lcpRuns.push(await measureLcpOnce(context));
  const lcp = median(lcpRuns);

  const page = await context.newPage();
  await page.goto(`${BASE}/recruit/candidates`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr', { timeout: 30000 });

  const searchRuns = [];
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const el = document.querySelector('input[aria-label="Search Candidates: Home"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(50);
    const t = await page.evaluate(async () => {
      const el = document.querySelector('input[aria-label="Search Candidates: Home"]');
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const t0 = performance.now();
      setter.call(el, el.value + 'S');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    });
    searchRuns.push(t);
  }
  const searchLatency = median(searchRuns);

  // reset search
  await page.evaluate(() => {
    const el = document.querySelector('input[aria-label="Search Candidates: Home"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(100);

  const sortRuns = [];
  for (let i = 0; i < 5; i++) {
    const t = await page.evaluate(async () => {
      const ths = Array.from(document.querySelectorAll('th.sortable'));
      const th = ths.find((t) => t.textContent.trim().startsWith('Name'));
      const t0 = performance.now();
      th.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    });
    sortRuns.push(t);
  }
  const sortLatency = median(sortRuns);

  await page.close();
  await browser.close();

  const result = { label: LABEL, lcp, lcpRuns, searchLatency, searchRuns, sortLatency, sortRuns };
  const outPath = `/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/scale-${LABEL}.json`;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
