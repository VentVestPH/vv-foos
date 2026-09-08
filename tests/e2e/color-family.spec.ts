import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

function hueOf(rgb: string): number | null {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

test('K10: every blue in the shell belongs to one hue family', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await expect(page.locator('.fo-primary-nav')).toBeVisible({ timeout: 25000 });

  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const names = ['--fo-nav', '--fo-sidebar-header', '--fo-primary', '--fo-primary-hover', '--fo-link', '--fo-link-on-tint'];
    const out: Record<string, string> = {};
    for (const n of names) {
      const raw = cs.getPropertyValue(n).trim();
      const probe = document.createElement('span');
      probe.style.color = raw;
      document.body.appendChild(probe);
      out[n] = getComputedStyle(probe).color;
      probe.remove();
    }
    return out;
  });

  const hues: Record<string, number> = {};
  for (const [name, rgb] of Object.entries(tokens)) {
    const h = hueOf(rgb);
    expect(h, `${name} should be a chromatic colour`).not.toBeNull();
    hues[name] = h as number;
  }

  const values = Object.values(hues);
  const spread = Math.max(...values) - Math.min(...values);
  expect(
    spread,
    `the shell blues must sit in one hue family, within 8 degrees. Measured: ${JSON.stringify(
      Object.fromEntries(Object.entries(hues).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    )}`,
  ).toBeLessThanOrEqual(8);
});

test('K4: the quick search header is exactly the navbar colour', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates');
  const nav = page.locator('.fo-primary-nav');
  const header = page.locator('.fo-sidebar-panel-header').first();
  await expect(nav).toBeVisible({ timeout: 25000 });
  await expect(header).toBeVisible();
  const navBg = await nav.evaluate((el) => getComputedStyle(el).backgroundColor);
  const headerBg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(headerBg, 'the quick search header must match the navbar').toBe(navBg);
});
