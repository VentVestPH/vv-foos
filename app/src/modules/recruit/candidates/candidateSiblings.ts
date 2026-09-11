import { supabase } from '../../../lib/supabase';

const WINDOW = 200;

interface SortKey {
  last_name: string | null;
  person_id: string;
}

export interface CandidateNeighbours {
  previousId: string | null;
  nextId: string | null;
}

async function windowFrom(
  last: string,
  ascending: boolean,
): Promise<{ person_id: string }[]> {
  const query = supabase.from('candidate_list').select('person_id').limit(WINDOW);
  const bounded = ascending ? query.gte('last_name', last) : query.lte('last_name', last);
  const { data } = await bounded
    .order('last_name', { ascending, nullsFirst: false })
    .order('first_name', { ascending, nullsFirst: false })
    .order('person_id', { ascending });
  return data ?? [];
}

export async function candidateNeighbours(current: SortKey): Promise<CandidateNeighbours> {
  const last = current.last_name ?? '';
  const [forward, backward] = await Promise.all([
    windowFrom(last, true),
    windowFrom(last, false),
  ]);

  const after = forward.findIndex((r) => r.person_id === current.person_id);
  const before = backward.findIndex((r) => r.person_id === current.person_id);

  return {
    nextId: after >= 0 ? (forward[after + 1]?.person_id ?? null) : null,
    previousId: before >= 0 ? (backward[before + 1]?.person_id ?? null) : null,
  };
}
