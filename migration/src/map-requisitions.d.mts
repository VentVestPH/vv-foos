export declare function mapRequisition(
  row: Record<string, unknown>,
  lookups: unknown,
  unresolved: unknown,
): {
  zohoId?: string;
  skip?: string;
  requisition?: Record<string, unknown>;
  ownerId?: string | null;
  clientName?: string;
  carried?: Record<string, string>;
  warnings: string[];
};
