// Mocked Gmail/Calendar integration smoke tests (brief instruction 4).
//
// Real limitation, documented rather than papered over: `google-sync`,
// `gmail-send`, and `calendar-create-meeting` call googleapis.com directly
// with no injectable base URL, so there's no way to intercept those
// specific outbound calls without adding a testability seam to Agent 6's
// Edge Functions (a small, reasonable follow-up — see DEFECT_LOG.md — but
// not done this pass since it means touching Agent 6's code rather than
// QA's own).
//
// What IS genuinely mockable without touching any Agent 6 code:
// `intake-email-parser` (Agent 5/6's agreed handoff contract) is a webhook
// *receiver* — it takes pre-parsed message JSON as input rather than
// calling Gmail itself, so posting a synthetic payload here really is
// "Gmail mocked at the boundary," not a fake. This is the one piece of
// instruction 4 that's fully covered by an actual mock; the rest
// (thread/event sync, send, create-with-Meet-link) were already
// live-tested against John's real account during Agent 6's build (see
// foos/supabase/functions/README-agent6.md) and are re-verified via the
// gated live-account script in tests/live/, not re-mocked here.
// Note (2026-07-25): live-attempted this call via Claude in Chrome during
// QA build and got 401 Unauthorized — `intake-email-parser` is protected by
// an `x-intake-secret` header check (`INTAKE_EMAIL_PARSER_SECRET`), and that
// secret is already set as a real Edge Function secret from whenever Agent 5
// originally deployed it (unlike GOOGLE_SYNC_SECRET, which QA found unset
// and worked around via a DB-stored fallback during Agent 6 — see
// README-agent6.md). QA doesn't have that secret's value in this
// environment. Set FOOS_INTAKE_PARSER_SECRET in tests/.env to actually run
// this file; without it, these tests are written and correct but unverified
// this pass — tracked as a GAP in RETEST_MATRIX.md, not silently assumed
// green.
import { afterAll, describe, expect, it } from 'vitest';
import 'dotenv/config';
import { clientAs, SUPABASE_ANON_KEY, SUPABASE_URL } from '../env';

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

// A minimal, valid PDF so the parser's resume-extension check and Storage
// upload both succeed against a real (tiny, synthetic) file.
const FAKE_PDF_BASE64 = Buffer.from('%PDF-1.4\n%QA mock resume\n').toString('base64');

let createdIntakeItemId: string | null = null;

describe('Mocked Gmail: intake-email-parser webhook contract', () => {
  afterAll(async () => {
    if (!createdIntakeItemId) return;
    const admin = await clientAs('admin');
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
        staffId: 'a0000000-0000-4000-8000-000000000002', // Rita, recruiter
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
