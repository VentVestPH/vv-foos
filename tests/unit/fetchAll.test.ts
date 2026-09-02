import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows } from '../../app/src/lib/fetchAll';

function pagedSource(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const page = (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { page, calls };
}

describe('fetchAllRows', () => {
  it('returns everything when the source fits in one page', async () => {
    const { page, calls } = pagedSource(10);
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(10);
    expect(calls).toEqual([[0, 999]]);
  });

  it('pages past the PostgREST 1000-row ceiling, which is the bug it exists for', async () => {
    const { page, calls } = pagedSource(5007);
    const rows = await fetchAllRows(page);
    expect(rows, 'all 5007 rows, not the first 1000').toHaveLength(5007);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [3000, 3999],
      [4000, 4999],
      [5000, 5999],
    ]);
  });

  it('stops on a short page rather than looping forever', async () => {
    const { page, calls } = pagedSource(1000);
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(1000);
    expect(calls, 'one full page then one empty page proves termination').toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('handles an empty source', async () => {
    const { page } = pagedSource(0);
    expect(await fetchAllRows(page)).toEqual([]);
  });

  it('throws the source error instead of silently returning a partial set', async () => {
    const page = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchAllRows(page)).rejects.toThrow('boom');
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error that appears on a later page', async () => {
    let call = 0;
    const page = () => {
      call += 1;
      if (call === 1) {
        return Promise.resolve({
          data: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: 'page 2 failed' } });
    };
    await expect(fetchAllRows(page)).rejects.toThrow('page 2 failed');
  });
});
