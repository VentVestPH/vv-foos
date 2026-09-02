import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export const dashDb = (supabase as unknown as SupabaseClient<any>).schema('dash');
