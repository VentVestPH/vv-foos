import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseCsvRecords } from './src/csv.mjs';
import { loadLookups, newUnresolved } from './src/lookups.mjs';
import { mapCandidate } from './src/map-candidates.mjs';
import { mapNote } from './src/map-notes.mjs';
import { buildCategoryMap, mapAttachment } from './src/map-attachments.mjs';

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
// These exports carry real candidate and customer records. Nothing that could
// identify a person is printed or written to the report unless explicitly asked
// for, so a terminal transcript or a pasted report stays safe to share.
const SHOW_NAMES = has('--show-names');

function localKeys() {
  const url = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (!key) {
    try {
      const env = execSync('supabase status -o env', { encoding: 'utf8' });
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

function readExport(name) {
  const path = join(EXPORT_DIR, name);
  if (!existsSync(path)) return null;
  return parseCsvRecords(readFileSync(path, 'utf8'));
}

async function loadIdMap(entityType) {
  const map = new Map();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await db
      .from('zoho_id_map')
      .select('zoho_id, foos_id')
      .eq('entity_type', entityType)
      .range(from, from + page - 1);
    if (error) throw new Error(`could not read zoho_id_map: ${error.message}`);
    for (const row of data ?? []) map.set(row.zoho_id, row.foos_id);
    if (!data || data.length < page) break;
    from += page;
  }
  return map;
}

async function recordMapping(zohoId, entityType, foosId) {
  const { error } = await db
    .from('zoho_id_map')
    .upsert({ zoho_id: zohoId, entity_type: entityType, foos_id: foosId }, { onConflict: 'zoho_id,entity_type' });
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
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function countFields(t, obj) {
  for (const [k, v] of Object.entries(obj)) {
    const set = Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '' &&
      !(typeof v === 'object' && v !== null && Object.keys(v).length === 0);
    if (set) t.fieldsSet[k] = (t.fieldsSet[k] ?? 0) + 1;
  }
}

async function importCandidates(lookups, unresolved, idMaps) {
  const file = readExport('Candidates_001.csv');
  const t = tally('candidates');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
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

    const known = existing.get(mapped.zohoId) ?? null;
    if (!APPLY) {
      if (known) t.updated += 1;
      else t.created += 1;
      continue;
    }

    try {
      let personId = known;
      if (personId) {
        const { error } = await db.from('people').update(mapped.person).eq('id', personId);
        if (error) throw error;
        t.updated += 1;
      } else {
        const { data, error } = await db.from('people').insert(mapped.person).select('id').single();
        if (error) throw error;
        personId = data.id;
        t.created += 1;
      }

      const { error: profErr } = await db
        .from('candidate_profiles')
        .upsert({ person_id: personId, ...mapped.profile }, { onConflict: 'person_id' });
      if (profErr) throw profErr;

      await recordMapping(mapped.zohoId, 'candidate', personId);
      existing.set(mapped.zohoId, personId);
    } catch (e) {
      t.failed += 1;
      note(t.skipReasons, `write failed: ${e.message ?? e}`);
    }
  }
}

async function importNotes(lookups, unresolved, idMaps) {
  const file = readExport('Notes_001.csv');
  const t = tally('notes');
  if (!file) {
    t.skipReasons['file not present'] = 1;
    return;
  }
  t.rowsInFile = file.records.length;
  const existing = idMaps.note;
  const resolveParent = (type, zohoId) => idMaps[type]?.get(zohoId) ?? null;

  for (const row of file.records) {
    const mapped = mapNote(row, lookups, unresolved, resolveParent);
    if (mapped.skip) {
      t.skipped += 1;
      note(t.skipReasons, mapped.skip);
      continue;
    }
    for (const w of mapped.warnings) note(t.warnings, w);
    countFields(t, mapped.activity);

    const known = existing.get(mapped.zohoId) ?? null;
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
        const { data, error } = await db.from('activities').insert(mapped.activity).select('id').single();
        if (error) throw error;
        await recordMapping(mapped.zohoId, 'note', data.id);
        existing.set(mapped.zohoId, data.id);
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
  const resolveParent = (type, zohoId) => idMaps[type]?.get(zohoId) ?? null;

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

    const known = existing.get(mapped.zohoId) ?? null;
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
        const { data, error } = await db.from('attachments').insert(mapped.attachment).select('id').single();
        if (error) throw error;
        await recordMapping(mapped.zohoId, 'attachment', data.id);
        existing.set(mapped.zohoId, data.id);
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
    ['Clients_001.csv', 'CRM accounts (not yet exported)'],
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
    company: await loadIdMap('company'),
    contact: await loadIdMap('contact'),
  };

  report.existingMappings = Object.fromEntries(
    Object.entries(idMaps).map(([k, v]) => [k, v.size]),
  );

  const want = (name) => ENTITIES === 'all' || ENTITIES.split(',').includes(name);

  if (want('candidates')) await importCandidates(lookups, unresolved, idMaps);
  if (want('notes')) await importNotes(lookups, unresolved, idMaps);
  if (want('attachments')) await importAttachments(lookups, unresolved, idMaps);

  reportMissingExports();
  const redact = (m) =>
    SHOW_NAMES
      ? Object.fromEntries(m)
      : Object.fromEntries([...m.entries()].map(([, n], i) => [`value ${i + 1}`, n]));

  report.unresolved = {
    // Source, status and category values are Zoho configuration rather than
    // personal data, so they are always named: they are what someone has to act
    // on. Staff values are people's names and are redacted with the rest.
    staff: redact(unresolved.staff),
    source: Object.fromEntries(unresolved.source),
    status: Object.fromEntries(unresolved.status),
    category: Object.fromEntries(unresolved.category),
    unimportedParents: unresolved.parent.size,
  };
  report.redacted = !SHOW_NAMES;
  report.finishedAt = new Date().toISOString();

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
      const safe = SHOW_NAMES ? reason : reason.replace(/Zrecruit_[0-9]+/g, 'Zrecruit_<id>');
      console.log(`${' '.repeat(18)}skip x${n}: ${safe}`);
    }
    if (t.identityDocuments) {
      console.log(`${' '.repeat(18)}${t.identityDocuments} identity/employment record(s) held back`);
    }
    if (t.metadataOnly) {
      console.log(`${' '.repeat(18)}${t.metadataOnly} row(s) carry no file bytes`);
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
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
