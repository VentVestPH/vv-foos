import { supabase } from './supabase';

let channelSeq = 0;

export function realtimeChannel(name: string) {
  channelSeq += 1;
  return supabase.channel(`${name}-${channelSeq}`);
}
