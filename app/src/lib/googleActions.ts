import { supabase } from './supabase';

interface EdgeResult<T> {
  data: T | null;
  error: string | null;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<EdgeResult<T>> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(fn, { body });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      const body = await ctx
        .clone()
        .json()
        .catch(() => null);
      if (body?.error) message = body.error;
    }
    return { data: null, error: message };
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { data: null, error: String(data.error) };
  }
  return { data: data as T, error: null };
}

export interface SendEmailArgs {
  personId: string;
  to: string;
  subject: string;
  bodyText: string;
  threadId?: string | undefined;
  dealId?: string | undefined;
  applicationId?: string | undefined;
  companyId?: string | undefined;
  requisitionId?: string | undefined;
}

export function sendEmail(args: SendEmailArgs) {
  return invoke<{ activityId: string; gmailMessageId: string; threadId: string }>(
    'gmail-send',
    args as unknown as Record<string, unknown>,
  );
}

export interface ScheduleMeetingArgs {
  personId: string;
  attendeeEmails: string[];
  subject: string;
  description?: string | undefined;
  startIso: string;
  durationMinutes: number;
  dealId?: string | undefined;
  applicationId?: string | undefined;
  companyId?: string | undefined;
  requisitionId?: string | undefined;
}

export function scheduleMeeting(args: ScheduleMeetingArgs) {
  return invoke<{ activityId: string; gcalEventId: string; meetLink: string | null }>(
    'calendar-create-meeting',
    args as unknown as Record<string, unknown>,
  );
}
