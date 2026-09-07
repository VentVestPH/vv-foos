import { test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

test('candidate record: capture every failing request', async ({ page }) => {
  test.setTimeout(120000);
  const failures: string[] = [];
  const bodies: string[] = [];

  page.on('response', (res) => {
    if (res.status() >= 400) {
      failures.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      void res
        .text()
        .then((t) => bodies.push(`${res.status()} :: ${t.slice(0, 400)}`))
        .catch(() => undefined);
    }
  });

  const ids = await resolveIds();
  const route = ROUTES.find((r) => r.id === 'recruit-candidate-record');
  if (route === undefined) throw new Error('route recruit-candidate-record not found');
  const path = resolvePath(route, ids);
  if (path === null) throw new Error('could not resolve the candidate record path');

  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, path);
  await page.waitForTimeout(6000);

  console.log(`FAILCOUNT ${failures.length} on ${path}`);
  for (const f of failures) console.log(`FAIL ${f}`);
  for (const b of bodies) console.log(`BODY ${b}`);
});
