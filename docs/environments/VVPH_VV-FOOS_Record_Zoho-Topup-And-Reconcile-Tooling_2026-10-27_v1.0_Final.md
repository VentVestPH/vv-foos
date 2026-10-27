# Zoho top-up and reconcile tooling: what was checked, what moved

**Date:** 2026-10-27 · **Status:** Final · **Tooling PR:** #8 (`54ec0dd` on `develop`) · **Follows:** `VVPH_VV-FOOS_Record_Zoho-Pull-And-Singapore-Migration_2026-09-09_v1.0_Final.md` and `VVPH_VV-FOOS_Handover_Zoho-To-FOOS-Migration_2026-10-23_v1.0_Draft.md`

## 1. Result

Roy's migration run was checked against live Zoho and live FOOS. Every Zoho record is in FOOS. Five To_Dos created in Zoho on 2026-10-26, after Roy's last write (2026-10-25 15:10 UTC), were missing and were imported. `zoho_id_map` went from 385,293 to 385,298 rows.

| Entity | In Zoho | In `zoho_id_map` | Missing | Deleted in Zoho |
| :---- | :---- | :---- | :---- | :---- |
| candidate | 73,014 | 73,014 | 0 | 0 |
| requisition | 687 | 687 | 0 | 0 |
| application | 86,230 | 86,230 | 0 | 0 |
| note (Recruit Notes + CRM Notes + CRM Leads) | 211,126 | 211,126 | 0 | 0 |
| todo | 11,843 | 11,844 | 0 | 1 |
| company (Recruit Clients + CRM Accounts), contact, lead, review, calendlyInvite, crmTask, crmEvent | match | match | 0 | 0 |

The deleted To_Do is `837085000004770002`. FOOS keeps records deleted in Zoho. The `attachment` type (1,747 rows) has no Zoho module count and was not diffed by id.

## 2. How it was checked

| Check | Result |
| :---- | :---- |
| Zoho count per module against `zoho_id_map` per entity | 16 of 16 modules counted. Expected map size `383,641 - 104 + 1,747 + 13 = 385,297` against 385,298 |
| `scripts/reconcile-zoho.mjs`, ID-level, 12 entities | 0 missing. 1,866 list calls for the four large entities, 80 for the eight small ones |
| `scripts/verify-zoho-sample.mjs --size 12 --allow-remote` | 149 records, 791 field comparisons, 0 mismatches |
| Disabled triggers (`pg_trigger`, `tgenabled = 'D'`) | 0 |

Not covered: field values beyond the 149 sampled records, and three CRM note ids (776105, 776100, 780001) that the sample verifier reports as no longer served by Zoho. They were not traced.

## 3. The top-up

1. Backup. `pg_dump` was not possible: the database password in `.env` was stale (section 5). A REST dump of the three tables the import writes went to `~/foos-backups/2026-10-27/`: `tasks` 11,270 rows, `zoho_id_map` 385,293, `activities` 218,731, plus the previous To_Dos export. That folder is outside the repo and holds candidate data. Supabase also holds a physical backup from 2026-10-26 21:05 UTC. Point-in-time recovery is off.
2. Pulled To_Dos only (112 credits, 11,843 rows, reconciled to Zoho's count). The dry run read 5 new and 11,838 existing. An import in that form overwrites the existing rows with Zoho's current values and erases any FOOS edit, so the five records were imported from a temp export that held only them.
3. Applied: 5 created, 0 updated, 0 failed. All five are Events, so they landed in `activities` (218,731 to 218,736). `tasks` is unchanged at 11,270.

## 4. Tooling added (PR #8)

| Tool | What it does |
| :---- | :---- |
| `migration/import.mjs --create-only` | Inserts records not yet mapped and leaves existing rows untouched. Existing rows count as `skipped` with the reason `already imported, left as is (--create-only)`. Guards 14 importers |
| `migration/zoho-bulk-read.mjs --since auto\|ISO` | Pulls Recruit records created or updated since the newest `imported_at` minus one day. 61 credits and 16 seconds in a test against about 2,500 for a full pull. Candidates and Applications sort on `Updated_On`; sorting them on `Modified_Time` returns an unrelated order with no error. CRM modules are re-pulled in full because CRM v7 lists need a `fields` parameter |
| `migration/zoho-bulk-read.mjs` flags | An unknown flag exits before any Zoho call and `--help` prints usage. `--counts-only --allow-remote` reads live and prints one row per entity with its delta |
| `scripts/reconcile-zoho.mjs` | Read-only. Lists every id in Zoho and in `zoho_id_map` per entity and prints the missing and the deleted-upstream. Exits non-zero if anything is missing. Refuses to start over `--budget` |
| `apiTarget()` in `scripts/local-stack.mjs` | `FOOS_SUPABASE_URL`, else `SUPABASE_URL` only with `--allow-remote`, else the local stack. Used by 5 scripts. `purge-zoho-import.mjs` is unchanged on purpose |

The recipe for the next top-up is in the handover document, section 4, steps 1 to 5.

## 5. What went wrong

| What | Cause | Resolution |
| :---- | :---- | :---- |
| `psql` against live: `password authentication failed for user "postgres"`. Deploy run 40421658959 failed at "Pending migrations" with `failed to connect to postgres` | The database password in `.env` and in the `SUPABASE_DB_URL` secret of the GitHub environment `dev` was stale | Password rotated in `.env` and the secret changed. Reran the workflow: success, "Remote database is up to date" |
| `zoho-bulk-read.mjs --help` started a full pull | No flag validation | Killed within seconds, nothing written. Flag validation added |
| `verify-zoho-sample.mjs` and `--counts-only` aimed at the local stack | Scripts default to local when `FOOS_SUPABASE_URL` is unset | `apiTarget()` |
| `Stop hook error: ... expected 'Stop' but got 'PostToolUse'` | `scripts/goal-reminder.sh` always emits `PostToolUse` | The three `goal-reminder.sh` entries removed from `.claude/settings.json` |

## 6. Deploy state

The tooling PR changed no migration and no frontend file. The database workflow succeeded on `54ec0dd` after the rerun with nothing to apply. The Cloudflare build `Workers Builds: vv-foos` (build `8e062efb-71f4-4822-af20-9ef9526101c7`) succeeded at 2026-10-26 23:44 UTC. The live site was not loaded to confirm the served build.

## 7. Open

- Point-in-time recovery: about $100 per month for 7 days of retention, $200 for 14, $400 for 28, billed per started hour and outside the Spend Cap. No decision.
- The three untraced CRM note ids in section 2.
- `--since` was exercised on Recruit modules only.
