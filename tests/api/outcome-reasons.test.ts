import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

let companyId: string;
let reqId: string;
let personId: string;
let appId: string;
let dealId: string;

describe('Mandatory outcome reasons (criteria 2.8 and 3.4)', () => {
  beforeAll(async () => {
    const admin = await clientAs('admin');
    const { data: co } = await admin
      .from('companies')
      .insert({ name: 'QA Reason Co', types: ['employer'], is_test: true })
      .select('id')
      .single();
    companyId = co!.id;
    const { data: req } = await admin
      .from('requisitions')
      .insert({ title: 'QA Reason Req', status: 'open', company_id: companyId, is_test: true })
      .select('id')
      .single();
    reqId = req!.id;
    const { data: person } = await admin
      .from('people')
      .insert({ first_name: 'Qa', last_name: 'ReasonProbe', is_test: true })
      .select('id')
      .single();
    personId = person!.id;
    const { data: app } = await admin
      .from('applications')
      .insert({ requisition_id: reqId, person_id: personId, stage: 'screening' })
      .select('id')
      .single();
    appId = app!.id;
    const { data: deal } = await admin
      .from('deals')
      .insert({ name: 'QA Reason Deal', company_id: companyId, stage: 'proposal', is_test: true })
      .select('id')
      .single();
    dealId = deal!.id;
  });

  afterAll(async () => {
    const admin = await clientAs('admin');
    if (dealId) await admin.from('deals').delete().eq('id', dealId);
    if (appId) await admin.from('applications').delete().eq('id', appId);
    if (personId) await admin.from('people').delete().eq('id', personId);
    if (reqId) await admin.from('requisitions').delete().eq('id', reqId);
    if (companyId) await admin.from('companies').delete().eq('id', companyId);
  });

  it('refuses an application rejection with no reason, through the API', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin
      .from('applications')
      .update({ stage: 'rejected', rejection_reason: null })
      .eq('id', appId);
    expect(error?.code).toBe('23514');
  });

  it('refuses a whitespace-only rejection reason', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin
      .from('applications')
      .update({ stage: 'rejected', rejection_reason: '   ' })
      .eq('id', appId);
    expect(error?.code).toBe('23514');
  });

  it('accepts a real reason, then refuses clearing it in a second step', async () => {
    const admin = await clientAs('admin');
    const { error: setErr } = await admin
      .from('applications')
      .update({ stage: 'rejected', rejection_reason: 'Not a fit for the role' })
      .eq('id', appId);
    expect(setErr).toBeNull();

    const { error: clearErr } = await admin
      .from('applications')
      .update({ rejection_reason: null })
      .eq('id', appId);
    expect(clearErr?.code).toBe('23514');

    await admin.from('applications').update({ stage: 'screening' }).eq('id', appId);
  });

  it('refuses a lost deal with no reason, and accepts one with a reason', async () => {
    const admin = await clientAs('admin');
    const { error: blocked } = await admin
      .from('deals')
      .update({ stage: 'lost', lost_reason: null })
      .eq('id', dealId);
    expect(blocked?.code).toBe('23514');

    const { error: allowed } = await admin
      .from('deals')
      .update({ stage: 'lost', lost_reason: 'Budget cut for the quarter' })
      .eq('id', dealId);
    expect(allowed).toBeNull();

    await admin.from('deals').update({ stage: 'proposal' }).eq('id', dealId);
  });

  it('still allows an import to INSERT rows already in a terminal stage with no reason', async () => {
    const admin = await clientAs('admin');
    const { data: person2 } = await admin
      .from('people')
      .insert({ first_name: 'Qa', last_name: 'ReasonImport', is_test: true })
      .select('id')
      .single();
    const { data: imported, error: appErr } = await admin
      .from('applications')
      .insert({ requisition_id: reqId, person_id: person2!.id, stage: 'rejected' })
      .select('id, stage, rejection_reason')
      .single();
    const { data: lostDeal, error: dealErr } = await admin
      .from('deals')
      .insert({ name: 'QA Imported Lost Deal', company_id: companyId, stage: 'lost', is_test: true })
      .select('id, stage, lost_reason')
      .single();

    try {
      expect(appErr).toBeNull();
      expect(imported?.stage).toBe('rejected');
      expect(imported?.rejection_reason).toBeNull();
      expect(dealErr).toBeNull();
      expect(lostDeal?.stage).toBe('lost');
      expect(lostDeal?.lost_reason).toBeNull();
    } finally {
      if (lostDeal) await admin.from('deals').delete().eq('id', lostDeal.id);
      if (imported) await admin.from('applications').delete().eq('id', imported.id);
      await admin.from('people').delete().eq('id', person2!.id);
    }
  });
});
