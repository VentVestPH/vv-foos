import { afterAll, describe, expect, it } from 'vitest';
import { clientAs, type Persona } from '../env';

const tag = `qa-client-error-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('client_errors').delete().like('message', `${tag}%`);
  if (error) throw new Error(`could not clean up client_errors: ${error.message}`);
});

async function record(persona: Persona, message: string) {
  const client = await clientAs(persona);
  return client.from('client_errors').insert({ origin: 'test', message, route: '/recruit/candidates' });
}

describe('client_errors is write-only for staff and readable only by an admin', () => {
  it('lets every role record a failure', async () => {
    for (const persona of ['admin', 'recruiter', 'sourcer', 'bd'] as const) {
      const { error } = await record(persona, `${tag} ${persona}`);
      expect(error, `${persona}: ${error?.message}`).toBeNull();
    }
  });

  it('refuses to read back the row it just wrote, because staff cannot select', async () => {
    const recruiter = await clientAs('recruiter');
    const { data, error } = await recruiter
      .from('client_errors')
      .insert({ origin: 'test', message: `${tag} returning` })
      .select('id')
      .single();
    expect(data).toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('stamps the reporter from the JWT and rejects a spoofed one', async () => {
    const sourcer = await clientAs('sourcer');
    const me = await sourcer.auth.getUser();

    const spoof = await sourcer.from('client_errors').insert({
      origin: 'test',
      message: `${tag} spoof`,
      staff_id: '00000000-0000-4000-8000-000000000000',
    });
    expect(spoof.error?.code).toBe('42501');

    const honest = await sourcer
      .from('client_errors')
      .insert({ origin: 'test', message: `${tag} honest` });
    expect(honest.error, honest.error?.message).toBeNull();

    const admin = await clientAs('admin');
    const { data } = await admin
      .from('client_errors')
      .select('staff_id, message')
      .eq('message', `${tag} honest`)
      .single();
    expect(data?.staff_id).toBe(me.data.user?.id);
  });

  it('hides every row from a non-admin, including their own', async () => {
    const recruiter = await clientAs('recruiter');
    const { data, error } = await recruiter
      .from('client_errors')
      .select('id')
      .like('message', `${tag}%`);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('shows an admin what every role reported', async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin
      .from('client_errors')
      .select('origin, message, route')
      .like('message', `${tag}%`);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(4);
    expect(data?.every((row) => row.route === '/recruit/candidates' || row.route === null)).toBe(true);
  });

  it('refuses a message longer than the column allows instead of truncating it', async () => {
    const { error } = await record('admin', `${tag}${'x'.repeat(2100)}`);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/client_errors_message_len|check constraint/);
  });

  it('lets an admin clear the log but nobody else', async () => {
    const message = `${tag} deletable`;
    expect((await record('recruiter', message)).error).toBeNull();

    const recruiter = await clientAs('recruiter');
    const refused = await recruiter.from('client_errors').delete().eq('message', message);
    expect(refused.error).toBeNull();

    const admin = await clientAs('admin');
    const still = await admin.from('client_errors').select('id').eq('message', message);
    expect(still.data).toHaveLength(1);

    const cleared = await admin.from('client_errors').delete().eq('message', message);
    expect(cleared.error, cleared.error?.message).toBeNull();
    const gone = await admin.from('client_errors').select('id').eq('message', message);
    expect(gone.data).toHaveLength(0);
  });

  it('is covered by the retention policy', async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin
      .from('retention_policy')
      .select('keep_days')
      .eq('table_name', 'client_errors')
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.keep_days).toBe(30);
  });
});
