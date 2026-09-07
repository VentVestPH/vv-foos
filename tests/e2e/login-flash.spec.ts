import { test, expect } from '@playwright/test';
import { PERSONA_EMAILS, testPassword } from './helpers';

const HOLD_TEXT = 'Account not provisioned';

async function watchForHoldCard(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate((needle) => {
    const w = window as unknown as { __holdSeen?: number; __holdObserver?: MutationObserver };
    w.__holdSeen = 0;
    const check = () => {
      if (document.body.innerText.includes(needle)) {
        w.__holdSeen = (w.__holdSeen ?? 0) + 1;
      }
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    w.__holdObserver = observer;
  }, HOLD_TEXT);
}

async function holdCardRenders(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as { __holdSeen?: number; __holdObserver?: MutationObserver };
    w.__holdObserver?.disconnect();
    return w.__holdSeen ?? -1;
  });
}

test('W24: a successful login never renders the not-provisioned hold card', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(PERSONA_EMAILS.admin);
  await page.getByLabel(/password/i).fill(testPassword());
  await watchForHoldCard(page);

  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 20000 });

  const seen = await holdCardRenders(page);
  console.log(`PROBE holdCardRenders=${String(seen)}`);
  expect(seen).toBe(0);
});

test('W24: the hold card still appears when the staff row really is missing', async ({ page }) => {
  await page.route(/\/rest\/v1\/staff\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'content-range',
        'content-range': '*/0',
      },
      body: '[]',
    });
  });

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(PERSONA_EMAILS.admin);
  await page.getByLabel(/password/i).fill(testPassword());
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await expect(page.getByRole('heading', { name: HOLD_TEXT })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
});
