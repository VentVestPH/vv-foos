import { afterEach, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];

async function seededCompanyId(): Promise<string> {
  const admin = await clientAs('admin');
  const { data } = await admin.from('companies').select('id').order('id').limit(1);
  const id = data?.[0]?.id as string | undefined;
  expect(id, 'a company to hang the seeded deal from').toBeTruthy();
  return id as string;
}

afterEach(async () => {
  if (created.length === 0) return;
  const admin = await clientAs('admin');
  await admin.from('deals').delete().in('id', created);
  created.length = 0;
});

describe('B3: deals.probability is a percentage and the database enforces it', () => {
  it('accepts 0 to 100 on a record it creates and removes', async () => {
    const admin = await clientAs('admin');
    const companyId = await seededCompanyId();
    const { data, error } = await admin
      .from('deals')
      .insert({
        name: `QA probability ${RUN}`,
        company_id: companyId,
        stage: 'lead',
        probability: 60,
        is_test: true,
      })
      .select('id, probability')
      .single();
    expect(error).toBeNull();
    if (data) created.push(data.id);
    expect(Number(data?.probability)).toBe(60);
  });

  it('cannot refuse a fraction, and that is why the seed and the form carry the contract', async () => {
    const admin = await clientAs('admin');
    const companyId = await seededCompanyId();
    const { data, error } = await admin
      .from('deals')
      .insert({
        name: `QA probability fraction ${RUN}`,
        company_id: companyId,
        stage: 'lead',
        probability: 0.5,
        is_test: true,
      })
      .select('id, probability')
      .single();
    if (data) created.push(data.id);
    expect(error, '0.5 is a valid half-percent, so no check constraint can reject it').toBeNull();
    expect(Number(data?.probability)).toBe(0.5);
  });

  it('refuses a value above 100', async () => {
    const admin = await clientAs('admin');
    const companyId = await seededCompanyId();
    const { data, error } = await admin
      .from('deals')
      .insert({
        name: `QA probability high ${RUN}`,
        company_id: companyId,
        stage: 'lead',
        probability: 101,
        is_test: true,
      })
      .select('id');
    if (data?.[0]?.id) created.push(data[0].id);
    expect(error?.message ?? '').toContain('deals_probability_pct');
  });

  it('leaves the seeded deals as whole percentages', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin.from('deals').select('probability').not('probability', 'is', null);
    for (const row of data ?? []) {
      const p = Number(row.probability);
      expect(p, 'no stored probability may be a fraction below 1').not.toBeLessThan(1);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});
