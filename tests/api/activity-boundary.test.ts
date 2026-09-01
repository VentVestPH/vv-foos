import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientAs } from '../env';
import { SEED_PEOPLE_IDS } from '../fixtures/seed-ids';

let candidateId: string;
let contactPersonId: string;
let companyId: string;
const activityIds: string[] = [];
const intakeIds: string[] = [];

describe('Activity and intake boundaries (criteria 6.11 and 5.10)', () => {
  beforeAll(async () => {
    const admin = await clientAs('admin');

    const { data: cp } = await admin
      .from('candidate_profiles')
      .select('person_id')
      .in('person_id', SEED_PEOPLE_IDS)
      .limit(1)
      .single();
    candidateId = cp!.person_id;

    const { data: ct } = await admin
      .from('contact_profiles')
      .select('person_id, company_id')
      .limit(1)
      .single();
    contactPersonId = ct!.person_id;
    companyId = ct!.company_id;

    const { data: emails, error } = await admin
      .from('activities')
      .insert([
        {
          kind: 'email',
          subject: 'QA boundary: candidate-linked email',
          person_id: candidateId,
          occurred_at: new Date().toISOString(),
        },
        {
          kind: 'email',
          subject: 'QA boundary: contact-linked email',
          person_id: contactPersonId,
          company_id: companyId,
          occurred_at: new Date().toISOString(),
        },
      ])
      .select('id');
    if (error) throw error;
    activityIds.push(...emails!.map((e) => e.id));
  });

  afterAll(async () => {
    const admin = await clientAs('admin');
    for (const id of activityIds) await admin.from('activities').delete().eq('id', id);
    for (const id of intakeIds) await admin.from('intake_items').delete().eq('id', id);
  });

  it('6.11 a bd user sees no candidate-linked email activity anywhere', async () => {
    const bd = await clientAs('bd');
    const { data, error } = await bd
      .from('activities')
      .select('id, subject, person_id')
      .eq('kind', 'email')
      .in('id', activityIds);
    expect(error).toBeNull();

    const subjects = (data ?? []).map((a) => a.subject);
    expect(subjects).not.toContain('QA boundary: candidate-linked email');
    for (const row of data ?? []) {
      expect(row.person_id).not.toBe(candidateId);
    }
  });

  it('6.11 an admin sees both, so the bd result is a boundary and not an empty table', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin.from('activities').select('id').in('id', activityIds);
    expect(data).toHaveLength(2);
  });

  it('5.10 a sourcer cannot create a contact-target intake item', async () => {
    const sourcer = await clientAs('sourcer');
    const { error } = await sourcer
      .from('intake_items')
      .insert({ channel: 'manual', target_type: 'contact', full_name: 'QA Boundary Contact' });
    expect(error).not.toBeNull();
  });

  it('5.10 a rejected intake item stays queryable with its reason intact', async () => {
    const admin = await clientAs('admin');
    const { data: item, error: insErr } = await admin
      .from('intake_items')
      .insert({
        channel: 'manual',
        target_type: 'candidate',
        full_name: 'QA Boundary Rejected',
        status: 'pending',
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();
    intakeIds.push(item!.id);

    const { error: rejErr } = await admin
      .from('intake_items')
      .update({ status: 'rejected', grade_comment: 'Duplicate of an existing candidate' })
      .eq('id', item!.id);
    expect(rejErr).toBeNull();

    const { data: after } = await admin
      .from('intake_items')
      .select('status, grade_comment')
      .eq('id', item!.id)
      .single();
    expect(after?.status).toBe('rejected');
    expect(after?.grade_comment).toBe('Duplicate of an existing candidate');
  });

  it('5.10 a recruiter cannot rewrite the applicant-supplied fields of a careers_form row', async () => {
    const admin = await clientAs('admin');
    const { data: item } = await admin
      .from('intake_items')
      .insert({
        channel: 'careers_form',
        target_type: 'candidate',
        full_name: 'QA Boundary CareersForm',
        status: 'parsed',
      })
      .select('id')
      .single();
    intakeIds.push(item!.id);

    const recruiter = await clientAs('recruiter');
    const { error: nameErr } = await recruiter
      .from('intake_items')
      .update({ full_name: 'Tampered' })
      .eq('id', item!.id);
    expect(nameErr).not.toBeNull();

    const { data: after } = await admin
      .from('intake_items')
      .select('full_name')
      .eq('id', item!.id)
      .single();
    expect(after?.full_name).toBe('QA Boundary CareersForm');
  });

  it('5.10 a recruiter can still grade and route a careers_form row', async () => {
    const admin = await clientAs('admin');
    const { data: item } = await admin
      .from('intake_items')
      .insert({
        channel: 'careers_form',
        target_type: 'candidate',
        full_name: 'QA Boundary CareersGrade',
        status: 'parsed',
      })
      .select('id')
      .single();
    intakeIds.push(item!.id);

    const recruiter = await clientAs('recruiter');
    const { error } = await recruiter
      .from('intake_items')
      .update({ status: 'graded', star_grade: 2, grade_comment: 'Worth a screen' })
      .eq('id', item!.id);
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('intake_items')
      .select('status, star_grade, grade_comment, full_name')
      .eq('id', item!.id)
      .single();
    expect(after?.status).toBe('graded');
    expect(after?.star_grade).toBe(2);
    expect(after?.full_name).toBe('QA Boundary CareersGrade');
  });

  it('5.10 a non-careers_form row stays fully editable by a recruiter', async () => {
    const admin = await clientAs('admin');
    const { data: item } = await admin
      .from('intake_items')
      .insert({
        channel: 'manual',
        target_type: 'candidate',
        full_name: 'QA Boundary Manual',
        status: 'pending',
      })
      .select('id')
      .single();
    intakeIds.push(item!.id);

    const recruiter = await clientAs('recruiter');
    const { error } = await recruiter
      .from('intake_items')
      .update({ full_name: 'QA Boundary Manual Renamed' })
      .eq('id', item!.id);
    expect(error).toBeNull();
  });
});
