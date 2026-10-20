import { expect, test } from '@playwright/test';
import { clientAs } from '../../support/env';
import { PERSONA_EMAILS, gotoAsSignedIn, searchList, signIn } from '../../support/e2e-helpers';

const RUN = `${process.pid}${Math.random().toString(36).slice(2, 8)}`;
const EMPLOYEE = `Qaemployee ${RUN}`;
const COURSE = `QA course ${RUN}`;

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('courses').delete().eq('title', COURSE);
  await admin.from('employees').delete().eq('full_name', EMPLOYEE);
});

test('W1: an admin onboards an employee, assigns a new course, and both tabs show it', async ({ page }) => {
  test.setTimeout(90000);
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/employees');
  await expect(page.locator('.fo-list-toolbar .fo-pager').first()).toBeVisible();

  await page.getByRole('button', { name: 'Onboard Employee' }).click();
  const onboard = page.getByRole('dialog', { name: 'Onboard employee' });
  await expect(onboard).toBeVisible();
  await onboard.getByLabel('Full name').fill(EMPLOYEE);
  await onboard.getByLabel('Job title').fill('QA Analyst');
  await onboard.getByRole('button', { name: 'Save' }).click();
  await expect(onboard).toHaveCount(0, { timeout: 15000 });

  await searchList(page, 'Employees', EMPLOYEE);
  const row = page.locator('.table-wrap tbody tr', { hasText: EMPLOYEE });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  await expect(row).toContainText('Onboarding');
  await expect(row).toContainText(/EMP-\d{4,}/);

  await row.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Assign Course/ }).click();
  const assign = page.getByRole('dialog', { name: 'Assign course' });
  await expect(assign).toBeVisible();
  await assign.getByLabel('New course title').fill(COURSE);
  await assign.getByRole('button', { name: 'Save' }).click();
  await expect(assign).toHaveCount(0, { timeout: 15000 });
  await expect(row).toContainText('0 of 1 done', { timeout: 15000 });

  await gotoAsSignedIn(page, '/onboard');
  await searchList(page, 'Onboard/Offboard', EMPLOYEE);
  await expect(page.locator('.table-wrap tbody tr', { hasText: EMPLOYEE })).toContainText('1 course open', { timeout: 15000 });

  await gotoAsSignedIn(page, '/courses');
  await searchList(page, 'Courses', COURSE);
  const courseRow = page.locator('.table-wrap tbody tr', { hasText: COURSE });
  await expect(courseRow).toContainText(/CRS-\d{4,}/, { timeout: 15000 });
});

test('W2: a sourcer sees the employee list but cannot onboard or assign, and is told why', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, '/employees');
  for (const name of ['Onboard Employee', 'Assign Course']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('title', /admin or recruiter/);
  }
});
