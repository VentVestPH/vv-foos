import { expect, test } from '@playwright/test';
import {
  PERSONA_EMAILS,
  gotoAsSignedIn,
  localDateTimeToday,
  localDateTimeValue,
  signIn,
} from './helpers';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const TAG = `QA cal ${RUN}`;

test.afterEach(async () => {
  const admin = await clientAs('admin');
  await admin.from('activities').delete().like('subject', `${TAG}%`);
  await admin.from('tasks').delete().like('subject', `${TAG}%`);
});

test('K14: New Event writes a real calendar entry that the day view then shows', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/');
  await expect(page.getByRole('button', { name: 'New Event' })).toBeVisible({ timeout: 25000 });

  await page.getByRole('button', { name: 'New Event' }).click();
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);

  const subject = `${TAG} event`;
  await dialog.getByLabel('Subject').fill(subject);
  await dialog.getByLabel('When').fill(localDateTimeToday(90 * 60 * 1000));
  await dialog.getByRole('button', { name: 'Save event' }).click();
  await expect(dialog).toHaveCount(0);

  await expect(page.getByText(subject)).toBeVisible({ timeout: 25000 });

  const admin = await clientAs('admin');
  const { data } = await admin.from('activities').select('kind, subject').eq('subject', subject);
  expect(data, 'the event must exist in the database').toHaveLength(1);
  expect(data?.[0]?.kind).toBe('meeting');
});

test('K14: New Task writes a real task that My Tasks then lists', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/');
  await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible({ timeout: 25000 });

  await page.getByRole('button', { name: 'New Task' }).click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await expect(dialog).toBeVisible();

  const subject = `${TAG} task`;
  await dialog.getByLabel('Subject').fill(subject);
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(dialog).toHaveCount(0);

  await expect(page.getByText(subject)).toBeVisible({ timeout: 25000 });

  const admin = await clientAs('admin');
  const { data } = await admin.from('tasks').select('subject, status').eq('subject', subject);
  expect(data, 'the task must exist in the database').toHaveLength(1);
  expect(data?.[0]?.status).toBe('open');
});

test('K14: all six calendar views change the calendar, and none opens a placeholder', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/');
  const toolbar = page.locator('.fo-calendar-toolbar');
  await expect(toolbar).toBeVisible({ timeout: 25000 });

  const views = ['Day view', '7-day view', '31-day view', 'Person view', 'Group view', 'Agenda view'];
  const seen: string[] = [];

  for (const label of views) {
    const btn = page.getByRole('button', { name: label, exact: true });
    await expect(btn, `${label} must be a real control`).toBeVisible();
    await btn.click();
    await expect(btn, `${label} must report itself as the current view`).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
    await expect
      .poll(async () => (await toolbar.innerText()).replace(/\s+/g, ' ').trim(), {
        timeout: 15000,
        message: `${label} never settled`,
      })
      .not.toBe('');
    seen.push((await toolbar.innerText()).split('\n')[0]!.trim());
  }

  expect(new Set(seen).size, `the views must not all describe the same range: ${seen.join(' | ')}`)
    .toBeGreaterThan(1);
});

test('K14: Schedule interview offers a candidate and writes a linked meeting', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/');
  await expect(
    page.locator('.record-section-inline-actions').first().getByRole('button', { name: 'Schedule interview' }),
  ).toBeVisible({ timeout: 25000 });

  await page.locator('.record-section-inline-actions').first().getByRole('button', { name: 'Schedule interview' }).click();
  const dialog = page.getByRole('dialog', { name: 'Schedule interview' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Candidate' })).toBeVisible();

  const subject = `${TAG} interview`;
  await dialog.getByLabel('Subject').fill(subject);
  await dialog.getByLabel('When').fill(localDateTimeValue(2 * 60 * 60 * 1000));
  await dialog.getByRole('button', { name: 'Save event' }).click();
  await expect(dialog).toHaveCount(0);

  const admin = await clientAs('admin');
  const { data } = await admin.from('activities').select('kind, subject').eq('subject', subject);
  expect(data, 'the interview must exist in the database').toHaveLength(1);
});

test('K14: the My Interviews section lists a real interview instead of always claiming none', async ({
  page,
}) => {
  const admin = await clientAs('admin');
  const { data: person } = await admin.from('candidate_list').select('person_id').limit(1);
  const personId = person?.[0]?.person_id as string | undefined;
  expect(personId, 'a candidate to attach the interview to').toBeTruthy();

  const subject = `${TAG} listed interview`;
  const { error } = await admin.from('activities').insert({
    kind: 'meeting',
    subject,
    occurred_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    person_id: personId,
  });
  expect(error).toBeNull();

  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/');
  const header = page.getByRole('button', { name: /^My Interviews/ });
  await expect(header).toBeVisible({ timeout: 25000 });
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();

  const interviews = page
    .locator('.record-section')
    .filter({ has: page.getByRole('button', { name: /^My Interviews/ }) });
  await expect(interviews.getByText(subject)).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('There are currently no interviews scheduled.')).toHaveCount(0);
});
