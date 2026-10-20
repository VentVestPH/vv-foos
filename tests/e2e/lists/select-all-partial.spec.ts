import { test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

test('select-all header: read indeterminate and the aria-label after ticking 3 rows', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await page.waitForTimeout(3000);

  const header = page.locator('thead input[type="checkbox"]').first();
  const boxes = page.locator('tbody input[type="checkbox"]');
  const total = await boxes.count();

  const read = async (label: string) => {
    const st = await header.evaluate((n) => ({
      checked: (n as HTMLInputElement).checked,
      indeterminate: (n as HTMLInputElement).indeterminate,
      ariaLabel: n.getAttribute('aria-label'),
    }));
    const ticked = await page.locator('tbody input[type="checkbox"]:checked').count();
    console.log(
      `PROBE ${label}: ticked=${ticked}/${total} checked=${st.checked} indeterminate=${st.indeterminate} aria="${st.ariaLabel}"`,
    );
  };

  await read('none');
  for (let i = 0; i < 3; i += 1) {
    await boxes.nth(i).click({ force: true });
    await page.waitForTimeout(200);
  }
  await read('three');
  await header.click({ force: true });
  await page.waitForTimeout(400);
  await read('after-header-click');
});
