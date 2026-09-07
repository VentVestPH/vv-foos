import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';

function luminance(rgb: [number, number, number]) {
  const chan = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

function ratio(a: [number, number, number], b: [number, number, number]) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function parse(css: string): [number, number, number] | null {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  return m === null ? null : [Number(m[1]), Number(m[2]), Number(m[3])];
}

test('the focus ring reads on every ground a focusable control sits on', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/');
  await page.waitForTimeout(1800);

  const measured = await page.evaluate(() => {
    const out: { where: string; ring: string; halo: string; behind: string }[] = [];
    const targets: { where: string; sel: string }[] = [
      { where: 'primary nav tab', sel: 'nav[aria-label="Primary"] button' },
      { where: 'sidebar panel header', sel: '.fo-sidebar-panel-header button' },
      { where: 'page canvas button', sel: '.shell-content button' },
    ];
    const paintedBehind = (el: Element) => {
      let n: Element | null = el.parentElement;
      while (n !== null) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        n = n.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    for (const t of targets) {
      const el = document.querySelector<HTMLElement>(t.sel);
      if (el === null) continue;
      el.focus();
      const cs = getComputedStyle(el);
      out.push({
        where: t.where,
        ring: cs.outlineColor,
        halo: cs.boxShadow,
        behind: paintedBehind(el),
      });
    }
    return out;
  });

  let failures = 0;
  for (const m of measured) {
    const ring = parse(m.ring);
    const behind = parse(m.behind);
    const r = ring !== null && behind !== null ? ratio(ring, behind) : 0;
    const ok = r >= 3;
    if (!ok) failures += 1;
    console.log(
      `PROBE ${m.where.padEnd(22)} ring=${m.ring} behind=${m.behind} ratio=${r.toFixed(2)}:1 ${ok ? 'PASS' : 'FAIL'} halo=${m.halo.slice(0, 40)}`,
    );
  }
  expect(measured.length, 'at least one focusable target per ground').toBeGreaterThan(0);
  expect(failures, 'every measured ring must reach 3:1 against what is painted behind it').toBe(0);
});
