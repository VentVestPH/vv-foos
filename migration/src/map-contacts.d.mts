import type { Lookups, Unresolved } from './lookups.d.mts';

export type ContactRow = Record<string, string | null | undefined>;
export type MappedContact = {
  zohoId?: string;
  person?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  skip?: string;
  warnings: string[];
};
export function unrecognisedContactColumns(header: string[]): string[];
export function mapContact(
  row: ContactRow,
  lookups: Lookups,
  unresolved: Unresolved,
  companyByZohoId: Map<string, string>,
): MappedContact;
