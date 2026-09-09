import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const PARENT_BY_MODULE = new Map([
  ['Candidates', 'candidate'],
  ['Clients', 'company'],
  ['Job_Openings', 'requisition'],
  ['Applications', 'application'],
]);

const STATUS_BY_ZOHO = new Map([
  ['1', 'open'],
  ['not started', 'open'],
  ['in progress', 'in_progress'],
  ['completed', 'done'],
  ['deferred', 'open'],
  ['waiting on someone else', 'in_progress'],
]);

function trimmed(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.name ?? v.id ?? '').trim();
  return String(v).trim();
}

function linkId(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.id ?? '').trim();
  return String(v).trim();
}

function parentOf(row, resolveParent, warnings) {
  const module = trimmed(row, '$se_module');
  const entity = PARENT_BY_MODULE.get(module);
  const zohoId = linkId(row, 'What_Id') || linkId(row, 'Who_Id');
  if (!module || !zohoId) return { entity: null, id: null };
  if (!entity) {
    warnings.push(`$se_module "${module}" has no parent mapping`);
    return { entity: null, id: null };
  }
  const id = resolveParent(entity, zohoId);
  if (!id) warnings.push(`parent ${entity} not imported: ${zohoId}`);
  return { entity, id };
}

export function mapTodo(row, lookups, unresolved, resolveParent) {
  const warnings = [];
  const zohoId = trimmed(row, 'id') || trimmed(row, 'Id');
  if (!zohoId) return { skip: 'no to-do id', warnings };

  const activityType = trimmed(row, 'Activity_Type');
  const owner = resolveStaff(lookups, linkId(row, 'Activity_Owner') || trimmed(row, 'Activity_Owner'), unresolved);
  const { entity, id: parentId } = parentOf(row, resolveParent, warnings);

  if (activityType === 'Events') {
    const start = parseZohoTimestamp(trimmed(row, 'Start_DateTime1'));
    const occurredAt = start ?? parseZohoTimestamp(trimmed(row, 'Created_Time'));
    if (!occurredAt) return { skip: 'no parseable start or created time', warnings };
    if (!start) warnings.push('no Start_DateTime1; Created_Time used as occurred_at');
    return {
      zohoId,
      activity: {
        kind: 'meeting',
        subject: trimmed(row, 'Subject') || 'Imported from Zoho Recruit',
        body: trimmed(row, 'Description') || null,
        occurred_at: occurredAt,
        person_id: entity === 'candidate' ? parentId : null,
        company_id: entity === 'company' ? parentId : null,
        requisition_id: entity === 'requisition' ? parentId : null,
        application_id: entity === 'application' ? parentId : null,
        ends_at: parseZohoTimestamp(trimmed(row, 'End_DateTime1')),
        location: trimmed(row, 'Meeting_Venue') || trimmed(row, 'Venue') || null,
        all_day: String(row.All_day ?? '').trim().toLowerCase() === 'true',
        source_payload: row,
        created_by: owner,
      },
      warnings,
    };
  }

  if (activityType && activityType !== 'Tasks') {
    warnings.push(`Activity_Type "${activityType}" treated as a task`);
  }

  const rawStatus = trimmed(row, 'Status');
  const status = STATUS_BY_ZOHO.get(rawStatus.toLowerCase()) ?? (rawStatus ? 'open' : 'open');
  if (rawStatus && !STATUS_BY_ZOHO.has(rawStatus.toLowerCase())) {
    warnings.push(`Status "${rawStatus}" has no mapping; stored as open`);
  }
  const due = parseZohoTimestamp(trimmed(row, 'Due_Date'));

  return {
    zohoId,
    task: {
      subject: trimmed(row, 'Subject') || 'Imported from Zoho Recruit',
      due_date: due ? due.slice(0, 10) : null,
      priority: trimmed(row, 'Priority') || null,
      status,
      assignee_id: owner,
      related_type: parentId ? (entity === 'candidate' ? 'person' : entity) : null,
      related_id: parentId,
      completed_at: status === 'done' ? parseZohoTimestamp(trimmed(row, 'Modified_Time')) : null,
      source_payload: row,
    },
    warnings,
  };
}
