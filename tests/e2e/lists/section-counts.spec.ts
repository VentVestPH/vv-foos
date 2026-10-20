import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const CANDIDATE = '/recruit/candidates/b0000000-0000-4000-8000-000000000002';

test('U2: an empty section states its count and starts collapsed, instead of a sentence of nothing', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, CANDIDATE);
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });

  const state = await page.evaluate(() => {
    const out: { title: string; open: string | null; hasWayToAdd: boolean }[] = [];
    for (const section of Array.from(document.querySelectorAll('.record-section'))) {
      const header = section.querySelector('.record-section-header');
      const body = section.querySelector('.record-section-body');
      out.push({
        title: (header?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        open: section.getAttribute('data-open'),
        hasWayToAdd:
          body !== null &&
          body.querySelector('input, textarea, select, [role="combobox"], .btn') !== null,
      });
    }
    return out;
  });

  const zeroCount = state.filter((s) => /\(0\)$/.test(s.title));
  expect(
    zeroCount.length,
    `at least one section should carry a zero count. Saw: ${state.map((s) => s.title).join(' | ')}`,
  ).toBeGreaterThan(0);

  const pointlesslyOpen = zeroCount.filter((s) => s.open === 'true' && !s.hasWayToAdd);
  expect(
    pointlesslyOpen.map((s) => s.title),
    'an empty section may only start open if it offers a way to add something. ' +
      'Tasks and Reminders qualify because they carry the create form; a section that ' +
      'only says "none yet" must start collapsed with its count in the header',
  ).toEqual([]);
});

test('U2: a populated section shows its real count in the header', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, CANDIDATE);
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });

  const titles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.record-section-header')).map((h) =>
      (h.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
  );
  const counted = titles.filter((t) => /\(\d+\)$/.test(t));
  expect(
    counted.length,
    `sections should declare counts. Saw: ${titles.join(' | ')}`,
  ).toBeGreaterThanOrEqual(3);
});
