import type { Lookups, Unresolved } from './lookups.d.mts';

export type CompanyRow = Record<string, string | null | undefined>;
export type MappedCompany = {
  zohoId?: string;
  company?: Record<string, unknown>;
  carried?: Record<string, string>;
  skip?: string;
  warnings: string[];
};
export function companyTypes(row: CompanyRow, warnings: string[]): string[];
export function mapCompany(
  row: CompanyRow,
  lookups: Lookups,
  unresolved: Unresolved,
): MappedCompany;
