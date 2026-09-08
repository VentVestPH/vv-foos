import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const UNIFORM = [
  ['my view', '/'],
  ['pipeline', '/pipeline'],
  ['reports', '/reports'],
  ['requisition record', '/recruit/requisitions/d0000000-0000-4000-8000-000000000001'],
  ['intake linkedin', '/intake/linkedin'],
] as const;

const CANDIDATE_RECORD = '/recruit/candidates/b0000000-0000-4000-8000-000000000002';

async function measure(page: import('@playwright/test').Page, label: string) {
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => document.querySelectorAll('.record-section').length),
      { timeout: 25000, message: `${label}: the accordion count never settled` },
    )
    .toBeGreaterThan(0);
  return page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('.record-section'));
    const gaps: string[] = [];
    const title = (t: Element) =>
      (t.querySelector('.record-section-header')?.textContent ?? '').trim().slice(0, 26);
    for (let i = 1; i < secs.length; i += 1) {
      const a = secs[i - 1].getBoundingClientRect();
      const b = secs[i].getBoundingClientRect();
      const g = Math.round(b.top - a.bottom);
      if (g !== 16) gaps.push(`${g}px after "${title(secs[i - 1])}" before "${title(secs[i])}"`);
    }
    const pads = Array.from(
      new Set(
        Array.from(document.querySelectorAll('.record-section-body')).map(
          (el) => getComputedStyle(el).padding,
        ),
      ),
    );
    return { count: secs.length, gaps, pads };
  });
}

test('K15: consecutive accordions are 16px apart on every route that already agrees', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  for (const [name, path] of UNIFORM) {
    await gotoAsSignedIn(page, path);
    const m = await measure(page, name);
    expect(m.count, `${name} should render accordions`).toBeGreaterThan(0);
    expect(m.gaps, `${name}: every accordion pair must be 16px apart`).toEqual([]);
  }
});

test('K7: every accordion body uses one padding value, on every route', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  const seen = new Set<string>();
  for (const [, path] of [...UNIFORM, ['candidate record', CANDIDATE_RECORD] as const]) {
    await gotoAsSignedIn(page, path);
    const m = await measure(page, path);
    m.pads.forEach((p) => seen.add(p));
  }
  expect(
    [...seen],
    'the accordion body padding must be one value across the whole product',
  ).toHaveLength(1);
});

test('the candidate record now matches the 16px rhythm too', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, CANDIDATE_RECORD);
  const m = await measure(page, 'candidate record');
  expect(
    m.gaps,
    'the 154px was U1 duplicated action bar and the 32px was an empty scroll-anchor div ' +
      'costing two flex gaps. Both are gone; this must stay empty',
  ).toEqual([]);
});
