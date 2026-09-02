import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4178';
const STATE = '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/auth-state.json';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STATE });
  const page = await context.newPage();

  const requests = [];
  let navStart = null;

  page.on('request', (req) => {
    if (navStart === null) navStart = Date.now();
    req.__startWall = Date.now();
  });

  page.on('requestfinished', async (req) => {
    const resp = await req.response();
    let transferSize = null;
    try {
      const sizesObj = await req.sizes();
      transferSize = sizesObj.responseHeadersSize + sizesObj.responseBodySize;
    } catch {}
    const timingObj = req.timing();
    const url = new URL(req.url());
    requests.push({
      path: url.origin + url.pathname,
      method: req.method(),
      status: resp ? resp.status() : null,
      transferSize,
      durationMs: timingObj ? Math.round(timingObj.responseEnd) : null,
      startOffsetMs: navStart !== null ? req.__startWall - navStart : null,
      resourceType: req.resourceType(),
    });
  });

  page.on('requestfailed', (req) => {
    const url = new URL(req.url());
    requests.push({
      path: url.origin + url.pathname,
      method: req.method(),
      status: 'FAILED',
      transferSize: null,
      durationMs: null,
      startOffsetMs: navStart !== null ? req.__startWall - navStart : null,
      resourceType: req.resourceType(),
      failure: req.failure()?.errorText,
    });
  });

  await page.goto(`${BASE}/recruit/candidates`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  await browser.close();

  const totalBytes = requests.reduce((s, r) => s + (r.transferSize || 0), 0);
  const out = { requestCount: requests.length, totalBytes, requests };
  fs.writeFileSync(
    '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/network-results.json',
    JSON.stringify(out, null, 2),
  );
  console.log('Total requests:', requests.length, 'Total bytes:', totalBytes);
  console.log(JSON.stringify(requests, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
