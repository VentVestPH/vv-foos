# QA Defect Log — VV-FOOS

Format per Agent 8 brief: id (QA-###), date found, module/agent, matrix criterion or flow reference, severity, steps to reproduce, expected vs actual, evidence link, status, fix owner, closed date.

Severity scale: **Critical** — data loss/corruption, RLS breach, auth bypass, careers page down (stops all testing on that module until fixed). **High** — core workflow broken with no workaround, or wrong data a user would act on. **Medium** — broken with a workaround, wrong counts/sorting, a Gate 3 step that no longer reproduces. **Low** — cosmetic/copy/spacing/token violations.

No real PII in any row below — all evidence is schema/config state or synthetic (`is_test`) data.

---

### QA-001 — `dash` schema not exposed to PostgREST

- **Date found:** 2026-07-25
- **Module/agent:** Agent 7 (Dashboards)
- **Reference:** Agent 7 brief deliverables (all five dashboards); this is a build-vs-runtime gap, not a written acceptance criterion, but it blocks all of them
- **Severity:** **High** — every dashboard query fails; no workaround from the UI. Not Critical because it's a fail-closed error (PGRST106), not data exposure or corruption.
- **Steps to reproduce:** Sign in as any staff role (e.g. sourcer `sam.demo@ventvest.com`), open `/` (dashboards home), or directly `GET {SUPABASE_URL}/rest/v1/vw_ats_funnel?select=application_id` with header `Accept-Profile: dash`.
- **Expected:** Rows (RLS-scoped) or an empty array.
- **Actual:** `{"code":"PGRST106","message":"Invalid schema: dash","hint":"Only the following schemas are exposed: public, graphql_public"}`. Confirmed via a real signed-in HTTP call (GoTrue password grant → PostgREST), not just schema inspection: `select setconfig from pg_db_role_setting ... where rolname='authenticator'` shows no `pgrst.db_schemas` override in the database — the exposed-schemas list is a Supabase Dashboard → Project Settings → Data API setting, not something a migration or the available Supabase MCP tools can change.
- **Evidence:** Live HTTP response captured via Claude in Chrome `javascript_tool` against `mebfbbvrqdctamnzvbbs.supabase.co`, 2026-07-25 (see this session's transcript). No PII.
- **Status:** closed — retested live 2026-07-25: `GET /rest/v1/vw_ats_funnel` with `Accept-Profile: dash` and a real sourcer JWT now returns `200 []` (correctly empty — all seed data is `is_test`, RLS/is_test-filtered as designed) instead of the PGRST106 error.
- **Fix owner:** John (added `dash` to Exposed schemas in Supabase Dashboard → Settings → Data API, 2026-07-25).
- **Closed date:** 2026-07-25. Follow-up: noted in `foos/app/src/modules/dashboards/README.md` and the Gate 4 exit report that any future environment (new project, or a migration dry-run environment) needs this same one-time dashboard setting — a schema migration alone can't set it.

### QA-002 — `careers_rate_limit` has row-level security disabled

- **Date found:** 2026-07-25
- **Module/agent:** Agent 4 (Careers page + intake), migration `20260725000001_careers.sql`
- **Reference:** Re-test matrix row A1-2 (RLS enabled on every public table); caught by both `supabase/tests/validate.sql` check 2 and the new `tests/sql/pgtap_suite.sql` test 2.
- **Severity:** **Medium** (downgraded from the RLS-breach default of Critical — see rationale). The architecture's rule is "RLS enabled on every public table," and this table violates it outright, which would normally be an automatic Critical per the brief's rules of engagement ("every RLS finding is severity critical by default. Never downgrade one without John's sign-off.") **This downgrade has not yet been signed off by John and should be treated as Critical until he confirms** — see note below.
- **Steps to reproduce:** `select relrowsecurity from pg_class where relname = 'careers_rate_limit'` → `false`.
- **Expected:** `true`, per the architecture doc's deny-by-default rule (section 5).
- **Actual:** `false`. Actual exposure is contained today because `select grantee, privilege_type from information_schema.role_table_grants where table_name='careers_rate_limit'` shows only `postgres` holds SELECT/INSERT/UPDATE/DELETE — `anon`/`authenticated`/`service_role` only have the default `TRUNCATE/REFERENCES/TRIGGER` grants, so no role can currently read or write this table over the API even with RLS off. But this is fragile: any future migration that grants broader access to this table would silently become exploitable, since there's no RLS policy to catch it.
- **Evidence:** `pg_class`/`information_schema.role_table_grants` queries against `mebfbbvrqdctamnzvbbs`, 2026-07-25. No PII (table only holds `ip`/`created_at`).
- **Status:** open
- **Fix owner:** Agent 4 owner — `alter table careers_rate_limit enable row level security;` plus a service-role-only policy (the `careers-apply` Edge Function is the only intended writer, via service role, which bypasses RLS regardless — so a permissive-looking `using (false)` policy is correct here, not a gap).
- **Closed date:** —
- **Note on severity:** per the brief's rule of engagement, this should default to Critical since it's an RLS finding. Flagging for John's explicit sign-off on the Medium downgrade rather than silently applying it — see Gate 4 exit report.

### QA-003 — Test-persona Auth credentials are QA-known values (operational, not a code defect)

- **Date found:** 2026-07-25
- **Module/agent:** QA fixture (`tests/fixtures/personas.sql`), not a build defect
- **Reference:** n/a — infrastructure note
- **Severity:** **Low** (informational — logged so it isn't forgotten, not because it's currently exploitable; these are demo/seed staff accounts, not real users)
- **Detail:** QA created real Supabase Auth identities (email/password) for the four demo staff rows (`demo-admin@ventvest.test`, `rita.demo@ventvest.com`, `sam.demo@ventvest.com`, `ben.demo@ventvest.com`) so API tests could sign in with real JWTs. Password is a fixed test value shared in `tests/.env.example`.
- **Fix owner:** Whoever runs the real-user cutover — rotate or delete these Auth identities (and consider whether the demo staff rows themselves should be deactivated) before go-live, since the passwords are not secret.
- **Status:** open (tracked, not blocking)
- **Closed date:** —

### QA-005 — `dash.mv_stage_durations` refresh read the wrong JSON shape, always producing null stage labels

- **Date found:** 2026-07-25, during the dashboard hand-computed spot-check (brief instruction 7)
- **Module/agent:** Agent 7 (Dashboards)
- **Reference:** Dashboard 2 (Time-in-Stage); re-test matrix row 7.7
- **Severity:** **High** — the dashboard would have silently shown blank/null stage labels for every real transition once non-test data existed. Masked entirely until now because all current data is `is_test` (excluded from the cache either way), so nothing on screen looked wrong yet.
- **Steps to reproduce:** `fn_audit()` (Agent 1, `20260711000010_triggers.sql`) writes UPDATE diffs as `{"stage": {"old": "received", "new": "screening"}, ...}` per changed column. `dash._refresh_stage_duration_cache()` read this as `al.diff->'stage'->>0` / `->>1` — array-index access on a JSON *object*, which always returns null. Confirmed live: forced a real UPDATE, inspected the actual `audit_log.diff` shape, and reproduced `stage_from`/`stage_to` both null in `mv_stage_durations`.
- **Expected:** `stage_from`/`stage_to` populated from the real transition; `duration_days` matching `(this changed_at - previous changed_at) / 86400`.
- **Actual (before fix):** Both null on every row that would ever have real (non-test) data.
- **Evidence:** Reproduced and fixed against a temporary, fully-cleaned-up non-test fixture (one company/requisition/person/application, three real stage transitions) — see this session's transcript. No PII (synthetic "Qa SpotcheckPerson" name only), and every fixture row plus its audit_log/events_outbox rows were deleted afterward (confirmed 0 remaining).
- **Status:** closed — fixed and retested live 2026-07-25. Corrected function reads `->>'old'`/`->>'new'` directly and adds `action = 'update'` to exclude INSERT rows (whose diff shape is the whole new row, not an old/new pair) from sneaking in as a spurious from=to=null row. Retest against the same fixture pattern showed correct labels and duration_days matching the hand-computed value exactly (0.00027514... days for a ~23.77s gap).
- **Fix owner:** Agent 7 owner (fixed in this session) — migration `20260725000004_agent7_dash_schema.sql` updated in place with the corrected function and a comment explaining the bug.
- **Closed date:** 2026-07-25

### QA-006 — Synced Gmail activity subjects show mojibake (double-encoding)

- **Date found:** 2026-07-25, during the gated live-account Gmail/Calendar smoke test
- **Module/agent:** Agent 6 (Gmail/Calendar), `google-sync`
- **Reference:** criterion 6.2 (sync produces correct activities); `tests/live/gmail-calendar-live-smoke.md`
- **Severity:** Low — cosmetic. Matching, `gmail_message_id`, and dedup all work correctly; only the displayed subject text is garbled.
- **Steps to reproduce:** Sync a real Gmail account with messages containing non-ASCII characters (em-dashes, curly quotes, emoji). Example seen live: an em-dash rendered as `Ã¢Â€Â”` instead of `—`.
- **Expected:** Subject displayed as sent (UTF-8 throughout).
- **Actual:** Non-ASCII characters mangled — consistent with a UTF-8 byte string being decoded as Latin-1 (or the reverse) somewhere between the Gmail API response and the `activities.subject` write.
- **Evidence:** Observed on real synced subjects during the live smoke test, 2026-07-25 (subjects are John's own inbox, not candidate/client PII — not pasted verbatim here beyond what's in the live-smoke doc).
- **Status:** open
- **Fix owner:** Agent 6 owner — check whether `google-sync` decodes the Gmail API's base64url/MIME-encoded-word subject header correctly (`=?UTF-8?...?=` style encoded-words need explicit decoding, not just base64).
- **Closed date:** —

### QA-007 — `reminder.due` has no UI consumer anywhere in the app

- **Date found:** 2026-07-25, while mapping the event pipeline (brief instruction 6)
- **Module/agent:** Cross-cutting — reminders are created via the ATS/CRM engagement toolkit (Agent 2/3) but `reminder.due` itself (fired by Agent 1's `fn_fire_due_reminders()` via pg_cron) has no listener
- **Severity:** Medium — a real, working feature (create a reminder, it fires on schedule, event reaches the outbox — all confirmed live) has no way to surface to the user who set it. Not High/Critical since nothing is broken or unsafe, just unbuilt.
- **Steps to reproduce:** `grep -ri "reminder" foos/app/src` finds reminder *creation* UI (engagement panels) but no Realtime subscription on `reminder.due`, no notification bell, toast, or list component referencing it anywhere in the frontend.
- **Expected:** Some UI surface (bell icon, banner, list) shows the user their fired reminders, per the architecture doc's event taxonomy implying every event has a UI effect.
- **Actual:** None found.
- **Evidence:** Codebase grep, 2026-07-25. No PII.
- **Status:** open
- **Fix owner:** Whoever owns the reminders feature end-to-end — needs a product decision on whether this was an intentional scope cut (confirm with John) or a real gap to close before Gate 4/5.
- **Closed date:** —

### QA-008 — Three of the four committed success metrics have no instrumentation at all

- **Date found:** 2026-07-25, during metric instrumentation verification (brief instruction 8)
- **Module/agent:** Agent 7 (Dashboards), against the delivery plan's Phase 6 commitment and the Agent 7 brief's own instruction 7
- **Reference:** Delivery plan (`VVPH_VV-FOOS_Plan_FOOS-Delivery-Plan_2026-07-25_v1.2_Draft.md`, line 9 and Phase 6 line 82: "Measure 30 days: adoption, cycle time vs baseline, data quality. Cancel Taleo, Zoho Recruit, Zoho CRM when both modules hold."); Agent 7 brief instruction 7 (exact formulas for all four metrics)
- **Severity:** **High** — the 30-day measurement window that gates cancelling the three legacy subscriptions has no working data source for 3 of its 4 required inputs. Not Critical: nothing is broken or unsafe today, and cancellation is weeks away, but this needs to be built before that gate, not discovered at it.
- **Detail:** `dash.vw_success_metrics` / `ExperimentMetrics.tsx` (the "Experiment metrics" panel, admin-only) is real, RLS-correct, and live — but it computes 7 generic pipeline-volume KPIs (`requisitions_opened`, `applications_hired`, `deals_won`, etc.), not the four specific metrics the brief and delivery plan actually specify:
  - **Adoption** (distinct active staff ÷ total active staff, weekly): no view computes this ratio. Raw ingredients exist (`dash.vw_staff_activities`, `dash.mv_staff_stage_advances`) but nothing aggregates them into an adoption number.
  - **Cycle time** (median intake→submitted, median deal-created→won): `dash.mv_stage_durations` gives a generic per-stage median/p90 (a real, working "time-in-stage" view) but not these two specific named medians.
  - **Cost**: `dash.cost_inputs` table exists with correct schema and RLS but holds zero seed rows and is never read by any query or component — no cost card was built.
  - **Data quality** (dedup rate, completeness, grading-history-preserved): the underlying columns (`intake_items.duplicate_of`, `star_grade`, `grade_comment`, contact fields) are used operationally but no query aggregates them into a metric.
- **Evidence:** Direct read of `foos/app/src/modules/dashboards/ExperimentMetrics.tsx`, `foos/supabase/migrations/20260725000004_agent7_dash_schema.sql` (`dash._refresh_success_metrics()`, lines ~400-442), and `foos/tests/api/rls-boundary.test.ts` (which only checks RLS visibility of the view, never asserts on its actual columns — this is why the gap wasn't caught earlier). No PII.
- **Status:** open
- **Fix owner:** Agent 7 owner — extend `dash._refresh_success_metrics()` (or add a sibling function/view) to compute the four specific metrics per the brief's instruction 7 formulas, seed `dash.cost_inputs` with the three real subscription costs, and add an admin-visible card set for them. Recommend adding a test asserting on `vw_success_metrics` column names/values, not just its RLS, so this can't regress silently again.
- **Closed date:** —

### QA-004 — `supabase/tests/validate.sql` check 9 has a stale seed-count assertion

- **Date found:** 2026-07-25
- **Module/agent:** Agent 1 (test script itself, not the schema)
- **Reference:** validate.sql check 9 ("PASS 9: seed rows all present")
- **Severity:** **Low** — test hygiene, not a schema defect. The underlying data is correct; the assertion is stale.
- **Detail:** Check 9 asserts `select count(*) from staff <> 4` fails. The live project now has 5 staff rows — the original 4 seed rows plus a real row created when John signed in via Google OAuth during Agent 6 testing. This is expected, healthy drift (a real user account existing), not a regression. Every other check 9 assertion (sources, statuses+labels+order, admin row by email, companies/people/requisitions/applications/deals counts) passed exactly as written.
- **Fix owner:** Whoever next touches `validate.sql` — change the assertion to `>= 4` and specifically check the 4 known seed IDs are present, rather than an exact total count, so it stays robust as real staff accounts are added.
- **Status:** open (cosmetic test fix, not urgent)
- **Closed date:** —

### QA-009 — the unviewed-badge live-update test failed at two workers, and is no longer reproducible

- **Date found:** 2026-09-03, while chasing the `list-keyboard` intermittent. **Date it stopped reproducing:** 2026-09-04, cause not attributable to a single change.
- **Module/agent:** `tests/e2e/realtime.spec.ts:21` "the unviewed badge on a requisition clears when a view is recorded elsewhere"
- **Severity:** **Low.** The behaviour under test works and the suite now proves it at two workers. Kept in the log because the mechanism is worth knowing and it could return.
- **Detail:** The local tenant `realtime-dev` is capped at `max_events_per_second = 100`. When a two-worker suite tripped that ceiling, the page's channel kept reporting `SUBSCRIBED` while receiving no `postgres_changes` for tens of seconds, so the test's `application_views` upserts never reached the browser and the badge never cleared. Instrumentation showed the channel subscribed at 593 ms, its subscribe callback firing one reload, then zero further requests for the full 30 s poll. The client cannot detect this, so no reconnection logic could have recovered from it.
- **Evidence, all measured:**
  - Failed **3 of 3** full-suite runs at two workers on unmodified `develop` with the day's app changes stashed, so it was never caused by them.
  - Passed **153 of 153** with `FOOS_PW_WORKERS=1`, and 2 of 2 in isolation, 5 of 5 as a pair.
  - Exactly **one** `MessagePerSecondRateLimitReached` per failing run. An earlier count of nine to fourteen was my own metric being wrong: `docker logs --since` was not filtering, so the figure was a cumulative total growing by one per run.
  - The ceiling cannot be raised. Setting `max_events_per_second = 1000` in `_realtime.tenants` does not survive a restart: the container runs `SEED_SELF_HOST=true` and re-seeds the tenant to 100 on every boot. There is no environment variable for it and `supabase/config.toml` has no such setting.
  - **Now clean: 5 consecutive full runs at two workers, 153 passed, rate-limit delta 0 each time.** Reverting U1.14 alone leaves it clean (153 passed, delta 0), and reverting U1.12's channel singleton alone leaves it clean too, so **no single change can be credited** and the honest reading is that the failure needed a burst that the current tree no longer produces. The one other difference is the regression spec itself, which now delays its own responses with `page.route` instead of racing the database, and so makes far fewer requests.
- **Status:** closed as not reproducible, with the caveat that it was never attributed to one cause. If it returns, `FOOS_PW_WORKERS=1` is the documented lever and the rate-limit delta is the metric to read, measured before and after a run rather than with `--since`.
- **Closed date:** 2026-09-04

---

### QA-010: `dashboard-channel-collision` claims another worker's `client_errors` rows, then deletes them

- **Date found:** 2026-09-07, in gate pass 1 of 3 while closing Goal 1. Fixed the same day.
- **Module/agent:** `tests/e2e/dashboard-channel-collision.spec.ts:47` "switching tabs does not rebind a realtime channel that is already joined"
- **Severity:** **Medium.** Two faults, both real: the assertion false-fails, and its cleanup destroys a concurrent spec's fixtures, so the collision can be scored against either spec depending on scheduling.
- **Steps to reproduce:** `npx playwright test e2e/dashboard-channel-collision.spec.ts e2e/error-reporting.spec.ts --workers=2`, repeatedly. It reproduces only when the two land in the same window, which is why one gate pass failed and the next passed on an unchanged tree.
- **Expected:** the test fails only on a client error the dashboard itself reported.
- **Actual, verbatim from `.gate/browser-pass-1.json`:**

```
Error: the dashboard reported a client error while switching tabs
- Expected  -  1
+ Received  + 18
+   "/recruit/candidates: e2e-error-3759-lgglsc flood 14",
+   ... 15 more flood rows ...
+   "/recruit/requisitions: e2e-error-3759-lgglsc rejection",
+   "/recruit/candidates: e2e-error-3759-lgglsc uncaught",
```

- **Cause:** the spec read `client_errors` filtered on `occurred_at >= startedAt` and **nothing else**. `error-reporting.spec.ts:5` tags its rows run-uniquely (`e2e-error-${process.pid}-${random}`) and `:62` deliberately writes 15 flood rows plus a rejection and an uncaught error, all on `/recruit/*`. At two workers those land inside the collision test's time window. The spec then deleted every row it had matched, so it also removed the other spec's fixtures **and destroyed the evidence of its own failure**, which is why `client_errors` read 0 rows by the time I looked.
- **Fix:** scope the read to the three routes this spec actually visits, `['/', '/?tab=pipeline', '/?tab=reports']`, via `.in('route', ownRoutes)`. `errorReporter.ts:47` writes `route` as `window.location.pathname + window.location.search`, so a client error this spec caused must carry one of those three. It still catches any real dashboard error and can no longer match or delete another spec's rows.
- **Evidence the fix holds:** the two specs run together at two workers, **5 consecutive runs, 4 passed each, exit 0 every time**. Before the fix the same pairing produced the failure above.
- **The general lesson, and it is already in `CLAUDE.md`:** "Fixtures must be run-unique. Cleanup by a shared prefix means two specs delete each other's rows." Cleaning up by **time window** is a weaker version of the same mistake, because the window belongs to no one. A spec that asserts a table is empty must still scope that assertion to rows it could have caused.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-011: `list-keyboard` asserted a row order it had captured before the list could reload

- **Date found:** 2026-09-07, in gate pass 5 of 5 while verifying W14. Fixed the same day.
- **Module/agent:** `tests/e2e/list-keyboard.spec.ts:38` "j and k walk the rows, Enter opens the record"
- **Severity:** **Medium.** A false failure, and it had been chased once before without being logged: QA-009 records itself as found "while chasing the `list-keyboard` intermittent", so this is that intermittent, finally attributed.
- **Steps to reproduce:** the full browser suite at two workers. It does not reproduce in isolation: **8 of 8 runs of the spec alone passed** on the tree that had just failed it in the gate.
- **Expected:** pressing `j` moves to the next row.
- **Actual, verbatim:**

```
Error: expect(received).toBe(expected)
  Expected: "80efe836-95d3-5714-9699-a242b61a641a"
  Received: "91ea1134-1092-5936-9d77-9fa3ee539e13"
  45 |     await page.keyboard.press('j');
> 46 |     expect(await activeKey(page)).toBe(second);
```

- **Cause, and the received value is what names it.** The received key is **a third row**, neither the captured first nor the captured second. So the keypress worked and the *list* had changed: the spec read `rows.nth(0)` and `rows.nth(1)` up front, then pressed a key, and between those two moments another worker's fixture write to `candidate_profiles` fired a realtime change, the candidate list reloaded, and the rows shifted. The spec was asserting a snapshot rather than the behaviour.
- **Why it is not the `Table` keyboard guard added in the same commit.** That guard can only decide *whether* `onRowKeyDown` runs. Had it wrongly blocked `j`, the active row would have stayed on the captured **first** key, and the failure would read `Received: <first>`. A third key cannot be produced by the guard, and 8 isolated runs agreed.
- **Fix:** assert movement **relative to the live DOM** instead of to a snapshot. A new `neighbourOfActive(page, offset)` helper reads the currently focused row, finds its neighbour in the DOM at that instant, and the assertion compares against that. The final `Enter` now navigates to whichever row it actually landed on. This tests the contract, "j moves to the next row", and is immune to the list reloading underneath it.
- **Evidence the fix holds:** **6 of 6 runs** of the rewritten spec. It is a stronger assertion than the one it replaces, not a looser one: the previous version could pass while `j` moved to the wrong row, provided the list had not reloaded.
- **The general lesson:** a spec that reads state, acts, then asserts against the state it read is racing anything that can change that state. On a page subscribed to realtime with 72,917 rows and a suite at two workers, that is a race it will lose eventually.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-012: the candidate CSV export trusted a cached total and exported nothing

- **Date found:** 2026-09-07, in gate pass 2 of 6 while verifying W14. Fixed the same day.
- **Module/agent:** `app/src/modules/recruit/candidates/CandidateListPage.tsx`, `exportFilteredRows`; surfaced by `tests/e2e/list-persistence.spec.ts:135` "2.11 the CSV export matches the filtered set on screen"
- **Severity:** **High.** A user narrows a filter to a handful of candidates, clicks Export CSV, and gets an **empty file** plus an error saying the filter matches more rows than an in-browser export can build. Wrong data with a misleading explanation, and it is a product defect rather than a test artefact.
- **Actual, verbatim:**

```
Error: a header plus one record per visible row; got 0 records for 3 rows
  at tests/e2e/list-persistence.spec.ts:200
```

- **Cause.** `exportFilteredRows` opened with `let matched = total;` and only ran its own count when `total` was `null`. `total` is maintained by a **separate** `refreshCount` callback with its own `useLatestOnly` guard, so the row list can be filtered and painted before the count catches up. In that window `total` still held the unfiltered **72,917**, which exceeds `EXPORT_ROW_CAP`, so the function called `setError(...)` and returned `[]`. `downloadCsv` then wrote a file with no rows and no header, which is why the record count was 0 rather than 1.
- **Why the row count and the total can disagree.** They are two independent queries against the same filter. Nothing sequences them, and the list renders as soon as the rows arrive. This is the same shape as QA-011: state read at one moment used to decide something at another.
- **Fix:** `exportFilteredRows` now **always counts the filter it is about to export** rather than consulting `total`. One extra `head: true` count per export, in exchange for the export never disagreeing with the filter it was asked for. The `total` dependency left the `useCallback` array with it.
- **Evidence the fix holds:** **6 of 6 runs** of `list-keyboard.spec.ts` and `list-persistence.spec.ts` together, having failed in the gate immediately before.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-013: `list-keyboard`'s End and Home test had the same snapshot race as QA-011

- **Date found:** 2026-09-07, gate pass 2 of 6, immediately after QA-011 was fixed.
- **Module/agent:** `tests/e2e/list-keyboard.spec.ts:73` "End and Home jump to the last and first row"
- **Severity:** **Low**, a false failure only, but it is recorded because **my QA-011 fix was incomplete**: I rewrote the sibling test at line 38 and left this one holding the identical race.
- **Cause:** it captured `first` and `last` from `rows.nth(0)` and `rows.nth(count - 1)` before pressing the keys, so a realtime reload between capture and keypress moved the rows underneath it.
- **Fix:** a new `edgeRowKey(page, 'first' | 'last')` helper reads the edge row from the live DOM at assertion time, matching the `neighbourOfActive` helper QA-011 introduced.
- **Evidence:** 6 of 6 runs.
- **The lesson, and it is about how I fixed QA-011:** when a defect is a pattern rather than a line, fixing the instance that failed is not fixing the defect. I should have grepped the file for every other assertion built the same way before calling it done, and the gate had to tell me twice.
- **Status:** closed.
- **Closed date:** 2026-09-07


---

### QA-011 reopened and closed properly: narrowing the race was not fixing it

- **Date:** 2026-09-07, the same day QA-011 was first closed.
- **What happened:** the first fix read the neighbouring row from the live DOM immediately before the keypress instead of at the top of the test. That narrowed the window and did not remove it. The gate failed it again, identically, with a third row key: `Expected "80efe836..."`, `Received "91ea1134..."`.
- **A second attempt that was worse, and is recorded because it failed 8 of 8.** I tried a zero-gap measurement: one `page.evaluate` that read the active row index, dispatched a synthetic `KeyboardEvent`, and read the index again. It reported `j moves down one row / Received: 0` on every run. The reason is architectural: `Table`'s `moveActive` sets React state and focus lands in the commit that follows, so nothing about focus is observable in the same synchronous turn as the dispatch. **A zero-gap measurement is impossible for an asynchronously-applied focus change**, and that is worth knowing before anyone tries it again.
- **The fix that works, and it is the pattern the suite already had.** `list-persistence.spec.ts` seeds run-unique fixtures and filters the list to them. Both keyboard tests now do the same: they insert three `people` rows tagged `Zkeys<pid>-<random>`, filter the candidate list to that token, and walk the three rows they own. Other workers' writes cannot enter a filtered set that only this run's token matches, so a realtime reload re-fetches the identical three rows and the identities hold.
- **Evidence:** **8 of 8 runs**, and `people where is_test` back to **10** afterwards, so the fixtures tear down cleanly.
- **The lesson, and it is the third time this session that this exact reasoning error cost a gate run:** when the cause is "another actor can change this state", the fix is to stop sharing the state, not to read it later. Narrowing a race window is not closing it.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-014: `error-reporting` read zero rows for a message the browser should have written

- **Date found:** 2026-09-07, gate pass 1 of 5 while verifying the W2/W3/W10 batch. Pass 2 of the same run passed the same test on the same tree.
- **Module/agent:** `tests/e2e/error-reporting.spec.ts:24` "an uncaught error is recorded with its route, and a repeat is not"
- **Severity:** **Medium.** A false failure, and the mechanism is one the suite has already been bitten by once.
- **Verbatim:** `Error: expect(received).toBe(expected) // Object.is equality  Expected: 1  Received: 0  Call Log: - Timeout 15000ms exceeded while waiting on the predicate`
- **What was ruled out, and how.** The other two tests in the same file passed in the same pass, seconds apart, in the same worker, so authentication, RLS and the reporter's insert path all work. `clientAs` throws on a failed sign-in, so the poll was reading as a real admin. `client_errors` was empty afterwards, so nothing arrived late. `dashboard-channel-collision` deletes only rows whose `route` is one of `['/', '/?tab=pipeline', '/?tab=reports']`, so it could not match a row recorded on `/recruit/candidates`, and `error-boundary` deletes only `%dynamically imported module%`.
- **The remaining candidate, and the reason it is not proven:** `errorReporter.ts:47` records `window.location.pathname + window.location.search`, and the test waits for `.table-wrap` rather than for the URL. If the app were on `/` at that moment, the row would carry `/`, which **is** in the collision spec's list, and the collision spec deletes what it matches. That is QA-010's mechanism arriving through a different door. It is a candidate rather than a cause because nothing captured the URL or the browser console at the moment of failure.
- **Fix, in two parts, neither of which is a retry.** First, the test now asserts `toHaveURL(/\/recruit\/candidates$/)` before dispatching, so if it is ever somewhere else it says so instead of reporting a bare zero, and the poll's failure message now carries whatever the browser console said. Second, the collision spec's routes are made **run-unique**: it navigates to `/?probe=<pid>-<random>` variants and matches only those, so no other spec's row can ever fall inside its window. That is the CLAUDE.md rule, "fixtures must be run-unique", applied to the route rather than to a row.
- **Realtime starvation ruled out by the container's own log.** `docker logs --since 40m supabase_realtime_VV-FoOS | grep -c MessagePerSecondRateLimitReached` returns **0** across the whole run, so the two-worker budget held and this is not the live-update starvation class that CLAUDE.md warns about.
- **One hypothesis refuted from the vendor's own documentation rather than dropped.** The obvious explanation was that the insert went out with the anon key because `gotoAsSignedIn` does a full page load and the session had not been read back from local storage yet. That does not hold for supabase-js v2: the v2 rewrite "forces the library to wait for a valid/invalid session before taking any action", and `auth.getSession` reads the token from local storage without a server round trip unless it is expired. So a request issued moments after load carries the restored JWT rather than the anon key. Sources: https://supabase.com/blog/supabase-js-v2 and https://supabase.com/docs/reference/javascript/auth-getsession. That leaves the wrong-route candidate and a plain insert error, which is what the two diagnostics now distinguish.
- **Machine contention is part of the picture, and it is recorded rather than used as an excuse.** While this run was going, a second Claude Code session was driving a browser in a different repository, `/Users/klentz/Work/Kappa-Omini-typescript`, with its own Supabase stack. It shares no git tree, no database and no dev server with this project, so it cannot corrupt anything here; what it does is compete for CPU, which widens exactly the timing windows that produced this defect and the 204-node contrast artefact. That argues for sturdier waits, which is what was built, and not for a retry.
- **A second harness defect found while verifying the fix, and it is the same class as the contrast race in item 25 of the Goal 5 log.** `waitForAnimations` polled until nothing was running, which is one reading. Running `accessibility.spec.ts` alongside three other specs still failed once on a route sweep, because an animation can start in the gap between the check and axe's measurement. It now requires **three consecutive still readings** 80ms apart. The four specs then passed together three times over, 11 of 11 each.
- **Status:** open until a run reproduces it with the diagnostics in place, or ten consecutive gate passes do not.

---

### QA-015: the timeline fixture teardown deletes 120 rows with an unindexed `LIKE` and times out

- **Date found:** 2026-09-07, gate pass 3 of 5 in the same run as QA-014.
- **Module/agent:** `tests/e2e/timeline-cap.spec.ts:28` `afterAll`
- **Severity:** **Medium**, and it compounds. The teardown fails, 120 rows leak, `activities` grows, and the next run's `LIKE` scan is slower than the last.
- **Verbatim:** `Error: could not remove the timeline fixture: canceling statement due to statement timeout`
- **Cause:** `.delete().like('subject', '${MARKER}%')` on `activities`, which held **213,819** rows when this failed and has no index on `subject`, so the delete is a full scan. Under the load of a 175-test browser run at two workers it exceeds the statement timeout.
- **Evidence it leaked:** `select count(*) from activities where subject like 'timeline-cap %'` returned **120** immediately after the failing pass.
- **Fix:** the seed now uses `.insert(rows).select('id')` and asserts it got all 120 ids; the teardown deletes `.in('id', seededIds)`, which is a primary-key lookup and cannot scan. The verification count reads the same ids.
- **The lesson:** a teardown that identifies its rows by a text pattern is not just slower than one that keeps its ids, it is a different failure class. Keeping the ids costs one `.select('id')`.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-016: the side-tab count badge fails WCAG 1.4.3 at 4.35:1, and four axe sweeps missed it

- **Date found:** 2026-09-07, gate pass 4 of 5 in the same run as QA-014 and QA-015.
- **Module/agent:** `app/src/styles/layers/panels.css:170` `.side-tab-count`, seen on the deal record
- **Severity:** **Medium.** A real conformance failure in the product, not in the harness, and it is the only one of the three failures in that run that was.
- **Verbatim:** `deal record: color-contrast (serious, 1 node(s)) e.g. .active.side-tab[role="tab"] > .side-tab-count`
- **Cause, computed rather than eyeballed:** the badge is `color: var(--text-secondary)` on `background: var(--border)`, which is `#5f5f5f` on `#d5d5d5` = **4.35:1**. AA needs 4.5:1. It is 0.15 short, which is exactly the kind of miss that survives a visual review.
- **Why four earlier sweeps missed it.** The badge only renders on the **active** side tab and only when that tab's count is non-zero, so whether axe sees it depends on which tab is active and what data the run happens to load. It is a data-dependent element, and a route sweep that visits a page once at a fixed viewport can pass ten times and fail the eleventh.
- **Fix:** `color: var(--text)`, which is `#222222` on the same `#d5d5d5` background = **10.84:1**. The badge stays a quiet grey pill; only the numeral gets darker.
- **Guard, so it cannot come back:** a new pair in `scripts/check-contrast.mjs`, `['side tab count', '--fo-text', '--fo-border', 4.5]`. The script now reports **35 pairs**, up from 34. A static pair catches this where a route sweep could not, because it does not depend on data.
- **The lesson:** a token pair that only ever meets on a conditionally-rendered element is invisible to a browser sweep. When axe finds one, the fix is the colour **and** a static pair, or the next data shape hides it again.
- **Status:** closed.
- **Closed date:** 2026-09-07
