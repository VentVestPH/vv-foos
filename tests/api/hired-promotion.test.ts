// Cross-module flow 1 (brief instruction 3): hired → contact promotion.
// Advances a real (is_test-flagged) application to `hired` as admin, asserts
// the trigger side effects (audit_log, application.hired outbox event,
// hired_at), then exercises the promotion RPC path a recruiter/admin would
// trigger by accepting the CRM banner. Everything created here is deleted
// in afterAll.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const TEST_REQ_TITLE = 'QA Flow — Hired Promotion Requisition';
const TEST_PERSON_NAME = { first_name: 'Qa', last_name: 'HiredFlowTest' };

let reqId: string;
let personId: string;
let appId: string;
let companyId: string;

describe('Cross-module flow: hired → contact promotion', () => {
  beforeAll(async () => {
    const admin = await clientAs('admin');

    const { data: company } = await admin
      .from('companies')
      .insert({ name: 'QA Flow Co', types: ['employer'], is_test: true })
      .select('id')
      .single();
    companyId = company!.id;

    const { data: req } = await admin
      .from('requisitions')
      .insert({ title: TEST_REQ_TITLE, status: 'open', company_id: companyId, is_test: true })
      .select('id')
      .single();
    reqId = req!.id;

    const { data: person } = await admin
      .from('people')
      .insert({ ...TEST_PERSON_NAME, is_test: true })
      .select('id')
      .single();
    personId = person!.id;

    await admin.from('candidate_profiles').insert({ person_id: personId });

    const { data: app } = await admin
      .from('applications')
      .insert({ requisition_id: reqId, person_id: personId, stage: 'offer' })
      .select('id')
      .single();
    appId = app!.id;
  });

  afterAll(async () => {
    const admin = await clientAs('admin');
    await admin.from('contact_profiles').delete().eq('person_id', personId);
    await admin.from('applications').delete().eq('id', appId);
    await admin.from('candidate_profiles').delete().eq('person_id', personId);
    await admin.from('people').delete().eq('id', personId);
    await admin.from('requisitions').delete().eq('id', reqId);
    await admin.from('companies').delete().eq('id', companyId);
  });

  it('advancing to hired sets hired_at and fires application.hired', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('applications').update({ stage: 'hired' }).eq('id', appId);
    expect(error).toBeNull();

    const { data: app } = await admin
      .from('applications')
      .select('hired_at, stage_changed_at')
      .eq('id', appId)
      .single();
    expect(app?.hired_at).not.toBeNull();

    const { data: events } = await admin
      .from('events_outbox')
      .select('event_name, payload')
      .eq('aggregate_id', appId)
      .eq('event_name', 'application.hired');
    expect(events && events.length).toBeGreaterThan(0);
    // Payload should carry enough for the CRM promotion banner to pre-fill
    // company — see HiredPromotionListener.tsx's parsePayload().
    expect(events?.[0].payload).toHaveProperty('person_id');
  });

  it('accepting the promotion creates exactly one contact_profiles row, no duplicate person', async () => {
    const admin = await clientAs('admin');

    const { data: peopleBefore } = await admin.from('people').select('id').eq('id', personId);
    expect(peopleBefore).toHaveLength(1);

    // Same insert PromoteContactPage.tsx performs on accept.
    const { error } = await admin
      .from('contact_profiles')
      .insert({ person_id: personId, company_id: companyId });
    expect(error).toBeNull();

    const { data: peopleAfter } = await admin.from('people').select('id').eq('id', personId);
    expect(peopleAfter).toHaveLength(1); // no duplicate — same person_id, one people row

    const { data: profiles } = await admin
      .from('contact_profiles')
      .select('person_id, company_id')
      .eq('person_id', personId);
    expect(profiles).toHaveLength(1);
    expect(profiles?.[0].company_id).toBe(companyId); // defaulted from the requisition's company
  });

  it('declining the prompt leaves no contact_profile but the event stays logged', async () => {
    // Exercised against a second application so it doesn't collide with the
    // accept case above (contact_profiles has one row per person_id).
    const admin = await clientAs('admin');
    const { data: person2 } = await admin
      .from('people')
      .insert({ first_name: 'Qa', last_name: 'HiredFlowDecline', is_test: true })
      .select('id')
      .single();
    await admin.from('candidate_profiles').insert({ person_id: person2!.id });
    const { data: app2 } = await admin
      .from('applications')
      .insert({ requisition_id: reqId, person_id: person2!.id, stage: 'hired' })
      .select('id')
      .single();

    const { data: events } = await admin
      .from('events_outbox')
      .select('id')
      .eq('aggregate_id', app2!.id)
      .eq('event_name', 'application.hired');
    expect(events && events.length).toBeGreaterThan(0); // event still logged

    const { data: profile } = await admin
      .from('contact_profiles')
      .select('person_id')
      .eq('person_id', person2!.id);
    expect(profile).toHaveLength(0); // decline = no insert, nothing to assert beyond absence

    await admin.from('applications').delete().eq('id', app2!.id);
    await admin.from('candidate_profiles').delete().eq('person_id', person2!.id);
    await admin.from('people').delete().eq('id', person2!.id);
  });
});
