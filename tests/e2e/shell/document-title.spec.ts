import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const REQ = 'd0000000-0000-4000-8000-000000000001';

test.describe('T1: every screen says where you are', () => {
  test('each list and record page has its own title, not one shared with the app', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    const seen = new Map<string, string>();
    for (const route of [
      '/recruit/candidates',
      '/recruit/requisitions',
      '/sales/companies',
      '/sales/contacts',
      '/sales/deals',
      '/sales/tickets',
      '/intake',
      `/recruit/requisitions/${REQ}`,
    ]) {
      await gotoAsSignedIn(page, route);
      await expect
        .poll(() => page.title(), { timeout: 20000 })
        .not.toBe('VentVest Front Office OS');
      seen.set(route, await page.title());
    }

    for (const [route, title] of seen) {
      expect(title, `${route} must name itself`).toContain('VentVest Front Office OS');
      expect(title.length, `${route} must add its own name`).toBeGreaterThan(
        'VentVest Front Office OS'.length + 3,
      );
    }
    expect(
      new Set(seen.values()).size,
      'no two of these screens may share a title',
    ).toBe(seen.size);
  });

  test('a record page carries its display code, so a bookmark is identifiable', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/requisitions/${REQ}`);
    await expect.poll(() => page.title(), { timeout: 20000 }).toMatch(/REQ-\d+/);
  });
});
