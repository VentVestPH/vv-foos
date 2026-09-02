import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4178';
const STATE = '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/auth-state.json';

const INIT_SCRIPT = () => {
  window.__vitals = { lcp: 0, cls: 0, fcp: 0, longTaskCount: 0, tbt: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__vitals.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__vitals.cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.name === 'first-contentful-paint') window.__vitals.fcp = e.startTime;
      }
    }).observe({ type: 'paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__vitals.longTaskCount++;
        window.__vitals.tbt += Math.max(0, e.duration - 50);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
};

async function measureOnce(context, url) {
  const page = await context.newPage();
  await page.addInitScript(INIT_SCRIPT);
  await page.goto(url, { waitUntil: 'load' });
  // let LCP/long tasks settle
  await page.waitForTimeout(2000);
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n
      ? {
          ttfb: n.responseStart - n.requestStart,
          domInteractive: n.domInteractive - n.startTime,
          domContentLoaded: n.domContentLoadedEventEnd - n.startTime,
          loadEvent: n.loadEventEnd - n.startTime,
        }
      : null;
  });
  const vitals = await page.evaluate(() => window.__vitals);
  await page.close();
  return { nav, vitals };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STATE });

  // Find a candidate record URL first
  const page = await context.newPage();
  await page.goto(`${BASE}/recruit/candidates`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr', { timeout: 15000 });
  const firstLink = page.locator('table tbody tr').first().locator('a, button.link-btn').first();
  await firstLink.click();
  await page.waitForURL(/\/recruit\/candidates\/.+/, { timeout: 15000 });
  const candidateUrl = page.url();
  await page.close();
  console.log('Candidate record URL:', candidateUrl);

  const routes = {
    '/': `${BASE}/`,
    '/recruit/requisitions': `${BASE}/recruit/requisitions`,
    '/recruit/candidates': `${BASE}/recruit/candidates`,
    '/sales/deals': `${BASE}/sales/deals`,
    'candidate record': candidateUrl,
  };

  const results = {};
  for (const [label, url] of Object.entries(routes)) {
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const r = await measureOnce(context, url);
      runs.push(r);
    }
    results[label] = {
      url,
      ttfb: median(runs.map((r) => r.nav?.ttfb ?? 0)),
      domInteractive: median(runs.map((r) => r.nav?.domInteractive ?? 0)),
      domContentLoaded: median(runs.map((r) => r.nav?.domContentLoaded ?? 0)),
      loadEvent: median(runs.map((r) => r.nav?.loadEvent ?? 0)),
      lcp: median(runs.map((r) => r.vitals.lcp)),
      fcp: median(runs.map((r) => r.vitals.fcp)),
      cls: median(runs.map((r) => r.vitals.cls)),
      longTaskCount: median(runs.map((r) => r.vitals.longTaskCount)),
      tbt: median(runs.map((r) => r.vitals.tbt)),
      raw: runs,
    };
    console.log(label, JSON.stringify(results[label], null, 0).slice(0, 300));
  }

  fs.writeFileSync(
    '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/cwv-results.json',
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
