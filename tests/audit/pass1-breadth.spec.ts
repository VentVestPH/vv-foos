import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn, waitForAnimations } from '../e2e/helpers';
import { ROUTES, VIEWPORTS, resolveIds, resolvePath } from './routes';

const CORPUS = join(process.cwd(), '..', 'audit', 'corpus');

interface Entry {
  screen: string;
  area: string;
  state: string;
  viewport: string;
  path: string;
  file: string;
  scrollHeight: number;
  viewportHeight: number;
  screens: number;
  error: string | null;
}

test('pass 1: breadth, every route at both viewports', async ({ page }) => {
  const ids = await resolveIds();
  const manifest: Entry[] = [];
  const problems: string[] = [];

  mkdirSync(CORPUS, { recursive: true });
  await signIn(page, PERSONA_EMAILS.admin);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of ROUTES) {
      const path = resolvePath(route, ids);
      if (path === null) {
        problems.push(`${route.id}: no ${route.needs} row exists to render it`);
        continue;
      }
      const file = `pass1/${route.id}.${viewport.name}.png`;
      mkdirSync(join(CORPUS, 'pass1'), { recursive: true });

      let error: string | null = null;
      const pageErrors: string[] = [];
      const onError = (e: Error) => pageErrors.push(e.message);
      page.on('pageerror', onError);
      try {
        await gotoAsSignedIn(page, path);
        await page.waitForTimeout(1200);
        await waitForAnimations(page);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      page.off('pageerror', onError);

      const metrics = await page.evaluate(() => {
        const scroller = document.querySelector('.shell-content');
        const el = scroller instanceof HTMLElement ? scroller : document.documentElement;
        return {
          scrollHeight: el.scrollHeight,
          viewportHeight: el.clientHeight,
          boundary: document.querySelectorAll('[role="alert"].error-boundary').length,
        };
      });

      await page.evaluate(() => {
        const scroller = document.querySelector('.shell-content');
        if (scroller instanceof HTMLElement) {
          scroller.style.overflow = 'visible';
          scroller.style.height = 'auto';
        }
        for (const sel of ['.shell', '.fo-body', '.shell-main']) {
          const node = document.querySelector(sel);
          if (node instanceof HTMLElement) {
            node.style.height = 'auto';
            node.style.minHeight = '0';
          }
        }
        document.documentElement.style.height = 'auto';
        document.body.style.height = 'auto';
      });
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(CORPUS, file), fullPage: true });

      if (metrics.boundary > 0) problems.push(`${route.id} ${viewport.name}: renders an error boundary`);
      if (pageErrors.length > 0) problems.push(`${route.id} ${viewport.name}: ${pageErrors[0]}`);

      manifest.push({
        screen: route.id,
        area: route.area,
        state: 'default',
        viewport: viewport.name,
        path,
        file,
        scrollHeight: metrics.scrollHeight,
        viewportHeight: metrics.viewportHeight,
        screens: Number((metrics.scrollHeight / metrics.viewportHeight).toFixed(2)),
        error: error ?? (pageErrors[0] ?? null),
      });
    }
  }

  writeFileSync(join(CORPUS, 'manifest-pass1.json'), JSON.stringify(manifest, null, 2));

  const tall = [...manifest]
    .filter((m) => m.viewport === 'desktop')
    .sort((a, b) => b.screens - a.screens)
    .slice(0, 10);

  console.log(`PASS1 captured=${manifest.length} problems=${problems.length}`);
  for (const p of problems) console.log(`PASS1 PROBLEM ${p}`);
  console.log('PASS1 tallest desktop screens, by how many viewports they occupy:');
  for (const t of tall) {
    console.log(`PASS1 HEIGHT ${t.screen} ${t.scrollHeight}px = ${t.screens} screens`);
  }
});
