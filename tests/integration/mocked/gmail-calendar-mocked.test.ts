import { afterAll, describe, expect, it } from 'vitest';
import 'dotenv/config';
import { clientAs, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../support/env';

const PARSER_URL = `${SUPABASE_URL}/functions/v1/intake-email-parser`;
const INTAKE_SECRET = (() => {
  const value = process.env.FOOS_INTAKE_PARSER_SECRET;
  if (!value) {
    throw new Error(
      'FOOS_INTAKE_PARSER_SECRET is not set. intake-email-parser fails closed and returns 503 ' +
        'without INTAKE_EMAIL_PARSER_SECRET configured, so this test needs the matching value. ' +
        'See supabase/functions/.env.example and tests/.env.example.',
    );
  }
  return value;
})();

const FAKE_PDF_BASE64 = Buffer.from('%PDF-1.4\n%QA mock resume\n').toString('base64');

let createdIntakeItemId: string | null = null;

describe('Mocked Gmail: intake-email-parser webhook contract', () => {
  afterAll(async () => {
    if (!createdIntakeItemId) return;
    const admin = await clientAs('admin');

    const { data: item } = await admin
      .from('intake_items')
      .select('parsed')
      .eq('id', createdIntakeItemId)
      .maybeSingle();
    const staged = (item?.parsed as { attachments?: { storage_path?: string }[] } | null)?.attachments ?? [];
    const stagedPaths = staged.map((a) => a.storage_path).filter((p): p is string => Boolean(p));

    for (const path of stagedPaths) {
      const { data: temp } = await admin
        .from('attachments')
        .insert({
          storage_path: path,
          parent_type: 'intake_item',
          parent_id: createdIntakeItemId,
          kind: 'resume',
        })
        .select('id')
        .single();
      await admin.storage.from('attachments').remove([path]);
      if (temp) await admin.from('attachments').delete().eq('id', temp.id);
    }

    await admin.from('attachments').delete().eq('parent_id', createdIntakeItemId);
    await admin.from('intake_items').delete().eq('id', createdIntakeItemId);
  });

  it('a mocked inbound email with a resume attachment becomes a parsed intake_items row', async () => {
    const admin = await clientAs('admin');
    const res = await fetch(PARSER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        'x-intake-secret': INTAKE_SECRET,
      },
      body: JSON.stringify({
        staffId: 'a0000000-0000-4000-8000-000000000002', 
        label: 'FOOS/Candidates',
        message: {
          id: `qa-mock-${Date.now()}`,
          from: '"QA Mock Candidate" <qa-mock-candidate@example.com>',
          to: ['recruiting@ventvest.com'],
          subject: 'Application for Backend Engineer role',
          bodyText: 'Hi, please find my resume attached for the backend engineer position.',
          date: new Date().toISOString(),
          attachments: [
            { filename: 'resume.pdf', mimeType: 'application/pdf', contentBase64: FAKE_PDF_BASE64 },
          ],
        },
      }),
    });
    expect(res.status).toBeLessThan(300);
    const body = await res.json();
    expect(body.intakeItemId ?? body.id).toBeTruthy();
    createdIntakeItemId = body.intakeItemId ?? body.id;

    const { data: item, error: itemErr } = await admin
      .from('intake_items')
      .select('channel, status, target_type, full_name, parsed, raw_payload')
      .eq('id', createdIntakeItemId!)
      .single();
    expect(itemErr).toBeNull();
    expect(item?.channel).toBe('email');
    expect(item?.target_type).toBe('candidate');
    expect(item?.full_name).toContain('QA Mock Candidate');

    const parsed = item?.parsed as { attachments?: { kind: string; filename: string }[] } | null;
    expect(parsed?.attachments?.length ?? 0).toBeGreaterThan(0);
    expect(parsed?.attachments?.[0].kind).toBe('resume');
    expect(parsed?.attachments?.[0].filename).toBe('resume.pdf');

    const raw = item?.raw_payload as { attachment_filenames?: string[] } | null;
    expect(raw?.attachment_filenames).toContain('resume.pdf');
  });

  it('rejects a payload missing message.from', async () => {
    const res = await fetch(PARSER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        'x-intake-secret': INTAKE_SECRET,
      },
      body: JSON.stringify({ staffId: 'a0000000-0000-4000-8000-000000000002', label: 'x', message: { id: 'bad' } }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
