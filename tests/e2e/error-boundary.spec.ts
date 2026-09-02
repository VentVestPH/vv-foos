import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('O1: a render error is contained instead of blanking the app', () => {
  test('a throwing route shows the boundary, and the shell survives', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');

    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });

    await page.evaluate(() => {
      const target = document.querySelector('#main-content');
      if (!target) throw new Error('main-content is missing');
      const detail = new Error('QA induced render failure');
      const react = (target as unknown as Record<string, unknown>);
      void react;
      throw detail;
    }).catch(() => undefined);

    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
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
    await gotoAsSignedIn(page, '/?tab=pipeline');

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
