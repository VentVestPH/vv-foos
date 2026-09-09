import { test, type Page } from '@playwright/test';
import { VIEWPORTS } from './routes';
import { blockedWrites, flush, note, settle, shootElement, shootScreen, shots } from './capture';

const SCREEN = 'login';

interface Field {
  index: number;
  kind: string;
  name: string;
  typeable: boolean;
}

async function tagLogin(page: Page): Promise<Field[]> {
  return page.evaluate(() => {
    const out: Field[] = [];
    let index = 0;
    for (const el of Array.from(document.querySelectorAll('input, button, a[href], select'))) {
      const e = el as HTMLElement;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const input = e as HTMLInputElement;
      const tag = e.tagName.toLowerCase();
      const type = tag === 'input' ? input.type || 'text' : '';
      const labelled = input.labels && input.labels.length > 0 ? (input.labels[0].innerText || '').trim() : '';
      e.setAttribute('data-login', String(index));
      out.push({
        index,
        kind: tag === 'input' ? `input-${type}` : tag === 'a' ? 'link' : tag,
        name: (
          e.getAttribute('aria-label') ??
          e.getAttribute('placeholder') ??
          (labelled || (e.innerText || '').trim().split('\n')[0]) ??
          ''
        ).slice(0, 40) || (tag === 'input' ? `input-${type}` : tag),
        typeable: tag === 'input' && ['text', 'email', 'password', 'search'].includes(type),
      });
      index += 1;
    }
    return out;
  });
}

test('the login screen, which no signed-in sweep can reach', async ({ page }) => {
  test.setTimeout(0);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/login');
    await settle(page, 1200);
    if (!page.url().includes('/login')) {
      note(`${SCREEN} ${viewport.name}: /login redirected to ${page.url()}, so a session was already active`);
      continue;
    }
    await shootScreen(page, SCREEN, viewport.name, 'default');

    const fields = await tagLogin(page);
    for (const f of fields) {
      const el = page.locator(`[data-login="${f.index}"]`);
      if ((await el.count()) === 0) continue;
      await shootElement(page, el, SCREEN, viewport.name, f.kind, f.kind, 'default', f.name);
      await el.hover({ force: true }).catch(() => undefined);
      await page.waitForTimeout(110);
      await shootElement(page, el, SCREEN, viewport.name, f.kind, f.kind, 'hover', f.name);
      await page.mouse.move(0, 0);

      await page.keyboard.down('Shift');
      await page.keyboard.up('Shift');
      await el.focus().catch(() => undefined);
      await page.waitForTimeout(110);
      const matched = await el.evaluate((n) => n.matches(':focus-visible')).catch(() => false);
      await shootElement(
        page,
        el,
        SCREEN,
        viewport.name,
        f.kind,
        f.kind,
        matched ? 'focus-visible' : 'focused-not-focus-visible',
        f.name,
      );
      if (f.typeable) {
        await el.fill('Zz a deliberately long value to show how the field handles overflow').catch(() => undefined);
        await page.waitForTimeout(140);
        await shootElement(page, el, SCREEN, viewport.name, f.kind, f.kind, 'populated-long', f.name);
        await el.fill('').catch(() => undefined);
      }
    }

    const submit = page.locator('button[type="submit"], button:text-is("Sign in")').first();
    if ((await submit.count()) > 0) {
      await submit.click({ force: true }).catch(() => undefined);
      await settle(page, 500);
      const nativeState = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
        const bad = nodes.filter((n) => n.willValidate && !n.checkValidity());
        return {
          failing: bad.length,
          message: bad.length > 0 ? bad[0].validationMessage : '',
          marked: nodes.filter((n) => n.getAttribute('aria-invalid') === 'true').length,
        };
      });
      await shootScreen(
        page,
        SCREEN,
        viewport.name,
        'submitted-empty',
        `${nativeState.failing} field(s) fail checkValidity, the browser's message for the first is "${nativeState.message}", aria-invalid set on ${nativeState.marked}`,
      );
    }

    const email = page.locator('input[type="email"], input[name="email"]').first();
    const password = page.locator('input[type="password"]').first();
    if ((await email.count()) > 0 && (await password.count()) > 0) {
      await email.fill('nobody@ventvest.com');
      await password.fill('an-intentionally-wrong-password');
      await settle(page, 200);
      await shootScreen(page, SCREEN, viewport.name, 'filled-before-a-failing-sign-in');
      if ((await submit.count()) > 0) {
        await submit.click({ force: true }).catch(() => undefined);
        await settle(page, 2500);
        const shown = await page.evaluate(() => ({
          errors: Array.from(document.querySelectorAll('.form-error, .field-error-text, [role="alert"]'))
            .map((n) => (n as HTMLElement).innerText.trim().slice(0, 120))
            .filter((t) => t !== ''),
          stillOnLogin: window.location.pathname.includes('/login'),
        }));
        await shootScreen(
          page,
          SCREEN,
          viewport.name,
          'rejected-credentials',
          `error text shown: ${shown.errors.length > 0 ? JSON.stringify(shown.errors) : 'none'}; still on /login: ${shown.stillOnLogin}`,
        );
        const alert = page.locator('[role="alert"]').first();
        if ((await alert.count()) > 0) {
          await shootElement(page, alert, SCREEN, viewport.name, 'form-error', 'alert', 'rejected-credentials', 'sign-in error');
        } else {
          note(`${SCREEN} ${viewport.name}: sign-in was rejected but no role="alert" node was present`);
        }
      }
    }
    flush();
  }

  flush();
  console.log(`LOGIN shots=${shots.length} blockedWrites=${new Set(blockedWrites).size}`);
});
