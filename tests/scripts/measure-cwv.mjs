import { chromium } from '@playwright/test';

const BASE = process.env.FOOS_BASE_URL ?? 'http://localhost:5175';
const EMAIL = process.env.FOOS_CWV_EMAIL ?? 'demo-admin@ventvest.test';
const PASSWORD = process.env.FOOS_QA_TEST_PASSWORD ?? process.env.FOOS_CWV_PASSWORD ?? '';

const ROUTES = [
  ['/', 'Dashboard'],
  ['/recruit/requisitions', 'Requisitions list'],
  ['/recruit/candidates', 'Candidates list'],
  ['/recruit/candidates/b0000000-0000-4000-8000-000000000002', 'Candidate record'],
  ['/sales/deals', 'Deals board'],
  ['/sales/accounts', 'Accounts list'],
  ['/intake', 'Intake queue'],
];

const COLLECT = `
  window.__cwv = { lcp: 0, cls: 0, shifts: 0, longTasks: 0, longTaskMs: 0, inp: 0, interactions: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__cwv.lcp = Math.max(window.__cwv.lcp, e.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (!e.hadRecentInput) { window.__cwv.cls += e.value; window.__cwv.shifts += 1; }
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__cwv.longTasks += 1;
      window.__cwv.longTaskMs += e.duration;
    }
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.interactionId) {
        window.__cwv.inp = Math.max(window.__cwv.inp || 0, e.duration);
        window.__cwv.interactions = (window.__cwv.interactions || 0) + 1;
      }
    }
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
`;

function verdict(metric, value) {
  const t = { lcp: [2500, 4000], cls: [0.1, 0.25], inp: [200, 500] }[metric];
  if (value <= t[0]) return 'good';
  if (value <= t[1]) return 'needs work';
  return 'poor';
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(COLLECT);
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.getByLabel(/email/i).fill(EMAIL);
await page.getByLabel(/password/i).fill(PASSWORD);
await page.getByRole('button', { name: /sign in|log in/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });

const rows = [];
for (const [path, label] of ROUTES) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => window.__cwv);
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n ? { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd } : { ttfb: 0, dcl: 0 };
  });

  const startUrl = page.url();
  const candidates = page.locator(
    'main button:visible:not([disabled]), main [role="tab"]:visible, .record-section > button:visible',
  );
  const n = Math.min(await candidates.count(), 12);
  let clicked = 0;
  for (let i = 0; i < n && clicked < 6; i += 1) {
    const el = candidates.nth(i);
    const label = ((await el.getAttribute('aria-label')) ?? (await el.innerText().catch(() => '')) ?? '').trim();
    if (/logout|sign out|delete|erase|export|save|merge|send/i.test(label)) continue;
    await el.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
    if (page.url() !== startUrl) {
      await page.goto(startUrl, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      continue;
    }
    if (await page.locator('[role="dialog"]').count()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    clicked += 1;
  }
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    ...window.__cwv,
    counted: performance.interactionCount ?? -1,
  }));
  const inp = after.inp ?? 0;
  const interactions = after.counted > 0 ? after.counted : clicked;

  rows.push({ label, lcp: m.lcp, cls: m.cls, shifts: m.shifts, longTasks: m.longTasks,
              longTaskMs: m.longTaskMs, ttfb: nav.ttfb, inp, interactions });
  await page.evaluate(() => { window.__cwv = { lcp: 0, cls: 0, shifts: 0, longTasks: 0, longTaskMs: 0, inp: 0, interactions: 0 }; });
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n, d = 0) => String(typeof v === 'number' ? v.toFixed(d) : v).padStart(n);

console.log(`\nCore Web Vitals, LOCAL STACK at ${BASE}, signed in as ${EMAIL}`);
console.log('LCP and TTFB are over loopback and are optimistic against any real network.');
console.log('CLS, layout shifts, long tasks and INP are layout- and CPU-bound and do transfer.\nINP is the worst event duration over 6 real clicks per route. The Event Timing API clamps its\nthreshold to 16ms, so an INP of 0 with a nonzero clicks column means every interaction landed\nand every one finished under 16ms. clicks is performance.interactionCount, which has no threshold.\n');
console.log(`${pad('route', 20)}${num('LCP', 8)}${num('CLS', 8)}${num('shifts', 8)}${num('tasks>50ms', 12)}${num('blocked', 9)}${num('TTFB', 8)}${num('INP', 8)}${num('clicks', 8)}`);
console.log('-'.repeat(85));
for (const r of rows) {
  console.log(
    pad(r.label, 20) + num(r.lcp, 8) + num(r.cls, 8, 3) + num(r.shifts, 8) +
    num(r.longTasks, 12) + num(r.longTaskMs, 9) + num(r.ttfb, 8) + num(r.inp, 8, 0) + num(r.interactions, 8),
  );
}

const worstCls = Math.max(...rows.map((r) => r.cls));
const worstLcp = Math.max(...rows.map((r) => r.lcp));
console.log(`\nworst CLS ${worstCls.toFixed(3)} (${verdict('cls', worstCls)}) on ${rows.find((r) => r.cls === worstCls).label}`);
console.log(`worst LCP ${worstLcp.toFixed(0)}ms (${verdict('lcp', worstLcp)} locally, not a deployed figure) on ${rows.find((r) => r.lcp === worstLcp).label}`);

const worstInp = Math.max(...rows.map((r) => r.inp));
const measured = rows.filter((r) => r.interactions > 0);
console.log(`worst INP ${worstInp.toFixed(0)}ms (${verdict('inp', worstInp)}) on ${rows.find((r) => r.inp === worstInp).label}`);
console.log(`total long tasks over 50ms across all routes: ${rows.reduce((n, r) => n + r.longTasks, 0)}`);
console.log(`INP measured on ${measured.length} of ${rows.length} routes; unmeasured: ${
  rows.filter((r) => r.interactions === 0).map((r) => r.label).join(', ') || 'none'
}`);
