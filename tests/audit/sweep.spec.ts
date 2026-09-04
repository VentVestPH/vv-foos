import { test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, VIEWPORTS, resolveIds, resolvePath } from './routes';
import {
  blockedWrites,
  flush,
  guardWrites,
  markExistingOverlays,
  newOverlaySelector,
  note,
  overlayFingerprint,
  settle,
  shootElement,
  shootScreen,
  shots,
} from './capture';

const AREA = process.env.FOOS_AUDIT_AREA ?? '';
const SESSION_ENDING = /^(logout|log out|sign out|signout)$/i;

async function ensureSignedIn(page: Page, path: string): Promise<boolean> {
  if (!page.url().includes('/login')) return false;
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, path);
  await settle(page, 700);
  return true;
}

interface Descriptor {
  index: number;
  kind: string;
  name: string;
  disabled: boolean;
  typeable: boolean;
  opens: boolean;
  width: number;
  height: number;
}

async function tagElements(page: Page): Promise<Descriptor[]> {
  return page.evaluate(() => {
    const selectors = [
      'button',
      'a[href]',
      'select',
      'textarea',
      'input',
      'summary',
      '[role="tab"]',
      '.record-section-header',
      '[role="checkbox"]',
      '[role="switch"]',
    ];
    const seen = new Set<Element>();
    const out: Descriptor[] = [];
    let index = 0;

    for (const sel of selectors) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        if (seen.has(el)) continue;
        seen.add(el);
        const e = el as HTMLElement;
        const rect = e.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const style = getComputedStyle(e);
        if (style.visibility === 'hidden' || style.display === 'none') continue;

        const input = e as HTMLInputElement;
        const tag = e.tagName.toLowerCase();
        const type = tag === 'input' ? input.type || 'text' : '';
        const name = (
          e.getAttribute('aria-label') ??
          e.getAttribute('title') ??
          e.getAttribute('placeholder') ??
          (e.innerText || '').trim().split('\n')[0] ??
          ''
        ).slice(0, 44);
        const role = e.getAttribute('role') ?? '';
        const kind =
          tag === 'input'
            ? `input-${type}`
            : tag === 'select'
              ? 'select'
              : tag === 'textarea'
                ? 'textarea'
                : role === 'tab'
                  ? 'tab'
                  : tag === 'summary'
                    ? 'summary'
                    : tag === 'a'
                      ? 'link'
                      : tag === 'button'
                        ? 'button'
                        : e.className.toString().includes('record-section-header')
                          ? 'section-header'
                          : role || tag;

        e.setAttribute('data-audit', String(index));
        out.push({
          index,
          kind,
          name: name || kind,
          disabled: e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true',
          typeable:
            tag === 'textarea' ||
            (tag === 'input' && ['text', 'search', 'email', 'tel', 'number', 'url'].includes(type)),
          opens:
            tag === 'button' ||
            tag === 'summary' ||
            role === 'tab' ||
            e.className.toString().includes('record-section-header') ||
            e.hasAttribute('aria-expanded') ||
            e.hasAttribute('aria-haspopup'),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
        index += 1;
      }
    }
    return out;
  });
}

test('sweep: every interactive element, every state', async ({ page }) => {
  test.setTimeout(0);
  const ids = await resolveIds();
  const routes = ROUTES.filter((r) => AREA === '' || r.area === AREA);
  const summary: string[] = [];

  await signIn(page, PERSONA_EMAILS.admin);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of routes) {
      const path = resolvePath(route, ids);
      if (path === null) {
        note(`${route.id}: skipped, no ${route.needs} row exists`);
        continue;
      }
      const started = Date.now();
      await guardWrites(page, route.id);
      await gotoAsSignedIn(page, path);
      await settle(page, 900);
      await shootScreen(page, route.id, viewport.name, 'default');

      const descriptors = await tagElements(page);
      let stateShots = 0;
      let openers = 0;
      let navigations = 0;

      for (const d of descriptors) {
        let el = page.locator(`[data-audit="${d.index}"]`);
        if ((await el.count()) === 0) {
          await tagElements(page);
          el = page.locator(`[data-audit="${d.index}"]`);
          if ((await el.count()) === 0) {
            note(`${route.id} ${viewport.name}: ${d.kind} "${d.name}" vanished and did not come back after a re-tag`);
            continue;
          }
        }
        try {
          await el.scrollIntoViewIfNeeded({ timeout: 2500 });
        } catch {
          note(`${route.id} ${viewport.name}: ${d.kind} "${d.name}" would not scroll into view`);
          continue;
        }

        if (await shootElement(page, el, route.id, viewport.name, d.kind, d.kind, d.disabled ? 'disabled' : 'default', d.name)) {
          stateShots += 1;
        }
        if (d.disabled) continue;

        try {
          await el.hover({ timeout: 1500, force: true });
          await page.waitForTimeout(130);
          await shootElement(page, el, route.id, viewport.name, d.kind, d.kind, 'hover', d.name);
          stateShots += 1;
          await page.mouse.move(0, 0);
        } catch {
          note(`${route.id} ${viewport.name}: ${d.kind} "${d.name}" would not hover`);
        }

        try {
          await page.keyboard.down('Shift');
          await page.keyboard.up('Shift');
          await el.focus({ timeout: 1500 });
          await page.waitForTimeout(120);
          let matched = await el.evaluate((node) => node.matches(':focus-visible'));
          if (!matched) {
            await page.keyboard.press('Tab');
            await page.keyboard.press('Shift+Tab');
            await page.waitForTimeout(120);
            matched = await el.evaluate(
              (node) => node === document.activeElement && node.matches(':focus-visible'),
            );
          }
          if (matched) {
            await shootElement(page, el, route.id, viewport.name, d.kind, d.kind, 'focus-visible', d.name);
            stateShots += 1;
          } else {
            await shootElement(page, el, route.id, viewport.name, d.kind, d.kind, 'focused-not-focus-visible', d.name);
            stateShots += 1;
            note(`${route.id} ${viewport.name}: ${d.kind} "${d.name}" took focus but never matched :focus-visible, so this capture shows plain focus`);
          }
        } catch {
          note(`${route.id} ${viewport.name}: ${d.kind} "${d.name}" would not take focus`);
        }

        if (d.typeable) {
          const filler = d.kind === 'input-number' ? '1234567890' : 'Zz a deliberately long value to show how the field handles overflow';
          try {
            await el.fill(filler);
            await page.waitForTimeout(180);
            await shootElement(page, el, route.id, viewport.name, d.kind, d.kind, 'populated-long', d.name);
            stateShots += 1;
            await el.fill('');
          } catch {
            note(`${route.id} ${viewport.name}: ${d.kind} "${d.name}" would not accept a value`);
          }
        }
      }

      const toOpen = descriptors.filter((d) => d.opens && !d.disabled && !SESSION_ENDING.test(d.name.trim()));
      const skippedSession = descriptors.filter((d) => d.opens && SESSION_ENDING.test(d.name.trim()));
      for (const d of skippedSession) {
        note(`${route.id} ${viewport.name}: "${d.name}" not clicked, it ends the session; captured in its default, hover and focus states only`);
      }
      for (const d of toOpen) {
        if (page.url().includes('/login')) await ensureSignedIn(page, path);
        await gotoAsSignedIn(page, path);
        await settle(page, 700);
        await tagElements(page);
        const el = page.locator(`[data-audit="${d.index}"]`);
        if ((await el.count()) === 0) {
          note(`${route.id} ${viewport.name}: opener "${d.name}" not present after re-tag`);
          continue;
        }
        const before = await overlayFingerprint(page);
        await markExistingOverlays(page);
        const urlBefore = page.url();
        try {
          await el.scrollIntoViewIfNeeded({ timeout: 2500 });
          await el.click({ timeout: 3000 });
          await settle(page, 450);
        } catch {
          note(`${route.id} ${viewport.name}: ${d.kind} "${d.name}" would not click`);
          continue;
        }
        if (await ensureSignedIn(page, path)) {
          note(`${route.id} ${viewport.name}: "${d.name}" ended the session; signed back in and continued`);
          continue;
        }
        const after = await overlayFingerprint(page);
        if (page.url() !== urlBefore) {
          navigations += 1;
          await shootScreen(page, route.id, viewport.name, `navigated-by-${d.name}`, `went to ${page.url().replace(/^https?:\/\/[^/]+/, '')}`);
        } else if (after !== before) {
          openers += 1;
          await shootScreen(page, route.id, viewport.name, `opened-by-${d.name}`);
          const fresh = page.locator(newOverlaySelector());
          const freshCount = await fresh.count();
          if (freshCount === 0) {
            note(`${route.id} ${viewport.name}: "${d.name}" changed the overlay set but no new overlay node appeared, so only the screen was captured`);
          }
          for (let k = 0; k < Math.min(freshCount, 3); k += 1) {
            await shootElement(page, fresh.nth(k), route.id, viewport.name, 'overlay', 'overlay', 'open', d.name);
          }
          await page.keyboard.press('Escape');
        } else {
          await shootScreen(page, route.id, viewport.name, `clicked-${d.name}`, 'no overlay and no navigation: the click changed state in place or did nothing');
        }
      }

      const selects = descriptors.filter((d) => d.kind === 'select');
      if (selects.length > 0) {
        await gotoAsSignedIn(page, path);
        await settle(page, 700);
        await tagElements(page);
        const el = page.locator(`[data-audit="${selects[0].index}"]`);
        if ((await el.count()) > 0) {
          const before = await overlayFingerprint(page);
          try {
            await el.scrollIntoViewIfNeeded({ timeout: 2000 });
            await el.click({ timeout: 2000 });
            await page.waitForTimeout(400);
          } catch {
            note(`${route.id} ${viewport.name}: select would not open`);
          }
          const after = await overlayFingerprint(page);
          await shootScreen(
            page,
            route.id,
            viewport.name,
            'select-clicked',
            after === before
              ? 'the native option list is an OS popup: it does not appear in a page screenshot, which is why it cannot be styled'
              : 'an in-page overlay appeared',
          );
          await page.keyboard.press('Escape');
        }
      }

      summary.push(
        `${route.id} ${viewport.name}: ${descriptors.length} elements, ${stateShots} state shots, ${toOpen.length} openers clicked, ${openers} opened an overlay, ${navigations} navigated, ${Math.round((Date.now() - started) / 1000)}s`,
      );
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      flush();
    }
  }

  flush();
  console.log(`SWEEP area=${AREA || 'all'} shots=${shots.length} blockedWrites=${new Set(blockedWrites).size}`);
  for (const line of summary) console.log(`SWEEP ${line}`);
});
