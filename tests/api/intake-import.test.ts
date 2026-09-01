import { afterEach, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const TAG = 'QA Import Test';

async function cleanup() {
  const admin = await clientAs('admin');
  const { data: items } = await admin
    .from('intake_items')
    .select('id, person_id')
    .ilike('full_name', `${TAG}%`);
  for (const item of items ?? []) {
    if (item.person_id) {
      await admin.from('candidate_profiles').delete().eq('person_id', item.person_id);
      await admin.from('contact_profiles').delete().eq('person_id', item.person_id);
      await admin.from('people').delete().eq('id', item.person_id);
    }
  }
  await admin.from('intake_items').delete().ilike('full_name', `${TAG}%`);
  await admin.from('companies').delete().ilike('name', `${TAG}%`);
}

describe('Intake import writes the documented fields (criteria 5.7 and 5.8)', () => {
  afterEach(cleanup);

  it('5.7 a candidate import sets status, grade, source, sourcer and initial_date', async () => {
    const admin = await clientAs('admin');
    const sourcerId = 'a0000000-0000-4000-8000-000000000003';

    const { data: expectedStatus } = await admin
      .from('candidate_statuses')
      .select('id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single();
    const { data: expectedSource } = await admin
      .from('sources')
      .select('id')
      .eq('name', 'LinkedIn')
      .single();

    const { data: item, error: insErr } = await admin
      .from('intake_items')
      .insert({
        channel: 'linkedin_url',
        target_type: 'candidate',
        full_name: `${TAG} Candidate`,
        linkedin_url: `https://linkedin.com/in/qa-import-${Date.now()}`,
        status: 'graded',
        star_grade: 3,
        grade_comment: 'Strong match on the core stack',
        submitted_by: sourcerId,
        parsed: {
          name: `${TAG} Candidate`,
          email: `qa-import-${Date.now()}@example.com`,
          headline: 'Staff Engineer at Probe Corp',
        },
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();

    const { error: importErr } = await admin.rpc('import_intake_item', {
      p_intake_id: item!.id,
      p_mode: 'new',
    });
    expect(importErr).toBeNull();

    const { data: after } = await admin
      .from('intake_items')
      .select('status, person_id')
      .eq('id', item!.id)
      .single();
    expect(after?.status).toBe('imported');
    expect(after?.person_id).toBeTruthy();

    const { data: profile, error: profErr } = await admin
      .from('candidate_profiles')
      .select('status_id, star_grade, grade_comment, source_id, sourcer_id, initial_date')
      .eq('person_id', after!.person_id!)
      .single();
    expect(profErr).toBeNull();

    expect(profile?.star_grade).toBe(3);
    expect(profile?.grade_comment).toBe('Strong match on the core stack');
    expect(profile?.status_id, 'status defaults to the first active status by sort_order').toBe(
      expectedStatus!.id,
    );
    expect(profile?.source_id, 'source is derived from the intake channel').toBe(expectedSource!.id);
    expect(profile?.sourcer_id, 'sourcer comes from submitted_by on a linkedin_url item').toBe(
      sourcerId,
    );
    expect(profile?.initial_date, 'initial_date is set to the import date').toBe(
      new Date().toISOString().slice(0, 10),
    );
  });

  it('5.7 a non-LinkedIn channel maps to its own source and records no sourcer', async () => {
    const admin = await clientAs('admin');
    const { data: emailSource } = await admin
      .from('sources')
      .select('id')
      .eq('name', 'Email')
      .single();

    const { data: item } = await admin
      .from('intake_items')
      .insert({
        channel: 'email',
        target_type: 'candidate',
        full_name: `${TAG} Candidate Email`,
        status: 'graded',
        star_grade: 1,
        grade_comment: 'Speculative application',
        submitted_by: 'a0000000-0000-4000-8000-000000000003',
        parsed: { name: `${TAG} Candidate Email`, email: `qa-email-${Date.now()}@example.com` },
      })
      .select('id')
      .single();

    const { error } = await admin.rpc('import_intake_item', {
      p_intake_id: item!.id,
      p_mode: 'new',
    });
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('intake_items')
      .select('person_id')
      .eq('id', item!.id)
      .single();
    const { data: profile } = await admin
      .from('candidate_profiles')
      .select('source_id, sourcer_id')
      .eq('person_id', after!.person_id!)
      .single();
    expect(profile?.source_id).toBe(emailSource!.id);
    expect(profile?.sourcer_id).toBeNull();
  });

  it('5.8 a contact import creates the company when it does not exist and links to it', async () => {
    const admin = await clientAs('admin');
    const companyName = `${TAG} New Co ${Date.now()}`;

    const { data: item } = await admin
      .from('intake_items')
      .insert({
        channel: 'manual',
        target_type: 'contact',
        full_name: `${TAG} Contact New`,
        status: 'parsed',
        parsed: { name: `${TAG} Contact New`, email: `qa-contact-${Date.now()}@example.com` },
      })
      .select('id')
      .single();

    const { error } = await admin.rpc('import_intake_item', {
      p_intake_id: item!.id,
      p_mode: 'new',
      p_new_company_name: companyName,
    });
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('intake_items')
      .select('person_id, status')
      .eq('id', item!.id)
      .single();
    expect(after?.status).toBe('imported');

    const { data: company } = await admin
      .from('companies')
      .select('id, name')
      .eq('name', companyName)
      .single();
    expect(company?.name).toBe(companyName);

    const { data: contact } = await admin
      .from('contact_profiles')
      .select('company_id')
      .eq('person_id', after!.person_id!)
      .single();
    expect(contact?.company_id).toBe(company!.id);
  });

  it('5.8 a contact import matches an existing company rather than duplicating it', async () => {
    const admin = await clientAs('admin');
    const { data: existing } = await admin
      .from('companies')
      .select('id, name')
      .limit(1)
      .single();

    const { data: item } = await admin
      .from('intake_items')
      .insert({
        channel: 'manual',
        target_type: 'contact',
        full_name: `${TAG} Contact Match`,
        status: 'parsed',
        parsed: { name: `${TAG} Contact Match`, email: `qa-match-${Date.now()}@example.com` },
      })
      .select('id')
      .single();

    const { error } = await admin.rpc('import_intake_item', {
      p_intake_id: item!.id,
      p_mode: 'new',
      p_company_id: existing!.id,
    });
    expect(error).toBeNull();

    const { data: sameName } = await admin
      .from('companies')
      .select('id')
      .eq('name', existing!.name);
    expect(sameName, 'the matched company must not be duplicated').toHaveLength(1);
    expect(sameName![0].id).toBe(existing!.id);

    const { data: row } = await admin
      .from('intake_items')
      .select('person_id')
      .eq('id', item!.id)
      .single();
    const { data: contact } = await admin
      .from('contact_profiles')
      .select('company_id')
      .eq('person_id', row!.person_id!)
      .single();
    expect(contact?.company_id).toBe(existing!.id);
  });
});
