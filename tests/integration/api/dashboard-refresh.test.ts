import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { PERSONA_CREDENTIALS, SUPABASE_ANON_KEY, SUPABASE_URL, type Persona } from '../../support/env';

async function dashClient(persona: Persona) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'dash' } });
  const { email, password } = PERSONA_CREDENTIALS[persona];
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const GATE_KEYS = [
  'adoption_rate',
  'cycle_time_intake_to_submitted_days',
  'cycle_time_deal_created_to_won_days',
  'cost_monthly_total',
  'data_quality_dedup_rate',
  'data_quality_contact_completeness',
  'data_quality_grading_preserved',
];

describe('Dashboard refresh through the API', () => {
  it('an admin can refresh the materialized views without error', async () => {
    const admin = await dashClient('admin');
    const { error } = await admin.rpc('refresh_materialized_views');
    expect(error).toBeNull();
  });

  it('the refresh populates every gating success metric', async () => {
    const admin = await dashClient('admin');
    const { error: refreshErr } = await admin.rpc('refresh_materialized_views');
    expect(refreshErr).toBeNull();

    const { data, error } = await admin.from('vw_success_metrics').select('metric_key, unit');
    expect(error).toBeNull();
    const keys = new Set((data ?? []).map((r) => (r as { metric_key: string }).metric_key));
    for (const key of GATE_KEYS) {
      expect(keys.has(key), `${key} missing from vw_success_metrics after a refresh`).toBe(true);
    }
  });

  it('every metric carries a unit the UI knows how to format', async () => {
    const admin = await dashClient('admin');
    const { data } = await admin.from('vw_success_metrics').select('metric_key, unit');
    const allowed = new Set(['count', 'ratio', 'days', 'currency']);
    for (const row of (data ?? []) as { metric_key: string; unit: string | null }[]) {
      expect(allowed.has(row.unit ?? ''), `${row.metric_key} has unit ${row.unit}`).toBe(true);
    }
  });

  it('a recruiter cannot refresh the materialized views', async () => {
    const recruiter = await dashClient('recruiter');
    const { error } = await recruiter.rpc('refresh_materialized_views');
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/only admin/i);
  });
});
