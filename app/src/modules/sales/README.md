# Sales module (CRM) — Agent 3

Companies, contacts, deals, and tickets. Mount `SalesRoutes` at `/sales/*`;
merge `salesNavItems` into the shell nav. Both export from
`src/modules/sales/index.tsx`.

## Routes

| Route | Screen |
|---|---|
| `/sales/companies` | Account list (titled **Accounts**; the URL keeps the schema noun) |
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

## The account list

**The page is titled Accounts and the route is `/sales/companies`, deliberately.** Accounts is the user-facing noun, taken from Taleo and shared with Salesforce and Zoho; `companies` is the schema noun and it is everywhere: the table, the `company_list` view, `company_id` on five tables, `CompanyRecordPage`, `CompanyNewPage`. Renaming the route would swap a URL-to-label mismatch for a URL-to-schema one, across 41 call sites, and leave a redirect to maintain forever. `/accounts` already exists as a short path in `SHORT_PATHS` for anyone typing it. What was genuinely inconsistent was the label: the sales sub-nav said Companies while the primary nav, the page title and the breadcrumb all said Accounts. That is fixed, in `salesNavItems` and in the settings export picker.

The list carries the same furniture as requisitions and candidates, and gets it from the same components rather than a second copy:

- **Selection** is `Table`'s `selectable`, so the checkbox is the first column. It is gated on `canBulk`, which is `useCanEditCrm() && !useIsMobile()`, matching the requisition list
- **Delete** lives in `bulkBar` with `bulkBarOpen`, so it does not exist until a row is ticked and it grows and decays with the bar rather than sitting there disabled
- **Search** is `ListPage`'s own `SearchBox` with `companySearchHints`, which reads `company_list.search_text` and can therefore only ever suggest accounts. Typing does not filter: `useSubmittedSearch` keeps `input` and `term` apart, suggestions appear after `HINT_DELAY_MS` once three characters are in, and the table changes on Enter or the magnifying glass
- **Columns** are `COLUMN_DEFS` plus `ColumnSettingsDialog`, with `visibleCols` driving both the table and the CSV export, so an exported file matches what is on screen
- **Saved views** are `useSavedViews('company')`

### The record page

Sections are `RecordSection` with a `count` prop rather than a count baked into the title. That is not cosmetic: `useSectionPrefs` keys on the title string, so `` `Contacts (${contacts.length})` `` would have produced a new preference key every time the count changed. `SettingsButton` plus `SectionSettingsDialog` under scope `sales.company.record`, matching `recruit.requisition.record`.

**The Requisitions read is capped at `RELATED_ROW_CAP`.** It had no `limit` and no `order`, and one imported account carries **80** requisitions, so the accordion rendered all of them in whatever order Postgres returned. It now orders by `opened_date desc` with an `id` tiebreak, takes 25, and the section note says how many were left out while the header count still shows the true total. Contacts and Deals are still unbounded; their measured maxima are 4 and 1, so it has not bitten yet.

### Deleting an account is guarded, and the guard is the point

`CompanyDeleteDialog` exists because **four of the five foreign keys into `companies` are `on delete cascade`**: `requisitions`, `contact_profiles`, `deals` and `activities` (`tickets` is `set null`). A plain DELETE therefore takes every requisition and deal filed under that account with it, which is why the product shipped with no delete at all. The dialog counts dependents across all five tables first, deletes only the accounts that have none, and for the rest names what is holding them. Read QA-063 before changing it: the cascade in the schema is untouched, so this dialog is the only thing standing between an admin and silent data loss.

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
