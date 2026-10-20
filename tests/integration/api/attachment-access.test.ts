import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientAs } from '../../support/env';
import { SEED_PEOPLE_IDS } from '../../support/fixtures/seed-ids';

const BUCKET = 'attachments';
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);

let ownedPersonId: string;
let foreignPersonId: string;
let ownedPath: string;
let foreignPath: string;
const paths: string[] = [];
const attachmentIds: string[] = [];

async function attach(personId: string, label: string) {
  const admin = await clientAs('admin');
  const path = `person/${personId}/qa-access-${label}-${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, new Blob([PDF], { type: 'application/pdf' }));
  if (upErr) throw upErr;
  paths.push(path);

  const { data, error } = await admin
    .from('attachments')
    .insert({ storage_path: path, parent_type: 'person', parent_id: personId, kind: 'resume' })
    .select('id')
    .single();
  if (error) throw error;
  attachmentIds.push(data.id);
  return path;
}

describe('Attachment access follows parent-record read access (criterion 1.16)', () => {
  beforeAll(async () => {
    const sourcer = await clientAs('sourcer');
    const { data: visible, error } = await sourcer
      .from('people')
      .select('id')
      .in('id', SEED_PEOPLE_IDS);
    if (error) throw error;
    expect(visible?.length ?? 0).toBeGreaterThan(0);
    ownedPersonId = visible![0].id;

    const foreign = SEED_PEOPLE_IDS.find((id) => !visible!.some((v) => v.id === id));
    expect(foreign, 'need a seeded person the sourcer cannot see').toBeTruthy();
    foreignPersonId = foreign!;

    ownedPath = await attach(ownedPersonId, 'owned');
    foreignPath = await attach(foreignPersonId, 'foreign');
  });

  afterAll(async () => {
    const admin = await clientAs('admin');
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    for (const id of attachmentIds) await admin.from('attachments').delete().eq('id', id);
  });

  it('the sourcer can list the attachment row for a candidate they source', async () => {
    const sourcer = await clientAs('sourcer');
    const path = ownedPath;
    const { data, error } = await sourcer
      .from('attachments')
      .select('id, storage_path')
      .eq('storage_path', path);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('the sourcer cannot see the attachment row for a candidate they do not source', async () => {
    const sourcer = await clientAs('sourcer');
    const path = foreignPath;
    const { data, error } = await sourcer
      .from('attachments')
      .select('id')
      .eq('storage_path', path);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('the sourcer cannot download a foreign candidate resume from storage', async () => {
    const sourcer = await clientAs('sourcer');
    const { data, error } = await sourcer.storage.from(BUCKET).download(foreignPath);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('an admin can download any attachment', async () => {
    const admin = await clientAs('admin');
    expect(paths).toEqual([ownedPath, foreignPath]);
    for (const path of paths) {
      const { data, error } = await admin.storage.from(BUCKET).download(path);
      expect(error, `admin download failed for ${path}`).toBeNull();
      expect(data).not.toBeNull();
    }
  });

  it('a bd user cannot download a candidate resume at all', async () => {
    const bd = await clientAs('bd');
    expect(paths).toEqual([ownedPath, foreignPath]);
    for (const path of paths) {
      const { data, error } = await bd.storage.from(BUCKET).download(path);
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    }
  });
});
