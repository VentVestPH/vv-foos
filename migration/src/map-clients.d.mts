import type { Lookups, Unresolved } from './lookups.d.mts';

export declare function mapClient(
  row: Record<string, unknown>,
  lookups: Lookups,
  unresolved: Unresolved,
): {
  zohoId?: string;
  skip?: string;
  company?: Record<string, unknown>;
  carried?: Record<string, string>;
  warnings: string[];
};
