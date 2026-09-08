import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';
import {
  DESKTOP,
  type ActedRow,
  type RouteReport,
  accessibleName,
  closeOverlay,
  dir,
  fingerprint,
  overlayKind,
  pageHeight,
  pressAndRecord,
  readState,
  raceTimeout,
  REPEAT_CAP,
  repeatKey,
  sectionGaps,
  settle,
  skipReason,
  settledState,
  shootFolds,
  shootFullPage,
  slug,
  writeReport,
} from './sweep-lib';
import { join } from 'node:path';

const ROLE = (process.env.SWEEP_ROLE ?? 'admin') as keyof typeof PERSONA_EMAILS;
const ONLY = (process.env.SWEEP_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const ROW_PRESS_CAP = Number(process.env.SWEEP_ROW_PRESS_CAP ?? 2);

test(`visual sweep: every page at every height, as ${ROLE}`, async ({ page }) => {
  test.setTimeout(0);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ROUTE_BUDGET_MS = Number(process.env.SWEEP_ROUTE_BUDGET_MS ?? 300000);
  const ids = await resolveIds();

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${String(err).split('\n')[0]?.slice(0, 180)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text().slice(0, 180)}`);
  });
  page.on('crash', () => pageErrors.push('the page CRASHED'));

  const downloads: string[] = [];
  page.on('download', (d) => {
    downloads.push(d.suggestedFilename());
    void d.cancel().catch(() => undefined);
  });

  await signIn(page, PERSONA_EMAILS[ROLE]);

  let totalImages = 0;
  let totalRoutes = 0;

  const shellDir = dir('states', ROLE, '_shell');
  const backToHome = async () => {
    await gotoAsSignedIn(page, '/');
    await settle(page, 8000);
  };
  await backToHome();
  await shootFullPage(page, join(shellDir, 'shell-00-dashboard.png'));
  totalImages += 1;

  const shellButtons = page.locator(
    '.fo-utility-header button:visible, .fo-sidebar button:visible, .fo-bookmark-bar button:visible, nav.fo-primary-nav button:visible',
  );
  const shellCount = await shellButtons.count();
  const shellActed: ActedRow[] = [];
  const shellNotes: string[] = [];
  const shellBaseline = await fingerprint(page);
  for (let i = 0; i < shellCount; i += 1) {
    const el = shellButtons.nth(i);
    const name = await accessibleName(el).catch(() => '');
    if (!name) continue;
    const skip = skipReason(name);
    if (skip !== null) {
      shellActed.push({ name, selector: 'shell button', kind: 'shell-button', outcome: skip, image: null });
      continue;
    }
    const res = await pressAndRecord(page, el, name, 'shell-button', shellDir, 'shell-', shellBaseline, backToHome);
    totalImages += res.images;
    shellActed.push(res.row);
    if (res.stuck !== null) shellNotes.push(`the ${res.stuck} opened by "${name}" would not close`);
  }
  shellNotes.push('shell chrome is pressed once per role rather than once per route');
  writeReport(ROLE, '_shell', {
    role: ROLE,
    route: '_shell',
    path: '/',
    pageHeight: await pageHeight(page),
    viewportHeight: DESKTOP.height,
    folds: 0,
    interactiveFound: shellCount,
    interactiveActed: shellActed.length,
    skippedDestructive: shellActed.filter((a) => a.outcome.startsWith('NOT PRESSED')).map((a) => a.name),
    sectionGaps: [],
    acted: shellActed,
    notes: shellNotes,
  });
  console.log(
    `SWEEP ${ROLE} _shell buttons=${shellCount} acted=${shellActed.length} dead=${shellActed.filter((a) => a.outcome === 'NOTHING HAPPENED').length} unclickable=${shellActed.filter((a) => a.outcome.startsWith('NOT CLICKABLE')).length}`,
  );

  for (const route of ROUTES) {
    if (ONLY.length > 0 && !ONLY.includes(route.id)) continue;
    const path = resolvePath(route, ids);
    if (path === null) continue;
    totalRoutes += 1;
    const routeStartedAt = Date.now();
    const outOfBudget = () => Date.now() - routeStartedAt > ROUTE_BUDGET_MS;

    const screens = dir('screens', ROLE, route.id);
    const states = dir('states', ROLE, route.id);
    const acted: ActedRow[] = [];
    const notes: string[] = [];
    const skipped: string[] = [];
    const backToRoute = async () => {
      await gotoAsSignedIn(page, path);
      await settle(page, 8000);
      await closeOverlay(page);
    };

    await gotoAsSignedIn(page, path);
    const settled = await settle(page);
    if (!settled) notes.push('layout did not settle within 12s; captured anyway and flagged');

    await shootFullPage(page, join(screens, '01-full.png'));
    const height = await pageHeight(page);
    const folds = await shootFolds(page, screens, '');
    totalImages += 1 + folds;
    const gaps = await sectionGaps(page);
    const baseline = (await settledState(page, 1500)).fp;

    const accordions = page.locator('.record-section-header');
    const accordionCount = await accordions.count();
    for (let i = 0; i < accordionCount; i += 1) {
      const el = accordions.nth(i);
      const name = await accessibleName(el);
      const expandedBefore = await el.getAttribute('aria-expanded');
      const before = await readState(page);
      await el.click({ timeout: 5000 }).catch(() => undefined);
      await settle(page, 4000);
      const expandedAfter = await el.getAttribute('aria-expanded');
      const after = await readState(page);
      if (after.fp === before.fp && expandedBefore === expandedAfter) {
        acted.push({
          name,
          selector: '.record-section-header',
          kind: 'accordion',
          outcome: `NOTHING HAPPENED, aria-expanded stayed ${expandedAfter ?? 'unset'}`,
          image: null,
        });
        continue;
      }
      const file = `accordion-${slug(name, `n${i}`)}.png`;
      await shootFullPage(page, join(states, file));
      totalImages += 1;
      acted.push({
        name,
        selector: '.record-section-header',
        kind: 'accordion',
        outcome: `toggled aria-expanded ${expandedBefore ?? 'unset'} to ${expandedAfter ?? 'unset'}`,
        image: file,
      });
      await el.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(140);
    }
    if (accordionCount > 1) {
      for (let i = 0; i < accordionCount; i += 1) {
        await accordions.nth(i).click({ timeout: 5000 }).catch(() => undefined);
      }
      await settle(page, 6000);
      await shootFullPage(page, join(states, 'accordion-all-open.png'));
      const openFolds = await shootFolds(page, states, 'accordion-all-open-');
      totalImages += 1 + openFolds;
      notes.push(
        `all ${accordionCount} accordions open reaches ${await pageHeight(page)}px and spans ${openFolds} fold(s)`,
      );
      await backToRoute();
    }

    const boxes = page.getByRole('combobox');
    const boxCount = await boxes.count();
    for (let i = 0; i < boxCount; i += 1) {
      const el = boxes.nth(i);
      const name = await accessibleName(el);
      await closeOverlay(page);
      let clickError: string | null = null;
      try {
        await el.click({ timeout: 4000 });
      } catch (err) {
        clickError = String(err).split('\n')[0]?.slice(0, 140) ?? 'click failed';
      }
      if (clickError !== null) {
        acted.push({
          name,
          selector: '[role=combobox]',
          kind: 'combobox',
          outcome: `NOT CLICKABLE, ${clickError}`,
          image: null,
        });
        continue;
      }
      const opened = await settledState(page, 2500);
      if (opened.kind === 'listbox' || opened.kind === 'dialog' || opened.kind === 'menu') {
        const options = await page.locator('[role="option"], [role="menuitem"]').count();
        const file = `dropdown-${slug(name, `n${i}`)}.png`;
        await shootFullPage(page, join(states, file));
        totalImages += 1;
        acted.push({
          name,
          selector: '[role=combobox]',
          kind: 'combobox',
          outcome: `${opened.kind} opened with ${options} option(s)`,
          image: file,
        });
      } else {
        acted.push({
          name,
          selector: '[role=combobox]',
          kind: 'combobox',
          outcome: 'NOTHING HAPPENED',
          image: null,
        });
      }
      const stuck = await closeOverlay(page);
      if (stuck !== null) notes.push(`the ${stuck} opened by combobox "${name}" would not close`);
    }

    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount; i += 1) {
      const el = tabs.nth(i);
      const name = await accessibleName(el);
      const before = await readState(page);
      await el.click({ timeout: 5000 }).catch(() => undefined);
      await settle(page, 6000);
      const after = await readState(page);
      if (after.fp === before.fp) {
        acted.push({ name, selector: '[role=tab]', kind: 'tab', outcome: 'NOTHING HAPPENED', image: null });
        continue;
      }
      const file = `tab-${slug(name, `n${i}`)}.png`;
      await shootFullPage(page, join(states, file));
      const tabFolds = await shootFolds(page, states, `tab-${slug(name, `n${i}`)}-`);
      totalImages += 1 + tabFolds;
      acted.push({ name, selector: '[role=tab]', kind: 'tab', outcome: 'selected', image: file });
    }
    if (tabCount > 0) await backToRoute();

    const links = await page.locator('a[href]:visible').evaluateAll((els) =>
      els.map((e) => ({
        name: ((e as HTMLElement).getAttribute('aria-label') || (e as HTMLElement).innerText || '')
          .trim()
          .slice(0, 60),
        href: (e as HTMLAnchorElement).getAttribute('href') ?? '',
        inShell: Boolean(e.closest('nav.fo-primary-nav, .fo-utility-header, .fo-sidebar, .fo-bookmark-bar')),
      })),
    );
    for (const l of links) {
      acted.push({
        name: l.name || l.href,
        selector: `a[href="${l.href}"]`,
        kind: l.inShell ? 'shell-link' : 'link',
        outcome: `href ${l.href}, destination read rather than clicked`,
        image: null,
      });
    }

    const buttons = page.locator('main button:visible:not(.record-section-header), main [role="button"]:visible');
    const buttonCount = await buttons.count();
    let pressedCount = 0;
    let resetCount = 0;
    const repeats = new Map<string, number>();
    let rowPresses = 0;
    for (let i = 0; i < buttonCount; i += 1) {
      const el = buttons.nth(i);
      const name = await accessibleName(el).catch(() => '');
      if (!name) continue;
      const skip = skipReason(name);
      if (skip !== null) {
        skipped.push(`${name} :: ${skip}`);
        acted.push({ name, selector: 'button', kind: 'button', outcome: skip, image: null });
        continue;
      }
      const inRow = await raceTimeout(
        el.evaluate((n) => Boolean((n as HTMLElement).closest('tbody'))),
        10000,
        'row test',
      ).catch(() => false);
      if (inRow) {
        rowPresses += 1;
        if (rowPresses > ROW_PRESS_CAP) {
          acted.push({
            name,
            selector: 'button',
            kind: 'button',
            outcome: `NOT PRESSED, it sits inside a table row and ${ROW_PRESS_CAP} such control(s) were already acted on; every one of them opens the same record page for a different record`,
            image: null,
          });
          continue;
        }
      }
      const key = repeatKey(name);
      const seen = (repeats.get(key) ?? 0) + 1;
      repeats.set(key, seen);
      if (seen > REPEAT_CAP) {
        acted.push({
          name,
          selector: 'button',
          kind: 'button',
          outcome: `NOT PRESSED, the ${REPEAT_CAP} control(s) already acted on with the same label shape "${key}" cover it`,
          image: null,
        });
        continue;
      }
      const suffix = seen > 1 ? `${seen}-` : '';
      if (outOfBudget()) {
        acted.push({
          name,
          selector: 'button',
          kind: 'button',
          outcome: `NOT PRESSED, this route passed its ${Math.round(ROUTE_BUDGET_MS / 1000)}s budget before reaching it`,
          image: null,
        });
        continue;
      }
      const downloadsBefore = downloads.length;
      let res: Awaited<ReturnType<typeof pressAndRecord>>;
      try {
        res = await pressAndRecord(page, el, name, 'button', states, suffix, baseline, backToRoute);
      } catch (err) {
        const message = String(err).split('\n')[0]?.slice(0, 200) ?? 'unknown';
        acted.push({ name, selector: 'button', kind: 'button', outcome: `PRESS ABORTED, ${message}`, image: null });
        notes.push(`pressing "${name}" aborted: ${message}. The route was reloaded and the sweep continued.`);
        await backToRoute().catch(() => undefined);
        continue;
      }
      if (downloadsBefore < downloads.length) {
        const started = downloads.slice(downloadsBefore);
        res.row.outcome = `a download started: ${started.join(', ')}${
          res.row.outcome.startsWith('NOTHING HAPPENED') ? '' : `; the page also reported ${res.row.outcome}`
        }`;
      }
      totalImages += res.images;
      acted.push(res.row);
      pressedCount += 1;
      if (res.reset) resetCount += 1;
      if (res.stuck !== null) notes.push(`the ${res.stuck} opened by button "${name}" would not close`);
    }
    if (rowPresses > ROW_PRESS_CAP) {
      notes.push(
        `${rowPresses} control(s) sit inside table rows; ${ROW_PRESS_CAP} were pressed and ${rowPresses - ROW_PRESS_CAP} were not, because each one navigates to the same record page for a different record and each navigation costs a reload back to the list`,
      );
    }
    const cappedKeys = [...repeats.entries()].filter(([, n]) => n > REPEAT_CAP);
    notes.push(
      `${pressedCount} of ${buttonCount} in-content button(s) pressed, ${resetCount} of which left the page changed and forced a reload back to the route`,
    );
    if (cappedKeys.length > 0) {
      notes.push(
        `${cappedKeys.length} label shape(s) repeat down the page and were capped at ${REPEAT_CAP} press(es) each: ${cappedKeys
          .map(([k, n]) => `"${k}" x${n}`)
          .join(', ')}`,
      );
    }
    notes.push(
      `${links.length} link(s) recorded from their href without clicking, ${links.filter((l) => l.inShell).length} of them shell chrome that is pressed once per role instead`,
    );

    if (pageErrors.length > 0) {
      const unique = [...new Set(pageErrors)];
      notes.push(
        `the page reported ${pageErrors.length} error(s), ${unique.length} distinct: ${unique.slice(0, 8).join(' | ')}`,
      );
      pageErrors.length = 0;
    }

    const report: RouteReport = {
      role: ROLE,
      route: route.id,
      path,
      pageHeight: height,
      viewportHeight: DESKTOP.height,
      folds,
      interactiveFound: accordionCount + boxCount + tabCount + buttonCount + links.length,
      interactiveActed: acted.length,
      skippedDestructive: skipped,
      sectionGaps: gaps,
      acted,
      notes,
    };
    writeReport(ROLE, route.id, report);

    const overBudget = acted.filter((a) => a.outcome.includes('passed its')).length;
    if (overBudget > 0) {
      notes.push(
        `this route ran past its ${Math.round(ROUTE_BUDGET_MS / 1000)}s budget after ${Math.round((Date.now() - routeStartedAt) / 1000)}s, so ${overBudget} control(s) were left unpressed and are named in the rows above`,
      );
    }
    const dead = acted.filter((a) => a.outcome.startsWith('NOTHING HAPPENED')).length;
    const blocked = acted.filter((a) => a.outcome.startsWith('NOT CLICKABLE')).length;
    console.log(
      `SWEEP ${ROLE} ${route.id} height=${height} folds=${folds} acted=${acted.length}/${report.interactiveFound} dead=${dead} unclickable=${blocked} skipped=${skipped.length}`,
    );
    const leftOpen = await overlayKind(page);
    if (leftOpen !== null) console.log(`SWEEP ${ROLE} ${route.id} LEFT A ${leftOpen} OPEN at the end of the route`);
  }

  console.log(`SWEEP TOTAL ${ROLE} routes=${totalRoutes} images=${totalImages}`);
  expect(totalRoutes).toBeGreaterThan(0);
  expect(totalImages).toBeGreaterThan(totalRoutes);
});
