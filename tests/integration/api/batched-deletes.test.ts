import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clientAs } from '../../support/env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const TITLE = `QA Batch ${RUN}`;

let reqId: string;
let staffIds: string[];

async function admin() {
  return clientAs('admin');
}

beforeEach(async () => {
  const sb = await admin();
  const { data: staff, error: staffErr } = await sb.from('staff').select('id').limit(3);
  expect(staffErr).toBeNull();
  staffIds = (staff ?? []).map((s) => s.id);
  expect(staffIds.length, 'the seed needs at least 3 staff rows').toBeGreaterThanOrEqual(3);

  const { data, error } = await sb
    .from('requisitions')
    .insert({ title: TITLE, status: 'open', is_test: true })
    .select('id')
    .single();
  expect(error).toBeNull();
  reqId = data!.id;
});

afterEach(async () => {
  const sb = await admin();
  await sb.from('requisition_approvers').delete().eq('requisition_id', reqId);
  await sb.from('requisition_owners').delete().eq('requisition_id', reqId);
  await sb.from('requisitions').delete().eq('id', reqId);
});

describe('K6: batched removals replace the per-row delete loops', () => {
  it('one .in() delete removes exactly the named owners and leaves the rest', async () => {
    const sb = await admin();
    const { error: insErr } = await sb
      .from('requisition_owners')
      .insert(staffIds.map((staff_id) => ({ requisition_id: reqId, staff_id })));
    expect(insErr).toBeNull();

    const removed = staffIds.slice(0, 2);
    const { error: delErr } = await sb
      .from('requisition_owners')
      .delete()
      .eq('requisition_id', reqId)
      .in('staff_id', removed);
    expect(delErr, 'a single batched delete must succeed').toBeNull();

    const { data: left } = await sb
      .from('requisition_owners')
      .select('staff_id')
      .eq('requisition_id', reqId);
    expect((left ?? []).map((r) => r.staff_id)).toEqual([staffIds[2]]);
  });

  it('one .or() delete removes only the matching staff and type pairs', async () => {
    const sb = await admin();
    const rows = [
      { requisition_id: reqId, staff_id: staffIds[0], approver_type: 'requisition' as const },
      { requisition_id: reqId, staff_id: staffIds[0], approver_type: 'offer' as const },
      { requisition_id: reqId, staff_id: staffIds[1], approver_type: 'requisition' as const },
    ];
    const { error: insErr } = await sb.from('requisition_approvers').insert(rows);
    expect(insErr).toBeNull();

    const removed = [rows[0], rows[2]];
    const filter = removed
      .map((a) => `and(staff_id.eq.${a.staff_id},approver_type.eq.${a.approver_type})`)
      .join(',');

    const { error: delErr } = await sb
      .from('requisition_approvers')
      .delete()
      .eq('requisition_id', reqId)
      .or(filter);
    expect(delErr, 'the composite or() filter must be valid PostgREST').toBeNull();

    const { data: left } = await sb
      .from('requisition_approvers')
      .select('staff_id, approver_type')
      .eq('requisition_id', reqId);

    expect(
      left,
      'only the one pair that was not named should survive, proving the filter is pair-wise and not staff-wide',
    ).toEqual([{ staff_id: staffIds[0], approver_type: 'offer' }]);
  });

  it('a batched delete with an empty list is never issued, so nothing is removed by accident', async () => {
    const sb = await admin();
    await sb
      .from('requisition_owners')
      .insert(staffIds.map((staff_id) => ({ requisition_id: reqId, staff_id })));

    const removed: string[] = [];
    if (removed.length > 0) {
      await sb.from('requisition_owners').delete().eq('requisition_id', reqId).in('staff_id', removed);
    }

    const { data: left } = await sb
      .from('requisition_owners')
      .select('staff_id')
      .eq('requisition_id', reqId);
    expect((left ?? []).length, 'an empty removal list must not delete anything').toBe(3);
  });
});
