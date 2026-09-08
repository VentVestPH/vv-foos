import { test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';

test('pipeline dashboard: what the ATS funnel request actually returns', async ({ page }) => {
  test.setTimeout(120000);
  const seen: string[] = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('vw_ats_funnel') && !url.includes('vw_crm_funnel')) return;
    let rows = 'unreadable';
    try {
      const body = await res.text();
      const parsed = JSON.parse(body) as unknown;
      rows = Array.isArray(parsed) ? String(parsed.length) : `not-array: ${body.slice(0, 200)}`;
    } catch (e) {
      rows = `parse-failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    seen.push(`${res.status()} rows=${rows} ${decodeURIComponent(url)}`);
  });

  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/pipeline');
  await page.waitForTimeout(7000);

  const bars = await page
    .locator('.dash-grid-2 .bar-list-row, .dash-grid-2 [class*="bar"]')
    .evaluateAll((ns) => ns.map((n) => (n as HTMLElement).innerText.replace(/\n/g, '|')).slice(0, 20));

  for (const s of seen) console.log(`REQ ${s}`);
  console.log(`BARS ${JSON.stringify(bars).slice(0, 600)}`);
});
