import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, VIEWPORTS, resolveIds, resolvePath } from './routes';
import { CORPUS, guardWrites, settle } from './capture';

interface ControlMetric {
  screen: string;
  viewport: string;
  kind: string;
  variant: string;
  name: string;
  height: number;
  width: number;
  fontSize: string;
  lineHeight: string;
  paddingTop: string;
  paddingBottom: string;
  borderTop: string;
  boxSizing: string;
  resize: string;
  cursor: string;
  outlineColor: string;
  disabled: boolean;
  ariaDisabled: boolean;
  ringBackdrop: string;
  ringBackdropFrom: string;
  container: string;
  x: number;
  y: number;
}

interface StructureMetric {
  screen: string;
  viewport: string;
  headings: { level: number; text: string }[];
  skippedLevels: number[];
  landmarks: string[];
  h1Count: number;
  tabOrderInversions: { name: string; domIndex: number; visualIndex: number }[];
  focusableCount: number;
  positiveTabindex: number;
  autofocus: number;
}

interface DensityMetric {
  screen: string;
  viewport: string;
  scrollHeight: number;
  clientHeight: number;
  screens: number;
  emptyPx: number;
  emptyShare: number;
  largestGapPx: number;
  largestGapAfter: string;
  labelToControl: number[];
  controlToControl: number[];
  rowHeight: number | null;
  rowControlHeight: number | null;
}

test('measure: control geometry and density', async ({ page }) => {
  test.setTimeout(0);
  const ids = await resolveIds();
  const controls: ControlMetric[] = [];
  const density: DensityMetric[] = [];
  const structure: StructureMetric[] = [];

  await signIn(page, PERSONA_EMAILS.admin);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of ROUTES) {
      const path = resolvePath(route, ids);
      if (path === null) continue;
      await guardWrites(page, route.id);
      await gotoAsSignedIn(page, path);
      await settle(page, 900);
      try {
        await page.waitForLoadState('networkidle', { timeout: 6000 });
      } catch {
        void 0;
      }
      await settle(page, 1200);
      const settledHeight = async () =>
        page.evaluate(() => (document.querySelector('.shell-content') ?? document.documentElement).scrollHeight);
      let h1 = await settledHeight();
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await page.waitForTimeout(700);
        const h2 = await settledHeight();
        if (h2 === h1) break;
        h1 = h2;
      }

      const measured = await page.evaluate(() => {
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };

        const accessibleName = (e: HTMLElement): string => {
          const byIds = e.getAttribute('aria-labelledby');
          if (byIds !== null) {
            const text = byIds
              .split(/\s+/)
              .map((id) => document.getElementById(id))
              .filter((n): n is HTMLElement => n !== null)
              .map((n) => (n.innerText || '').trim())
              .join(' ')
              .trim();
            if (text !== '') return text;
          }
          const label = e.getAttribute('aria-label');
          if (label !== null && label.trim() !== '') return label.trim();
          const input = e as HTMLInputElement;
          if (input.labels !== undefined && input.labels !== null && input.labels.length > 0) {
            const text = (input.labels[0].innerText || '').trim();
            if (text !== '') return text;
          }
          const own = (e.innerText || '').trim().split('\n')[0];
          if (own !== undefined && own !== '') return own;
          const title = e.getAttribute('title');
          if (title !== null && title.trim() !== '') return `${title.trim()} (from title only)`;
          const placeholder = e.getAttribute('placeholder');
          if (placeholder !== null && placeholder.trim() !== '') return `${placeholder.trim()} (from placeholder only)`;
          return '';
        };

        const paintedBehind = (el: HTMLElement) => {
          let node: HTMLElement | null = el.parentElement;
          while (node !== null) {
            const bg = getComputedStyle(node).backgroundColor;
            if (bg !== '' && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) {
              return {
                color: bg,
                from: (node.className?.toString() ?? '').split(/\s+/)[0] || node.tagName.toLowerCase(),
              };
            }
            node = node.parentElement;
          }
          return { color: 'rgb(255, 255, 255)', from: 'nothing painted, so the canvas' };
        };

        const describe = (el: Element, kind: string) => {
          const e = el as HTMLElement;
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          const cls = e.className?.toString() ?? '';
          const variant =
            cls
              .split(/\s+/)
              .filter((c) => /^(btn|fo|input|field)/.test(c))
              .slice(0, 3)
              .join(' ') || kind;
          let container = 'page';
          if (e.closest('.fo-pager')) container = 'pager';
          else if (e.closest('thead')) container = 'table-head';
          else if (e.closest('tbody')) container = 'table-row';
          else if (e.closest('.list-page-toolbar')) container = 'toolbar';
          else if (e.closest('.fo-filter-rail, .fo-advanced-search')) container = 'filter-rail';
          else if (e.closest('.record-section')) container = 'record-section';
          else if (e.closest('.fo-utility-header, .fo-primary-nav-wrap')) container = 'shell-header';
          else if (e.closest('.fo-sidebar')) container = 'sidebar';
          else if (e.closest('[role="dialog"]')) container = 'dialog';
          const backdrop = paintedBehind(e);
          return {
            kind,
            variant,
            name: accessibleName(e).slice(0, 40),
            height: Math.round(r.height * 100) / 100,
            width: Math.round(r.width),
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            paddingTop: cs.paddingTop,
            paddingBottom: cs.paddingBottom,
            borderTop: cs.borderTopWidth,
            boxSizing: cs.boxSizing,
            resize: cs.resize,
            cursor: cs.cursor,
            outlineColor: cs.outlineColor,
            disabled: (e as HTMLButtonElement).disabled === true,
            ariaDisabled: e.getAttribute('aria-disabled') === 'true',
            ringBackdrop: backdrop.color,
            ringBackdropFrom: backdrop.from,
            container,
            x: Math.round(r.x),
            y: Math.round(r.y),
          };
        };

        const out: ReturnType<typeof describe>[] = [];
        const groups: [string, string][] = [
          ['button', 'button'],
          ['select', 'select'],
          ['textarea', 'textarea'],
          ['input[type="text"], input:not([type])', 'input-text'],
          ['input[type="search"]', 'input-search'],
          ['input[type="date"]', 'input-date'],
          ['input[type="datetime-local"]', 'input-datetime'],
          ['input[type="number"]', 'input-number'],
          ['input[type="email"]', 'input-email'],
          ['input[type="checkbox"]', 'input-checkbox'],
          ['input[type="radio"]', 'input-radio'],
          ['input[type="file"]', 'input-file'],
          ['.badge', 'badge'],
          ['.link-btn', 'link-btn'],
          ['a.btn, .btn', 'btn-class'],
        ];
        for (const [sel, kind] of groups) {
          for (const el of Array.from(document.querySelectorAll(sel))) {
            if (!visible(el)) continue;
            out.push(describe(el, kind));
          }
        }

        const scroller = document.querySelector('.shell-content') as HTMLElement | null;
        const root = scroller ?? document.documentElement;

        const blocks = Array.from(root.querySelectorAll('*')).filter((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.height < 4 || r.width < 8) return false;
          if (cs.visibility === 'hidden' || cs.display === 'none') return false;
          const tag = el.tagName.toLowerCase();
          const atomic = tag === 'img' || tag === 'svg' || tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'hr';
          if (atomic) return true;
          if (el.children.length > 0) return false;
          return (el as HTMLElement).innerText !== undefined && (el as HTMLElement).innerText.trim().length > 0;
        });
        const spans = blocks
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, tag: el.tagName + '.' + (el.className?.toString().split(' ')[0] ?? '') };
          })
          .sort((a, b) => a.top - b.top);

        let covered = 0;
        let cursor = -Infinity;
        let largestGap = 0;
        let largestGapAfter = '';
        let prevTag = 'start';
        for (const s of spans) {
          if (s.top > cursor) {
            const gap = s.top - (cursor === -Infinity ? s.top : cursor);
            if (gap > largestGap) {
              largestGap = gap;
              largestGapAfter = prevTag;
            }
            covered += s.bottom - s.top;
            cursor = s.bottom;
          } else if (s.bottom > cursor) {
            covered += s.bottom - cursor;
            cursor = s.bottom;
          }
          prevTag = s.tag;
        }

        const labelGaps: number[] = [];
        for (const label of Array.from(document.querySelectorAll('label'))) {
          const control =
            label.parentElement?.querySelector('input, select, textarea') ??
            document.getElementById(label.getAttribute('for') ?? '');
          if (control === null || !visible(label) || !visible(control)) continue;
          const lr = label.getBoundingClientRect();
          const cr = control.getBoundingClientRect();
          if (cr.top >= lr.bottom) labelGaps.push(Math.round(cr.top - lr.bottom));
        }

        const fieldGaps: number[] = [];
        const fields = Array.from(document.querySelectorAll('.field')).filter(visible);
        for (let i = 1; i < fields.length; i += 1) {
          const a = fields[i - 1].getBoundingClientRect();
          const b = fields[i].getBoundingClientRect();
          if (b.top >= a.bottom && Math.abs(b.x - a.x) < 4) fieldGaps.push(Math.round(b.top - a.bottom));
        }

        const firstRow = document.querySelector('tbody tr:not(:has(td[colspan]))');
        const rowHeight = firstRow ? Math.round(firstRow.getBoundingClientRect().height) : null;
        const rowControl = firstRow?.querySelector('button, input, select, .link-btn');
        const rowControlHeight = rowControl ? Math.round(rowControl.getBoundingClientRect().height) : null;

        return {
          controls: out,
          scrollHeight: root.scrollHeight,
          clientHeight: root.clientHeight,
          coveredPx: Math.round(covered),
          largestGapPx: Math.round(largestGap),
          largestGapAfter,
          labelGaps,
          fieldGaps,
          rowHeight,
          rowControlHeight,
        };
      });

      for (const c of measured.controls) {
        controls.push({ screen: route.id, viewport: viewport.name, ...c });
      }
      const empty = Math.max(0, measured.scrollHeight - measured.coveredPx);
      const struct = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) => ({
          level: Number(h.tagName.slice(1)),
          text: ((h as HTMLElement).innerText || '').trim().slice(0, 60),
        }));
        const skipped: number[] = [];
        for (let i = 1; i < headings.length; i += 1) {
          if (headings[i].level - headings[i - 1].level > 1) skipped.push(headings[i].level);
        }
        const landmarks = Array.from(
          document.querySelectorAll('main, nav, aside, header, footer, [role="main"], [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"], [role="search"]'),
        ).map((n) => n.tagName.toLowerCase() + (n.getAttribute('role') !== null ? `[role=${n.getAttribute('role')}]` : ''));

        const focusables = Array.from(
          document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]'),
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
        }) as HTMLElement[];

        const withPos = focusables.map((el, domIndex) => {
          const r = el.getBoundingClientRect();
          return {
            el,
            domIndex,
            top: Math.round(r.top / 8),
            left: Math.round(r.left),
            name: (
              el.getAttribute('aria-label') ??
              ((el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0
                ? ((el as HTMLInputElement).labels![0].innerText || '').trim()
                : '') ??
              ''
            ).slice(0, 34) || ((el.innerText || '').trim().split('\n')[0] || el.tagName.toLowerCase()).slice(0, 34),
          };
        });
        const visual = [...withPos].sort((a, b) => (a.top !== b.top ? a.top - b.top : a.left - b.left));
        const visualIndexOf = new Map<HTMLElement, number>();
        visual.forEach((v, i) => visualIndexOf.set(v.el, i));
        const inversions = withPos
          .filter((v) => Math.abs((visualIndexOf.get(v.el) ?? 0) - v.domIndex) > 2)
          .map((v) => ({ name: v.name, domIndex: v.domIndex, visualIndex: visualIndexOf.get(v.el) ?? -1 }));

        return {
          headings,
          skippedLevels: skipped,
          landmarks,
          h1Count: headings.filter((h) => h.level === 1).length,
          tabOrderInversions: inversions,
          focusableCount: focusables.length,
          positiveTabindex: focusables.filter((el) => Number(el.getAttribute('tabindex') ?? '0') > 0).length,
          autofocus: document.querySelectorAll('[autofocus]').length,
        };
      });
      structure.push({ screen: route.id, viewport: viewport.name, ...struct });

      density.push({
        screen: route.id,
        viewport: viewport.name,
        scrollHeight: measured.scrollHeight,
        clientHeight: measured.clientHeight,
        screens: Number((measured.scrollHeight / Math.max(1, measured.clientHeight)).toFixed(2)),
        emptyPx: empty,
        emptyShare: Number((empty / Math.max(1, measured.scrollHeight)).toFixed(3)),
        largestGapPx: measured.largestGapPx,
        largestGapAfter: measured.largestGapAfter,
        labelToControl: measured.labelGaps,
        controlToControl: measured.fieldGaps,
        rowHeight: measured.rowHeight,
        rowControlHeight: measured.rowControlHeight,
      });

      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  }

  mkdirSync(CORPUS, { recursive: true });
  writeFileSync(join(CORPUS, 'measure-controls.json'), JSON.stringify(controls, null, 2));
  writeFileSync(join(CORPUS, 'measure-density.json'), JSON.stringify(density, null, 2));
  writeFileSync(join(CORPUS, 'measure-structure.json'), JSON.stringify(structure, null, 2));

  const heights = new Map<string, Set<number>>();
  for (const c of controls) {
    if (c.viewport !== 'desktop') continue;
    const key = c.kind;
    if (!heights.has(key)) heights.set(key, new Set());
    heights.get(key)!.add(Math.round(c.height));
  }
  const badResize = controls.filter((c) => c.kind === 'textarea' && c.resize !== 'vertical' && c.resize !== 'none');
  const badCursor = controls.filter(
    (c) => (c.kind === 'button' || c.kind === 'link-btn' || c.kind === 'btn-class') && c.cursor !== 'pointer' && c.cursor !== 'default',
  );
  console.log(`MEASURE controls=${controls.length} screens=${density.length}`);
  console.log(`MEASURE textareas resizable horizontally: ${badResize.length} of ${controls.filter((c) => c.kind === 'textarea').length}`);
  for (const c of badResize.slice(0, 12)) console.log(`MEASURE RESIZE ${c.screen} ${c.viewport} "${c.name}" resize=${c.resize}`);
  console.log(`MEASURE buttons without cursor pointer: ${badCursor.length}`);
  for (const c of [...new Map(badCursor.map((c) => [c.screen + c.name + c.cursor, c])).values()].slice(0, 12)) {
    console.log(`MEASURE CURSOR ${c.screen} ${c.viewport} "${c.name}" cursor=${c.cursor}`);
  }
  for (const [kind, set] of [...heights.entries()].sort()) {
    console.log(`MEASURE HEIGHTS ${kind}: ${[...set].sort((a, b) => a - b).join(', ')}`);
  }
});
