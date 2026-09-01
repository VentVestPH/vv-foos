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

node migration/import.mjs --entity all             # dry run, writes nothing
node migration/import.mjs --entity candidates      # one entity at a time
node migration/import.mjs --entity all --apply     # writes
```

Useful flags:

| Flag | Effect |
| :---- | :---- |
| `--apply` | Actually write. Without it nothing is written |
| `--entity a,b` | Limit to named entities (`candidates`, `notes`, `attachments`) |
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

Notes and attachments resolve their parent through `zoho_id_map`, so candidates have to
be imported first. A row whose parent is not yet mapped is skipped and counted, never
written with a null parent: an activity with no links is invisible to
`can_access_activity` for everyone except an admin, so a silent orphan would be worse
than a visible skip.

## What each entity maps to

| Entity | Target | Notes |
| :---- | :---- | :---- |
| Candidates | `people` + `candidate_profiles` | Emails, phones and URLs are deduplicated; education becomes a jsonb array; SSN, passport and licence numbers are never imported |
| Notes | `activities` | `Note Title` maps to `activity_kind`; `Module` decides whether the parent is a person or an application |
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
