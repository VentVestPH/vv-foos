import { afterAll, describe, expect, it } from 'vitest';
import { clientAs, SUPABASE_URL } from '../env';

const STATUS_URL = `${SUPABASE_URL}/functions/v1/careers-status`;

async function fetchStatus(token: string) {
  const res = await fetch(`${STATUS_URL}?token=${encodeURIComponent(token)}`);
  return { status: res.status, html: await res.text() };
}

let touchedStage: { id: string; stage: string } | null = null;

afterAll(async () => {
  if (!touchedStage) return;
  const admin = await clientAs('admin');
  const { error } = await admin
    .from('applications')
    .update({ stage: touchedStage.stage })
    .eq('id', touchedStage.id);
  if (error) throw new Error(`could not restore the application stage: ${error.message}`);
});

describe('Q7: an applicant can check their own application', () => {
  it('serves the status with no authentication at all', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin
      .from('applications')
      .select('status_token, display_code')
      .order('display_code')
      .limit(1)
      .single();
    expect(data?.status_token).toMatch(/^[0-9a-f-]{36}$/);

    const { status, html } = await fetchStatus(data!.status_token);
    expect(status).toBe(200);
    expect(html).toContain(data!.display_code);
    expect(html).toContain('<h2>');
  });

  it('never shows an internal stage name or another applicant\'s data', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin
      .from('applications')
      .select('status_token, person_id, stage')
      .order('display_code')
      .limit(1)
      .single();
    const { data: person } = await admin
      .from('people')
      .select('emails, phones')
      .eq('id', data!.person_id)
      .single();

    const { html } = await fetchStatus(data!.status_token);
    for (const internal of ['phone_screen', 'client_interview', 'screening']) {
      expect(html, `the applicant must not see the internal stage ${internal}`).not.toContain(
        internal,
      );
    }
    const email = (person?.emails as { address?: string }[])?.[0]?.address;
    if (email) expect(html, 'no contact detail belongs on a shareable link').not.toContain(email);
    const phone = (person?.phones as { number?: string }[])?.[0]?.number;
    if (phone) expect(html).not.toContain(phone);
  });

  it('reflects a stage change the recruiter makes', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin
      .from('applications')
      .select('id, stage, status_token')
      .order('display_code')
      .limit(1)
      .single();
    touchedStage = { id: data!.id, stage: data!.stage };

    const { error } = await admin
      .from('applications')
      .update({ stage: 'client_interview' })
      .eq('id', data!.id);
    expect(error, error?.message).toBeNull();

    const { html } = await fetchStatus(data!.status_token);
    expect(html).toContain('Interviewing');
    expect(html).toContain('interview stage for this role');
  });

  it('answers a wrong, malformed or missing token the same way, with no hint', async () => {
    const missing = await fetch(STATUS_URL);
    expect(missing.status).toBe(404);

    const malformed = await fetchStatus('not-a-uuid');
    expect(malformed.status).toBe(404);

    const wrong = await fetchStatus('00000000-0000-4000-8000-000000000000');
    expect(wrong.status).toBe(404);

    const bodies = [await missing.text(), malformed.html, wrong.html];
    expect(new Set(bodies).size, 'all three must be indistinguishable to an enumerator').toBe(1);
  });

  it('refuses anything but GET', async () => {
    const res = await fetch(STATUS_URL, { method: 'POST' });
    expect(res.status).toBe(405);
  });

  it('gives every application its own token, and anon cannot read the column', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin.from('applications').select('status_token');
    const tokens = (data ?? []).map((r) => r.status_token);
    expect(tokens.length).toBeGreaterThan(1);
    expect(new Set(tokens).size, 'a token must identify exactly one application').toBe(
      tokens.length,
    );

    const res = await fetch(`${SUPABASE_URL}/rest/v1/applications?select=status_token`, {
      headers: { apikey: process.env.FOOS_SUPABASE_ANON_KEY ?? '' },
    });
    const body = await res.text();
    expect(body).not.toContain(tokens[0] as string);
  });
});
