import { expect, type Page } from '@playwright/test';

export const PERSONA_EMAILS = {
  admin: 'demo-admin@ventvest.test',
  recruiter: 'rita.demo@ventvest.com',
  sourcer: 'sam.demo@ventvest.com',
  bd: 'ben.demo@ventvest.com',
} as const;

function testPassword(): string {
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

export async function waitForAnimations(page: Page, capMs = 3000): Promise<void> {
  await page.evaluate(async (cap) => {
    const running = document.getAnimations();
    if (running.length === 0) return;
    await Promise.race([
      Promise.allSettled(running.map((a) => a.finished)),
      new Promise((resolve) => setTimeout(resolve, cap)),
    ]);
  }, capMs);
}

export function recordSection(page: Page, title: string) {
  return page
    .locator('.record-section')
    .filter({ has: page.getByRole('button', { name: new RegExp(`^[\\u25b8\\u25be]?\\s*${title}$`) }) })
    .first();
}

export async function expandSection(page: Page, title: string) {
  const section = recordSection(page, title);
  await expect(section).toBeVisible({ timeout: 20000 });
  const header = section.locator('.record-section-header').first();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await header.getAttribute('aria-expanded')) === 'true') return section;
    await header.click();
    await expect
      .poll(() => header.getAttribute('aria-expanded'), { timeout: 3000 })
      .toBe('true')
      .catch(() => undefined);
  }
  await expect(header).toHaveAttribute('aria-expanded', 'true', { timeout: 10000 });
  return section;
}

export function localDateTimeValue(msFromNow: number): string {
  const d = new Date(Date.now() + msFromNow);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export async function waitForRealtime(page: Page, timeout = 20000): Promise<boolean> {
  const deadline = Date.now() + timeout;
  const joined = await page
    .waitForEvent('websocket', {
      predicate: (ws) => ws.url().includes('/realtime/'),
      timeout: Math.max(1000, deadline - Date.now()),
    })
    .then(
      (ws) =>
        new Promise<boolean>((resolve) => {
          const done = (v: boolean) => resolve(v);
          const timer = setTimeout(() => done(false), Math.max(1000, deadline - Date.now()));
          ws.on('framereceived', (frame) => {
            if (typeof frame.payload === 'string' && frame.payload.includes('phx_reply')) {
              clearTimeout(timer);
              done(true);
            }
          });
          ws.on('close', () => {
            clearTimeout(timer);
            done(false);
          });
        }),
    )
    .catch(() => false);
  await page.waitForTimeout(500);
  return joined;
}

export async function openFilterRail(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /Search these records|Hide search options/ });
  await expect(toggle).toBeVisible({ timeout: 25000 });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
  await expect(page.locator('.filter-rail')).toBeVisible({ timeout: 25000 });
}
