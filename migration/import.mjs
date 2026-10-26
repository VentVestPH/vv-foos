import { supabase, assertTarget, apiTarget } from '../scripts/local-stack.mjs';
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { deterministicId, isDuplicateKey, normalizeZohoId } from './src/deterministic-id.mjs';
import { parseCsvRecords } from './src/csv.mjs';
import { BULK_ALIASES, buildBulkColumnMap, bulkRowToExportRow } from './src/bulk-to-export.mjs';
import { mapRequisition } from './src/map-requisitions.mjs';
import { mapApplication } from './src/map-applications.mjs';
import { loadLookups, newUnresolved } from './src/lookups.mjs';
import { mapCandidate } from './src/map-candidates.mjs';
import { mapNote } from './src/map-notes.mjs';
import { buildCategoryMap, mapAttachment } from './src/map-attachments.mjs';
import { mapCompany } from './src/map-companies.mjs';
import { mapContact, unrecognisedContactColumns } from './src/map-contacts.mjs';
import { mapClient } from './src/map-clients.mjs';
import { mapRecruitContact } from './src/map-recruit-contacts.mjs';
import { mapLead } from './src/map-leads.mjs';
import { mapCrmNote } from './src/map-crm-notes.mjs';
import { mapTodo } from './src/map-todos.mjs';
import { mapReview } from './src/map-reviews.mjs';
import { mapCrmTask } from './src/map-crm-tasks.mjs';
import { mapCrmEvent } from './src/map-crm-events.mjs';
import { mapCalendlyInvite } from './src/map-calendly-invites.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const APPLY = has('--apply');
const EXPORT_DIR = valueOf('--dir', 'migration/zoho-exports');
const OUT_DIR = valueOf('--out', 'migration/out');
const ENTITIES = valueOf('--entity', 'all');
const INCLUDE_IDENTITY = has('--include-identity-documents');
const ALLOW_REMOTE = has('--allow-remote');
const CREATE_ONLY = has('--create-only');

const SHOW_NAMES = has('--show-names');

function localKeys() {
  const url = assertTarget(apiTarget(), 'api', process.argv.includes('--allow-remote'));
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (!key) {
    try {
      const env = supabase(['status', '-o', 'env'], { encoding: 'utf8' });
      key = /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(env)?.[1] ?? null;
    } catch {
      key = null;
    }
  }
  return { url, key };
}

const { url, key } = localKeys();
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(url);

if (!isLocal && !ALLOW_REMOTE) {
  console.error(
    `Refusing to run against ${url}.\n` +
      'This importer writes candidate and customer records. Point FOOS_SUPABASE_URL at the\n' +
      'local stack, or pass --allow-remote deliberately once the dry run has been reviewed.',
  );
  process.exit(1);
}
if (!key) {
  console.error(
    'No service-role key. The importer needs it: zoho_id_map has row-level security\n' +
      'enabled with no policies, and the lookup tables it writes are not reachable by\n' +
      'an ordinary session. Set SUPABASE_SERVICE_ROLE_KEY, or start the local stack so\n' +
      '`supabase status` can supply it.',
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const CRM_ACCOUNTS_FILE = 'crm/Accounts_2026_09_02.csv';
const CRM_CONTACTS_FILE = 'crm/Contacts_2026_09_02.csv';

const BULK_DIR = join(EXPORT_DIR, 'bulk');
const REASON_MAX = 120;

function readBulk(product, moduleName) {
  const aliases = BULK_ALIASES[`${product}/${moduleName}`] ?? {};
  const csvDir = join(BULK_DIR, `${product}_${moduleName}_p1`);
  const pagedFile = join(BULK_DIR, `${product}_${moduleName}_paged`, `${moduleName}.json`);

  let raw = null;
  if (existsSync(csvDir)) {
    const files = readdirSync(csvDir)
      .filter((f) => f.endsWith('.csv'))
      .sort();
    const header = [];
    const records = [];
    const seen = new Set();
    for (const file of files) {
      const parsed = parseCsvRecords(readFileSync(join(csvDir, file), 'utf8'));
      for (const column of parsed.header) if (!header.includes(column)) header.push(column);
      for (const record of parsed.records) {
        const id = String(record.Id ?? record.id ?? '').trim();
        if (id) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        records.push(record);
      }
    }
    if (files.length > 0) raw = { header, records };
  }
  if (!raw && existsSync(pagedFile)) {
    const rows = JSON.parse(readFileSync(pagedFile, 'utf8'));
    const header = rows.length ? Object.keys(rows[0]) : [];
    raw = { header, records: rows };
  }
  if (!raw) return null;

  const uiHeaderFile = BULK_UI_HEADERS[`${product}/${moduleName}`];
  const ui = uiHeaderFile ? readExport(uiHeaderFile) : null;

  const header = ui
    ? ui.header
    : [...new Set(raw.records.flatMap((r) => Object.keys(r)))]
        .filter((k) => k !== '__row' && !k.startsWith('$'))
        .map((k) => k.replace(/_/g, ' '));

  const columnMap = buildBulkColumnMap(header);
  return {
    header,
    records: raw.records.map((r) => ({
      ...r,
      ...bulkRowToExportRow(r, columnMap, aliases),
    })),
  };
}

const BULK_UI_HEADERS = {
  'ZohoRecruit/Candidates': 'Candidates_001.csv',
  'ZohoRecruit/Notes': 'Notes_001.csv',
  'ZohoCRM/Accounts': 'crm/Accounts_2026_09_02.csv',
};

function readBulkOrExport(product, moduleName, fallbackName) {
  const bulk = readBulk(product, moduleName);
  if (bulk && bulk.records.length > 0) return { ...bulk, source: `bulk:${product}/${moduleName}` };
  const fallback = readExport(fallbackName);
  return fallback ? { ...fallback, source: `export:${fallbackName}` } : null;
}

function readExport(name) {
  const path = join(EXPORT_DIR, name);
  if (!existsSync(path)) return null;
  return parseCsvRecords(readFileSync(path, 'utf8'));
}

async function loadIdMap(entityType) {
  const map = new Map();
  const page = 1000;
  let after = '';
  for (;;) {
    const { data, error } = await db
      .from('zoho_id_map')
      .select('zoho_id, foos_id')
      .eq('entity_type', entityType)
      .gt('zoho_id', after)
      .order('zoho_id', { ascending: true })
      .limit(page);
    if (error) throw new Error(`could not read zoho_id_map: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) map.set(normalizeZohoId(row.zoho_id), row.foos_id);
    if (rows.length < page) break;
    after = rows[rows.length - 1].zoho_id;
  }

  const { count, error: countErr } = await db
    .from('zoho_id_map')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', entityType);
  if (countErr) throw new Error(`could not count zoho_id_map: ${countErr.message}`);
  if (count !== null && map.size !== count) {
    throw new Error(
      `zoho_id_map paging lost rows for ${entityType}: loaded ${map.size} of ${count}. ` +
        'Every mapping must be in memory before a resume, or an imported record looks new.',
    );
  }

  return map;
}

async function insertWithDeterministicId(table, entityType, zohoId, payload) {
  const id = deterministicId(entityType, zohoId);
  const { error } = await db.from(table).insert({ id, ...payload });
  if (error && !isDuplicateKey(error)) throw error;
  return { id, alreadyPresent: Boolean(error) };
}

async function recordMapping(zohoId, entityType, foosId) {
  const { error } = await db
    .from('zoho_id_map')
    .upsert(
      { zoho_id: normalizeZohoId(zohoId), entity_type: entityType, foos_id: foosId },
      { onConflict: 'zoho_id,entity_type' },
    );
  if (error) throw new Error(`could not record mapping for ${zohoId}: ${error.message}`);
}

const report = { startedAt: new Date().toISOString(), mode: APPLY ? 'apply' : 'dry-run', target: url, entities: {} };

function tally(name) {
  const t = {
    rowsInFile: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    skipReasons: {},
    warnings: {},
    identityDocuments: 0,
    metadataOnly: 0,
    fieldsSet: {},
  };
  report.entities[name] = t;
  return t;
}

function note(bucket, key) {

  const grouped = String(key ?? '')
    .replace(/Zrecruit_[0-9]+/g, '<id>')
    .replace(/zcrm_[0-9]+/g, '<id>')
    .replace(/\s+/g, ' ');
  const capped =
    grouped.length > REASON_MAX ? `${grouped.slice(0, REASON_MAX)}…` : grouped;
  bucket[capped] = (bucket[capped] ?? 0) + 1;
}

function countFields(t, obj) {
  for (const [k, v] of Object.entries(obj)) {
    const set = Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '' &&
      !(typeof v === 'object' && v !== null && Object.keys(v).length === 0);
    if (set) t.fieldsSet[k] = (t.fieldsSet[k] ?? 0) + 1;
  }
}

async function importCandidates(lookups, unresolved, idMaps) {
  const file = readBulkOrExport('ZohoRecruit', 'Candidates', 'Candidates_001.csv');
  const t = tally('candidates');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  if (file.source) t.source = file.source;
  const existing = idMaps.candidate;

  for (const row of file.records) {
    const mapped = mapCandidate(row, lookups, unresolved);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, { ...mapped.person, ...mapped.profile });

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;

      if (!known) existing.set(normalizeZohoId(mapped.zohoId), `dry-run:${mapped.zohoId}`);
      continue;
    }

    try {
      let personId = known;
      if (personId) {
        const { error } = await db.from('people').update(mapped.person).eq('id', personId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'people',
          'candidate',
          mapped.zohoId,
          mapped.person,
        );
        personId = inserted.id;
        if (!inserted.alreadyPresent) t.created += 1;
        else t.updated += 1;
      }

      const { error: profErr } = await db
        .from('candidate_profiles')
        .upsert({ person_id: personId, ...mapped.profile }, { onConflict: 'person_id' });
      if (profErr) throw profErr;

      await recordMapping(mapped.zohoId, 'candidate', personId);
      existing.set(normalizeZohoId(mapped.zohoId), personId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importRequisitions(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoRecruit', 'Job_Openings');
  const t = tally('requisitions');
  if (!file) {
    t.skipReasons['bulk export not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.requisition;

  for (const row of file.records) {
    const mapped = mapRequisition(row, lookups, unresolved, idMaps.company);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.requisition);

    const key = normalizeZohoId(mapped.zohoId);
    const known = existing.get(key) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else {
        t.created += 1;
        existing.set(key, `dry-run:${mapped.zohoId}`);
      }
      continue;
    }

    try {
      let reqId = known;
      if (reqId) {
        const { error } = await db.from('requisitions').update(mapped.requisition).eq('id', reqId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'requisitions',
          'requisition',
          mapped.zohoId,
          mapped.requisition,
        );
        reqId = inserted.id;
        if (!inserted.alreadyPresent) t.created += 1;
        else t.updated += 1;
      }

      if (mapped.ownerId) {
        const { error: ownErr } = await db
          .from('requisition_owners')
          .upsert(
            { requisition_id: reqId, staff_id: mapped.ownerId },
            { onConflict: 'requisition_id,staff_id' },
          );
        if (ownErr) throw ownErr;
      }

      await recordMapping(mapped.zohoId, 'requisition', reqId);
      existing.set(key, reqId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importApplications(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoRecruit', 'Applications');
  const t = tally('applications');
  if (!file) {
    t.skipReasons['bulk export not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.application;
  const resolve = {
    person: (zohoId) => idMaps.candidate.get(normalizeZohoId(zohoId)) ?? null,
    requisition: (zohoId) => idMaps.requisition.get(normalizeZohoId(zohoId)) ?? null,
  };

  for (const row of file.records) {
    const mapped = mapApplication(row, lookups, unresolved, resolve);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.application);

    const key = normalizeZohoId(mapped.zohoId);
    const known = existing.get(key) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else {
        t.created += 1;
        existing.set(key, `dry-run:${mapped.zohoId}`);
      }
      continue;
    }

    try {
      let appId = known;
      if (appId) {
        const { error } = await db.from('applications').update(mapped.application).eq('id', appId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'applications',
          'application',
          mapped.zohoId,
          mapped.application,
        );
        appId = inserted.id;
        if (!inserted.alreadyPresent) t.created += 1;
        else t.updated += 1;
      }
      await recordMapping(mapped.zohoId, 'application', appId);
      existing.set(key, appId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importCompanies(lookups, unresolved, idMaps) {
  const file = readBulkOrExport('ZohoCRM', 'Accounts', CRM_ACCOUNTS_FILE);
  const t = tally('companies');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.company;

  for (const row of file.records) {
    const mapped = mapCompany(row, lookups, unresolved);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.company);
    if (Object.keys(mapped.carried).length) t.metadataOnly += 1;

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      if (!known) existing.set(normalizeZohoId(mapped.zohoId), `dry-run:${mapped.zohoId}`);
      continue;
    }

    try {
      let companyId = known;
      if (companyId) {
        const { error } = await db.from('companies').update(mapped.company).eq('id', companyId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'companies',
          'company',
          mapped.zohoId,
          mapped.company,
        );
        companyId = inserted.id;
        t.created += 1;
      }
      await recordMapping(mapped.zohoId, 'company', companyId);
      existing.set(normalizeZohoId(mapped.zohoId), companyId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importContacts(lookups, unresolved, idMaps) {
  const file = readBulkOrExport('ZohoCRM', 'Contacts', CRM_CONTACTS_FILE);
  const t = tally('contacts');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.contact;
  const companyByZohoId = idMaps.company;

  const unknown = unrecognisedContactColumns(file.header);
  if (unknown.length) {
    note(t.warnings, `${unknown.length} column(s) in the export are not mapped: ${unknown.sort().join(', ')}`);
  }

  for (const row of file.records) {
    const mapped = mapContact(row, lookups, unresolved, companyByZohoId);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, { ...mapped.person, ...mapped.profile });

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      if (!known) existing.set(normalizeZohoId(mapped.zohoId), `dry-run:${mapped.zohoId}`);
      continue;
    }

    try {
      let personId = known;
      if (personId) {
        const { error } = await db.from('people').update(mapped.person).eq('id', personId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'people',
          'contact',
          mapped.zohoId,
          mapped.person,
        );
        personId = inserted.id;
        if (!inserted.alreadyPresent) t.created += 1;
        else t.updated += 1;
      }
      const { error: profErr } = await db
        .from('contact_profiles')
        .upsert({ person_id: personId, ...mapped.profile }, { onConflict: 'person_id' });
      if (profErr) throw profErr;
      await recordMapping(mapped.zohoId, 'contact', personId);
      existing.set(normalizeZohoId(mapped.zohoId), personId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importClients(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoRecruit', 'Clients');
  const t = tally('clients');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.company;

  for (const row of file.records) {
    const mapped = mapClient(row, lookups, unresolved);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.company);

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) {
        t.updated += 1;
      } else {
        t.created += 1;
        existing.set(normalizeZohoId(mapped.zohoId), `dry-run:${mapped.zohoId}`);
      }
      continue;
    }

    try {
      if (known) {
        const { error } = await db.from('companies').update(mapped.company).eq('id', known);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'companies',
          'company',
          mapped.zohoId,
          mapped.company,
        );
        await recordMapping(mapped.zohoId, 'company', inserted.id);
        existing.set(normalizeZohoId(mapped.zohoId), inserted.id);
        if (inserted.alreadyPresent) t.updated += 1;
        else t.created += 1;
      }
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importRecruitContacts(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoRecruit', 'Contacts');
  const t = tally('recruitContacts');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.contact;
  const companyByZohoId = idMaps.company;

  for (const row of file.records) {
    const mapped = mapRecruitContact(row, lookups, unresolved, companyByZohoId);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, { ...mapped.person, ...mapped.profile });

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      if (!known) existing.set(normalizeZohoId(mapped.zohoId), `dry-run:${mapped.zohoId}`);
      continue;
    }

    try {
      let personId = known;
      if (personId) {
        const { error } = await db.from('people').update(mapped.person).eq('id', personId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'people',
          'contact',
          mapped.zohoId,
          mapped.person,
        );
        personId = inserted.id;
        if (inserted.alreadyPresent) t.updated += 1;
        else t.created += 1;
      }
      const { error: profErr } = await db
        .from('contact_profiles')
        .upsert({ person_id: personId, ...mapped.profile }, { onConflict: 'person_id' });
      if (profErr) throw profErr;
      await recordMapping(mapped.zohoId, 'contact', personId);
      existing.set(normalizeZohoId(mapped.zohoId), personId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importLeads(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoCRM', 'Leads');
  const t = tally('leads');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.lead;

  for (const row of file.records) {
    const mapped = mapLead(row, lookups, unresolved);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, { ...mapped.person, ...mapped.profile });

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      if (!known) existing.set(normalizeZohoId(mapped.zohoId), `dry-run:${mapped.zohoId}`);
      continue;
    }

    try {
      let personId = known;
      if (personId) {
        const { error } = await db.from('people').update(mapped.person).eq('id', personId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'people',
          'lead',
          mapped.zohoId,
          mapped.person,
        );
        personId = inserted.id;
        if (inserted.alreadyPresent) t.updated += 1;
        else t.created += 1;
      }
      const { error: profErr } = await db
        .from('contact_profiles')
        .upsert({ person_id: personId, ...mapped.profile }, { onConflict: 'person_id' });
      if (profErr) throw profErr;
      const leadNote = await insertWithDeterministicId(
        'activities',
        'lead-note',
        mapped.zohoId,
        { ...mapped.leadNote, person_id: personId },
      );
      await recordMapping(mapped.zohoId, 'note', leadNote.id);
      await recordMapping(mapped.zohoId, 'lead', personId);
      existing.set(normalizeZohoId(mapped.zohoId), personId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}


function activityImporter(name, product, moduleName, entityType, mapper) {
  return async (lookups, unresolved, idMaps) => {
    const file = readBulk(product, moduleName);
    const t = tally(name);
    if (!file) {
      t.skipReasons['file not present'] = 1;
      return;
    }
    t.rowsInFile = file.records.length;
    const existing = idMaps[entityType] ?? new Map();
    idMaps[entityType] = existing;
    const resolveParent = (type, zohoId) => idMaps[type]?.get(normalizeZohoId(zohoId)) ?? null;

    for (const row of file.records) {
      const mapped = mapper(row, lookups, unresolved, resolveParent);
      if (mapped.skip) {
        t.skipped += 1;
        note(t.skipReasons, mapped.skip);
        continue;
      }
      for (const w of mapped.warnings) note(t.warnings, w);
      countFields(t, mapped.activity);

      const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
      if (known && CREATE_ONLY) {
        t.skipped += 1;
        note(t.skipReasons, 'already imported, left as is (--create-only)');
        continue;
      }
      if (!APPLY) {
        if (known) t.updated += 1;
        else t.created += 1;
        continue;
      }
      try {
        if (known) {
          const { error } = await db.from('activities').update(mapped.activity).eq('id', known);
          if (error) throw error;
          t.updated += 1;
        } else {
          const inserted = await insertWithDeterministicId(
            'activities',
            entityType,
            mapped.zohoId,
            mapped.activity,
          );
          await recordMapping(mapped.zohoId, entityType, inserted.id);
          existing.set(normalizeZohoId(mapped.zohoId), inserted.id);
          if (inserted.alreadyPresent) t.updated += 1;
          else t.created += 1;
        }
      } catch (e) {
        t.failed += 1;
        note(t.skipReasons, `write failed: ${e.message ?? e}`);
      }
    }
  };
}

async function importTodos(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoRecruit', 'To_Dos');
  const t = tally('todos');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.todo ?? new Map();
  idMaps.todo = existing;
  const resolveParent = (type, zohoId) => idMaps[type]?.get(normalizeZohoId(zohoId)) ?? null;

  for (const row of file.records) {
    const mapped = mapTodo(row, lookups, unresolved, resolveParent);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    const table = mapped.task ? 'tasks' : 'activities';
    const payload = mapped.task ?? mapped.activity;
    countFields(t, payload);
    note(t.warnings, `routed to ${table}`);

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      continue;
    }
    try {
      if (known) {
        const { error } = await db.from(table).update(payload).eq('id', known);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(table, 'todo', mapped.zohoId, payload);
        await recordMapping(mapped.zohoId, 'todo', inserted.id);
        existing.set(normalizeZohoId(mapped.zohoId), inserted.id);
        if (inserted.alreadyPresent) t.updated += 1;
        else t.created += 1;
      }
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

const importReviews = activityImporter('reviews', 'ZohoRecruit', 'Reviews', 'review', mapReview);
const importCrmEvents = activityImporter('crmEvents', 'ZohoCRM', 'Events', 'crmEvent', mapCrmEvent);
const importCalendlyInvites = activityImporter(
  'calendlyInvites',
  'ZohoRecruit',
  'Calendly_Invites',
  'calendlyInvite',
  mapCalendlyInvite,
);

async function importCrmTasks(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoCRM', 'Tasks');
  const t = tally('crmTasks');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.crmTask ?? new Map();
  idMaps.crmTask = existing;
  const resolveParent = (type, zohoId) => idMaps[type]?.get(normalizeZohoId(zohoId)) ?? null;

  for (const row of file.records) {
    const mapped = mapCrmTask(row, lookups, unresolved, resolveParent);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.task);

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      continue;
    }
    try {
      if (known) {
        const { error } = await db.from('tasks').update(mapped.task).eq('id', known);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId('tasks', 'crmTask', mapped.zohoId, mapped.task);
        await recordMapping(mapped.zohoId, 'crmTask', inserted.id);
        existing.set(normalizeZohoId(mapped.zohoId), inserted.id);
        if (inserted.alreadyPresent) t.updated += 1;
        else t.created += 1;
      }
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importCrmNotes(lookups, unresolved, idMaps) {
  const file = readBulk('ZohoCRM', 'Notes');
  const t = tally('crmNotes');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.note;
  const resolveParent = (type, zohoId) => idMaps[type]?.get(normalizeZohoId(zohoId)) ?? null;

  for (const row of file.records) {
    const mapped = mapCrmNote(row, lookups, unresolved, resolveParent);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.activity);

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      continue;
    }

    try {
      if (known) {
        const { error } = await db.from('activities').update(mapped.activity).eq('id', known);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'activities',
          'note',
          mapped.zohoId,
          mapped.activity,
        );
        await recordMapping(mapped.zohoId, 'note', inserted.id);
        existing.set(normalizeZohoId(mapped.zohoId), inserted.id);
        if (inserted.alreadyPresent) t.updated += 1;
        else t.created += 1;
      }
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importNotes(lookups, unresolved, idMaps) {
  const file = readBulkOrExport('ZohoRecruit', 'Notes', 'Notes_001.csv');
  const t = tally('notes');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.note;
  const resolveParent = (type, zohoId) =>
    idMaps[type]?.get(normalizeZohoId(zohoId)) ?? null;

  for (const row of file.records) {
    const mapped = mapNote(row, lookups, unresolved, resolveParent);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.activity);

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      continue;
    }

    try {
      if (known) {
        const { error } = await db.from('activities').update(mapped.activity).eq('id', known);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'activities',
          'note',
          mapped.zohoId,
          mapped.activity,
        );
        await recordMapping(mapped.zohoId, 'note', inserted.id);
        existing.set(normalizeZohoId(mapped.zohoId), inserted.id);
        t.created += 1;
      }
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importAttachments(lookups, unresolved, idMaps) {
  const categories = readExport('Attachment Category_001.csv');
  const file = readExport('Attachments_001.csv');
  const t = tally('attachments');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  if (!categories) {
    t.skipReasons['Attachment Category_001.csv not present, so no kind mapping'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const categoryById = buildCategoryMap(categories.records);
  const existing = idMaps.attachment;
  const resolveParent = (type, zohoId) =>
    idMaps[type]?.get(normalizeZohoId(zohoId)) ?? null;

  for (const row of file.records) {
    const mapped = mapAttachment(row, lookups, unresolved, resolveParent, categoryById, {
      includeIdentityDocuments: INCLUDE_IDENTITY,
    });
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      if (mapped.identity) t.identityDocuments += 1;
      continue;
    }
    if (!mapped.hasBytes) t.metadataOnly += 1;
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.attachment);

    const known = existing.get(normalizeZohoId(mapped.zohoId)) ?? null;
    if (known && CREATE_ONLY) {
      t.skipped += 1;
      note(t.skipReasons, 'already imported, left as is (--create-only)');
      continue;
    }
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      continue;
    }

    try {
      if (known) {
        const { error } = await db.from('attachments').update(mapped.attachment).eq('id', known);
        if (error) throw error;
        t.updated += 1;
      } else {
        const inserted = await insertWithDeterministicId(
          'attachments',
          'attachment',
          mapped.zohoId,
          mapped.attachment,
        );
        await recordMapping(mapped.zohoId, 'attachment', inserted.id);
        existing.set(normalizeZohoId(mapped.zohoId), inserted.id);
        t.created += 1;
      }
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

function reportMissingExports() {
  const expected = [
    ['Candidates_001.csv', 'candidates'],
    ['Notes_001.csv', 'notes'],
    ['Attachments_001.csv', 'attachment metadata'],
    ['Attachment Category_001.csv', 'attachment kind lookup'],
    ['Candidates_Educational_Details.csv', 'education history'],
    ['Candidates_Experience_Details.csv', 'work history'],
    [CRM_ACCOUNTS_FILE, 'CRM accounts'],
    [CRM_CONTACTS_FILE, 'CRM contacts'],
    ['Job_Openings_001.csv', 'requisitions (not yet exported)'],
  ];
  const missing = [];
  const emptyOfData = [];
  for (const [name, what] of expected) {
    const parsed = readExport(name);
    if (!parsed) {
      missing.push(`${name} (${what})`);
    } else if (parsed.records.length === 0) {
      emptyOfData.push(`${name} (${what}): header only, ${parsed.header.length} column(s)`);
    }
  }
  report.missingExports = missing;
  report.headerOnlyExports = emptyOfData;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const lookups = await loadLookups(db);
  const unresolved = newUnresolved();

  const idMaps = {
    candidate: await loadIdMap('candidate'),
    note: await loadIdMap('note'),
    attachment: await loadIdMap('attachment'),
    requisition: await loadIdMap('requisition'),
    application: await loadIdMap('application'),
    company: await loadIdMap('company'),
    contact: await loadIdMap('contact'),
    lead: await loadIdMap('lead'),
    todo: await loadIdMap('todo'),
    review: await loadIdMap('review'),
    crmTask: await loadIdMap('crmTask'),
    crmEvent: await loadIdMap('crmEvent'),
    calendlyInvite: await loadIdMap('calendlyInvite'),
  };

  report.existingMappings = Object.fromEntries(
    Object.entries(idMaps).map(([k, v]) => [k, v.size]),
  );

  const want = (name) => ENTITIES === 'all' || ENTITIES.split(',').includes(name);

  const needCandidatesForParents =
    !APPLY && (want('notes') || want('attachments') || want('applications'));
  if (want('candidates') || needCandidatesForParents) {
    await importCandidates(lookups, unresolved, idMaps);
    if (!want('candidates')) delete report.entities.candidates;
  }
  const needClientsForRequisitions =
    want('requisitions') || (!APPLY && (want('recruitContacts') || want('crmNotes')));
  if (want('clients') || needClientsForRequisitions) {
    await importClients(lookups, unresolved, idMaps);
    if (!want('clients')) delete report.entities.clients;
  }
  const needRequisitionsForApps = !APPLY && (want('applications') || want('notes'));
  if (want('requisitions') || needRequisitionsForApps) {
    await importRequisitions(lookups, unresolved, idMaps);
    if (!want('requisitions')) delete report.entities.requisitions;
  }
  const needApplicationsForNotes = !APPLY && want('notes');
  if (want('applications') || needApplicationsForNotes) {
    await importApplications(lookups, unresolved, idMaps);
    if (!want('applications')) delete report.entities.applications;
  }
  if (want('notes')) await importNotes(lookups, unresolved, idMaps);
  if (want('attachments')) await importAttachments(lookups, unresolved, idMaps);
  const needCompaniesForContacts = !APPLY && (want('contacts') || want('crmNotes'));
  if (want('companies') || needCompaniesForContacts) {
    await importCompanies(lookups, unresolved, idMaps);
    if (!want('companies')) delete report.entities.companies;
  }
  const needContactsForCrmNotes = !APPLY && want('crmNotes');
  if (want('contacts') || needContactsForCrmNotes) {
    await importContacts(lookups, unresolved, idMaps);
    if (!want('contacts')) delete report.entities.contacts;
  }
  if (want('recruitContacts')) await importRecruitContacts(lookups, unresolved, idMaps);
  const needLeadsForCrmNotes = !APPLY && want('crmNotes');
  if (want('leads') || needLeadsForCrmNotes) {
    await importLeads(lookups, unresolved, idMaps);
    if (!want('leads')) delete report.entities.leads;
  }
  if (want('crmNotes')) await importCrmNotes(lookups, unresolved, idMaps);
  if (want('todos')) await importTodos(lookups, unresolved, idMaps);
  if (want('reviews')) await importReviews(lookups, unresolved, idMaps);
  if (want('crmTasks')) await importCrmTasks(lookups, unresolved, idMaps);
  if (want('crmEvents')) await importCrmEvents(lookups, unresolved, idMaps);
  if (want('calendlyInvites')) await importCalendlyInvites(lookups, unresolved, idMaps);

  reportMissingExports();
  const redact = (m) =>
    SHOW_NAMES
      ? Object.fromEntries(m)
      : Object.fromEntries([...m.entries()].map(([, n], i) => [`value ${i + 1}`, n]));

  report.unresolved = {

    staff: redact(unresolved.staff),
    source: Object.fromEntries(unresolved.source),
    status: Object.fromEntries(unresolved.status),
    category: Object.fromEntries(unresolved.category),
    unimportedParents: unresolved.parent.size,
  };
  report.redacted = !SHOW_NAMES;
  report.finishedAt = new Date().toISOString();
  const totalFailed = Object.values(report.entities).reduce((n, e) => n + (e.failed ?? 0), 0);

  const path = join(OUT_DIR, `zoho-import-${report.mode}-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));

  console.log(`Zoho import ${report.mode} against ${url}`);
  for (const [name, t] of Object.entries(report.entities)) {
    console.log(
      `  ${name.padEnd(12)} ${String(t.rowsInFile).padStart(4)} rows  ` +
        `${String(t.created).padStart(4)} new  ${String(t.updated).padStart(4)} existing  ` +
        `${String(t.skipped).padStart(4)} skipped  ${String(t.failed).padStart(3)} failed`,
    );
    for (const [reason, n] of Object.entries(t.skipReasons)) {
      console.log(`${' '.repeat(18)}skip x${n}: ${reason}`);
    }
    if (t.identityDocuments) {
      console.log(`${' '.repeat(18)}${t.identityDocuments} identity/employment record(s) held back`);
    }
    if (t.metadataOnly) {
      const what =
        name === 'companies'
          ? 'row(s) carry source fields that companies has no column for'
          : 'row(s) carry no file bytes';
      console.log(`${' '.repeat(18)}${t.metadataOnly} ${what}`);
    }
  }
  for (const [what, entries] of Object.entries(report.unresolved)) {
    if (what === 'unimportedParents') continue;
    const keys = Object.keys(entries);
    if (!keys.length) continue;
    if (SHOW_NAMES) {
      console.log(`  unresolved ${what}: ${keys.join(', ')}`);
    } else {
      const rows = Object.values(entries).reduce((a, b) => a + b, 0);
      console.log(
        `  unresolved ${what}: ${keys.length} distinct value(s) across ${rows} row(s)` +
          ' (re-run with --show-names to list them)',
      );
    }
  }
  if (report.headerOnlyExports.length) {
    console.log('  header-only exports, nothing importable:');
    for (const e of report.headerOnlyExports) console.log(`    ${e}`);
  }
  if (report.missingExports.length) {
    console.log('  exports not present:');
    for (const e of report.missingExports) console.log(`    ${e}`);
  }
  console.log(`  report: ${path}`);
  if (!APPLY) console.log('  Dry run. Nothing was written. Re-run with --apply.');
  if (totalFailed > 0) {
    console.error(
      `\n${totalFailed} row(s) failed to write. The report names the reason per entity.`,
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
