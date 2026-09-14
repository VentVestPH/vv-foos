# Zoho full pull and the Singapore migration

**Date:** 2026-09-09 · **Status:** Final · **Outcome:** complete and verified

The record of what moved, what was verified and how, and what remains true afterwards. Numbers here are measured, not estimated.

## 1. Scope corrected: 11 modules to 16

The migration was built against 11 Zoho modules. Enumerating `settings/modules` for both products and counting every one found **five with records that had never been pulled or imported**:

| Module | Records |
| :---- | ---: |
| ZohoRecruit/To_Dos | 11,772 |
| ZohoRecruit/Reviews | 335 |
| ZohoCRM/Tasks | 54 |
| ZohoCRM/Events | 2 |
| ZohoRecruit/Calendly_Invites | 1 |

**12,164 records.** `To_Dos` alone is larger than every CRM module combined.

Neither module list is authoritative on its own. `Notes` (210,968) and `Departments` (104) do not appear in `settings/modules` yet answer both the count and list endpoints, and the first enumeration filtered on `api_supported !== false`, which is exactly how a module with data stays invisible. The real inventory is the union: **16 modules, 383,334 records**.

`Departments` needs no importer: its 104 rows are the `Clients` module under another name, overlapping **104 of 104 on both id and `Client_Name`** with nothing unique to either. Importing it would have created 104 duplicate companies.

Unreachable by any API, verified rather than assumed: `Documents` and `Emails` in both products (`api_supported=false`; the record API answers `INVALID_MODULE` / `NOT_SUPPORTED`), CRM `Activities` (an aggregate over Tasks/Events/Calls held individually), `Assessments` (a settings endpoint returning rating templates), `Actions_Performed` (204, empty).

## 2. The pull

`zoho-bulk-read.mjs --budget 4000` → **PULL_EXIT=0, 16/16 modules, 383,334 records, 2,465 credits, 46 minutes, 592 MB**. Every module reconciled against its own `actions/count` endpoint, and an independent distinct-id count on disk agreed at 383,334.

Zoho refused its own bulk result for Notes (`Crm_Implied_View_Notes`), so Notes and Applications took the paged fallback at 1,055 and 431 calls. That matters beyond one run: `zoho-attachments.mjs` had hardcoded each parent's corpus directory to `_p1` or `_paged`, so a module changing path would have yielded zero records-with-attachments and reported success having looked at nothing.

## 3. Attachments

Cost estimates that were wrong twice, recorded so they are not repeated: first **160,000 credits** (assumed one call per parent, without reading `recordsWithAttachments()`, which filters on Zoho's `Is_Attachment_Present` flag), then **13,385** (8 of 14 parent modules lack the flag and would be walked blind, To_Dos alone 11,772).

**The flag is not proof of support.** `To_Dos`, `Reviews` and `Departments` all answer `400 INVALID_DATA: "the relation name given seems to be invalid"` for attachments. Departments carries the flag, claimed 19, and all 19 failed. Probing the flagless modules for one record each removed 12,107 calls for the cost of two. Actual enumerate cost: **1,278**.

Result: **1,747 attachments**, identical to the 2026-09-03 walk module for module (Job_Openings 1,056 · Candidates 607 · Clients 43 · Applications 29 · CRM_Accounts 12), so no attachments were added in the intervening six days. CRM Contacts, CRM Leads, To_Dos, Reviews, Departments and Calendly_Invites hold **zero** attachments org-wide.

**One file is capped by Zoho.** `REVISED - Marketing Proposal for Ascend Global Careers.pdf` (record `7079769000000744026`) is 80,164,731 bytes per Zoho's metadata, but the download endpoint returns **HTTP 200 and exactly 25,000,000 bytes** on repeated independent fetches, with no `%%EOF` trailer. The complete file was obtained through the Zoho web UI and uploaded to both databases, sha256-verified. Nothing in our tooling caused this and no API path exists to it.

## 4. Load

`import.mjs` covered 8 entities. Five mappers were added (`map-todos`, `map-reviews`, `map-crm-tasks`, `map-crm-events`, `map-calendly-invites`) plus three schema migrations:

| Migration | Change |
| :---- | :---- |
| `20260909000004` | 7 company columns; `ends_at`, `location`, `all_day`, `source_payload` on `activities`; `completed_at`, `source_payload` on `tasks` |
| `20260909000005` | `companies.source_payload` |
| `20260909000006` | `zoho_id_map_entity_type_check` extended for the 5 new entity types |

`source_payload` holds the complete original record because Zoho emits metadata with no meaning here (`$approval_state`, `$process_flow`, `Check_In_Status`, `Rating`, `Qualified`) that is still data, and promoting all of it would mean about forty columns on core tables to serve five modules.

**To_Dos is two modules under one name.** `Activity_Type` is `Tasks` for 11,209 rows and `Events` for 563; `Due_Date`/`Status`/`Priority` populate exactly the 11,209 and `Start_DateTime1`/`End_DateTime1`/`Meeting_Venue`/`All_day` exactly the 563. Filing all 11,772 as activity notes would have reported success while discarding every due date. They are routed to `tasks` and `activities` respectively.

**Reconciliation:** 383,334 records, less the 104 Departments aliases, plus 1,747 attachments and 13 lead-derived notes, is **384,990**. `zoho_id_map` holds **384,990**.

## 5. Singapore

**A Supabase project's region cannot be changed** — the only path is a new project plus a full migration, so the data was loaded directly into Singapore rather than into Seoul twice. **Paid-plan projects also cannot be paused**, so the old project billed until deleted rather than being parked as a rollback.

Project `hilieyehhecrlccdveta`, `ap-southeast-1`, PostgreSQL 17.6. Connection must use the **session pooler on 5432**; the transaction pooler on 6543 breaks `pg_dump` and `db.<ref>.supabase.co` is AAAA-only.

All **61 migrations** applied with `--db-url` so the old link stayed intact as rollback. Schema parity confirmed: 61 migrations, 31 tables, 12 enums, 12 dash objects, pg_cron, 12 new columns.

**Excluded from the data dump deliberately:** `audit_log` (265 MB) and `events_outbox` (21 MB), because migration 10's triggers rebuild them from real activity and copying them imports a fake audit trail; plus `client_errors`, `attachment_deletion_queue`, `careers_rate_limit`, `_stage_duration_cache`. The load ran under `session_replication_role = replica`.

**Final state:** 26 of 26 COPY blocks, **22 tables matching local exactly with 0 mismatches**, `zoho_id_map` 384,990 both sides, storage **1,747 objects / 563,615,497 bytes byte-identical** by per-object name-and-size diff, **10 auth accounts all with `staff.id = auth.users.id`**, `validate.sql` exit 0 with 35 PASS lines, and RLS proven live (`get_my_role()` → `"recruiter"`, 73,022 candidates readable, anon 401).

`dash` had to be added to Data API exposed schemas — `PGRST106` with grants already correct, QA-001 recurring on a fresh project.

## 6. Edge Functions

**All 11 deployed** — one more than the old project, which never had `careers-status`. **7 secrets** where the old project had 4.

| Function | Verification |
| :---- | :---- |
| `gmail-send` | 200, real `gmailMessageId`, wrote an `activities` row |
| `calendar-create-meeting` | 200, real event with a working Meet link, wrote an `activities` row |
| `google-sync` | 200, `{"synced":0,"errors":[]}` — authenticated and ran; **matching unproven**, nothing to match |
| `careers-page` | 200, real HTML |
| 5 protected functions | 401 without a JWT, `verify_jwt=true` enforcing |
| `google-oauth-callback` / `google-sync` / `intake-email-parser` | 302 / 405 / 405, state- and secret-gated by design |

Two behaviours that look like bugs and are not: `careers-page` returns `content-type: text/plain` because **Supabase rewrites HTML from Edge Functions unless the project has a custom domain**, which is why `CAREERS_PUBLIC_ORIGIN` exists; and the careers page shows an empty state because all 687 imported requisitions have `is_published = false`.

**Google requires two redirect URIs per project**, and this cost real time: `/auth/v1/callback` for Supabase Auth sign-in and `/functions/v1/google-oauth-callback` for the Edge Function. Registering only the first gives `Error 400: redirect_uri_mismatch` on the Gmail/Calendar connect while sign-in works fine. For an **Internal** consent screen, scopes need not be declared, but the **Gmail API and Google Calendar API must be enabled** or every call returns `403 accessNotConfigured`.

## 7. Content verification

`verify-zoho-sample.mjs` extended from **2 modules to 15** across both products. It pulls records live from Zoho, runs them through the real import mappers and diffs field by field — the only check that reads Zoho rather than the extracted files.

**Result: 149 records, 791 field comparisons, 0 mismatches, exit 0.**

Two findings worth keeping:

- **`updated_at` cannot be compared against Zoho.** `fn_set_updated_at` overwrites it on every UPDATE, so it means "when we last wrote this row". The earlier "228 comparisons, 0 mismatches" passed only because those rows had not been updated since insert.
- **Three modules once reported "0 mismatches" having skipped every record**, because `BULK_ALIASES` maps `Id` (the CSV header) while the API returns `id`. A green check that verifies nothing is worse than a red one.

## 8. Decommission

Data audited three layers deep: the 76 rescued records **0 missing by id**; seven tables showed id gaps that were **seed rows with independently generated UUIDs** and matched **0 missing by natural key**; `retention_policy` and all 4 cron jobs identical.

**One real defect found, visible only from the old project:** the new project's staff row `a0000000-…0001` said `john@ventvest.com` while the auth user at that id said `demo-admin@ventvest.test`, inherited from local's seed. A Google sign-in as John would have minted a fresh id, found no staff row and shown an empty app. Fixed by aligning the auth user's email and identity_data; **10 accounts aligned, 0 auth users without a staff row**.

**Two files still pointed at the old project** and would have broken on deletion: `supabase/.temp/project-ref` and `app/.env`. Writing the ref file was insufficient — `LegacyDbConfigIpv6Error` required a real `supabase link` for the IPv4 pooler path.

Evidence nothing external depended on it: **no Edge Function invocations in 7 days**, and **no email-channel `intake_items` in the entire migrated history**, so `intake-email-parser` has never produced a record.

**Backup before deletion:** `migration/out/seoul-backup-2026-09-09/`, 22 files, **666 rows**, every file verified against the source's own count with 0 problems, all 20 tables holding rows plus `auth.users` and `auth.identities`. An equivalence proof answers "is this duplicated?"; a backup answers "can I get it back?". Only the second survives being wrong about the first.

Old project **deleted 2026-09-09**.

## 9. Open afterwards

- **`fn_fire_due_reminders` has PUBLIC EXECUTE** — a security-definer function any signed-in user can call to flip other users' reminders. Needs a caller guard, not a revoke, because the e2e suite calls it as an authenticated admin. Reported, not fixed.
- **`google-sync` matching is unproven.** It reads the 20 newest Gmail messages and 20 upcoming events; 0 matches is expected until a mailbox address coincides with one of the 73,093 people.
- **11,209 imported tasks carry Zoho's `Normal`/`High` priority strings** against 2 seed rows using lowercase `high`. A casing inconsistency, not a vocabulary mismatch.
- **Two stale Google redirect URIs** for the deleted project remain registered. Inert, worth removing.
