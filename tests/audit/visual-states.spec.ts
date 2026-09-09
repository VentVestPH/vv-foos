import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, signIn, testPassword } from '../e2e/helpers';
import { DESKTOP, dir, pageHeight, settle, shootFolds, shootFullPage } from './sweep-lib';
import { join } from 'node:path';

const PROTECTED = ['/', '/recruit/requisitions', '/sales/deals', '/intake', '/settings'];
const TRANSITIONS: { label: string | null; path: string }[] = [
  { label: 'Requisitions', path: '/recruit/requisitions' },
  { label: 'Candidates', path: '/recruit/candidates' },
  { label: 'Deals', path: '/sales/deals' },
  { label: 'Intake', path: '/intake' },
  { label: null, path: '/settings' },
];
const TRANSITION_MARKS = [0, 150, 400, 800];

let images = 0;

async function shoot(page: import('@playwright/test').Page, folder: string, file: string): Promise<void> {
  await shootFullPage(page, join(dir('states', '_boot', folder), file));
  images += 1;
}

test('the states no signed-in page sweep can reach: login, redirect, boot, 404', async ({ page }) => {
  test.setTimeout(0);
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/login');
  await settle(page, 6000);
  const loginDir = dir('screens', '_boot', 'login');
  await shootFullPage(page, join(loginDir, '01-full.png'));
  images += 1 + (await shootFolds(page, loginDir, ''));
  console.log(`STATES login height=${await pageHeight(page)}`);

  const email = page.getByLabel(/email/i);
  const password = page.getByLabel(/password/i);
  const submit = page.getByRole('button', { name: /^(sign in|log in)$/i });

  await email.focus();
  await page.waitForTimeout(160);
  await shoot(page, 'login', 'email-focused.png');

  await submit.click();
  await page.waitForTimeout(400);
  const native = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('input')] as HTMLInputElement[];
    const bad = nodes.filter((n) => n.willValidate && !n.checkValidity());
    return { failing: bad.length, message: bad[0]?.validationMessage ?? '', marked: nodes.filter((n) => n.getAttribute('aria-invalid') === 'true').length };
  });
  await shoot(page, 'login', 'submitted-empty.png');
  console.log(`STATES login submitted-empty failing=${native.failing} ariaInvalid=${native.marked} message="${native.message}"`);

  await email.fill('nobody@ventvest.com');
  await password.fill('an-intentionally-wrong-password');
  await page.waitForTimeout(160);
  await shoot(page, 'login', 'filled.png');

  await submit.click();
  await page.waitForTimeout(2500);
  const rejected = await page.evaluate(() => ({
    errors: [...document.querySelectorAll('.form-error, .field-error-text, [role="alert"]')]
      .map((n) => (n as HTMLElement).innerText.trim().slice(0, 120))
      .filter((t) => t !== ''),
    stillOnLogin: window.location.pathname.includes('/login'),
  }));
  await shoot(page, 'login', 'rejected-credentials.png');
  console.log(`STATES login rejected errors=${JSON.stringify(rejected.errors)} stillOnLogin=${rejected.stillOnLogin}`);

  await page.route('**/auth/v1/token*', async (route) => {
    await new Promise((r) => setTimeout(r, 3500));
    await route.continue();
  });
  await email.fill(PERSONA_EMAILS.admin);
  await password.fill(testPassword());
  await submit.click();
  await page.waitForTimeout(500);
  await shoot(page, 'login', 'pending-submit.png');
  const pending = await page.evaluate(() => {
    const b = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    return {
      found: b !== null,
      disabled: b?.disabled ?? null,
      text: b?.innerText.trim() ?? '',
      busy: b?.getAttribute('aria-busy') ?? null,
      html: (b?.innerHTML ?? '').slice(0, 120),
    };
  });
  console.log(
    `STATES login pending-submit found=${pending.found} disabled=${pending.disabled} aria-busy=${pending.busy} text="${pending.text}" html="${pending.html}"`,
  );
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.unroute('**/auth/v1/token*');
  await settle(page);
  await shoot(page, 'login', 'first-paint-after-sign-in.png');

  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  for (const path of PROTECTED) {
    await page.goto(path);
    await settle(page, 8000);
    const landed = new URL(page.url()).pathname;
    await shoot(page, 'unauth-redirect', `${path === '/' ? 'root' : path.replace(/^\//, '').replace(/\//g, '-')}.png`);
    console.log(`STATES unauth ${path} landed=${landed}`);
  }

  await signIn(page, PERSONA_EMAILS.admin);
  await settle(page);
  const STAFF_DELAY_MS = 5000;
  await page.route('**/rest/v1/staff?*', async (route) => {
    await new Promise((r) => setTimeout(r, STAFF_DELAY_MS));
    await route.continue().catch(() => undefined);
  });
  await page.reload({ waitUntil: 'commit' });
  await page.waitForTimeout(900);
  const held = await page.evaluate(() => ({
    fullCenter: (document.querySelector('.full-center') as HTMLElement)?.innerText.trim() ?? null,
    shellNodes: document.querySelectorAll('.shell').length,
    mainText: (document.querySelector('main.shell-content') as HTMLElement)?.innerText.trim().slice(0, 80) ?? null,
    bodyText: document.body.innerText.trim().slice(0, 80),
  }));
  await shoot(page, 'boot', 'auth-gate-while-staff-query-in-flight.png');
  console.log(
    `STATES boot auth-gate fullCenter=${JSON.stringify(held.fullCenter)} shellNodes=${held.shellNodes} main=${JSON.stringify(held.mainText)} body=${JSON.stringify(held.bodyText)}`,
  );
  await page.waitForTimeout(STAFF_DELAY_MS + 1500);
  await page.unroute('**/rest/v1/staff?*');
  await settle(page);
  await shoot(page, 'boot', 'auth-gate-resolved.png');

  await page.route('**/rest/v1/staff?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.goto('/');
  await page.waitForTimeout(2500);
  const hold = await page.evaluate(() => ({
    card: document.querySelectorAll('.hold-card').length,
    text: (document.querySelector('.hold-card') as HTMLElement)?.innerText.trim().slice(0, 200) ?? '',
  }));
  await shoot(page, 'boot', 'account-not-provisioned.png');
  console.log(`STATES boot not-provisioned cards=${hold.card} text="${hold.text.replace(/\n/g, ' | ')}"`);
  await page.unroute('**/rest/v1/staff?*');

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, PERSONA_EMAILS.admin);
  await settle(page);

  for (const hop of TRANSITIONS) {
    const slug = hop.path.replace(/^\//, '').replace(/\//g, '-');
    const tab = hop.label === null ? null : page.locator(`nav.fo-primary-nav button[title="${hop.label}"]`).first();
    const via = tab !== null && (await tab.count()) > 0 ? 'client-side nav tab click' : 'full document load';
    if (via === 'client-side nav tab click' && tab !== null) {
      await tab.click({ timeout: 5000 }).catch(() => undefined);
    } else {
      await page.goto(hop.path);
    }
    let elapsed = 0;
    for (const mark of TRANSITION_MARKS) {
      if (mark > elapsed) {
        await page.waitForTimeout(mark - elapsed);
        elapsed = mark;
      }
      await shoot(page, 'transition', `${slug}-at-${mark}ms.png`);
    }
    const seen = await page.evaluate(() => ({
      main: (document.querySelector('main.shell-content') as HTMLElement)?.innerText.trim().slice(0, 80) ?? null,
      suspense: document.body.innerText.includes('Loading...'),
      gate: document.body.innerText.includes('Loading\u2026'),
      spinners: document.querySelectorAll('.spinner, [aria-busy="true"]').length,
    }));
    console.log(
      `STATES transition ${hop.path} via=${via} at800ms main=${JSON.stringify(seen.main?.replace(/\n/g, ' | ') ?? null)} suspenseFallback=${seen.suspense} authGate=${seen.gate} spinners=${seen.spinners}`,
    );
    await settle(page);
  }

  await page.goto('/');
  await settle(page);
  const coldDir = dir('states', '_boot', 'cold-first-paint');
  await page.reload({ waitUntil: 'commit' });
  let coldElapsed = 0;
  for (const at of [0, 150, 400, 900, 2000]) {
    if (at > coldElapsed) {
      await page.waitForTimeout(at - coldElapsed);
      coldElapsed = at;
    }
    await page.screenshot({ path: join(coldDir, `reload-at-${at}ms.png`), animations: 'disabled' }).catch(() => undefined);
    images += 1;
  }
  await settle(page);

  await page.goto('/this-route-does-not-exist');
  await settle(page, 8000);
  const nf = await page.evaluate(() => (document.querySelector('main.shell-content') as HTMLElement)?.innerText.trim().slice(0, 200) ?? '');
  const nfDir = dir('screens', '_boot', 'not-found');
  await shootFullPage(page, join(nfDir, '01-full.png'));
  images += 1 + (await shootFolds(page, nfDir, ''));
  console.log(`STATES not-found text="${nf.replace(/\n/g, ' | ')}"`);

  await page.goto('/');
  await settle(page);
  const ph = page.locator('button.is-placeholder').first();
  if ((await ph.count()) > 0) {
    await ph.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const open = await page.locator('.fo-placeholder-modal').count();
    await shoot(page, 'placeholder', 'overlay-open.png');
    console.log(`STATES placeholder overlay modals=${open}`);
    await page.keyboard.press('Escape');
  } else {
    console.log('STATES placeholder NO .is-placeholder button reachable from the dashboard');
  }

  console.log(`STATES TOTAL images=${images}`);
  expect(images).toBeGreaterThan(20);
});
