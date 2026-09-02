import { afterEach, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const EVENT = `qa.retention.${RUN}`;

afterEach(async () => {
  const admin = await clientAs('admin');
  await admin.from('events_outbox').delete().eq('event_name', EVENT);
});

describe('O2: retention prunes aged rows and nothing else', () => {
  it('keeps a policy row per table, admin readable only', async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin.from('retention_policy').select('table_name, keep_days');
    expect(error).toBeNull();
    const byTable = new Map((data ?? []).map((r) => [r.table_name, r.keep_days]));
    expect(byTable.get('audit_log'), 'an audit trail keeps a year, not a month').toBe(365);
    expect(byTable.get('events_outbox')).toBe(7);

    const recruiter = await clientAs('recruiter');
    const { data: asRecruiter } = await recruiter
      .from('retention_policy')
      .select('table_name');
    expect(asRecruiter ?? [], 'retention is an admin concern').toHaveLength(0);
  });

  it('an application session cannot write events_outbox at all, so retention cannot be gamed', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('events_outbox').insert({
      event_name: EVENT,
      aggregate_id: crypto.randomUUID(),
      payload: {},
      processed_at: new Date().toISOString(),
    });
    expect(
      error?.code,
      'the outbox is trigger-owned; if this ever succeeds the pipeline invariant is gone',
    ).toBe('42501');
  });

  it('the prune function is not callable by an ordinary session', async () => {
    for (const role of ['recruiter', 'sourcer', 'bd'] as const) {
      const client = await clientAs(role);
      const { error } = await client.rpc('fn_prune_retained_rows');
      expect(error, `${role} must not be able to prune the audit trail`).not.toBeNull();
    }
  });
});
