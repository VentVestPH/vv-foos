import { type Page, type Route } from '@playwright/test';
import { join } from 'node:path';
import { waitForAnimations } from '../support/e2e-helpers';

export const CORPUS = join(process.cwd(), '..', '.artifacts', 'audit', 'corpus');

const READ_ONLY_RPCS = new Set(['get_my_google_status', 'get_my_role']);

export async function guardWrites(page: Page): Promise<void> {
  const handler = async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await route.continue();
      return;
    }
    const url = route.request().url();
    const tail = url.includes('/rest/v1/')
      ? url.split('/rest/v1/')[1]?.split('?')[0]
      : url.split('/functions/v1/')[1]?.split('?')[0];
    if (tail !== undefined && tail.startsWith('rpc/') && READ_ONLY_RPCS.has(tail.slice(4))) {
      await route.continue();
      return;
    }
    await route.abort();
  };
  await page.route('**/rest/v1/**', handler);
  await page.route('**/functions/v1/**', handler);
  await page.route('**/auth/v1/logout**', (r) => r.abort());
}

export async function settle(page: Page, ms = 250): Promise<void> {
  await page.waitForTimeout(ms);
  await waitForAnimations(page, 1500);
}
