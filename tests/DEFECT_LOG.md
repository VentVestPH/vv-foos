# QA Defect Log — VV-FOOS

Format per Agent 8 brief: id (QA-###), date found, module/agent, matrix criterion or flow reference, severity, steps to reproduce, expected vs actual, evidence link, status, fix owner, closed date.

Severity scale: **Critical** — data loss/corruption, RLS breach, auth bypass, careers page down (stops all testing on that module until fixed). **High** — core workflow broken with no workaround, or wrong data a user would act on. **Medium** — broken with a workaround, wrong counts/sorting, a Gate 3 step that no longer reproduces. **Low** — cosmetic/copy/spacing/token violations.

No real PII in any row below — all evidence is schema/config state or synthetic (`is_test`) data.

## Tally, 2026-09-07

**23 entries covering 22 distinct ids, 20 closed and 3 open**, one of those three narrowed to a part nobody here can finish. The entry count exceeds the id count because QA-011 was reopened and carries two entries. What is still open, and why:

| Id | What | Why it is open |
| :---- | :---- | :---- |
| QA-003 | The four test-persona Auth passwords are QA-known values | Operational, and Klent parked it. `scripts/rotate-persona-passwords.mjs` is the tool; it belongs to the cutover, not to this work. Plan item B2 |
| QA-006 | Synced Gmail subjects show mojibake, an em-dash arriving as `Ã¢Â€Â”` | **Narrowed 2026-09-07.** The decoding gap is fixed: `google-sync` now runs the Subject header through a tested RFC 2047 decoder. The reported double-mojibake is a different mechanism, needs one raw header from a live account to identify, and repairing it would take a heuristic that could mangle a legitimately accented subject |
| QA-008 | Three of the four committed success metrics have no instrumentation | Klent parked the PM metrics. Plan item E1 |

**Closed 2026-09-07 after being verified rather than assumed:** QA-002, QA-004, QA-007, QA-014, QA-017, QA-018, QA-019, QA-020, QA-021 and QA-022, which is ten in a day. The last three were found by the gate rather than by reading, and QA-020, the kanban board being a scrollable region no keyboard can reach, is a product defect that git shows has been shipping since **54ce896**. The first three had already been fixed and this log had simply not been updated, which is its own kind of wrong: a log that says "open" about something that works sends the next reader to fix it twice. Each closure below carries the query or the file that proves it.

**Correction to an earlier claim of mine.** The Goal 5 execution log said "QA-014 is the only one still open". That was true only of the defects Goal 5 raised; six older ones were open at the time, of which three have now been verified closed and three remain for the reasons above.

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
- **Closed 2026-09-07, verified against the schema rather than assumed.** `select relrowsecurity from pg_class where relname='careers_rate_limit'` now returns **true**, enabled by migration `20260901000002_careers_rate_limit_rls.sql`. `pg_policies` shows **no policy on the table**, which is the correct end state and not an omission: RLS with no policy denies every non-superuser, and the only intended writer is `careers-apply` under the service role, which bypasses RLS. `validate.sql` check 2, "RLS enabled on every public table", passes, so this cannot silently regress.
- **The severity argument was also overstated and is corrected in the plan as D27.** `anon` never held a SELECT grant on this table, so the exposure was defence in depth rather than an open door. Plan section 6.1 records it as closed and moot.
- **Status:** closed.
- **Closed date:** 2026-09-07
- **Original fix owner note, kept for the record:** Agent 4 owner — `alter table careers_rate_limit enable row level security;` plus a service-role-only policy (the `careers-apply` Edge Function is the only intended writer, via service role, which bypasses RLS regardless — so a permissive-looking `using (false)` policy is correct here, not a gap).
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
- **Half-closed 2026-09-07, and the half that is closed is the unambiguous one.** `google-sync/index.ts:119` wrote `subject: headers.Subject ?? null`, the raw header value, with nothing decoding RFC 2047 encoded-words. It now writes `decodeMimeHeader(headers.Subject)`, from a new pure module `supabase/functions/_shared/mime-header.ts`, tested by 16 cases in `tests/unit/mime-header.test.ts`: base64 and quoted-printable, `_` as space, a declared `ISO-8859-1` charset, an RFC 2231 language tag such as `=?UTF-8*en?B?...?=`, the whitespace between two adjacent encoded words being dropped while whitespace next to ordinary text is kept, and five malformed inputs that must leave the header untouched rather than mangle it.
- **The change cannot make anything worse, which is why it ships without a live sample.** The function returns its input unchanged when the value contains no `=?`, and again when nothing decoded, so if Gmail has already decoded the header the call is a no-op. Two tests assert exactly that.
- **What is still open, stated rather than glossed.** The reported symptom was an em-dash arriving as `Ã¢Â€Â”`, which is UTF-8 bytes read as Latin-1 **twice**. An undecoded encoded-word would have been stored literally as `=?UTF-8?B?4oCU?=` instead, so **the decoder alone does not explain the report**, and a subject that is already mojibake when Gmail hands it over cannot be repaired without a heuristic. The obvious heuristic, reinterpreting the characters as Latin-1 bytes and decoding them as UTF-8 while that stays valid, would also mangle a subject that legitimately contains `Ã©`, so it is a judgement about candidate-facing stored text rather than a bug fix, and it is not made here.
- **What Google's own reference does not settle.** `users.messages.get` with `format=metadata` documents `payload.headers[].value` only as "The value of the header after the `:` separator", and does not say whether encoded-words are decoded. So which of the two mechanisms produced `Ã¢Â€Â”` needs one raw header from a live account, and that is the one step this work will not take on its own.
- **Status:** open, narrowed. The decoding gap is fixed and tested; the mojibake case needs a live sample and then a decision.
- **Fix owner:** Agent 6 owner for the remaining half. The decoding gap is done.
- **Closed date:** —

### QA-007 — `reminder.due` has no UI consumer anywhere in the app

- **Date found:** 2026-07-25, while mapping the event pipeline (brief instruction 6)
- **Module/agent:** Cross-cutting — reminders are created via the ATS/CRM engagement toolkit (Agent 2/3) but `reminder.due` itself (fired by Agent 1's `fn_fire_due_reminders()` via pg_cron) has no listener
- **Severity:** Medium — a real, working feature (create a reminder, it fires on schedule, event reaches the outbox — all confirmed live) has no way to surface to the user who set it. Not High/Critical since nothing is broken or unsafe, just unbuilt.
- **Steps to reproduce:** `grep -ri "reminder" foos/app/src` finds reminder *creation* UI (engagement panels) but no Realtime subscription on `reminder.due`, no notification bell, toast, or list component referencing it anywhere in the frontend.
- **Expected:** Some UI surface (bell icon, banner, list) shows the user their fired reminders, per the architecture doc's event taxonomy implying every event has a UI effect.
- **Actual:** None found.
- **Evidence:** Codebase grep, 2026-07-25. No PII.
- **Closed 2026-09-07, and the product gap this described is gone.** `app/src/pages/MyReminders.tsx` reads `reminders` filtered to `.in('status', ['fired', 'pending'])`, subscribes to Realtime on the `reminders` table at line 77, marks fired rows `is-due`, counts them, and announces "N reminders due." It is mounted on the home dashboard at `DashboardPage.tsx:93`, so the person who set the reminder sees it without navigating anywhere. Dismissal writes `status = 'dismissed'` at line 99.
- **One precise caveat, because the original complaint was literal.** This consumes the **table change**, not the `events_outbox` row, so "no Realtime subscription on `reminder.due`" is still true as written. That is the right design rather than a shortcut: the outbox is a service-role consumer surface, and what the user needs to see is the `reminders.status` flip that the same trigger performs. Plan section 6.4 records the decision as "Closed: interface", fixed as D31.
- **Status:** closed.
- **Closed date:** 2026-09-07

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
- **Closed 2026-09-07, already fixed and the log was stale.** `validate.sql` check 9 no longer asserts a count. It asserts the specific admin row, `if not exists (select 1 from staff where email = 'john@ventvest.com' and role = 'admin' and is_active)`, and then that the four seeded demo staff are all present and active, with a comment in the file saying the exact count is **deliberately** not asserted because `scripts/add-local-staff.sql` exists so a developer or UAT account can be added. Locally `staff` holds **12** rows and check 9 passes, which is the proof the assertion is no longer count-based.
- **Status:** closed.
- **Closed date:** 2026-09-07

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
- **Closed 2026-09-07 on the criterion this entry set, and the criterion is stated rather than quietly met.** "Ten consecutive gate passes" have now happened and then some: **fifteen consecutive clean full-suite browser passes** since the diagnostics landed, in three separate five-pass gate runs, with the counts each run printed rather than summarised. Run F, `gate-batch5.log`: `browser 175 passed` five times. Run G, `gate-batch6.log`: `browser 176 passed` five times. Run G6, `gate-g6.log`: `browser 176 passed` five times. `error-reporting.spec.ts` carries three tests and runs in every one of those passes, so the test that failed has now passed fifteen times in a row.
- **What is honest about this closure.** The cause was **never proven**. The wrong-route candidate stayed a candidate, and the diagnostics that would have distinguished it, the URL assertion and the console capture, never fired again. So this closes on absence of recurrence against a pre-declared threshold, not on a diagnosis. If it returns, the two diagnostics will say which of the two candidates it is, which is more than was available the first time.
- **What was actually changed, and it was not a retry.** A `toHaveURL` assertion before the dispatch, a console capture in the poll's failure message, and run-unique `?probe=` routes in the collision spec. All three are still in place and all three are cheap. The first two make the next occurrence diagnostic; the third removes the mechanism outright.
- **Status:** closed.
- **Closed date:** 2026-09-07

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

---

### QA-017: `check-cutover.mjs` guessed its target and guessed the live project, and followed redirects so it misreported a working function as missing

- **Date found:** 2026-09-07, first real run of the script, at the start of Goal 6.
- **Module/agent:** `scripts/check-cutover.mjs`, written by me earlier the same day
- **Severity:** **High as a process defect**, low as an impact. It sent read-only traffic to production while a standing instruction said all work stays on the local stack. No writes happened and the `anon` role could not have made one, but the target selection was wrong by design rather than by accident.
- **Verbatim, the evidence that identified it:** the response headers carried `sb-project-ref: mebfbbvrqdctamnzvbbs`, alongside `sb-error-code: NOT_FOUND` and `{"code":"NOT_FOUND","message":"Requested function was not found"}`.
- **What it did to production:** one `select * from dash.vw_ats_funnel limit 1` through PostgREST as `anon`, which was refused with `permission denied for schema dash`, and one `OPTIONS` per function, eleven in total.
- **Cause 1, the target.** The script read `SUPABASE_URL ?? VITE_SUPABASE_URL ?? FOOS_SUPABASE_URL`. There is no root `.env` in this checkout, so the second name won, and `app/.env` holds `VITE_SUPABASE_URL=https://mebfbbvrqdctamnzvbbs.supabase.co`. The fallback chain was ordered by convenience and put the live project ahead of the local one.
- **Cause 2, the redirects.** `fetch` follows a 302 by default. `google-oauth-callback` answers `OPTIONS` with a 302, the redirect was followed to something that 404s, and the check reported the function absent. Locally `curl -X OPTIONS` returns 302 for the same function, which is how the two readings were told apart.
- **Fix 1:** the target must be named. `CUTOVER_SUPABASE_URL` and `CUTOVER_SUPABASE_ANON_KEY`, or `--url=` and `--anon=`. The three older naming conventions are not read at all, and the live ref `mebfbbvrqdctamnzvbbs` is refused unless `--allow-live` is passed. This is the same shape as `migration/import.mjs` and `scripts/purge-zoho-import.mjs`, which refuse a non-local target unless told.
- **Fix 2:** every fetch passes `redirect: 'manual'`, and a 404 is read further rather than taken at face value, because a deployed function is allowed to answer 404 itself. Absent only if the gateway says so: `sb-error-code: NOT_FOUND`, a `"code": "NOT_FOUND"` body, or the local runtime's plain `Function not found`.
- **Proof, both directions:** `no-such-function` reads `gateway says absent`; `careers-status` reads `deployed, OPTIONS -> 204`. The refusals were proved too: no target exits 2 with the usage text, and the live ref exits 2 with the refusal.
- **A real finding the wrong-project run produced, which is not a defect:** `careers-status` is genuinely not deployed to the live project, while `careers-page` and `google-oauth-callback` are. That matches the ledger, where everything from 2026-09-01 onwards exists locally and in git only.
- **The lesson:** a fallback chain of environment variable names is a silent target selector. For anything that talks to a project, the target is an argument, not a default, and the dangerous value is refused rather than reached by falling through.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-018: the Cloudflare `_redirects` port would have served HTML in place of every JavaScript bundle

- **Date found:** 2026-09-07, checking the port against Cloudflare's documentation before committing it, at the start of Goal 6.
- **Module/agent:** `docs/07-environments/cloudflare/_redirects`, written by me the same day, plus the runbook paragraph that justified it
- **Severity:** **High if it had shipped, zero as it stands.** The file has never been deployed; Cloudflare is not the host yet and X12 is undecided. Caught by reading the vendor's documentation rather than by a test, because nothing in this repository can test another host's routing.
- **What it said:** the file held one rule, `/* /index.html 200`, and the runbook claimed "Cloudflare Pages serves an existing static file before consulting `_redirects`, so the whole rewrite is one line ... That is a simplification rather than a compromise: the same requests resolve the same way."
- **Verbatim refutation, from `developers.cloudflare.com/pages/configuration/redirects/` read 2026-09-07:** `Redirects are always followed, regardless of whether or not an asset matches the incoming request.`
- **Cause, and it is a platform difference rather than a syntax gap.** Vercel checks the filesystem before applying a rewrite. Its Build Output API documents the routing phases, with `handle: 'filesystem'` annotated `check matches after the filesystem misses` and `handle: 'rewrite'` later still, so a `vercel.json` rewrite never sees a request an existing file answers. Cloudflare has no such step in front of `_redirects`. That makes `vercel.json`'s `/((?!assets/).*)` lookahead belt and braces on Vercel and load-bearing nowhere on Cloudflare, where `/*` matches `/assets/index-<hash>.js` too. Every bundle request would have been proxied to `index.html` and the browser would have received HTML with a JavaScript content type. `_redirects` also has no negative lookahead to port the exclusion with: splats and placeholders only.
- **Why the wrong claim was plausible:** "a static host serves the file if it exists" is true of Vercel and is the behaviour the committed `vercel.json` relies on. It was carried across to a platform that documents the opposite, from recall rather than from a read.
- **Fix, and there is no rule to write:** Pages does the SPA fallback itself. `If your project does not include a top-level 404.html file, Pages assumes that you are deploying a single-page application ... Pages' default single-page application behavior matches all incoming paths to the root (/)`, from `developers.cloudflare.com/pages/configuration/serving-pages/`. The precondition holds: `find app/dist-redesign-2 -maxdepth 1 -name '*.html'` returns only `index.html`, and there is no `404.html` in the output. `_redirects` now contains only comments, which Cloudflare supports, and they record why the catch-all must not come back.
- **Two related differences found in the same read, both now handled in `_headers`:** Pages adds `Access-Control-Allow-Origin: *` to every static asset response by default where Vercel adds none, so the port now detaches it with `! Access-Control-Allow-Origin`; and a deep link answered by the SPA fallback keeps its own URL, so the `/index.html` `Cache-Control` rule does not match it and Cloudflare's `public, max-age=0, must-revalidate` default applies instead, which is equivalent.
- **Measured against the documented limits:** `_headers` uses 4 rules of 100, longest line 500 characters of 2,000; `_redirects` uses 0 of 2,100.
- **The lesson:** for a platform this repository cannot execute, no gate exists, so the vendor's own sentence is the only test available. "Serves the asset first" is a reasonable guess about a static host and it was wrong; the sentence that settles it took one fetch.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-019: `shared-views` read a combobox that had not been populated, and one failure there cascades into three because the fixture tag is per-worker

- **Date found:** 2026-09-07, gate pass 2 of 5 while verifying W24. Pass 1 of the same run passed all 178 browser tests on the same tree.
- **Module/agent:** `tests/e2e/shared-views.spec.ts:64` "another staff member sees the shared view and not the private one", plus the file's module-level `tag`
- **Severity:** **Medium**, and it is two defects in one report because the second one hides the first.
- **Verbatim, the real failure:** `Error: expect(received).toContain(expected) // indexOf  Expected substring: "qa-shared-view-5385-8gr8tq shared (shared)"  Received string: "Saved views…"`
- **Verbatim, the two collateral failures:** `Expected substring: "qa-shared-view-7958-9se3rl shared (shared)"  Received string: "Saved views…"  Call Log: - Timeout 25000ms exceeded while waiting on the predicate` and `Error: the row must survive a delete a non-owner is not allowed to make  Expected length: 1  Received length: 0  Received array: []`
- **Defect one, the cause of the real failure.** `useSavedViews` in `app/src/modules/recruit/savedViews.tsx:38` returns early on `if (!staff) return`, so the combobox is empty until the session's staff row has resolved **and** the query has come back. Test 2 read `optionNames` **once**, immediately after `gotoAsSignedIn`, which only asserts the URL is not `/login`. Its two neighbours, tests 1 and 3, both poll for up to 20 and 25 seconds. So test 2 was the only unsynchronised read of an asynchronously populated control in the file, and `"Saved views…"` is the placeholder with no options behind it.
- **Was this W24's fault? No, and the evidence is in the same run.** Pass 1 passed all 178 tests on the identical tree; the failure appeared in pass 2. The race predates W24: nothing in the old test waited. What W24 changed is the timing, because `RequireAuth` now blocks on the staff fetch, so the page mounts a little later relative to navigation and an unsynchronised read is likelier to lose. **The test was always wrong and the change made it show.** Recording it the other way round would have been convenient and false.
- **Defect two, why one failure became three.** `const tag = \`qa-shared-view-${process.pid}-...\`` is computed at module load. Playwright **recycles a worker after a test fails**, so the next test runs in a new process with a **new pid and therefore a new tag**, and looks for a row that nothing created. The JSON report shows it exactly: `passed worker=1`, `failed worker=1`, `failed worker=2`, `failed worker=3`. Tests 3 and 4 were collateral, and their error text pointed at a name that never existed, which is a very good way to spend an hour on the wrong thing. `process.pid` gives **worker** uniqueness, not run uniqueness, which is a narrower guarantee than the CLAUDE.md rule intends.
- **Fix one:** test 2 now polls for the shared view exactly as test 3 does, and captures the polled snapshot so the negative assertion, that the sourcer does not see the private view, is made against the **same** reading rather than a second one.
- **Fix two:** the fixtures no longer come from test 1. A file-level `test.beforeAll` inserts both rows with the admin client, `SHARED` shared and `PRIVATE` not, owned by the recruiter `a0000000-0000-4000-8000-000000000002`. `beforeAll` runs **once per worker**, so a recycled worker seeds its own tag before its first test and tests 2, 3 and 4 no longer depend on test 1 having run at all. Test 1 keeps its UI flow under its own name, `${tag} ui shared`, so it cannot collide with the seeded row.
- **One thing that already worked and is worth not breaking:** no rows leaked. `select count(*) from ats_saved_views where name like 'qa-shared-view-%'` returned **0** after the failing pass, because the file-level `afterAll` deletes `like('<tag>%')` and runs on every recycled worker too.
- **The second unanchored read was fixed pre-emptively, and my first description of it was too strong.** I wrote that `list-persistence.spec.ts:131`, a negative assertion on a single unsynchronised read, "always passes" and so "could never fail". **Measured, that is wrong.** A probe that seeds a view the sourcer *can* see and then performs the old immediate read found it **6 times out of 6** on an idle machine: `PROBE immediateRead="Saved views…|QA Vacuous Probe … recruiter (shared)"`, `immediateContainsBait=true`. The reason is that `optionNames` is not instantaneous: it waits for the combobox to be visible, clicks it, and waits for the listbox, and by then the query has usually returned. So the read normally wins. It is a **latent** hazard of the same class rather than a demonstrated vacuous pass, and it is fixed because it goes vacuous exactly when the machine is loaded, which is when `shared-views` lost. Recording it as proven would have been the more flattering version.
- **The whole suite was swept for the same class, not just the file that failed.** Every read of an asynchronously populated control was checked: `optionNames` has six call sites and `allInnerTexts` three. Four of the nine were already anchored, by a poll or by a preceding `toBeVisible`. **Two were not**, and both are fixed here: `shared-views.spec.ts:63` and `list-persistence.spec.ts:131`. `server-side-list.spec.ts:114` sits after a poll on the row count, `:161` after `expect(rows.first()).toBeVisible()`, and `list-persistence.spec.ts:169` is inside a poll, so those three needed nothing.
- **The lesson, and it is not "add a wait".** Two tests in the same file polled and one did not, which is a review failure rather than a timing one: an asynchronously populated control has exactly one correct read, and it is a polled one. The second lesson is sharper: **a fixture identifier derived from `process.pid` is void the moment Playwright recycles a worker**, and every test that depends on a previous test's fixture will then fail with an error message naming something that never existed.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-020: the kanban board is a scrollable region a keyboard cannot reach

- **Date found:** 2026-09-07, gate pass 4 of 5 on the tree carrying W24, QA-019 and QA-006. Passes 1, 2 and 3 of the same run did not report it.
- **Module/agent:** `app/src/components/ui/KanbanBoard.tsx:209`, the `.kanban` container, seen on `/sales/deals`
- **Severity:** **Medium**, and it is a real product defect rather than a harness one. WCAG 2.1.1: content that scrolls must be operable from a keyboard.
- **Verbatim:** `deals: scrollable-region-focusable (serious, 1 node(s)) e.g. .kanban`
- **Cause:** `panels.css:1` gives `.kanban` `display: flex` with `overflow-x: auto`, so the board scrolls horizontally, and the container carried no `tabIndex`. axe's `scrollable-region-focusable` rule is satisfied when the scrollable element is focusable **or** contains focusable content, which is why this is intermittent rather than constant: with only **2** deals in the database most stage columns render empty, so on a run where no card lands in the visible columns the board has no focusable descendant and the rule fires. More data hides it; less data exposes it.
- **Pre-existing, confirmed from git rather than asserted.** `git log -S "overflow-x: auto" -- app/src/styles/layers/panels.css` points at **54ce896**, the N3 cascade audit, and `KanbanBoard.tsx` was last touched at **18b0733**, W4. Nothing in the tree that surfaced it, W24, QA-019 or QA-006, goes near the board: they touch `auth/`, two specs and an Edge Function. So the defect has been shipping for as long as the board has scrolled, and the gate run that found it deserves the credit rather than the blame.
- **Why three earlier gate runs missed it.** Same shape as QA-016. The rule's outcome depends on the rendered data, and a route sweep that visits `/sales/deals` once sees whatever the fixtures left behind.
- **Fix:** the container becomes `role="group"` with `aria-label="Stage board, scrollable"` and `tabIndex={0}`, so a keyboard user can focus the board and scroll it with the arrow keys, and a screen reader announces what they have landed on. The cards' own keyboard contract is untouched: `kanban-keyboard.spec.ts` still drives space-to-grab, arrow-to-move and escape-to-cancel through the cards themselves, and this adds one tab stop in front of them rather than changing them.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-021: `waitForAnimations` gives up at its own cap, so the 204-node contrast artefact came back

- **Date found:** 2026-09-07, gate pass 4 of 5, in the same failure as QA-020.
- **Module/agent:** `tests/e2e/helpers.ts` `waitForAnimations`, and `tests/e2e/accessibility.spec.ts:63`
- **Severity:** **Medium.** A false failure, and the second time this exact signature has been reported, which is what makes it worth a new entry rather than reopening item 25 of the Goal 5 log.
- **Verbatim:** `requisitions: color-contrast (serious, 204 node(s)) e.g. tr:nth-child(1) > td:nth-child(2)`
- **What was already tried and was not enough.** Item 25 of the Goal 5 log diagnosed this as axe sampling the `table-results-in` fade, which `motion.css:276` runs on `.table tbody.results-in-a` from `opacity: 0.55` to `1`. The first fix polled until nothing was running, which failed again; the second required **three consecutive still readings 80ms apart**, and four gate runs then passed. It has now failed a fifth run.
- **Cause, and it is in the helper's own control flow:** `waitForAnimations` returns on `quiet >= 3 || Date.now() > deadline`, with `capMs = 3000`. **The cap is a return, not a failure.** Under load the loop can exhaust 3000ms with the fade still running and return anyway, and the caller has no way to tell the two exits apart. Waiting harder is also the wrong tool: the helper can only observe animations that have **started**, and the requisitions list applies `.results-in-a` after its rows arrive, so a slow query can begin a fade after the helper has already returned quiet.
- **Fix, which removes the race rather than widening the window:** `accessibility.spec.ts` now declares `test.use({ reducedMotion: 'reduce' })`. `motion.css:281` already carries the `prefers-reduced-motion: reduce` block that `check-motion.mjs` requires, and it sets `animation-duration: 0.01ms !important` on every element, so the fade is over before axe can sample it and the resting `opacity: 1` is what gets measured. **This is what axe should have been measuring all along:** WCAG 1.4.3 is about text as it rests, not about the middle of a decorative transition.
- **What this does not do:** it does not stop the motion being tested. `interaction-motion.spec.ts` still asserts the fade exists, its duration and its easing, and `check-motion.mjs` still fails the build on a duration over 220ms. The motion is tested where motion is the subject, and not where contrast is.
- **The lesson:** a helper whose timeout path is indistinguishable from its success path will eventually be read as success. If a wait can give up, it should say so; better still, remove the thing being waited for.
- **Status:** closed.
- **Closed date:** 2026-09-07

---

### QA-022: two more unsynchronised reads, and this is the fourth instance of one pattern in a day

- **Date found:** 2026-09-07, gate pass 1 of 5 over the W25 tree. **Pass 2 passed all 179 browser tests on the same tree**, which is what establishes both as races rather than as breakage W25 introduced.
- **Module/agent:** `tests/e2e/select-combobox.spec.ts:210` and `tests/e2e/phone.spec.ts:25`
- **Severity:** **Medium.** Two false failures, and the pattern behind them matters more than either.
- **Verbatim, the select one:** `Expected: > 20  Received: 1`
- **Cause:** the test opens the `Company` combobox on `/recruit/requisitions` and immediately measures it. There are **195** companies, so the list should hold about 196 options; a reading of **1** is the placeholder alone, before the lookup query returned. It waits for `.table-wrap` to be visible, which is a different query. **Fix:** poll `optionNames(page, box).length` past 20 before measuring, which is what `chooseOption` and `optionNames` already do everywhere else.
- **Verbatim, the phone one:** `Error: a phone must not scroll sideways` with `Array [ "intake: 43px, e.g. " ]`
- **Cause, in two parts.** The measurement came after a flat `page.waitForTimeout(1200)`, so a route whose column widths depend on data that lands late is measured mid-layout. **W25 did not widen anything**, which the diff shows: every change is a `min-height` or a `width` going **down**, from 40px to 32px, and `/intake` renders no kanban and no date field. **Fix:** `settleLayout()` waits for a content anchor and then for **three consecutive identical readings** of `scrollWidth x clientWidth` 150ms apart, so the assertion runs against a layout that has stopped moving rather than against a guess about how long that takes.
- **The second part is why an hour went into the wrong place.** The culprit list filtered with `el.closest('.table-wrap')`, and `closest` **matches the element itself**, so when `.table-wrap` was the overflowing element it excluded itself and the error read `43px, e.g. ` with no culprit named. The filter now excludes only descendants, `!el.matches('.table-wrap') && el.closest('.table-wrap')`, and each culprit reports its right edge. A diagnostic that hides the one element most likely to be at fault is worse than none.
- **The pattern, named once so it stops being rediscovered.** Four separate failures today were the same mistake: **a flat wait or a single read standing in for a condition.** QA-019, a combobox read once while its neighbours polled. QA-021, `waitForAnimations` returning at its 3000ms cap indistinguishably from success. QA-022's select read, taken before the lookup landed. QA-022's phone measurement, taken 1200ms after navigation because 1200 felt long enough. Every fix has the same shape: **assert the condition, or read until the reading stops changing.** None of them was fixed by waiting longer.
- **Status:** closed.
- **Closed date:** 2026-09-07
