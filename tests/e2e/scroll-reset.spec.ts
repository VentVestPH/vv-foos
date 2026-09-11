import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
let requisition = '';
let seededPerson = '';

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const req = await admin
    .from('requisitions')
    .insert({ title: `Srreq${RUN}`, status: 'open', num_openings: 1, is_test: true })
    .select('id')
    .single();
  if (req.error) throw req.error;
  requisition = req.data.id;
  const person = await admin
    .from('people')
    .insert({ first_name: `Srfirst${RUN}`, last_name: `Srlast${RUN}`, is_test: true })
    .select('id')
    .single();
  if (person.error) throw person.error;
  seededPerson = person.data.id;
  const profile = await admin
    .from('candidate_profiles')
    .insert({ person_id: seededPerson, do_not_contact: false });
  if (profile.error) throw profile.error;
  const app = await admin
    .from('applications')
    .insert({ requisition_id: requisition, person_id: seededPerson, stage: 'screening' });
  if (app.error) throw app.error;
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('applications').delete().eq('requisition_id', requisition);
  await admin.from('candidate_profiles').delete().eq('person_id', seededPerson);
  await admin.from('people').delete().eq('id', seededPerson);
  const { error } = await admin.from('requisitions').delete().eq('id', requisition);
  if (error) throw new Error(`could not remove the scroll-reset fixture: ${error.message}`);
});

const SCROLLER = '#main-content';

async function scrollTo(page: import('@playwright/test').Page, top: number): Promise<void> {
  await page.locator(SCROLLER).evaluate((el, y) => {
    el.scrollTop = y;
  }, top);
}

async function offset(page: import('@playwright/test').Page): Promise<number> {
  return page.locator(SCROLLER).evaluate((el) => el.scrollTop);
}

test('S1: opening a record from a scrolled list lands at the top', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await page.waitForSelector('.table-wrap .link-btn');
  await scrollTo(page, 600);
  await expect.poll(() => offset(page), { timeout: 10000 }).toBeGreaterThan(100);

  await page.locator('.table-wrap .link-btn').first().click();
  await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
  await expect
    .poll(() => offset(page), {
      timeout: 15000,
      message:
        'the shell scrolls inside main, not the document, so the browser never resets it and a record opened from halfway down a list used to render halfway down',
    })
    .toBe(0);
});

test('S2: a candidate opened from the requisition kanban lands at the top', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/recruit/requisitions/${requisition}`);
  await page.waitForSelector('.record-section');

  const pipeline = page.locator('#application-pipeline, .record-section').filter({
    has: page.getByRole('button', { name: /^Application Pipeline/ }),
  });
  if ((await pipeline.getAttribute('data-open')) !== 'true') {
    await page.getByRole('button', { name: /^Application Pipeline/ }).click();
  }
  const kanban = page.getByRole('tab', { name: 'Kanban' });
  await expect(kanban).toBeVisible({ timeout: 15000 });
  await kanban.click();
  const card = page.locator('.kanban-card-name').first();
  await expect(card, 'the seeded requisition carries one application').toBeVisible({ timeout: 15000 });
  await scrollTo(page, 500);
  await card.click();
  await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
  await expect.poll(() => offset(page), { timeout: 15000 }).toBe(0);
});

test('S3: a hash link is left alone, so in-page anchors still work', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await page.waitForSelector('.table-wrap .link-btn');
  await page.locator('.table-wrap .link-btn').first().click();
  await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
  await page.waitForSelector('.record-section');

  await scrollTo(page, 400);
  await expect.poll(() => offset(page), { timeout: 10000 }).toBeGreaterThan(100);
  await page.evaluate(() => {
    window.history.pushState({}, '', `${window.location.pathname}#candidate-information`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect
    .poll(() => offset(page), {
      timeout: 5000,
      message: 'a hash navigation is a jump within the page, so the reset must not fight it',
    })
    .toBeGreaterThan(100);
});
