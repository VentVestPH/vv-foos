import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const RELATED_BY_MODULE = new Map([
  ['Accounts', 'company'],
  ['Contacts', 'contact'],
  ['Leads', 'lead'],
  ['Deals', 'deal'],
]);

function linkId(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.id ?? '').trim();
  return String(v).trim();
}

function trimmed(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.name ?? v.id ?? '').trim();
  return String(v).trim();
}

export function mapCrmEvent(row, lookups, unresolved, resolveParent) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no event id', warnings };

  const start = parseZohoTimestamp(trimmed(row, 'Start_DateTime'));
  const created = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  const occurredAt = start ?? created;
  if (!occurredAt) {
    return { skip: 'neither Start_DateTime nor Created_Time could be parsed', warnings };
  }
  if (!start) warnings.push('no Start_DateTime; Created_Time used as occurred_at');

  const module = trimmed(row, '$se_module');
  const relatedType = RELATED_BY_MODULE.get(module) ?? null;
  const relatedZohoId = linkId(row, 'What_Id');
  let companyId = null;
  let personId = null;
  if (relatedType && relatedZohoId) {
    const resolved = resolveParent(relatedType, relatedZohoId);
    if (!resolved) warnings.push(`related ${relatedType} not imported: ${relatedZohoId}`);
    else if (relatedType === 'company') companyId = resolved;
    else personId = resolved;
  }

  const activity = {
    kind: 'meeting',
    subject: trimmed(row, 'Event_Title') || 'Imported from Zoho CRM',
    body: null,
    occurred_at: occurredAt,
    person_id: personId,
    company_id: companyId,
    ends_at: parseZohoTimestamp(trimmed(row, 'End_DateTime')),
    location: trimmed(row, 'Meeting_Venue__s') || trimmed(row, 'Venue') || null,
    all_day: String(row.All_day ?? '').trim().toLowerCase() === 'true',
    source_payload: row,
    created_by: resolveStaff(lookups, linkId(row, 'Owner') || trimmed(row, 'Owner'), unresolved),
  };

  return { zohoId, activity, warnings };
}
