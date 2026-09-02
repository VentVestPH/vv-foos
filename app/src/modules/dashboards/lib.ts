import { EMPTY_CELL, formatMoney } from '../../lib/format';

export interface AtsFunnelRow {
  application_id: string;
  display_code: string;
  requisition_id: string;
  requisition_code: string;
  requisition_title: string;
  company_id: string;
  person_id: string;
  stage: string;
  source_id: string | null;
  source_name: string | null;
  sourcer_id: string | null;
  is_shortlisted: boolean;
  rank: number | null;
  applied_at: string;
  stage_changed_at: string | null;
  hired_at: string | null;
}

export interface CrmFunnelRow {
  deal_id: string;
  display_code: string;
  name: string;
  company_id: string;
  company_name: string;
  owner_id: string | null;
  stage: string;
  value: number | null;
  currency: string | null;
  probability: number | null;
  expected_close: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceEffectivenessRow {
  intake_item_id: string;
  channel: string;
  target_type: string;
  status: string;
  submitted_by: string | null;
  duplicate_of: string | null;
  person_id: string | null;
  star_grade: number | null;
  created_at: string;
  reached_hired: boolean;
  reached_won: boolean;
}

export interface StaffActivityRow {
  activity_id: string;
  kind: string;
  occurred_at: string;
  created_by: string | null;
  person_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  application_id: string | null;
  requisition_id: string | null;
}

export interface StaffGradingRow {
  intake_item_id: string;
  submitted_by: string | null;
  star_grade: number | null;
  created_at: string;
}

export interface RequisitionAgingRow {
  requisition_id: string;
  display_code: string;
  title: string;
  company_id: string;
  company_name: string;
  status: string;
  opened_date: string;
  filled_date: string | null;
  days_open: number;
  owner_count: number;
  i_am_owner: boolean;
  open_applications: number;
  unviewed_applications: number;
}

export interface StageDurationRow {
  entity_type: 'application' | 'requisition';
  display_code: string;
  stage_from: string | null;
  stage_to: string;
  changed_at: string;
  duration_days: number | null;
}

export interface StaffStageAdvanceRow {
  staff_id: string;
  advances_count: number;
  window_start: string;
  window_end: string;
}

export interface SuccessMetricRow {
  metric_key: string;
  week_start: string;
  value: number | null;
  unit: string | null;
}

export interface Threshold {
  metric: string;
  days: number;
}

export type DateRangePreset = '7' | '30' | '90' | 'quarter' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  from: string;
  to: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeForPreset(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
): DateRange {
  const today = new Date();
  const to = isoDate(today);
  if (preset === 'custom') {
    return {
      preset,
      from: customFrom ?? isoDate(new Date(today.getTime() - 30 * 86400000)),
      to: customTo ?? to,
    };
  }
  if (preset === 'quarter') {
    return { preset, from: isoDate(new Date(today.getTime() - 90 * 86400000)), to };
  }
  const days = Number(preset);
  return { preset, from: isoDate(new Date(today.getTime() - days * 86400000)), to };
}

export const DEFAULT_RANGE: DateRange = rangeForPreset('30');

export function exportFilename(
  dashboard: string,
  widget: string,
  range: DateRange,
): string {
  return `foos-${dashboard}-${widget}-${range.from}_to_${range.to}.csv`;
}

export function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function fmtDays(n: number | null): string {
  if (n === null || Number.isNaN(n)) return EMPTY_CELL;
  return `${n.toFixed(1)}d`;
}

export function fmtMoney(n: number | null, currency = 'USD'): string {
  return formatMoney(n, currency);
}

export function countBy<T>(
  rows: T[],
  key: (row: T) => string,
  order?: string[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const labels = order ?? [...counts.keys()].sort();
  return labels.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}

export const APPLICATION_STAGE_ORDER = [
  'received',
  'screening',
  'phone_screen',
  'submitted',
  'client_interview',
  'offer',
  'hired',
  'rejected',
];

export const DEAL_STAGE_ORDER = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
];
