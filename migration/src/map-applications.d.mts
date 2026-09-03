export declare const STAGE_BY_ZOHO_STATUS: Map<string, string>;
export declare const APPLICATION_LEVEL_FIELDS: string[];
export declare function mapApplication(
  row: Record<string, unknown>,
  lookups: unknown,
  unresolved: unknown,
  resolve: { person: (id: string) => string | null; requisition: (id: string) => string | null },
): {
  zohoId?: string;
  skip?: string;
  application?: Record<string, unknown>;
  carried?: Record<string, string>;
  warnings: string[];
};
