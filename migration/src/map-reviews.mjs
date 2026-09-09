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

export function mapReview(row, lookups, unresolved, resolveParent) {
  const warnings = [];
  const zohoId = trimmed(row, 'id') || trimmed(row, 'Id');
  if (!zohoId) return { skip: 'no review id', warnings };

  const occurredAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  if (!occurredAt) {
    return { skip: `unparseable Created_Time: ${trimmed(row, 'Created_Time') || '(blank)'}`, warnings };
  }

  const candidateZohoId = linkId(row, 'Candidate_Name');
  const personId = candidateZohoId ? resolveParent('candidate', candidateZohoId) : null;
  if (candidateZohoId && !personId) {
    warnings.push('Candidate_Name did not resolve to an imported candidate');
  }

  const rating = trimmed(row, 'Rating');
  const qualified = trimmed(row, 'Qualified');
  const status = trimmed(row, 'Status');
  const reviewedBy = trimmed(row, 'Reviewed_By');
  const parts = [
    trimmed(row, 'Review_Name') || null,
    rating ? `Rating: ${rating}` : null,
    qualified ? `Qualified: ${qualified}` : null,
    status ? `Status: ${status}` : null,
    reviewedBy ? `Reviewed by: ${reviewedBy}` : null,
    trimmed(row, 'Source') ? `Source: ${trimmed(row, 'Source')}` : null,
  ].filter(Boolean);

  const activity = {
    kind: 'note',
    subject: trimmed(row, 'Review_Name') || `Review ${trimmed(row, 'Review_ID') || zohoId}`,
    body: parts.length ? parts.join('\n') : null,
    occurred_at: occurredAt,
    person_id: personId,
    source_payload: row,
    created_by: resolveStaff(lookups, linkId(row, 'Review_Owner') || trimmed(row, 'Review_Owner'), unresolved),
  };

  return { zohoId, activity, warnings };
}
