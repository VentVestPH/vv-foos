export function parseZohoTimestamp(value?: string | null): string | null;
export function parseZohoDate(value?: string | null): string | null;
export function parsePartialDate(
  value?: string | null,
  yearSourceTimestamp?: string | null,
): string | null;
export function parseZohoBoolean(value?: string | null): boolean | null;
export function parseZohoNumber(value?: string | null): number | null;
export function parseStarGrade(
  value?: string | null,
): { grade: number | null; reason: string | null };
export function splitName(full?: string | null): { first: string | null; last: string | null };
