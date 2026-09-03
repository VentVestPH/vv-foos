import { parseZohoDate, parseZohoNumber, parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const STATUS_BY_ZOHO = new Map([
  ['filled', 'filled'],
  ['on-hold', 'on_hold'],
  ['on hold', 'on_hold'],
  ['in-progress', 'open'],
  ['in progress', 'open'],
  ['open', 'open'],
  ['closed', 'closed'],
  ['cancelled', 'closed'],
  ['canceled', 'closed'],
  ['draft', 'draft'],
  ['waiting for approval', 'waiting_approval'],
  ['inactive', 'on_hold'],
]);

const EMPLOYMENT_BY_ZOHO = new Map([
  ['full time', 'full_time'],
  ['full-time', 'full_time'],
  ['part time', 'part_time'],
  ['part-time', 'part_time'],
  ['contract', 'contract'],
  ['contract to hire', 'contract'],
  ['temporary', 'contract'],
  ['intern', 'intern'],
  ['internship', 'intern'],
]);

function trimmed(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function mapRequisition(row, lookups, unresolved, companyByZohoId) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id') || trimmed(row, 'Job_Opening_Id');
  if (!zohoId) return { skip: 'no job opening id', warnings };

  const title = trimmed(row, 'Job_Opening_Name');
  if (!title) return { skip: 'no Job_Opening_Name', warnings };

  const zohoStatus = trimmed(row, 'Job_Opening_Status');
  const status = STATUS_BY_ZOHO.get(zohoStatus.toLowerCase());
  if (!status) {
    warnings.push(
      `unrecognised Job_Opening_Status "${zohoStatus}", defaulting to open. ` +
        'The FOOS status set is locked, so a new Zoho status needs a deliberate mapping here.',
    );
  }

  const employmentZoho = trimmed(row, 'Job_Type');
  const employment = employmentZoho
    ? (EMPLOYMENT_BY_ZOHO.get(employmentZoho.toLowerCase()) ?? null)
    : null;
  if (employmentZoho && !employment) {
    warnings.push(`unrecognised Job_Type "${employmentZoho}", left null`);
  }

  const recruiter = trimmed(row, 'Assigned_Recruiter');
  const ownerId = recruiter ? resolveStaff(lookups, recruiter, unresolved) : null;

  const openings =
    parseZohoNumber(trimmed(row, 'Number_of_Positions')) ??
    parseZohoNumber(trimmed(row, 'No_of_Positions'));

  const clientZohoId = trimmed(row, 'Client_Name');
  const companyId = clientZohoId ? (companyByZohoId?.get(clientZohoId) ?? null) : null;
  if (clientZohoId && !companyId) {
    warnings.push('job opening references a client that is not imported yet');
  }

  const requisition = {
    title,
    job_code: trimmed(row, 'Job_Opening_ID') || null,
    company_id: companyId,
    status: status ?? 'open',
    location:
      [trimmed(row, 'City'), trimmed(row, 'State'), trimmed(row, 'Country')]
        .filter(Boolean)
        .join(', ') || null,
    employment_type: employment,
    num_openings: openings && openings > 0 ? openings : 1,
    opened_date: parseZohoDate(trimmed(row, 'Date_Opened')),
    filled_date: parseZohoDate(trimmed(row, 'Date_Closed')),
    pay_notes: trimmed(row, 'Salary') || null,
    description: trimmed(row, 'Job_Description') || null,
    is_published: false,
    is_test: false,
  };

  const carried = {};
  const carry = (key, target) => {
    const v = trimmed(row, key);
    if (v) carried[target ?? key] = v;
  };
  carry('Target_Date');
  carry('Candidate_Submission_Limit');
  carry('No_of_Candidates_Associated');
  carry('No_of_Candidates_Hired');
  carry('Revenue_per_Position');
  carry('Expected_Revenue');
  carry('Probability');
  carry('Industry');
  carry('Work_Experience');
  carry('Contact_Name');
  carry('Pipeline__s');
  carry('Taleo_Req_ID');
  carry('Last_Updated_In_Taleo');

  const createdAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  const updatedAt = parseZohoTimestamp(trimmed(row, 'Modified_Time'));
  if (createdAt) requisition.created_at = createdAt;
  else warnings.push('no usable Created_Time, so created_at falls back to the import time');
  if (updatedAt) requisition.updated_at = updatedAt;

  const taleoCreation = parseZohoTimestamp(trimmed(row, 'Creation_Date'));
  if (taleoCreation) carried.Creation_Date = taleoCreation;

  const unmapped = Object.keys(carried);
  if (unmapped.length) {
    warnings.push(
      `${unmapped.length} field(s) have no column on requisitions and are reported, not written: ${unmapped.sort().join(', ')}`,
    );
  }

  return { zohoId, requisition, ownerId, clientName: trimmed(row, 'Client_Name'), carried, warnings };
}
