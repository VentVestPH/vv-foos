export const STAFF_ROLES = ['admin', 'recruiter', 'sourcer', 'bd'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const NAME_MAX = 120;
export const TITLE_MAX = 120;
export const EMAIL_MAX = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface StaffSnapshot {
  id: string;
  role: string;
  is_active: boolean;
}

export interface StaffChange {
  fullName?: string;
  email?: string;
  title?: string | null;
  role?: StaffRole;
  isActive?: boolean;
}

export interface NewStaff {
  fullName: string;
  email: string;
  title: string | null;
  role: StaffRole;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX) return null;
  return EMAIL_PATTERN.test(email) ? email : null;
}

function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length > max) return null;
  return text;
}

export function parseStaffChange(input: Record<string, unknown>): Parsed<StaffChange> {
  const change: StaffChange = {};

  if (input.fullName !== undefined) {
    const name = cleanText(input.fullName, NAME_MAX);
    if (name === null || name.length === 0) {
      return { ok: false, error: `Name is required and must be at most ${NAME_MAX} characters` };
    }
    change.fullName = name;
  }

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (email === null) return { ok: false, error: 'Enter a valid email address' };
    change.email = email;
  }

  if (input.title !== undefined) {
    if (input.title === null) {
      change.title = null;
    } else {
      const title = cleanText(input.title, TITLE_MAX);
      if (title === null) {
        return { ok: false, error: `Title must be at most ${TITLE_MAX} characters` };
      }
      change.title = title.length === 0 ? null : title;
    }
  }

  if (input.role !== undefined) {
    if (!isStaffRole(input.role)) return { ok: false, error: 'Unknown role' };
    change.role = input.role;
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') return { ok: false, error: 'isActive must be true or false' };
    change.isActive = input.isActive;
  }

  return { ok: true, value: change };
}

export function parseNewStaff(input: Record<string, unknown>): Parsed<NewStaff> {
  const name = cleanText(input.fullName, NAME_MAX);
  if (name === null || name.length === 0) {
    return { ok: false, error: `Name is required and must be at most ${NAME_MAX} characters` };
  }

  const email = normalizeEmail(input.email);
  if (email === null) return { ok: false, error: 'Enter a valid email address' };

  if (!isStaffRole(input.role)) return { ok: false, error: 'Choose a role' };

  let title: string | null = null;
  if (input.title !== undefined && input.title !== null) {
    const cleaned = cleanText(input.title, TITLE_MAX);
    if (cleaned === null) return { ok: false, error: `Title must be at most ${TITLE_MAX} characters` };
    title = cleaned.length === 0 ? null : cleaned;
  }

  return { ok: true, value: { fullName: name, email, title, role: input.role } };
}

export function guardAdminChange(
  callerId: string,
  target: StaffSnapshot,
  change: StaffChange,
  activeAdminCount: number,
): string | null {
  const nextRole = change.role ?? target.role;
  const nextActive = change.isActive ?? target.is_active;
  const wasActiveAdmin = target.role === 'admin' && target.is_active;
  const staysActiveAdmin = nextRole === 'admin' && nextActive;

  if (!wasActiveAdmin || staysActiveAdmin) return null;
  if (target.id === callerId) {
    return "You can't remove your own admin access or deactivate your own account";
  }
  if (activeAdminCount <= 1) return 'At least one active admin is required';
  return null;
}
