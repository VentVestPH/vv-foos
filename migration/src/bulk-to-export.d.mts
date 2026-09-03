export declare const BULK_ALIASES: Record<string, Record<string, string>>;
export declare function buildBulkColumnMap(uiHeader: string[]): Map<string, string>;
export declare function bulkRowToExportRow(
  bulkRow: Record<string, unknown>,
  columnMap: Map<string, string>,
  extraAliases?: Record<string, string>,
): Record<string, string>;
export declare function unmappedBulkColumns(
  bulkRow: Record<string, unknown>,
  columnMap: Map<string, string>,
  extraAliases?: Record<string, string>,
): string[];
export declare function missingExportColumns(
  uiHeader: string[],
  mappedRow: Record<string, string>,
): string[];
