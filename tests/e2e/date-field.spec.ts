import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, openFilterRail, signIn } from './helpers';

function dateInput(page: import('@playwright/test').Page) {
  return page.locator('.filter-rail .date-field-input').first();
}

async function openRail(page: import('@playwright/test').Page) {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await openFilterRail(page);
  await expect(page.locator('.table-wrap')).toBeVisible({ timeout: 25000 });
  const group = page.locator('.fo-filter-group-header', { hasText: 'Initial date' });
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
  await expect(dateInput(page)).toBeVisible();
}

test('no date input is a browser date control any more', async ({ page }) => {
  await openRail(page);
  const kinds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).map((el) => el.type),
  );
  console.log(`PROBE inputTypes=${[...new Set(kinds)].sort().join(',')}`);
  expect(kinds).not.toContain('date');
  await expect(dateInput(page)).toHaveAttribute('placeholder', 'YYYY-MM-DD');
  await expect(dateInput(page)).toHaveAttribute('inputmode', 'numeric');
});

test('a date typed straight into the field is accepted without opening the calendar', async ({
  page,
}) => {
  await openRail(page);
  const field = dateInput(page);
  await field.fill('2026-03-04');
  await field.press('Enter');
  await expect(field).toHaveValue('2026-03-04');
  expect(await page.getByRole('dialog').count()).toBe(0);

  await field.fill('2026-02-31');
  await field.press('Enter');
  await expect(page.locator('.field-error-text').filter({ hasText: 'YYYY-MM-DD' })).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
});

test('the calendar is a modal grid driven entirely by the keyboard', async ({ page }) => {
  await openRail(page);
  const field = dateInput(page);
  await field.fill('2026-03-04');
  await field.press('Enter');

  const trigger = page.getByRole('button', { name: /Change date, /});
  await expect(trigger).toHaveCount(1);
  await trigger.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('grid')).toHaveCount(1);
  await expect(dialog.locator('.date-dialog-scope')).toHaveText('March 2026');
  await expect(dialog.getByRole('gridcell', { selected: true })).toHaveCount(1);

  const activeDay = () =>
    dialog.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  const title = () => dialog.locator('.date-dialog-scope').innerText();

  expect(await activeDay()).toBe('4');
  await page.keyboard.press('ArrowRight');
  expect(await activeDay()).toBe('5');
  await page.keyboard.press('ArrowDown');
  expect(await activeDay()).toBe('12');
  await page.keyboard.press('Home');
  expect(await activeDay()).toBe('8');
  await page.keyboard.press('End');
  expect(await activeDay()).toBe('14');
  await page.keyboard.press('PageDown');
  expect(await title()).toContain('April 2026');
  await page.keyboard.press('Shift+PageUp');
  expect(await title()).toContain('2025');
  await page.keyboard.press('Shift+PageDown');
  await page.keyboard.press('PageUp');
  expect(await title()).toContain('March 2026');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(field).toHaveValue('2026-03-04');

  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(field).toHaveValue('2026-03-05');
  await expect(trigger).toBeFocused();
});

test('the report range picker orders a reversed pick and can jump to another year', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/reports');
  const trigger = page.getByRole('button', { name: 'Date range' });
  await expect(trigger).toHaveText('All time', { timeout: 25000 });
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Choose a date range' });
  await expect(picker).toBeVisible();

  await chooseOption(page, picker.getByRole('combobox', { name: 'First calendar year' }), '2024');
  await chooseOption(page, picker.getByRole('combobox', { name: 'First calendar month' }), 'March');
  await picker.locator('[data-day="2024-03-20"]').click();
  await expect(picker.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await picker.locator('[data-day="2024-03-05"]').click();
  await picker.getByRole('button', { name: 'Apply' }).click();

  await expect(picker).toHaveCount(0);
  const label = (await trigger.innerText()).trim();
  expect(label, 'the earlier day becomes the start whichever order it was clicked in').toMatch(/^Mar 5, 2024 – Mar 20, 2024$/);
});
