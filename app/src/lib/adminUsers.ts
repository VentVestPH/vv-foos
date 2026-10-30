import { supabase } from './supabase';
import type { StaffRole } from './database.types';

export interface AdminUserRow {
  staffId: string;
  fullName: string;
  email: string;
  role: string;
  title: string | null;
  isActive: boolean;
  canSignIn: boolean;
  lastSignInAt: string | null;
  providers: string[];
  emailConfirmed: boolean;
}

interface EdgeResult<T> {
  data: T | null;
  error: string | null;
}

async function invoke<T>(body: Record<string, unknown>): Promise<EdgeResult<T>> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>('admin-users', {
    body,
  });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      const parsed = await ctx
        .clone()
        .json()
        .catch(() => null);
      if (parsed?.error) message = String(parsed.error);
    }
    return { data: null, error: message };
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { data: null, error: String(data.error) };
  }
  return { data: data as T, error: null };
}

export function listUsers() {
  return invoke<{ users: AdminUserRow[] }>({ action: 'list' });
}

export interface StaffChangeInput {
  fullName?: string;
  email?: string;
  title?: string | null;
  role?: StaffRole;
  isActive?: boolean;
}

export interface NewUserInput {
  fullName: string;
  email: string;
  title: string | null;
  role: StaffRole;
}

export function updateUser(staffId: string, change: StaffChangeInput) {
  return invoke<{ updated: boolean; staffId: string; loginEmailChanged: boolean }>({
    action: 'update',
    staffId,
    ...change,
  });
}

export function createUser(input: NewUserInput) {
  return invoke<{ staffId: string; email: string; loginCreated: boolean }>({
    action: 'create',
    ...input,
  });
}

export function issueTempPassword(staffId: string) {
  return invoke<{ password: string; email: string; created: boolean }>({
    action: 'temp_password',
    staffId,
  });
}

export function sendPasswordReset(staffId: string, redirectTo: string) {
  return invoke<{ sent: boolean; email: string }>({
    action: 'send_reset',
    staffId,
    redirectTo,
  });
}
