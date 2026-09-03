export type Lookups = {
  staffByName: Map<string, string>;
  sourceByName: Map<string, string>;
  statusByLabel: Map<string, string>;
  nameByZohoUserId?: Map<string, string>;
};
export type Unresolved = {
  staff: Map<string, number>;
  source: Map<string, number>;
  status: Map<string, number>;
  category: Map<string, number>;
  parent: Map<string, number>;
};
export const STATUS_ALIASES: Map<string, string>;
export const ATTACHMENT_KIND_BY_LABEL: Map<string, string>;
export const ACTIVITY_KIND_BY_NOTE_TITLE: Map<string, string>;
export const EXCLUDED_COLUMNS: Set<string>;
export function looksLikeIdentityDocument(fileName?: string | null): boolean;
export function loadLookups(db: unknown): Promise<Lookups>;
export function loadZohoUserNames(dir?: string): Map<string, string>;
export function resolveStaff(
  lookups: Lookups,
  zohoName: string | null | undefined,
  unresolved: Unresolved,
): string | null;
export function resolveSource(
  lookups: Lookups,
  zohoValue: string | null | undefined,
  unresolved: Unresolved,
): string | null;
export function resolveStatus(
  lookups: Lookups,
  zohoValue: string | null | undefined,
  unresolved: Unresolved,
): string | null;
export function newUnresolved(): Unresolved;
