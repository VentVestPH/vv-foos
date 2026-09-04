import { type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitForAnimations } from '../e2e/helpers';

export const CORPUS = join(process.cwd(), '..', 'audit', 'corpus');

export interface Shot {
  screen: string;
  viewport: string;
  component: string;
  kind: string;
  state: string;
  name: string;
  file: string;
  width: number;
  height: number;
  note: string;
}

export const shots: Shot[] = [];
export const notes: string[] = [];
export const blockedWrites: string[] = [];

let counter = 0;

function slug(value: string): string {
  return value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

const AREA_TAG = process.env.FOOS_AUDIT_AREA ?? 'all';

export function manifestPath(): string {
  return join(CORPUS, `manifest.${AREA_TAG}.json`);
}

export function flush(): void {
  mkdirSync(CORPUS, { recursive: true });
  writeFileSync(manifestPath(), JSON.stringify(shots, null, 2));
  writeFileSync(join(CORPUS, `notes.${AREA_TAG}.txt`), notes.join('\n'));
  writeFileSync(join(CORPUS, `blocked-writes.${AREA_TAG}.txt`), [...new Set(blockedWrites)].join('\n'));
}

export function note(line: string): void {
  notes.push(line);
  mkdirSync(CORPUS, { recursive: true });
  appendFileSync(join(CORPUS, 'notes.live.txt'), line + '\n');
}

export async function guardWrites(page: Page, screen: string): Promise<void> {
  const handler = async (route: import('@playwright/test').Route) => {
    const method = route.request().method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await route.continue();
      return;
    }
    const url = route.request().url();
    const tail = url.includes('/rest/v1/')
      ? url.split('/rest/v1/')[1]?.split('?')[0]
      : url.split('/functions/v1/')[1]?.split('?')[0];
    blockedWrites.push(`${screen}: ${method} ${tail ?? url}`);
    await route.abort();
  };
  await page.route('**/rest/v1/**', handler);
  await page.route('**/functions/v1/**', handler);
  await page.route('**/auth/v1/logout**', (r) => r.abort());
}

export async function shootScreen(
  page: Page,
  screen: string,
  viewport: string,
  state: string,
  note_ = '',
): Promise<void> {
  counter += 1;
  const file = `${screen}/${viewport}/screen.${slug(state)}.${counter}.png`;
  mkdirSync(join(CORPUS, screen, viewport), { recursive: true });
  await page.screenshot({ path: join(CORPUS, file) });
  shots.push({
    screen,
    viewport,
    component: 'screen',
    kind: 'screen',
    state,
    name: screen,
    file,
    width: 0,
    height: 0,
    note: note_,
  });
}

export async function shootElement(
  page: Page,
  locator: Locator,
  screen: string,
  viewport: string,
  component: string,
  kind: string,
  state: string,
  name: string,
  note_ = '',
): Promise<boolean> {
  counter += 1;
  const file = `${screen}/${viewport}/${slug(kind)}.${slug(name || component)}.${slug(state)}.${counter}.png`;
  mkdirSync(join(CORPUS, screen, viewport), { recursive: true });
  try {
    const box = await locator.boundingBox({ timeout: 2000 });
    if (box === null || box.width < 2 || box.height < 2) {
      note(`${screen} ${viewport}: ${kind} "${name}" has no box in state ${state}`);
      return false;
    }
    const pad = 6;
    await page.screenshot({
      path: join(CORPUS, file),
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: Math.min(box.width + pad * 2, page.viewportSize()?.width ?? 1440),
        height: box.height + pad * 2,
      },
    });
    shots.push({
      screen,
      viewport,
      component,
      kind,
      state,
      name,
      file,
      width: Math.round(box.width),
      height: Math.round(box.height),
      note: note_,
    });
    return true;
  } catch (e) {
    note(`${screen} ${viewport}: ${kind} "${name}" could not be captured in ${state}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    return false;
  }
}

export async function settle(page: Page, ms = 250): Promise<void> {
  await page.waitForTimeout(ms);
  await waitForAnimations(page, 1500);
}

export async function overlayFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll(
      '[role="dialog"], [role="menu"], [role="listbox"], [role="alertdialog"], dialog[open], .fo-placeholder-modal, .fo-placeholder-overlay, .fo-utility-menu, .fo-sidebar-panel, .filter-rail, .rq-dialog, .intake-drawer-overlay, .intake-inline-panel, .intake-reject-panel, .dash-widgets-panel, .panel-form, .fo-toast, .toast',
    );
    return Array.from(nodes)
      .map((n) => `${n.className}:${(n as HTMLElement).innerText?.slice(0, 40) ?? ''}`)
      .join('|');
  });
}
