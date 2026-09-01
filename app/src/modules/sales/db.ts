// Module-local re-typing of the shared Supabase client.
//
// Why: the installed supabase-js resolved to 2.110 (package.json floats
// ^2.45), and its postgrest-js now requires every table type to carry a
// `Relationships` array. The hand-derived src/lib/database.types.ts predates
// that, so the stock typed client collapses Insert/Update payloads to
// `never`. This file maps `Relationships: []` onto every table WITHOUT
// forking any column definitions — rows still come verbatim from the shared
// Gate 1 file, so a schema change there flows straight through here.
//
// For the integrator: the clean fix is adding `Relationships: []` to each
// table in src/lib/database.types.ts (shared file, outside this module's
// write boundary); this shim can then be deleted.

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

/** The one shared client instance, viewed through the patched schema type. */
export const db = supabase as unknown as SupabaseClient<PatchedDatabase>;
