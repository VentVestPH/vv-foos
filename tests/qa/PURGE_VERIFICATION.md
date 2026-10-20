# is_test purge verification — Agent 8, 2026-07-25

Brief instruction 9 asks QA to confirm test data can be cleanly purged and never leaks into non-test views. This covers both halves: the general mechanism, and a fresh sweep for anything QA itself left behind.

## The mechanism (already verified earlier this pass)

`supabase/tests/validate.sql` check 14 confirms every dashboard/list view filters on `is_test = false` (or the joined equivalent) correctly excludes seed data — re-run live this session, still passing.

Every QA fixture created during this pass followed one of two disciplines:

1. **Transaction-wrapped, rolled back** — used for anything that only needed to prove trigger/RLS behavior (e.g. the stage-transition check that led to QA-005). `begin; ... rollback;` means nothing was ever actually committed.
2. **Committed, then explicitly deleted** — used the few times a real (non-test) fixture was genuinely needed to expose a bug that only manifests for non-test data (QA-005's `dash.mv_stage_durations` fix, the `google-sync` match-and-write closure). Each of these was cleaned up row by row, including cascading `audit_log`/`events_outbox` rows, with a follow-up count query confirming zero remaining before moving on.

The Vitest flow tests (`hired-promotion.test.ts`, `careers-to-unviewed.test.ts`, `intake-dedup.test.ts`, `gmail-calendar-mocked.test.ts`) all use `is_test: true` fixtures with an `afterAll` that deletes everything they created — written this way from the start rather than as an afterthought.

## Fresh sweep, run just now

Query against the live project for anything a QA fixture might have left behind, keyed on the naming patterns QA fixtures actually used (`Qa` first names, `qa-*` emails, `%QA%` titles/company names):

| Check | Result |
|---|---|
| `people` rows named `Qa*` or emailed `qa-careers-flow-test@`/`qa-mock-candidate@` | 0 |
| `requisitions` titled `%QA%` | 0 |
| `applications` linked to a `Qa*`-named person | 0 |
| `companies` named `%QA%` | 0 |
| Total non-`is_test` rows in `people` | 0 |
| Total non-`is_test` rows in `requisitions` | 0 |
| Total non-`is_test` rows in `companies` | 0 |

All clean. Every fixture this pass — including the ones deliberately created as real (non-test) data to expose bugs that only manifest outside `is_test` — was fully removed after use.

## One known, accepted exception

`staff` has 5 rows, not the original 4 seed rows (flagged separately as QA-004) — the 5th is John's own real account, created by signing in via Google OAuth during Agent 6 testing. This is expected, healthy drift (a real user existing), not test-data leakage, and shouldn't be purged.

## Verdict

Purge discipline holds: the mechanism works, and this session's own fixtures left no trace. No new defect from this check.
