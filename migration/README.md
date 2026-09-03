# Zoho importer

Reads Zoho Recruit and Zoho CRM CSV exports and writes them into FOOS. Idempotent,
dry-run by default, and refuses to touch a non-local database without an explicit flag.

## Handling the exports

The export files contain real candidate and customer records. They live in
`migration/zoho-exports/`, which is gitignored, and so is `migration/out/` where the
reconciliation reports land. **Never commit either, and never paste an export or an
unredacted report into a ticket, a chat or a prompt.**

The importer redacts by default: staff names and Zoho record ids are replaced with
counts in both the console output and the JSON report. Pass `--show-names` only when
you need the actual values in front of you, and treat that output as confidential.

## Layout

```
migration/zoho-exports/          Recruit exports (Candidates, Notes, Attachments, Attachment Category)
migration/zoho-exports/crm/      CRM exports (Accounts, Contacts, Leads, Meetings, Users)
migration/out/                   Reconciliation reports, one JSON per run
migration/src/                   CSV parsing, Zoho value parsing, per-entity mappers
```

## Running it

```sh
supabase start
npm run db:reset                                   # optional, for a clean target

node migration/zoho-users.mjs                      # id-to-name map, needed before anything
node scripts/add-legacy-owners.mjs                 # dry run; --apply creates the missing staff
node scripts/bulk-load-triggers.mjs --disable      # only for a full-volume load

node migration/import.mjs --entity all             # dry run, writes nothing
node migration/import.mjs --entity candidates      # one entity at a time
node migration/import.mjs --entity all --apply     # writes

node scripts/bulk-load-triggers.mjs --enable       # put the triggers back
node scripts/verify-zoho-migration.mjs             # six passes, exits non-zero on any gap
```

The first three are prerequisites, not optional extras. Zoho's bulk read writes a bare
user id for a lookup field in CSV output and a `{name, id}` object in JSON output, so
without `zoho-users.mjs` every CSV-sourced module imports with no owner, creator or
modifier and the importer reports the ids as unresolved. `add-legacy-owners.mjs` then
needs that map to name the owners it must create. Both are safe to re-run.

`bulk-load-triggers.mjs --disable` is for a full-volume load only. `fn_set_updated_at`
fires `BEFORE UPDATE` and overwrites the Zoho `Modified_Time` the importer just supplied,
`fn_audit` writes one `audit_log` row per insert, and the status triggers write
`events_outbox` rows the frontend consumes over Realtime, so a 370,000-row import would
replay as that many fake live events. Validation triggers stay on. Nothing should treat
the database as live until `--status` reports zero disabled.

Useful flags:

| Flag | Effect |
| :---- | :---- |
| `--apply` | Actually write. Without it nothing is written |
| `--entity a,b` | Limit to named entities: `candidates`, `clients`, `requisitions`, `applications`, `notes`, `attachments`, `companies`, `contacts`, `recruitContacts`, `leads`, `crmNotes` |
| `--show-names` | Print unredacted staff names and Zoho ids |
| `--include-identity-documents` | Import attachments that look like identity or employment records. Off by default, see FINDINGS.md |
| `--allow-remote` | Permit a non-local target. Required, deliberately, and not to be used before a reviewed dry run |
| `--dir`, `--out` | Override the export and report directories |

It needs the service-role key. `zoho_id_map` has row-level security with no policies and
is granted to `service_role` only, so an ordinary session cannot read or write it. The
key is taken from `SUPABASE_SERVICE_ROLE_KEY`, or from `supabase status` when the local
stack is running.

## Idempotency

Every imported row is recorded in `zoho_id_map(zoho_id, entity_type, foos_id)`, which has
a unique key on the first two columns. A second run therefore **updates** what it
imported before rather than duplicating it. That is what makes the importer usable to
correct a previous migration: re-running candidates re-applies the full field mapping to
records that are already there.

## Order matters

Almost everything resolves a parent through `zoho_id_map`, so the phase order in `main()`
is a dependency order, not a preference:

1. **Candidates**, because applications, notes and attachments all resolve one.
2. **Clients**, because a requisition's `company_id` and a Recruit contact's company both
   come from here. This is why clients run before requisitions rather than alongside the
   other company import.
3. **Requisitions**, because an application resolves a job opening.
4. **Applications**, because a note on an `Applications` record resolves one.
5. **Notes** and **attachments**.
6. **CRM accounts**, then **CRM contacts**, **Recruit contacts** and **leads**, then
   **CRM notes**, which parents to a company, a contact or a lead.

A row whose parent is not yet mapped is skipped and counted, never written with a null
parent: an activity with no links is invisible to `can_access_activity` for everyone
except an admin, so a silent orphan would be worse than a visible skip.

Getting the order wrong does not corrupt anything, because every insert id is derived
deterministically from the Zoho id, so a re-run collides with itself rather than
duplicating. It does leave fields null until the phase that can fill them runs, which is
how all 687 requisitions spent a full import with no company.

## What each entity maps to

| Zoho module | Target | Notes |
| :---- | :---- | :---- |
| Recruit Candidates | `people` + `candidate_profiles` | Emails, phones and URLs are deduplicated; education becomes a jsonb array; SSN, passport and licence numbers are never imported |
| Recruit Job_Openings | `requisitions` | `company_id` resolves through the Clients map, so clients import first. `created_at` and `updated_at` come from `Created_Time` and `Modified_Time`, not from the custom `Creation_Date`, which is mostly null |
| Recruit Applications | `applications` | Resolves both a candidate and a job opening through `zoho_id_map`. All 21 Zoho `Application_Status` values map onto the 11 FOOS stages, and the raw value is kept in `source_status` |
| Recruit Notes | `activities` | `Note Title` maps to `activity_kind`; `Module` decides whether the parent is a candidate, an application or a job opening |
| Recruit Clients | `companies` with `types = ['client']` | Also the source of every requisition's company. All 687 job openings resolve against these 104 |
| Recruit Departments | nothing | Not a separate module. The same 104 record ids as Clients, asserted by the verifier on every run |
| Recruit Contacts | `people` + `contact_profiles` | Client-side contacts. `Client_Name` holds the client id, so the company resolves directly |
| CRM Accounts | `companies` | `Account Type` decides the `types` array |
| CRM Contacts | `people` + `contact_profiles` | |
| CRM Leads | `people` + `contact_profiles` + one `activities` note | FOOS has no leads table. No company row is created: the Zoho `Company` values mix employers with job titles, so the lead-only fields go on the note instead |
| CRM Notes | `activities` | Parented to a company for `Accounts`, a person for `Contacts` and `Leads`. 20 of the 59 have a blank title, which the Recruit note mapper skips and this one does not |
| Attachments | `attachments` | Metadata only, because the export carries no file bytes. `storage_path` is namespaced under `zoho-import/pending/` so it cannot be mistaken for an uploaded file |
| Attachment Category | lookup only | Resolves `Attachment Category Id` to an `attachment_kind`, keeping the original Zoho label in `description` |

## Known Zoho quirks the parser handles

- Timestamps are `MM/DD/YYYY hh:mm AM/PM`. Midnight and midday both parse correctly.
- `Initial Date` exports as `MM/DD` with **no year**. The year is taken from that
  candidate's `Created Time`, not from today, so importing in a later year does not
  silently move the date.
- `Rating` exports as `2.0` / `3.0`. `star_grade` is a 1-3 integer with a CHECK
  constraint, so anything outside that range is reported rather than clamped.
- `Digital Assistant - Facebook Messenger` in the export is `Digital Assistant - FB
  Messenger` in FOOS. Aliased explicitly; this is defect D4.
- Files are CRLF with quoted fields containing commas and newlines. The parser is
  RFC 4180 and does not use a naive split.

## Entities, as of 2026-09-03, from the bulk read

Counts are the extracted record count, and every one of them is checked against
`zoho_id_map` per record by `scripts/verify-zoho-migration.mjs`. Totals are not the test:
two modules can agree on a count and disagree on contents.

| Zoho module | Records | State |
| :---- | ----: | :---- |
| Recruit Candidates | 72,910 | all mapped |
| Recruit Job_Openings | 687 | all mapped, all with a company |
| Recruit Applications | 86,125 | all mapped |
| Recruit Notes | 210,922 | all mapped |
| Recruit Clients | 104 | all mapped |
| Recruit Departments | 104 | the same ids as Clients, nothing to import |
| Recruit Contacts | 5 | all mapped |
| CRM Accounts | 86 | all mapped |
| CRM Contacts | 50 | all mapped |
| CRM Leads | 13 | all mapped |
| CRM Notes | 59 | all mapped |
| Attachments | 50 | 42 mapped as metadata; 8 identity documents held back by default |

Candidate work history imports as an empty array because Zoho has none:
`Current_Employer`, `Experience_in_Years` and `Skill_Set` are blank on all 72,910
candidates, which is why the subform export came back header-only. `Current_Job_Title` is
populated on 3,560 and does import. Education is populated on 59,499 people.

Every lookup resolves, but only after three fixes that are easy to skip. Zoho user ids
had to be translated to names before `resolveStaff` could match anything, which is what
`migration/zoho-users.mjs` is for. `scripts/add-legacy-owners.mjs` then created the five
Zoho owners with no `staff` row, one of which accounted for 67,463 references on its own.
Migration `20260903000011` added the 16 sources and 12 candidate statuses FOOS had no row
for, without which 3,960 candidates imported with no source and 12,469 with no status.

Two export dialects, both handled. Recruit writes `MM/DD/YYYY hh:mm AM/PM`; CRM writes
`YYYY-MM-DD HH:MM:SS`. Bulk read writes ISO-8601 and calls the modified timestamp
`Updated_On` rather than `Modified Time`. `Initial Date` carries no year at all and has
three shapes, which is why `parsePartialDate` borrows the year from the row's own
`Created Time`.

Run everything from the repository root. From inside `migration/` the report lands in
`migration/migration/out/`, and reports contain candidate data.

## Verifying it

```sh
node scripts/verify-zoho-migration.mjs
```

Six passes, exiting non-zero on any gap:

1. Every extracted Zoho id has a `zoho_id_map` row, checked per record and per module.
2. Recruit Departments really is the same record set as Clients, so the duplicate-company
   trap stays closed if Zoho ever changes.
3. Every row in `people`, `companies`, `requisitions`, `applications` and `activities` is
   either imported or seed. Anything else is unaccounted for and fails.
4. Referential integrity: no two Zoho ids mapped to one FOOS row, no imported requisition
   without a company, no imported application whose person or requisition is unimported,
   no imported activity attached to nothing, no imported person without a profile, and no
   application whose stage silently fell back to `talent_pool`.
5. Timestamp fidelity for every extracted candidate, requisition and client, not a
   sample, by copying the extract's `Modified_Time` into a temporary table and joining. It
   also fails when fewer rows join than the extract holds.
6. The bulk-load triggers are enabled again.

One thing this script cannot do is notice that the extracted file itself is wrong,
because it reads that file. `scripts/verify-zoho-sample.mjs` closes that: it pulls a
random sample straight from the Zoho API, runs each live record through the real
mappers, and compares the result against the FOOS row. It needs credentials, so it is
the one pass that cannot run offline.

```sh
ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_RECRUIT_ORG_ID=org... \
  node scripts/verify-zoho-sample.mjs --size 12
```

The importer's own report is not evidence for any of this. It is produced by the code
under test, and it has been wrong in the alarming direction: a run that imported all
210,922 notes correctly reported all 210,922 as failed, because the success path
referenced an unbound variable after the insert and the mapping had already committed.

## Repair and reversal

```sh
node scripts/backfill-zoho-candidate-fields.mjs   # star_grade and initial_date, matched via zoho_id_map
node scripts/purge-zoho-import.mjs                # reverses an import; storage objects before attachment rows
```

Both dry-run by default and refuse a non-local target without `--allow-remote`. The backfill writes only fields that differ, so a second run reports zero changes.
