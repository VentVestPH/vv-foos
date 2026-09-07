# Goal 1: functional coverage, per page and per role

**Project:** VV-FOOS · **Date:** 2026-09-04 · v1.0 Draft

Discovery only. **No file under `app/src` was changed.** Goals 2 and 3 decide and build from this.

Three non-product files did change, because the work turned them up and the rule is to fix rather than skip: `knip.json` and `tests/audit/capture.ts` to repair a gate check that had been failing since workstream V, and a new probe spec. All three are described below.

Closes the gap workstream V left: every V capture spec signed in as `admin` and only `pass3-use.spec.ts` used `recruiter`, so **`sourcer` and `bd` had never been swept**.

## Method, and one deliberate departure from the goal

The goal said to re-run `sweep.spec.ts` per persona. **I did not**, and the reason is arithmetic: that sweep is 16,879 captures for one role, so four roles is roughly 67,000 captures over many hours, and it answers a question this matrix does not ask. The matrix needs **enumeration per role**, not per-control state captures.

So `tests/audit/role-matrix.spec.ts` navigates all 31 routes at both viewports as each of the four personas and records, per screen: the final path after any redirect, the `h1`, which primary-nav tabs render, every visible control with its name, kind and disabled state, visible table rows, empty-state text, on-screen error text, console errors and uncaught page errors, plus one screenshot. **248 rows in 6 minutes** rather than eight hours.

Route ids come from `resolveIds()`, which resolves as `admin`, so **every role visits the identical URL**. That is the point: otherwise I would be comparing different pages rather than different roles.

Enumeration cannot answer a question about behaviour, so three targeted probes do. `tests/audit/pipeline-dead-controls.spec.ts` drives one requisition as a sourcer on desktop and as an admin on a phone, clicking and dragging for real and printing what changed, because "this control does nothing" is not a claim any inventory can support. `tests/audit/candidate-record-400s.spec.ts` records every response over `400` on the candidate record. `tests/audit/dashboard-funnel-zero.spec.ts` prints the row count of the funnel response beside the numbers the bars actually render, which is what separated **a query returning nothing** from **a query returning 102 rows that the page then discards**. Each logs a timestamped line per step; that is the only reason the two ten-minute hangs described below were diagnosable at all.

**Three of the six findings came from these probes rather than from the matrix**, which is the methodological point: a per-route inventory finds missing and extra controls, and finds nothing about whether the ones present do their job.

Row visibility and write permission are measured against Postgres directly, impersonating each role with `set_config('request.jwt.claims', …)` and `set local role authenticated` inside a transaction that is **rolled back**, so what RLS permits is proven without persisting anything.

## The matrix, desktop

`Nc/Mr` is N visible controls and M visible table rows. `→/` is a redirect to `/` by the route guard.

| Route | admin | recruiter | sourcer | bd |
| :---- | :---- | :---- | :---- | :---- |
| dashboard-my-view | 50c/5r | 53c/5r | 45c/5r | 51c/5r |
| dashboard-pipeline | 40c/0r | 38c/0r | 34c/0r | 36c/0r |
| dashboard-reports | 47c/0r | 45c/0r | 41c/0r | 43c/0r |
| global-search | 33c/0r | 32c/0r | 28c/0r | 30c/0r |
| recruit-candidates | 177c/20r | 176c/20r | **62c/3r** | **→/** |
| recruit-candidate-record | 106c/0r | 101c/0r | **26c/0r** | **→/** |
| recruit-requisitions | 109c/20r | 108c/20r | 78c/20r | **→/** |
| recruit-requisition-new | 69c/0r | 68c/0r | 24c/0r | **→/** |
| recruit-requisition-record | 156c/21r | 155c/21r | **48c/0r** | **→/** |
| recruit-requisition-edit | 70c/0r | 69c/0r | 25c/0r | **→/** |
| sales-companies | 65c/20r | 63c/20r | **→/** | 60c/20r |
| sales-company-new | 45c/0r | 44c/0r | **→/** | 40c/0r |
| sales-company-record | 49c/3r | 48c/3r | **→/** | 43c/2r |
| sales-contacts | 69c/20r | 67c/20r | **→/** | 64c/20r |
| sales-contact-new | 46c/0r | 45c/0r | **→/** | 41c/0r |
| sales-contact-record | 54c/0r | 52c/0r | **→/** | 49c/0r |
| sales-deals | 41c/0r | 39c/0r | **→/** | 36c/0r |
| sales-deal-new | 45c/0r | 44c/0r | **→/** | 40c/0r |
| sales-deal-record | 60c/0r | 58c/0r | **→/** | 55c/0r |
| sales-tickets | 37c/0r | 36c/0r | **→/** | 32c/0r |
| sales-promote | 36c/0r | 35c/0r | **→/** | 31c/0r |
| intake-queue | 44c/0r | 43c/0r | 35c/0r | 39c/0r |
| intake-linkedin | 44c/0r | 43c/0r | 35c/0r | 39c/0r |
| intake-sheet | 38c/0r | 37c/0r | 29c/0r | 33c/0r |
| not-found | NOT-FOUND | NOT-FOUND | NOT-FOUND | NOT-FOUND |
| not-found-intake | 34c/0r | 33c/0r | 25c/0r | 29c/0r |
| settings | 50c/6r | 43c/0r | 31c/0r | 35c/0r |
| placeholder-employees | 45c/0r | 44c/0r | 36c/0r | 40c/0r |
| placeholder-onboard | 41c/0r | 40c/0r | 32c/0r | 36c/0r |
| placeholder-users | 42c/0r | **→/** | **→/** | **→/** |
| placeholder-courses | 40c/0r | 39c/0r | 31c/0r | 35c/0r |

| Role | Rows | Redirects | Controls, desktop | Controls, mobile | Nav tabs | Page errors | On-screen errors |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| admin | 62 | 0 | 1,818 | 1,400 | 14 | **0** | **0** |
| recruiter | 62 | 1 | 1,791 | 1,373 | 13 | **0** | **0** |
| sourcer | 62 | 12 | 1,244 | 1,066 | 9 | **0** | **0** |
| bd | 62 | 7 | 1,328 | 1,147 | 11 | **0** | **0** |

## The mobile half

**Access control is identical at 390x844.** Same 20 redirects, route for route, with an empty set difference against desktop for all four roles; same nav-tab counts; same zero page errors and zero on-screen errors. So nothing in the guard layer is viewport-dependent, and the redirect column above is one number rather than two.

What changes is only how much is offered: **admin drops 1,818 controls to 1,400, recruiter 1,791 to 1,373, sourcer 1,244 to 1,066, bd 1,328 to 1,147.** That is `useIsMobile` doing what V6 already recorded, and the decision about it is parked as **P4**. One consequence of it is a finding, G1-2.

## Findings

Ordered by severity, not by number. The numbers are stable references.

| | Finding | Severity | Roles affected |
| :---- | :---- | :---- | :---- |
| **G1-4** | The Pipeline dashboard's ATS funnel is blind to **99.0%** of applications and reads zero | **Blocks** | all four |
| **G1-5** | Four requests per candidate-record load fail with `400`, silently | **Costs** | admin, recruiter, sourcer |
| G1-2 | On a phone the shortlist star is live and does nothing | Costs | admin, recruiter |
| G1-1 | A sourcer's pipeline is empty on 690 of 690 requisitions | Costs | sourcer |
| G1-6 | Two `dash` materialized views are granted to every role with no row filter | Costs, latent | all four |
| G1-3 | Two different 404 screens, neither offering a way out | Cosmetic | all four |


### G1-1. A sourcer can open any of 690 requisitions and the pipeline is all but empty, and the mechanism is a join rather than a policy

**Severity: Costs.** Measured against Postgres per role:

| | admin | recruiter | sourcer | bd |
| :---- | ----: | ----: | ----: | ----: |
| `applications` **table** | 86,133 | 86,133 | **86,133** | 0 |
| `application_pipeline` **view** | 86,133 | 86,133 | **4** | 0 |
| `candidate_list` view | 72,917 | 72,917 | **3** | 0 |
| `requisition_list` view | 690 | 690 | **690** | 0 |

A sourcer is permitted **every one of the 86,133 applications** at the table level, and sees **all 690 requisitions**. But `application_pipeline` returns them **4 rows in the entire product**, because the view joins through candidate rows and `candidate_profiles` admits a sourcer only **3 of 72,917**. The permission is there and the join removes it.

So the screen a sourcer would use to work a requisition's candidates is empty on 690 of 690 requisitions. It is not a defect in the policies, which are consistent, and **the views are correctly built**: all eight carry `security_invoker = on`, so they run as the caller and RLS applies rather than being bypassed. Whether a sourcer *should* see other sourcers' candidates is a product decision, and it belongs to Goal 2 rather than here.

### G1-2. On a phone, the shortlist star is live for admin and recruiter and does nothing

**Severity: Costs**, and it is the sharpest thing in this goal.

`RequisitionRecordPage.tsx:139` defines `canEdit = (role === 'admin' || role === 'recruiter') && !mobile`, and `ApplicationPipeline.tsx` guards three handlers on it: `moveStage` at 276, `toggleShortlist` at 333, `setRank` at 346, each opening `if (!canEdit) return;`.

Six controls sit behind that flag. **Four are correctly withdrawn when it is false and two are not:**

| Control | Line | Withdrawn when `!canEdit`? |
| :---- | ----: | :---- |
| next-step input | 405 | **yes**, conditionally rendered |
| rank input | 444 | **yes**, conditionally rendered |
| `Add candidate` | 533 | **yes**, `{canEdit && ...}` |
| Kanban view toggle | 549 | **yes**, but on `!mobile`, not `canEdit` |
| **shortlist star, table** | **424** | **no**, no `disabled`, no `aria-disabled` |
| **shortlist star, Kanban card** | **496** | **no**, no `disabled`, no `aria-disabled` |

Measured on the same requisition, from the corpus rather than inferred:

| | rows | shortlist stars | of those disabled | Kanban toggle | `Add candidate` |
| :---- | ----: | ----: | ----: | ----: | ----: |
| admin, desktop | 21 | 21 | 0 | 2 | 1 |
| **admin, mobile** | **21** | **21** | **0** | **0** | **0** |
| **recruiter, mobile** | **21** | **21** | **0** | **0** | **0** |
| sourcer, desktop | 0 | 0 | 0 | 2 | 0 |

So on a phone the mobile gate correctly removes `Add candidate` and the view toggle, and **leaves 21 shortlist stars that look live and do nothing.** No `disabled` attribute, no `aria-disabled`, no message, and the cursor still reads `pointer`. This reaches **admin and recruiter**, the two roles that actually run the ATS.

**RLS is not what stops it, which is the important part.** The database permits `applications.is_shortlisted` for both roles regardless of viewport, so the restriction is entirely a UI decision with no counterpart underneath. Nothing is refused; nothing is written; nothing is said.

**I first wrote this as a sourcer defect and that was wrong.** A sourcer has **0 rows** on this record, so there are no stars to click and no cards to drag. `showKanban = view === 'kanban' && !mobile` at line 523 also means **the Kanban board never renders on a phone at all**, so my claim that any role could drag a card on mobile was wrong twice over. The Kanban no-op drag survives only in one narrow case: a sourcer on **desktop**, on the **2 of 690** requisitions where they have visible candidates (3 cards on one, 1 on the other, measured per role against `application_pipeline`). `KanbanBoard.tsx` takes no `canEdit` prop and calls `useDraggable` unconditionally, so those cards are draggable into a handler that returns immediately.

**Both halves are confirmed by a live run**, not by reading the source. `tests/audit/pipeline-dead-controls.spec.ts` drives requisition `d0000000-...-0001`, which is a smaller one than the matrix sampled (4 applications rather than 21, and 3 of them visible to a sourcer), and prints:

```
PROBE sourcer     cards=3 stars=3 starsDisabled=0
                  before=0/0/0/0/2/1/0/0/0/0/0  after=0/0/0/0/2/1/0/0/0/0/0  alerts=0
PROBE adminMobile stars=4 starsDisabled=0 cursor=pointer
                  labelBefore="Add to shortlist" labelAfter="Add to shortlist"
                  classBefore="shortlist-btn"    classAfter="shortlist-btn"
                  kanbanToggle=0 addCandidate=0  alerts=0
```

The sourcer's drag runs to completion and the eleven per-stage card counts are **identical before and after**, with no alert, toast or error. On mobile the star reports **`cursor: pointer`**, and after a real click its `aria-label` and its class are both unchanged. So the control positively advertises itself as clickable and then does nothing observable at all: the pointer cursor is the part that makes it a defect rather than merely inert, and it is the inverse of the cursor request in workstream W.

This is the concrete case behind **P4**, the parked question of whether the ATS is meant to be read-only on a phone. Whichever way that goes, the two stars should not render live, and `DataExportCard.tsx:77` is the in-repo pattern for saying why.

### G1-3. Two different 404 screens, neither offering a way out

**Severity: Cosmetic**, and identical for all four roles.

`App.tsx:130` renders `<h1>Page not found</h1>`; `modules/intake/index.tsx:14` renders `<h1>Not found in Intake</h1>`. Both are the same shape, a bare `h1` inside `div.stub-panel`, so the difference is only the wording, and my matrix flagged the intake one as "not found = false" purely because the probe tested for the string `page not found`. **That was my instrument, not the product.**

The finding that survives is what they share: **neither stub contains a link, a button or any route back**, so the only recovery is the browser's back button or the primary nav. Two wordings for one condition is the cosmetic half; no recovery affordance on either is the part worth fixing.

### G1-4. The Pipeline dashboard reports zero in every ATS stage while holding 86,125 applications

**Severity: Blocks.** This is the most consequential thing in the goal and it affects **every role, including admin.**

`app/src/lib/database.types.ts:1137` holds the canonical locked stage list, **eleven** values:

```
talent_pool, outreach, associated, received, screening, phone_screen,
submitted, client_interview, offer, hired, rejected
```

`app/src/modules/dashboards/lib.ts:185` holds a **second, private copy** called `APPLICATION_STAGE_ORDER` with only **eight**, missing the **first three**: `talent_pool`, `outreach`, `associated`. `PipelineByStage.tsx:46` then calls `countBy(ats, (r) => r.stage, APPLICATION_STAGE_ORDER)`, and `countBy` (`lib.ts:171-183`) builds its output by mapping over the **order array**, so any stage absent from that array is silently dropped rather than appended.

**99.0% of the funnel sits in the three dropped stages:**

| | rows | share |
| :---- | ----: | ----: |
| in the three omitted stages | **85,274** | **99.0%** |
| in the eight counted stages | 851 | 1.0% |
| `dash.vw_ats_funnel` total | 86,125 | |

In the default "Last 30 days" window the effect is total. The request succeeds and returns data, and the screen still reads zero:

```
REQ 200 rows=102 /rest/v1/vw_ats_funnel?select=*&applied_at=gte.2026-08-08&applied_at=lte.2026-09-07T23:59:59
BARS Received|0 Screening|0 Phone Screen|0 Submitted|0 Client Interview|0 Offer|0 Hired|0 Rejected|0
```

All 102 of those rows are `talent_pool` (95), `outreach` (6) and `associated` (1), so every one is discarded. **The dashboard is not failing to load; it is loading 102 records and reporting 0.**

**Cause, and it is dated.** `supabase/migrations/20260903000007_application_stages_from_zoho.sql` and `20260903000008_application_status_new_stages.sql` added the three stages on 2026-09-03 for the Zoho import. `database.types.ts` was updated to all eleven, as the locked-list rule in `CLAUDE.md` requires. The dashboards module's private copy was not. The second migration's own header even records the volume it was introducing (`With 83,022 talent_pool rows`), so the size was known at the time.

**Blast radius is one call site.** `APPLICATION_STAGE_ORDER` is used only at `PipelineByStage.tsx:46`. `SourceEffectiveness.tsx:29` reads the same view but does not use the array, so it is unaffected by this. `DEAL_STAGE_ORDER` in the same file is **correct**, matching all six of `DEAL_STAGES`.

**Workstream V looked straight at this screen and did not see it.** `Audit_V13-Density` measured `dashboard-pipeline` at 47.3% empty with a 61px largest gap, and `Audit_V6-Audit-Table` row 33 recorded that it skips from `h1` to `h3`. So the screen was photographed at two viewports, measured for whitespace and audited for heading semantics, and **nobody checked whether the numbers on it were true**. That is the honest reason a Blocks-severity defect survived 16,879 captures: the entire audit was pointed at appearance and structure, and a screen full of confident zeros looks perfectly well-built. It is also the argument for this goal existing.

**FIXED 2026-09-07.** `dashboards/lib.ts` no longer carries a private copy: both `APPLICATION_STAGE_ORDER` and `DEAL_STAGE_ORDER` are deleted and `PipelineByStage.tsx` imports the canonical `APPLICATION_STAGES` and `DEAL_STAGES` from `lib/database.types`, so the list cannot drift again. Verified in the browser, not by reading the diff:

```
REQ  200 rows=102 /rest/v1/vw_ats_funnel?applied_at=gte.2026-08-08&applied_at=lte.2026-09-07T23:59:59
BARS Talent Pool|95  Outreach|6  Associated|1  Received|0  Screening|0  Phone Screen|0
     Submitted|0  Client Interview|0  Offer|0  Hired|0  Rejected|0
```

95 + 6 + 1 = 102, which is exactly the row count the request returned, and the funnel now renders all eleven stages instead of eight.

**Two things make this Blocks rather than Costs.** It reports a confident, precise falsehood rather than an error or a blank, so nothing prompts the reader to doubt it; and it is the landing screen of a nav tab available to all four roles. Someone reading it concludes the company has no pipeline at all.

### G1-5. The candidate record fires four requests per load that fail with `400`, and nothing shows it

**Severity: Costs.** Reproducible on every load, at both viewports, for **admin, recruiter and sourcer** (`bd` is redirected from the route).

The role matrix recorded **16 console errors for each of those three roles and 0 for `bd`**, all on `recruit-candidate-record`, 8 per load. A network capture gives the cause:

```
400 GET /rest/v1/reminders?select=*&related_type=eq.application&related_id=eq.&order=remind_at.asc
400 GET /rest/v1/tasks?select=*&related_type=eq.application&related_id=eq.
400 GET /rest/v1/attachments?select=*&parent_type=eq.application&parent_id=eq.&order=uploaded_at.desc
400 GET /rest/v1/activities?select=*&application_id=eq.&order=occurred_at.desc
{"code":"22P02","details":null,"hint":null,"message":"invalid input syntax for type uuid: \"\""}
```

Note `related_id=eq.` with **no value**. `CandidateRecordPage.tsx:62-63` reads `viewedApplicationId = params.get('application')` and then calls `useEngagement('application', viewedApplicationId ?? '')`, so with no `?application=` in the URL an **empty string** is passed as a uuid. `useEngagement` (`engagement.tsx:29`) has no guard: its `refresh` runs four queries and its `useEffect` at line 81 invokes it unconditionally.

**The page already knows the id may be absent.** Line 743 guards the *rendering* with `{viewedApplicationId && ...}`, so the panels correctly do not appear. The guard is on the render and not on the fetch, and because a React hook cannot be called conditionally the fix belongs inside `useEngagement`.

**Four queries, not eight.** `main.tsx:11` wraps the app in `<StrictMode>`, which double-invokes effects in development, so 8 is the dev figure and 4 is the defect.

**Why no audit caught it before.** There is no on-screen error and no uncaught exception, so both of the signals I checked first were clean. It is visible only in the console and the network log.

### G1-6. Two `dash` materialized views are readable by every role with no row filter

**Severity: Costs, and latent.** Nothing leaks today. The access path is ungated by construction, so it will leak as soon as the views hold data.

Materialized views cannot carry RLS in Postgres, so a matview's only protections are the grant and whatever wrapper reads it. `dash` holds three, and FOOS protects one of them correctly and two not at all:

| Object | `relrowsecurity` | `SELECT` to `authenticated` | Rows now | Reached through |
| :---- | :---- | :---- | ----: | :---- |
| `mv_success_metrics` | f | **no** | 32 | `vw_success_metrics`, `security_invoker = off`, `WHERE get_my_role() = 'admin'` |
| **`mv_staff_stage_advances`** | f | **yes** | 0 | nothing; directly readable |
| **`mv_stage_durations`** | f | **yes** | 0 | nothing; directly readable |

`dash` is exposed to the Data API (it must be, or every dashboard query returns `PGRST106`, recorded as defect QA-001) and the frontend already holds a client scoped to it, `dashDb`. So any signed-in user of any role can read both views in full, and the only reason that is currently harmless is that both hold **0 rows**, confirmed at owner level. Both report `relispopulated = true`, so they are refreshed and genuinely empty rather than never built.

**`vw_success_metrics` is the pattern done right, and `security_invoker = off` is correct there, not an oversight.** A definer view is the only way to gate a matview: an invoker view would require the caller to hold `SELECT` on the matview itself, which is exactly the hole the other two have. Measured end to end, it works: `vw_success_metrics` returns **32 rows for admin and 0 for recruiter, sourcer and bd**, and the `Experiment Metrics` accordion appears on the admin dashboard and on no other role's.

So this is workstream V's recurring shape again, a mechanism built correctly and applied at one of three call sites. The difference is that here the call sites are a security boundary rather than a UI affordance.

## Checked and found correct

Recorded because two of the four classes the goal told me to hunt came back clean, and a clean result is a result rather than an absence of work. **Class 1 is clean apart from G1-2 and class 2 is clean outright; class 3 and class 4 both produced findings.**

**Class 2, route guards, is clean.** 20 redirects, every one correct: `bd` is refused all six `recruit` routes, `sourcer` all eleven `sales` routes, and every non-admin `placeholder-users`. **No route was reachable by a role that should not have it, and none was blocked for a role that should.**

**Nav filtering agrees with the route guards.** admin 14 tabs, recruiter 13 (no Users), sourcer 9 (no Accounts, Contacts, Deals, Tickets, Users), bd 11 (no Requisitions, Candidates, Users). Every missing tab corresponds to a route that role is redirected from, so `navConfig.ts` and `App.tsx` do not disagree anywhere.

**The one place a non-admin sees more than an admin is owned data, not permission.** `dashboard-my-view` reports recruiter 53 controls and bd 51 against admin's 50, which looks backwards. It is not: the difference is entirely each persona's own reminder rows, two apiece, each contributing a link plus a `Complete` and a `Dismiss` button, against the admin's three extra nav tabs. So the dashboard's control count tracks how much work is assigned to the signed-in user. **Treat that column as data-dependent on this route** and nowhere else; every other route's differences are permission.

**`settings` explains its own role restriction, and it is the only screen that does.** `DataExportCard.tsx:77` returns `Exporting data is restricted to administrators.` for every non-admin, which is why the export table renders 6 rows and 6 `Export CSV` buttons for admin and 0 of each for the other three. I first recorded this as a finding on the strength of the row-count difference alone; reading the file refuted it. It is worth more than an acquittal: **W8 needs exactly this pattern for the mobile case in G1-2, and it already exists here to copy.**

**Class 4 is not clean, and my first pass said it was.** Zero uncaught page errors and zero on-screen error messages across all 248 rows is true, and it is the wrong test. The same run recorded **48 console errors**, 16 each for admin, recruiter and sourcer and 0 for bd, and every one is G1-5. I reported "class 4 clean" from the two columns I had looked at while a third column in the same JSON held the defect. **A silent 400 is exactly the failure that neither an on-screen message nor an uncaught exception can catch**, which is the reason to collect all three.

**The CRM funnel's zero is correct.** `vw_crm_funnel` returns 0 rows for every role including admin, and the `$0` open and won figures on the dashboard are right: it ends `WHERE NOT d.is_test AND NOT c.is_test`, and both deals on this stack are `is_test = true`. `vw_ats_funnel` carries the same filter and still returns 86,125, because the migrated Zoho applications are real data. So the two halves of that widget are zero for two entirely different reasons, one correct and one G1-4.

**`Experiment Metrics` is correctly admin-only**, in the database and on the screen. It is the one dashboard section that appears for admin and for no other role, which matches `vw_success_metrics` returning 32 rows to admin and 0 to the rest.

**The deals list's `0r` is my instrument, not an empty screen.** `DealsListPage.tsx:68` defaults to `view = 'kanban'`, so the page renders cards and no `tbody`, and the 2 deals visible to admin, recruiter and bd were on screen as Kanban cards while my column recorded 0. See the limitation note below.

**The views are built correctly, and there are eight of them rather than seven.** `application_pipeline`, `application_stage_summary`, `candidate_list`, `company_list`, `contact_list`, `deal_list`, `requisition_list` and `ticket_list` all carry `security_invoker = on`, queried from `pg_class.reloptions`, so no view can be used to read around RLS. That is the single most important thing to get right here and it is right for all eight.

**I had the count wrong at seven**, in my own working notes from workstream V, which is where the figure came from. To be exact about the blame: I checked, and **no document in `docs/11-component-audit/` states a number**, so this was a note of mine that I restated as established rather than a published claim. `application_stage_summary` was the one missed. The acquittal is stronger than I first wrote it, not weaker, but the number was wrong.

**The grant layer is deliberate.** Two RLS tables have no `SELECT` grant to `authenticated` at all: `careers_rate_limit` and `zoho_id_map`. That is service-role-only by design, not an oversight, and it is a different layer from row policies. My first probe aborted on it, which is how I found it.

**Row visibility is role-dependent on exactly 19 of the 29 readable tables**, from a 116-row probe of 29 tables against 4 roles, and the pattern is coherent: `audit_log`, `events_outbox`, `erasure_log`, `retention_policy`, `attachment_deletion_queue` and `application_views` are admin-only; `companies`, `contact_profiles` and `deals` are admin, recruiter and bd; `candidate_profiles` narrows to 3 for a sourcer.

**Class 3 is almost entirely a seeding artefact, not RLS.** The other **10 tables return the same count to all four roles**, and 8 of those counts are zero because the table is empty on this stack: `tickets`, `intake_items`, `email_templates`, `ats_saved_views`, `intake_mapping_templates`, `integration_settings`, `client_errors` and `candidate_statuses`/`sources` (which hold 30 and 28 for everyone). So most of the `0r` cells in the matrix mean **no data seeded**, identically for every role, and are not a screen that RLS emptied. **The sourcer pipeline in G1-1 is the only true class-3 case in the product.** Whether an empty screen reads as broken is a real question, but it is a Goal 4 question about empty states rather than a role finding, and `client_errors` at 0 also re-confirms the V figure.

**Class 1, the goal's highest-value class, is clean apart from G1-2.** Six writes probed against four roles, each in its own rolled-back transaction, is 24 cells, and **every cell agrees with the UI gate that governs it**:

| Write probed | admin | recruiter | sourcer | bd | UI gate that matches it |
| :---- | ----: | ----: | ----: | ----: | :---- |
| `companies` set `name` | 1 | 0 | 0 | 1 | `useCanEditCrm()` = admin or bd |
| `deals` set `name` | 1 | 0 | 0 | 1 | `useCanEditCrm()` = admin or bd |
| `applications` set `stage` | 1 | 1 | 0 | 0 | `canEdit` = admin or recruiter |
| `applications` set `is_shortlisted` | 1 | 1 | 0 | 0 | `canEdit` = admin or recruiter |
| `requisitions` set `status` | 1 | 1 | 0 | 0 | `canEdit` = admin or recruiter |
| `candidate_profiles` set `star_grade` | 1 | 1 | **1** | 0 | `canGrade`, which includes the sourcer's own |

`1` is one row updated, `0` is **zero rows and no error**, which is how a refusal reads here.

**The sourcer's `1` is the one I expected to be a finding and it is the opposite.** RLS lets a sourcer grade their own candidates, and `useCandidateProfileDraft.ts:75-79` computes `canGrade` as `!mobile && (admin || recruiter || (sourcer && profile.sourcer_id === staff.id))`, which is the RLS policy restated in TypeScript. It is then actually used, at `CandidateRecordPage.tsx:268`, `499` and `516`, and again in `CandidateListPage.tsx:412` and `430`. **A capability the database grants only for your own rows is offered by the UI on exactly those rows, in both places it appears.** That is the most precisely modelled permission in the product.

**`useCanEditCrm()` matches too**, and `CompanyRecordPage` is read-only regardless: one `.select('*')` and zero editable controls. So the eight "silent no-op" writes my first probe flagged are **not findings**, because the UI never offers those writes to the refused role. Reporting eight would have been literally true and thoroughly misleading.

**The one term with no counterpart in the database is `!mobile`**, which appears in both `canEdit` and `canGrade`. RLS permits every one of these writes at any viewport, so the phone restriction is purely a product decision (**P4**) and G1-2 is where it leaks.

## What I got wrong

Ten errors and two instrument limitations, in the order I hit them. Counted honestly: **item 1 is three separate wrong column names**, so the error total is twelve if you count each and ten if you count the headings. Four were faults in my own probes, one was misreading a gate result, two were pre-existing test and gate defects I found and fixed, and three were corrections to claims I had already written into this document. **The most serious is the last: I published a clean verdict on class 4 while the evidence that refutes it was already sitting in my own output file.**

**Four column names I invented rather than checked.** `applications` and `candidate_profiles` have no `updated_at`, so my first write probe printed `refused: column "updated_at" does not exist` and I briefly had four cells that looked like refusals and were my own typos. Then `deals` has `name`, not `title`, giving `ERROR: column "title" does not exist`, and because I had put six probes in one transaction that error aborted the rest with `current transaction is aborted, commands ignored until end of transaction block`, wiping three good results per role. Then `candidate_profiles` is keyed on `person_id`, not `id`: `ERROR: column "id" does not exist`. **Fix: one probe per transaction, and read `information_schema.columns` first.** That is the second time this session that batching probes into one transaction cost me the whole batch.

**A `DO` block that returned nothing.** My first `SELECT` probe set the role inside a `DO` block; `raise notice` worked in isolation but the `set local role` did not apply to the `execute` statements, so it reported `0 probe results` with no error. Replaced with generated plain SQL.

**A locator that did not exist, which cost two ten-minute hangs.** My probe used `.kanban-column`; the class is **`.kanban-col`** (`KanbanBoard.tsx:95`). With zero matches, `cols.nth(colCount - 1)` became `nth(-1)` and waited out the full 600-second test timeout **twice** before I instrumented the spec with a per-step timestamped log and found it in one run. The lesson is the instrumentation, not the selector: a probe that prints nothing until it finishes cannot be diagnosed.

**I misread the gate as passing when it had failed.** I ran `bash scripts/gate.sh 2>&1 | tail -25` and read `[exited with code 0]`, which was **`tail`'s** exit code, not the script's. `gate.sh` had printed `FAIL dead-code` and `At least one check failed.` and does exit non-zero correctly. **Never read an exit code through a pipe.**

**The `dead-code` gate check was genuinely failing, and had been since workstream V.** `npx knip` reported `Unused files (11)`, listing the whole of `tests/audit/` plus `tests/playwright.audit.config.ts`. Cause: knip's Playwright plugin matches only `playwright.config.{js,cjs,mjs,ts,cts,mts}` (verified in `node_modules/knip/dist/plugins/playwright/index.js` at knip 6.34.0), so `playwright.audit.config.ts` was invisible and its `testDir: './audit'` never became an entry point. **Fix: declare both configs under `workspaces.tests.playwright.config` in `knip.json`**, which made the specs entries and the helpers reachable, leaving three exports used only inside `capture.ts` (`notes`, `manifestPath`, `allowedReadRpcs`); those lost their `export` keyword. `npx knip` now exits 0. Nine of the eleven files predate this goal and two are mine, so I extended a failure I did not create and then found it by accident.

**G1-3 as I first wrote it was wrong and is withdrawn.** I recorded "settings shows admin six rows and every other role zero, and nothing explains the difference" from the matrix row alone. `DataExportCard.tsx:77` returns `Exporting data is restricted to administrators.` for every non-admin. **Reading one file refuted it**, and it is now filed as the acquittal it is.

**G1-2 was attributed to the wrong roles.** I wrote that a sourcer could drag a pipeline card and that this was true for "every role on a phone". Both wrong: `showKanban = view === 'kanban' && !mobile` means **the Kanban never renders on a phone**, and the sourcer has 0 rows on the requisition the matrix sampled. The finding survives with the roles swapped: the live-but-dead star reaches **admin and recruiter on a phone**, and the drag survives only for a sourcer on desktop on 2 of 690 requisitions.

**A gate failure I chased rather than retried, and it was not mine.** Pass 1 of the closing gate reported `FAIL browser`, one test: `dashboard-channel-collision.spec.ts:47`, `Error: the dashboard reported a client error while switching tabs`. Pass 2 passed on an unchanged tree, which is the signature of a scheduling race. My first hypothesis was that my own three probes had polluted `client_errors`, since they ran without the write guard; **that was wrong**, the table held 0 rows. The report in `.gate/browser-pass-1.json` named the real cause: 18 rows tagged `e2e-error-3759-lgglsc` on `/recruit/*`, which belong to `error-reporting.spec.ts`. The collision spec filtered `client_errors` on `occurred_at` alone, so at two workers it claimed another spec's fixtures, **and then deleted them**, which is why the table was empty by the time I looked. Filed as **QA-010** and fixed by scoping the read to the three routes it actually visits; the pairing now passes 5 runs out of 5 at two workers. It is `CLAUDE.md`'s run-unique-fixtures rule in a weaker disguise: cleaning up by time window rather than by tag.

**I called class 4 clean and it was not.** I wrote "zero page errors and zero on-screen errors across all 248 rows, nothing errors for one role and not another" on the strength of two columns, while a third column in the same files recorded **48 console errors** that are now G1-5. The statement I made was individually true and the conclusion drawn from it was false. **The corpus is only evidence for the fields you actually read.**

**I said there were seven `security_invoker` views. There are eight.** `application_stage_summary` was missing from my list and from the claim carried forward from workstream V. All eight are `on`, so the acquittal got stronger while my count was wrong.

**My `notFound` probe tested for the wrong string.** It matched `/page not found/i`, so `modules/intake/index.tsx`'s `Not found in Intake` read as "not a 404 page". The route difference in G1-3 is real; the way I first described it was an artefact of my own regex.

**Two instrument limitations, which together explain three wrong readings.**

The `Mr` column counts `tbody tr`, so it is blind twice over. It **conflates** every table on a multi-table screen: `recruit-requisition-record` reports 21 for admin, which happens to be a real 21 applications (the shortlist-star count matches it exactly), but on a screen with several tables the number is not attributable to one of them. And it reports **0 for any screen that is not a table at all**: `sales-deals` defaults to a Kanban board (`DealsListPage.tsx:68`) and showed `0r` while holding 2 deals, and every dashboard renders hand-rolled CSS bars, so all three dashboard routes read `0r` for all four roles regardless of content. **Read that column as "rows in tables", never as "content on screen", and use the per-view database probe wherever attribution matters.**

The second is worse because it produced a false acquittal. I collected `consoleErrors`, `pageErrors` and on-screen `errorText`, then judged class 4 on the last two and called it clean while the first held all 48 instances of G1-5. **A silent `400` shows up in none of the places I looked.** The fix is not a new field, since the field was already there; it is to analyse every column I bothered to collect.

## What this did not cover

- **Chromium only**, as with workstream V, and **no screen reader**. Every accessibility-adjacent statement here is from the DOM and computed styles.
- **No per-control state captures for `sourcer` and `bd`.** I ran an enumeration, not the full state sweep, so workstream W12's visual diff still has no baseline for those two roles. That was a deliberate trade, stated at the top.
- **Six writes probed, not every write the product performs.** The 24-cell agreement is strong evidence for the pattern and is not a proof that no other write diverges.
- **One identity per role.** Ownership-scoped policies such as `sourcer_id = staff.id` are exercised at a single account, so a policy that leaked another *sourcer's* rows would not show up here. Given that `canGrade` turns on exactly that comparison, a second sourcer is the highest-value addition to this probe.
- **The two requisitions where a sourcer can drag** were found from the database, not by walking all 690 in the browser.
- **G1-4 is measured on this stack's data only.** 99.0% is the share of *these* 86,125 rows in the three omitted stages. The defect is unconditional, since the three stages can never be counted, but the percentage is a property of the imported data.
- **The other dashboard widgets were not audited against their data.** `vw_source_effectiveness`, `vw_staff_grading`, `vw_requisition_aging` and the two 0-row matviews all render sections I did not check for the same class of bug as G1-4. Given that G1-4 was a stale copy of a locked list, **every other hard-coded list in `dashboards/lib.ts` deserves the same comparison** and I only checked the two stage arrays.
- **G1-6 is a statement about grants, not an exploit.** I did not attempt to read either matview through the Data API as a non-admin from the browser; the finding rests on `has_table_privilege`, the absence of RLS on matviews, and `dash` being an exposed schema.
- **`tickets`, `intake_items`, `email_templates`, `ats_saved_views`, `intake_mapping_templates` and `integration_settings` are empty on this stack**, so nothing here says how those screens behave with data in them, for any role.

## What this hands to which goal

Routing only. Every decision below belongs to the goal named, not to this document.

| Finding | Goes to | Why |
| :---- | :---- | :---- |
| **G1-4** dashboard reads zero | **Goal 5**, execution, and it should jump the queue | A one-line fix (import the canonical `APPLICATION_STAGES` instead of the private copy) against a Blocks-severity wrong number on a screen all four roles land on. Nothing in W is worth more per line. |
| **G1-5** four silent `400`s | **Goal 5** | A guard inside `useEngagement` for an empty `parentId`. No design decision. |
| **G1-2** dead shortlist star on a phone | **Goal 2** first, then W8 | The fix depends on **P4**, the parked read-only-on-a-phone question, which is Klent's. W8 already owns the "say why the control is absent" pattern, and `DataExportCard.tsx:77` is the in-repo example to copy. |
| **G1-1** sourcer's empty pipeline | **Goal 2** | Whether a sourcer should see other sourcers' candidates is a product question, not a defect. The policies are self-consistent either way. |
| **G1-6** ungated `dash` matviews | **Goal 5**, small | Either revoke `SELECT` from `authenticated` and wrap each in a definer view the way `vw_success_metrics` already is, or confirm the data is not sensitive. Currently 0 rows, so there is time. |
| **G1-3** two 404 screens | **Goal 4**, motion and polish | Wording plus a route back. |
| **QA-010** colliding test cleanup | **closed already** | Fixed and proven in this goal; logged in `tests/DEFECT_LOG.md`. |

**One thing G1-4 implies beyond its own fix.** The defect was a private, stale duplicate of a list `CLAUDE.md` explicitly calls locked. `dashboards/lib.ts` holds other hard-coded lists, and I checked only the two stage arrays. **Auditing the rest of that file against `database.types.ts` belongs in Goal 5 as its own item**, because the same mistake in a different list would be just as invisible.

## Where the evidence lives

| Artefact | Path |
| :---- | :---- |
| Per-role enumeration, 62 rows each | `audit/corpus/role-matrix.<role>.json` |
| One screenshot per route, role and viewport | `audit/corpus/role-matrix/<role>/` |
| The enumeration spec | `tests/audit/role-matrix.spec.ts` |
| The behaviour probe behind G1-2 | `tests/audit/pipeline-dead-controls.spec.ts` |
| The network capture behind G1-5 | `tests/audit/candidate-record-400s.spec.ts` |
| The funnel capture behind G1-4 | `tests/audit/dashboard-funnel-zero.spec.ts` |

`audit/corpus/` is **gitignored** (`.gitignore:49`), because the screens render real candidate names from the Zoho migration. **This document carries no candidate or client data**: the one place the corpus difference was personal, the dashboard reminder rows, is described by its shape and its counts with the text withheld.

Every row count here is reproducible against the local stack by impersonating a persona in a rolled-back transaction. **Nothing in this goal wrote to any database**, and no probe ran against the hosted project.

