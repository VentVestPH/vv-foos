import { afterEach, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const tag = `qa-erase-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const leftover: string[] = [];

async function makeCandidate(last: string) {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('people')
    .insert({ first_name: tag, last_name: last, is_test: true })
    .select('id')
    .single();
  if (error) throw error;
  leftover.push(data.id);
  const profile = await admin.from('candidate_profiles').insert({ person_id: data.id });
  if (profile.error) throw profile.error;
  return data.id;
}

afterEach(async () => {
  const admin = await clientAs('admin');
  if (leftover.length) {
    await admin.from('applications').delete().in('person_id', leftover);
    await admin.from('activities').delete().in('person_id', leftover);
    await admin.from('candidate_profiles').delete().in('person_id', leftover);
    await admin.from('people').delete().in('id', leftover);
    leftover.length = 0;
  }
});

describe('fn_erase_person', () => {
  it('removes the person and everything that referenced them', async () => {
    const person = await makeCandidate('erase-me');
    const admin = await clientAs('admin');
    const { data: reqs } = await admin.from('requisitions').select('id').limit(1);
    expect(
      (await admin.from('applications').insert({ requisition_id: reqs![0]!.id, person_id: person }))
        .error,
    ).toBeNull();
    expect(
      (
        await admin
          .from('activities')
          .insert({ kind: 'note', subject: 'a note', person_id: person })
      ).error,
    ).toBeNull();

    const { data, error } = await admin.rpc('fn_erase_person', {
      p_person: person,
      p_reason: `${tag} candidate asked`,
    });
    expect(error, error?.message).toBeNull();
    expect((data as { applications: number }).applications).toBe(1);
    expect((data as { activities: number }).activities).toBe(1);

    expect((await admin.from('people').select('id').eq('id', person)).data).toHaveLength(0);
    expect(
      (await admin.from('applications').select('id').eq('person_id', person)).data,
    ).toHaveLength(0);
    expect((await admin.from('activities').select('id').eq('person_id', person)).data).toHaveLength(
      0,
    );
    expect(
      (await admin.from('candidate_profiles').select('person_id').eq('person_id', person)).data,
    ).toHaveLength(0);
    leftover.length = 0;
  });

  it('leaves a receipt naming who erased whom and when', async () => {
    const person = await makeCandidate('receipt');
    const admin = await clientAs('admin');
    const me = await admin.auth.getUser();

    await admin.rpc('fn_erase_person', { p_person: person, p_reason: `${tag} receipt case` });

    const { data } = await admin
      .from('erasure_log')
      .select('person_id, erased_by, reason, counts, erased_at')
      .eq('person_id', person)
      .single();
    expect(data?.erased_by).toBe(me.data.user?.id);
    expect(data?.reason).toBe(`${tag} receipt case`);
    expect(data?.erased_at).toBeTruthy();
    leftover.length = 0;
  });

  it('queues the attachment files so the Storage sweep can finish the job', async () => {
    const person = await makeCandidate('with-a-file');
    const admin = await clientAs('admin');
    const path = `person/${person}/${tag}.pdf`;
    const up = await admin.storage
      .from('attachments')
      .upload(path, new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }));
    expect(up.error, up.error?.message).toBeNull();
    expect(
      (
        await admin
          .from('attachments')
          .insert({ storage_path: path, parent_type: 'person', parent_id: person, kind: 'resume' })
      ).error,
    ).toBeNull();

    const { data } = await admin.rpc('fn_erase_person', { p_person: person, p_reason: `${tag} file` });
    expect((data as { attachments_queued: number }).attachments_queued).toBe(1);

    const queued = await admin
      .from('attachment_deletion_queue')
      .select('storage_path')
      .eq('storage_path', path);
    expect(queued.data, 'the file must be queued, not silently orphaned').toHaveLength(1);

    const stillThere = await admin.storage.from('attachments').remove([path]);
    expect(
      stillThere.data,
      'with the attachments row gone the DELETE policy matches nothing, so the API cannot remove the file: that is why the queue exists',
    ).toHaveLength(0);

    const reattached = await admin
      .from('attachments')
      .insert({ storage_path: path, parent_type: 'person', parent_id: person, kind: 'other' })
      .select('id')
      .single();
    expect(reattached.error, reattached.error?.message).toBeNull();
    const removed = await admin.storage.from('attachments').remove([path]);
    expect(removed.data).toHaveLength(1);
    await admin.from('attachments').delete().eq('id', reattached.data!.id);
    await admin.from('attachment_deletion_queue').delete().eq('storage_path', path);
    leftover.length = 0;
  });

  it('refuses anyone who is not an admin, and refuses an unknown person', async () => {
    const person = await makeCandidate('protected');
    const recruiter = await clientAs('recruiter');
    const refused = await recruiter.rpc('fn_erase_person', { p_person: person, p_reason: tag });
    expect(refused.error?.message).toContain('only an admin');

    const admin = await clientAs('admin');
    const unknown = await admin.rpc('fn_erase_person', {
      p_person: '00000000-0000-4000-8000-000000000000',
      p_reason: tag,
    });
    expect(unknown.error?.message).toContain('no such person');

    expect((await admin.from('people').select('id').eq('id', person)).data).toHaveLength(1);
  });

  it('shows the receipt to an admin only', async () => {
    const recruiter = await clientAs('recruiter');
    const { data, error } = await recruiter.from('erasure_log').select('id');
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('lets nobody delete a receipt, not even an admin', async () => {
    const person = await makeCandidate('permanent-receipt');
    const admin = await clientAs('admin');
    await admin.rpc('fn_erase_person', { p_person: person, p_reason: `${tag} permanence` });
    leftover.length = 0;

    const attempt = await admin.from('erasure_log').delete().eq('person_id', person);
    expect(attempt.error?.message).toContain('permission denied');

    const still = await admin.from('erasure_log').select('id').eq('person_id', person);
    expect(still.data, 'a receipt is the evidence the erasure happened').toHaveLength(1);
  });
});
