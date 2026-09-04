import { test, type Locator, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, VIEWPORTS, resolveIds, resolvePath } from './routes';
import {
  CORPUS,
  blockedWrites,
  flush,
  guardWrites,
  markExistingOverlays,
  newOverlaySelector,
  note,
  settle,
  shootElement,
  shootScreen,
  shots,
} from './capture';

const ONLY_SCREEN = process.env.FOOS_AUDIT_SCREEN ?? '';

interface Target {
  screen: string;
  viewport: string;
  opener: string;
}

function knownOpeners(): Target[] {
  const out: Target[] = [];
  const seen = new Set<string>();
  for (const file of readdirSync(CORPUS).filter((f) => /^manifest\..*\.json$/.test(f))) {
    if (/^manifest\.overlays/.test(file)) continue;
    const rows = JSON.parse(readFileSync(join(CORPUS, file), 'utf8')) as {
      screen: string;
      viewport: string;
      kind: string;
      state: string;
      name: string;
    }[];
    for (const row of rows) {
      if (row.kind !== 'overlay' || row.state !== 'open') continue;
      const key = `${row.screen}|${row.viewport}|${row.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ screen: row.screen, viewport: row.viewport, opener: row.name });
    }
  }
  return out;
}

interface Descriptor {
  index: number;
  kind: string;
  name: string;
  disabled: boolean;
  typeable: boolean;
  group: string;
}

async function tagWithinOverlay(page: Page, selector: string): Promise<Descriptor[]> {
  return page.evaluate((sel) => {
    const roots = Array.from(document.querySelectorAll(sel));
    const seen = new Set<Element>();
    const out: Descriptor[] = [];
    let index = 0;
    for (const root of roots) {
      const fields = Array.from(
        root.querySelectorAll('button, a[href], select, textarea, input, summary, [role="tab"], [role="checkbox"]'),
      );
      for (const el of fields) {
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
        const labelled =
          input.labels && input.labels.length > 0 ? (input.labels[0].innerText || '').trim() : '';
        const name = (
          e.getAttribute('aria-label') ??
          e.getAttribute('placeholder') ??
          (labelled || (e.innerText || '').trim().split('\n')[0]) ??
          ''
        ).slice(0, 44);
        const kind =
          tag === 'input'
            ? `input-${type}`
            : tag === 'select'
              ? 'select'
              : tag === 'textarea'
                ? 'textarea'
                : tag === 'a'
                  ? 'link'
                  : tag === 'summary'
                    ? 'summary'
                    : e.getAttribute('role') === 'tab'
                      ? 'tab'
                      : 'button';
        e.setAttribute('data-inner', String(index));
        out.push({
          index,
          kind,
          name: name || kind,
          disabled: e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true',
          typeable:
            tag === 'textarea' ||
            (tag === 'input' && ['text', 'search', 'email', 'tel', 'number', 'url'].includes(type)),
          group:
            (
              e.closest(
                '[role="dialog"], [role="alertdialog"], .fo-placeholder-modal, .rq-dialog, .intake-drawer-overlay, .fo-sidebar-panel',
              ) as HTMLElement | null
            )
              ?.getAttribute('aria-label')
              ?.slice(0, 32) ?? '',
        });
        index += 1;
      }
    }
    return out;
  }, selector);
}

async function captureStates(
  page: Page,
  el: Locator,
  screen: string,
  viewport: string,
  d: Descriptor,
): Promise<number> {
  let n = 0;
  if (
    await shootElement(
      page,
      el,
      screen,
      viewport,
      'inside-overlay',
      d.kind,
      d.disabled ? 'inner-disabled' : 'inner-default',
      d.name,
    )
  ) {
    n += 1;
  }
  if (d.disabled) return n;

  try {
    await el.hover({ timeout: 1200, force: true });
    await page.waitForTimeout(120);
    if (await shootElement(page, el, screen, viewport, 'inside-overlay', d.kind, 'inner-hover', d.name)) n += 1;
    await page.mouse.move(0, 0);
  } catch {
    note(`${screen} ${viewport}: inside an overlay, ${d.kind} "${d.name}" would not hover`);
  }

  try {
    await page.keyboard.down('Shift');
    await page.keyboard.up('Shift');
    await el.focus({ timeout: 1200 });
    await page.waitForTimeout(110);
    const matched = await el.evaluate((node) => node.matches(':focus-visible'));
    if (await shootElement(
      page,
      el,
      screen,
      viewport,
      'inside-overlay',
      d.kind,
      matched ? 'inner-focus-visible' : 'inner-focused-not-focus-visible',
      d.name,
    )) {
      n += 1;
    }
    if (!matched) {
      note(`${screen} ${viewport}: inside an overlay, ${d.kind} "${d.name}" took focus but never matched :focus-visible`);
    }
  } catch {
    note(`${screen} ${viewport}: inside an overlay, ${d.kind} "${d.name}" would not take focus`);
  }

  if (d.kind === 'input-radio' || d.kind === 'input-checkbox') {
    try {
      await el.click({ timeout: 1200, force: true });
      await page.waitForTimeout(140);
      if (await shootElement(page, el, screen, viewport, 'inside-overlay', d.kind, 'inner-checked', d.name)) n += 1;
    } catch {
      note(`${screen} ${viewport}: inside an overlay, ${d.kind} "${d.name}" would not toggle`);
    }
  }

  if (d.typeable) {
    try {
      await el.fill(d.kind === 'input-number' ? '1234567890' : 'Zz a deliberately long value to show how the field handles overflow');
      await page.waitForTimeout(150);
      if (await shootElement(page, el, screen, viewport, 'inside-overlay', d.kind, 'inner-populated-long', d.name)) n += 1;
      await el.fill('');
    } catch {
      note(`${screen} ${viewport}: inside an overlay, ${d.kind} "${d.name}" would not accept a value`);
    }
  }

  if (d.kind === 'input-date' || d.kind === 'input-datetime-local') {
    try {
      await el.click({ timeout: 1200 });
      await page.waitForTimeout(300);
      await shootScreen(
        page,
        screen,
        viewport,
        `inner-${d.kind}-picker-${d.name}`,
        'clicked a date field inside an overlay: any calendar the browser drew is an OS-level popup and does not appear here',
      );
    } catch {
      note(`${screen} ${viewport}: inside an overlay, ${d.kind} "${d.name}" would not open its picker`);
    }
  }

  return n;
}

test('sweep: every control inside every overlay', async ({ page }) => {
  test.setTimeout(0);
  const ids = await resolveIds();
  const targets = knownOpeners().filter((t) => ONLY_SCREEN === '' || t.screen === ONLY_SCREEN);
  const summary: string[] = [];

  await signIn(page, PERSONA_EMAILS.admin);

  for (const viewport of VIEWPORTS) {
    const here = targets.filter((t) => t.viewport === viewport.name);
    if (here.length === 0) continue;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const target of here) {
      const route = ROUTES.find((r) => r.id === target.screen);
      if (route === undefined) {
        note(`${target.screen}: no route definition, so its overlays could not be reopened`);
        continue;
      }
      const path = resolvePath(route, ids);
      if (path === null) continue;

      await guardWrites(page, target.screen);
      await gotoAsSignedIn(page, path);
      await settle(page, 900);

      const opener = page
        .locator(
          `button:has-text("${target.opener}"), [aria-label="${target.opener}"], [title="${target.opener}"], a:has-text("${target.opener}")`,
        )
        .first();
      if ((await opener.count()) === 0) {
        note(`${target.screen} ${viewport.name}: opener "${target.opener}" could not be found again, so its interior was not swept`);
        continue;
      }

      await markExistingOverlays(page);
      try {
        await opener.scrollIntoViewIfNeeded({ timeout: 2500 });
        await opener.click({ timeout: 3000, force: true });
        await settle(page, 600);
      } catch {
        note(`${target.screen} ${viewport.name}: opener "${target.opener}" would not click on the interior pass`);
        continue;
      }

      const selector = newOverlaySelector();
      const descriptors = await tagWithinOverlay(page, selector);
      if (descriptors.length === 0) {
        note(`${target.screen} ${viewport.name}: "${target.opener}" opened something with no interactive control inside it`);
        await page.keyboard.press('Escape');
        continue;
      }

      let stateShots = 0;
      for (const d of descriptors) {
        const el = page.locator(`[data-inner="${d.index}"]`);
        if ((await el.count()) === 0) {
          note(`${target.screen} ${viewport.name}: inside "${target.opener}", ${d.kind} "${d.name}" vanished before its state capture`);
          continue;
        }
        stateShots += await captureStates(page, el, target.screen, viewport.name, d);
      }

      await shootScreen(page, target.screen, viewport.name, `inner-filled-${target.opener}`, `every control inside "${target.opener}" after being exercised`);
      summary.push(
        `${target.screen} ${viewport.name} "${target.opener}": ${descriptors.length} inner controls, ${stateShots} state shots`,
      );
      await page.keyboard.press('Escape');
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      flush();
    }
  }

  flush();
  console.log(`INNER shots=${shots.length} blockedWrites=${new Set(blockedWrites).size}`);
  for (const line of summary) console.log(`INNER ${line}`);
});
