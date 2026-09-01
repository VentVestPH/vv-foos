// Shared types and small helpers for the Intake module (Agent 5).
// Enums/statuses are locked (architecture section 1) — do not add channels,
// statuses, or target types here.

import {
  AtSign,
  Globe,
  Link2,
  PencilLine,
  Sheet,
  type LucideIcon,
} from 'lucide-react';
import type { Tables } from '../../lib/database.types';

export type IntakeItem = Tables<'intake_items'>;

/**
 * C7 / D13. This was a map of letter and symbol avatars: 'in', '@', '#', 'star'
 * and an ellipsis. The redesign prompt section 6 forbids exactly that ("Do not
 * use letter avatars such as R, C, Co, or emoji as final icons"), and 'in' for
 * LinkedIn was the clearest case of it in the codebase.
 *
 * Lucide, at strokeWidth 1.6 to match shell/icons.tsx.
 *
 * Note: Lucide removed brand icons (Linkedin, Facebook, ...) in v1 for
 * trademark reasons, so the LinkedIn channel uses the generic Link2 mark. If a
 * real LinkedIn glyph is ever wanted it has to be a local SVG in
 * shell/icons.tsx, not a Lucide import.
 */
export const CHANNEL_ICON: Record<IntakeItem['channel'], LucideIcon> = {
  linkedin_url: Link2,
  email: AtSign,
  sheet_import: Sheet,
  careers_form: Globe,   // public careers page: auto-imported, read-only here
  manual: PencilLine,
};

export const CHANNEL_LABEL: Record<IntakeItem['channel'], string> = {
  linkedin_url: 'LinkedIn',
  email: 'Email',
  sheet_import: 'Sheet import',
  careers_form: 'Careers page',
  manual: 'Manual',
};

export const STATUS_LABEL: Record<IntakeItem['status'], string> = {
  pending: 'Pending',
  parsed: 'Parsed',
  graded: 'Graded',
  imported: 'Imported',
  rejected: 'Rejected',
};

export interface ParsedFields {
  name?: string;
  headline?: string;
  emails?: string[];
  email?: string;
  phones?: string[];
  phone?: string;
  company?: string;
  title?: string;
  urls?: string[];
  linkedin_url?: string;
  reject_reason?: string;
  dedup_override?: boolean;
  attachments?: { storage_path: string; filename: string; kind?: string }[];
  [key: string]: unknown;
}

export function parsedOf(item: IntakeItem): ParsedFields {
  return (item.parsed ?? {}) as ParsedFields;
}

export function primaryEmail(item: IntakeItem): string | null {
  const p = parsedOf(item);
  if (p.email) return p.email;
  if (p.emails && p.emails.length > 0) return p.emails[0];
  return null;
}

/** Grading required before import: linkedin_url channel + candidate target only. */
export function requiresGradingBeforeImport(item: IntakeItem): boolean {
  return item.channel === 'linkedin_url' && item.target_type === 'candidate';
}

export function isGraded(item: IntakeItem): boolean {
  return item.status === 'graded' || item.star_grade != null;
}

/** Careers-form rows are read-only here — Agent 4 already auto-imported them. */
export function isReadOnly(item: IntakeItem): boolean {
  return item.channel === 'careers_form';
}

export function canImport(item: IntakeItem): boolean {
  if (isReadOnly(item)) return false;
  if (item.status === 'imported' || item.status === 'rejected') return false;
  if (requiresGradingBeforeImport(item) && item.status !== 'graded') return false;
  return true;
}

export function canReject(item: IntakeItem): boolean {
  return !isReadOnly(item) && item.status !== 'imported' && item.status !== 'rejected';
}
