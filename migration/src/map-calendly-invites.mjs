import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

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

export function mapCalendlyInvite(row, lookups, unresolved, resolveParent) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no invite id', warnings };

  const occurredAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  if (!occurredAt) {
    return { skip: `unparseable Created_Time: ${trimmed(row, 'Created_Time') || '(blank)'}`, warnings };
  }

  const candidateZohoId = linkId(row, 'Zoho_Recruit_Candidate');
  const personId = candidateZohoId ? resolveParent('candidate', candidateZohoId) : null;
  if (candidateZohoId && !personId) {
    warnings.push('Zoho_Recruit_Candidate did not resolve to an imported candidate');
  }

  const requisitionZohoId = linkId(row, 'Zoho_Recruit_Job_Opening');
  const requisitionId = requisitionZohoId ? resolveParent('requisition', requisitionZohoId) : null;

  const url = trimmed(row, 'Calendly_Event_URL');
  const email = trimmed(row, 'Email');
  const body = [url ? `Calendly: ${url}` : null, email ? `Invitee: ${email}` : null]
    .filter(Boolean)
    .join('\n');

  const activity = {
    kind: 'meeting',
    subject: trimmed(row, 'CustomModule1_Name') || 'Calendly invite',
    body: body || null,
    occurred_at: occurredAt,
    person_id: personId,
    requisition_id: requisitionId,
    source_payload: row,
    created_by: resolveStaff(lookups, linkId(row, 'CustomModule1_Owner') || trimmed(row, 'CustomModule1_Owner'), unresolved),
  };

  return { zohoId, activity, warnings };
}
