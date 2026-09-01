// Agent 7 (Dashboards) — same shim pattern as every other module's db.ts
// (sales/intake/settings): re-export the shared client patched so the
// hand-written database.types.ts satisfies postgrest-js's Relationships
// field. dashDb additionally scopes to the `dash` Postgres schema, which
// isn't in database.types.ts at all (it's views/materialized views owned by
// this module, not part of the Gate-1 canonical schema) — queries against it
// are typed manually per-view in lib.ts via `.returns<T[]>()`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type SharedTables = Database['public']['Tables'];
type PatchedDatabase = {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: {
      [K in keyof SharedTables]: SharedTables[K] & { Relationships: [] };
    };
  };
};

export const db = supabase as unknown as SupabaseClient<PatchedDatabase>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dashDb = (supabase as unknown as SupabaseClient<any>).schema(
  'dash',
);
