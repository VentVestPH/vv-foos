import { expect, type Locator, type Page } from '@playwright/test';
import { clientAs } from '../env';

export const PERSONA_EMAILS = {
  admin: 'foos.admin@ventvest.com',
  recruiter: 'foos.recruiter@ventvest.com',
  sourcer: 'foos.sourcer@ventvest.com',
  bd: 'foos.bd@ventvest.com',
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
  await page.getByRole('button', { name: /^(sign in|log in)$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 20000 });
}

export async function gotoAsSignedIn(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/login/);
}

export async function waitForAnimations(page: Page, capMs = 3000): Promise<void> {
  const deadline = Date.now() + capMs;
  let quiet = 0;
  for (;;) {
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    quiet = running === 0 ? quiet + 1 : 0;
    if (quiet >= 3 || Date.now() > deadline) return;
    await page.waitForTimeout(80);
  }
}

export function recordSection(page: Page, title: string) {
  return page
    .locator('.record-section')
    .filter({
      has: page.getByRole('button', {
        name: new RegExp(`^[\\u25b8\\u25be]?\\s*${title}(\\s*\\(\\d+\\))?$`),
      }),
    })
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

let importedDataset: boolean | null = null;

export async function hasImportedDataset(): Promise<boolean> {
  if (importedDataset !== null) return importedDataset;
  const admin = await clientAs('admin');
  const { count } = await admin
    .from('requisitions')
    .select('id', { count: 'exact', head: true })
    .eq('is_test', false);
  importedDataset = (count ?? 0) > 100;
  return importedDataset;
}

export const NEEDS_IMPORT =
  'needs the migrated dataset: every seeded requisition is is_test, so a database ' +
  'built from migrations and seed alone has nothing for this to measure';

export function localDateTimeValue(msFromNow: number): string {
  const d = new Date(Date.now() + msFromNow);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export function localDateTimeToday(msFromNow: number): string {
  const now = new Date();
  const target = new Date(now.getTime() + msFromNow);
  if (target.getDate() !== now.getDate()) {
    return localDateTimeValue(-Math.abs(msFromNow));
  }
  return localDateTimeValue(msFromNow);
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

export async function chooseOption(
  page: Page,
  box: Locator,
  optionName: string | RegExp,
): Promise<void> {
  await expect(box).toBeVisible({ timeout: 25000 });
  await box.click();
  const option = page.getByRole('option', { name: optionName });
  await expect(option).toBeVisible({ timeout: 25000 });
  await option.click();
  await expect(page.getByRole('listbox')).toHaveCount(0, { timeout: 25000 });
}

export async function optionNames(page: Page, box: Locator): Promise<string[]> {
  await expect(box).toBeVisible({ timeout: 25000 });
  await box.click();
  await expect(page.getByRole('listbox')).toHaveCount(1, { timeout: 25000 });
  const names = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0, { timeout: 25000 });
  return names.map((n) => n.trim());
}

export async function openFilterRail(page: Page): Promise<void> {
  const toggle = page
    .getByRole('button', { name: 'Advanced Search', disabled: false })
    .first();
  await expect(toggle).toBeVisible({ timeout: 25000 });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
  await expect(page.locator('.filter-rail')).toBeVisible({ timeout: 25000 });
}

export async function watchOverlayExit(
  page: Page,
  selector: string,
): Promise<() => Promise<{ sawClosing: boolean; removed: boolean }>> {
  const key = `__overlayExit${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await page.evaluate(
    ({ sel, k }) => {
      const log = { sawClosing: false, removed: false };
      (window as unknown as Record<string, unknown>)[k] = log;
      let everPresent = false;
      const seen = () => {
        const el = document.querySelector(sel);
        if (el) {
          everPresent = true;
          if (el.getAttribute('data-closing') === 'true') log.sawClosing = true;
        } else if (everPresent) {
          log.removed = true;
        }
      };
      seen();
      new MutationObserver(seen).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-closing'],
      });
    },
    { sel: selector, k: key },
  );
  return () =>
    page.evaluate(
      (k) => (window as unknown as Record<string, { sawClosing: boolean; removed: boolean }>)[k],
      key,
    );
}

export async function searchList(
  page: Page,
  boxName: string | RegExp,
  term: string,
): Promise<void> {
  const box = page.getByRole('searchbox', { name: boxName });
  await box.fill(term);
  await box.press('Enter');
}
