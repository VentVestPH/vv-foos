import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn, waitForAnimations } from './helpers';

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const ROUTES = [
  ['home', '/'],
  ['home pipeline tab', '/pipeline'],
  ['home reports tab', '/reports'],
  ['global search', '/search?q=an'],
  ['requisitions', '/recruit/requisitions'],
  ['requisition new', '/recruit/requisitions/new'],
  ['candidates', '/recruit/candidates'],
  ['accounts', '/sales/companies'],
  ['account new', '/sales/companies/new'],
  ['contacts', '/sales/contacts'],
  ['contact new', '/sales/contacts/new'],
  ['deals', '/sales/deals'],
  ['deal new', '/sales/deals/new'],
  ['tickets', '/sales/tickets'],
  ['promote contact', '/sales/promote'],
  ['intake', '/intake'],
  ['intake linkedin', '/intake/linkedin'],
  ['intake sheet', '/intake/sheet'],
  ['settings', '/settings'],
] as const;

interface AxeViolation {
  id: string;
  impact: string | null;
  nodes: { target: string[] }[];
}

async function violations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: AXE_SOURCE });
  return await page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: AxeViolation[] }> };
      }
    ).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations;
  });
}

test.describe('L12: axe runs against real routes, not token pairs', () => {
  function report(name: string, list: Awaited<ReturnType<typeof violations>>): string[] {
    return list
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map(
        (v) =>
          `${name}: ${v.id} (${v.impact}, ${v.nodes.length} node(s)) e.g. ${v.nodes[0]?.target?.[0] ?? '?'}`,
      );
  }

  const fail = (found: string[]) =>
    expect(found, `serious or critical accessibility violations:\n${found.join('\n')}`).toEqual([]);

  test('no serious or critical violation on any signed-in screen route', async ({ page }) => {
    test.setTimeout(20000 + ROUTES.length * 8000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, PERSONA_EMAILS.admin);
    const found: string[] = [];
    for (const [name, path] of ROUTES) {
      await gotoAsSignedIn(page, path);
      await page.waitForTimeout(600);
      await waitForAnimations(page);
      found.push(...report(name, await violations(page)));
    }
    fail(found);
  });

  test('no serious or critical violation on the CRM record pages', async ({ page }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, PERSONA_EMAILS.admin);
    const found: string[] = [];
    for (const [name, recordPath] of [
      ['account record', '/sales/companies/c0000000-0000-4000-8000-000000000001'],
      ['contact record', '/sales/contacts/b0000000-0000-4000-8000-000000000006'],
      ['deal record', '/sales/deals/e0000000-0000-4000-8000-000000000001'],
    ] as const) {
      await gotoAsSignedIn(page, recordPath);
      await page.waitForTimeout(1200);
      await waitForAnimations(page);
      found.push(...report(name, await violations(page)));
    }
    fail(found);
  });

  test('no serious or critical violation on the ATS record pages', async ({ page }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, PERSONA_EMAILS.admin);
    const found: string[] = [];
    for (const [name, listPath] of [
      ['requisition record', '/recruit/requisitions'],
      ['candidate record', '/recruit/candidates'],
    ] as const) {
      await gotoAsSignedIn(page, listPath);
      await page.locator('.table-wrap tbody tr .link-btn').first().click();
      await page.waitForTimeout(1200);
      await waitForAnimations(page);
      found.push(...report(name, await violations(page)));
    }
    fail(found);
  });

  test('the skip link is the first thing a keyboard reaches', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('a.skip-link')).toHaveCount(1, { timeout: 25000 });
    await expect(page.locator('.table-wrap')).toBeVisible({ timeout: 25000 });

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({
      cls: document.activeElement?.className ?? '',
      href: (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href') ?? '',
    }));
    expect(focused.cls).toContain('skip-link');
    expect(focused.href).toBe('#main-content');
  });

  test('every interactive control satisfies WCAG 2.2 target size or its spacing exception', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });

    const offenders = await page.evaluate(() => {
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          'button, a[href], input:not([type=hidden]), select, [tabindex="0"]',
        ),
      ];
      const targets = nodes
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0);

      const describe = (el: HTMLElement, r: DOMRect) =>
        `${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0] || '(none)'} ${Math.round(r.width)}x${Math.round(r.height)}`;

      const inlineExempt = (el: HTMLElement, r: DOMRect) => {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
        return Number.isFinite(lineHeight) && r.height <= lineHeight + 1;
      };

      const bad: string[] = [];
      for (const { el, r } of targets) {
        if (r.width >= 24 && r.height >= 24) continue;
        if (inlineExempt(el, r)) continue;

        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const crowded = targets.some(({ el: other, r: o }) => {
          if (other === el) return false;
          const dx = o.left + o.width / 2 - cx;
          const dy = o.top + o.height / 2 - cy;
          return Math.hypot(dx, dy) < 24;
        });
        if (crowded) bad.push(describe(el, r));
      }
      return [...new Set(bad)];
    });

    expect(
      offenders,
      `controls under 24x24 whose 24px circles also intersect another target:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
