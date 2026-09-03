import { parsePartialDate, parseZohoTimestamp } from './zoho.mjs';
import { resolveSource } from './lookups.mjs';

export const STAGE_BY_ZOHO_STATUS = new Map([
  ['talent pool', 'talent_pool'],

  ['sent inmail i (linkedin)', 'outreach'],
  ['sent inmail ii (linkedin)', 'outreach'],
  ['sent inmail & left vm', 'outreach'],
  ['sent email i', 'outreach'],
  ['candidate emailing resume', 'outreach'],

  ['associated', 'associated'],

  ['applied', 'received'],
  ['resume provided by candidate', 'received'],
  ['resume provided by third party', 'received'],
  ['reference provider', 'received'],

  ['candidate to review info', 'screening'],
  ['flag', 'screening'],

  ['interview to be scheduled', 'phone_screen'],

  ['submitted', 'submitted'],
  ['submitted to client', 'submitted'],

  ['interview in progress', 'client_interview'],
  ['interview-scheduled', 'client_interview'],
  ['interview scheduled', 'client_interview'],

  ['offer', 'offer'],
  ['offer extended', 'offer'],

  ['hired', 'hired'],
  ['placed', 'hired'],

  ['do not pursue', 'rejected'],
  ['unqualified', 'rejected'],
  ['archived', 'rejected'],
  ['rejected', 'rejected'],
]);

function trimmed(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.name ?? v.id ?? '').trim();
  return String(v).trim();
}

export function mapApplication(row, lookups, unresolved, resolve) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no application id', warnings };

  const candidateZohoId = trimmed(row, '$Candidate_Id');
  const openingZohoId = trimmed(row, '$Job_Opening_Id');
  if (!candidateZohoId) return { skip: 'no $Candidate_Id', warnings };
  if (!openingZohoId) return { skip: 'no $Job_Opening_Id', warnings };

  const personId = resolve.person(candidateZohoId);
  if (!personId) {
    return { skip: `candidate ${candidateZohoId} has not been imported`, warnings };
  }
  const requisitionId = resolve.requisition(openingZohoId);
  if (!requisitionId) {
    return { skip: `job opening ${openingZohoId} has not been imported`, warnings };
  }

  const sourceStatus = trimmed(row, 'Application_Status');
  const stage = STAGE_BY_ZOHO_STATUS.get(sourceStatus.toLowerCase());
  if (!stage) {
    warnings.push(
      `unmapped Application_Status "${sourceStatus}", defaulting to talent_pool. ` +
        'Add it to STAGE_BY_ZOHO_STATUS rather than leaving it to the default.',
    );
  }

  const createdAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  const appliedAt =
    createdAt ?? parseZohoTimestamp(trimmed(row, 'Updated_On')) ?? null;

  const initialDate = parsePartialDate(trimmed(row, 'Initial_Date'), trimmed(row, 'Created_Time'));

  const sourceName = trimmed(row, 'Application_Source');
  const sourceId = sourceName ? resolveSource(lookups, sourceName, unresolved) : null;

  const hiredAt = parseZohoTimestamp(trimmed(row, 'Date_Hired'));

  const application = {
    requisition_id: requisitionId,
    person_id: personId,
    stage: stage ?? 'talent_pool',
    source_status: sourceStatus || null,
    source_id: sourceId,
    applied_at: appliedAt,
    hired_at: hiredAt,
    is_shortlisted: false,
    answers: {},
  };

  const carried = {};
  const carry = (key) => {
    const v = trimmed(row, key);
    if (v) carried[key] = v;
  };
  carry('Application_ID');
  carry('Job_Opening_ID');
  carry('Job_Opening_Name');
  carry('Sourcer_Grade');
  carry('Application_Owner');
  if (initialDate) carried.Initial_Date = initialDate;

  return { zohoId, application, carried, warnings };
}
