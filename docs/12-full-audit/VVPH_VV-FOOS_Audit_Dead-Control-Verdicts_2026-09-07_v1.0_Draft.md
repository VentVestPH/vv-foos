# Goal 2: the dead-control verdict

**Project:** VV-FOOS · **Date:** 2026-09-07 · v1.0 Draft

Judgement, not discovery. Every control that does not work gets exactly one verdict: **Build**, **Remove** or **Defer**. Nothing here changes code.

**Result: 33 Build, 43 Defer, 1 Remove, across 77 controls.**

## The count is 77, not 61

The brief carried **61**, from V6 row 16: 50 `PlaceholderAction` call sites plus 11 direct `show(...)` calls. Re-measured from source, the figures are **50 call sites and 15 `show(...)` calls**, and more importantly **two of those sites sit inside a `.map()` and render 14 controls between them**:

| | Sites | Rendered controls |
| :---- | ----: | ----: |
| `PlaceholderAction`, plain | 49 | 49 |
| `PlaceholderAction` inside a `.map()` | 1 | **8** (`RequisitionFormPage.tsx:453`, the rich-text toolbar) |
| `show(...)` with a literal label | 14 | 14 |
| `show(...)` inside a `.map()` | 1 | **6** (`CalendarViewIcons.tsx:33`, the calendar view icons) |
| **Total** | **65** | **77** |

So the earlier count was an undercount of 16, because a call site was treated as a control. `PlaceholderActionGear` (`DashboardPage.tsx:203`) is included; it is one hand-rolled button calling `show('Configure report categories')`.

## Method, and the one thing the evidence cannot do

The brief names the 26 screenshots of VentVest's own Taleo instance as the only defensible source. **They are not in `docs/02-taleo-fidelity/`**, which holds two Markdown reports and zero images; the `discovery/` directory's 61 PNGs are screenshots of FOOS itself, not Taleo. The originals are in Drive, in the folder the source index at `docs/05-reference/` points to, and I read **10 of the 26** there: 01 (shell), 07 (requisition home), 08 (candidate home), 11 (employees), 12 (onboard), 14 (reports), 15 (courses), 17 (new requisition, lower), 18 (requisition record), 21 (requisition record, related sections), 22 (requisition's candidate list).

Reading a PNG through Drive returns **OCR text, not pixels**. That is well suited to this goal, because a verdict on a control turns on its label, and labels are text.

**The limitation matters and I have applied it consistently: OCR cannot see an icon.** A gear, a flag or a calendar-view glyph produces no text, so for those controls the absence of OCR evidence is **not** evidence of absence, and I have not used it as such. Six controls fall in that class and none of them is the single `Remove`.

## The verdicts

### The shell

| Label | Where | Verdict | Taleo evidence | Size, or what it waits on |
| :---- | :---- | :---- | :---- | :---- |
| `Announcements` | `shell/UtilityHeader.tsx:63` | **Remove** | Absent from the header in every screenshot OCR read (01, 07, 08, 11, 12, 14, 15, 18, 21, 22), all of which render it as `Web Support | Administration | Help | Logout` | trivial |
| `Web Support` | `shell/UtilityHeader.tsx:90` | **Build** | 01 and every other shell OCR | 15 min once Klent supplies the URL |
| `Administration` | `shell/UtilityHeader.tsx:121` | **Build** | `Administration` with a caret in every shell OCR | 1 to 2 h, a menu routing to /settings |
| `Administration` | `shell/UtilityHeader.tsx:133` | **Build** | `Administration` with a caret in every shell OCR | 1 to 2 h, a menu routing to /settings |
| `Help` | `shell/UtilityHeader.tsx:168` | **Defer** | `Help` with a caret in every shell OCR | blocked: no help content exists, and what it contains is Klent’s |
| `Advanced Search` | `shell/ShellSidebar.tsx:110` | **Build** | On every Taleo screen, beside Quick Search | 4 to 6 h. `Search everything` beside it already works and is covered by a test |
| `Recently Viewed settings` | `shell/ShellSidebar.tsx:154` | **Defer** | `Recently Viewed` panel is real in 01; the gear is icon-only so OCR cannot see it either way | blocked: no per-user panel setting exists. Removal is arguable |

### The dashboard

| Label | Where | Verdict | Taleo evidence | Size, or what it waits on |
| :---- | :---- | :---- | :---- | :---- |
| `Switch to My Dashboard` | `pages/DashboardPage.tsx:54` | **Defer** | 01 | blocked: there is only one dashboard |
| `Dashboard settings` | `pages/DashboardPage.tsx:69` | **Defer** | gear, OCR cannot see it | blocked: same, only one dashboard |
| `New Event` | `pages/DashboardPage.tsx:78` | **Build** | 01, `My Calendar New Event | Schedule interview` | 1 to 2 d. `calendar-create-meeting` already exists |
| `Schedule interview` | `pages/DashboardPage.tsx:81` | **Build** | 01, twice: My Calendar and My Interviews | 1 to 2 d, shares the work with New Event |
| `New Task` | `pages/DashboardPage.tsx:102` | **Build** | 01 and 21 | 2 to 4 h. The `tasks` table and `TasksPanel` both exist; this is wiring |
| `Schedule interview` | `pages/DashboardPage.tsx:122` | **Build** | 01, twice: My Calendar and My Interviews | 1 to 2 d, shares the work with New Event |
| `Recruit` | `pages/DashboardPage.tsx:174` | **Defer** | 14, report category tabs | blocked: no reporting engine |
| `Onboard` | `pages/DashboardPage.tsx:179` | **Defer** | 14, report category tabs | blocked: no reporting engine |
| `Candidate` | `pages/DashboardPage.tsx:187` | **Defer** | 14 | blocked: no reporting engine |
| `Requisition` | `pages/DashboardPage.tsx:192` | **Defer** | 14 | blocked: no reporting engine |
| `Compliance` | `pages/DashboardPage.tsx:193` | **Defer** | 14 | blocked: no reporting engine |
| `More` | `pages/DashboardPage.tsx:194` | **Defer** | 14, `More` with a caret | blocked: no reporting engine |
| `Configure report categories` | `pages/DashboardPage.tsx:211` | **Defer** | gear, OCR cannot see it | blocked: no reporting engine |
| `Day view` | `pages/CalendarViewIcons.tsx:33` | **Defer** | Screenshots 02, 03, 04 and 05 exist solely to document the 1-day, 7-day, 31-day and detailed-day states, so the views are real Taleo | blocked: no calendar grid and no event store. Fidelity items F2 and F3 |
| `7-day view` | `pages/CalendarViewIcons.tsx:33` | **Defer** | Screenshots 02, 03, 04 and 05 exist solely to document the 1-day, 7-day, 31-day and detailed-day states, so the views are real Taleo | blocked: no calendar grid and no event store. Fidelity items F2 and F3 |
| `31-day view` | `pages/CalendarViewIcons.tsx:33` | **Defer** | Screenshots 02, 03, 04 and 05 exist solely to document the 1-day, 7-day, 31-day and detailed-day states, so the views are real Taleo | blocked: no calendar grid and no event store. Fidelity items F2 and F3 |
| `Person view` | `pages/CalendarViewIcons.tsx:33` | **Defer** | Screenshots 02, 03, 04 and 05 exist solely to document the 1-day, 7-day, 31-day and detailed-day states, so the views are real Taleo | blocked: no calendar grid and no event store. Fidelity items F2 and F3 |
| `Group view` | `pages/CalendarViewIcons.tsx:33` | **Defer** | Screenshots 02, 03, 04 and 05 exist solely to document the 1-day, 7-day, 31-day and detailed-day states, so the views are real Taleo | blocked: no calendar grid and no event store. Fidelity items F2 and F3 |
| `Agenda view` | `pages/CalendarViewIcons.tsx:33` | **Defer** | Screenshots 02, 03, 04 and 05 exist solely to document the 1-day, 7-day, 31-day and detailed-day states, so the views are real Taleo | blocked: no calendar grid and no event store. Fidelity items F2 and F3 |

### Recruit: candidates

| Label | Where | Verdict | Taleo evidence | Size, or what it waits on |
| :---- | :---- | :---- | :---- | :---- |
| `View Resume` | `modules/recruit/candidates/CandidateListPage.tsx:584` | **Build** | 08 and 22 | 4 to 6 h. `attachments` and `ResumePreview` both exist; this is wiring |
| `Print Resume` | `modules/recruit/candidates/CandidateListPage.tsx:586` | **Build** | 08 and 22 | 2 to 4 h, a print stylesheet over the resume view |
| `Submit` | `modules/recruit/candidates/CandidateListPage.tsx:588` | **Build** | 08 and 22 | 2 to 3 d. Submits selected candidates to a requisition, writing `applications`. `Add candidate` on the pipeline already does this from the other direction |
| `More` | `modules/recruit/candidates/CandidateListPage.tsx:590` | **Defer** | 08, 11, 14, 18, 22 | blocked: it is a menu of the other actions, so it follows whatever they become |
| `Configure columns` | `modules/recruit/candidates/CandidateListPage.tsx:670` | **Build** | gear, OCR cannot see it. **The feature is already fully built on the requisition list** (`RequisitionListPage.tsx`: `COLUMN_DEFS` at 94, `visibleCols` at 141, checkboxes at 523, reset at 547, table filtered at 398, persisted at 412, driving the CSV export at 416), and `ats_saved_views(entity, name, filters, columns, sort, is_shared)` is its store | **4 to 6 h: port, do not build.** Corrected downward in Goal 3 from my original 1 to 2 d estimate |
| `View Resume` | `modules/recruit/candidates/CandidateRecordPage.tsx:256` | **Build** | 08 and 22 | 4 to 6 h. `attachments` and `ResumePreview` both exist; this is wiring |
| `Print Resume` | `modules/recruit/candidates/CandidateRecordPage.tsx:263` | **Build** | 08 and 22 | 2 to 4 h, a print stylesheet over the resume view |
| `Submit` | `modules/recruit/candidates/CandidateRecordPage.tsx:265` | **Build** | 08 and 22 | 2 to 3 d. Submits selected candidates to a requisition, writing `applications`. `Add candidate` on the pipeline already does this from the other direction |
| `More` | `modules/recruit/candidates/CandidateRecordPage.tsx:267` | **Defer** | 08, 11, 14, 18, 22 | blocked: it is a menu of the other actions, so it follows whatever they become |
| `Flag` | `modules/recruit/candidates/CandidateRecordPage.tsx:290` | **Build** | The `OP` icon columns in 07, 08 and 22 are Taleo’s flag columns, and FOOS already renders a Flags column | 4 to 6 h |
| `Next` | `modules/recruit/candidates/CandidateRecordPage.tsx:309` | **Build** | Record-to-record movement inside a list; Taleo keeps list context throughout | 2 to 4 h. `lib/listReturn.ts` already stores the list context |

### Recruit: requisitions

| Label | Where | Verdict | Taleo evidence | Size, or what it waits on |
| :---- | :---- | :---- | :---- | :---- |
| `Delete` | `modules/recruit/requisitions/RequisitionListPage.tsx:563` | **Build** | 07 and 12 | 1 to 2 d with a confirm dialog; RLS delete policies and `erasure_log` exist |
| `Forms` | `modules/recruit/requisitions/RequisitionListPage.tsx:568` | **Defer** | 07 and 18 | blocked: no forms feature. Taleo Forms are printable HR documents, not `email_templates` |
| `Change status to…` | `modules/recruit/requisitions/RequisitionListPage.tsx:570` | **Build** | 07, lowercase `status`, exactly as FOOS has it | 1 to 2 d. `requisitions.status`, `REQUISITION_STATUSES` and migration 10’s triggers all exist |
| `Send To` | `modules/recruit/requisitions/RequisitionRecordPage.tsx:261` | **Build** | 18 and 21, `Edit | Send To | Forms | Printable View | More` | 2 to 3 d. `requisition_approvers(approver_type, decided_at, decision)` is exactly this feature’s store |
| `Forms` | `modules/recruit/requisitions/RequisitionRecordPage.tsx:262` | **Defer** | 07 and 18 | blocked: no forms feature. Taleo Forms are printable HR documents, not `email_templates` |
| `More` | `modules/recruit/requisitions/RequisitionRecordPage.tsx:266` | **Defer** | 18 and 21 | blocked: menu of the other actions |
| `Search` | `modules/recruit/requisitions/RequisitionRecordPage.tsx:319` | **Build** | 18, `Next Steps: Candidates (232) / Search / Add new candidate / Filled / Place on hold / Close` | 4 to 6 h, a keyword filter over the requisition’s own pipeline |
| `Attach Contact` | `modules/recruit/requisitions/RequisitionRecordPage.tsx:416` | **Build** | 21, `Contacts Attach Contact | New Contact` | 1 to 2 d. `contact_profiles` and `companies` exist |
| `New Contact` | `modules/recruit/requisitions/RequisitionRecordPage.tsx:417` | **Build** | 21 | 2 to 4 h. The contact-new page already works; this is a link plus a return path |
| `Undo` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |
| `Redo` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |
| `Bold` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |
| `Italic` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |
| `Underline` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |
| `Bullet list` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |
| `Numbered list` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |
| `Link` | `modules/recruit/requisitions/RequisitionFormPage.tsx:453` | **Defer** | 17 shows Taleo’s real editor: `Paragraph`, `B I U S`, `X2 X2`, `Ix`, blockquote, `Source`. Bold, Italic and Underline are directly confirmed; the other five are the normal complement of that toolbar and were not legible in the OCR | blocked as ONE decision, not eight: no editor library is in the tree and `description` is stored as plain text. The largest single build here |

### Sales and intake

| Label | Where | Verdict | Taleo evidence | Size, or what it waits on |
| :---- | :---- | :---- | :---- | :---- |
| `Delete` | `modules/sales/pages/CompaniesListPage.tsx:285` | **Build** | Delete on Taleo lists in 07 and 12; Accounts is a real Taleo module, 09 | 1 d, shares the confirm-dialog work with the requisition Delete |
| `Send Email` | `modules/sales/pages/ContactsListPage.tsx:262` | **Build** | 08, 11, and Contacts is a real Taleo module, 10 | 4 to 6 h. `gmail-send` and `email_templates` both exist; this is wiring |
| `Delete` | `modules/sales/pages/ContactsListPage.tsx:268` | **Build** | Delete on Taleo lists in 07 and 12; Accounts is a real Taleo module, 09 | 1 d, shares the confirm-dialog work with the requisition Delete |
| `Delete` | `modules/sales/pages/DealsListPage.tsx:422` | **Build** | **No Taleo evidence is possible**: Deals is a FOOS addition. Justified by symmetry with the other lists, not by the replica | 1 d, shares the same dialog |
| `New Ticket` | `modules/sales/pages/TicketsListPage.tsx:129` | **Build** | **No Taleo evidence is possible**: Tickets is a FOOS addition. `tickets(subject, company_id, person_id, status, priority, sla_due_at, assignee_id)` is fully shaped and holds 0 rows | 1 to 2 d. A finished table and a list screen with no way to create a row |
| `More` | `modules/intake/QueueListPage.tsx:114` | **Defer** | No Taleo equivalent: Intake is a FOOS addition | blocked: follows the candidate-list More |
| `Configure columns` | `modules/intake/QueueListPage.tsx:120` | **Build** | gear, OCR cannot see it. **The feature is already fully built on the requisition list** (`RequisitionListPage.tsx`: `COLUMN_DEFS` at 94, `visibleCols` at 141, checkboxes at 523, reset at 547, table filtered at 398, persisted at 412, driving the CSV export at 416), and `ats_saved_views(entity, name, filters, columns, sort, is_shared)` is its store | **4 to 6 h: port, do not build.** Corrected downward in Goal 3 from my original 1 to 2 d estimate |

### Settings and the unbuilt modules

| Label | Where | Verdict | Taleo evidence | Size, or what it waits on |
| :---- | :---- | :---- | :---- | :---- |
| `General Configuration` | `modules/settings/SettingsPage.tsx:28` | **Defer** | Taleo’s `Administration` menu | blocked: what belongs in it is Klent’s call |
| `Career Section` | `modules/settings/SettingsPage.tsx:29` | **Build** | Taleo’s `Administration` menu | 2 to 3 d. `careers-page`, `careers-apply` and `careers_rate_limit` all exist, so this is the settings surface for a feature already built |
| `User Accounts` | `modules/settings/SettingsPage.tsx:30` | **Build** | 13 is a real Users module | 2 to 3 d over the `staff` table. `/users` is already admin-only |
| `Go!` | `pages/ModulePlaceholderPage.tsx:124` | **Build** | 08 and 11, twice on each | 2 h, the search submit |
| `Configure this list` | `pages/ModulePlaceholderPage.tsx:134` | **Build** | gear, OCR cannot see it; the requisition list already implements it and `ats_saved_views` is the store | follows Configure columns |
| `Send Email` | `pages/ModulePlaceholderPage.tsx:142` | **Defer** | 11 | blocked: no `employees` table exists |
| `Onboard` | `pages/ModulePlaceholderPage.tsx:143` | **Defer** | 11 | blocked: no onboarding tables exist |
| `Assign Course` | `pages/ModulePlaceholderPage.tsx:144` | **Defer** | 11 | blocked: no course tables exist |
| `More` | `pages/ModulePlaceholderPage.tsx:145` | **Defer** | 11 and 14 | blocked: same |
| `Change Status to…` | `pages/ModulePlaceholderPage.tsx:146` | **Defer** | 11, capital `Status`, exactly as FOOS has it | blocked: no `employees` table |
| `Delete` | `pages/ModulePlaceholderPage.tsx:151` | **Defer** | 12, `Delete | New Packet | Print Forms` | blocked: no `employees` table |
| `New Packet` | `pages/ModulePlaceholderPage.tsx:152` | **Defer** | 12 | blocked: no onboarding tables |
| `Print Forms` | `pages/ModulePlaceholderPage.tsx:153` | **Defer** | 12 | blocked: no forms feature |
| `Send Email` | `pages/ModulePlaceholderPage.tsx:161` | **Defer** | 11 | blocked: no `employees` table exists |
| `Assign Course` | `pages/ModulePlaceholderPage.tsx:162` | **Defer** | 11 | blocked: no course tables exist |
| `New Course` | `pages/ModulePlaceholderPage.tsx:165` | **Defer** | 15, twice | blocked: no course tables |

## What the verdicts rest on, in one line each

**33 Build, and the reason so many are Build is that the schema is already there.** Three cases decided themselves once I looked at the tables rather than the screens:

| Dead control | The store that already exists | Rows in it |
| :---- | :---- | ----: |
| `Configure columns`, `Configure this list` | `ats_saved_views(entity, name, filters, columns, sort, is_shared)` | 0 |
| `Send To` | `requisition_approvers(approver_type, decided_at, decision)` | 0 |
| `New Ticket` | `tickets(subject, company_id, person_id, status, priority, sla_due_at, assignee_id)` | 0 |

Each is a finished table with no user-facing path to it. That is workstream V's recurring shape, a mechanism built and never wired, showing up a third time.

**Corrected by Goal 3:** `Configure columns` is a stronger case than that. It is not a table awaiting a UI, it is a **finished UI on one list and absent from two others**, so the work is a port of roughly 4 to 6 hours rather than the 1 to 2 days I first estimated. Detail in the Goal 3 deliverable.

**43 Defer, and 24 of them share two blockers.** Thirteen controls on `ModulePlaceholderPage.tsx` and the related `Onboard`, `Assign Course`, `New Course`, `New Packet` and `Print Forms` wait on schema that **does not exist at all**: I queried `information_schema.tables` for any table matching employee, course, onboard, packet or form and got **nothing**. Eight report-category controls and `Configure report categories` wait on a reporting engine. Six calendar icons wait on a calendar grid and an event store. None of those is a decision anyone can take today, and `SettingsPage.tsx` already says so on screen: "Other Administration areas are not part of the FOOS MVP."

**1 Remove: `Announcements`, `shell/UtilityHeader.tsx:63`.** The utility header is visible in all ten screenshots I read and OCRs identically every time as `Web Support | Administration | Help | Logout`. There is no Announcements control, no announcements feature, and no table that could feed one. It is a text label, so OCR would have caught it. That is a reason a reader can check, which is what the brief asks for before removing anything from the replica.

## The build list, ordered by value over effort

Ranked by what a user gets per hour spent, not by size.

| | Build | Why it is this high | Size |
| :---- | :---- | :---- | :---- |
| 1 | `New Task` | `tasks` and `TasksPanel` both exist. Pure wiring, and Taleo shows it twice, in 01 and 21 | 2 to 4 h |
| 2 | `New Contact` | The contact-new page already works; this is a link plus a return path | 2 to 4 h |
| 3 | `Go!` | The search submit on two screens Taleo shows it on twice each | 2 h |
| 4 | `Next` | `lib/listReturn.ts` already holds the ordered list context | 2 to 4 h |
| 5 | `Send Email` (contacts) | `gmail-send` and `email_templates` exist. Wiring | 4 to 6 h |
| 6 | `Print Resume` | A print stylesheet over a view that already renders | 2 to 4 h |
| 7 | `View Resume` | `attachments` and `ResumePreview` exist | 4 to 6 h |
| 8 | `Flag` | FOOS already renders a Flags column; Taleo's `OP` columns are the same idea | 4 to 6 h |
| 9 | `Search` (on a requisition) | A keyword filter over a pipeline that already loads | 4 to 6 h |
| 10 | `Web Support`, `Administration` | A link and a menu. Trivial once the support URL is known | ~2 h |
| 11 | `Change status to…` | Status, the enum, and migration 10's triggers all exist | 1 to 2 d |
| 12 | `New Ticket` | Closes a module that has a finished table and no way to add a row | 1 to 2 d |
| 13 | `Delete` (4 lists) | One confirm dialog shared four ways; RLS policies and `erasure_log` exist | 1 to 2 d total |
| 14 | `Configure columns`, `Configure this list` | **Already built on the requisition list**, so this is a port, not a build | 4 to 6 h |
| 15 | `Advanced Search` | Real on every Taleo screen; `/search` already works | 4 to 6 h |
| 16 | `Send To` | `requisition_approvers` is waiting for it, and it is the approvals story | 2 to 3 d |
| 17 | `Submit` | Writes `applications`; the pipeline's `Add candidate` already does the inverse | 2 to 3 d |
| 18 | `Attach Contact` | Needs a picker over `contact_profiles` | 1 to 2 d |
| 19 | `New Event`, `Schedule interview` | `calendar-create-meeting` exists, but this needs an event store and UI | 1 to 2 d |
| 20 | `Career Section` | The settings surface for a careers feature that is already built and deployed | 2 to 3 d |
| 21 | `User Accounts` | A real Taleo module, over the `staff` table | 2 to 3 d |

**Items 1 to 10 are the whole of the first day's work**, roughly 30 hours of small wiring against tables and components that already exist, and they light up ten controls across the shell, both recruit lists, the candidate record and the CRM.

## The dead controls Goal 1 found, which are a different kind

These are not placeholders. They have real handlers that return early, so they look alive and are not. Goal 1 numbered them G1-2.

| Control | Where | Verdict | Why |
| :---- | :---- | :---- | :---- |
| Shortlist star, table and Kanban card | `ApplicationPipeline.tsx:424` and `:496` | **Build**, and it is a fix rather than a feature | Give it `disabled` plus the explanatory pattern already in `DataExportCard.tsx:77`. **The shape of the fix depends on P4**, which is Klent's: is the ATS meant to be read-only on a phone? |
| Kanban card drag | `KanbanBoard.tsx`, no `canEdit` prop | **Build**, same fix | `useDraggable` is called unconditionally. Gate it on the same flag the handler already checks |

## Taleo controls FOOS does not have

Not asked for, and it came out of reading the screenshots, so it is recorded rather than acted on. Each is the inverse of a dead control: something real in Taleo with no FOOS counterpart at all.

| Taleo control | Screenshot | Where it would go |
| :---- | :---- | :---- |
| `Mark as...` | 08, 22 | Candidate list and requisition pipeline action bars |
| `Change Main Status to...` | 08, 22 | Candidate list. FOOS has no candidate-status bulk action |
| `Change Req-specific status to...` | 22 | The requisition's candidate list, a second status axis FOOS does not model separately |
| `Printable View` | 18, 21 | Requisition record action bar, twice |
| `Attach Account` / `New Account` | 21 | Requisition record, beside the Contacts pair FOOS does have |
| `New Comment` | 21 | Requisition record |
| `Favorites Only` | 14 | Reports |
| `Reset` | 17 | Beside `Save` and `Cancel` on the requisition form |
| The action bar repeated at the bottom | 11 and 21 both OCR it twice | Every long list and record page. This is plan item **C4/F7**, still open |
| Strikethrough, sub/superscript, remove-format, blockquote, `Source`, colour, alignment, `Paragraph` | 17 | The rich-text toolbar, where FOOS has 8 of roughly 16 buttons |

## What I got wrong

**Two claims I made earlier today and then refuted myself.**

I flagged `Change Status to…` versus `Change status to…` as a casing inconsistency between `ModulePlaceholderPage.tsx:146` and `RequisitionListPage.tsx:570`. **It is faithful replication, not a bug.** Screenshot 11 shows Taleo's employees screen using `Change Status to...` with a capital S, and screenshot 07 shows the requisition home using `Change status to...` with a lower-case s. FOOS matches each screen. Taleo is the inconsistent one and the replica is correct to copy it.

I noted that Taleo's sidebar switches to `Employee Keywords` on employee modules while FOOS says `Candidate` everywhere. **Wrong**: `ShellSidebar.tsx:79` renders `{scope.noun} Keywords`, so FOOS already adapts it, and the global-search test drives it as `Deal keywords` on the deals page. I had generalised from a single dashboard screenshot.

**One stale claim in an existing document, now corrected.** The 2026-09-01 fidelity report says of the calendar view icons: "Prompt section 8.1 requires view icons for day, 7-day, 31-day, person, group, and agenda. Measured: zero such controls." There are now **six**, in `pages/CalendarViewIcons.tsx`, added since that audit. They are placeholders, so the underlying gap F2/F3 stands, but "zero such controls" is no longer true.

**The brief's own premises were wrong in two places** and I checked rather than repeated them: the control count (61, actually 77) and the screenshot location (`docs/02-taleo-fidelity/`, actually Drive).

## What this did not cover

- **I read 10 of the 26 screenshots, not all 26.** The 16 unread are 02 to 05 (calendar states), 06 (pipeline), 09, 10, 13 (accounts, contacts, users homes), 16 (new requisition upper), 18-duplicate and 20 (requisition record middle), and 23 to 26 (candidate record sequence). Every verdict above cites a screenshot I actually read. The most likely thing hiding in the unread 16 is more entries for the "Taleo controls FOOS does not have" table, and confirmation for `Flag` and the toolbar's list and link buttons.
- **OCR cannot see icons**, so six gear and glyph controls are judged on function and on the store behind them, never on OCR silence.
- **No verdict here is a design review.** Whether a built control should look or behave exactly as Taleo does is Goal 3 and Goal 4.
- **The sizes are estimates**, from the tables and components each control would touch. They are not measured, and they are the least reliable column in this document.
- **`Delete` on the deals list and `New Ticket` have no Taleo evidence and cannot have any**, because Deals and Tickets are FOOS additions. I have said so in their rows rather than implying a screenshot backs them.

## Parked for Klent

Neither is a judgement I should make, so both go to the parked register rather than being guessed at.

| | Question | Why it is yours |
| :---- | :---- | :---- |
| **P4**, already parked | Is the ATS meant to be read-only on a phone? | It decides the shape of the G1-2 fix, and eight capabilities besides |
| **P5**, new | What URL does `Web Support` point at, and what does `Help` contain? | Both are real Taleo controls, so they stay. They need a destination, and that is a business answer, not a technical one |

## Where the evidence lives

| Artefact | Path |
| :---- | :---- |
| The 26 Taleo screenshots | Google Drive, per the folder named in `docs/05-reference/VVPH_VV-FOOS_Index_Drive-Source-Documents_2026-09-01_v1.0_Draft.md` |
| The measured inventory of all 77 controls | Regenerate by scanning `app/src/**/*.tsx` for `PlaceholderAction` and `show(` and expanding the two `.map()` sites |
| Per-role screenshots of every control in place | `audit/corpus/role-matrix/`, gitignored |

The Taleo screenshots show VentVest's live ATS and **their OCR contains real candidate names**. **No name from them appears in this document**: every citation is a control label, a column header, a section title or a screenshot number.
