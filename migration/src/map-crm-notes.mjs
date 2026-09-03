import { parseZohoTimestamp } from './zoho.mjs';
import { ACTIVITY_KIND_BY_NOTE_TITLE, resolveStaff } from './lookups.mjs';

const PARENT_BY_MODULE = new Map([
  ['Accounts', 'company'],
  ['Contacts', 'contact'],
  ['Leads', 'lead'],
]);

function trimmed(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.name ?? v.id ?? '').trim();
  return String(v).trim();
}

export function mapCrmNote(row, lookups, unresolved, resolveParent) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no note id', warnings };

  const occurredAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  if (!occurredAt) {
    return { skip: `unparseable Created_Time: ${trimmed(row, 'Created_Time') || '(blank)'}`, warnings };
  }

  const module = trimmed(row, '$se_module') || trimmed(row, 'Parent_Id.module.api_name');
  const entity = PARENT_BY_MODULE.get(module);
  if (!entity) return { skip: `unmapped $se_module: ${module || '(blank)'}`, warnings };

  const parentZohoId = trimmed(row, 'Parent_Id');
  if (!parentZohoId) return { skip: 'no Parent_Id', warnings };

  const parentId = resolveParent(entity, parentZohoId);
  if (!parentId) {
    unresolved.parent.set(`${entity}:${parentZohoId}`, 1);
    return { skip: `parent ${entity} not imported: ${parentZohoId}`, warnings };
  }

  const body = trimmed(row, 'Note_Content');
  const title = trimmed(row, 'Note_Title');
  const kind = title ? (ACTIVITY_KIND_BY_NOTE_TITLE.get(title) ?? 'note') : 'note';

  const subject = title
    ? title
    : body
      ? body.split(/\r?\n/)[0].slice(0, 160)
      : 'Imported from Zoho CRM';

  const activity = {
    kind,
    subject,
    body: body || null,
    occurred_at: occurredAt,
    person_id: entity === 'company' ? null : parentId,
    company_id: entity === 'company' ? parentId : null,
    created_by: resolveStaff(lookups, trimmed(row, 'Owner'), unresolved),
  };

  return { zohoId, activity, warnings };
}
