import { expect, type Page } from '@playwright/test';

export const PERSONA_EMAILS = {
  admin: 'demo-admin@ventvest.test',
  recruiter: 'rita.demo@ventvest.com',
  sourcer: 'sam.demo@ventvest.com',
  bd: 'ben.demo@ventvest.com',
} as const;

export function testPassword(): string {
  const value = process.env.FOOS_QA_TEST_PASSWORD;
  if (!value) throw new Error('FOOS_QA_TEST_PASSWORD is not set (see tests/.env.example)');
  return value;
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(testPassword());
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 20000 });
}

export async function gotoAsSignedIn(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/login/);
}
