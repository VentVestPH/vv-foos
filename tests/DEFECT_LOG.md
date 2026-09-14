# QA Defect Log — VV-FOOS

Format per Agent 8 brief: id (QA-###), date found, module/agent, matrix criterion or flow reference, severity, steps to reproduce, expected vs actual, evidence link, status, fix owner, closed date.

Severity scale: **Critical** — data loss/corruption, RLS breach, auth bypass, careers page down (stops all testing on that module until fixed). **High** — core workflow broken with no workaround, or wrong data a user would act on. **Medium** — broken with a workaround, wrong counts/sorting, a Gate 3 step that no longer reproduces. **Low** — cosmetic/copy/spacing/token violations.

No real PII in any row below — all evidence is schema/config state or synthetic (`is_test`) data.

## Tally, 2026-09-14 (second pass)

**66 entries covering 66 distinct ids, 59 closed and 7 open**, plus QA-024 closed for dismissal with one half open. **QA-064 and QA-065 are added** from the test-account standardisation. QA-064 is the more serious of the two and had been latent since the seed file was written: the admin persona's login lived on John Buena's staff id, so admin test sessions were attributed to a real person and `personas.sql` run against the live project would have overwritten his Google identity. The open set is unchanged: QA-003, QA-006, QA-008, QA-026, QA-035, QA-042, QA-063.

## Tally, 2026-09-14

**64 entries covering 64 distinct ids, 57 closed and 7 open**, plus QA-024 which is closed for dismissal with one half still open. Counted with `grep -cE '^### (QA-[0-9]+|F[0-9]+)'` (64), `grep -oE '^### (QA-[0-9]+|F[0-9]+)' | sort -u | wc -l` (64) and a status scan that resolves each open line to its id. **QA-062 and QA-063 are added** from the accounts UI pass. The seven open are **QA-003**, **QA-006**, **QA-008** (all three parked with Klent), **QA-026**, **QA-035** (the pager's `1 / 3652`), **QA-042** (nothing writes to `people`) and **QA-063** (the `companies` delete cascade). **QA-063 is the first High-severity data-loss risk recorded here that is live in the schema rather than in code**: the UI now refuses the dangerous case, but the four cascading foreign keys are untouched.

## Tally, 2026-09-10

**30 entries covering 29 distinct ids, 25 closed and 5 open.** Counted with `grep -cE '^#{2,4} QA-0'` (30) and `grep -E '^- \*\*Status:\*\*' | grep -ci open` (5). **Corrected 2026-09-10:** the 2026-09-08 line below read "25 closed and 4 open" and names four open ids, but the status grep returns **5**. The count, not the list, is authoritative here; the fifth is not identified in this correction because doing so needs a read of every open entry, which is the next person's first job on this file. **QA-029 is added**, the only defect from the requisitions UI pass that reached a commit rather than being caught before one: breadcrumb links at 4.43:1 on four pages, found by CI and not reproducible locally.

## Tally, 2026-09-08

**29 entries covering 28 distinct ids, 25 closed and 4 open.** **Corrected 2026-09-08:** this line read "25 entries covering 24 distinct ids, 22 closed and 3 open" and had not been updated when QA-025 and QA-026 were added. Counted with `grep -cE '^#{2,4} QA-0'` (27) and `grep -E '^- \*\*Status:\*\*' | grep -i open` (4: QA-003, QA-006, QA-008, QA-026). **Updated 2026-09-08 for QA-027 and QA-028**, both raised during Goal 11 batch 10. The four open are the three parked with Klent plus QA-026. **QA-028 is closed**: `validate.sql` was writing `probability = 0.6` to the real seeded DEAL-0001 and never restoring it. QA-027 is closed: a layout helper returned identically whether it settled or gave up, which is the **fourth** instance of the pattern already written into `CLAUDE.md`. QA-023 and QA-024 were added on 2026-09-08 and both closed the same day; QA-024 is closed for dismissal with its focus-management half carried forward as a Goal 9 finding, and QA-025 is a defect in my own audit harness rather than in the product: it wrote to the database it was photographing. **QA-023 is the first Critical defect this log has recorded that was not a configuration gap:** two presses of any placeholder-backed control left an invisible full-screen backdrop that swallowed every click, and it had been shipping unnoticed because no test opened a second overlay in one page session.

## Tally, 2026-09-07

**63 entries covering 62 distinct ids, 57 closed and 6 open**, one of those narrowed to a part nobody here can finish. Recounted 2026-09-11 with `grep -cE '^### (QA-[0-9]+|F[0-9]+)'` and `grep -oE '^### (QA-[0-9]+|F[0-9]+)' | sort -u | wc -l`; every earlier figure in this line had gone stale. The entry count exceeds the id count because QA-011 was reopened and carries two entries. What is still open, and why:

**Corrected 2026-09-10.** An earlier note here said `grep -E '^- \*\*Status:\*\*' | grep -ci open` returns one more open defect than the table listed, and left identifying the extra as the next reader's job. There is no phantom, and there were two separate errors in that note. The extra match is **QA-024**, whose status reads "closed for dismissal, with the focus-management half open as a Goal 9 finding": the grep sees the word `open` inside a sentence that says closed. And the table itself was short one real entry, **QA-026**, whose status is `**open.**` and which had never been listed here. The reliable count is `awk '/^### (QA-|F[0-9])/{h=$0} /^- \*\*Status:\*\*/{ if (tolower($0) ~ /open/ && tolower($0) !~ /closed/) print h }'`, which prints the four below and nothing else.

What is still open, and why:

| Id | What | Why it is open |
| :---- | :---- | :---- |
| QA-003 | The four test-persona Auth passwords are QA-known values | Operational, and Klent parked it. `scripts/rotate-persona-passwords.mjs` is the tool; it belongs to the cutover, not to this work. Plan item B2 |
| QA-006 | Synced Gmail subjects show mojibake, an em-dash arriving as `Ã¢Â€Â”` | **Narrowed 2026-09-07.** The decoding gap is fixed: `google-sync` now runs the Subject header through a tested RFC 2047 decoder. The reported double-mojibake is a different mechanism, needs one raw header from a live account to identify, and repairing it would take a heuristic that could mangle a legitimately accented subject |
| QA-008 | Three of the four committed success metrics have no instrumentation | Klent parked the PM metrics. Plan item E1 |
| QA-026 | The candidate CSV export produced one completely empty file in four gate passes | Never reproduced since, and the cause is not established. Not closed on the strength of it not happening again |
| QA-035 | The pager's `1 / 3652` reads as a record count next to `1-20 of 73024` | Not a data defect; nothing is missing. Waiting on Klent to pick between labelling the page number and removing it |
| QA-042 | No field of `people` is editable anywhere in the product | Not a permissions gap: `people_update` grants the write and nothing calls it. Adding the surface changes what the candidate record does, so it is Klent's to schedule |

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
- **Module/agent:** `docs/environments/cloudflare/_redirects`, written by me the same day, plus the runbook paragraph that justified it
- **Severity:** **High if it had shipped, zero as it stands.** The file has never been deployed; Cloudflare is not the host yet and X12 is undecided. Caught by reading the vendor's documentation rather than by a test, because nothing in this repository can test another host's routing.
- **What it said:** the file held one rule, `/* /index.html 200`, and the runbook claimed "Cloudflare Pages serves an existing static file before consulting `_redirects`, so the whole rewrite is one line ... That is a simplification rather than a compromise: the same requests resolve the same way."
- **Verbatim refutation, from `developers.cloudflare.com/pages/configuration/redirects/` read 2026-09-07:** `Redirects are always followed, regardless of whether or not an asset matches the incoming request.`
- **Cause, and it is a platform difference rather than a syntax gap.** Vercel checks the filesystem before applying a rewrite. Its Build Output API documents the routing phases, with `handle: 'filesystem'` annotated `check matches after the filesystem misses` and `handle: 'rewrite'` later still, so a `vercel.json` rewrite never sees a request an existing file answers. Cloudflare has no such step in front of `_redirects`. That makes `vercel.json`'s `/((?!assets/).*)` lookahead belt and braces on Vercel and load-bearing nowhere on Cloudflare, where `/*` matches `/assets/index-<hash>.js` too. Every bundle request would have been proxied to `index.html` and the browser would have received HTML with a JavaScript content type. `_redirects` also has no negative lookahead to port the exclusion with: splats and placeholders only.
- **Why the wrong claim was plausible:** "a static host serves the file if it exists" is true of Vercel and is the behaviour the committed `vercel.json` relies on. It was carried across to a platform that documents the opposite, from recall rather than from a read.
- **Fix, and there is no rule to write:** Pages does the SPA fallback itself. `If your project does not include a top-level 404.html file, Pages assumes that you are deploying a single-page application ... Pages' default single-page application behavior matches all incoming paths to the root (/)`, from `developers.cloudflare.com/pages/configuration/serving-pages/`. The precondition holds: `find app/dist -maxdepth 1 -name '*.html'` returns only `index.html`, and there is no `404.html` in the output. `_redirects` now contains only comments, which Cloudflare supports, and they record why the catch-all must not come back.
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

---

### QA-023: the second overlay of a session could not be dismissed, and its invisible backdrop swallowed every click

- **Date found:** 2026-09-08, by the Goal 8 visual sweep.
- **Module/agent:** `app/src/hooks/useOverlayDismiss.ts`, reaching `app/src/shell/Placeholder.tsx` and `app/src/components/ui/Dialog.tsx`
- **Severity:** **Critical** — not data loss, but the application becomes wholly unusable with no visible cause and no route back except a browser reload, and it is reachable in four clicks by any role on the first page anyone sees.
- **Steps to reproduce:** sign in as any role, click the Announcements megaphone in the utility header, press Escape (it closes), click Announcements again, press Escape, press Escape again.
- **Expected:** the second modal behaves exactly like the first and Escape dismisses it.
- **Actual, verbatim from the probe:**

  ```
  PROBE round1 afterOpen {"modalPresent":true,"modalClosingAttr":null,"closingNodes":0}
  PROBE round1 afterEscape {"modalPresent":false,"modalClosingAttr":null,"closingNodes":0}
  PROBE round2 afterOpen {"modalPresent":true,"modalClosingAttr":"true","overlayClosingAttr":"true","closingNodes":2}
  PROBE round2 afterEscape {"modalPresent":true,"modalClosingAttr":"true","closingNodes":2}
  PROBE round2 afterSecondEscape {"modalPresent":true,"modalClosingAttr":"true","closingNodes":2}
  ```

  and Playwright then named the consequence while trying to click anything else:

  ```
  Error: locator.click: Test timeout of 120000ms exceeded.
    - <div data-closing="true" role="presentation" class="fo-placeholder-overlay">…</div> intercepts pointer events
  ```

- **Cause:** `requestClose` set `closingRef.current = true` and `setClosing(true)`, then scheduled `onClose` on a 140ms timer, and **nothing ever set either back to false.** `PlaceholderProvider` calls `useOverlayDismiss(state ? dismiss : undefined)` from the provider that wraps the entire app, so the hook outlives each modal. On the second `show()` the overlay therefore renders with `data-closing="true"` immediately, and `requestClose` returns at its own `closingRef.current` guard, which kills Escape, the backdrop click and the Close button together, since all three call it. `motion.css:229` animates `.fo-placeholder-overlay[data-closing='true']` to `opacity: 0` with `forwards`, so the blocker is invisible: the page looks normal and ignores the mouse.
- **Why no existing test caught it:** every e2e test that opens a placeholder modal opens exactly one per page. The sweep found it because it presses every control on a page in sequence without reloading, which is the only access pattern that reaches the second overlay.
- **Fix:** the exit timer now clears `timer`, `closingRef` and `closing` before calling `onClose`, because once the exit has run the overlay is by definition no longer closing; and a new effect resets all three whenever `onClose` becomes undefined, covering an overlay dismissed by any other route. Proved by re-running the same probe: three consecutive rounds read `modalClosingAttr:null` on open and `modalPresent:false` after one Escape, `closingNodes:0` throughout, and the probe finished in 7.8s instead of timing out at 120s.
- **Guard:** `tests/e2e/overlay-dismissal.spec.ts`, in the gated suite, test `QA-023: the second overlay of a session is dismissable and leaves no click-blocking backdrop`. It opens and Escape-dismisses the overlay three times in one page, asserting on each round that the modal carries no `data-closing` attribute when it opens, that it reaches count 0 after one Escape, and that **no node anywhere is left carrying `data-closing="true"`**. It then closes a fourth overlay with the Close button and clicks a nav tab, which is the assertion that actually fails if an invisible backdrop is still eating clicks.
- **Status:** closed.
- **Closed date:** 2026-09-08

---

### QA-024: the Administration and Help menus ignored Escape

- **Date found:** 2026-09-08, found free while proving QA-023.
- **Module/agent:** `app/src/hooks/useDismissable.ts`, reaching `app/src/shell/UtilityHeader.tsx:21-22` and `app/src/components/ui/ListPage.tsx:56`
- **Severity:** **Medium** — a workaround exists (click outside, or press the toggle again), but it is a documented keyboard requirement of the pattern the markup itself declares.
- **Steps to reproduce:** sign in as any role, click `Administration` in the utility header, press Escape.
- **Expected, from the published spec.** W3C ARIA Authoring Practices, Menu and Menubar Pattern, Keyboard Interaction: *"Escape: Close the menu that contains focus and return focus to the element or context, e.g., menu button or parent `menuitem`, from which the menu was opened."* The buttons declare `aria-haspopup="menu"` and the panel declares `role="menu"`, so the pattern applies by the app's own markup.
- **Actual, verbatim:** `PROBE admin-menu round1 afterEscape {"present":true,"closing":null}` — the menu is still on screen.
- **Cause:** `useDismissable` handled the exit animation and reset correctly but registered **no `keydown` listener**, and `UtilityHeader` adds only a `document` `mousedown` listener for outside clicks. The sibling hook `useOverlayDismiss` does register one; this hook did not, so the only dismissal routes were an outside mousedown and a second press of the toggle.
- **Fix, second attempt. The first attempt was a regression and the gate caught it.** The first version added a **`window`** `keydown` listener in `useDismissable`, active whenever `open` was true. That made Escape close *every* open overlay at once, and the gate failed two browser tests:

  ```
  date-field.spec.ts :: the calendar is a modal grid driven entirely by the keyboard [timedOut] Test timeout of 30000ms exceeded.
  select-combobox.spec.ts :: a long option list scrolls inside a bounded popup [timedOut] Test timeout of 30000ms exceeded.
  ```

  with the mechanism named in the call log:

  ```
  - waiting for getByRole('button', { name: /Change date, / })
    - element is not stable
    - element was detached from the DOM, retrying
  > 86 |   await trigger.click();
  ```

  `date-field.spec.ts:43` opens the filter rail and the date trigger lives **inside** it. Line 82 presses Escape to dismiss the calendar dialog; the window listener dismissed the rail as well, so the trigger animated out and detached under Playwright's feet. The suite was right and the fix was wrong: the APG wording is *"Close the menu that **contains focus**"*, one overlay, not all of them.

  The shipped fix takes an optional `escapeScope` ref and attaches the `keydown` listener to **that element** rather than to `window`, ignores an event whose `defaultPrevented` is already set, and calls `stopPropagation` so an outer scope does not also act. `UtilityHeader` passes its existing `adminRef` and `helpRef`, so Escape reaches a menu only when focus is on its trigger or inside its panel. `ListPage`'s filter rail passes no ref and therefore keeps its previous behaviour, which is what its own tests specify.
- **Proof:** `npx playwright test e2e/date-field.spec.ts e2e/select-combobox.spec.ts` returns **15 passed (8.2s)** where it previously returned `2 failed`, and the new guard asserts both menus close on Escape on the first *and* second open.
- **Deliberately not fixed here, and recorded as a Goal 9 finding instead:** the same APG pattern also requires Enter or Space on the menu button to open the menu **and move focus to the first menu item**, Down and Up Arrow to move between `menuitem`s, and Escape to **return focus** to the button. The menus satisfy none of those. That is focus management across two components, not a one-line handler, so it belongs to Goal 11 rather than to a drive-by fix.
- **Guard:** `tests/e2e/overlay-dismissal.spec.ts`, in the gated suite, test `QA-024: Escape closes each utility menu, on every open, not just the first`. It opens each of the two menus twice and asserts the panel count goes 1 then 0 each time, so both the dismissal and the reset path are covered.
- **Status:** closed for dismissal, with the focus-management half open as a Goal 9 finding.
- **Closed date:** 2026-09-08

---

### QA-025: the audit harness wrote to the database it was photographing, and I only noticed by checking row counts

- **Date found:** 2026-09-08, mid-run, by comparing `activities` against the count taken before the sweep started.
- **Module/agent:** `tests/audit/sweep-lib.ts` `DESTRUCTIVE`, and the button loop in `tests/audit/visual-sweep.spec.ts`
- **Severity:** **Medium** for the product (nothing shipped is wrong) and **High** for the evidence, because a capture set that shows a database the instrument itself altered is not evidence of anything.
- **Expected:** a visual audit presses controls to photograph what they open, and changes no data.
- **Actual:** the sweep pressed every in-content button whose name did not match `/delete|remove|purge|erase|merge|archive|deactivate|send|invite|sign out|logout|log out/i`. That regex catches destruction and misses **mutation**. The button inventory the run itself produced named the culprits: `1 star`, `2 stars`, `3 stars` and `Edit grade comment` per candidate row (**69 star controls on one list of 23**), the deal-kanban stage headers `Lead 0` through `Lost 0`, and `Complete`, `Dismiss`, `Shortlist`, `Flag`, `Applied`, `Save profile`, `Save view`, `Submit`, `Go!`.
- **Measured damage, exactly:**

  ```
  activities  214,311 before  ->  214,369 during   (58 new rows, all kind='status_change')
  people / applications / requisitions / deals      unchanged
  ```

  Of those 58, most belonged to another suite and to a second session signed in as `john@ventvest.com`. Attributable to my four sweep personas: **9 rows** covering **5 records**, and no more:

  | Record | What the sweep did | Times |
  | :---- | :---- | ----: |
  | 2 Zoho-imported candidates | `star_grade` set to 3, and status set to `Candidate to Review Info` by a **bulk** action (both rows share one transaction timestamp) | 3 each |
  | 3 seeded demo candidates | `star_grade` set to 3 | 1 each |
  | DEAL-0001 | stage `lead -> qualified` | 3 |

- **Repair, from sources rather than from memory.** Every original value was recoverable, so none of it was guessed:
  - The two imported candidates' `star_grade` and status came from the bulk Zoho export (`Rating` empty for both, so the correct grade is null; `Candidate_Status` was `Do Not Pursue` and `Sent InMail I (Linkedin)`).
  - The three demo candidates' grades came from `supabase/seed.sql` lines 61-63: **3, 2 and 1**, not the 3, 3, 3 the sweep left.
  - DEAL-0001 needed **no** repair: it read `lead` before the sweep and reads `lead` now, because another suite's teardown reverted each of the three moves. Its *seed* stage is `proposal`, and it was deliberately left at `lead` rather than "restored", because that change predates this session and is not mine to undo.
  - Verified after: `node scripts/backfill-zoho-candidate-fields.mjs` reports `corrected 0` over **72,910** source rows, and the five records read back their source values.
- **Second defect found while repairing this one.** `scripts/backfill-zoho-candidate-fields.mjs`, the tool whose whole job is repairing `star_grade`, was reading `migration/zoho-exports/Candidates_001.csv`, a **75-row sample**, against a database of **72,917** profiles. It reported `matched 75` and a clean bill of health while 72,842 candidates were outside its reach. It now defaults to the full bulk export (`migration/zoho-exports/bulk/ZohoRecruit_Candidates_p1/*.csv`, **72,910** rows), accepts `row['Id']` as well as `Candidate Id` and `Record Id`, takes `--source=<path>` to override, prints which file it read, and lists the files it looked for when none is found. A repair tool that silently covers a tenth of a percent of its target is worse than no repair tool.
- **Fix to the harness:** two new skip classes beside `DESTRUCTIVE`, both reported honestly rather than silently. `MUTATING` catches star and grade controls, `Complete`, `Dismiss`, `Shortlist`, `Flag`, `Applied`, `Save`, `Submit`, `Go!`, `Approve`, `Reject`, `Convert`, `Promote`, `Advance` (not `Advanced Search`), `Hire`, `Publish`, `Assign` and `Set …`; `STAGE_BUTTON` catches the twelve stage and deal-stage names. Their rows read `NOT PRESSED, writes to the database` and `NOT PRESSED, moves a record between stages`, so the report says what was left alone and why. Both regexes were checked against **87 real button names** taken from the aborted run, with the pass condition being that every mutator is caught **and** every one of 60-plus benign controls is not: `Advanced Search` was caught by `^advance` on the first attempt and the anchor became `^advance(?!d)`.
- **Proof:** re-running the candidates route with the skip in place, `psql -c "select count(*) from audit_log where at > now() - interval '4 minutes' and actor_id in (select id from staff where email like '%demo%')"` returns **0**, and the route reports `skipped=84` with `NOT PRESSED, writes to the database` as the only skip reason.
- **What I got wrong, plainly:** I launched a run that pressed every button against a database holding 72,988 real people and did not ask what those buttons write until row counts told me. The instruction was to try every button; the judgement about which buttons persist was mine and I did not make it.
- **Guard:** none automated. The sweep is not in the gate by design. The mechanical check that caught it is worth keeping as habit: take entity counts before a sweep and diff them after, and read `audit_log` filtered to the sweep personas.
- **Status:** closed.
- **Closed date:** 2026-09-08

---

### QA-026: the candidate CSV export produced a completely empty file once in four gate passes, and the cause is not established

- **Date found:** 2026-09-08, `bash scripts/gate.sh 4`, pass 1 of 4. Passes 2, 3 and 4 were clean, `browser 181 passed` each.
- **Module/agent:** `tests/e2e/list-persistence.spec.ts` :: `2.11 the CSV export matches the filtered set on screen`, against `app/src/modules/recruit/candidates/CandidateListPage.tsx` `exportFilteredRows`
- **Severity:** **Medium**, provisionally. If it is a product race rather than a test race, a user occasionally receives an **empty CSV** with no indication that the export failed, which is worse than an error.
- **Verbatim:** `Error: a header plus one record per visible row; got 0 records for 3 rows`
- **What that means precisely:** **0** records, not 3 and not 1. The file had no data rows *and no header*, so `toCsv` was handed an empty array. `exportFilteredRows` returns `[]` on exactly four paths, and every one of them calls `setError(...)` first: a failed count query, a match count above `EXPORT_ROW_CAP = 10000`, a failed page query, or a failed applications lookup.
- **Two hypotheses formed and both disproved by reading the code, so neither is the cause:**
  - *The count query and the row query apply different filters, so three rows are refused as too many.* **False.** `applyFilters` is `applyOrder(applyWhere(q))` and the count path is `applyWhere(candidateCountQuery())`, so both share `applyWhere` and differ only by ordering.
  - *`exportFilteredRows` captures a stale `search`, so the count runs unfiltered against 72,917 candidates and trips `EXPORT_ROW_CAP`.* **False.** `applyWhere` declares `[filters, search, firstName, lastName]` and the export depends on it, so no stale closure.
- **Not reproducible in isolation:** the test alone passed **6 of 6** consecutive runs. It needs the gate's two concurrent workers, which is consistent with a transient PostgREST error on one of the four queries, and that would be the third of the four `[]` paths.
- **What is owed, and it is not a retry.** The test already attaches `export.csv` and `on-screen.json` on failure; what it does not capture is **which** of the four paths returned `[]`. The next step is to add the error text the page displayed to the failure message, then run the gate until it recurs. Until then the cause is **unknown**, and this entry says so rather than calling three green passes an answer.
- **Status:** **open.**

### QA-027: a layout-settling helper returned the same way on success and on giving up, and reported a false 43px overflow on seven routes

- **Found:** 2026-09-08, during Goal 11 batch 10, by `bash scripts/gate.sh 2` pass 2
- **Module:** test harness, `tests/e2e/phone.spec.ts`
- **Criterion:** Q8, "no route scrolls the page sideways at 390px"
- **Severity:** **Medium** in the harness. It fails a gate that should be green and, worse, blames the product for a fault that is in the measurement
- **Symptom, verbatim from `.gate/browser-pass-2.json`:**

```
Error: a phone must not scroll sideways
- Expected  - 1
+ Received  + 9
+ Array [
+   "dashboard: 43px, e.g. ",
+   "candidates: 43px, e.g. ",
+   "candidate record: 43px, e.g. ",
+   "requisitions: 43px, e.g. ",
+   "deals: 43px, e.g. div.kanban-col@552, div.kanban-col-header@551, span.kanban-col-count@541",
+   "intake: 43px, e.g. ",
+   "search: 43px, e.g. ",
+ ]
```

- **Expected vs actual:** the check should report zero horizontal overflow. Measured directly afterwards at 390px on `/` and `/recruit/candidates`, `document.documentElement.scrollWidth - clientWidth` is **0** on both: the primary nav's tabs do extend to `right: 1275` but the nav is its own scroll container, so the document does not scroll. **Six of the seven routes named no culprit at all**, which was the tell: the spec excludes `nav.fo-primary-nav` descendants when naming culprits but not when measuring the amount, so an amount with no culprit can only be a transient one
- **Root cause:** `settleLayout` in that spec polls `scrollWidth x clientWidth` every 150ms and returns when three consecutive reads match, inside `while (Date.now() < deadline)`. When the 8000ms cap expired first it **fell out of the loop and returned normally**, indistinguishable from having settled, and the caller then measured a mid-layout width. Under the gate's two workers the cap is reachable; alone it never is, which is why the spec passed on every isolated run, including with two workers, and failed only inside a full gate pass
- **This is the fourth instance of one pattern in this project.** QA-019, QA-021 and QA-022 were the same shape, and `CLAUDE.md` already states the rule it breaks: *"A wait that can give up must not return the same way it returns on success."* The lesson had been written down and this helper still predated it
- **Fix:** `settleLayout` now takes the route label, raises the cap to 20000ms, and **throws** when it never settles, naming the last read. A load-induced failure now says "the layout never settled" instead of inventing an overflow
- **Verified:** 5 of 5 phone tests pass with one worker and with two, and the full gate is green after the change
- **Status:** closed.

### QA-028: `validate.sql` proved that bd can write a deal by writing to the real seeded deal and never putting it back

- **Found:** 2026-09-08, during Goal 11 batch 10, after migration `20260908000001_deal_probability_percent.sql` set the value to 60
- **Module:** unknown. The writer holds a persona JWT, so it is a test or a browser client, not the service role
- **Severity:** **Medium.** It corrupts a seeded record's data and it fails a gate check, but it is caught loudly rather than silently
- **Evidence, from `audit_log`:**

```
2026-09-08 03:51:31.483601+00 | a0000000-0000-4000-8000-000000000004 |
  {"probability": {"new": 0.6, "old": 60.0}, "updated_at": {...}}
2026-09-08 04:05:49.951011+00 | a0000000-0000-4000-8000-000000000004 |
  {"probability": {"new": 0.6, "old": 60.0}, ...}
```

`a0000000-0000-4000-8000-000000000004` is `Ben Demo (bd)`. In the second occurrence the write landed **560ms after the browser suite's last test ended** (`.gate/browser-pass-1.json` last result end `04:05:49.391Z`), so it is an in-flight request or a teardown, not a test body.

- **What I ruled out, each by direct measurement rather than reasoning:**
  - the full vitest suite alone: 269 passed, value stayed **60**
  - the full browser suite alone: 202 passed, value stayed **60**, twice
  - `crm-deals`, `kanban-keyboard`, `drag-and-drop` and `record-writes` individually: value stayed **60** after each
  - a trigger or function on `deals`: the four triggers are `updated_at`, `audit`, `stage` and `require_outcome_reason`, and **no** Postgres function's source mentions `probability`
  - the app: no `/ 100` anywhere in `app/src`, and the kanban move patches only `stage` and `lost_reason`
  - the importer: `migration/import.mjs` runs without `--apply`, uses the service role, and handles no probability field
  - `api/rls-boundary.test.ts:92` writes `probability: 0.42` as recruiter and asserts **0 rows updated**, so it changes nothing, and 0.42 is not 0.6
- **Instrumentation that failed to catch it:** a `BEFORE UPDATE` trigger on `deals` recording the actor, the old and new value, `application_name` and `pg_stat_activity.query` whenever probability changed. Armed across **two** `gate.sh 2` runs, which is four vitest suites and four browser suites: **zero rows captured, value stayed 60 throughout.** The probe itself then failed `validate.sql` twice, first with `RLS disabled on: _probe_prob` and then with `permission denied for table _probe_prob`, and has been dropped
- **Root cause, caught on the fourth attempt.** `supabase/tests/validate.sql:442`, inside check 11, proved that the bd role can update a deal by doing it for real:

```sql
update deals set probability = 0.6 where display_code = 'DEAL-0001';
if not found then raise exception 'FAIL 11: bd could not update a deal'; end if;
```

It impersonates bd with `set_config('request.jwt.claims', …)` and `set role authenticated`, which is why every `audit_log` row named Ben Demo, and it **never restored the value**. `0.6` was picked as an arbitrary marker when the seed itself held `0.5`, so for months the write was invisible: it set the column to something indistinguishable from the seed.

That explains every observation at once. It is not the browser suite and not vitest, which is why neither reproduced it alone. In the gate, `validate.sql` runs **immediately after** the browser step, which is why the write always landed a few hundred milliseconds after the last browser test ended. And the next pass's `api-tests` then read `0.6`.

- **Why the first three instrumented runs saw nothing.** The probe was a `BEFORE UPDATE` trigger that inserted into `_probe_prob`. I enabled RLS on that table to satisfy `validate.sql` check 2 but **added no policy**, so the trigger's own insert was refused, the offending `UPDATE` aborted with it, and the value stayed 60. The instrument was suppressing the very event it was meant to record. Once the table had a permissive policy and grants, the first gate run captured it immediately, with `appname` of `psql` and the full `do $$ … FAIL 11: bd sees % people …` block as the query
- **Fix:** the check now reads the current value into `prev`, writes `55`, asserts `found`, and writes `prev` back. Line 460's recruiter case changed from `0.9` to `90` as well; that one writes nothing, because RLS refuses it, but a fraction there was equally misleading
- **Verified:** `validate.sql` run twice back to back reports **34 check(s) pass** and `DEAL-0001` stays at **60** both times. With the probe still armed the capture showed exactly four transitions, `60 → 55 → 60` per run, which is the write and its restore
- **A second defect the probe itself caused, and the gate caught.** `grant all on _probe_prob to anon, authenticated` triggered `FAIL 23: 6 table grant(s) still give anon or authenticated TRUNCATE, TRIGGER or REFERENCES`, and an earlier form triggered `FAIL 2: RLS disabled on: _probe_prob` and then `permission denied for table _probe_prob`. The probe has been dropped and `validate.sql` is back to 34 of 34
- **Status:** closed
- **Lesson worth keeping:** a script named `validate` mutated the data it validated, and the only reason it went unnoticed is that its marker value looked like the seed. A permission check that must write should write to a record it creates and removes, which is the rule Klent stated for all of Goal 11: *"make sure when doing crud, create a seeded record and delete that. not actual records."* This is the same class as QA-025, where the audit harness wrote to the database it was photographing

### QA-029: breadcrumb links sit on the page band at 4.43:1, below WCAG AA

- **Found:** 2026-09-10, by CI run 34437359599 on `feat/requisitions-ui-pass`, after `3a402a9` added breadcrumbs to every page. **It did not reproduce locally**, where `e2e/accessibility.spec.ts` passed 5 tests in 34.2s immediately before and after
- **Module:** shared shell. `GlobalSearchPage`, `ModulePlaceholderPage`, and both `DashboardPage` tabs
- **Criterion:** L12, `e2e/accessibility.spec.ts:64` "no serious or critical violation on any signed-in screen route"
- **Severity:** **Medium.** Readable but below the contrast the rest of the app holds, on four pages, and it fails a gate
- **Steps to reproduce:** open `/search?q=a`, `/employees` or `/pipeline` as any persona and read the computed colour of the first breadcrumb link against its resolved background
- **Expected:** the 4.5:1 that WCAG AA requires of 14px normal-weight text, which the list and record pages meet at 5.04:1
- **Actual:** `--fo-link` `#1b6fc9` on `--fo-canvas` `#f0f0f0` is **4.43:1**

```
1) e2e/accessibility.spec.ts:64:3 › no serious or critical violation on any signed-in screen route
    Error: serious or critical accessibility violations:
    global search: color-contrast (serious, 1 node(s)) e.g. li:nth-child(1) > a[href="/"][data-discover="true"]
```

- **Evidence, measured in the browser on four routes:**

```
/recruit/requisitions :: {"fg":"rgb(27, 111, 201)","bg":"rgb(255, 255, 255)","ratio":5.04}
/search?q=a           :: {"fg":"rgb(27, 111, 201)","bg":"rgb(240, 240, 240)","ratio":4.43}
/employees            :: {"fg":"rgb(27, 111, 201)","bg":"rgb(240, 240, 240)","ratio":4.43}
/pipeline             :: {"fg":"rgb(27, 111, 201)","bg":"rgb(240, 240, 240)","ratio":4.43}
```

- **Cause:** `ListPage` and `RecordPage` render the trail inside `.fo-page-head`, which is `background: var(--fo-surface)`. Four pages took `<Breadcrumbs>` as a bare child of `.list-page` or `.record-page`, so the link had no opaque ancestor and sat on the page band. **Why CI caught it and a local run did not:** axe's `color-contrast` rule reports *incomplete* rather than *violation* when it cannot fully resolve a background, and that resolution depends on rendering. The ratio was 4.43 on both machines; only the classification differed, so the local pass was luck rather than evidence
- **Fix:** the four pages wrap their header in `.fo-page-head`, putting the trail on white at 5.04:1. `688890d`
- **Guard:** `e2e/breadcrumbs.spec.ts` B1 walks up from the trail's first link on all ten routes and fails if it does not land on `rgb(255, 255, 255)`, in seconds rather than a 22-minute CI run. `scripts/check-contrast.mjs` was deliberately not extended: it already declares `--fo-link` on `--fo-surface` and `--fo-link-on-tint` on `--fo-canvas`, so the system had already decided a link on the band uses the darker token, and it has no pair for `--fo-link` on `--fo-canvas` because that pair is not meant to exist
- **Status:** Closed
- **Fix owner:** Claude, verified by CI run 34440229385, success in 19m39s
- **Closed:** 2026-09-10

### QA-030: the sidebar Quick Search dropped its term on every list page

- **Found:** 2026-09-10, by Klent, on `/recruit/candidates`: *"searching using the candidate first and last name doesn't work. it just redirects me to the candidates page."*
- **Module:** shared shell plus all seven list pages
- **Criterion:** 2.9 list persistence, and the Quick Search panel's whole purpose
- **Severity:** **High.** A control that looks like it works, navigates, and silently discards what was typed. It affected the keyword box as well as the Candidate First/Last Name pair, on candidates, requisitions, companies, contacts, deals, tickets and the intake queue
- **Steps to reproduce:** on any list page type a name into the sidebar Quick Search and press its magnifying glass
- **Expected:** the list filters to that term
- **Actual:** the URL becomes `<list>?search=<term>`, the page re-renders unfiltered, and the search box is empty. To the user it reads as a redirect to the page they were already on
- **Cause:** two independent defects stacked.
  1. `ShellSidebar.runQuickSearch` navigates to `` `${scope.to}?search=${encodeURIComponent(term)}` ``, and **no list page has ever read `?search=`.** All seven initialised their search state with `useState('')`. `grep -rn "params.get('search')" app/src` returned nothing
  2. Even with the term delivered, a first-plus-last name matched nobody with a middle name. `candidate_list.search_text` is `lower(concat_ws(' ', first_name, middle_name, last_name, current_title, current_employer, emails))`, and the page applied one `ilike '%<whole term>%'`, so `%adam tan%` could never match `adam john tan`
- **Fix:** `app/src/lib/quickSearch.ts`. `useQuickSearchTerm()` seeds the search state from `?search=` and re-seeds when the parameter changes; all seven list pages now use it, and the requisition list seeds its debounced `searchTerm` too so a quick search does not wait out the 2000ms timer. `searchWords()` splits the term and the candidate query applies one `ilike` per word, which PostgREST ANDs
- **Guard:** `tests/e2e/quick-search.spec.ts` Q1 asserts every one of the seven routes seeds its box from the parameter, Q2 drives the sidebar's own First/Last Name fields end to end against a fixture with a middle name, and Q3 asserts the words are ANDed in any order and that a non-matching word empties the list
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-031: two flag columns on the candidate list, and the one with data was the one to remove

- **Found:** 2026-09-10, by Klent: *"i can see two flags in the table. remove the row with Flags that is not an icon. does it have other values? is it different with the flag icon row?"*
- **Module:** `modules/recruit/candidates`
- **Severity:** **Low.** Cosmetic duplication, but the obvious fix loses data
- **Actual:** the table carried a 32px `flagcol` at the far left whose header was a flag icon and whose `render` returned `null` **for every row**, and a `flags` column at the far right rendering a `Badge` with the text "Do not contact"
- **Answers to the two questions asked:** the text column has exactly **one** possible value. `buildCandidateRows` pushes `'Do not contact'` when `candidate_profiles.do_not_contact` is set and nothing else ever, so the badge's `tone={… ? 'danger' : 'warning'}` had a dead `warning` branch. The icon column had **no** values at all; it was screenshot decoration
- **Fix:** merged rather than deleted. There is now one column keyed `flags`, first in the default order, with the flag icon as its header and a red flag in the cell when `do_not_contact` is set, carrying the flag text as its `title` and `aria-label`. `flagcol` is gone. The column stays in `COLUMN_DEFS`, so it is still toggleable in column settings and still exports as text to CSV
- **Guard:** `quick-search.spec.ts` Q6 counts flag-named headers, asserts exactly one, then sets `do_not_contact` on its own fixture and asserts the surviving column shows it
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### F23: fn_fire_due_reminders held PUBLIC EXECUTE while being security definer

- **Found:** 2026-09-08 during the privilege sweep, deferred by `20260909000003_prune_execute_service_role_only.sql` with a header comment saying it needed a caller guard rather than a revoke. Open until 2026-09-10
- **Module:** database. `supabase/migrations/20260711000010_triggers.sql`
- **Severity:** **High.** `security definer` plus PUBLIC EXECUTE meant any signed-in user could run the sweep and flip **every** pending reminder in the table to `fired`, including other people's, bypassing `reminders_update` entirely
- **Actual:** `select proacl from pg_proc where proname='fn_fire_due_reminders'` returned `{postgres=X/postgres,=X/postgres}`; the bare `=X/` is PUBLIC
- **Why a revoke was not the fix:** the sweep has two legitimate non-service callers. pg_cron and the outbox consumers run as `service_role` with no `auth.uid()`, and `tests/e2e/reminders-tasks.spec.ts` drives the whole `reminder.due` event as a signed-in admin. Revoking would have broken the only interface the event has
- **Fix:** `20260910000001_fire_due_reminders_caller_guard.sql`. The function reads `auth.uid()`: null means service_role or cron and sweeps everything; a caller whose `staff.role` is `admin` sweeps everything; any other staff row sweeps only `staff_id = auth.uid()`; a caller with no staff row raises `42501`. That predicate is exactly `reminders_update`'s (`get_my_role() = 'admin' OR staff_id = auth.uid()`), so the definer rights now grant nothing the caller did not already hold. `revoke all … from public, anon` then `grant execute … to authenticated, service_role`
- **Verified:** `proacl` is now `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. A sourcer sweeping with one own and one recruiter-owned reminder both due fired **1**, leaving the recruiter's `pending`; the admin sweep then fired it. `e2e/reminders-tasks.spec.ts` **6 passed (16.2s)**
- **Guard:** the last test in `e2e/reminders-tasks.spec.ts`, "F23: the reminder sweep only touches what the caller may already update"
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-032: no list page had ever offered search suggestions, and one column had no sort to offer

- **Found:** 2026-09-10, by Klent: *"i don't see any suggested results in requisitions like how the topbar searchbox functions. why?"* and *"add sort function to flag, requisitions, resume, grade comment"*
- **Module:** `components/ui/ListPage.tsx`, `components/ui/SearchBox.tsx`, `modules/recruit/candidates`
- **Severity:** **Low** for the suggestions, which is a missing capability rather than a break. **Medium** for the Requisitions sort, because adding `sortable: true` alone would have shipped a header that looks live and silently does nothing
- **Actual, suggestions:** the utility header renders `SearchBox`, which queries six list views on a 300ms debounce past three characters and drops a `.fo-hint-pop`. `ListPage` rendered a bare `SearchField`, which has none of that machinery, so **no list page in the app had ever suggested anything**
- **Actual, sorts:** Flags, Resume and Grade comment each had a `SORT_COLUMNS` entry and were simply missing `sortable: true`. Requisitions had no entry and could not have one: the codes are assembled in the browser from a second and third read (`applications`, then `requisitions`), so `applyOrder` had nothing to order by and would have fallen through to the default sort
- **Fix, suggestions:** the fetcher was parameterised rather than the pop duplicated. `lib/searchHints.ts` owns `SearchHint`, `SearchHintFetcher` and three fetchers: `globalSearchHints` (the six views, now passed explicitly by the two call sites that want everything), plus `requisitionSearchHints` and `candidateSearchHints`. `SearchBox` takes `fetchHints` and does nothing without it; `ListPage` renders `SearchBox` and forwards a new `searchHints` prop. A list suggests only its own records
- **Fix, sorts:** three flags, plus `20260910000002_candidate_list_requisition_codes.sql`, which adds `requisition_codes` to `candidate_list` as a correlated `string_agg`. **Measured before choosing that over a materialised column:** an unfiltered `order by requisition_codes` over 73,023 `candidate_profiles` and 86,163 `applications` is `Execution Time: 210.734 ms`, using `idx_applications_person` and `requisitions_pkey`. `database.types.ts` gained the column in the same change
- **Two defects the refactor introduced, both caught before the suite ran and neither shipped:** `SearchBox.searchAll` navigates to `/search` when `onSubmitTerm` is absent, so the magnifying glass in a list toolbar would have left the list on every page except requisitions; and `.list-page-search`, which sets `display: flex`, moved onto the wrapper `div`, collapsing the form to `{"wrapW":420,"formW":195,"inputW":195}`. `ListPage` now always passes a submit handler, falling back to `onSearchChange`, and `.list-page-search > .fo-search-row { flex: 1; min-width: 0 }` re-measured `{"wrapW":420,"formW":420,"inputW":420}`
- **Evidence:**

```
REQ HINTS  :: {"count":10,"allBtn":"Search all requisitions for “man” · 202 matches","belowTrigger":0,"href":"/recruit/requisitions/f541e2db-…"}
CAND HINTS :: {"count":10,"allBtn":"Search all candidates for “adam” · 366 matches","href":"/recruit/candidates/91ea1134-…"}
SORT Flags         :: index=1  rows=20 aria-sort=ascending
SORT Requisitions  :: index=11 rows=20 aria-sort=ascending
SORT Resume        :: index=4  rows=20 aria-sort=ascending
SORT Grade comment :: index=9  rows=20 aria-sort=ascending
```

- **Guard:** `quick-search.spec.ts` Q10 (suggestions are scoped to the list and attached to the box), Q11 (all four headers report a direction and still return rows), Q12 (submitting a list search stays on the list, across three routes)
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-033: the page-head skeleton was built, reviewed and removed the same day

- **Found:** 2026-09-10. Built at Klent's request (*"add skeleton to the pageheader"*), then removed at his: *"remove the skeleton on the fo-page-head searchbox section. i can see like it's displaying a skeleton. don't dispolay a sekeleton to the searchbox line."*
- **Module:** `components/ui/ListPage.tsx`
- **Severity:** **Low**, but worth a log entry so nobody rebuilds it
- **Why it was wrong, and it is the same reason it needed a gate:** `useMinimumVisible(loading)` is true whenever a query is in flight, which includes while someone is typing in the search box. The `everLoaded` flag limited it to the first load, but a skeleton over a text input is always one gate away from taking the control out from under the user. Everything else in the page head, the title, the description and the breadcrumb trail, is known at first paint, so there was nothing there worth skeletoning either
- **Fix:** `headLoading`, the `everLoaded` flag and their test are gone. The list loading state is `.fo-skeleton-card` around `Skeleton rows={8}`, which is the table, which is what actually loads
- **Guard:** `quick-search.spec.ts` Q7 injects a 1200ms delay and asserts the toolbar carries **zero** skeletons, the search input is present, and the eight table bars are the whole loading state
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-034: four spec fixtures deleted every user's UI preferences, not just the test persona's

- **Found:** 2026-09-10, by Klent: *"i notice the recently viewed keeps getting erased. why? is it local storage? it should be saved per user, right?"*
- **Module:** `tests/e2e/record-ui.spec.ts`, `settings-gears.spec.ts`, `view-settings.spec.ts`, `scroll-shadow.spec.ts`
- **Severity:** **High.** Test fixtures destroying real users' data, on every suite run, silently. It also breaks the project's own stated rule: *"make sure when doing crud, create a seeded record and delete that. not actual records."*
- **Answering the question:** no, it is not localStorage, and it is per user. `hooks/useRecentlyViewed.ts` reads and writes `integration_settings` under `ui.recentlyViewed`, keyed by `staff_id`, with no `localStorage` path at all. It was being erased from outside the app
- **Cause:** `integration_settings_write` is `get_my_role() = 'admin' OR staff_id = auth.uid()`, so **an admin may write any staff member's row**. All four fixtures issued their cleanup as the admin persona **filtered only by key**:

```
await client.from('integration_settings').delete().eq('key', RAIL_KEY);
await client.from('integration_settings').delete().in('key', PREF_KEYS);
```

  RLS therefore permitted, and PostgREST performed, a delete across every staff row. Every suite run wiped the Recently Viewed rail and the dashboard section preferences of every account in the database, including real ones

- **Evidence:** after the runs on 2026-09-10, `select count(*) from integration_settings where staff_id = '8d999056-bc8d-4caa-819b-61e9652b0e73'` (`foos.admin@ventvest.com`, a real account, not a persona) returned **0**, while the persona row still held 5 items
- **Fix:** `deleteOwnSettings(persona, keys)` in `tests/env.ts` resolves the signed-in id with `auth.getUser()`, adds `.eq('staff_id', staffId)`, and **throws** rather than proceed if the id cannot be resolved, so the unscoped form cannot come back by accident. All four fixtures use it
- **Guard:** the helper is the guard: a cleanup cannot be written unscoped without going around it. Recorded in CLAUDE.md next to the `integration_settings` section so the next reader meets the policy before writing a fixture
- **Cost:** Klent's own rail, repeatedly, over an unknown number of runs. Also confidence: the erasure looked like an app bug and was not
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-035: the pager's page number reads as a record count on a large list

- **Found:** 2026-09-10, by Klent: *"out of 73023 candidates, why is it showing 3652 only?"*
- **Module:** `components/ui/Pager.tsx`
- **Severity:** **Low** as a defect, but it cost real confusion and a full investigation
- **Not a defect in the data.** Nothing is missing. `.fo-pager-count` renders `1-20 of 73024` and `.fo-pager-pos` renders `1 / 3652`, side by side. `ceil(73024 / 20) = 3652`, so the second figure is the page number, not a row count
- **Ruled out before concluding, each by measurement:** RLS (admin sees 73,024 through Postgres **and** through PostgREST, `Content-Range: 0-0/73024`); a missing `people` row dropping candidates on the view's inner join (0 such rows); a filter silently applied (no status, source, sourcer, grade or resume bucket lands near 3,652); the wrong persona (admin 73,024, recruiter 73,024, sourcer 3, bd 0)
- **Why it misleads:** on 687 requisitions the same control reads `1 / 35`, which nobody mistakes for a record count. At 73,024 rows the page number reaches the same order of magnitude as a plausible row count and sits next to a figure that is one, separated only by a slash
- **Status:** **Closed 2026-09-14.** Klent picked removal: "i don't think we need the page count in pagination. i think number of records is good enough. remove to all pages." `.fo-pager-pos` and its stylesheet rule are gone, so every list now shows only the row range. `pageCount` stays in the component because the last-page chevron and `atEnd` still need it
- **Fix owner:** Claude
- **Closed:** 2026-09-14
- **Fix owner:** unassigned

### QA-036: TableColumn.width silently had no effect under the auto table layout

- **Found:** 2026-09-10, by Klent: *"increase width of location in the candidates table. currently, it's too narrow."*
- **Module:** `components/ui/Table.tsx`
- **Severity:** **Low**, but it is the kind of thing that wastes an hour: the prop exists, is typed, is applied to the `th`, and does nothing
- **Actual:** setting `width: '200px'` on the candidate Location column left it at **106px**. `.table` is `table-layout: auto`, where a specified width is a hint the algorithm may override when other columns want the space, and the two columns given `nowrap` in the same change had just made them want it
- **Evidence:**

```
with width: '200px'    :: location {"ws":"normal","w":106}
with minWidth: '200px' :: location {"ws":"normal","w":200}
```

- **Fix:** `TableColumn.minWidth`, applied alongside `width` on the `th`. Location uses `minWidth`; the existing `width` users (`flags` 32px, `star_grade` 92px) are unchanged, so nothing else moved
- **Guard:** `quick-search.spec.ts` Q18 asserts Location is at least 200px, that Name and Sourcer compute `white-space: nowrap`, that `.table-wrap` is `overflow-x: auto` (which is what makes nowrap safe), and that the document itself still does not scroll sideways
- **Worth keeping:** `width` on a table column is a suggestion. If a column must hold a size, use `minWidth`
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-037: the candidate record's Flag button was a placeholder that looked live

- **Found:** 2026-09-10, by Klent: *"What's this flag button? next button?"* and *"use an actual flag icon. hollow at first, but if clicked, it fills"*
- **Module:** `modules/recruit/candidates/CandidateRecordPage.tsx`
- **Severity:** **Medium.** A control that reads as a toggle, sits beside the record title, and does nothing when pressed
- **Actual:** a `link-btn` reading the word "Flag" whose entire behaviour was `show('Flag')`, the Taleo-replica placeholder. It had no icon, no state, and no data behind it. The **Next** control beside it is the same shape but honest: it says *"Paging to the next candidate in the current list view is not implemented yet."*
- **Fix:** a real toggle. Hollow `Flag` icon that fills `--danger` when set, writing `candidate_profiles.do_not_contact` — the only flag the schema has, and exactly what the candidate list's Flags column renders (see QA-031). `aria-pressed` carries the state, the `title` explains both directions, and it is disabled with a reason for anyone who is not an admin or a recruiter, matching `canEditProfile`. Setting it also raises the existing `.dnc-banner`, so the record says out loud that outreach is blocked
- **Verified, round trip:**

```
HOLLOW :: {"on":"false","fill":"none","banner":0}
FILLED :: {"on":"true","fill":"rgb(212, 0, 0)","banner":1}
DB AFTER CLICK        :: {"do_not_contact":true}
DB AFTER SECOND CLICK :: {"do_not_contact":false}
```

- **Guard:** `candidate-record.spec.ts` C2 asserts hollow, clicks, asserts filled plus the banner plus the database row, clicks again and asserts it cleared. C3 assigns the fixture to the sourcer so they can see it under RLS, then asserts the control is disabled and says why
- **Left alone deliberately:** **Next** is still a placeholder. Paging to the next record in the current list view needs the list's ordering and cursor carried into the record page, which is a feature rather than a fix
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-038: two candidate accordions rendered the same data, and the action bar was eight controls wide

- **Found:** 2026-09-10, by Klent: *"too many buttons in fo-page-head"*, *"change more into ... it is already existing in requisitions. follow it"*, *"why is there too possibly similar accordions requisition summary and requisition details?"*
- **Module:** `modules/recruit/candidates/CandidateRecordPage.tsx`
- **Severity:** **Low**, but the duplicate accordion is a correctness smell: two sections claiming to be different views of the same rows
- **Actual, the duplicate:** `Requisition Summary` and `Requisition Details` both mapped the same `apps` array and both rendered a `StatusBadge`, the rank and the shortlisted badge. The **only** difference was that Summary wrapped the requisition in a `<Link>` and Details rendered it as plain text with an em-dash. Details also had a different empty-state wording, which is the only thing that made them look intentional
- **Actual, the action bar:** Edit, Send Email, Schedule meeting, View Resume, Print Resume, Submit, a `More` dropdown with a caret, and Save profile. Eight controls, three of them placeholders
- **Fix:** `Requisition Details` deleted; Summary survives because it links. The bar is now Edit, Send Email, View Resume and Save profile, with Schedule meeting, Print Resume, Submit, Merge duplicate and Erase moved into `<ActionMenu label="More actions" iconOnly />`, which is the exact shape `RequisitionRecordPage` already used
- **Evidence:** `ACTION BAR :: {"buttons":["Edit","Send Email","View Resume","More actions","Save profile"],"overflowIsIcon":true}`
- **Guard:** `candidate-record.spec.ts` C1 caps the bar at five controls, asserts the trigger is `.fo-action-menu-trigger`, asserts the three moved labels are no longer in the bar and are in the menu. C5 asserts `Requisition Summary` exists and `Requisition Details` has count 0
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-039: Candidate Information poured 21 field kinds into one flat grid

- **Found:** 2026-09-10, by Klent: *"fix candidate information accordion content. it's a bit too crowded. search the internet for better edesign"*
- **Module:** `modules/recruit/candidates/CandidateRecordPage.tsx`, `components/ui/InfoGroup.tsx`
- **Severity:** **Low**, cosmetic, but it was the largest section on the page and the least readable
- **Actual:** one `dl.info-grid` holding **21 distinct `<dt>` kinds** and more with repeats (every email, every phone, every education entry), at `row-gap: 0`, in a four-column label/value grid. Then an eleven-field editable form squeezed into that **same** label/value grid via `.info-grid-form`, then two sub-headings written as `<h2 style={{ marginTop: 'var(--sp-2)' }}>` inline styles
- **Research, as asked:** Salesforce's and Zoho's own layout guidance both land on the same answer — group fields logically rather than alphabetically, give every group a label that says what it is, keep two columns, and drop fields nobody updates. A single unlabelled block is the case they name as hardest to scan
- **Fix:** `components/ui/InfoGroup.tsx`, a labelled and ruled group. Candidate Information is now Name, Contact, Location, Profiles, Education, Experience, Assessment scores and Grading and salary, each group conditional on having data. `row-gap` went 0 to 2px. The editable fields moved to a real form grid, `.info-form-grid` at `repeat(auto-fit, minmax(240px, 1fr))`, with `field-wide` giving the grade-comment textarea a full row. Both inline `style` attributes are gone
- **Evidence:** `INFO GROUPS :: {"groups":["Name","Contact","Location","Experience","Grading and salary"],"inlineStyledH2":0,"formGrid":1}` on a fixture with no education, profile links or assessment scores, which is why those three groups correctly do not render
- **Guard:** `candidate-record.spec.ts` C4 asserts the named groups exist, that no `h2[style]` survives, that there is exactly one `.info-form-grid`, and that the textarea sits in a `field-wide` cell
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

### QA-040: Google search results cannot be embedded, so Web Links became cards

- **Found:** 2026-09-10, by Klent: *"make web links look nice, is there a google results iframe or something? search the web"*
- **Module:** `modules/recruit/candidates/CandidateRecordPage.tsx`
- **Severity:** **Low**
- **The answer to the question is no, and it is not a limitation of this app.** Google sends `X-Frame-Options` on search results as clickjacking protection. That header is set by the responding site and cannot be relaxed from the client; the documented workarounds are all server-side proxies that re-fetch and re-serve the page, which would mean routing a recruiter's searches through our own infrastructure. LinkedIn does the same
- **Actual, before:** two bare anchors in `.approver-line` divs, reading "Search Google for …" and "Search LinkedIn for …", plus a paragraph of explanation
- **Fix:** `.fo-link-card`s — icon, title, and the **target host** as a meta line, with an external-link glyph on the right. The card also surfaces the candidate's real `linkedin_public_url`, `linkedin_recruiter_url` and `online_resume_url` when present, so the section shows what is on file next to what can be searched for. `linkHost()` in `lib/format.ts` derives the host and falls back to the raw URL on a parse failure
- **Guard:** `candidate-record.spec.ts` C6 asserts at least three cards, that `google.com` and `linkedin.com` appear as hosts, that every card is `target="_blank"` with `rel` containing `noreferrer`, and that a card is not underlined
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-10

---

### QA-041: the Edit button was a jump link wearing the label of a mode

- **Found:** 2026-09-11, by Klent: *"what's the point of edit button if i can already edit it anyway? should we just remove the edit button?"*
- **Module:** `modules/recruit/candidates/CandidateRecordPage.tsx`
- **Severity:** **Low**
- **Actual:** `startEditing` expanded `#candidate-information` if it was collapsed and focused the first enabled control in `.info-form-grid`. It changed no state. Every field it reached was already editable, on every visit, for anyone `canEditProfile` allowed. So the control offered a transition into an editing state the page does not have, and a person who had the section open and the cursor in a field had already done everything pressing it would do
- **Fix:** the button and `startEditing` deleted. The bar is now Save profile, Send Email, View Resume and the `More actions` menu. `canEditProfile` is untouched and still gates all 15 controls it gated before
- **Guard:** `candidate-record.spec.ts` C10, rewritten from *"Edit opens the editable fields and puts the cursor in one"* to assert the button is absent from `.record-action-bar` and that the profile fields are live without it
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-042: no field of `people` is editable anywhere in the product

- **Found:** 2026-09-11, while answering QA-041. Klent did not report this; it is what the Edit button was standing in front of
- **Module:** application-wide. It reads as a candidate defect because that is where it was noticed, but `people` is shared: a **contact's** name, emails and phones are equally uneditable on `/sales/contacts/<id>`
- **Severity:** **Medium**
- **Actual:** there are **10** `from('people')` call sites in `app/src`. Nine are selects; the tenth is the insert in `ContactNewPage.tsx:118`. `grep -rn "from('people')" app/src | grep -iE "update|upsert"` returns **nothing**, so a `people` row can be created and then never amended, and only the contact form can create one. The only writer of a candidate's own record is `saveProfile` in `useCandidateProfileDraft.ts`, and it writes `candidate_profiles` alone. So `first_name`, `middle_name`, `last_name`, `emails`, `phones`, `city`, `country`, `linkedin_public_url`, `linkedin_recruiter_url` and `online_resume_url` are readable on the record, exported to CSV, searched over by `candidate_list.search_text`, and correctable by no one. A typo imported from Zoho is permanent from inside the app
- **Not a permissions gap:** `people_update` exists (`20260711000011_rls.sql:135`) and is `using (public.can_write_person(id))`, which returns true for any admin and, for a recruiter, for any person who has a `candidate_profiles` row. Every candidate on this list is therefore writable by the roles that open the page. Nothing calls it. This is a missing surface, not a denied one
- **Why it matters more than it looks:** 73,023 of these rows arrived by import, `parsePartialDate` guessed a year on every `Initial Date` that had none, and `backfill-zoho-candidate-fields.mjs` exists precisely because imported fields needed repair. The repair path is a script run by an engineer
- **Status:** **open.** The fix is an editable Name/Contact/Location group writing `people`, which is a change to what the page does rather than to how it looks, so it is Klent's to schedule
- **Fix owner:** unassigned

---

### QA-043: placeholders told users a shipped feature was unbuilt, and pointed at one that never existed

- **Found:** 2026-09-11, by Klent: *"why for candidates without resumes, it says View Resume is still in development. that doesn't make a lot of sense"*, then *"any other modals that have that message but is actually already working?"*
- **Module:** `shell/Placeholder.tsx` and five call sites
- **Severity:** **Medium.** Nothing breaks, but the product misreports its own state, and two of the six cases send a person looking for a control that is not there
- **The mechanism:** the modal's lead line was hardcoded `{action} is still in development.` A call site could pass a `detail` saying something truer, but the false headline sat above it and was the sentence people read
- **Actual, case 1 (the one Klent hit):** the candidate record rendered `<PlaceholderAction label="View Resume">` whenever `resumes.length === 0`. `viewResume()` is real and works. The candidate simply had no resume on file, which is a data state. The detail line already said "Upload a resume…", so the honest message was present and overridden
- **Actual, case 2:** four bulk controls where the singular ships and only the selection version is unbuilt: `CandidateListPage` View Resume, Print Resume and Submit, and `ContactsListPage` Send Email. "Send Email is still in development" is false in an app that sends email from every contact and candidate record
- **Actual, case 3, the worst one:** the bulk Delete placeholders on companies, contacts and deals all read "Open a *X* to archive it individually." **`grep -rni archive app/src/modules/sales` matches nothing but those three strings.** There is no archive control, no `is_archived` column and no `archived_at` column anywhere in the schema. The advice described a feature that has never existed
- **Fix:** `show()` and `PlaceholderAction` take an optional `lead`, so a placeholder can name what is actually missing. View Resume is no longer a placeholder at all: it is a disabled `Button` with `title="No resume on file…"`, matching the pattern Send Email already used for do-not-contact. The four bulk controls now lead with "…for a whole selection is still in development." and point at the record that can do it. The three archive sentences are replaced with what is true: a deal closes to Closed Won or Closed Lost, and nothing archives or deletes a contact or an account
- **Guard:** `candidate-record.spec.ts` C16 asserts View Resume is disabled with that title and that no placeholder modal opens
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-044: Print Resume was a placeholder sitting on top of a finished print stylesheet

- **Found:** 2026-09-11, by Klent: *"why need to print resume if you can already download it? unless it is autogenerated by the system? the reusme it means is the candidate profile"*
- **Module:** `modules/recruit/candidates/CandidateRecordPage.tsx`, `styles/layers/print.css`
- **Severity:** **Low**
- **Klent's reading is the correct one.** Taleo's Print Resume does not print the uploaded file; it prints the system-formatted candidate profile, which is the document a recruiter sends a client. The label pointed at the attachment that View Resume already downloads, so as written it was both a placeholder and a duplicate
- **Actual:** `onSelect: () => show('Print Resume')`, while `styles/layers/print.css` is **205 lines** that already strip the utility header, primary nav, sidebar, bookmark bar, toolbar, action bar, pager, segmented controls, action menu and chevrons, then flatten `.record-section` and `.fo-page-head` onto paper. Nothing in the app called `window.print()`
- **Fix:** relabelled **Print profile** and wired to `window.print()`. One line, and the stylesheet that was written for it finally runs
- **Guard:** `candidate-record.spec.ts` C17 stubs `window.print` through `addInitScript`, asserts the old `Print Resume` menu item is gone and that the new one calls print exactly once
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-045: printing a record printed whatever was collapsed on screen

- **Found:** 2026-09-11, by Klent: *"if all accordions is closed, the print also shows closed. i want every single accordion and its detials in the print"*
- **Module:** `components/ui/SectionCollapse.tsx`, `components/ui/RecordPage.tsx`, `styles/layers/print.css`
- **Severity:** **Medium.** The printed document silently omitted content, and the omission depended on how the reader had left the page
- **There was already a `beforeprint` listener calling `setAll(true)`, and it did not work, for three separate reasons:**
- **One:** a section that has never been opened renders `{everOpened ? children : null}`, so its body is empty in the DOM. Opening it during `beforeprint` is a React state update, which is asynchronous, so the browser could snapshot the page before the children existed. `flushSync` is the fix
- **Two:** `.record-section-collapse` is a grid whose `grid-template-rows` is set as an **inline style**, and `.record-section-clip` is `overflow: hidden`. `print.css` overrode neither, so even a mounted section stayed clipped to `0px`. Two `!important` rules in the print layer now force `1fr` and `visible`
- **Three, the one that took the longest to find:** the snapshot taken so the sections could be restored after printing read the provider's `openByKey` state, and that state was **stale**. Collapsing all 15 sections produced 15 `report(key, false)` calls and **no provider re-render**, so `openByKey` still said every section was open while the DOM showed every one closed. Restoring from it was a no-op. The fix does not depend on that state at all: `register` now takes a `read: () => boolean` alongside the setter, and the print snapshot asks each section for its own live value. `openByKey` keeps its one honest job, labelling the maximize/minimize button
- **Fix:** `beforeprint` reads each section's live state, `flushSync`es every section open, and `afterprint` restores the snapshot the same way, so printing no longer leaves the page rearranged
- **Also:** the snapshot is taken by `prepareForPrint()`, which both print buttons call **before** the settle-poll, and `beforeprint` only snapshots when one is not already pending. Without that, a button that expands first would have `beforeprint` snapshot the expanded state and `afterprint` restore nothing, which is exactly what Klent asked for when he said *"i want the accordion getting back to it's original state if i close print"*. Chrome fires `afterprint` on cancel as well as on print, so closing the preview restores either way
- **Guard:** `candidate-record.spec.ts` C20 collapses all 15 sections, dispatches `beforeprint`, and asserts all 15 are open with non-empty bodies, then dispatches `afterprint` and asserts all 15 are closed again. It also allows the one section that legitimately renders nothing: `SidePanelTabs` returns null when every tab count is 0, so an untouched Contact Log is absent rather than empty
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-046: opening a candidate fired four queries comparing a uuid with an empty string

- **Found:** 2026-09-11, while investigating why Recently Viewed appeared to reset. Not the cause of that, but four rejected requests on every candidate record open
- **Module:** `modules/recruit/components/engagement.tsx`, called from `CandidateRecordPage.tsx:110`
- **Severity:** **Low**
- **Actual:** `useEngagement('application', viewedApplicationId ?? '')` passes an empty string whenever no application is being viewed, which is the default. `refresh()` then issued four reads with `eq.` and no value, and Postgres rejected each: `{"code":"22P02","message":"invalid input syntax for type uuid: \"\""}` on `activities?application_id=eq.`, `tasks?related_id=eq.`, `reminders?related_id=eq.` and `attachments?parent_id=eq.`
- **Fix:** `refresh()` returns early with empty state when `parentId` is falsy
- **Evidence:** a probe recording every 4xx on `/rest/v1/` while opening a candidate returned four entries before the fix and `BAD []` after
- **Guard:** `candidate-record.spec.ts` C22 records every 4xx REST response while opening a candidate and asserts the list is empty
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-047: nothing reset the scroll position, so a record opened from a scrolled list rendered scrolled

- **Found:** 2026-09-11, by Klent: *"clicking a candidate in kanban of requisition/<id> redirects user to that candidate, but not the top. why?"*
- **Module:** `shell/AppShell.tsx`, new `shell/useScrollReset.ts`
- **Severity:** **Medium**
- **Why it was never noticed as a general bug:** the shell scrolls inside `main#main-content` (`.shell-content { overflow: auto }`), not the document, so the browser's own per-navigation scroll handling never applied, and `grep -rn "scrollTo\|ScrollToTop\|scrollTop = 0" app/src/shell app/src/App.tsx app/src/components` returned **one** unrelated match in `useStickyFocusGuard`. There was no scroll reset anywhere in the app. It only reads as a kanban bug because the kanban is the thing people click from far down a tall page
- **Fix:** `useScrollReset()` in `AppShell`, setting `scrollTop = 0` on every `location.key` change, skipping hash navigations so in-page anchors keep working
- **Rejected, and why it matters:** restoring the previous offset on Back. Built and abandoned. The list clamps its own scroll height while data loads, so a continuous scroll listener records the clamped value rather than where the reader was, and the restore landed at **1px** instead of 700 across several attempts (filtering clamped values and widening the retry window to 3s did not fix it). A restore that works sometimes is worse than a reset that always works, so Back now lands at the top like every other navigation. Worth revisiting only with a real scroll-anchoring approach
- **Guard:** `tests/e2e/scroll-reset.spec.ts` S1 opens a record from a list scrolled to 600px, S2 does the same from the requisition kanban with its own seeded requisition, person and application, S3 asserts a hash navigation is left alone
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-048: "Erase" is a legal term, not a button label

- **Found:** 2026-09-11, by Klent: *"the erase message doesn't seem to be common. search the web for a better replacement. if it is comment, let's retain erase label."*
- **Module:** `modules/recruit/candidates/CandidateEraseDialog.tsx`, `CandidateRecordPage.tsx`
- **Severity:** **Low**
- **The answer is split, which is why it looked common.** GDPR Article 17 is titled "Right to erasure" and the regulation uses *erasure* and *erase* throughout, so the word is correct for the concept this feature implements. It is not what products put on controls: destructive-action guidance is consistently verb plus noun naming the object, with the consequence stated in the button itself rather than only in the body, because people in a hurry read the button and skip the prose
- **Fix:** the menu item is `Delete permanently…`, the dialog is `Delete this candidate permanently`, the confirm button is `Delete permanently` and its busy state is `Deleting…`. The body copy still describes the erasure and the receipt, and `fn_erase_person`, `person_erasures`, `erased_by` and `erased_at` keep their names: the schema is where the legal term belongs
- **Guard:** `erase-candidate.spec.ts` and `record-action-bar.spec.ts` updated to the new labels
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-049: three tests could only ever fail in CI, because CI has different data

- **Found:** 2026-09-11, by Klent, after the third CI failure on this branch: *"ci still failed. why can we not capture this in local? we're wasting time here... this keeps happening multiple times already."*
- **Module:** `tests/e2e/quick-search.spec.ts`, `tests/e2e/candidate-record.spec.ts`
- **Severity:** **Medium.** No product defect. A process defect that cost three CI runs and the time to read each
- **The cause is one thing, and it is not flakiness.** This checkout's local stack carries the **Zoho copy: 73,024 candidates, 690 requisitions**. CI runs the suite against `supabase db reset`: migrations, `seed.sql`, the four personas, nothing else, so a list there has single digits of rows. Three assertions were true only of a large database:
- **Q14** polled for exactly **20** rows after clearing a search. CI: `Expected: 20 / Received: 8`
- **Q10** typed the literal string `man` and waited for the suggestion pop. No seeded requisition contains it: `/recruit/requisitions offers no suggestions ... element(s) not found`
- **C7** expected the cold-URL pager title `Next candidate by name`, and got `Next candidate`. Subtler than the other two: on a small database the C-series fixture is on **page one of the list**, so the URL the test "arrives cold" at is a history entry React Router restores siblings state from, and the pager then knows its position
- **Why three CI runs and not one:** each time the specific assertion was repaired without naming the class. Running the browser suite locally was asked for and done, and it cannot reproduce any of this
- **Fix:** Q14 records the unfiltered count before filtering and compares against that; Q10 takes its term from the first row the list is already showing and asserts it is at least `HINT_MIN_CHARS`; C7 opens the cold URL in `context.newPage()`, which has no history to restore from
- **Prevention:** `scripts/ci-parity.sh` (snapshot, run, restore) pg_dumps the local database, resets it to CI's shape, runs the suite and puts the data back. CLAUDE.md's test-caveat list gains the rule: a test may not assume a row it did not create
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-050: the bulk bar's overflow menu was clipped by the animation that reveals the bar

- **Found:** 2026-09-11, while moving four bulk buttons behind an `ActionMenu` at Klent's request
- **Module:** `components/ui/ListPage.tsx`, `styles/layers/taleo.css`
- **Severity:** **Medium.** The menu opened and could not be clicked
- **Actual:** `.fo-page-head-grow-inner` is `overflow: hidden`, which is what makes the 0fr to 1fr grow read as a reveal rather than a jump. Any dropdown inside it is cut off at the bar's own height, and the click lands on whatever is underneath: `<div class="fo-pager"> ... intercepts pointer events`
- **Fix:** the grow reports `transitionend` for `grid-template-rows` and sets `data-settled`, and `[data-settled='true'] > .fo-page-head-grow-inner` is `overflow: visible`. The clip is present for the whole animation and lifts only once the bar has finished growing, so the reveal is unchanged and the menu can leave the box
- **Guard:** `bulk-actions.spec.ts` asserts opacity 0 and `overflow: hidden` while closed, opacity 1 and `overflow: visible` once open, that all four moved items are in the menu, and that the bar itself is at most three controls wide
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-051: two motion assertions could only fail on a slow runner

- **Found:** 2026-09-11, CI run 34555711852, the run after QA-049 was fixed
- **Module:** `tests/e2e/candidate-record.spec.ts`, `tests/e2e/interaction-motion.spec.ts`
- **Severity:** **Low**, and the same shape as QA-049: an environment difference local runs cannot reproduce. CI is 2 vCPU against this machine's 10
- **C11** polled until the option highlight *stopped changing*, which CLAUDE.md already warns against. On CI two consecutive frames returned the same mid-fade value and the poll called it settled: `- "background": "rgba(240, 246, 251, 0.96)"` against `+ "background": "rgb(240, 246, 251)"`. Fixed by reading the target once from a probe element styled `background-color: var(--fo-option-hover)` and polling each option until it equals that exact string
- **R7** read the closing menu's `opacity` one instant after the click and asserted it was above 0. `Expected: > 0 / Received: 0`: on a slow runner the 150ms exit had already finished. Fixed by asserting the exit is **declared** (`animationDuration` is not `0s`) on the element that carries `data-closing`, which is the actual contract
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-052: the bulk print sheet printed a blank page, and the Selected list read uuids

- **Found:** 2026-09-11, by Klent, on the features shipped in `3335827`: *"print selected profiles only shows a blank page"*, *"clickign view resume to selected candidates shows it's in development modal"*, *"why is this showing ids?"*
- **Module:** `modules/recruit/candidates/CandidateBulkActions.tsx`, `components/ui/ListPage.tsx`
- **Severity:** **Medium**
- **Blank page:** the sheet is rendered by `CandidateBulkActions`, which lives inside the bulk bar, inside `.fo-page-head`, which is exactly what `body[data-print-scope='selection']` hides. The sheet hid itself. It is portalled to `document.body` now
- **Uuids:** `recipients` resolved names with `profiles.find(...)`, and `profiles` holds only the rows on the **loaded page**. Selection persists across pages, so anyone ticked on page one and viewed from page two fell back to `personId`. Missing rows are fetched from `candidate_list` by id, bounded at 200 and guarded by a `requested` ref so the effect cannot loop on its own result. (`Adam -` in the same screenshot is real data: that candidate's last name is `-`)
- **View Resume:** was still a placeholder; it now reads the newest non-pending resume per selected person in one query, signs each url, opens what it can and reports what it could not, including pop-ups the browser blocked. `outcome` had only ever been rendered inside the email dialog, so the bar needed a `.fo-bulk-outcome` line for a message raised from the menu
- **Guard:** `bulk-actions.spec.ts` asserts `body > .cand-print-sheet` exists with one card per selection and more than 40 characters of text, that View Resume opens no placeholder and reports an outcome, and that no 36-character uuid appears in the Mark dialog after selecting across two pages
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-053: the closed bulk bar was aria-hidden with focusable buttons inside it

- **Found:** 2026-09-11, CI run 34556895461: `candidates: aria-hidden-focus (serious, 1 node(s)) e.g. .fo-page-head-grow`
- **Module:** `components/ui/ListPage.tsx`
- **Severity:** **Medium.** A real product defect, not a test artefact: a keyboard user could tab into a toolbar nobody can see
- **Actual:** `.fo-page-head-grow` carried `aria-hidden` while closed, and its buttons stayed in the tab order. Adding the `ActionMenu` gave it one more focusable child and axe flagged it
- **Fix:** `inert` when closed, the same shape `RecordSection` already uses for a collapsed section
- **Why local did not catch it:** `accessibility.spec.ts` walks every route, so any markup change is inside its blast radius, and the run before this commit was scoped to the specs that had been edited. Running only the changed specs is the right default for a CSS tweak and the wrong one for a markup change
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-054: the intake queue and drawer were the only surfaces the shared components had passed by

- **Found:** 2026-09-11, by Klent, page by page across `/intake`
- **Module:** `modules/intake/*`, `components/ui/ListPage.tsx`, `styles/layers/*`
- **Severity:** **Low** individually, **Medium** as a pattern: every item was a shared component or token existing and not being used
- **The list:** no `flush`, so the search row read as a separate card; a hand-rolled `.fo-gear-btn` with the old cog instead of `SettingsButton`; a `PlaceholderAction label="More"` holding nothing; `Target` printing its raw enum while Channel and Status had label maps; no sort on the channel, headline or batch columns; no suggestions, where every other list had them since 2026-09-10; no skeleton; a Columns section in the filter rail that a dialog does better
- **The drawer:** the duplicate check was hidden until it resolved, so it appeared underneath a body that had already rendered; `Dedup check` used a database word for a panel of possible duplicates; its empty case was a bare sentence rather than `EmptyState`; `--section-tint` painted the badges, the read-only note **and** the accordion headers, so the panel was three shades of one blue; the close button travelled 16px on exit, which reads as a fade rather than a drawer leaving
- **Two that were genuinely dead, not just inconsistent:** `.fo-dialog-close` had a transition and **no hover rule**, so every dialog cross in the app was inert, and `.intake-raw-toggle` had neither, having reinvented `.link-btn`. Klent: *"do icon buttons have transition? it doesn't look like it... why do we keep missing this"*. The cause is that hover states live beside each class while the hover transition lives in one opt-in list in `motion.css`, so a control needs an entry in two hand-maintained places
- **A guard for that was written and abandoned.** It flagged any `:hover` that recolours without a transition and produced **20+ false positives**, because hover and transition are declared against different classes on the same element (`.btn-primary:hover` against `.btn`). A static check cannot resolve which rules apply without a DOM. The rule is in CLAUDE.md instead
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-055: a local suite run ground through 339 tests before reporting the first failure

- **Found:** 2026-09-11, by Klent: *"optimze browser tests as well since currently, it takes quite a while just to encoutnre a fucking error. wasting both of our times."*
- **Module:** `tests/playwright.config.ts`
- **Severity:** **Low** for the product, real for the loop
- **Actual:** `workers` defaulted to **2** and nothing stopped the run early, so a failure in an early file still cost the full ~6 minutes, and a failure in a late one cost the same before it was even visible
- **Fix:** `workers` defaults to **4**, which was measured safe on 2026-09-10 (263 passed at 4.4m against 8.5m at two, with the Realtime rate limit firing 25 times and failing nothing), and `maxFailures` defaults to **1** so a local run stops at the first failure. `reporter` is pinned to `line` rather than the default `list`, which prints a line per test
- **CI keeps the full picture:** `FOOS_PW_MAX_FAILURES: '0'` in `ci.yml`, because one failure per run is one round trip per defect, and that is what made the 2026-09-11 CI sequence take four pushes
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-056: a local default silently raised CI to four Playwright workers, and CI went from 1 failure to 16

- **Found:** 2026-09-11, by Klent: *"got another error in the fucking ci"*
- **Module:** `tests/playwright.config.ts`, `.github/workflows/ci.yml`
- **Severity:** **High** for the loop. No product defect, and it cost a whole CI cycle plus the time to read it
- **Actual:** QA-055 changed `workers` to `Number(process.env.FOOS_PW_WORKERS ?? 4)`. **`ci.yml` never set that variable**, so the default was the value CI used, and CI went from 2 workers to 4 on a 2-vCPU runner
- **The runs say it plainly:** 34553317947 failed 1 and 2, 34555711852 failed 2, 34556895461 failed 1, 34558935229 failed 1. The first run after the change, 34566074636, failed **12 on one shard and 4 on the other**, with `page.goto: Test timeout`, `Target page, context or browser has been closed` and `locator.innerText: Test timeout`. That is a starved runner, not sixteen new defects
- **The warning was already written down, twice.** CLAUDE.md's test-caveat list says "Do not raise it in CI: `ubuntu-latest` on a private repo is 2 vCPU against this machine's 10", and the `integration` job in `ci.yml` carries the same sentence in a comment directly above the step. I read neither before changing the default
- **Fix:** `FOOS_PW_WORKERS: '2'` set explicitly in `ci.yml`, so no local default can move CI again. The lesson is narrower than "read the docs": **a shared config's default is a production value.** Changing a default changes every environment that does not override it, and the ones that do not override are exactly the ones nobody is thinking about
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-057: the browser suite gated every pull request during a redesign, so it measured assertion churn

- **Found:** 2026-09-11, by Klent: *"i don't understand why we're doing browser tests in github. is this even a standard? what is this testing? we have a couple more pages to update. obviously it will have an error."*
- **Module:** `.github/workflows/ci.yml`
- **Severity:** **Medium** as a process defect
- **He is right about the shape.** 339 browser specs on every push is not the common split. The usual one is lint, typecheck, build and unit/API tests per push, with end-to-end runs before a merge, nightly, or on demand. During a UI redesign these specs assert the interface **as it was before the change under review**, so every push turns red and the fix for each failure is to rewrite the assertion to match a decision made minutes earlier. Over 2026-09-11 that pattern cost five CI cycles at 14 minutes each
- **What the suite is still worth:** it found two real defects nobody would have found by looking, the breadcrumb contrast failure (QA-029) and `aria-hidden-focus` on the closed bulk bar (QA-053). That value does not have to be paid on every push
- **Proposed fix, and Klent rejected it:** gating `integration` off the pull-request trigger. *"why can't we enable integration and just make it fucking work? is that really that hard?"* He was right to push back. It was not hard: fifteen of the sixteen failures were the single worker-count regression in QA-056, and the sixteenth was already fixed in `a1c3633`. Removing the gate would have hidden a problem that took one line to solve
- **Actual fix:** `FOOS_PW_WORKERS: '2'` pinned in CI, `workflow_dispatch` kept as an extra trigger, and the pull-request trigger left in place. Then both shards run locally under CI's exact settings to prove it: `172 passed (5.0m)` and `167 passed (5.0m)`, 339 in total, plus `269 passed` from vitest
- **What actually keeps it green** is a discipline rather than a trigger: a UI change and the spec asserting the old UI belong in the **same edit**. Every red run on 2026-09-11 was either that regression or a spec still describing a decision reversed minutes earlier
- **Status:** Closed, by fixing rather than by disabling
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-058: a spec was written against sample data that was then deleted

- **Found:** 2026-09-11, running the suite at CI's settings after re-enabling `integration`
- **Module:** `tests/e2e/intake-list.spec.ts`
- **Severity:** **Medium.** Six of fifteen tests failed, and they would have failed on CI from the moment they were written
- **Actual:** the spec was built against the 130 demo intake rows seeded so Klent could see the page. Removing those rows as sample data left the queue with one `imported` item, which the default filter hides, so the list was empty: I4 found no Target column, I9 no nav badge, I11/I12/I13 no row to open, I14 nothing to suggest
- **This is QA-049 again, self-inflicted.** The rule was already written down after the C7/Q10/Q14 failures: a test may not assume a row it did not create. Seeded demo data is not an exception
- **Fix:** `beforeAll` inserts three intake items across three channels, two target types and two statuses under a run-unique `batch_label`, and `afterAll` deletes by that label. `intake_items` has no `is_test` column, which is why the label is the marker. I14 now searches for its own seeded name instead of reading whatever row happened to be first
- **Evidence:** `15 passed (42.9s)` for the spec, then both full shards green
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-059: four motion assertions read a sampled frame, and three of them only fail on a slow runner

- **Found:** 2026-09-11, CI run 34569689398, then by auditing every spec touched that day after Klent asked *"have you been reviewing your fucking test cases?"*
- **Module:** `tests/e2e/bulk-actions.spec.ts`, `interaction-motion.spec.ts`, `intake-list.spec.ts`
- **Severity:** **High** for the loop. Five CI cycles at about 14 minutes each went to this class
- **The class:** an assertion that reads an intermediate animation value. On this machine `requestAnimationFrame` fires every 16ms and catches eight frames of a 140ms fade; on CI, 2 vCPU with two Chromium workers, the whole fade can complete **between two samples**. A local pass proves nothing, which is why running both shards locally and then failing in CI happened twice
- **The four sites:** `bulk-actions` counted frames with opacity between 0.02 and 0.98 (`Expected: > 2 / Received: 0`); `interaction-motion:233` read a closing overlay's opacity and asserted it above zero, which is the **same pattern I had fixed at line 308 that morning without checking whether it appeared twice** — it did, and it failed in the same run; `intake-list` I9 counted distinct box-shadows over three seconds; I13 counted transform frames while the drawer closed
- **Fix:** every one now asserts the **declaration** — `transitionProperty`, `transitionDuration`, `transitionDelay`, `animationName`, `animationIterationCount`. Those are identical on any machine and still express the contract: the fade exists and is staggered behind the height reveal, the badge beats forever without scaling the number, the drawer leaves by its own keyframe. `grep -rn "opacity).toBeGreaterThan" tests/e2e` now returns nothing
- **The rule already existed** in CLAUDE.md, written that same morning after C11 and R7 failed this way. I then wrote three new violations of it. Writing a rule down is not the same as applying it to the code in front of you
- **A fifth site, found only by CI run 34573009783:** `interaction-motion` had **four** places reading `mounted: !!el` immediately after the click that dismisses the element, and converting the opacity half of three of them left that half in place. On a slow runner the exit completes before the round trip lands, so `Received: false`. The pattern is now gone entirely: `watchExit()` installs a `MutationObserver` on `data-closing` **before** the click and `exitSeen()` reads what it recorded **after** the element is gone. That asks the DOM what happened rather than sampling what is true now, so no machine speed can hide it. `grep -rn "mounted: !!el" tests/e2e` returns nothing
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-060: two of the day's new tests could not run, or could not pass, on CI's data

- **Found:** 2026-09-11, auditing every spec touched that day before pushing
- **Module:** `tests/e2e/select-combobox.spec.ts`, `tests/e2e/scroll-reset.spec.ts`
- **Severity:** **Medium.** One was a silent skip, which is worse than a failure because it reports green
- **The hover test skipped on CI.** The test proving the option list no longer scrolls under the cursor began `test.skip(!scrollable, 'this lookup is short enough not to scroll')`. CI's Company lookup holds five seeded companies and never overflows, so the test guarding that fix **never ran on the only machine that reports to Klent**. It now seeds 24 `is_test` companies in `beforeAll`, asserts the list actually overflows rather than skipping, and deletes them by name prefix
- **Two scroll tests assumed a page taller than the viewport.** S1 scrolled the candidate list to 600px and required the offset above 100; on seed data that list is about 550px tall in a 720px viewport and cannot scroll at all. S3 scrolled a record page to a fixed 400px, and a record with every accordion collapsed has roughly 95px of range, so the clamp would have failed the same assertion. S1 now seeds 24 candidates and asserts the scroller has range before using it; S2 and S3 scroll to the bottom and assert against what that turned out to be
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

---

### QA-061: adding tests re-sharded the suite and broke a test that shares a persona row

- **Found:** 2026-09-11, running shard 2 at CI's settings after the fixes above
- **Module:** `tests/e2e/record-ui.spec.ts`
- **Severity:** **Medium**
- **Actual:** `2.10 the Recently Viewed rail records opens across modules, newest first` passed alone and had passed in shard 2 an hour earlier. Adding tests to `scroll-reset` and `select-combobox` moved the `--shard` boundary, because the split is by test count, so `record-ui` ran beside different files. One of those signs in as the same `recruiter` persona and opens records, and the rail is a single `integration_settings` row per staff, so the neighbour's opens evicted one of the two records this test measures and `indexOf` returned -1
- **Fix:** `beforeEach` seeds `{ items: [], limit: 50 }` for that persona, so the window is large enough that a neighbour cannot push either record out. The failure message now says so
- **The general point:** `--shard` is not a stable partition. Adding a test anywhere changes which files run concurrently, so a test that depends on being alone in a shared row is a time bomb rather than a passing test
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-11

### QA-062: the intake table sorted only the page you were looking at

- **Found:** 2026-09-14, wiring saved views into `/intake`
- **Module:** `app/src/modules/intake/QueueListPage.tsx`
- **Severity:** **Medium**
- **Actual:** the queue passed `pager.pageRows` to an uncontrolled `Table`, and `Table` sorts whatever array it is handed. Clicking `Batch` therefore reordered the twenty rows on screen and nothing else, so the first row after sorting was the first of that page, not the first of the queue. Every other list in the product sorts in Postgres over the whole set, so the header read as if it did the same thing here
- **Fix:** the sort is lifted into the page, applied to the whole filtered array, and the page is taken after sorting. `Table` is now controlled, which also lets a saved view record the sort
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-063: deleting an account cascades to its requisitions, deals, contacts and history

- **Found:** 2026-09-14, building the bulk Delete on `/sales/companies`
- **Module:** `supabase/migrations`, `companies`
- **Severity:** **High**
- **Actual:** five foreign keys reference `companies` and four are `on delete cascade` — `requisitions.company_id`, `contact_profiles.company_id`, `deals.company_id` and `activities.company_id`; `tickets.company_id` is `on delete set null`. Confirmed by reading `pg_constraint.confdeltype`, which returns `c` for the four. `companies_write` is `for all` to admin and bd, so a single DELETE from either role silently removes every requisition and deal filed under that account. This is why no delete existed anywhere in the product
- **Fix:** not a schema change. The UI refuses instead: `CompanyDeleteDialog` counts dependents across all five tables before offering anything, deletes only accounts with none, and names what is holding each of the others. Verified against a seeded pair, one with a deal and one without: the bare one was deleted, the held one and its deal survived
- **The open half:** the cascade itself is untouched, so anything that writes `companies` outside this dialog still has the same reach. Either the four should become `on delete restrict`, or the delete should move behind a function that checks. That is a schema decision and is Klent's
- **Status:** Open
- **Fix owner:** Klent

### QA-064: the admin test login sat on John's staff id, so signing in as it signed you in as John

- **Found:** 2026-09-14, standardising the test-account passwords
- **Module:** `supabase/seed.sql`, `tests/fixtures/personas.sql`
- **Severity:** **High**
- **Actual:** `seed.sql` had no admin staff row other than `john@ventvest.com` at `a0000000-0000-4000-8000-000000000001`. Rita, Sam and Ben each got their own row, but the admin persona had none, so `personas.sql:32` created the `demo-admin@ventvest.test` **auth.users** row on John's id to borrow his admin role. Three consequences. Signing in as the admin persona was signing in as John Buena, and every audit row, activity and `created_by` written during a test session was attributed to him. `john@ventvest.com` could not sign in with a password at all, because the auth row on his id carried the persona's email. And on the live project that id holds John's **real Google identity**, so running `personas.sql` against it would have overwritten a real person's login
- **Fix:** the demo admin has its own staff row and its own id, `a0000000-0000-4000-8000-000000000005`. `personas.sql` points at that id, `seed.sql` seeds the row, and `STAFF_IDS.admin` in `tests/fixtures/seed-ids.ts` now means the admin persona rather than John, with `STAFF_IDS.john` added for his id. Verified locally: all eight test accounts sign in and `get_my_role()` returns admin, admin, recruiter, sourcer, bd, recruiter, sourcer, bd; John's id now carries no auth user at all
- **Why it was never noticed:** `STAFF_IDS.admin` was imported by exactly one test and only `STAFF_IDS.recruiter` was ever read from it, so nothing asserted who the admin persona actually was
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-065: the shared test password claimed to be local-only while being the live password

- **Found:** 2026-09-14
- **Module:** `tests/.env`, `tests/.env.example`
- **Severity:** **Low**
- **Actual:** `FOOS_QA_TEST_PASSWORD` was `local-dev-only-pw`. The same value is what `rita.demo`, `sam.demo` and `ben.demo` sign in with on the **live** project, so the string asserted something untrue about its own blast radius and invited someone to treat it as throwaway
- **Fix:** the value is `VentVest-Sandbox-2026`, and `tests/.env.example` carries the same, so a fresh clone starts on it rather than inventing a per-machine value that then drifts
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-066: rejecting an intake item was the only way out, so the queue could never be cleared

- **Found:** 2026-09-14, deciding which tables warrant a delete
- **Module:** `app/src/modules/intake/QueueListPage.tsx`
- **Severity:** **Low**
- **Actual:** `reject_intake_item` sets `status = 'rejected'` and the row stays in `intake_items` for good. A typo'd LinkedIn paste or a spreadsheet header row imported as a person had no exit, which is the reason the toolbar carries a "Show imported / rejected" checkbox in the first place. `intake_items_delete` had existed since the intake migration and nothing called it
- **Fix:** bulk delete in the queue, on the same grow-and-decay bulk bar as accounts and requisitions. Safe here in a way it is not elsewhere: `intake_items` has **zero inbound foreign keys**, so nothing cascades
- **The design point:** the client does not mirror the RLS predicate. It deletes with `.select('id')` and reports the difference between what was asked for and what came back, so the two lists cannot drift. Verified against the live policy: as `bd`, a two-row selection deleted the contact item and silently left the candidate one; as `admin`, the candidate went
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-067: CLAUDE.md and the carried findings said requisitions had no DELETE policy

- **Found:** 2026-09-14
- **Module:** `supabase/migrations/20260902000002_rls_initplan.sql`
- **Severity:** **Medium**
- **Actual:** carried finding S8 and the session notes both record "No DELETE policy on `requisitions`". `requisitions_write` is `for all to public using (get_my_role() = any (array['admin','recruiter']))`, and `for all` **includes DELETE**. So an admin or recruiter can delete a requisition today through PostgREST; only the absent UI stops them. Four tables cascade off `requisitions`, and `applications` is one, so such a delete removes every candidate submission against that role
- **Fix:** no code change, and deliberately no delete control. The correction is recorded here and in `CLAUDE.md`. The forward verb stays `status` → `closed` / `filled`
- **Status:** Open
- **Fix owner:** Klent, for the same call as QA-063: leave it, or narrow `requisitions_write` so DELETE is not implied

### QA-068: a superseded list load cleared the loading flag, flashing "no accounts" over real data

- **Found:** 2026-09-14, reported by Klent watching `/sales/companies` on a slow connection: "skeleton, then the no accounts message, then the response items"
- **Module:** `app/src/modules/sales/pages/CompaniesListPage.tsx`, and the same shape in `ContactsListPage.tsx`, `DealsListPage.tsx`, `TicketsListPage.tsx`
- **Severity:** **Medium**
- **Actual:** `load()` takes a token from `useLatestOnly()` and returns early when a newer load has started, so a stale response does not overwrite fresh rows. But the `finally` block ran `setLoading(false)` unconditionally, including for that stale load. The page then held `loading === false` with `total === 0`, which is indistinguishable from an empty list, so the empty state rendered until the current load landed. Two loads is the normal case, not an edge case: `StrictMode` double-invokes effects, and any filter or page change supersedes an in-flight read
- **Reproduced** with a 30-line simulation of `useLatestOnly` plus the try/finally: `before fix, empty state flashed after: [ 'slow-first' ]` / `after fix, empty state flashed after: []`
- **Fix:** `finally { if (isCurrent()) setLoading(false); }`, so a superseded load leaves the flag alone and the newer one owns it. The list also now tracks `loaded`, set only on a current completion, and the empty state is gated on it, so the first paint cannot show it either
- **Why it surfaced now:** the bug predates the empty state, but until 2026-09-14 an empty result rendered as a table with headers and "No companies match", which looks close enough to a loading table that nobody noticed. A designed empty state with an icon and a call to action made the same half-second obvious. `CandidateListPage`, `RequisitionListPage` and `ApplicationPipeline` already had the guard; the four sales pages never did
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-069: an account could be created but never edited

- **Found:** 2026-09-14, Klent asking why `/sales/companies/<id>` has no edit button
- **Module:** `app/src/modules/sales/pages/CompanyRecordPage.tsx`
- **Severity:** **High**
- **Actual:** counted across the whole app, `companies` had **one insert** (`CompanyNewPage`), **six selects** and **zero updates**. An account's name, type, website, phone, city, state, country and owner were write-once: a typo at creation, or a stale phone number carried in from Zoho, was permanent from inside the product. This is the same shape as QA-042 for `people`, and neither was an RLS problem: `companies_write` is `for all` to admin and bd, which includes UPDATE
- **Fix:** `CompanyEditDialog`, opened from an **Edit account** button in the record action bar, writing the same field set `CompanyNewPage` collects. Verified as `bd` over REST against a real imported account before the UI was built: `rows updated by bd: 1`, then the value was restored
- **The pattern worth noticing:** both of these were found by asking "what writes this table?" rather than by reading the page. `grep -c "\.update(" ` next to `from('<table>')` is a two-minute check and it has now turned up two write-once tables. `deals`, `tickets` and `intake_items` have not been checked
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-070: tickets can be listed but never created or edited

- **Found:** 2026-09-14, sweeping every table for the write-once pattern that produced QA-042 and QA-069
- **Module:** `app/src/modules/sales`
- **Severity:** **Medium**
- **Actual:** `from('tickets')` appears twice in the whole app, in `lib/searchHints.ts` and `GlobalSearchPage.tsx`, both selects. **Zero inserts and zero updates.** There is a `/sales/tickets` list, a nav entry and a `ticket_list` view, but no `tickets/new` route and no record page, so a ticket can only come from a direct database write. `tickets_write` permits admin and bd, so nothing in the database is stopping it
- **Fix:** none yet, and deliberately out of scope for the contacts pass. Recorded so it is not found a third time by accident
- **How all three were found:** counting `.insert(` and `.update(` next to `from('<table>')` across the app. `companies` and `people` both read `insert=1, update=0` before today. That two-minute check is now written into CLAUDE.md
- **Status:** Open
- **Fix owner:** Klent, to schedule alongside whatever the tickets module is meant to become

### QA-071: a CSS override kept losing to the rule it was overriding, four times in one session

- **Found:** 2026-09-14, repeatedly, while styling the edit dialogs
- **Module:** `app/src/styles/layers/*`
- **Severity:** **Low** in each instance, but it cost most of an afternoon
- **Actual:** four separate overrides were written into `controls.css` to modify rules that live in later layers, so every one of them was inert and the UI did not change. `.fo-dialog-panel-wide` and `.fo-dialog-panel-form` lost to `.fo-dialog-panel` in `taleo`; a `.record-section-header` override lost to `pages`; a `.rq-form` override lost to `module.recruit`. In one case the wide class had been silently doing nothing for hours, so every dialog marked `wide` was rendering at the base 420px
- **Fix:** each override moved into the layer that owns the rule it modifies. The deeper fix was structural: the requisition edit dialog now renders the same `FormSections` component as every other edit dialog, so there is nothing left to override
- **The rule, which was already written down:** `app.css` declares `base, shell, auth, controls, tables, pages, panels, narrow, taleo, states, pagination, motion, widgets, print, module.*`. Later wins, and **specificity does not enter into it**. Before writing an override, find the layer of the rule being overridden. A more specific selector in an earlier layer is not more specific, it is dead
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-072: the seed grew and three validate checks failed on an exact count

- **Found:** 2026-09-14, CI runs 34795621922 and 34801724859, all three jobs red
- **Module:** `supabase/tests/validate.sql`
- **Severity:** **Medium**
- **Actual:** `FAIL 9: companies count`, then `FAIL 12: recruiter cannot read deals`, then an `activities_company_id_fkey` violation in check 14. All three were consequences of this branch's own changes: one demo account was added to `seed.sql`, which took companies from 5 to 6 and deals from 2 to 3, and the `on delete restrict` migration made check 14's purge delete a company while its activities still referenced it
- **Fix:** counts became floors (`<` rather than `<>`), check 14 deletes dependents before the company, and the PASS line says the numbers are floors. Verified by rebuilding the schema the way CI does, shim plus 66 migrations plus seed into a scratch database, then running validate twice: **35 PASS, zero failures, both runs**
- **Why exact counts were wrong:** the file already argued this against itself. The staff check two lines above says *"Deliberately not an exact count: scripts/add-local-staff.sql exists so a developer can work under their own identity, and doing so must not fail validation."* That reasoning applies to every seeded table, and adding a demo row is not a regression
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14

### QA-073: four browser specs asserted styling that a static guard already checked

- **Found:** 2026-09-14, reviewing the suite at Klent's request
- **Module:** `tests/e2e`
- **Severity:** **Low**, but it was the largest single source of CI flakiness
- **Actual:** `interaction-motion` (11), `interaction-states` (3), `form-affordances` (8) and `scroll-shadow` (5) asserted computed transitions, hover colours, control padding and fade geometry. **27 tests, about 944 lines**, none touching the database, all duplicating `check-motion`, `check-contrast`, `check-control-heights` and `check-design-tokens`, which run statically in under a second. `interaction-motion` alone caused two red CI runs this session (C11 and R7) by sampling a mid-animation frame, the exact failure the CI runbook was written about
- **Fix:** deleted. The suite goes from 79 files and 339 tests to **75 files and 312 tests**
- **The line worth keeping:** a browser test earns its cost when it asserts behaviour a static check cannot see. Cross-user RLS, whether a list pages in the database rather than the browser, and axe, all qualify. "The CSS is applied" does not
- **Status:** Closed
- **Fix owner:** Claude
- **Closed:** 2026-09-14
