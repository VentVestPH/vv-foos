import { afterAll, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const BUCKET = 'attachments';
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const CANDIDATE = 'b0000000-0000-4000-8000-000000000001';

const paths: string[] = [];

describe('Deleting an attachment queues its file for removal (D26)', () => {
  afterAll(async () => {
    const admin = await clientAs('admin');
    if (paths.length) {
      for (const path of paths) {
        const { data: row } = await admin
          .from('attachments')
          .insert({ storage_path: path, parent_type: 'person', parent_id: CANDIDATE, kind: 'other' })
          .select('id')
          .maybeSingle();
        await admin.storage.from(BUCKET).remove([path]);
        if (row) await admin.from('attachments').delete().eq('id', row.id);
      }
      await admin.from('attachment_deletion_queue').delete().in('storage_path', paths);
    }
  });

  it('records the storage path when the attachments row is deleted', async () => {
    const admin = await clientAs('admin');
    const path = `person/${CANDIDATE}/qa-queue-${Date.now()}.pdf`;

    const up = await admin.storage
      .from(BUCKET)
      .upload(path, new Blob([PDF], { type: 'application/pdf' }));
    expect(up.error).toBeNull();
    paths.push(path);

    const { data: row, error: insErr } = await admin
      .from('attachments')
      .insert({ storage_path: path, parent_type: 'person', parent_id: CANDIDATE, kind: 'resume' })
      .select('id')
      .single();
    expect(insErr).toBeNull();

    const { error: delErr } = await admin.from('attachments').delete().eq('id', row!.id);
    expect(delErr).toBeNull();

    const { data: queued, error: qErr } = await admin
      .from('attachment_deletion_queue')
      .select('storage_path, parent_type, parent_id, deleted_at')
      .eq('storage_path', path);
    expect(qErr).toBeNull();
    expect(queued).toHaveLength(1);
    expect(queued![0].parent_type).toBe('person');
    expect(queued![0].parent_id).toBe(CANDIDATE);
    expect(queued![0].deleted_at).toBeNull();
  });

  it('is readable only by an admin, because a path contains a person id', async () => {
    for (const persona of ['recruiter', 'sourcer', 'bd'] as const) {
      const client = await clientAs(persona);
      const { data, error } = await client.from('attachment_deletion_queue').select('id');
      expect(error === null ? (data ?? []).length : 0, `${persona} should see nothing`).toBe(0);
    }
  });

  it('does not queue anything when no attachment is deleted', async () => {
    const admin = await clientAs('admin');
    const { count: before } = await admin
      .from('attachment_deletion_queue')
      .select('id', { count: 'exact', head: true });

    await admin.from('attachments').select('id').limit(1);

    const { count: after } = await admin
      .from('attachment_deletion_queue')
      .select('id', { count: 'exact', head: true });
    expect(after).toBe(before);
  });
});
