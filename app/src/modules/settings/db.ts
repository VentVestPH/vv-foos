// Module-local re-typing of the shared Supabase client — same shim as
// modules/intake/db.ts, modules/sales/db.ts, and recruit's equivalent.

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
