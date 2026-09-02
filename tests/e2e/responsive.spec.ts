import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const WIDTHS = [1366, 1280, 1024, 768] as const;
const ROUTES = [
  ['candidates', '/recruit/candidates'],
  ['requisitions', '/recruit/requisitions'],
  ['deals', '/sales/deals'],
] as const;

test.describe('L9: the layout stays usable down to 768px', () => {
  test('the document never scrolls horizontally at any tested width', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    const bad: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, path] of ROUTES) {
        await gotoAsSignedIn(page, path);
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        if (overflow > 1) bad.push(`${name} at ${width}px overflows by ${overflow}px`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('below 900px the shell stacks instead of nesting a scroll pane', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
    const wide = await page.evaluate(() => getComputedStyle(document.querySelector('.fo-body')!).flexDirection);
    expect(wide, 'at desktop width the sidebar sits beside the content').toBe('row');

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    const narrow = await page.evaluate(() => {
      const body = document.querySelector('.fo-body')!;
      const content = document.querySelector('.shell-content')!;
      const table = document.querySelector('.table-wrap');
      return {
        direction: getComputedStyle(body).flexDirection,
        contentOverflow: getComputedStyle(content).overflow,
        tableLeft: table ? Math.round(table.getBoundingClientRect().left) : null,
      };
    });

    expect(narrow.direction, 'at 768px the sidebar must stack above the content').toBe('column');
    expect(narrow.contentOverflow, 'the content must not be its own scroll pane').toBe('visible');
    expect(
      narrow.tableLeft,
      'the table must start near the left edge, not 950px to the right inside a nested pane',
    ).toBeLessThan(120);
  });

  test('a record page keeps its fields readable in one column at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await page.locator('.table-wrap tbody tr .link-btn').first().click();
    await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });

    const grid = await page.evaluate(() => {
      const el = document.querySelector('.info-grid');
      if (!el) return null;
      return getComputedStyle(el).gridTemplateColumns.split(' ').length;
    });
    expect(grid, 'two columns of label and value do not fit at 768px').toBe(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
