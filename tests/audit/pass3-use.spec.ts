import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { CORPUS, settle } from './capture';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
const OUT = join(CORPUS, 'pass3');

interface Step {
  task: string;
  step: number;
  action: string;
  file: string;
  clicks: number;
  keystrokes: number;
  loads: number;
  elapsedMs: number;
  friction: string;
}

const steps: Step[] = [];
let clicks = 0;
let keystrokes = 0;
let loads = 0;
let shotSeq = 0;

function counters(page: Page): void {
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) loads += 1;
  });
}

async function step(page: Page, task: string, action: string, friction = ''): Promise<void> {
  shotSeq += 1;
  const file = `pass3/${task}/${String(shotSeq).padStart(3, '0')}-${action.replace(/[^a-z0-9]+/gi, '-').slice(0, 40).toLowerCase()}.png`;
  mkdirSync(join(CORPUS, 'pass3', task), { recursive: true });
  await page.screenshot({ path: join(CORPUS, file), fullPage: false });
  steps.push({
    task,
    step: steps.filter((s) => s.task === task).length + 1,
    action,
    file,
    clicks,
    keystrokes,
    loads,
    elapsedMs: 0,
    friction,
  });
}

async function click(page: Page, locator: ReturnType<Page['locator']>, label: string): Promise<boolean> {
  try {
    await locator.click({ timeout: 8000 });
    clicks += 1;
    await settle(page, 400);
    return true;
  } catch {
    steps.push({
      task: 'blocked',
      step: 0,
      action: `could not click ${label}`,
      file: '',
      clicks,
      keystrokes,
      loads,
      elapsedMs: 0,
      friction: 'the control was not clickable within 8s',
    });
    return false;
  }
}

async function type(page: Page, locator: ReturnType<Page['locator']>, value: string): Promise<void> {
  await locator.fill(value);
  keystrokes += value.length;
  await settle(page, 400);
}

test('pass 3: walk the real tasks as their user', async ({ page }) => {
  test.setTimeout(0);
  const admin = await clientAs('admin');
  const created: { table: string; column: string; id: string }[] = [];
  counters(page);

  try {
    const { data: person, error: personErr } = await admin
      .from('people')
      .insert({ first_name: 'Zaudit', last_name: `Probe${RUN}`, is_test: true })
      .select('id')
      .single();
    if (personErr) throw personErr;
    created.push({ table: 'people', column: 'id', id: person.id });
    const prof = await admin.from('candidate_profiles').insert({ person_id: person.id });
    if (prof.error) throw prof.error;
    created.unshift({ table: 'candidate_profiles', column: 'person_id', id: person.id });

    await signIn(page, PERSONA_EMAILS.recruiter);

    clicks = 0;
    keystrokes = 0;
    loads = 0;
    await gotoAsSignedIn(page, '/');
    await settle(page, 900);
    await step(page, 'find-a-candidate', 'start on the dashboard');
    await click(page, page.locator('nav[aria-label="Primary"] button', { hasText: /^Recruit$/ }).first(), 'Recruit nav');
    await step(page, 'find-a-candidate', 'after clicking Recruit');
    await gotoAsSignedIn(page, '/recruit/candidates');
    await settle(page, 1200);
    await step(page, 'find-a-candidate', 'candidate list loaded');
    const search = page.getByRole('searchbox', { name: /search candidates/i });
    if ((await search.count()) > 0) {
      await type(page, search, `Probe${RUN}`);
      await settle(page, 1500);
      await step(page, 'find-a-candidate', 'searched for the candidate by name');
      const row = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))').first();
      if ((await row.count()) > 0) {
        await click(page, row.locator('.link-btn').first(), 'candidate name link');
        await step(page, 'find-a-candidate', 'candidate record open');
      } else {
        await step(page, 'find-a-candidate', 'search returned no row', 'the candidate just created was not found by name search');
      }
    }

    clicks = 0;
    keystrokes = 0;
    loads = 0;
    await gotoAsSignedIn(page, '/recruit/candidates');
    await settle(page, 1200);
    const search2 = page.getByRole('searchbox', { name: /search candidates/i });
    await type(page, search2, 'zzzzzzzznothingmatchesthis');
    await settle(page, 1800);
    await step(page, 'search-finds-nothing', 'a search that matches nothing');

    clicks = 0;
    keystrokes = 0;
    loads = 0;
    await gotoAsSignedIn(page, '/recruit/requisitions/new');
    await settle(page, 900);
    await step(page, 'validation-error', 'the new requisition form, empty');
    const submit = page.getByRole('button', { name: /save|create|submit/i }).first();
    if ((await submit.count()) > 0) {
      await click(page, submit, 'save with an empty form');
      await step(page, 'validation-error', 'after submitting an empty form', 'this is where the error presentation is judged against GOV.UK');
      const invalid = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('input, select, textarea')) as HTMLInputElement[];
        const bad = nodes.filter((n) => n.willValidate && !n.checkValidity());
        return {
          count: bad.length,
          first: bad.length > 0 ? bad[0].getAttribute('aria-label') ?? bad[0].name ?? bad[0].id : '',
          message: bad.length > 0 ? bad[0].validationMessage : '',
          focused: document.activeElement === (bad[0] ?? null),
          marked: nodes.filter((n) => n.getAttribute('aria-invalid') === 'true').length,
          rendered: document.querySelectorAll('.field-error-text, .rq-error, .form-error').length,
          announced: document.querySelectorAll('[role="alert"], [aria-live]').length,
        };
      });
      await step(
        page,
        'validation-error',
        'native constraint validation state after the empty submit',
        `${invalid.count} field(s) fail checkValidity; the browser's own message for the first is "${invalid.message}"; aria-invalid set on ${invalid.marked}; app-rendered error nodes ${invalid.rendered}; live or alert regions on the page ${invalid.announced}`,
      );
    }

    await page.route('**/rest/v1/requisitions*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'audit probe: the server refused this insert', code: '23514' }),
        });
        return;
      }
      await route.continue();
    });
    const titleField = page.locator('input, textarea').first();
    if ((await titleField.count()) > 0) {
      await type(page, titleField, `Zaudit server error ${RUN}`);
    }
    const requiredNow = page.locator('input[required], select[required], textarea[required]');
    const requiredCount = await requiredNow.count();
    for (let i = 0; i < requiredCount; i += 1) {
      const field = requiredNow.nth(i);
      const kind = await field.evaluate((n) => `${n.tagName.toLowerCase()}:${(n as HTMLInputElement).type ?? ''}`);
      try {
        if (kind.startsWith('select')) await field.selectOption({ index: 1 });
        else if (kind.includes('date')) await field.fill('2026-09-04');
        else if (kind.includes('number')) await field.fill('1');
        else await field.fill(`Zaudit ${i}`);
      } catch {
        void 0;
      }
    }
    await settle(page, 300);
    await step(page, 'validation-error', 'every required field filled, before submitting');
    if ((await submit.count()) > 0) {
      await click(page, submit, 'save with a server that refuses the insert');
      await settle(page, 900);
      const shown = await page.evaluate(() => ({
        rendered: Array.from(document.querySelectorAll('.field-error-text, .rq-error, .form-error, .settings-error'))
          .map((n) => (n as HTMLElement).innerText.trim().slice(0, 80))
          .filter((t) => t !== ''),
        inAlert: Array.from(document.querySelectorAll('[role="alert"], [aria-live]'))
          .map((n) => (n as HTMLElement).innerText.trim().slice(0, 80))
          .filter((t) => t !== ''),
        stillOnForm: window.location.pathname.includes('/new'),
      }));
      await step(
        page,
        'validation-error',
        'after a submit the server refused',
        `app-rendered error text: ${shown.rendered.length > 0 ? JSON.stringify(shown.rendered) : 'none'}; text inside a live or alert region: ${shown.inAlert.length > 0 ? JSON.stringify(shown.inAlert) : 'none'}; still on the form: ${shown.stillOnForm}`,
      );
    }
    await page.unroute('**/rest/v1/requisitions*');

    clicks = 0;
    keystrokes = 0;
    loads = 0;
    await gotoAsSignedIn(page, '/recruit/candidates');
    await settle(page, 1200);
    await step(page, 'export-a-filtered-list', 'candidate list');
    const search3 = page.getByRole('searchbox', { name: /search candidates/i });
    await type(page, search3, `Probe${RUN}`);
    await settle(page, 1500);
    await step(page, 'export-a-filtered-list', 'filtered to one candidate');
    const exportBtn = page.getByRole('button', { name: 'Export CSV', exact: true });
    if ((await exportBtn.count()) > 0) {
      await step(page, 'export-a-filtered-list', 'the export control, before clicking');
    }

    clicks = 0;
    keystrokes = 0;
    loads = 0;
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await settle(page, 1200);
    await step(page, 'open-a-requisition', 'requisition list');
    const reqRow = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))').first();
    if ((await reqRow.count()) > 0) {
      await click(page, reqRow.locator('.link-btn').first(), 'requisition link');
      await settle(page, 1200);
      await step(page, 'open-a-requisition', 'requisition record open');
      const pipeline = page.locator('button.link-btn', { hasText: /^Candidates \(/ }).first();
      if ((await pipeline.count()) > 0) {
        await click(page, pipeline, 'Pipeline tab');
        await step(page, 'open-a-requisition', 'pipeline board');
      }
    }

    clicks = 0;
    keystrokes = 0;
    loads = 0;
    await gotoAsSignedIn(page, '/');
    await settle(page, 1200);
    await step(page, 'work-a-day', 'the dashboard as it opens');
    const tasksTab = page.locator('.record-section-header', { hasText: /My Tasks/i }).first();
    if ((await tasksTab.count()) > 0) {
      await click(page, tasksTab, 'tasks');
      await step(page, 'work-a-day', 'after opening tasks');
    }
  } finally {
    mkdirSync(CORPUS, { recursive: true });
    writeFileSync(join(CORPUS, 'pass3-steps.json'), JSON.stringify(steps, null, 2));
    for (const row of created) {
      const del = await admin.from(row.table).delete().eq(row.column, row.id);
      if (del.error) throw new Error(`teardown failed for ${row.table}: ${del.error.message}`);
    }
    const check = await admin.from('people').select('id').eq('id', created[created.length - 1]?.id ?? '');
    if (check.data?.length) throw new Error('the pass 3 fixture survived its teardown');
  }

  const byTask = steps.reduce<Record<string, { steps: number; clicks: number; loads: number; keys: number }>>((acc, s) => {
    acc[s.task] ??= { steps: 0, clicks: 0, loads: 0, keys: 0 };
    acc[s.task].steps += 1;
    acc[s.task].clicks = Math.max(acc[s.task].clicks, s.clicks);
    acc[s.task].loads = Math.max(acc[s.task].loads, s.loads);
    acc[s.task].keys = Math.max(acc[s.task].keys, s.keystrokes);
    return acc;
  }, {});
  console.log('PASS3 task costs');
  for (const [task, v] of Object.entries(byTask)) {
    console.log(`PASS3 ${task}: ${v.steps} steps, ${v.clicks} clicks, ${v.keys} keystrokes, ${v.loads} page loads`);
  }
});
