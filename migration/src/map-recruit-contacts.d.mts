import type { Lookups, Unresolved } from './lookups.d.mts';

export declare function mapRecruitContact(
  row: Record<string, unknown>,
  lookups: Lookups,
  unresolved: Unresolved,
  companyByZohoId: Map<string, string>,
): {
  zohoId?: string;
  skip?: string;
  person?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  carried?: Record<string, string>;
  warnings: string[];
};
