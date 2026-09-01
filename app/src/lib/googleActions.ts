// Agent 6 client helpers — thin wrappers around gmail-send and
// calendar-create-meeting, shared by any module with a record view that
// wants a "Send email" / "Schedule meeting" action (recruit candidates,
// sales contacts/deals, ...). Both Edge Functions require the caller's own
// scope to be granted (send / calendar) — see /settings.
//
// Kept in src/lib (not a module) since this crosses the recruit/sales
// boundary the same way the shared UI components do.

import { supabase } from './supabase';

interface EdgeResult<T> {
  data: T | null;
  error: string | null;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<EdgeResult<T>> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(fn, { body });
  if (error) {
    // supabase-js surfaces non-2xx responses as a generic FunctionsHttpError;
    // the useful message is in the body, which the client library still
    // exposes via error.context (a Response) when available.
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.clone().json();
        if (body?.error) message = body.error;
      }
    } catch {
      // fall back to error.message
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
  threadId?: string;
  dealId?: string;
  applicationId?: string;
  companyId?: string;
  requisitionId?: string;
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
  description?: string;
  startIso: string;
  durationMinutes: number;
  dealId?: string;
  applicationId?: string;
  companyId?: string;
  requisitionId?: string;
}

export function scheduleMeeting(args: ScheduleMeetingArgs) {
  return invoke<{ activityId: string; gcalEventId: string; meetLink: string | null }>(
    'calendar-create-meeting',
    args as unknown as Record<string, unknown>,
  );
}
