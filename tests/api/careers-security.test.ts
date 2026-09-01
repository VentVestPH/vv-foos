import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientAs, SUPABASE_ANON_KEY, SUPABASE_URL } from '../env';

const APPLY_URL = `${SUPABASE_URL}/functions/v1/careers-apply`;
const PAGE_URL = `${SUPABASE_URL}/functions/v1/careers-page`;

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

let publishedReqId: string;
let unpublishedReqId: string;
let testFlaggedReqId: string;
const createdEmails: string[] = [];

const RUN_ID = Math.random().toString(36).slice(2, 10);
let ipCounter = 0;

function ip() {
  ipCounter += 1;
  return `test-${RUN_ID}-${ipCounter}`;
}

function form(overrides: Record<string, string | File> = {}, resume: File | null = defaultResume()) {
  const f = new FormData();
  f.set('requisition_id', publishedReqId);
  f.set('full_name', 'Qa SecurityProbe');
  f.set('email', `qa-sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  f.set('phone', '+63 917 000 0000');
  f.set('consent', 'true');
  if (resume) f.set('resume', resume);
  for (const [k, v] of Object.entries(overrides)) f.set(k, v);
  return f;
}

function defaultResume() {
  return new File([PDF], 'ok.pdf', { type: 'application/pdf' });
}

async function submit(body: FormData, sourceIp = ip()) {
  const res = await fetch(APPLY_URL, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'x-forwarded-for': sourceIp },
    body,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null };
}

describe('Careers endpoint security (criteria 4.1, 4.5, 4.6, 4.7, 4.8)', () => {
  beforeAll(async () => {
    const host = new URL(SUPABASE_URL).hostname;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
      throw new Error(`Refusing to run against ${host}: this suite publishes real requisitions.`);
    }
    const admin = await clientAs('admin');
    const mk = async (title: string, is_published: boolean, is_test: boolean) => {
      const { data, error } = await admin
        .from('requisitions')
        .insert({ title, status: 'open', is_published, is_test })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    };
    publishedReqId = await mk('QA Sec: Published Open Requisition', true, false);
    unpublishedReqId = await mk('QA Sec: Unpublished Requisition', false, false);
    testFlaggedReqId = await mk('QA Sec: Test-Flagged Requisition', true, true);
  });

  afterAll(async () => {
    const admin = await clientAs('admin');
    for (const email of createdEmails) {
      const { data: people } = await admin
        .from('people')
        .select('id')
        .contains('emails', JSON.stringify([{ address: email }]));
      for (const row of people ?? []) {
        await admin.from('applications').delete().eq('person_id', row.id);
        const { data: files } = await admin
          .from('attachments')
          .select('storage_path')
          .eq('parent_id', row.id);
        const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean);
        if (paths.length) await admin.storage.from('attachments').remove(paths);
        await admin.from('attachments').delete().eq('parent_id', row.id);
        await admin.from('candidate_profiles').delete().eq('person_id', row.id);
        await admin.from('people').delete().eq('id', row.id);
      }
    }
    await admin.from('intake_items').delete().ilike('full_name', 'Qa SecurityProbe%');
    for (const id of [publishedReqId, unpublishedReqId, testFlaggedReqId]) {
      if (id) {
        await admin.from('applications').delete().eq('requisition_id', id);
        await admin.from('requisitions').delete().eq('id', id);
      }
    }
  });

  it('4.1 listing shows the published non-test requisition and hides the other two', async () => {
    const res = await fetch(PAGE_URL);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('QA Sec: Published Open Requisition');
    expect(html).not.toContain('QA Sec: Unpublished Requisition');
    expect(html).not.toContain('QA Sec: Test-Flagged Requisition');
  });

  it('4.1 apply refuses an unpublished requisition and a test-flagged one', async () => {
    for (const id of [unpublishedReqId, testFlaggedReqId]) {
      const { status, body } = await submit(form({ requisition_id: id }));
      expect(status).toBe(400);
      expect(body?.message).toMatch(/no longer accepting/i);
    }
  });

  it('4.2 the sitemap lists the published role, and robots.txt points at it', async () => {
    const robots = await fetch(`${PAGE_URL}/robots.txt`);
    expect(robots.status).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toMatch(/User-agent: \*/);
    expect(robotsText).toMatch(/Sitemap: .*\/sitemap\.xml/);

    const sitemap = await fetch(`${PAGE_URL}/sitemap.xml`);
    expect(sitemap.status).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain('<urlset');
    expect(xml).toMatch(/<loc>[^<]*\/jobs\/qa-sec-published-open-requisition-req-\d+<\/loc>/i);
    expect(xml).not.toMatch(/unpublished-requisition/i);
    expect(xml).not.toMatch(/test-flagged-requisition/i);
  });

  it('4.2 a job detail page carries JobPosting structured data', async () => {
    const listing = await (await fetch(PAGE_URL)).text();
    const hrefs = [...listing.matchAll(/href="([^"]*\/jobs\/[^"]+)"/g)].map((m) => m[1]);
    const own = hrefs.find((h) => h.includes('qa-sec-published-open-requisition'));
    expect(own, `listing should link to this suite's own requisition; saw ${hrefs.join(', ')}`).toBeTruthy();

    const slug = own!.slice(own!.indexOf('/jobs/'));
    const detail = await fetch(`${PAGE_URL}${slug}`);
    expect(detail.status).toBe(200);
    const html = await detail.text();
    expect(html).toContain('application/ld+json');
    expect(html).toMatch(/"@type"\s*:\s*"JobPosting"/);
    expect(html).toMatch(/"@type"\s*:\s*"Organization"/);
    expect(html).toContain('QA Sec: Published Open Requisition');
  });

  it('4.7 rejects a renamed executable disguised as a PDF', async () => {
    const { status, body } = await submit(
      form({}, new File([EXE], 'resume.pdf', { type: 'application/pdf' })),
    );
    expect(status).toBe(400);
    expect(body?.message).toMatch(/valid PDF|re-export/i);
  });

  it('4.7 rejects a disallowed extension even with valid content', async () => {
    const { status, body } = await submit(
      form({}, new File([PDF], 'resume.exe', { type: 'application/octet-stream' })),
    );
    expect(status).toBe(400);
    expect(body?.message).toMatch(/PDF, DOC, or DOCX/i);
  });

  it('4.7 rejects a resume over the 10 MB limit', async () => {
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1024);
    oversized.set(PDF, 0);
    const { status, body } = await submit(
      form({}, new File([oversized], 'huge.pdf', { type: 'application/pdf' })),
    );
    expect(status).toBe(400);
    expect(body?.message).toMatch(/10 MB/i);
  });

  it('4.8 blocks a submission with consent unchecked, server-side', async () => {
    for (const consent of ['', 'false', 'off']) {
      const { status, body } = await submit(form({ consent }));
      expect(status).toBe(400);
      expect(body?.message).toMatch(/privacy notice/i);
    }
  });

  it('4.6 silently drops a honeypot submission without creating a person', async () => {
    const email = `qa-sec-honeypot-${Date.now()}@example.com`;
    const { status, body } = await submit(form({ email, company_website: 'https://spam.example' }));
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);

    const admin = await clientAs('admin');
    const { data: people } = await admin
      .from('people')
      .select('id')
      .contains('emails', JSON.stringify([{ address: email }]));
    expect(people).toHaveLength(0);
  });

  it('4.6 rate-limits the sixth submission from one IP within the hour', async () => {
    const sourceIp = ip();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const email = `qa-sec-rate-${Date.now()}-${i}@example.com`;
      createdEmails.push(email);
      const { status } = await submit(form({ email }), sourceIp);
      statuses.push(status);
    }
    expect(statuses.slice(0, 5).every((s) => s < 300)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('4.5 a duplicate submission for the same requisition and email yields one application', async () => {
    const email = `qa-sec-dup-${Date.now()}@example.com`;
    createdEmails.push(email);

    const first = await submit(form({ email }));
    expect(first.status).toBeLessThan(300);
    const second = await submit(form({ email }));
    expect(second.status).toBeLessThan(300);

    const admin = await clientAs('admin');
    const { data: people } = await admin
      .from('people')
      .select('id')
      .contains('emails', JSON.stringify([{ address: email }]));
    expect(people).toHaveLength(1);

    const { data: apps } = await admin
      .from('applications')
      .select('id')
      .eq('requisition_id', publishedReqId)
      .eq('person_id', people![0].id);
    expect(apps).toHaveLength(1);
  });
});
