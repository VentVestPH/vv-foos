import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';

export const OUT = join(process.cwd(), '..', 'audit', '2026-09-08');
export const DESKTOP = { width: 1440, height: 900 };

export const DESTRUCTIVE =
  /delete|remove|purge|erase|merge|archive|deactivate|send|invite|sign out|logout|log out/i;

export const MUTATING =
  /^\d+ stars?\b|\bstars? for\b|grade comment|^complete$|^dismiss$|^shortlist$|^flag$|^applied$|^save\b|^submit$|^go!$|^approve|^reject|^convert|^promote|^advance(?!d)|^hire\b|^publish|^assign|^set /i;

export const STAGE_BUTTON = /^(lead|qualified|proposal|negotiation|won|lost|received|screening|client_interview|offer|hired|rejected|withdrawn)\b/i;

export function repeatKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bfor\s+.*$/, 'for a record')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

export const REPEAT_CAP = 2;

export const BLOCKING = /^print\b|\bprint\b/i;

export function skipReason(name: string): string | null {
  if (BLOCKING.test(name))
    return 'NOT PRESSED, it can reach window.print(), which blocks a headless renderer indefinitely';
  if (DESTRUCTIVE.test(name)) return 'NOT PRESSED, destructive';
  if (MUTATING.test(name)) return 'NOT PRESSED, writes to the database';
  if (STAGE_BUTTON.test(name)) return 'NOT PRESSED, moves a record between stages';
  return null;
}

export interface ActedRow {
  name: string;
  selector: string;
  kind: string;
  outcome: string;
  image: string | null;
}

export interface RouteReport {
  role: string;
  route: string;
  path: string;
  pageHeight: number;
  viewportHeight: number;
  folds: number;
  interactiveFound: number;
  interactiveActed: number;
  skippedDestructive: string[];
  sectionGaps: number[];
  acted: ActedRow[];
  notes: string[];
}

export function dir(...parts: string[]): string {
  const d = join(OUT, ...parts);
  mkdirSync(d, { recursive: true });
  return d;
}

export function writeReport(role: string, route: string, report: RouteReport): void {
  const d = dir('measurements', role);
  writeFileSync(join(d, `${route}.json`), JSON.stringify(report, null, 2));
}

export async function settle(page: Page, capMs = 12000): Promise<boolean> {
  const read = () =>
    raceTimeout(
      page.evaluate(() => {
        const de = document.documentElement;
        const spinners = document.querySelectorAll('.spinner, [aria-busy="true"]').length;
        return `${de.scrollHeight}x${de.clientWidth}x${spinners}`;
      }),
      10000,
      'settle',
    );
  const deadline = Date.now() + capMs;
  let previous = await read();
  let stable = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(150);
    const current = await read();
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    if (stable >= 3) return true;
  }
  return false;
}

const FIND_SCROLLER = `(() => {
  const de = document.documentElement;
  if (de.scrollHeight - de.clientHeight > 8) {
    return { kind: 'document', scrollHeight: de.scrollHeight, clientHeight: de.clientHeight };
  }
  const candidates = [...document.querySelectorAll('main, div, section')].filter((n) => {
    const e = n;
    const cs = getComputedStyle(e);
    return /auto|scroll/.test(cs.overflowY) && e.scrollHeight - e.clientHeight > 8;
  });
  candidates.sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight));
  const best = candidates[0];
  if (!best) return { kind: 'document', scrollHeight: de.scrollHeight, clientHeight: de.clientHeight };
  best.setAttribute('data-sweep-scroller', 'true');
  return {
    kind: 'element',
    selector: '[data-sweep-scroller="true"]',
    tag: best.tagName.toLowerCase(),
    cls: typeof best.className === 'string' ? best.className : '',
    scrollHeight: best.scrollHeight,
    clientHeight: best.clientHeight,
  };
})()`;

export interface Scroller {
  kind: 'document' | 'element';
  selector?: string;
  tag?: string;
  cls?: string;
  scrollHeight: number;
  clientHeight: number;
}

export async function findScroller(page: Page): Promise<Scroller> {
  return raceTimeout(page.evaluate(FIND_SCROLLER) as Promise<Scroller>, 10000, 'findScroller');
}

export async function pageHeight(page: Page): Promise<number> {
  return (await findScroller(page)).scrollHeight;
}

export const TALL_VIEWPORT_CAP = 9000;

export async function shootTallViewport(page: Page, path: string): Promise<{ viewport: number; content: number }> {
  let needed = DESKTOP.height;
  let content = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const s = await findScroller(page);
    content = s.scrollHeight;
    const chrome = needed - s.clientHeight;
    const want = Math.min(TALL_VIEWPORT_CAP, Math.max(DESKTOP.height, content + chrome + 8));
    if (want <= needed && content <= s.clientHeight) break;
    if (want === needed) break;
    needed = want;
    await page.setViewportSize({ width: DESKTOP.width, height: needed });
    await page.waitForTimeout(340);
  }
  const final = await findScroller(page);
  const hidden = Math.max(0, final.scrollHeight - final.clientHeight);
  await page.screenshot({ path, animations: 'disabled' });
  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(200);
  if (hidden > 8) console.log(`TALLWARN ${path} still hides ${hidden}px at window ${needed}`);
  return { viewport: needed, content: final.scrollHeight };
}

export async function shootFullPage(page: Page, path: string): Promise<void> {
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
}

export async function shootFolds(page: Page, outDir: string, prefix: string): Promise<number> {
  const scroller = await findScroller(page);
  const step = Math.max(200, scroller.clientHeight - 24);
  let index = 0;
  let previousTop = -1;
  for (;;) {
    const top = await raceTimeout(
      page.evaluate(
        ({ sel, y }) => {
          const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
          if (el) {
            el.scrollTop = y;
            return Math.round(el.scrollTop);
          }
          window.scrollTo(0, y);
          return Math.round(window.scrollY);
        },
        { sel: scroller.kind === 'element' ? scroller.selector : null, y: index * step },
      ),
      10000,
      'scroll to fold',
    );
    await page.waitForTimeout(240);
    if (index > 0 && top === previousTop) break;
    previousTop = top;
    index += 1;
    const n = String(index + 1).padStart(2, '0');
    await page.screenshot({
      path: join(outDir, `${n}-${prefix}fold-${index}.png`),
      animations: 'disabled',
    });
    const atBottom = await raceTimeout(
      page.evaluate(
        (sel) => {
          const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
          if (el) return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
          return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        },
        scroller.kind === 'element' ? (scroller.selector ?? null) : null,
      ),
      10000,
      'at bottom test',
    );
    if (atBottom || index > 40) break;
  }
  await raceTimeout(
    page.evaluate(
      (sel) => {
        const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
        if (el) el.scrollTop = 0;
        else window.scrollTo(0, 0);
      },
      scroller.kind === 'element' ? (scroller.selector ?? null) : null,
    ),
    10000,
    'scroll back to top',
  );
  return index;
}

export function slug(text: string, fallback: string): string {
  const s = (text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 46);
  return s || fallback;
}

export async function accessibleName(el: Locator): Promise<string> {
  return raceTimeout(
    el.evaluate((node) => {
    const e = node as HTMLElement;
    const text =
      e.getAttribute('aria-label') ||
      e.getAttribute('title') ||
      (e.innerText || '').trim() ||
      e.getAttribute('name') ||
      e.tagName.toLowerCase();
      return text.slice(0, 60);
    }),
    10000,
    'accessibleName',
  );
}

export interface SectionGap {
  gap: number;
  above: string;
  below: string;
  overlapPx: number;
}

export async function sectionGaps(page: Page): Promise<number[]> {
  return (await sectionGapDetail(page)).map((g) => g.gap);
}

export async function sectionGapDetail(page: Page): Promise<SectionGap[]> {
  return raceTimeout(
    page.evaluate(() => {
      const label = (el: Element) => {
        const e = el as HTMLElement;
        const cls = (e.className || '').split(/\s+/).filter(Boolean)[0] ?? e.tagName.toLowerCase();
        return `${e.tagName.toLowerCase()}.${cls}`;
      };
      const boxes = [
        ...document.querySelectorAll('.record-section, .list-page-toolbar, .table-wrap, .filter-rail, .kanban'),
      ]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter((b) => b.r.height > 0 && b.r.width > 0)
        .sort((a, b) => a.r.top - b.r.top);
      const out: { gap: number; above: string; below: string; overlapPx: number }[] = [];
      for (let i = 1; i < boxes.length; i += 1) {
        const prev = boxes[i - 1];
        const cur = boxes[i];
        if (!prev || !cur) continue;
        const overlap =
          Math.min(prev.r.right, cur.r.right) - Math.max(prev.r.left, cur.r.left);
        if (overlap <= 0) continue;
        out.push({
          gap: Math.round(cur.r.top - prev.r.bottom),
          above: label(prev.el),
          below: label(cur.el),
          overlapPx: Math.round(overlap),
        });
      }
      return out;
    }),
    10000,
    'sectionGaps',
  );
}

export type OverlayKind = 'dialog' | 'menu' | 'listbox' | 'panel' | null;

export interface PageState {
  kind: OverlayKind;
  fp: string;
  closing: number;
}

const READ_STATE = `(() => {
  const live = (sel) => [...document.querySelectorAll(sel)].filter((e) => {
    if (e.getAttribute('data-closing') === 'true' || e.closest('[data-closing="true"]')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  });
  let kind = null;
  if (live('[role="dialog"], .fo-placeholder-modal').length) kind = 'dialog';
  else if (live('.fo-drawer, .side-panel, .rq-overlay').length) kind = 'panel';
  else if (live('[role="menu"], .fo-utility-menu').length) kind = 'menu';
  else if (live('[role="listbox"]').length) kind = 'listbox';
  const de = document.documentElement;
  const main = document.querySelector('main.shell-content');
  const sidebar = document.querySelector('.fo-sidebar');
  const overlays = live('[role="dialog"], [role="menu"], [role="listbox"], .fo-drawer, .side-panel, .rq-overlay')
    .map((n) => n.outerHTML.length)
    .join(',');
  const closing = document.querySelectorAll('[data-closing="true"]').length;
  const fp = [
    location.pathname + location.search,
    de.scrollHeight,
    (main ? main.innerText : '').length,
    document.querySelectorAll('*').length,
    main ? Math.round(main.getBoundingClientRect().width) : 0,
    sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
    overlays,
  ].join('|');
  return { kind, fp, closing };
})()`;

export class RendererStalled extends Error {}

export async function raceTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new RendererStalled(`${what} did not answer within ${ms}ms; the renderer is blocked`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function readState(page: Page): Promise<PageState> {
  return raceTimeout(page.evaluate(READ_STATE) as Promise<PageState>, 10000, 'readState');
}

export async function settledState(page: Page, capMs = 2000): Promise<PageState> {
  const deadline = Date.now() + capMs;
  let previous = await readState(page);
  for (;;) {
    await page.waitForTimeout(120);
    const current = await readState(page);
    if (current.kind === previous.kind && current.fp === previous.fp && current.closing === 0) return current;
    previous = current;
    if (Date.now() > deadline) return current;
  }
}

export async function overlayKind(page: Page): Promise<OverlayKind> {
  return (await readState(page)).kind;
}

export async function overlayOpen(page: Page): Promise<boolean> {
  return (await overlayKind(page)) !== null;
}

export async function fingerprint(page: Page): Promise<string> {
  return (await readState(page)).fp;
}

export async function closeOverlay(page: Page, capMs = 3000): Promise<OverlayKind> {
  const deadline = Date.now() + capMs;
  let attempt = 0;
  for (;;) {
    const kind = await overlayKind(page);
    if (kind === null) return null;
    if (Date.now() > deadline) return kind;
    if (attempt % 2 === 0) await page.keyboard.press('Escape').catch(() => undefined);
    else await page.mouse.click(2, 2).catch(() => undefined);
    attempt += 1;
    await page.waitForTimeout(220);
  }
}

export interface PressResult {
  row: ActedRow;
  images: number;
  stuck: OverlayKind;
  reset: boolean;
}

export async function pressAndRecord(
  page: Page,
  el: Locator,
  name: string,
  kind: string,
  outDir: string,
  filePrefix: string,
  baseline: string,
  reset: () => Promise<void>,
): Promise<PressResult> {
  await closeOverlay(page);

  const disabled = await raceTimeout(
    el.evaluate((n) => {
      const e = n as HTMLElement;
      return (
        (e as HTMLButtonElement).disabled === true ||
        e.getAttribute('aria-disabled') === 'true' ||
        e.hasAttribute('disabled')
      );
    }),
    10000,
    'disabled check',
  ).catch((err) => {
    if (err instanceof RendererStalled) throw err;
    return false;
  });
  if (disabled) {
    const title = await el.getAttribute('title').catch(() => null);
    return {
      row: {
        name,
        selector: kind,
        kind,
        outcome: `NOT PRESSED, disabled${title ? `, and its title explains why: "${title}"` : ', with no title explaining why'}`,
        image: null,
      },
      images: 0,
      stuck: null,
      reset: false,
    };
  }

  const readEl = () =>
    raceTimeout(
      el.evaluate((n) => {
        const e = n as HTMLElement;
        return [
          e.getAttribute('aria-expanded') ?? '',
          e.getAttribute('aria-pressed') ?? '',
          e.getAttribute('aria-selected') ?? '',
          e.getAttribute('aria-current') ?? '',
          e.className,
        ].join('|');
      }),
      10000,
      'readEl',
    ).catch((err: unknown) => {
      if (err instanceof RendererStalled) throw err;
      return null;
    });

  const urlBefore = page.url();
  const before = await settledState(page, 1500);
  const elBefore = await readEl();

  let clickError: string | null = null;
  try {
    await el.click({ timeout: 4000 });
  } catch (err) {
    clickError = String(err).split('\n')[0]?.slice(0, 140) ?? 'click failed';
  }

  let after = clickError === null ? await settledState(page, 2500) : await readState(page);
  if (clickError === null && after.kind === null && after.closing > 0) {
    await page.waitForTimeout(450);
    after = await readState(page);
  }
  const urlAfter = page.url();
  const elAfter = await readEl();

  let outcome: string;
  let file: string | null = null;
  let images = 0;

  if (clickError !== null) {
    outcome = `NOT CLICKABLE, ${clickError}`;
  } else if (urlAfter !== urlBefore) {
    outcome = `navigated to ${urlAfter.replace(/^https?:\/\/[^/]+/, '')}`;
  } else if (after.kind !== null) {
    outcome = `${after.kind} opened`;
    file = `${filePrefix}${after.kind}-${slug(name, 'unnamed')}.png`;
    await shootFullPage(page, join(outDir, file));
    images += 1;
  } else if (after.fp !== before.fp) {
    outcome = `page changed, ${before.fp} to ${after.fp}${after.closing > 0 ? `, with ${after.closing} node(s) still mid-exit` : ''}`;
    file = `${filePrefix}pressed-${slug(name, 'unnamed')}.png`;
    await shootFullPage(page, join(outDir, file));
    images += 1;
  } else if (elAfter !== null && elBefore !== null && elAfter !== elBefore) {
    outcome = `the control's own state changed, ${elBefore} to ${elAfter}, with no change to the rest of the page`;
    file = `${filePrefix}toggled-${slug(name, 'unnamed')}.png`;
    await shootFullPage(page, join(outDir, file));
    images += 1;
  } else {
    const state = await el
      .evaluate((n) => {
        const e = n as HTMLElement;
        return {
          current: e.getAttribute('aria-current'),
          selected: e.getAttribute('aria-selected'),
          pressed: e.getAttribute('aria-pressed'),
          activeClass: /(^|\s)(active|is-active|is-current|selected)(\s|$)/.test(e.className || ''),
        };
      })
      .catch(() => ({ current: null, selected: null, pressed: null, activeClass: false }));
    if (state.current === 'page') {
      outcome = 'NOTHING HAPPENED, and correctly so: aria-current="page" says this is the route already on screen';
    } else if (state.selected === 'true' || state.pressed === 'true') {
      outcome = `NOTHING HAPPENED, and correctly so: ${state.selected === 'true' ? 'aria-selected' : 'aria-pressed'}="true" says this option is already the chosen one`;
    } else if (state.activeClass) {
      outcome =
        'NOTHING HAPPENED, and correctly so by its CSS class alone: the element carries an active class but no aria-selected, aria-pressed or aria-current, so nothing but the stylesheet knows it is the chosen one';
    } else {
      outcome = 'NOTHING HAPPENED';
    }
  }

  let stuck: OverlayKind = null;
  if (after.kind !== null) {
    stuck = await closeOverlay(page);
    if (stuck !== null) {
      outcome += `; the ${stuck} REFUSED TO CLOSE after Escape, a corner click and a second Escape`;
    }
  }

  let didReset = false;
  const settledFp = (await readState(page)).fp;
  if (urlAfter !== urlBefore || settledFp !== baseline) {
    await reset();
    didReset = true;
  }

  return { row: { name, selector: kind, kind, outcome, image: file }, images, stuck, reset: didReset };
}
