import { expect, test, type Page } from '@playwright/test';
import {
  PERSONA_EMAILS,
  gotoAsSignedIn,
  recordSection,
  signIn,
  watchOverlayExit,
} from './helpers';

const CANDIDATE = '/recruit/candidates/b0000000-0000-4000-8000-000000000002';

function tabGeometry(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('nav.fo-primary-nav button')].map((el) => {
      const box = el.getBoundingClientRect();
      return {
        label: (el.textContent ?? '').trim().slice(0, 16),
        x: Math.round(box.x * 100) / 100,
        w: Math.round(box.width * 100) / 100,
        weight: getComputedStyle(el).fontWeight,
      };
    }),
  );
}

async function openMerge(page: Page): Promise<void> {
  const more = page.getByRole('button', { name: /^More/ }).first();
  await expect(more).toBeEnabled({ timeout: 25000 });
  await more.click();
  const item = page.getByRole('menuitem', { name: 'Merge duplicate…' });
  await expect(item).toBeEnabled({ timeout: 25000 });
  await item.click();
}

async function watchExit(
  page: import('@playwright/test').Page,
  selector: string,
): Promise<void> {
  await page.evaluate((sel) => {
    const probe = window as unknown as { __exit?: { closing: boolean; duration: string } };
    probe.__exit = { closing: false, duration: '0s' };
    const observer = new MutationObserver(() => {
      const el = document.querySelector(sel);
      if (el === null) return;
      if (el.getAttribute('data-closing') === 'true' && probe.__exit) {
        probe.__exit.closing = true;
        probe.__exit.duration = getComputedStyle(el).animationDuration.split(', ')[0] ?? '0s';
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-closing'],
    });
  }, selector);
}

async function exitSeen(
  page: import('@playwright/test').Page,
): Promise<{ closing: boolean; duration: string }> {
  return page.evaluate(
    () =>
      (window as unknown as { __exit: { closing: boolean; duration: string } }).__exit,
  );
}

test.describe('R: motion that a user can see, asserted rather than budgeted', () => {
  test('R4 a tab going bold does not change its own width or its neighbour\'s', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const widthOf = (label: string) =>
      page.evaluate((wanted) => {
        const el = [...document.querySelectorAll('nav.fo-primary-nav button')].find(
          (b) => (b.textContent ?? '').trim() === wanted,
        );
        if (!el) return null;
        return {
          w: Math.round(el.getBoundingClientRect().width * 100) / 100,
          weight: getComputedStyle(el).fontWeight,
        };
      }, label);

    await expect.poll(() => widthOf('Candidates'), { timeout: 25000 }).not.toBeNull();
    const candidatesBefore = await widthOf('Candidates');
    const requisitionsBefore = await widthOf('Requisitions');
    expect(candidatesBefore?.weight, 'Candidates starts active and bold').toBe('700');
    expect(requisitionsBefore?.weight).toBe('500');

    await page
      .locator('nav.fo-primary-nav button')
      .filter({ hasText: /^Requisitions$/ })
      .first()
      .click();
    await expect
      .poll(async () => (await widthOf('Requisitions'))?.weight, { timeout: 25000 })
      .toBe('700');

    const candidatesAfter = await widthOf('Candidates');
    const requisitionsAfter = await widthOf('Requisitions');
    expect(candidatesAfter?.weight, 'Candidates has given up the bold').toBe('500');

    expect(
      requisitionsAfter?.w,
      'a tab must not grow when it becomes bold',
    ).toBe(requisitionsBefore?.w);
    expect(
      candidatesAfter?.w,
      'a tab must not shrink when it stops being bold',
    ).toBe(candidatesBefore?.w);
  });

  test('R2 the accordion chevron rotates rather than swapping a glyph', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, CANDIDATE);
    const section = recordSection(page, 'Candidate Information');
    const chevron = section.locator('.record-section-chevron');
    await expect(chevron).toBeVisible({ timeout: 25000 });

    await expect(section).toHaveAttribute('data-open', 'true');
    expect(await chevron.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    expect(
      await chevron.evaluate((el) => el.querySelector('svg') !== null),
      'a real element, so it can transform',
    ).toBe(true);

    await section.locator('.record-section-header').click();
    await expect(section).toHaveAttribute('data-open', 'false');
    await expect
      .poll(() => chevron.evaluate((el) => getComputedStyle(el).transform), { timeout: 3000 })
      .toBe('matrix(0, -1, 1, 0, 0, 0)');
  });

  test('R3 the accordion interpolates its height in both directions', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, CANDIDATE);
    const section = recordSection(page, 'Candidate Information');
    const collapse = section.locator('.record-section-collapse');
    await expect(collapse).toBeVisible({ timeout: 25000 });

    const px = async () =>
      parseFloat((await collapse.evaluate((el) => getComputedStyle(el).gridTemplateRows)) ?? '0');

    await expect
      .poll(() => collapse.evaluate((el) => el.getAnimations().length), {
        timeout: 5000,
        message: 'the mount transition never finished, so a click would cancel it',
      })
      .toBe(0);

    const openHeight = await px();
    expect(openHeight).toBeGreaterThan(10);

    const toggle = () =>
      section.evaluate(
        (root, budget) =>
          new Promise<{ events: string[]; samples: number[]; duration: string }>((resolve) => {
            const el = root.querySelector('.record-section-collapse') as HTMLElement;
            const header = root.querySelector('.record-section-header') as HTMLElement;
            const events: string[] = [];
            const samples: number[] = [];
            const read = () => parseFloat(getComputedStyle(el).gridTemplateRows) || 0;
            const duration = getComputedStyle(el).transitionDuration;
            for (const name of ['transitionrun', 'transitionstart', 'transitioncancel']) {
              el.addEventListener(name, (e) => {
                if ((e as TransitionEvent).propertyName === 'grid-template-rows') {
                  events.push(name);
                }
              });
            }
            header.click();
            const t0 = performance.now();
            const tick = () => {
              samples.push(read());
              if (performance.now() - t0 < budget) requestAnimationFrame(tick);
              else resolve({ events, samples, duration });
            };
            requestAnimationFrame(tick);
          }),
        700,
      );

    const closing = await toggle();
    expect(closing.duration, 'the collapse must have a real transition duration').not.toBe('0s');
    expect(
      closing.events,
      'collapsing must start a grid-template-rows transition rather than snap',
    ).toContain('transitionrun');
    expect(
      closing.events,
      'nothing should be cancelling the collapse; a settled section was clicked',
    ).not.toContain('transitioncancel');
    expect(
      closing.samples.filter((v) => v > 0.5 && v < openHeight - 0.5).length,
      `collapsing must pass through intermediate heights. Samples: ${closing.samples
        .slice(0, 10)
        .map((v) => v.toFixed(1))
        .join(', ')}`,
    ).toBeGreaterThan(0);
    await expect.poll(px, { timeout: 3000 }).toBe(0);

    const opening = await toggle();
    expect(
      opening.events,
      'reopening must start a grid-template-rows transition',
    ).toContain('transitionrun');
    expect(
      opening.samples.filter((v) => v > 0.5 && v < openHeight - 0.5).length,
      `reopening must pass through intermediate heights. Samples: ${opening.samples
        .slice(0, 10)
        .map((v) => v.toFixed(1))
        .join(', ')}`,
    ).toBeGreaterThan(0);
    await expect
      .poll(async () => Math.abs((await px()) - openHeight) < 1.5, { timeout: 3000 })
      .toBe(true);
  });

  test('R3 a collapsed section is inert, so nothing inside it can be reached', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, CANDIDATE);
    const section = recordSection(page, 'Candidate Information');
    const collapse = section.locator('.record-section-collapse');
    await expect(collapse).toBeVisible({ timeout: 25000 });

    await section.locator('.record-section-header').click();
    await expect(collapse).toHaveAttribute('inert', '');
    await expect(collapse).toHaveAttribute('aria-hidden', 'true');

    const reach = await collapse.evaluate((el) => {
      const nodes = [...el.querySelectorAll('a,button,input,select,textarea,[tabindex]')];
      let reachable = 0;
      for (const n of nodes) {
        (n as HTMLElement).focus();
        if (document.activeElement === n) reachable += 1;
      }
      return { total: nodes.length, reachable };
    });
    expect(reach.reachable, 'inert must make every descendant unfocusable').toBe(0);
  });

  test('R1 a dialog is still on screen mid-fade after close, and Escape closes it', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, CANDIDATE);
    await openMerge(page);
    const overlay = page.locator('.rq-overlay');
    await expect(overlay).toHaveCount(1);

    await watchExit(page, '.rq-overlay');
    await page.locator('.rq-dialog-x').click();
    await expect(overlay).toHaveCount(0, { timeout: 3000 });
    const mid = await exitSeen(page);
    expect(
      mid.closing,
      'the node must outlive the click so it can animate out. A MutationObserver records that it happened rather than sampling for it afterwards, because on a 2 vCPU runner the whole exit finishes before a round trip lands',
    ).toBe(true);
    expect(mid.duration, 'and the exit has a real duration').not.toBe('0s');

    await openMerge(page);
    await expect(overlay).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveAttribute('data-closing', 'true');
    await expect(overlay).toHaveCount(0, { timeout: 3000 });
  });

  test('R5 every control the user touches carries a transition', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.btn').first()).toBeVisible({ timeout: 25000 });

    const missing = await page.evaluate(() => {
      const selectors = [
        'select',
        'input[type="checkbox"]',
        'input.input',
        'input[type="search"]',
        '.badge',
        '.star-grade .star',
        '.fo-sidebar-collapse-btn',
        '.fo-qs-advanced-link',
        '.fo-gear-btn',
        '.fo-nav-scroll-btn',
        '.btn',
        '.link-btn',
        '.fo-nav-tab',
      ];
      return selectors
        .map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const cs = getComputedStyle(el);
          const ms = cs.transitionDuration
            .split(',')
            .map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000));
          return ms.some((v) => v > 0) ? null : selector;
        })
        .filter(Boolean);
    });
    expect(missing, 'these controls change appearance with no transition').toEqual([]);
  });

  test('R7 a dropdown menu animates in, animates out, and rotates its caret', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const trigger = page.getByRole('button', { name: /Administration/ });
    const menu = page.locator('.fo-utility-menu');
    const caret = trigger.locator('.fo-utility-caret');
    await expect(trigger).toBeVisible({ timeout: 25000 });
    expect(await caret.evaluate((el) => getComputedStyle(el).transform)).toBe('none');

    await trigger.click();
    await expect(menu).toHaveCount(1);
    expect(await menu.evaluate((el) => getComputedStyle(el).animationName)).toBe('menu-drop-in');
    await expect
      .poll(() => caret.evaluate((el) => getComputedStyle(el).transform), { timeout: 3000 })
      .toBe('matrix(-1, 0, 0, -1, 0, 0)');

    await watchExit(page, '.fo-utility-menu');
    await trigger.click();
    await expect(menu).toHaveCount(0, { timeout: 3000 });
    const menuMid = await exitSeen(page);
    expect(menuMid.closing, 'the menu must outlive the click so it can animate out').toBe(true);
    expect(menuMid.duration, 'and its exit has a real duration').not.toBe('0s');
  });

  test('R7 clicking outside a dropdown animates it out rather than cutting it', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const trigger = page.getByRole('button', { name: /Administration/ });
    const menu = page.locator('.fo-utility-menu');
    await expect(trigger).toBeVisible({ timeout: 25000 });
    await trigger.click();
    await expect(menu).toHaveCount(1);

    await watchExit(page, '.fo-utility-menu');
    await page.locator('.fo-brand').click();
    await expect(menu).toHaveCount(0, { timeout: 3000 });
    const outside = await exitSeen(page);
    expect(
      outside.closing,
      'a click outside animates the menu out rather than cutting it',
    ).toBe(true);
    expect(outside.duration, 'and that exit has a real duration').not.toBe('0s');
  });

  test('R8 the filter rail animates in and out rather than appearing whole', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const toggle = page
      .getByRole('button', { name: 'Advanced Search', disabled: false })
      .first();
    await expect(toggle).toBeVisible({ timeout: 25000 });
    const rail = page.locator('.filter-rail');
    await expect(rail).toHaveCount(0);

    await toggle.click();
    await expect(rail).toHaveCount(1);
    expect(await rail.evaluate((el) => getComputedStyle(el).animationName)).toBe('panel-fade-in');

    await watchExit(page, '.filter-rail');
    await toggle.click();
    await expect(rail).toHaveCount(0, { timeout: 3000 });
    const mid = await exitSeen(page);
    expect(mid.closing, 'the rail must outlive the click so it can animate out').toBe(true);
    expect(mid.duration, 'and its exit has a real duration').not.toBe('0s');
  });

  test('R7 a toast fades, and the intake panels animate, in the module that owns them', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    const animationsFor = (selector: string) =>
      page.evaluate((wanted) => {
        const found: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRuleList;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          const walk = (list: CSSRuleList) => {
            for (const rule of Array.from(list)) {
              const r = rule as unknown as {
                selectorText?: string;
                style?: CSSStyleDeclaration;
                cssRules?: CSSRuleList;
              };
              if (r.selectorText && r.style) {
                const shorthand = r.style.animation || r.style.animationName;
                if (r.selectorText.includes(wanted) && shorthand) {
                  found.push(shorthand.split(' ')[0] ?? '');
                }
              } else if (r.cssRules) {
                walk(r.cssRules);
              }
            }
          };
          walk(rules);
        }
        return found;
      }, selector);

    await gotoAsSignedIn(page, '/sales/deals');
    await expect(page.getByRole('heading', { name: /^Deals/ })).toBeVisible({ timeout: 25000 });
    expect(await animationsFor('.sales-toast'), 'a won-deal toast must animate in and out').toEqual(
      expect.arrayContaining(['toast-in', 'overlay-fade-out']),
    );

    await gotoAsSignedIn(page, '/intake');
    await expect(page.locator('.fo-page-header, .list-page-head').first()).toBeVisible({
      timeout: 25000,
    });
    expect(await animationsFor('.intake-inline-panel')).toEqual(
      expect.arrayContaining(['panel-fade-in']),
    );

    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap').first()).toBeVisible({ timeout: 25000 });
    expect(await animationsFor('.filter-rail')).toEqual(
      expect.arrayContaining(['panel-fade-in', 'panel-fade-out']),
    );
  });

  test('R1 Cancel animates out too, not just the close cross', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, CANDIDATE);
    await openMerge(page);

    const overlay = page.locator('.rq-overlay');
    await expect(overlay).toHaveCount(1);
    const readExit = await watchOverlayExit(page, '.rq-overlay');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(overlay).toHaveCount(0, { timeout: 3000 });
    const exit = await readExit();
    expect(exit.sawClosing, 'Cancel must animate out, not cut').toBe(true);
    expect(exit.removed, 'the overlay must unmount once it has animated out').toBe(true);
  });
});
