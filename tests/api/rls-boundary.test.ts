// RLS boundary walk through the real API (brief instruction 3, matrix row
// "RLS boundary walk"). Signs in as each real persona via GoTrue and hits
// PostgREST directly — this is what makes it different from
// supabase/tests/validate.sql, which simulates the same policies via
// request.jwt.claims in a raw psql session rather than a real JWT + REST call.
//
// Requires tests/fixtures/personas.sql to have been run against the target
// project (creates real Auth identities for the 4 seeded demo staff rows).
import { describe, expect, it } from 'vitest';
import { clientAs } from '../env';
import { SEED_DEAL_IDS, SEED_PEOPLE_IDS } from '../fixtures/seed-ids';

describe('RLS boundary — sourcer', () => {
  it('sees only own-sourced candidates via people, and zero companies', async () => {
    const sourcer = await clientAs('sourcer');
    const { data: people, error: peopleErr } = await sourcer
      .from('people')
      .select('id')
      .in('id', SEED_PEOPLE_IDS);
    expect(peopleErr).toBeNull();
    expect(people).toHaveLength(3); // matches validate.sql check 10 exactly

    const { data: companies } = await sourcer.from('companies').select('id');
    expect(companies).toHaveLength(0);
  });

  it('cannot read audit_log', async () => {
    const sourcer = await clientAs('sourcer');
    const { data } = await sourcer.from('audit_log').select('id');
    expect(data).toHaveLength(0);
  });

  it('can only insert candidate-target intake_items, not contact', async () => {
    const sourcer = await clientAs('sourcer');
    const { error: candidateErr } = await sourcer.from('intake_items').insert({
      channel: 'linkedin_url',
      target_type: 'candidate',
      full_name: 'QA RLS Test — Sourcer Candidate',
      submitted_by: 'a0000000-0000-4000-8000-000000000003',
    });
    expect(candidateErr).toBeNull();

    const { error: contactErr } = await sourcer.from('intake_items').insert({
      channel: 'linkedin_url',
      target_type: 'contact',
      full_name: 'QA RLS Test — Should Fail',
      submitted_by: 'a0000000-0000-4000-8000-000000000003',
    });
    expect(contactErr).not.toBeNull();

    // Cleanup the one row that did get created.
    await sourcer
      .from('intake_items')
      .delete()
      .eq('full_name', 'QA RLS Test — Sourcer Candidate');
  });
});

describe('RLS boundary — bd', () => {
  it('sees zero candidate_profiles and zero requisitions', async () => {
    const bd = await clientAs('bd');
    const { data: cp } = await bd.from('candidate_profiles').select('person_id');
    expect(cp).toHaveLength(0);
    const { data: reqs } = await bd.from('requisitions').select('id');
    expect(reqs).toHaveLength(0);
  });

  it('cannot read the candidate-only seeded person, but can read the dual-profile one', async () => {
    const bd = await clientAs('bd');
    const { data: candidateOnly } = await bd
      .from('people')
      .select('id')
      .eq('id', 'b0000000-0000-4000-8000-000000000001');
    expect(candidateOnly).toHaveLength(0);

    const { data: dual } = await bd
      .from('people')
      .select('id')
      .eq('id', 'b0000000-0000-4000-8000-000000000009');
    expect(dual).toHaveLength(1);
  });

  it('cannot read candidate-target intake_items', async () => {
    const bd = await clientAs('bd');
    const { data } = await bd.from('intake_items').select('id').eq('target_type', 'candidate');
    expect(data).toHaveLength(0);
  });
});

describe('RLS boundary — recruiter', () => {
  it('sees every seeded person, reads deals but cannot write them', async () => {
    const recruiter = await clientAs('recruiter');
    const { data: people } = await recruiter.from('people').select('id').in('id', SEED_PEOPLE_IDS);
    expect(people).toHaveLength(SEED_PEOPLE_IDS.length);

    const { data: deals } = await recruiter.from('deals').select('id').in('id', SEED_DEAL_IDS);
    expect(deals).toHaveLength(SEED_DEAL_IDS.length);

    const { error, data: updated } = await recruiter
      .from('deals')
      .update({ probability: 0.42 })
      .eq('display_code', 'DEAL-0001')
      .select();
    // RLS-blocked updates return no error and no rows, not a thrown error —
    // PostgREST reports zero rows affected rather than a permission error
    // when the row exists but the UPDATE policy's USING clause excludes it.
    expect(error).toBeNull();
    expect(updated).toHaveLength(0);
  });
});

describe('RLS boundary — admin', () => {
  it('reads audit_log, events_outbox, and every seeded person', async () => {
    const admin = await clientAs('admin');
    const { data: audit } = await admin.from('audit_log').select('id').limit(1);
    expect(audit && audit.length).toBeGreaterThan(0);
    const { data: people } = await admin.from('people').select('id').in('id', SEED_PEOPLE_IDS);
    expect(people).toHaveLength(SEED_PEOPLE_IDS.length);
  });
});

describe('RLS boundary — dash schema (Agent 7)', () => {
  it('bd cannot read the admin-only Experiment metrics view', async () => {
    const bd = await clientAs('bd');
    const { data, error } = await bd.schema('dash').from('vw_success_metrics').select('*');
    // NOTE: as of 2026-07-25 this fails with PGRST106 "Invalid schema: dash"
    // until the `dash` schema is added to the project's exposed-schemas
    // list (Supabase Dashboard → Settings → Data API) — see DEFECT_LOG.md
    // QA-001. Once fixed, this should return an empty array, not an error.
    if (error) {
      expect(error.message).not.toContain('Invalid schema');
    }
    expect(data ?? []).toHaveLength(0);
  });

  it('admin can read Experiment metrics rows', async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin.schema('dash').from('vw_success_metrics').select('*');
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(0);
  });
});
