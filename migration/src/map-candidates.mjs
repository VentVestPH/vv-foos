import {
  parsePartialDate,
  parseStarGrade,
  parseZohoBoolean,
  parseZohoNumber,
  parseZohoTimestamp,
} from './zoho.mjs';
import { EXCLUDED_COLUMNS, resolveSource, resolveStaff, resolveStatus } from './lookups.mjs';

const EMAIL_COLUMNS = [
  ['Email', 'personal'],
  ['Secondary Email', 'personal'],
  ['Email 3', 'personal'],
  ['Work Email', 'work'],
  ['Probable Work Email', 'work'],
];

const PHONE_COLUMNS = [
  ['Phone', 'main'],
  ['Mobile', 'mobile'],
  ['Work Direct Phone', 'work'],
  ['Home Phone', 'home'],
  ['Home Phone 2', 'home'],
  ['Home Phone 3', 'home'],
  ['Undefined Phone', 'other'],
];

const URL_COLUMNS = [
  'Website',
  'Other Website',
  'Skype ID',
  'X (formerly Twitter)',
  'Facebook',
  'Instagram',
  'Tiktok',
];

const ASSESSMENT_COLUMNS = [
  'Assessment 1',
  'Assessment 2',
  'Recorded Voice Response',
  'Detail Acuity Assessment %',
  'Cognitive Quotient Survey %',
  'Numerical Profiency Test %',
  'Verbal Lexical Ability %',
  'Personality & Behavioral test %',
  'Average Score (%)',
];

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function dedupeBy(list, keyOf) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mapCandidate(row, lookups, unresolved) {
  const warnings = [];
  const zohoId = row['Candidate Id'];
  if (!zohoId) return { skip: 'no Candidate Id', warnings };

  for (const col of EXCLUDED_COLUMNS) {
    if ((row[col] ?? '').trim() !== '') {
      warnings.push(`${col} is populated and was deliberately not migrated`);
    }
  }

  const emails = dedupeBy(
    EMAIL_COLUMNS.flatMap(([col, type]) => {
      const raw = (row[col] ?? '').trim();
      if (!raw) return [];
      if (!isEmail(raw)) {
        warnings.push(`${col} is not a valid email address, dropped`);
        return [];
      }
      return [{ type, address: raw.toLowerCase() }];
    }),
    (e) => e.address,
  );

  const phones = dedupeBy(
    PHONE_COLUMNS.flatMap(([col, type]) => {
      const raw = (row[col] ?? '').trim();
      return raw ? [{ type, number: raw }] : [];
    }),
    (p) => p.number.replace(/\D/g, ''),
  );

  const otherUrls = dedupeBy(
    URL_COLUMNS.flatMap((col) => {
      const raw = (row[col] ?? '').trim();
      return raw ? [raw] : [];
    }),
    (u) => u.toLowerCase(),
  );

  const education = [];
  const year = (row['Year'] ?? '').trim();
  const discipline = (row['Bachelor Discipline'] ?? '').trim();
  const institution = (row['University'] ?? '').trim();
  if (year || discipline || institution) {
    education.push({
      institution: institution || null,
      discipline: discipline || null,
      graduation_year: year || null,
      degree: 'Bachelor',
    });
  }
  for (const col of ['Higher Degrees', 'Other Degrees']) {
    const raw = (row[col] ?? '').trim();
    if (raw) education.push({ institution: null, discipline: raw, graduation_year: null, degree: col });
  }

  const createdTime = row['Created Time'];
  const createdAt = parseZohoTimestamp(createdTime);
  if (createdTime && !createdAt) warnings.push(`unparseable Created Time: ${createdTime}`);
  const updatedAt = parseZohoTimestamp(row['Modified Time']);

  const person = {
    first_name: (row['First Name'] ?? '').trim() || null,
    middle_name: (row['Middle'] ?? '').trim() || null,
    last_name: (row['Last Name'] ?? '').trim() || null,
    headline: (row['Profile Summary'] ?? '').trim() || null,
    emails,
    phones,
    street: (row['Street'] ?? '').trim() || null,
    city: (row['City'] ?? '').trim() || null,
    state: (row['Province'] ?? '').trim() || null,
    postal_code: (row['Postal Code'] ?? '').trim() || null,
    country: (row['Country'] ?? '').trim() || null,
    linkedin_public_url: (row['LinkedIn'] ?? '').trim() || null,
    linkedin_recruiter_url: (row['LinkedIn Recruiter'] ?? '').trim() || null,
    other_urls: otherUrls,
    education,
    experience: [],
    is_test: false,
    created_by: resolveStaff(lookups, row['Created By'], unresolved),
  };
  if (createdAt) person.created_at = createdAt;
  if (updatedAt) person.updated_at = updatedAt;

  if (!person.first_name && !person.last_name) {
    return { skip: 'no name on the row', warnings };
  }

  const rating = parseStarGrade(row['Rating']);
  if (rating.grade === null && rating.reason && rating.reason !== 'empty') {
    warnings.push(`Rating not imported into star_grade: ${rating.reason}`);
  }

  const gradeParts = [];
  const sourcerGrade = (row['Sourcer Grade'] ?? '').trim();
  const amirGrade = (row['Amir Grade'] ?? '').trim();
  if (sourcerGrade) gradeParts.push(sourcerGrade);
  if (amirGrade) gradeParts.push(`Amir Grade: ${amirGrade}`);

  const assessments = {};
  for (const col of ASSESSMENT_COLUMNS) {
    const raw = (row[col] ?? '').trim();
    if (raw) assessments[col] = raw;
  }

  const initialDate = parsePartialDate(row['Initial Date'], createdTime);
  if ((row['Initial Date'] ?? '').trim() && !initialDate) {
    warnings.push(`unparseable Initial Date: ${row['Initial Date']}`);
  }

  const profile = {
    status_id: resolveStatus(lookups, row['Candidate Status'], unresolved),
    star_grade: rating.grade,
    grade_comment: gradeParts.length ? gradeParts.join(' | ') : null,
    current_title: (row['Current Job Title'] ?? '').trim() || null,
    current_employer: (row['Current Employer'] ?? '').trim() || null,
    initial_date: initialDate,
    source_id: resolveSource(lookups, row['Source'], unresolved),
    sourcer_id: resolveStaff(lookups, row['Candidate Owner Id'], unresolved),
    referred_by: (row['Referred By'] ?? '').trim() || null,
    do_not_contact: parseZohoBoolean(row['Is Blocked']) ?? false,
    expected_salary: parseZohoNumber(row['Expected Salary']),
    current_salary: parseZohoNumber(row['Current Salary']),
    salary_currency: (row['Currency'] ?? '').trim() || null,
    assessment_scores: assessments,
  };

  if (profile.star_grade !== null && !profile.grade_comment) {

    profile.grade_comment = `Imported from Zoho Rating: ${row['Rating']}`;
  }

  return { zohoId, person, profile, warnings };
}
