// Agent 6 settings module — small pure helpers, kept separate from the
// component so the connect/disconnect logic is easy to unit-test later.

export type GoogleTier = 'base' | 'send' | 'calendar';

export interface GoogleTokensSummary {
  scopes: string[];
  connected_at?: string;
  updated_at?: string;
  tier_last_connected?: string;
}

const SCOPE_LABEL: Record<string, string> = {
  'https://www.googleapis.com/auth/gmail.readonly': 'Read Gmail (sync)',
  'https://www.googleapis.com/auth/gmail.send': 'Send Gmail',
  'https://www.googleapis.com/auth/calendar.events': 'Create Calendar events',
};

export function scopeLabel(scope: string): string {
  return SCOPE_LABEL[scope] ?? scope;
}

export function hasScope(tokens: GoogleTokensSummary | null, tier: GoogleTier): boolean {
  if (!tokens) return false;
  const needed =
    tier === 'base'
      ? 'https://www.googleapis.com/auth/gmail.readonly'
      : tier === 'send'
        ? 'https://www.googleapis.com/auth/gmail.send'
        : 'https://www.googleapis.com/auth/calendar.events';
  return tokens.scopes?.includes(needed) ?? false;
}
