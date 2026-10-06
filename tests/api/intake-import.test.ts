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

  it('keeps only the requested main statuses active', async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin
      .from('candidate_statuses')
      .select('label')
      .eq('is_active', true)
      .order('label');
    expect(error).toBeNull();
    expect(data?.map((row) => row.label)).toEqual([
      'Candidate to Review Info',
      'Do Not Pursue',
      'Flag',
      'Placed',
      'Reference Provider',
      'Rejected',
      'Resume Provided',
      'Sent InMail I (Linkedin)',
      'Submitted',
      'Talent Pool',
    ]);
  });

  it('5.7 a candidate import sets status, grade, source, sourcer and initial_date', async () => {
    const admin = await clientAs('admin');
    const sourcerId = 'a0000000-0000-4000-8000-000000000003';

    const { data: expectedStatus } = await admin
      .from('candidate_statuses')
      .select('id')
      .eq('is_active', true)
      .eq('label', 'Talent Pool')
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
          requisition_id: 'd0000000-0000-4000-8000-000000000001',
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
    expect(profile?.status_id, 'an import with no status lands in Talent Pool').toBe(
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
        parsed: {
          name: `${TAG} Candidate Email`,
          email: `qa-email-${Date.now()}@example.com`,
          requisition_id: 'd0000000-0000-4000-8000-000000000001',
        },
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

  it('imports candidate details and creates an application for the selected requisition', async () => {
    const admin = await clientAs('admin');
    const requisitionId = 'd0000000-0000-4000-8000-000000000001';
    const email = `qa-sheet-${Date.now()}@example.test`;
    const { data: item, error: insertError } = await admin
      .from('intake_items')
      .insert({
        channel: 'sheet_import',
        target_type: 'candidate',
        full_name: `${TAG} Sheet Candidate`,
        batch_label: `${TAG} ${Date.now()}`,
        parsed: {
          name: `${TAG} Sheet Candidate`,
          first_name: 'Sheet',
          last_name: 'Candidate',
          email,
          phone: '+63 (917) 555-0142',
          country: 'Philippines',
          current_employer: 'Probe Corporation',
          current_title: 'Platform Engineer',
          tenure_note: 'Four years',
          expected_salary: '120000',
          current_salary: '100000',
          salary_currency: 'PHP',
          salary_flag: 'Flexible',
          education: [{ university: 'University of the Philippines', year: '2018' }],
          experience: [{ title: 'Platform Engineer', employer: 'Probe Corporation' }],
          requisition_id: requisitionId,
        },
        status: 'parsed',
      })
      .select('id')
      .single();
    expect(insertError).toBeNull();

    const { data: imported, error: importError } = await admin.rpc('import_intake_item', {
      p_intake_id: item!.id,
      p_mode: 'new',
    });
    expect(importError).toBeNull();
    const personId = imported!.person_id as string;

    const { data: person } = await admin
      .from('people')
      .select('first_name, last_name, country, education, experience')
      .eq('id', personId)
      .single();
    expect(person).toMatchObject({
      first_name: 'Sheet',
      last_name: 'Candidate',
      country: 'Philippines',
      education: [{ university: 'University of the Philippines', year: '2018' }],
      experience: [{ title: 'Platform Engineer', employer: 'Probe Corporation' }],
    });

    const { data: profile } = await admin
      .from('candidate_profiles')
      .select('current_employer, current_title, tenure_note, expected_salary, current_salary, salary_currency, salary_flag')
      .eq('person_id', personId)
      .single();
    expect(profile).toMatchObject({
      current_employer: 'Probe Corporation',
      current_title: 'Platform Engineer',
      tenure_note: 'Four years',
      expected_salary: 120000,
      current_salary: 100000,
      salary_currency: 'PHP',
      salary_flag: 'Flexible',
    });

    const { data: applications } = await admin
      .from('applications')
      .select('requisition_id')
      .eq('person_id', personId);
    expect(applications).toEqual([{ requisition_id: requisitionId }]);
  });

  it('refuses an admin candidate import with no requisition attached', async () => {
    const admin = await clientAs('admin');
    const { data: item, error: insErr } = await admin
      .from('intake_items')
      .insert({
        channel: 'manual',
        target_type: 'candidate',
        full_name: `${TAG} No Requisition`,
        status: 'parsed',
        parsed: {
          first_name: 'No',
          last_name: 'Requisition',
          email: `qa-noreq-${Date.now()}@example.com`,
        },
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();

    const { error } = await admin.rpc('import_intake_item', { p_intake_id: item!.id, p_mode: 'new' });
    expect(error?.message).toContain('Attach the candidate to a requisition before importing');

    const { data: after } = await admin.from('intake_items').select('status, person_id').eq('id', item!.id).single();
    expect(after).toEqual({ status: 'parsed', person_id: null });
  });
});
