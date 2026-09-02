import { afterEach, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const tag = `qa-merge-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];

async function makeCandidate(suffix: string, extra: Record<string, unknown> = {}) {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('people')
    .insert({ first_name: tag, last_name: suffix, is_test: true, ...extra })
    .select('id')
    .single();
  if (error) throw error;
  created.push(data.id);
  const profile = await admin.from('candidate_profiles').insert({ person_id: data.id });
  if (profile.error) throw profile.error;
  return data.id;
}

afterEach(async () => {
  const admin = await clientAs('admin');
  if (!created.length) return;
  await admin.from('applications').delete().in('person_id', created);
  await admin.from('activities').delete().in('person_id', created);
  await admin.from('candidate_profiles').delete().in('person_id', created);
  await admin.from('people').delete().in('id', created);
  created.length = 0;
});

describe('fn_merge_candidates', () => {
  it('moves the duplicate history onto the survivor and removes the duplicate', async () => {
    const survivor = await makeCandidate('survivor', { city: 'Manila' });
    const duplicate = await makeCandidate('duplicate', { headline: 'Kept from the duplicate' });

    const admin = await clientAs('admin');
    const { data: reqs } = await admin.from('requisitions').select('id').limit(2);
    expect(reqs?.length).toBe(2);
    const app = await admin
      .from('applications')
      .insert({ requisition_id: reqs![1]!.id, person_id: duplicate })
      .select('id')
      .single();
    expect(app.error, app.error?.message).toBeNull();

    const recruiter = await clientAs('recruiter');
    const { data, error } = await recruiter.rpc('fn_merge_candidates', {
      p_survivor: survivor,
      p_duplicate: duplicate,
    });
    expect(error, error?.message).toBeNull();
    expect((data as { applications_moved: number }).applications_moved).toBe(1);

    const after = await admin
      .from('people')
      .select('id, city, headline')
      .in('id', [survivor, duplicate]);
    expect(after.data).toHaveLength(1);
    expect(after.data?.[0]?.id).toBe(survivor);
    expect(after.data?.[0]?.city).toBe('Manila');
    expect(after.data?.[0]?.headline).toBe('Kept from the duplicate');

    const moved = await admin.from('applications').select('person_id').eq('id', app.data!.id);
    expect(moved.data?.[0]?.person_id).toBe(survivor);

    const note = await admin
      .from('activities')
      .select('kind, subject')
      .eq('person_id', survivor)
      .eq('kind', 'note');
    expect(note.data?.some((a) => a.subject === 'Duplicate record merged in')).toBe(true);
    created.length = 0;
    created.push(survivor);
  });

  it('drops the duplicate application when both applied to the same requisition', async () => {
    const survivor = await makeCandidate('keep');
    const duplicate = await makeCandidate('drop');

    const admin = await clientAs('admin');
    const { data: reqs } = await admin.from('requisitions').select('id').limit(1);
    const requisition = reqs![0]!.id;
    expect(
      (await admin.from('applications').insert({ requisition_id: requisition, person_id: survivor }))
        .error,
    ).toBeNull();
    expect(
      (
        await admin
          .from('applications')
          .insert({ requisition_id: requisition, person_id: duplicate })
      ).error,
    ).toBeNull();

    const recruiter = await clientAs('recruiter');
    const { data, error } = await recruiter.rpc('fn_merge_candidates', {
      p_survivor: survivor,
      p_duplicate: duplicate,
    });
    expect(error, error?.message).toBeNull();
    expect((data as { applications_dropped: number }).applications_dropped).toBe(1);
    expect((data as { applications_moved: number }).applications_moved).toBe(0);

    const apps = await admin
      .from('applications')
      .select('person_id')
      .eq('requisition_id', requisition)
      .in('person_id', [survivor, duplicate]);
    expect(apps.data).toHaveLength(1);
    expect(apps.data?.[0]?.person_id).toBe(survivor);
    created.length = 0;
    created.push(survivor);
  });

  it('never overwrites a value the survivor already has', async () => {
    const survivor = await makeCandidate('rich', { city: 'Cebu', headline: 'Survivor headline' });
    const duplicate = await makeCandidate('poor', { city: 'Davao', headline: 'Duplicate headline' });

    const recruiter = await clientAs('recruiter');
    expect(
      (await recruiter.rpc('fn_merge_candidates', { p_survivor: survivor, p_duplicate: duplicate }))
        .error,
    ).toBeNull();

    const admin = await clientAs('admin');
    const { data } = await admin.from('people').select('city, headline').eq('id', survivor).single();
    expect(data?.city).toBe('Cebu');
    expect(data?.headline).toBe('Survivor headline');
    created.length = 0;
    created.push(survivor);
  });

  it('refuses a sourcer, a self-merge and a non-candidate', async () => {
    const survivor = await makeCandidate('a');
    const duplicate = await makeCandidate('b');

    const sourcer = await clientAs('sourcer');
    const refused = await sourcer.rpc('fn_merge_candidates', {
      p_survivor: survivor,
      p_duplicate: duplicate,
    });
    expect(refused.error?.message).toContain('only an admin or a recruiter');

    const recruiter = await clientAs('recruiter');
    const self = await recruiter.rpc('fn_merge_candidates', {
      p_survivor: survivor,
      p_duplicate: survivor,
    });
    expect(self.error?.message).toContain('cannot be merged into itself');

    const admin = await clientAs('admin');
    const { data: person } = await admin
      .from('people')
      .insert({ first_name: tag, last_name: 'not-a-candidate', is_test: true })
      .select('id')
      .single();
    created.push(person!.id);
    const notCandidate = await recruiter.rpc('fn_merge_candidates', {
      p_survivor: survivor,
      p_duplicate: person!.id,
    });
    expect(notCandidate.error?.message).toContain('not a candidate');

    const still = await admin.from('people').select('id').in('id', [survivor, duplicate]);
    expect(still.data, 'a refused merge must leave both records in place').toHaveLength(2);
  });
});
