import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const ROUTES = [
  ['dashboard', '/'],
  ['pipeline', '/pipeline'],
  ['candidates', '/recruit/candidates'],
  ['candidate record', '/recruit/candidates/b0000000-0000-4000-8000-000000000002'],
  ['requisition record', '/recruit/requisitions/d0000000-0000-4000-8000-000000000001'],
  ['deals', '/sales/deals'],
  ['intake', '/intake'],
] as const;

const GROUPS = ['.record-section', '.record-action-bar', '.list-page-toolbar', '.dash-widget'];

test('K8: no action group offers more than one primary button', async ({ page }) => {
  test.setTimeout(180000);
  await signIn(page, PERSONA_EMAILS.admin);
  const offenders: string[] = [];

  for (const [name, path] of ROUTES) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('main .btn').first()).toBeVisible({ timeout: 25000 });

    const found = await page.evaluate((groups) => {
      const bad: string[] = [];
      for (const sel of groups) {
        for (const group of Array.from(document.querySelectorAll(`main ${sel}`))) {
          const own = Array.from(group.querySelectorAll('.btn-primary')).filter((b) => {
            const closer = b.closest(groups.join(', '));
            return closer === group;
          });
          if (own.length > 1) {
            bad.push(
              `${sel} has ${own.length} primaries: ${own
                .map((b) => (b.textContent ?? '').trim().slice(0, 20))
                .join(', ')}`,
            );
          }
        }
      }
      return bad;
    }, GROUPS);

    offenders.push(...found.map((f) => `${name}: ${f}`));
  }

  expect(
    offenders,
    'one primary per action group, so the main action is identifiable',
  ).toEqual([]);
});

test('K8: a list page with a create action makes it the primary', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  for (const [name, path, label] of [
    ['deals', '/sales/deals', 'New Deal'],
    ['intake', '/intake', 'Paste URLs'],
  ] as const) {
    await gotoAsSignedIn(page, path);
    const control = page.getByRole('button', { name: label });
    await expect(control, `${name} should offer ${label}`).toBeVisible({ timeout: 25000 });
    await expect(control, `${label} must be the page primary`).toHaveClass(/btn-primary/);
  }
});

test('K8: the four variants are visually distinct, not just differently named', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/requisitions/d0000000-0000-4000-8000-000000000001');
  await expect(page.locator('main .btn').first()).toBeVisible({ timeout: 25000 });
  const looks = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const kind of ['primary', 'secondary', 'danger', 'ghost']) {
      const el = document.querySelector(`main .btn-${kind}`);
      if (!el) continue;
      const cs = getComputedStyle(el);
      out[kind] = `${cs.backgroundColor}|${cs.color}|${cs.borderColor}`;
    }
    return out;
  });
  const values = Object.values(looks);
  expect(values.length, 'the record page should render at least three variants').toBeGreaterThan(2);
  expect(new Set(values).size, `two variants render identically: ${JSON.stringify(looks)}`).toBe(
    values.length,
  );
});
