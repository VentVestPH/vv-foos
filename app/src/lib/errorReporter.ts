import { supabase } from './supabase';

const MAX_PER_SESSION = 20;
const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_ROUTE = 500;

const seen = new Set<string>();
let sent = 0;
let installed = false;

function clip(value: string | null | undefined, limit: number): string | null {
  if (!value) return null;
  return value.length > limit ? value.slice(0, limit) : value;
}

function messageOf(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason).slice(0, MAX_MESSAGE);
  } catch {
    return String(reason);
  }
}

function stackOf(reason: unknown): string | null {
  return reason instanceof Error ? (reason.stack ?? null) : null;
}

export function reportError(origin: string, reason: unknown, extraStack?: string): void {
  const message = clip(messageOf(reason), MAX_MESSAGE);
  if (!message) return;

  const stack = clip(extraStack ?? stackOf(reason), MAX_STACK);
  const key = `${origin}|${message}|${(stack ?? '').slice(0, 200)}`;
  if (seen.has(key) || sent >= MAX_PER_SESSION) return;
  seen.add(key);
  sent += 1;

  void supabase
    .from('client_errors')
    .insert({
      origin: origin.slice(0, 120),
      message,
      stack,
      route: clip(window.location.pathname + window.location.search, MAX_ROUTE),
      user_agent: navigator.userAgent,
    })
    .then(({ error }) => {
      if (error) console.warn('could not record the error report:', error.message);
    });
}

export function installGlobalErrorReporting(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportError('window.error', event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError('unhandledrejection', event.reason);
  });
}
