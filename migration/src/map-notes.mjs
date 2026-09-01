import { parseZohoTimestamp } from './zoho.mjs';
import { ACTIVITY_KIND_BY_NOTE_TITLE, resolveStaff } from './lookups.mjs';

export function mapNote(row, lookups, unresolved, resolveParent) {
  const warnings = [];
  const zohoId = row['Note Id'];
  if (!zohoId) return { skip: 'no Note Id', warnings };

  const title = (row['Note Title'] ?? '').trim();
  const kind = ACTIVITY_KIND_BY_NOTE_TITLE.get(title) ?? null;
  if (!kind) {
    return { skip: `unmapped Note Title: ${title || '(blank)'}`, warnings };
  }

  const occurredAt = parseZohoTimestamp(row['Created Time']);
  if (!occurredAt) {
    return { skip: `unparseable Created Time: ${row['Created Time'] || '(blank)'}`, warnings };
  }

  const module = (row['Module'] ?? '').trim();
  const parentZohoId = (row['Parent Id'] ?? '').trim();
  if (!parentZohoId) return { skip: 'no Parent Id', warnings };

  // Module decides which column Parent Id lands in. Applications rows are routed
  // through the application map; Candidates rows through the person map. A note
  // whose parent has not been imported is held back rather than orphaned, because
  // an activity with every link null is invisible to can_access_activity for
  // anyone but an admin.
  let personId = null;
  let applicationId = null;
  let requisitionId = null;

  if (module === 'Applications') {
    applicationId = resolveParent('application', parentZohoId);
    if (!applicationId) {
      unresolved.parent.set(`application:${parentZohoId}`, 1);
      return { skip: `parent application not imported: ${parentZohoId}`, warnings };
    }
    const jobOpening = (row['Job Opening Id'] ?? '').trim();
    if (jobOpening) requisitionId = resolveParent('requisition', jobOpening);
    const candidateZohoId = (row['Candidate Id'] ?? '').trim();
    if (candidateZohoId) personId = resolveParent('candidate', candidateZohoId);
  } else if (module === 'Candidates') {
    personId = resolveParent('candidate', parentZohoId);
    if (!personId) {
      unresolved.parent.set(`candidate:${parentZohoId}`, 1);
      return { skip: `parent candidate not imported: ${parentZohoId}`, warnings };
    }
  } else {
    return { skip: `unmapped Module: ${module || '(blank)'}`, warnings };
  }

  const body = (row['Note Content'] ?? '').trim();
  const subject = body ? body.split(/\r?\n/)[0].slice(0, 160) : `${title} (imported from Zoho)`;

  return {
    zohoId,
    activity: {
      kind,
      subject,
      body: body || null,
      occurred_at: occurredAt,
      person_id: personId,
      application_id: applicationId,
      requisition_id: requisitionId,
      created_by: resolveStaff(lookups, row['Note Owner Id'], unresolved),
    },
    warnings,
  };
}
