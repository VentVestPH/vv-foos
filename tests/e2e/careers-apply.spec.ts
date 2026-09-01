import { expect, test } from '@playwright/test';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const CAREERS_BASE = process.env.FOOS_CAREERS_URL ?? `${SUPABASE_URL}/functions/v1/careers-page`;

const RUN_IP = `203.0.113.${1 + Math.floor(Math.random() * 250)}`;

test.describe('Careers page (public)', () => {
  test('listing page loads with a title and no sign-in', async ({ page }) => {
    const res = await page.goto(CAREERS_BASE);
    expect(res?.status()).toBeLessThan(300);
    await expect(page).toHaveTitle(/careers|jobs|ventvest/i);
    await expect(page.locator('body')).not.toContainText(/sign in with email/i);
  });

  test('375px mobile viewport has no horizontal scroll on the listing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(CAREERS_BASE);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('apply endpoint rejects a submission with no resume', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/careers-apply`, {
      headers: { 'x-forwarded-for': RUN_IP },
      multipart: {
        requisition_id: '00000000-0000-4000-8000-000000000000',
        full_name: 'E2E No Resume',
        email: 'e2e-no-resume@example.com',
        phone: '+63 917 000 0000',
        consent: 'true',
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/resume/i);
  });
});
