import type { Lookups, Unresolved } from './lookups.d.mts';

export declare function mapCrmNote(
  row: Record<string, unknown>,
  lookups: Lookups,
  unresolved: Unresolved,
  resolveParent: (entity: string, zohoId: string) => string | null,
): {
  zohoId?: string;
  skip?: string;
  activity?: Record<string, unknown>;
  warnings: string[];
};
