// Zoho's API field names are usually the display label with non-alphanumerics
// replaced by underscores, but not always. Rather than guess all 110 candidate
// fields, the mapping is derived and then the tool reports which export columns
// found no matching API field on any record, so the overrides below can be
// corrected against a real pull instead of being invented now.
export function deriveApiName(exportColumn) {
  return exportColumn
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Confirmed differences between an export column and its API field name.
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

// Which export columns matched no API field on any record. These are the ones whose
// name guess is wrong, and the only way to know is against a real pull.
export function unmatchedColumns(headerColumns, records) {
  const present = new Set();
  for (const rec of records) for (const k of Object.keys(rec)) present.add(k);
  return headerColumns.filter((col) => !present.has(apiNameFor(col)));
}
