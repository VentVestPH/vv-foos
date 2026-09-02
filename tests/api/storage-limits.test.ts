import { afterAll, describe, expect, it } from 'vitest';
import { clientAs } from '../env';
import { SEED_PEOPLE_IDS } from '../fixtures/seed-ids';

const BUCKET = 'attachments';
const PERSON = SEED_PEOPLE_IDS[1];
const tag = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const paths: string[] = [];
const rows: string[] = [];

function path(name: string): string {
  const p = `person/${PERSON}/qa-limits-${tag}-${name}`;
  paths.push(p);
  return p;
}

async function register(storagePath: string) {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('attachments')
    .insert({ storage_path: storagePath, parent_type: 'person', parent_id: PERSON, kind: 'other' })
    .select('id')
    .single();
  if (error) throw error;
  rows.push(data.id);
}

afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.storage.from(BUCKET).remove(paths);
  if (rows.length) await admin.from('attachments').delete().in('id', rows);
});

describe('the attachments bucket rejects what the app must never store', () => {
  it('refuses an SVG, which Storage would serve as a rendering document', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path('x.svg'), new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }));
    expect(error).not.toBeNull();
    expect(error?.message).toContain('mime type');
  });

  it('refuses HTML for the same reason', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path('x.html'), new Blob(['<h1>hi</h1>'], { type: 'text/html' }));
    expect(error).not.toBeNull();
    expect(error?.message).toContain('mime type');
  });

  it('still accepts the document types recruiters actually attach', async () => {
    const admin = await clientAs('admin');
    const pdf = await admin.storage
      .from(BUCKET)
      .upload(path('ok.pdf'), new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }));
    expect(pdf.error, pdf.error?.message).toBeNull();
    await register(pdf.data!.path);

    const docx = await admin.storage.from(BUCKET).upload(
      path('ok.docx'),
      new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );
    expect(docx.error, docx.error?.message).toBeNull();
    await register(docx.data!.path);
  });

  it('accepts a file the browser could not type, so nothing legitimate is blocked', async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin.storage
      .from(BUCKET)
      .upload(path('unknown.bin'), new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' }));
    expect(error, error?.message).toBeNull();
    await register(data!.path);
  });
});
