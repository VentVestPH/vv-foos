import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_ALIASES = new Map([
  ['Digital Assistant - Facebook Messenger', 'Digital Assistant - FB Messenger'],
  ['LinkdIn', 'LinkedIn'],
]);

export const STATUS_ALIASES = new Map([['Hired', 'Placed']]);

export const ATTACHMENT_KIND_BY_LABEL = new Map([
  ['Resume', 'resume'],
  ['Formatted Resume', 'resume'],
  ['Cover Letter', 'cover'],
  ['Contracts', 'contract'],
  ['Offer', 'offer'],
  ['Others', 'other'],
  ['LinkedIn Profile', 'other'],
  ['Email LinkedIn Profile', 'other'],
]);

export const ACTIVITY_KIND_BY_NOTE_TITLE = new Map([
  ['Email', 'email'],
  ['Call', 'call'],
  ['Meeting', 'meeting'],
  ['InMail', 'inmail'],
  ['Notes', 'note'],
  ['Note', 'note'],
]);

export const EXCLUDED_COLUMNS = new Set([
  'SSN',
  'PASSPORT NUMBER',
  'LICENSE NUMBER',
]);

const IDENTITY_PATTERNS = [
  /\bpassport\b/i,
  /\bbirth\s*certificate\b/i,
  /\bpsa\b/i,
  /\bnbi\b/i,
  /\bbir\s*\d{4}\b/i,
  /\b2316\b/i,
  /\bcoe\b/i,
  /\bcertificate\s+of\s+employment\b/i,
  /\bcertificate\s+of\s+graduation\b/i,
  /\bemployee\s+profile\b/i,
  /\bcharacter\s+reference\b/i,
];

export function looksLikeIdentityDocument(fileName) {

  const name = (fileName ?? '').replace(/[_-]+/g, ' ');
  return IDENTITY_PATTERNS.some((re) => re.test(name));
}

export async function loadLookups(db) {
  const [staff, sources, statuses] = await Promise.all([
    db.from('staff').select('id, full_name, email'),
    db.from('sources').select('id, name'),
    db.from('candidate_statuses').select('id, label'),
  ]);

  for (const [label, res] of [['staff', staff], ['sources', sources], ['candidate_statuses', statuses]]) {
    if (res.error) throw new Error(`could not read ${label}: ${res.error.message}`);
  }

  const norm = (s) => (s ?? '').trim().toLowerCase();

  return {
    staffByName: new Map((staff.data ?? []).map((s) => [norm(s.full_name), s.id])),
    sourceByName: new Map((sources.data ?? []).map((s) => [norm(s.name), s.id])),
    statusByLabel: new Map((statuses.data ?? []).map((s) => [norm(s.label), s.id])),
    nameByZohoUserId: loadZohoUserNames(),
  };
}

export function loadZohoUserNames(dir = 'migration/zoho-exports') {
  const path = join(dir, 'zoho-users.json');
  if (!existsSync(path)) return new Map();
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return new Map(Object.entries(raw).map(([id, name]) => [String(id), String(name)]));
}

const ZOHO_USER_ID = /^\d{10,}$/;

export function resolveStaff(lookups, zohoValue, unresolved) {
  const raw = String(zohoValue ?? '').trim();
  if (!raw) return null;

  let name = raw;
  if (ZOHO_USER_ID.test(raw)) {
    const resolved = lookups.nameByZohoUserId?.get(raw);
    if (!resolved) {
      unresolved.staff.set(raw, (unresolved.staff.get(raw) ?? 0) + 1);
      return null;
    }
    name = resolved;
  }

  const id = lookups.staffByName.get(name.trim().toLowerCase()) ?? null;
  if (!id) unresolved.staff.set(name, (unresolved.staff.get(name) ?? 0) + 1);
  return id;
}

export function resolveSource(lookups, zohoValue, unresolved) {
  const raw = (zohoValue ?? '').trim();
  if (!raw) return null;
  const mapped = SOURCE_ALIASES.get(raw) ?? raw;
  const id = lookups.sourceByName.get(mapped.toLowerCase()) ?? null;
  if (!id) unresolved.source.set(raw, (unresolved.source.get(raw) ?? 0) + 1);
  return id;
}

export function resolveStatus(lookups, zohoValue, unresolved) {
  const raw = (zohoValue ?? '').trim();
  if (!raw) return null;
  const mapped = STATUS_ALIASES.get(raw) ?? raw;
  const id = lookups.statusByLabel.get(mapped.toLowerCase()) ?? null;
  if (!id) unresolved.status.set(raw, (unresolved.status.get(raw) ?? 0) + 1);
  return id;
}

export function newUnresolved() {
  return { staff: new Map(), source: new Map(), status: new Map(), category: new Map(), parent: new Map() };
}
