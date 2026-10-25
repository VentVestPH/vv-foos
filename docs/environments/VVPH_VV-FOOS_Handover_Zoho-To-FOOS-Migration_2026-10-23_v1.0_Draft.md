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

Zoho allows 6,250 API calls a day for the whole org. A full pull uses about 2,500.

## 3. The prompt

Open Claude Code in the repo root and paste this:

```text
Migrate the Zoho Recruit and CRM data into FOOS. Follow docs/environments/VVPH_VV-FOOS_Handover_Zoho-To-FOOS-Migration_2026-10-23_v1.0_Draft.md section 4, one step at a time. The credentials are already in my environment: print variable names only, never values. Stop and show me the actual output at each STOP. Do not run any write command against the live project until I have approved the dry-run numbers. Never commit anything under migration/zoho-exports or migration/out.
```

## 4. What Claude does

Run everything from the repo root. Each STOP is a point where Claude shows output and waits for you.

**Step 1. Check the target and the keys (read-only)**

1. Confirm `FOOS_SUPABASE_URL` and `DATABASE_URL` both contain `hilieyehhecrlccdveta`. Anything else, stop.
2. `node migration/zoho-bulk-read.mjs --counts-only` prints how many records Zoho holds per module.
3. Count what FOOS already holds:

```sql
select entity_type, count(*) from zoho_id_map group by 1 order by 1;
select count(*) from zoho_id_map;
```

After the 2026-09-09 load, `zoho_id_map` held 384,990 rows.

STOP 1. Show the Zoho counts next to the FOOS counts.

**Step 2. Back up**

```sh
mkdir -p ~/foos-backups/$(date +%F) && cd ~/foos-backups/$(date +%F)
pg_dump "$DATABASE_URL" --schema=public --format=custom --no-owner --file=public.dump \
  --exclude-table-data=public.audit_log --exclude-table-data=public.events_outbox
pg_restore --list public.dump | wc -l
```

The backup goes outside the repo. `audit_log` and `events_outbox` are excluded because triggers rebuild them. Supabase also keeps its own daily backup (Dashboard → Database → Backups).

**Step 3. Pull from Zoho and dry-run**

If `migration/zoho-exports/bulk` already exists, rename it to `bulk-2026-09-09` first. If the folder is missing, that is fine.

```sh
node migration/zoho-users.mjs
node migration/zoho-bulk-read.mjs --budget 4000
node migration/import.mjs --entity all --allow-remote
```

`zoho-users.mjs` maps Zoho user ids to names. Without it, imported rows have no owner. The last command has no `--apply`, so it writes nothing. It leaves a report in `migration/out/zoho-import-*.json`.

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

If it stops partway, run the same command again.

Do not pass `--include-identity-documents` unless John asks.

**Step 5. Verify**

```sh
node scripts/verify-zoho-migration.mjs --allow-remote
node scripts/verify-zoho-sample.mjs --size 12 --allow-remote
```

The first checks the database against the export on disk and exits non-zero on any gap. The second pulls a random sample from Zoho and compares field by field. Check that every module lists records compared. A run that compares zero records is not a pass.

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

- `scripts/import-new-zoho-records.mjs` (the delta script) refuses a live database URL, so it cannot see what is already mapped. Use the full pull in Step 3 instead. It costs more Zoho calls but works.
- A bulk load of tens of thousands of new rows runs the audit triggers and writes fake events into `events_outbox`. A small update is fine. For a large one, ask John before Step 4: the 2026-09-09 method was to load locally and copy the data to live.
- Not verified: that Roy's Self Client has the Recruit and CRM scopes the scripts need, and that the Zoho API behaves as it did on 2026-09-09. If Step 1 fails with `INVALID_CLIENT`, `ZOHO_DC` is usually wrong.
- `migration/README.md` is stale on which scripts exist. This file is right where they differ.

Reference: `docs/environments/VVPH_VV-FOOS_Record_Zoho-Pull-And-Singapore-Migration_2026-09-09_v1.0_Final.md` (what moved last time), `migration/ZOHO-API-SETUP.md` (Zoho API setup and credits).
