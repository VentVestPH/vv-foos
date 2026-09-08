import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('Success metrics (QA-008)', () => {
  test('admin sees the four gating metrics with units applied', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/pipeline');

    await page.getByRole('button', { name: /Experiment Metrics/i }).click();
    const widget = page.locator('.dash-widget', { hasText: 'Experiment metrics' });
    await expect(widget).toBeVisible({ timeout: 15000 });

    await widget.getByRole('button', { name: /Refresh now/i }).click();
    await expect(widget.getByRole('button', { name: /Refresh now/i })).toBeEnabled({ timeout: 20000 });

    for (const label of [
      'Adoption: active staff share',
      'Cycle time: intake to submitted (median)',
      'Cost: monthly total of systems being replaced',
      'Data quality: intake dedup rate',
    ]) {
      await expect(widget.getByText(label, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    }

    await expect(widget.locator('.dash-gate-tag').first()).toBeVisible();
    await expect(widget.locator('tbody')).toContainText(/%|Not measured|days|\$/);
  });

  test('a recruiter cannot see the admin-only metrics widget', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/pipeline');
    await expect(page.getByRole('button', { name: /Experiment Metrics/i })).toHaveCount(0);
  });
});
