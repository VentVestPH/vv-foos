import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, signIn } from './helpers';

test('C5: the boot gate shows the branded boot screen and names what it is loading', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);

  let released = false;
  await page.route('**/rest/v1/staff*', async (route) => {
    if (!released) {
      released = true;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    await route.continue().catch(() => undefined);
  });

  await page.goto('/recruit/candidates');

  const pane = page.locator('.fo-boot');
  await expect(pane, 'the boot gate must render the branded boot screen').toBeVisible({
    timeout: 10000,
  });
  await expect(
    pane.locator('.fo-boot-title'),
    'it must say where it is taking the user',
  ).toHaveText('Taking you to Front Office OS');
  await expect(
    pane.locator('.fo-boot-bar-fill'),
    'it must show that something is still happening',
  ).toBeVisible();
  await expect(
    page.getByRole('status', { name: /Loading Front Office OS/ }),
    'a screen reader must be told the app is loading',
  ).toBeAttached();

  await page.unroute('**/rest/v1/staff*');
  await expect(page.getByRole('heading', { name: /^Candidates/ })).toBeVisible({ timeout: 25000 });
});

test('C6: one spelling of the loading message across the app', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await page.goto('/');
  const spellings = await page.evaluate(() => {
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = (node.nodeValue ?? '').trim();
      const m = text.match(/Loading[.…]*/);
      if (m) found.add(m[0]);
      node = walker.nextNode();
    }
    return [...found];
  });
  expect(
    spellings.filter((s) => s.endsWith('...')),
    'the app used both "Loading..." and "Loading…"; only the ellipsis survives',
  ).toEqual([]);
});
