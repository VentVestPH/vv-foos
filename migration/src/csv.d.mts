export declare function parseCsv(text: string): string[][];
export declare function parseCsvRecords(text: string): {
  header: string[];
  records: Record<string, string>[];
};
