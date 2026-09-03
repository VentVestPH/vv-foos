import { apiNameFor } from './api-field-names.mjs';

export const BULK_ALIASES = {
  'ZohoCRM/Accounts': { Id: 'Record Id', Owner: 'Account Owner' },
  'ZohoCRM/Contacts': { Id: 'Record Id', Owner: 'Contact Owner' },
  'ZohoCRM/Leads': { Id: 'Record Id', Owner: 'Lead Owner' },
  'ZohoCRM/Notes': { Id: 'Record Id', Owner: 'Note Owner' },
  'ZohoRecruit/Candidates': {
    Id: 'Candidate Id',
    Owner: 'Candidate Owner',
    Updated_On: 'Modified Time',
  },
  'ZohoRecruit/Applications': {
    Id: 'Application Id',
    Owner: 'Application Owner',
    Updated_On: 'Modified Time',
  },
  'ZohoRecruit/Contacts': { Id: 'Contact Id', Owner: 'Contact Owner' },
  'ZohoRecruit/Notes': {
    Id: 'Note Id',
    Owner: 'Note Owner',
    '$se_module': 'Module',
    Parent_Id: 'Parent Id',
  },
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

function flattenBulkValue(value, preferId = false) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map((v) => flattenBulkValue(v, preferId)).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    const picked = preferId
      ? (value.id ?? value.name ?? value.full_name)
      : (value.name ?? value.full_name ?? value.id);
    return picked === undefined ? JSON.stringify(value) : String(picked);
  }
  return String(value);
}

const ID_COLUMN = /(^|[\s_])id$/i;

export function bulkRowToExportRow(bulkRow, columnMap, extraAliases = {}) {
  const out = {};
  for (const [key, value] of Object.entries(bulkRow)) {
    if (INTERNAL.has(key)) continue;
    const target = extraAliases[key] ?? columnMap.get(key);
    if (target) out[target] = flattenBulkValue(value, ID_COLUMN.test(target));
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
