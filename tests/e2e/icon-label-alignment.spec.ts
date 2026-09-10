import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test('K6: every icon is vertically centred on its label', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  const offenders: string[] = [];
  for (const path of ['/', '/recruit/candidates', '/recruit/requisitions', '/sales/deals', '/settings']) {
    await gotoAsSignedIn(page, path);
    await page.waitForTimeout(1200);
    const rows = await page.evaluate(() => {
      const out: { host: string; delta: number; icon: number; label: string }[] = [];
      const hosts = Array.from(
        document.querySelectorAll('button, a, label, .fo-page-header, .record-section-header, .fo-recent-item, .fo-nav-tab, h1, h2, h3'),
      );
      for (const host of hosts) {
        const svg = host.querySelector('svg');
        if (!svg) continue;
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        let textNode: Text | null = null;
        while (node) {
          if ((node.nodeValue ?? '').trim().length > 1) { textNode = node as Text; break; }
          node = walker.nextNode();
        }
        if (!textNode) continue;
        const stacked = host.querySelector('.fo-recent-text');
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const tr = stacked === null
          ? range.getBoundingClientRect()
          : stacked.getBoundingClientRect();
        const ir = svg.getBoundingClientRect();
        if (ir.height === 0 || tr.height === 0) continue;
        const delta = Math.round((ir.top + ir.height / 2) - (tr.top + tr.height / 2));
        if (Math.abs(delta) >= 2) {
          out.push({
            host: `${host.tagName.toLowerCase()}.${(host.className || '').toString().slice(0, 34)}`,
            delta,
            icon: Math.round(ir.height),
            label: (textNode.nodeValue ?? '').trim().slice(0, 22),
          });
        }
      }
      const seen = new Set<string>();
      return out.filter((r) => {
        const k = `${r.host}|${r.delta}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    });
    const metrics = await page.evaluate(() => {
      const h1 = document.querySelector('.fo-page-header-title-row h1');
      const icon = document.querySelector('.fo-page-icon');
      const row = document.querySelector('.fo-page-header-title-row');
      if (!h1 || !icon || !row) return null;
      const cs = getComputedStyle(h1);
      return {
        h1FontSize: cs.fontSize,
        h1LineHeight: cs.lineHeight,
        h1Height: Math.round(h1.getBoundingClientRect().height),
        rowHeight: Math.round(row.getBoundingClientRect().height),
        iconHeight: Math.round(icon.getBoundingClientRect().height),
        iconMarginTop: getComputedStyle(icon).marginTop,
      };
    });
    void metrics;
    offenders.push(...rows.map((r) => `${path} ${r.host} icon=${r.icon}px off by ${r.delta}px next to "${r.label}"`));
  }
  expect(offenders, 'an icon and its label must share a vertical centre').toEqual([]);
});
