# Sales module (CRM) — Agent 3

Companies, contacts, deals, and tickets. Mount `SalesRoutes` at `/sales/*`;
merge `salesNavItems` into the shell nav. Both export from
`src/modules/sales/index.tsx`.

## Routes

| Route | Screen |
|---|---|
| `/sales/companies` | Company list |
| `/sales/companies/new` | New company form |
| `/sales/companies/:id` | Company record: profile, contacts, deals, engagement |
| `/sales/contacts` | Contact list |
| `/sales/contacts/new` | New contact form |
| `/sales/contacts/:personId` | Contact record: identity, profile, nine-panel toolkit |
| `/sales/deals` | Deal list (table + kanban) |
| `/sales/deals/new` | New deal form |
| `/sales/deals/:id` | Deal record: stage, value, engagement |
| `/sales/tickets` | Ticket list |
| `/sales/promote` | Candidate→contact promotion review (from the hired-promotion banner) |

## Data behavior

- Section 5 RLS matrix: admin and bd get full CRM access, recruiter gets
  read-only, sourcer gets none. `salesNavItems` and route guards in `App.tsx`
  mirror this; RLS in Postgres is the real boundary.
- Stage/status changes on `deals` and `tickets` are plain UPDATEs; Agent 1's
  triggers write the `status_change` activity, audit_log row, and (for
  deals) the `deal.stage_changed` outbox event. This module never writes
  those tables directly.
- Moving a deal to `lost` is blocked by `LostReasonDialog` until a non-empty
  reason is entered — the stage UPDATE (with `lost_reason` set) only fires
  from `onConfirm`.
- `HiredPromotionListener` subscribes to `events_outbox` inserts filtered to
  `application.hired` (Realtime, RLS-respecting). Visible to admin/bd only.
  Shows a dismissible banner; "Review" routes to `/sales/promote` with
  `personId`, and `companyId`/`since` when the event payload carried them.
  Multiple pending promotions queue behind the first.
- `PromoteContactPage` creates the `contact_profiles` row for the same
  `person_id` — no new `people` row, keeping one identity per person per the
  architecture doc's Person decision. Declining leaves the event dismissed
  with no contact_profile created.
- `display_code` (`DEAL-####`, `TKT-####`) is never sent on insert — the
  database sequence owns it.
- Files upload to the `attachments` Supabase Storage bucket under
  `<parent_type>/<parent_id>/<timestamp>_<name>`, same convention as the ATS
  module; reads use signed URLs.
- Legal deal transitions: lead → qualified → proposal → negotiation →
  won/lost. Legal ticket transitions: new → open → pending → resolved →
  closed.

## Gate 3 demo script (run on `is_test = true` data)

1. New company: fill name, pick type(s) (client/employer/prospect), set an
   owner; tick "Test data"; create.
2. New contact: attach to that company, fill name/email/title; create —
   lands with a `contact_profile` row for a fresh `people` record.
3. New deal: attach the company and contact, set stage `lead`, a value, and
   an owner; create — lands with a sequence-issued `DEAL-` code.
4. Deals kanban: drag the deal through `qualified` → `proposal` →
   `negotiation` — each drop is one stage UPDATE; the trigger writes the
   `status_change` activity and audit row, visible on the deal's timeline.
5. Drag the deal to `lost` — confirm the `LostReasonDialog` blocks the move
   until a reason is entered; cancel once to confirm no write happened,
   then complete it with a reason and confirm `lost_reason` is saved.
6. Create a second deal and drag it to `won` instead — no reason dialog,
   stage updates immediately.
7. Open the company record — confirm both deals and the contact are listed,
   and the engagement timeline shows the stage-change activities.
8. Cross-module check: in the ATS module, advance an application on a
   requisition tied to this company to stage `hired`. Back in CRM (as
   admin or bd), confirm the `HiredPromotionListener` banner appears
   without a page reload, naming the company from the event payload.
9. Click "Review" — confirm `/sales/promote` opens pre-filled with the
   person and suggested company. Confirm the promotion — confirm a
   `contact_profiles` row now exists for that same `person_id` (check via
   the person's record: both candidate and contact data show, each visible
   only to the role that owns it per the RLS matrix).
10. Repeat the hire on a second application, but click "Dismiss" instead of
    "Review" — confirm no contact_profile is created and the event is
    cleared from the queue.
11. New ticket against the same company/contact; walk it through new → open
    → pending → resolved → closed; confirm each transition logs a
    `status_change` activity with no outbox event (tickets have no v1
    outbox event per the architecture doc's event taxonomy).
12. Company/contact/deal lists: set filters, export CSV, confirm it matches
    the on-screen set (same `Table`/`ListPage` components as ATS).

## Query param contract (for Agent 7 drill-through links)

Added 2026-07-25 to support dashboard drill-through, matching the pattern
already published in `modules/recruit/README.md`:

- `/sales/deals` accepts: `stage` (a `DEAL_STAGES` value), `owner_id`
  (staff uuid), `company_id` (company uuid). Applied on initial mount.
- `/sales/contacts` accepts: `company_id` (company uuid). Applied on
  initial mount.

No `date_from`/`date_to` param on either page yet — neither list has a
date filter control today, so a dashboard link carrying those params will
land on the page with them silently ignored. Add the filter control first
if a dashboard widget needs it.

## Known gaps

- No written demo script existed for this module before 2026-07-25; this
  file fills that gap so Gate 3 (CRM) can be run and signed off alongside
  the already-demoed ATS module.
- Send email / schedule meeting are out of this module's scope pending
  Agent 6's Gmail/Calendar Edge Functions, same as the ATS module.
