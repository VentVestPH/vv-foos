// Browser flow test — public careers page + apply form. No sign-in; this
// hits the deployed careers-page/careers-apply Edge Functions directly
// (FOOS_CAREERS_URL), not the app/ dev server, since the careers page is
// served by the Edge Function itself (see foos/supabase/functions/
// careers-page), not a route inside the React app.
import { expect, test } from '@playwright/test';

const CAREERS_BASE =
  process.env.FOOS_CAREERS_URL ?? 'https://mebfbbvrqdctamnzvbbs.supabase.co/functions/v1/careers-page';

test.describe('Careers page (public)', () => {
  test('listing page loads and privacy link works', async ({ page }) => {
    await page.goto(CAREERS_BASE);
    await expect(page).toHaveTitle(/careers|jobs|ventvest/i);
    const privacyLink = page.getByRole('link', { name: /privacy/i });
    if (await privacyLink.count()) {
      await privacyLink.first().click();
      await expect(page).toHaveURL(/privacy/);
    }
  });

  test('375px mobile viewport has no horizontal scroll on the listing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(CAREERS_BASE);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1px rounding tolerance
  });
});
