import { test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

const SUFFIX = 'VentVest Front Office OS';

test('document titles: which routes set one', async ({ page }) => {
  test.setTimeout(0);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/login');
  await page.waitForTimeout(700);
  const loginTitle = await page.title();
  console.log(`TITLE ${'login'.padEnd(30)} ${JSON.stringify(loginTitle)}`);

  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  let bare = 0;
  let named = 0;
  for (const route of ROUTES) {
    const path = resolvePath(route, ids);
    if (path === null) continue;
    await gotoAsSignedIn(page, path);
    await page.waitForTimeout(650);
    const title = await page.title();
    const isBare = title.trim() === SUFFIX || title.trim() === '';
    if (isBare) bare += 1;
    else named += 1;
    console.log(`TITLE ${route.id.padEnd(30)} ${isBare ? 'BARE ' : 'named'} ${JSON.stringify(title)}`);
  }
  console.log(`TITLES named=${named} bare=${bare}`);
});
