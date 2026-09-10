# Dashboards module (Agent 7)

Five live dashboards plus an admin-only Experiment metrics panel, all
reading from the `dash` Postgres schema (migration
`20260725000004_agent7_dash_schema.sql`). No new routes — this replaces the
placeholder content at `/` (`src/pages/DashboardPage.tsx`), since
`navConfig.ts`'s "Dashboards" nav item already points there.

## Routes

| Route | Screen |
|---|---|
| `/` | Dashboards home — shared date-range filter + tabs for the six panels below |

## The six panels

1. **Pipeline by stage** — ATS funnel (`dash.vw_ats_funnel`) and CRM funnel
   (`dash.vw_crm_funnel`), row-level views aggregated client-side.
2. **Time in stage** — `dash.mv_stage_durations`, the brief's one
   audit_log-derived exception (definer-refreshed every 15 min by pg_cron,
   or the admin "Refresh now" button).
3. **Source effectiveness** — intake-channel lens
   (`dash.vw_source_effectiveness`) and named-source lens (reuses
   `vw_ats_funnel.source_name`).
4. **Recruiter/sourcer activity** — `dash.vw_staff_activities` +
   `dash.vw_staff_grading` (live) + `dash.mv_staff_stage_advances`
   (15-min-refreshed, audit_log-derived). Deliberately unranked — counts
   sorted alphabetically by staff name, never by count, per the brief's
   no-leaderboard business rule.
5. **Requisition aging** — `dash.vw_requisition_aging`; `i_am_owner` and
   `unviewed_applications` resolve against the caller's own `auth.uid()`
   automatically since the view is `security_invoker`. Aging threshold
   (default 14 days) comes from `dash.thresholds`, admin-editable.
6. **Experiment metrics** (admin only, not one of the five numbered
   dashboards) — `dash.vw_success_metrics`, gated by a security-barrier view
   checking `get_my_role() = 'admin'` rather than RLS (materialized views
   can't carry row policies directly).

## Data behavior

- Every `dash.*` view is `security_invoker = on` — Postgres RLS on the
  underlying tables (owned by Agents 1–5) is the real access boundary. A
  sourcer's Pipeline-by-Stage tab only ever shows their own-sourced
  applications; a bd user's ATS panel is empty; recruiters see ATS fully and
  CRM read-only. Verified live via JWT-simulated queries as bd/admin against
  the real project (bd: 0 rows from `vw_success_metrics` and a blocked
  `thresholds` UPDATE; admin: 7 rows and a working refresh).
- `is_test` exclusion is baked into every view's WHERE clause, joining
  through `people`/`requisitions`/`deals`/`companies` since `applications`,
  `candidate_profiles`, `intake_items`, and `activities` don't carry their
  own `is_test` column.
- No charting library exists anywhere in this app yet (checked — zero
  matches for recharts/chart.js/d3), and `package.json` is outside this
  module's write boundary per the same convention other modules follow. All
  bar visuals are hand-rolled CSS (`BarList.tsx`) over the locked design
  tokens, not a new dependency.
- Global date-range filter (presets 7/30/90/quarter/custom, default 30)
  drives every panel except `mv_stage_advances` (fixed 90-day window, since
  it's a 15-min-refreshed aggregate rather than a live query) and the
  Requisition Aging KPIs (a present-tense snapshot, filtered by
  `opened_date` within range for which requisitions are included).
- Realtime: one subscription on `events_outbox` inserts, filtered
  client-side to the 8 named events from the brief, debounced 5s before
  re-running each panel's own queries (`useOutboxRefresh` in `hooks.ts`) —
  same "diff nothing, just re-fetch" approach as `useIntakeBadge`.
- CSV export is per-widget (`Widget.tsx`), post-filter/post-RLS rows already
  on the client, filename pattern `foos-<dashboard>-<widget>-<from>_to_<to>.csv`.
- Materialized-view refresh: `dash-refresh-materialized-views` (every 15
  min) and `dash-refresh-success-metrics` (4x/hour, offset by 5 min) are
  live pg_cron jobs. `dash.refresh_materialized_views()` is the admin-gated
  RPC behind the manual "Refresh now" buttons on Time-in-Stage and
  Experiment metrics.

## Drill-through — what's wired and what isn't

Per the brief: "every aggregate links to the underlying list using Agent 2's
and Agent 3's published list-URL query-param contracts... if a needed param
is missing, request it from that agent's owner; do not scrape or bypass."
Checked both modules' actual code (not just their READMEs) before wiring
anything:

- **Works today:** CRM pipeline-by-stage bars → `/sales/deals?stage=X`
  (added `useSearchParams` support to `DealsListPage.tsx` and
  `ContactsListPage.tsx` this pass, documented in `sales/README.md`'s new
  "Query param contract" section). Requisition Aging rows →
  `/recruit/requisitions/<requisition_id>`. A row names one requisition, so
  it opens that record. It used to navigate to
  `/recruit/requisitions?company_id=X&status=Y`, which only filtered the
  list and left the user to find the row again.
- **Not wired, documented as a gap instead of faked:** ATS pipeline-by-stage
  bars (no application-level list view exists in the app — only
  candidate-level and requisition-level lists, neither filters by
  application stage), named-source bars (source_id is a uuid, this view only
  carries the resolved name), intake-channel bars (the intake queue page
  filters via component state, not a URL contract yet).

## Gate 3 demo script (run on `is_test = true` data)

1. Sign in as each role in turn (admin, recruiter, sourcer, bd) and open
   `/`. Confirm the tab set matches role: everyone sees the five numbered
   tabs; only admin also sees "Experiment metrics."
2. As a sourcer, confirm the ATS pipeline tab only shows applications for
   candidates that sourcer sourced (RLS pass-through) and the CRM tab is
   empty (sourcers have no CRM access).
3. As bd, confirm the reverse — CRM tab populated, ATS tab empty.
4. Change the date-range preset (7/30/90/quarter) and confirm every widget
   re-queries and the KPI numbers change; switch to Custom and pick a
   specific from/to.
5. Click a CRM pipeline-by-stage bar (e.g. "negotiation") — confirm it lands
   on `/sales/deals` pre-filtered to that stage. Click a Requisition Aging
   row — confirm it lands on `/recruit/requisitions` pre-filtered to that
   company and status.
6. Export CSV from any widget — confirm the downloaded file matches the
   on-screen rows and the filename follows
   `foos-<dashboard>-<widget>-<from>_to_<to>.csv`.
7. In another browser tab (or via Supabase SQL), advance an application's
   stage or move a deal — confirm the dashboard tab picks up the change
   within ~5 seconds without a manual reload (Realtime + debounce).
8. As admin, open Time-in-Stage and click "Refresh now" — confirm it
   completes and the "Updated ..." timestamp changes. Same for Experiment
   metrics.
9. As a non-admin, confirm the Experiment metrics tab is simply absent
   (not just disabled) and that `dash.thresholds` shows the current 14-day
   aging threshold as read-only.

## Known gaps

- Cost-based Experiment metrics (anything reading `dash.cost_inputs`) show
  nothing until an admin populates that table — no UI for editing
  `dash.thresholds`/`dash.cost_inputs` was built this pass (brief didn't
  require it, just the RLS-gated tables); editing today is direct SQL.
- `mv_staff_stage_advances` has a fixed 90-day window regardless of the
  date-range picker, since it's refreshed on a schedule rather than queried
  live (audit_log is admin-read only).
- The three drill-through gaps under "what's wired" above are real product
  gaps, not this module's to fix unilaterally — flagged here for whoever
  owns Agent 2/Agent 5 list pages next.
- No dedicated widget-level loading/error states — a slow or failed query
  just leaves a widget's previous data on screen until the next refresh.
