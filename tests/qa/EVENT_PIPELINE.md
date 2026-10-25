# Event pipeline — trigger → outbox → UI effect (brief instruction 6)

All 10 events (9 trigger-fired + `reminder.due`) verified reaching
`events_outbox` live this pass via `supabase/tests/validate.sql` checks 6-8
(re-run against the live project, 2026-07-25 — see RETEST_MATRIX.md rows
1.9-1.11). This doc maps each to its consuming UI effect, verified by code
read (Realtime `postgres_changes` subscriptions on `events_outbox`/the
underlying table) rather than re-clicking through every one live.

| Event | Trigger source | Outbox verified | UI consumer | Effect |
|---|---|---|---|---|
| `application.created` | insert on `applications` | ✅ validate.sql / live careers flow test | Recruiter unviewed counter (via `application_views` absence, not a listener) | New application counts as unviewed until opened |
| `application.stage_changed` | update on `applications.stage` | ✅ | `ApplicationPipeline.tsx` re-fetch on `postgres_changes` for `applications`; Agent 7 dashboards `useOutboxRefresh` | Pipeline board/table updates live; dashboards debounce-refresh 5s |
| `application.hired` | update → stage `hired` | ✅ | `HiredPromotionListener.tsx` (`sales/components/`) — Realtime filter `event_name=eq.application.hired` | Promotion banner appears for admin/bd without reload |
| `candidate.status_changed` | update on `candidate_profiles.status_id` | ✅ | Candidate record page re-fetch; dashboards `useOutboxRefresh` | Status badge updates |
| `requisition.status_changed` | update on `requisitions.status` or `requisition_approvers.decision` | ✅ (both paths) | `RequisitionListPage`/record page Realtime subscription on `requisitions`; dashboards | Unviewed badge, status badge, requisition-aging dashboard |
| `deal.stage_changed` | update on `deals.stage` | ✅ | Deals kanban re-fetch; dashboards | Kanban card position, CRM pipeline dashboard |
| `intake_item.received` | insert on `intake_items` | ✅ | `useIntakeBadge`/`useIntakeQueue` (`intake/hooks.ts`) — broad `postgres_changes` on `intake_items` | Queue badge count increments live |
| `intake_item.imported` | update `intake_items.status = imported` | ✅ | Same intake hooks; recruiter unviewed counter once the resulting application exists | Queue item moves out of pending/parsed view |
| `activity.logged` | insert on `activities` | ✅ | Timeline components (`Timeline.tsx`) via direct query re-fetch, not a dedicated Realtime listener today | Timeline shows the new entry on next open/refresh — **not proven live-realtime**, see note below |
| `reminder.due` | `fn_fire_due_reminders()` via pg_cron | ✅ | No dedicated in-app reminder-notification UI found in this codebase pass | **GAP** — outbox event fires correctly, but no consuming UI component was found; reminders are a data model with no notification surface yet |

## Gaps found while mapping this

- **`activity.logged` has no dedicated Realtime listener** — every module
  that shows a timeline re-fetches on its own record-level subscription
  (e.g. the candidate/contact/deal record pages listen to their own table's
  changes), which happens to catch most activity-producing actions
  indirectly, but there's no direct proof that *every* activity-logging path
  refreshes an open timeline live. Not tested exhaustively this pass —
  flagged as a GAP, not asserted working.
- **`reminder.due` has no UI consumer at all.** The event reaches the
  outbox and the reminder row flips to `fired` (both confirmed live), but
  no notification bell, toast, or list surfaces it anywhere in the app per
  a search of the frontend for "reminder" Realtime subscriptions. This is
  either a real product gap (reminders exist in the data model but were
  never wired to a UI) or an intentional scope cut nobody documented — worth
  confirming with whoever owns the reminders feature before Gate 4.
