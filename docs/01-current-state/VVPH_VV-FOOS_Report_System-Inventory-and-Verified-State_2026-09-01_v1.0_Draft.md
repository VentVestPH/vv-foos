# System Inventory and Verified State

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft

A snapshot of what exists and runs, verified on this machine against the live Supabase project rather than read from documentation. The narrative history of the project and the reconciliation against the 2026-09-01 meeting live in `VVPH_VV-FOOS_Report_Drive-Review-and-Meeting-Reconciliation_2026-09-01_v1.0_Draft.md`, alongside this document.

## 1. Frontends

Three interchangeable React frontends share one Supabase backend. Only one is in this working tree.

| Frontend | Port | Status here |
| :---- | :---- | :---- |
| `/foos` | 5173 | Original modern UI. Not in this tree |
| `/foos_redesign` | 5174 | Earlier redesign attempt. Not in this tree |
| `/foos_redesign_2` | 5175, `strictPort` | The Taleo replica. This is the working tree |

Build output goes to `dist/` with `emptyOutDir: false`. This tree is not a git repository, so there is no history, branch or diff to consult.

## 2. Toolchain, verified working

| Item | State |
| :---- | :---- |
| Node / npm | v26.4.0 / 11.17.0 |
| `npm install` | Clean, idempotent, exit 0 |
| `npm run typecheck --workspace=app` | Passes clean under `strict`, `noUnusedLocals`, `noUnusedParameters` |
| `npm run dev --workspace=app` | Vite 5.4.21 serving on 5175 in ~550ms |
| Playwright | 1.62.0, Chromium 1234 installed and launching |
| `fsevents` | Loads natively, so file watching is not on the polling fallback |
| Linter | None configured. Typecheck is the only static gate |

One historical note worth recording: `node_modules` originally arrived as a copy rather than an install, with no execute bits and `com.apple.quarantine` on 4,415 files. It was deleted and reinstalled. If the tree is ever copied between machines again, expect the same and reinstall rather than copy.

## 3. Routes, all verified rendering

20 routes render with the Taleo shell, correct titles, no horizontal body scroll and zero console errors. The per-route table is in the fidelity audit. Module structure:

| Mount | Module | Roles |
| :---- | :---- | :---- |
| `/` | `modules/dashboards` via `pages/DashboardPage.tsx` | all |
| `/recruit/*` | `modules/recruit` (ATS) | admin, recruiter, sourcer |
| `/sales/*` | `modules/sales` (CRM) | admin, recruiter, bd |
| `/intake/*` | `modules/intake` | all four |
| `/settings/*` | `modules/settings` | all four |
| `/employees`, `/onboard`, `/users`, `/courses` | `pages/TaleoModulePlaceholderPage.tsx` | all, admin only for Users |

## 4. Backend

Hosted Supabase project `mebfbbvrqdctamnzvbbs` ("Front Office OS"), Postgres 17.6, region `aws-1-ap-northeast-2`. Not a local stack. A Supabase local stack does run in Docker on this machine but belongs to an unrelated project (`Kappa-Omini-typescript`), and this repository has no `supabase/config.toml`, so it cannot start its own.

16 migration files in `supabase/migrations/`, plus at least three migrations applied to production that are not in source control. See D3 in the defect register.

## 5. Live data, counted 2026-09-01

| Table | Count | Note |
| :---- | :---- | :---- |
| `people` | 86 | 10 test, 76 real |
| `candidate_profiles` | 83 | 7 test, 76 real |
| `activities` | 236 | inmail 51, email 45, call 31, meeting 26, note 83 |
| `attachments` | 50 | resume 41, other 9. All 50 `storage_path` values are `pending-file-export/` placeholders |
| `applications` | 8 | |
| `requisitions` | 3 | all `is_test` |
| `companies` | 5 | all `is_test` |
| `staff` | 6 | 4 demo personas, 2 real |
| `candidate_statuses` | 18 | repository seed declares 4 |
| `sources` | 12 | repository seed declares 7 |

Of the 83 note-kind activities, 75 are `Zoho Candidate Stage (migrated)` records. The migration plan describes writing these "only if it disagrees with the derived `application_stage`"; since only 8 applications exist, effectively all 75 were written.

The live project holds real candidate PII. Test-data purge (`DELETE WHERE is_test`) does not touch it, which is correct, but it does mean the purge instructions in `README.md` now run against a database containing production records.

## 6. Accounts

Four demo accounts, all verified signing in and resolving to active staff rows with the expected roles. Password is shared and committed in plaintext at `tests/fixtures/personas.sql`, tracked as QA-003 and re-rated to High in the defect register.

| Email | Role |
| :---- | :---- |
| `demo-admin@ventvest.test` | admin |
| `rita.demo@ventvest.com` | recruiter |
| `sam.demo@ventvest.com` | sourcer |
| `ben.demo@ventvest.com` | bd |

There is no `staff` row for `klent@ventvest.com`, so Google sign-in as yourself lands on the "Account not provisioned" hold screen. `RequireAuth` resolves staff by `auth.uid()`, not by email address.

## 7. Environment variables

| File | Variables | Present |
| :---- | :---- | :---- |
| `app/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Yes, pointing at the live project |
| `.env` (root) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | No, only `.env.example` |
| `tests/.env` | `FOOS_SUPABASE_URL`, `FOOS_SUPABASE_ANON_KEY`, `FOOS_QA_TEST_PASSWORD` | No, only `.env.example` |

The absent `tests/.env` is why the Vitest suite has not run here. Creating it unblocks the API tests.

## 8. Settings no migration can apply

One-time Supabase Dashboard settings. A fresh project needs each again.

- Google OAuth restricted to the ventvest.com hosted domain, plus email and password fallback.
- `pg_cron` enabled, for the reminder job and the two 15-minute `dash` materialised-view refreshes.
- Data API exposed schemas must include `dash`, or every dashboard query fails with `PGRST106`. This was defect QA-001, fixed by John, and it is the setting most likely to be forgotten in a new environment.
