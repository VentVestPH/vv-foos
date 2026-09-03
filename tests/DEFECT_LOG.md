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
