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

const INTAKE_SETTLED_STATUSES = ['imported', 'rejected'] as const;

export const INTAKE_SETTLED_FILTER = `("${INTAKE_SETTLED_STATUSES.join('","')}")`;

export const CHANNEL_ICON: Record<IntakeItem['channel'], LucideIcon> = {
  linkedin_url: Link2,
  email: AtSign,
  sheet_import: Sheet,
  careers_form: Globe,
  manual: PencilLine,
};

export const CHANNEL_LABEL: Record<IntakeItem['channel'], string> = {
  linkedin_url: 'LinkedIn',
  email: 'Email',
  sheet_import: 'Sheet import',
  careers_form: 'Careers page',
  manual: 'Manual',
};

export const TARGET_LABEL: Record<IntakeItem['target_type'], string> = {
  candidate: 'Candidate',
  contact: 'Contact',
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


export function requiresGradingBeforeImport(item: IntakeItem): boolean {
  return item.channel === 'linkedin_url' && item.target_type === 'candidate';
}


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
