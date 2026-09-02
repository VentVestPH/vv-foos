# Recruit module (ATS) — Agent 2

Requisitions, candidates, and the per-requisition application pipeline.
Mount `RecruitRoutes` at `/recruit/*`; merge `recruitNavItems` into the shell
nav. Both export from `src/modules/recruit/index.tsx`.

## Routes

| Route | Screen |
|---|---|
| `/recruit/requisitions` | Requisition list (filters, saved views, CSV, unviewed badges) |
| `/recruit/requisitions/new` | New requisition form (creates as draft) |
| `/recruit/requisitions/:id` | Requisition record: lifecycle, approvers, engagement, pipeline |
| `/recruit/requisitions/:id/edit` | Edit requisition |
| `/recruit/candidates` | Candidate list (grades, verbatim statuses, saved views, CSV) |
| `/recruit/candidates/:id` | Candidate record: identity, profile, nine-panel toolkit |

## Files

| File | Holds |
|---|---|
| `index.tsx` | The `<Routes>` tree and `recruitNavItems` |
| `lib.ts` | Row type aliases, the `person*` jsonb readers, `fmtDate`/`fmtDateTime`/`todayIso`/`errMsg`, `REQ_TRANSITIONS`, `REQ_ACTION_LABELS`, `sortRows`. Pure, no client |
| `hooks.ts` | `useLookups`, `useIsMobile`, `fetchPeopleByIds`. Everything that talks to Postgres or holds React state |
| `savedViews.tsx` | `useSavedViews` and `SavedViewsControl`, shared by both list pages |
| `candidates/`, `requisitions/`, `components/` | Screens and module-private components |

`fmtDate` and `fmtDateTime` return `''` rather than a dash, because
`RequisitionRecordPage` filters its info grid on `v !== ''`. Use the `fallback`
argument of `lib/format.ts` directly if you want a visible placeholder.

There is no `db.ts`. The module imports `supabase` from `src/lib/supabase.ts`
like the other four; the `Relationships` shim that used to justify a local
client was deleted once `database.types.ts` carried the field itself.

## Query param contract (for Agent 7 drill-through links)

`/recruit/requisitions` accepts: `status`, `company_id`, `owner_id`,
`location`, `date_from`, `date_to` (opened_date range, `YYYY-MM-DD`).

`/recruit/candidates` accepts: `status` (candidate_statuses id), `star_grade`
(1–3), `source_id`, `sourcer_id`, `date_from`, `date_to` (initial_date range).

`/recruit/candidates/:personId?application=<applicationId>` opens the record
and marks that application viewed for the current staff user.

## Data behavior

- Stage and status changes are plain UPDATEs; Agent 1's triggers write the
  status_change activity, audit_log row, and events_outbox event. This module
  never writes those tables.
- `display_code` is never sent on insert — the database sequence owns it.
- Unviewed = applications with no `application_views` row for the current
  staff user, or one older than the application's `stage_changed_at`.
  Counters refresh live via Realtime on `applications` and `application_views`.
- Files upload to the `attachments` Supabase Storage bucket under
  `<parent_type>/<parent_id>/<timestamp>_<name>`; reads use signed URLs.
- Saved views persist to `ats_saved_views` (filters + visible columns + sort),
  one row per staff user per named view, entity `requisition` or `candidate`.
- Legal requisition transitions: draft → waiting_approval → open → on_hold →
  filled → closed, plus open ↔ on_hold, open → filled/closed, on_hold →
  filled, and waiting_approval → draft on any approver rejection.

## Gate 3 demo script (run on is_test = true data)

1. New requisition: fill title, company, pay fields; pick two owners and one
   requisition approver; tick "Test data"; create — lands as **draft** with a
   sequence-issued REQ code.
2. Action bar → **Submit for approval** (status: waiting_approval).
3. As the approver, open the record → Approvers section → **Approve**
   (decision + decided_at land on the approver row). **Open requisition**
   unlocks; click it (status: open, opened_date set).
4. Pipeline → **Add candidate** three times with flagged test candidates —
   all land at received; the header and the requisition list show
   **3 Unviewed**.
5. Open one candidate from the pipeline — the badge drops to 2 without a
   reload (application_views upsert + Realtime).
6. On the candidate list, set star grade and grade comment inline.
7. Kanban view: drag the candidate through phone_screen and submitted — each
   drop is one stage UPDATE; the trigger writes the status_change activity
   and audit row.
8. Drag one to rejected — the dialog demands a reason before the write.
9. Drag one to hired — hired_at is set and the promotion prompt offers a
   contact_profile with the requisition's company pre-filled.
10. Show the requisition timeline: status_change entries from the triggers.
11. Candidate list: set filters, save the view, reload, reapply it from the
    dropdown.
12. Pipeline table → **Export CSV** — matches the on-screen set.

## Known gaps

- Description is a plain textarea, not rich text — the scaffold ships no
  editor dependency and package.json is outside this module's boundary.
- Send email / Schedule meeting are rendered disabled until Agent 6 ships
  its Edge Function endpoints.
