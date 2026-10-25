import { afterAll, describe, expect, it } from 'vitest';
import { clientAs } from '../../support/env';

const KNOWN_PERSON_ID = 'b0000000-0000-4000-8000-000000000001';

describe('Cross-module flow: intake dedup', () => {
  let knownEmail: string;
  let knownLinkedIn: string | null;

  afterAll(async () => {

  });

  it('reads the known seed person\'s email/linkedin for use as dedup input', async () => {
    const admin = await clientAs('admin');
    const { data: person } = await admin
      .from('people')
      .select('emails, linkedin_public_url')
      .eq('id', KNOWN_PERSON_ID)
      .single();
    expect(person).not.toBeNull();
    const emails = (person!.emails as { address: string }[]) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    knownEmail = emails[0].address;
    knownLinkedIn = person!.linkedin_public_url ?? null;
  });

  it('matches on exact email', async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin.rpc('find_person_by_email', { p_email: knownEmail });
    expect(error).toBeNull();
    expect(data).toBe(KNOWN_PERSON_ID);
  });

  it('matches on email with different case', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin.rpc('find_person_by_email', {
      p_email: knownEmail.toUpperCase(),
    });
    expect(data).toBe(KNOWN_PERSON_ID);
  });

  it('matches on email with surrounding whitespace', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin.rpc('find_person_by_email', {
      p_email: `  ${knownEmail}  `,
    });
    expect(data).toBe(KNOWN_PERSON_ID);
  });

  it('matches on linkedin_url when present', async () => {
    if (!knownLinkedIn) {

      expect(knownLinkedIn).toBeNull();
      return;
    }
    const admin = await clientAs('admin');
    const { data } = await admin.rpc('find_person_by_linkedin', { p_url: knownLinkedIn });
    expect(data).toBe(KNOWN_PERSON_ID);
  });

  it('does not match a genuinely new email', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin.rpc('find_person_by_email', {
      p_email: 'definitely-not-a-seeded-address@ventvest.test',
    });
    expect(data).toBeNull();
  });
});
