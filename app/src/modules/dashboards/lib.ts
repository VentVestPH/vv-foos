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

export type DateRangePreset =
  | 'all'
  | 'today'
  | '7'
  | '30'
  | '90'
  | 'month'
  | 'last_month'
  | 'quarter'
  | 'ytd'
  | '12m'
  | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  from: string;
  to: string;
}

const ALL_TIME_FROM = '1970-01-01';

export const RANGE_PRESETS: { value: Exclude<DateRangePreset, 'custom'>; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Last 12 months' },
];

const pad = (value: number) => String(value).padStart(2, '0');

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function daysAgo(today: Date, days: number): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
}

export function rangeForPreset(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
): DateRange {
  const today = new Date();
  const to = isoDate(today);
  switch (preset) {
    case 'all':
      return { preset, from: ALL_TIME_FROM, to };
    case 'today':
      return { preset, from: to, to };
    case 'month':
      return { preset, from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case 'last_month':
      return {
        preset,
        from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case 'quarter':
      return { preset, from: isoDate(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)), to };
    case 'ytd':
      return { preset, from: isoDate(new Date(today.getFullYear(), 0, 1)), to };
    case '12m':
      return { preset, from: isoDate(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)), to };
    case 'custom':
      return { preset, from: customFrom ?? isoDate(daysAgo(today, 30)), to: customTo ?? to };
    default:
      return { preset, from: isoDate(daysAgo(today, Number(preset))), to };
  }
}

export const DEFAULT_RANGE: DateRange = rangeForPreset('all');

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

