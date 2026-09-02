import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const tag = `e2e-error-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

test.afterAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('client_errors').delete().like('message', `%${tag}%`);
  if (error) throw new Error(`could not clean up client_errors: ${error.message}`);
});

async function rowsFor(message: string) {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('client_errors')
    .select('origin, message, route, stack, user_agent, staff_id')
    .like('message', `%${message}%`);
  expect(error, error?.message).toBeNull();
  return data ?? [];
}

test.describe('O3: a production failure leaves a record', () => {
  test('an uncaught error is recorded with its route, and a repeat is not', async ({ page }) => {
    const message = `${tag} uncaught`;
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap').first()).toBeVisible({ timeout: 25000 });

    await page.evaluate((text) => {
      for (let i = 0; i < 5; i += 1) {
        window.dispatchEvent(new ErrorEvent('error', { error: new Error(text), message: text }));
      }
    }, message);

    await expect.poll(async () => (await rowsFor(message)).length, { timeout: 15000 }).toBe(1);

    const [row] = await rowsFor(message);
    expect(row?.origin).toBe('window.error');
    expect(row?.route).toBe('/recruit/candidates');
    expect(row?.stack).toContain('Error');
    expect(row?.user_agent).toContain('Chrome');
    expect(row?.staff_id).toBeTruthy();
  });

  test('an unhandled promise rejection is recorded too', async ({ page }) => {
    const message = `${tag} rejection`;
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');

    await page.evaluate((text) => {
      void Promise.reject(new Error(text));
    }, message);

    await expect.poll(async () => (await rowsFor(message)).length, { timeout: 15000 }).toBe(1);
    const [row] = await rowsFor(message);
    expect(row?.origin).toBe('unhandledrejection');
    expect(row?.route).toBe('/recruit/requisitions');
  });

  test('the reporter caps a session so a render loop cannot flood the table', async ({ page }) => {
    const message = `${tag} flood`;
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');

    await page.evaluate((text) => {
      for (let i = 0; i < 60; i += 1) {
        window.dispatchEvent(
          new ErrorEvent('error', { error: new Error(`${text} ${i}`), message: `${text} ${i}` }),
        );
      }
    }, message);

    await expect
      .poll(async () => (await rowsFor(message)).length, { timeout: 20000 })
      .toBeLessThanOrEqual(20);
    expect((await rowsFor(message)).length).toBeGreaterThan(0);
  });
});
