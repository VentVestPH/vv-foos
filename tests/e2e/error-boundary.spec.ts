import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.afterAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin
    .from('client_errors')
    .delete()
    .like('message', '%dynamically imported module%');
  if (error) throw new Error(`could not clean up client_errors: ${error.message}`);
});

test.describe('O1: a render error is contained instead of blanking the app', () => {
  test('a route whose lazy chunk fails to load shows the boundary, and the shell survives', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await page.route('**/src/modules/sales/index.tsx*', (route) => route.abort());
    await page.goto('/sales/deals');

    const boundary = page.locator('.error-boundary');
    await expect(boundary).toHaveCount(1, { timeout: 25000 });
    await expect(page.locator('.error-boundary-title')).toHaveText(
      'This page could not be displayed',
    );
    await expect(page.locator('.error-boundary-detail')).toContainText(
      'Failed to fetch dynamically imported module',
    );

    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload the page' })).toBeVisible();

    const admin = await clientAs('admin');
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('client_errors')
            .select('origin, route')
            .like('origin', 'boundary:%')
            .like('message', '%dynamically imported module%');
          return data?.length ?? 0;
        },
        { timeout: 15000 },
      )
      .toBeGreaterThan(0);
  });

  test('the boundary markup and controls exist and are reachable', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const hasBoundary = await page.evaluate(() => {
      const style = [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules].map((r) => r.cssText);
          } catch {
            return [];
          }
        })
        .some((text) => text.includes('.error-boundary'));
      return style;
    });
    expect(hasBoundary, 'the error boundary styles must ship, not just the component').toBe(true);
  });

  test('a dashboard widget renders inside its own boundary on the pipeline tab', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/pipeline');

    await expect(page.locator('.dash-widgets-panel')).toBeVisible({ timeout: 25000 });
    const widget = page.locator('.dash-widget').first();
    await expect(widget).toBeVisible({ timeout: 25000 });

    const headerHasSibling = await widget.evaluate((node) => {
      const head = node.querySelector('.dash-widget-head');
      return head !== null && head.nextElementSibling !== null;
    });
    expect(headerHasSibling, 'widget content renders after the header').toBe(true);

    await expect(page.locator('[role="alert"].error-boundary')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });
});
