# Zoho to FOOS migration: how to run it

**Date:** 2026-10-25 · **Status:** Draft · **For:** Roy · **Repo:** VV-FoOS, branch `develop`

The migration is a set of scripts in this repo. Claude runs them for you. You supply the keys, paste the prompt in section 3, and approve at three points. The importer is safe to re-run: it updates rows it already imported and creates only the new ones. It never deletes.

## 1. What you need before you start

| Item | Where to get it |
| :---- | :---- |
| Repo access | Ask Klent or John for GitHub access to `VentVestPH/vv-foos` |
| Node 20+, Docker, Supabase CLI, `psql` and `pg_dump` 17 | Install them. Check with `node -v`, `docker ps`, `supabase --version`, `pg_dump --version` |
| Zoho Self Client id and secret | `api-console.zoho.com` → Self Client |
| Zoho Recruit org id and CRM org id | The number in the address bar of each product, after `/org`. They are different numbers |
| Zoho data centre | `com` unless the org is hosted elsewhere |
| Supabase service-role key | Dashboard → Project Settings → API. This is a production secret |
| Database URL, session pooler, port 5432 | Dashboard → Connect → Session pooler. Not port 6543 |

Send the secrets through a password manager, not chat.

## 2. Set up once

```sh
git clone <repo-url> VV-FoOS && cd VV-FoOS
git checkout develop && git pull
npm install
supabase start
npm run db:reset
```

Create a file `.env.migration` **outside the repo** (for example `~/foos-migration.env`) with these lines, then run `set -a; source ~/foos-migration.env; set +a`:

```sh
ZOHO_DC=com
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_RECRUIT_ORG_ID=...
ZOHO_CRM_ORG_ID=...
FOOS_SUPABASE_URL=https://hilieyehhecrlccdveta.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
```

`FOOS_SUPABASE_URL` is optional when a command carries `--allow-remote`: the scripts then fall back to `SUPABASE_URL`. Without `--allow-remote` they stay on the local stack whatever the file says.

Zoho allows 6,250 API calls a day for the whole org. A full pull uses about 2,500. An incremental pull (Step 3) uses under 100.

## 3. The prompt

Open Claude Code in the repo root and paste this:

```text
Migrate the Zoho Recruit and CRM data into FOOS. Follow docs/environments/VVPH_VV-FOOS_Handover_Zoho-To-FOOS-Migration_2026-10-23_v1.0_Draft.md section 4, one step at a time. The credentials are already in my environment: print variable names only, never values. Stop and show me the actual output at each STOP. Do not run any write command against the live project until I have approved the dry-run numbers. Never commit anything under migration/zoho-exports or migration/out.
```

## 4. What Claude does

Run everything from the repo root. Each STOP is a point where Claude shows output and waits for you.

**Step 1. Check the target and the keys (read-only)**

1. Confirm `FOOS_SUPABASE_URL` and `DATABASE_URL` both contain `hilieyehhecrlccdveta`. Anything else, stop.
2. `node migration/zoho-bulk-read.mjs --counts-only --allow-remote` prints Zoho's count per module, then a table with one row per entity: records in Zoho, records in `zoho_id_map`, and the delta. It reads FOOS through `DATABASE_URL`, and it exits non-zero if any entity is short. The table already folds several modules into one entity, so no hand arithmetic is needed:

| Entity | Zoho modules it sums |
| :---- | :---- |
| `company` | Recruit Clients + CRM Accounts (Departments is a duplicate of Clients and is ignored) |
| `contact` | Recruit Contacts + CRM Contacts |
| `note` | Recruit Notes + CRM Notes + CRM Leads (each lead writes one note) |
| `todo`, `review`, `calendlyInvite`, `crmTask`, `crmEvent` | One module each |
| `attachment` | No module count. Attachments are walked per record |

A positive delta means FOOS holds records Zoho has since deleted. FOOS keeps them by design. A negative delta means records are missing.

After the 2026-09-09 load, `zoho_id_map` held 384,990 rows. After the 2026-10-27 top-up it held 385,298.

STOP 1. Show the table.

**Step 2. Back up**

```sh
mkdir -p ~/foos-backups/$(date +%F) && cd ~/foos-backups/$(date +%F)
pg_dump "$DATABASE_URL" --schema=public --format=custom --no-owner --file=public.dump \
  --exclude-table-data=public.audit_log --exclude-table-data=public.events_outbox
pg_restore --list public.dump | wc -l
```

The backup goes outside the repo. `audit_log` and `events_outbox` are excluded because triggers rebuild them. Supabase also keeps its own daily backup (Dashboard → Database → Backups).

**Step 3. Pull from Zoho and dry-run**

Pick one of two pulls.

**Incremental (use this for a top-up).** It pulls only Recruit records created or updated since the newest `imported_at` in `zoho_id_map`, minus one day of overlap. CRM modules hold about 260 records in total and are re-pulled in full. It writes to `migration/zoho-exports/since-<date>/bulk` and leaves the full export alone.

```sh
node migration/zoho-users.mjs
node migration/zoho-bulk-read.mjs --since auto --allow-remote
node migration/import.mjs --entity all --dir migration/zoho-exports/since-<date> --create-only --allow-remote
```

`--create-only` inserts records FOOS does not hold and leaves every existing row exactly as it is. It reports existing rows as `skipped` with the reason `already imported, left as is (--create-only)`. Use it unless John wants Zoho's current values written over FOOS edits.

**Full (first load, or to refresh values on purpose).** If `migration/zoho-exports/bulk` already exists, rename it to `bulk-<date of that pull>` first.

```sh
node migration/zoho-users.mjs
node migration/zoho-bulk-read.mjs --budget 4000
node migration/import.mjs --entity all --allow-remote
```

`zoho-users.mjs` maps Zoho user ids to names. Without it, imported rows have no owner. The import commands have no `--apply`, so they write nothing. Each leaves a report in `migration/out/zoho-import-*.json`.

`zoho-bulk-read.mjs` rejects a flag it does not know and exits before any Zoho call. `--help` prints the flags.

For each entity in the report:

| Field | Meaning |
| :---- | :---- |
| `created` | New records that will be inserted |
| `updated` | Records already in FOOS that will be overwritten with Zoho's current values |
| `skipped` | Held back. `skipReasons` says why |
| `failed` | Must be 0. If not, stop and show the error |

Also read `missingExports` and `unresolved`. A wrong folder path shows up as `missingExports`, not as an error.

STOP 2. Show this table, one row per module: Zoho now, in `zoho_id_map`, would create, would update, skipped, failed. John approves the numbers in writing.

Two things to say out loud when sending the table:

- `updated` overwrites any edit made in FOOS since the last pull. If John cannot say whether anyone edited imported candidates or contacts, ask before applying.
- Records deleted in Zoho stay in FOOS.

**Step 4. Apply**

Only after John approves STOP 2.

```sh
node scripts/add-legacy-owners.mjs --apply --allow-remote
node migration/import.mjs --entity all --apply --allow-remote
```

For an incremental pull, add the same `--dir migration/zoho-exports/since-<date> --create-only` that the dry run used. If it stops partway, run the same command again.

Do not pass `--include-identity-documents` unless John asks.

**Step 5. Verify**

```sh
node scripts/reconcile-zoho.mjs --entity all --budget 2000 --allow-remote
node scripts/verify-zoho-migration.mjs --allow-remote
node scripts/verify-zoho-sample.mjs --size 12 --allow-remote
```

`reconcile-zoho.mjs` lists every id Zoho holds and every id in `zoho_id_map`, per entity, and prints the ids Zoho has that FOOS lacks (`missing`) and the ids FOOS holds that Zoho no longer serves (`deleted upstream`). It is read-only and exits non-zero if anything is missing. Counts alone can hide a swap, where one record is deleted and another created, so this is the check that closes it. It costs about 1,900 list calls for `all`, and `note` is 1,060 of those. For a quick check pass the cheap entities: `--entity todo,review,calendlyInvite,crmTask,crmEvent,lead,company,contact` costs about 70. It refuses to start when its estimate is over `--budget`.

`verify-zoho-migration.mjs` checks the database against the export on disk and exits non-zero on any gap. It is only meaningful when the export on disk is as fresh as the pull, so skip it after an incremental pull. `verify-zoho-sample.mjs` pulls a random sample from Zoho and compares field by field. Check that every module lists records compared. A run that compares zero records is not a pass. Records in the sample that Zoho no longer serves are reported separately. The script describes them as upstream deletion or a record the importer synthesised, and the 2026-10-27 run listed three CRM note ids there that were not traced.

Then:

```sql
select count(*) from zoho_id_map;
select tgname from pg_trigger where not tgisinternal and tgenabled = 'D';
```

The first count equals the old total plus the approved `created`. The second query returns no rows.

Last, sign in to the live site as a real admin and open the candidate list and one new record. Check the total, the notes and the console.

STOP 3. Send John the table with a Result column, the verifier output, the backup location, and any check that did not pass or was not run.

## 5. Never do these

- `npm run db:push`, `supabase db reset`, or `scripts/purge-zoho-import.mjs` against the live project.
- Commit, paste or upload anything under `migration/zoho-exports/` or `migration/out/`. They hold real candidate and customer records.
- Put a key in a tracked file.
- Disable triggers on the live project without John's sign-off.

## 6. Where this can still go wrong

Read from the code on 2026-10-25, not run against live:

- `scripts/import-new-zoho-records.mjs` (the old delta script) refuses a live database URL, so it cannot see what is already mapped. Use the incremental pull with `--create-only` in Step 3 instead.
- The incremental pull sorts Recruit lists by `Modified_Time`, except Candidates and Applications, which use `Updated_On`. Sorting those two by `Modified_Time` returns an unrelated order with no error.
- A bulk load of tens of thousands of new rows runs the audit triggers and writes fake events into `events_outbox`. A small update is fine. For a large one, ask John before Step 4: the 2026-09-09 method was to load locally and copy the data to live.
- Not verified: that Roy's Self Client has the Recruit and CRM scopes the scripts need, and that the Zoho API behaves as it did on 2026-09-09. If Step 1 fails with `INVALID_CLIENT`, `ZOHO_DC` is usually wrong.
- `migration/README.md` is stale on which scripts exist. This file is right where they differ.

Reference: `docs/environments/VVPH_VV-FOOS_Record_Zoho-Pull-And-Singapore-Migration_2026-09-09_v1.0_Final.md` (what moved last time), `migration/ZOHO-API-SETUP.md` (Zoho API setup and credits).
