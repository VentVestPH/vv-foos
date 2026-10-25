import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientAs, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../support/env';
import { STAFF_IDS } from '../../support/fixtures/seed-ids';

function requireDisposableProject() {
  const host = new URL(SUPABASE_URL).hostname;
  const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
  if (!isLocal) {
    throw new Error(
      `Refusing to run the careers-apply flow test against ${host}. ` +
        'careers-apply rejects is_test requisitions, so this fixture must be a real ' +
        'published open requisition. Against a hosted project that briefly publishes a ' +
        'fake job on the live careers page and feeds a fake hire into the dash metrics, ' +
        'which filter on NOT is_test. Point FOOS_SUPABASE_URL at a local stack.',
    );
  }
}

const APPLY_URL = `${SUPABASE_URL}/functions/v1/careers-apply`;
const TEST_EMAIL = 'qa-careers-flow-test@ventvest.com';

const RUN_IP = `test-${Math.random().toString(36).slice(2, 10)}-intake`;

const MINIMAL_PDF = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
]);

let reqId: string;
let personId: string | null = null;
let appId: string | null = null;

describe('Cross-module flow: careers form → recruiter unviewed queue', () => {
  beforeAll(async () => {
    const admin = await clientAs('admin');
    requireDisposableProject();

    const { data: req, error: reqErr } = await admin
      .from('requisitions')
      .insert({
        title: 'QA Flow: Careers Apply Requisition',
        status: 'open',
        is_published: true,
        is_test: false,
      })
      .select('id')
      .single();
    if (reqErr || !req) throw reqErr ?? new Error('fixture requisition insert returned no row');
    reqId = req.id;
  });

  afterAll(async () => {
    const admin = await clientAs('admin');
    if (appId) await admin.from('applications').delete().eq('id', appId);
    const { data: strays } = await admin
      .from('people')
      .select('id')
      .contains('emails', JSON.stringify([{ address: TEST_EMAIL }]));
    for (const row of strays ?? []) {
      await admin.from('applications').delete().eq('person_id', row.id);
      await admin.from('candidate_profiles').delete().eq('person_id', row.id);
      const { data: files } = await admin
        .from('attachments')
        .select('storage_path')
        .eq('parent_id', row.id);
      const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean);
      if (paths.length) await admin.storage.from('attachments').remove(paths);
      await admin.from('attachments').delete().eq('parent_id', row.id);
      await admin.from('people').delete().eq('id', row.id);
    }
    await admin.from('intake_items').delete().ilike('full_name', 'Qa CareersFlow%');
    await admin.from('requisitions').delete().eq('id', reqId);
  });

  it('submitting the apply form creates intake_items + people + application(received)', async () => {
    const form = new FormData();
    form.set('requisition_id', reqId);
    form.set('full_name', 'Qa CareersFlowTest');
    form.set('email', TEST_EMAIL);
    form.set('phone', '+63 917 000 0000');
    form.set('consent', 'true');
    form.set('company_website', '');
    form.set('resume', new File([MINIMAL_PDF], 'qa-flow-resume.pdf', { type: 'application/pdf' }));

    const res = await fetch(APPLY_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'x-forwarded-for': RUN_IP },
      body: form,
    });
    const body = await res.json().catch(() => null);
    expect(res.status, `careers-apply rejected the submission: ${JSON.stringify(body)}`).toBeLessThan(300);

    const admin = await clientAs('admin');
    const { data: person, error: personErr } = await admin
      .from('people')
      .select('id')
      .contains('emails', JSON.stringify([{ address: TEST_EMAIL }]));
    expect(personErr).toBeNull();
    expect(person).toHaveLength(1);
    personId = person![0].id;

    const { data: app, error: appErr } = await admin
      .from('applications')
      .select('id, stage, source_id')
      .eq('requisition_id', reqId)
      .eq('person_id', personId);
    expect(appErr).toBeNull();
    expect(app).toHaveLength(1);
    expect(app?.[0].stage).toBe('received');
    appId = app![0].id;

    const { data: intake, error: intakeErr } = await admin
      .from('intake_items')
      .select('channel')
      .eq('person_id', personId)
      .eq('channel', 'careers_form');
    expect(intakeErr).toBeNull();
    expect(intake?.length ?? 0).toBeGreaterThan(0);
  });

  it('fires intake_item.received, intake_item.imported, and application.created', async () => {
    const admin = await clientAs('admin');
    for (const eventName of ['intake_item.received', 'intake_item.imported', 'application.created']) {
      const { data, error } = await admin
        .from('events_outbox')
        .select('id')
        .eq('event_name', eventName)
        .eq('aggregate_id', eventName === 'application.created' ? appId! : personId!)
        .limit(1);
      expect(error).toBeNull();

      if (eventName === 'application.created') {
        expect(data?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('the new application counts as unviewed for a recruiter with no application_views row', async () => {
    const recruiter = await clientAs('recruiter');
    const readView = () =>
      recruiter
        .from('application_views')
        .select('application_id, staff_id, last_viewed_at')
        .eq('application_id', appId!)
        .eq('staff_id', STAFF_IDS.recruiter);

    const { data: views, error: viewsErr } = await readView();
    expect(viewsErr).toBeNull();
    expect(views).toHaveLength(0);

    const { error: upsertErr } = await recruiter
      .from('application_views')
      .upsert({
        application_id: appId!,
        staff_id: STAFF_IDS.recruiter,
        last_viewed_at: new Date().toISOString(),
      });
    expect(upsertErr).toBeNull();

    const { data: viewsAfter, error: afterErr } = await readView();
    expect(afterErr).toBeNull();
    expect(viewsAfter).toHaveLength(1);
  });
});
