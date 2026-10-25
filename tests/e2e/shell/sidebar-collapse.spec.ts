import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const COLLAPSED_W = 52;

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

test('K5: the chevron stays reachable when the rail is collapsed, so it can be reopened', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/recruit/candidates');
  const rail = page.locator('.fo-sidebar');
  const toggle = page.getByRole('button', { name: /Collapse sidebar|Expand sidebar/ });
  await expect(rail).toBeVisible({ timeout: 25000 });
  await expect(toggle).toBeVisible();

  const openWidth = (await rail.boundingBox())!.width;
  expect(openWidth).toBeGreaterThan(200);

  await toggle.click();
  await expect
    .poll(async () => Math.round((await rail.boundingBox())!.width), { timeout: 5000 })
    .toBe(COLLAPSED_W);

  await expect(
    page.getByRole('button', { name: 'Expand sidebar' }),
    'the chevron must remain visible when collapsed, or the rail cannot be reopened',
  ).toBeVisible();
  const chevron = await page.locator('.fo-sidebar-collapse-chevron').boundingBox();
  expect(chevron, 'the chevron must have a box').not.toBeNull();
  expect(chevron!.width, 'the chevron must not be clipped to nothing').toBeGreaterThan(8);
  expect(
    chevron!.x + chevron!.width,
    `the chevron must sit inside the ${COLLAPSED_W}px rail`,
  ).toBeLessThanOrEqual(COLLAPSED_W + 1);

  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect
    .poll(async () => Math.round((await rail.boundingBox())!.width), { timeout: 5000 })
    .toBe(Math.round(openWidth));
});

test('K5: the rail animates its width rather than jumping', async ({ page }) => {
  await gotoAsSignedIn(page, '/recruit/candidates');
  await expect(page.locator('.fo-sidebar')).toBeVisible({ timeout: 25000 });
  const motion = await page.locator('.fo-sidebar').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { prop: cs.transitionProperty, dur: cs.transitionDuration };
  });
  expect(motion.prop, 'the rail must transition its width').toContain('width');
  expect(motion.dur, 'the rail transition must have a real duration').not.toBe('0s');

  const header = page.locator('.fo-sidebar-panel-header').first();
  const headerMotion = await header.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { prop: cs.transitionProperty, dur: cs.transitionDuration, width: cs.width };
  });
  expect(
    headerMotion.prop,
    'the blue panel header is what the user watches, so it must transition too',
  ).toContain('width');
  expect(headerMotion.dur, 'the header transition must have a real duration').not.toBe('0s');
  expect(
    headerMotion.width,
    'a transition cannot interpolate from auto, so the open width must be explicit',
  ).toMatch(/px$/);

  const widths = await page.evaluate(async () => {
    const bar = document.querySelector('.fo-sidebar-panel-header') as HTMLElement;
    const toggle = document.querySelector('.fo-sidebar-collapse-btn') as HTMLElement;
    const seen: number[] = [];
    const frames = new Promise<number[]>((resolve) => {
      const started = performance.now();
      const tick = () => {
        seen.push(Math.round(bar.getBoundingClientRect().width));
        if (performance.now() - started < 400) requestAnimationFrame(tick);
        else resolve(seen);
      };
      requestAnimationFrame(tick);
    });
    toggle.click();
    return frames;
  });
  expect(
    new Set(widths).size,
    `the header must travel rather than snap, saw ${widths.join(',')}`,
  ).toBeGreaterThan(2);
});
