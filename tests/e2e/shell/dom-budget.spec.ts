import { test, expect } from '@playwright/test';
import { signIn, PERSONA_EMAILS } from '../../support/e2e-helpers';

const CANDIDATE = '/recruit/candidates/b0000000-0000-4000-8000-000000000002';
const CLOSED_SECTION_CEILING = 12;

test.describe('record page DOM budget', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await page.goto(CANDIDATE);
    await expect(page.getByRole('button', { name: /Candidate Information/ })).toBeVisible();
  });

  test('a collapsed section renders no children', async ({ page }) => {
    const closed = page.locator('.record-section[data-open="false"]');
    const count = await closed.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const nodes = await closed.nth(i).locator('*').count();
      const title = (await closed.nth(i).locator('button').first().textContent()) || '';
      expect(nodes, `collapsed section "${title.trim()}" rendered ${nodes} nodes`).toBeLessThanOrEqual(
        CLOSED_SECTION_CEILING,
      );
    }
  });

  test('expanding a collapsed section mounts its children', async ({ page }) => {
    const raw = await page.locator('.record-section[data-open="false"] button').first().textContent();
    const title = (raw ?? '').trim();
    expect(title).not.toBe('');

    const section = page.locator('.record-section', { has: page.getByRole('button', { name: title }) });
    await expect(section).toHaveAttribute('data-open', 'false');
    const before = await section.locator('*').count();

    await section.getByRole('button', { name: title }).click();
    await expect(section).toHaveAttribute('data-open', 'true');
    expect(await section.locator('*').count()).toBeGreaterThan(before);
  });
});
