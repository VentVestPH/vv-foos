import { apiNameFor } from './api-field-names.mjs';

export const BULK_ALIASES = {
  'ZohoCRM/Accounts': { Id: 'Record Id', Owner: 'Account Owner' },
  'ZohoCRM/Contacts': { Id: 'Record Id', Owner: 'Contact Owner' },
  'ZohoCRM/Leads': { Id: 'Record Id', Owner: 'Lead Owner' },
  'ZohoCRM/Notes': { Id: 'Record Id', Owner: 'Note Owner' },
  'ZohoRecruit/Candidates': { Id: 'Candidate Id', Owner: 'Candidate Owner' },
  'ZohoRecruit/Contacts': { Id: 'Contact Id', Owner: 'Contact Owner' },
  'ZohoRecruit/Notes': { Id: 'Note Id', Owner: 'Note Owner' },
  'ZohoRecruit/Attachments': { Id: 'Attachment Id', Owner: 'Attachment Owner' },
};

const INTERNAL = new Set(['__row']);

export function buildBulkColumnMap(uiHeader) {
  const map = new Map();
  for (const column of uiHeader) {
    const api = apiNameFor(column);
    if (!map.has(api)) map.set(api, column);
  }
  return map;
}

export function bulkRowToExportRow(bulkRow, columnMap, extraAliases = {}) {
  const out = {};
  for (const [key, value] of Object.entries(bulkRow)) {
    if (INTERNAL.has(key)) continue;
    const target = extraAliases[key] ?? columnMap.get(key);
    if (target) out[target] = value ?? '';
  }
  return out;
}

export function unmappedBulkColumns(bulkRow, columnMap, extraAliases = {}) {
  return Object.keys(bulkRow).filter(
    (k) => !INTERNAL.has(k) && !extraAliases[k] && !columnMap.has(k) && !k.startsWith('$'),
  );
}

export function missingExportColumns(uiHeader, mappedRow) {
  return uiHeader.filter((c) => !(c in mappedRow));
}
