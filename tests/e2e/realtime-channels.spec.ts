import { test, expect, type Page } from '@playwright/test';
import { PERSONA_EMAILS, signIn } from './helpers';

const MAX_CHANNELS_PER_ROUTE = 3;

interface Watch {
  open: Set<string>;
  frames: number;
}

function watchChannels(page: Page): Watch {
  const watch: Watch = { open: new Set(), frames: 0 };
  page.on('websocket', (ws) => {
    if (!ws.url().includes('/realtime/')) return;
    ws.on('framesent', (frame) => {
      const payload = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString();
      let message: [string, string, string, string, unknown];
      try {
        message = JSON.parse(payload);
      } catch {
        return;
      }
      const [, , topic, event] = message;
      if (event === 'phx_join') watch.open.add(topic);
      else if (event === 'phx_leave') watch.open.delete(topic);
      else return;
      watch.frames += 1;
    });
  });
  return watch;
}

async function settleOn(page: Page, watch: Watch, path: string) {
  watch.open.clear();
  await page.goto(path);
  await page.waitForTimeout(4000);
  const settled = [...watch.open].sort();
  const framesAfterSettling = watch.frames;
  await page.waitForTimeout(6000);
  return { settled, rejoins: watch.frames - framesAfterSettling };
}

test.describe('O4 realtime channel budget', () => {
  test('every route settles on at most three channels and stops rejoining', async ({ page }) => {
    test.setTimeout(180000);
    const watch = watchChannels(page);
    await signIn(page, PERSONA_EMAILS.admin);

    for (const path of ['/', '/recruit/candidates', '/recruit/requisitions', '/sales/deals']) {
      const { settled, rejoins } = await settleOn(page, watch, path);
      expect(settled.length, `${path} holds ${settled.join(', ')}`).toBeLessThanOrEqual(
        MAX_CHANNELS_PER_ROUTE,
      );
      expect(rejoins, `${path} kept rejoining after settling`).toBe(0);
    }
  });

  test('the intake queue shares the badge subscription instead of opening a second one', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const watch = watchChannels(page);
    await signIn(page, PERSONA_EMAILS.admin);

    const { settled, rejoins } = await settleOn(page, watch, '/intake');
    expect(settled).toEqual(['realtime:intake-items']);
    expect(rejoins).toBe(0);
  });
});
