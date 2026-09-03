import type { Lookups, Unresolved } from './lookups.d.mts';

export declare function mapLead(
  row: Record<string, unknown>,
  lookups: Lookups,
  unresolved: Unresolved,
): {
  zohoId?: string;
  skip?: string;
  person?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  leadNote?: Record<string, unknown>;
  warnings: string[];
};
