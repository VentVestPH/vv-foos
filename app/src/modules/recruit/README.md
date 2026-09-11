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
| `hooks.ts` | `useLookups`, `useIsMobile`, `CompanyOption`. Everything that talks to Postgres or holds React state. `fetchPeopleByIds` was deleted with U1.9: the `application_pipeline` view carries the candidate name, so nothing chunks person ids any more |
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
  The `columns` array is **ordered**: the requisition **and candidate** lists
  each keep a `columnOrder` plus a `hiddenCols` set, and the table, the CSV
  export and the Advanced Search column list all render in that order. Because
  the CSV column order is a user preference, a test must find a column by its
  header and never by index. Saving a view therefore captures the
  arrangement as well as the visibility; applying one puts the saved columns
  first and pushes the rest to the end, hidden. Saved views do not carry the
  search term.
- **Neither list search filters as you type.** The table changes only when the
  term is submitted, by Enter or by the magnifying glass, through
  `useSubmittedSearch()` in `lib/quickSearch.ts`: `input` drives the box, `term`
  drives the query. The requisition list's 2000ms debounce is gone, replaced by
  this; it was approximating "the user has stopped typing" when submitting says
  it outright. Suggestions still appear while typing, on their own 300ms
  debounce, and submitting dismisses them.
- The X beside the magnifying glass clears the box, resets the applied term so
  the full list comes back, and refocuses the input.
- Both list searches read their opening term from `?search=`, and it is applied,
  not merely typed into the box. That is the contract the sidebar Quick Search
  navigates on, and every list page in the app now honours it.
- The candidate search ANDs the words of the term, one `ilike` on `search_text`
  per word. `search_text` on `candidate_list` concatenates first, middle and last
  name, so a first-plus-last search matched nothing at all for anyone with a
  middle name until 2026-09-10.
- Both the candidate list's own First Name and Last Name boxes **and the
  sidebar's Candidate First/Last Name pair are gone**, on Klent's call
  2026-09-10: "i think there's no point of keeping first and last name fields.
  remove them in the sidebar." One keyword box per scope is the whole Quick
  Search now, and because the candidate query ANDs the words of the term, typing
  a first and last name into it does what the two fields were for. `SearchScope`
  lost its `namedFields` flag and `.fo-sidebar` lost `data-named-fields`; the one
  CSS rule that keyed off that attribute is now unconditional, which is
  behaviour-identical since every remaining case was the `'false'` case.
- Candidate Information's groups take their spacing from
  `.record-section-body { gap: 16px }` and add none of their own. That gap is
  shared with every other record section, so it stays; a group that adds its own
  margin and padding on top of it is what made the section look unevenly spaced.
- The Resume column is centred through `TableColumn.align: 'center'`, which is
  the reusable way to centre an icon-only column. Name and Sourcer carry
  `nowrap`, and Location carries `minWidth: '200px'` rather than `width`, which
  the auto table layout ignored (it measured 106px and wrapped).
- Every candidate column is sortable. Flags, Resume and Grade comment already had
  a `SORT_COLUMNS` entry and only needed `sortable: true`; Requisitions needed a
  new `requisition_codes` column on `candidate_list`, because the codes had been
  assembled in the browser and Postgres cannot order by that. See
  `20260910000002_candidate_list_requisition_codes.sql`, which carries the
  measurement that justified a correlated aggregate over a materialised column.
- Both recruit list pages suggest records as you type, through `searchHints` on
  `ListPage` and `requisitionSearchHints` / `candidateSearchHints` in
  `lib/searchHints.ts`. Suggestions are scoped to the list you are on; the
  utility header's box is the one that searches everything.
- **The candidate record's flag is real.** It was a `link-btn` reading "Flag" that
  opened a placeholder and did nothing. It is now a hollow `Flag` icon that fills
  red and writes `candidate_profiles.do_not_contact`, which is the only flag the
  schema has and exactly what the list's Flags column shows. `aria-pressed`
  carries the state, and it is disabled for anyone who is not an admin or a
  recruiter, matching `canEditProfile`. The pipe that used to sit between it and
  **Next** is gone.
- **Next works.** The candidate list hands the current page's ordered ids to
  `useListLink`, and the record reads them through `useRecordSiblings`, which also
  gives the `1 of 20` counter beside the button. Paging re-passes the same router
  state, so it keeps working across hops. Arrive by URL instead of from the list
  and there are no siblings, so Next disables itself and says why. Previous is the
  same two lines if it is ever wanted; only Next was asked for.
- The candidate record's action bar was eight controls wide. It is now Save
  profile, Send Email and View Resume, with Schedule meeting, Print Resume,
  Submit, Merge duplicate and Erase behind the icon-only `ActionMenu`, the same
  `label="More actions" iconOnly` shape the requisition record uses.
- **There is no Edit button, and there is no edit mode.** The `candidate_profiles`
  fields inside Candidate Information are live inputs the moment the section is
  open, so Edit only expanded that section and focused its first input: a jump
  link wearing the label of a state change. The larger reason it could not be an
  edit button is that **nothing in the app writes to `people`** — a candidate's
  name, emails, phones, address and LinkedIn URLs have no edit path anywhere, so
  the majority of the record it appeared to unlock is read-only by omission, not
  by permission. `canEditProfile` still gates every field it always gated.
- **The bulk bar is three controls and an ellipsis.** Change status, Send Email,
  and `ActionMenu label="More actions" iconOnly` holding Mark as…,
  View Resume, Print profile and Submit. Putting a dropdown in there needed one
  fix: `.fo-page-head-grow-inner` is `overflow: hidden` so the grow reads as a
  reveal, which clipped the menu and handed its clicks to the pager. `ListPage`
  now sets `data-settled` on `transitionend` and the clip lifts then.
- **A dialog title names the thing; its primary button names the verb, in one or
  two words, and neither is computed.** Change status / Update, Mark candidates /
  Save, Send email / Send, Merge duplicate / Merge, Delete candidate / Delete
  permanently, Submit to a requisition, Add candidate. Klent's rule, 2026-09-11:
  *"why make everything a senmtence on you"*. Titles used to interpolate the
  selection count and the record name, and buttons used to restate the value the
  control above them already showed (`Set to <the whole status label>`, `Send to
  5`), which also made every button a different width.
- **Submit is real, and it runs candidate-to-requisition.** `CandidateSubmitDialog`
  searches `requisition_list` for open, waiting-approval and on-hold roles, then
  either inserts an `applications` row at stage `submitted` or, when one already
  exists, updates that row's stage. It has to branch: `applications` is
  `unique (requisition_id, person_id)`, so a second submit is an update or a 23505.
  The dialog shows the existing stage on the row and offers **Move to submitted**
  instead of Submit. This is the mirror of `AddCandidateDialog`, which only ever
  worked requisition-to-candidate and entered at stage `received`; a sourcer works
  in the other direction. Nothing writes the audit trail by hand: migration 10's
  triggers own the `status_change` activity, the `audit_log` row and the outbox event.
- **Nothing resets the scroll position but `useScrollReset`.** The shell scrolls
  inside `main#main-content`, not the document, so the browser's own scroll
  handling never applies and, until 2026-09-11, opening a record from halfway down
  a list rendered halfway down. A candidate opened from the requisition kanban was
  the case Klent hit. The hook sets `scrollTop = 0` on every `location.key` change
  and leaves hash navigations alone so in-page anchors still work.
- **Print profile calls `window.print()`**, and the `SectionCollapse` bus does the
  rest: every accordion is expanded synchronously on `beforeprint` and put back on
  `afterprint`, so the document carries the whole record however the page was left.
  That is all it ever needed to do.
  `styles/layers/print.css` is 205 lines that already flatten a record page onto
  paper, and until 2026-09-11 nothing invoked it. The old label was **Print Resume**,
  which was wrong twice: it was a placeholder, and Taleo's control prints the
  system-formatted profile rather than the uploaded file that View Resume downloads.
- **The permanent delete is labelled "Delete permanently…", not "Erase".** GDPR
  Article 17 calls the right "erasure", and the receipt and the function keep that
  word (`fn_erase_person`, `person_erasures`), but no mainstream product puts
  "Erase" on a button: destructive-action guidance is verb plus noun, stating the
  consequence, and "Delete permanently" does both. The dialog body still explains
  the erasure, because that is the legal concept being exercised.
- **Requisition Details is gone.** It rendered the same `apps` array as Requisition
  Summary with the requisition link replaced by plain text; every other element
  was identical. Summary survives because it links.
- Web Links are `.fo-link-card`s, not bare anchors, and they now also surface the
  candidate's real LinkedIn and online-resume URLs beside the generated searches.
  **There is no Google results iframe and there cannot be:** Google sends
  `X-Frame-Options` on search results, which is set by them and cannot be
  overridden from the client. A card carrying the target host is the honest
  substitute.
- The candidate table has **one** flag column, keyed `flags`. It shows a red flag
  when `candidate_profiles.do_not_contact` is set and nothing otherwise, and its
  header is the flag icon. There used to be two: this one rendering a text badge
  at the far right, and a decorative 32px `flagcol` on the left whose `render`
  returned `null` for every row. `do_not_contact` is the only value the flag
  string has ever taken, so the `warning` tone in the old badge was dead code.
- Per-staff accordion preferences on the requisition record live in
  `integration_settings` under `ui.sections.recruit.requisition.record`, holding
  both `hidden` and an `open` map. `REQ_SECTION_DEFAULT_OPEN` in
  `RequisitionRecordPage.tsx` is the single source of truth for the section list
  and for which ones open by default; the settings dialog and every
  `RecordSection` read from it.
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
