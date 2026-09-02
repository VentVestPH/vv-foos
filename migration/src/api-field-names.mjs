export function deriveApiName(exportColumn) {
  return exportColumn
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const API_NAME_OVERRIDES = new Map([
  ['Candidate Id', 'id'],
  ['Candidate ID', 'Candidate_ID'],
  ['Province', 'State'],
  ['Candidate Owner Id', 'Candidate_Owner'],
  ['Attachment Owner Id', 'Owner'],
  ['Note Owner Id', 'Owner'],
  ['Note Id', 'id'],
  ['Note Title', 'Note_Title'],
  ['Note Content', 'Note_Content'],
  ['Attachment Id', 'id'],
  ['Parent Id', 'Parent_Id'],
  ['File Name', 'File_Name'],
  ['X (formerly Twitter)', 'Twitter'],
  ['LinkedIn Recruiter', 'LinkedIn_Recruiter'],
  ['Created By', 'Created_By'],
  ['Modified By', 'Modified_By'],
  ['Created Time', 'Created_Time'],
  ['Modified Time', 'Modified_Time'],
]);

export function apiNameFor(exportColumn) {
  return API_NAME_OVERRIDES.get(exportColumn) ?? deriveApiName(exportColumn);
}

export function buildFieldMap(headerColumns) {
  const map = {};
  for (const col of headerColumns) map[col] = apiNameFor(col);
  return map;
}

export function unmatchedColumns(headerColumns, records) {
  const present = new Set();
  for (const rec of records) for (const k of Object.keys(rec)) present.add(k);
  return headerColumns.filter((col) => !present.has(apiNameFor(col)));
}
