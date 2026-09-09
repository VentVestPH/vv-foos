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

function dateOnly(value) {
  const parsed = parseZohoTimestamp(value);
  if (!parsed) return null;
  return parsed.slice(0, 10);
}

export function mapCrmTask(row, lookups, unresolved, resolveParent) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no task id', warnings };

  const subject = trimmed(row, 'Subject');
  if (!subject) return { skip: 'no Subject', warnings };

  const module = trimmed(row, '$se_module');
  const relatedType = RELATED_BY_MODULE.get(module) ?? null;
  const relatedZohoId = linkId(row, 'What_Id') || linkId(row, 'Who_Id');
  let relatedId = null;
  if (relatedType && relatedZohoId) {
    relatedId = resolveParent(relatedType, relatedZohoId);
    if (!relatedId) warnings.push(`related ${relatedType} not imported: ${relatedZohoId}`);
  } else if (module) {
    warnings.push(`$se_module "${module}" has no related_type mapping`);
  }

  const foosRelatedType = relatedType === 'contact' || relatedType === 'lead' ? 'person' : relatedType;

  const task = {
    subject,
    due_date: dateOnly(trimmed(row, 'Due_Date')),
    priority: trimmed(row, 'Priority') || null,
    status: trimmed(row, 'Status') || 'open',
    assignee_id: resolveStaff(lookups, linkId(row, 'Owner') || trimmed(row, 'Owner'), unresolved),
    related_type: relatedId ? foosRelatedType : null,
    related_id: relatedId,
    completed_at: parseZohoTimestamp(trimmed(row, 'Closed_Time')),
    source_payload: row,
  };

  return { zohoId, task, warnings };
}
