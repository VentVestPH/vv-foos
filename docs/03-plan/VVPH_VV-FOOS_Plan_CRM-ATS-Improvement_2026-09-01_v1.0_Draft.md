# CRM and ATS Improvement Plan

**Project:** VV-FOOS · **Owner:** John Buena · **Prepared by:** Klent Roel Zarsuela · **Date:** 2026-09-01, revised 2026-09-02 · v1.2 Draft

Goal as stated on 2026-09-01: make the CRM and ATS look and feel like Oracle Taleo, replace the Excel and Zoho dependence with one repository, and be ready by October. This plan sequences that work against verified evidence rather than assumption. Every claim it rests on was measured on 2026-09-01 against the live Supabase project, the running application at 2560 x 1600, or the source exports.

**Everything still open is listed as a checklist in section 8.** That is the section to read if you want the state of the work rather than its reasoning.

Supporting documents, all in this `docs/` tree:

- `01-current-state/` System inventory, and the defect and risk register
- `03-plan/…Register_Parked-and-Blocked-Items…` Everything real but deliberately not being worked on, and what each one waits for
- `02-taleo-fidelity/` Fidelity audit (the visual check the redesign report left open) and the gap-closure spec with exact values
- `04-research/` Icon strategy and the Kappa repository comparison
- `05-reference/` Drive source document index and authority order

## 1. Constraints that shape the sequence

| Constraint | Source | Effect |
| :---- | :---- | :---- |
| Recommendation on the Microsoft Dynamics decision due Friday 2026-09-04 | Meeting, 2026-09-01 | Three days. Anything meant to influence it must land first |
| Target completion October or earlier | Meeting, 2026-09-01 | See section 5 for why this means early to mid October |
| Contract concludes 2026-11-21 | Meeting, 2026-09-01. **Whose contract is unconfirmed** | If it is the engagement, handover quality becomes a first-class requirement |
| 30-day post-cutover measurement before cancelling subscriptions | Delivery plan v1.3, Gate 6 | Cutover must be complete by roughly 2026-10-20 |
| Two gates remain before cutover | Delivery plan v1.3 | Gate 4's unstarted CSV dry-run half, then Gate 5 UAT |
| Screenshots outrank the redesign prompt; architecture outranks both | Redesign prompt section 3, Gate 1 lock | Governs how fidelity conflicts get resolved |

## 2. What is settled, and what is not

**Settled and working, so not in scope to rebuild.** All eight agent tracks are built. 19 of 20 routes render the Taleo replica with correct titles, no horizontal scroll and zero console errors. Drag-and-drop already exists on the application pipeline and the deals board via `@dnd-kit`. RLS enforces the four-role matrix in Postgres. 75 Zoho candidates, 154 notes and 50 attachment records are migrated. Accessibility semantics are sound: real `<button>` accordion headers with `aria-expanded`, all 54 inputs labelled, all icon buttons named, visible focus ring, no clickable divs.

**Corrected premise.** Taleo did not have drag-and-drop. The reverse-engineering report describes its pipeline as "a page of accordions" and lists kanban under Modernize as a FOOS addition. Drag-and-drop is therefore already delivered and is a FOOS improvement over Taleo, not a gap. Worth not promising Oracle parity and drag-and-drop as the same thing, since they pull in opposite directions.

**The Zoho API limits do not constrain this migration.** Checked against Zoho's own published limits on 2026-09-02. Both products meter the same way: credits on a rolling 24-hour window, 1 credit per ordinary call.

| | Recruit | CRM |
| :---- | :---- | :---- |
| Free | 5,000 credits / 24 h | 5,000 credits / 24 h |
| Standard | 5,000 + (users x 250), cap 100,000 | 50,000 + (users x 250), cap 100,000 |
| Professional | 10,000 + (users x 500), cap 500,000 | 50,000 + (users x 500), cap 3,000,000 |
| Enterprise / Zoho One | 15,000 + (users x 1,000), cap 1,000,000 | 50,000 + (users x 1,000), cap 5,000,000 |
| Concurrent calls | 5 free, 10 standard, 15 professional, 20 enterprise | same, plus 25 on Ultimate |

A full pull of both products at 200 records a page costs a few hundred credits: 75 candidates, 154 notes, 50 attachment downloads, 86 accounts, plus contacts, leads, meetings and job openings. That fits inside the **Free** allowance with room to repeat it several times a day. Two limits do apply in practice: the sub-concurrency ceiling of 10 on all editions, which is why the client requests serially, and the 100-records-per-call write limit, which this migration never reaches because it only reads. Export limits are a separate budget from API credits, so the CRM export cap you hit does not restrict the API.

**Needs a decision from John before implementation.** Listed in section 6. The two that block work are the long-text handling conflict and the QA-002 severity call.

## 3. Workstreams

Effort figures are estimates, marked as such, and assume one person.

### Workstream A. Integrity and handover

The highest-priority stream because every item degrades if it is discovered late, and two of them damage a handover directly.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| A1 | Write the two missing migration files to match production: the seven Zoho columns, `zoho_id_map`, the `offer` value on `attachment_kind`, and the 18 `candidate_statuses` and 12 `sources` seed rows. Plus the Agent 6 RPC migration | D3. Verified present live, absent from `supabase/migrations/`, while `database.types.ts` already declares them | 1 to 2 h |
| A2 | Verify `supabase db reset` from the repository reproduces production, then keep doing so | D3 | 1 h |
| A3 | **READY, PROVEN LOCALLY 2026-09-02.** `scripts/backfill-zoho-candidate-fields.mjs` matches source rows to `candidate_profiles` through `zoho_id_map` and writes only the fields that differ. Proven end to end on the local stack: the 75 imported rows were deliberately damaged (grades nulled, dates moved to day 1), the dry run reported exactly 37 grades to set and 74 dates to correct, `--apply` wrote 75 rows with 0 failures, and a second run reported 0 changes. Applying it to production is one command with `--allow-remote`, which is yours to authorise | D1. 37 of 75 source rows carry a Rating; all 75 live rows are null | 2 to 3 h |
| A4 | **FIXED AND PROVEN 2026-09-02.** The root cause was a third source format nobody had listed: `Initial Date` carries `M/DD` on 43 rows and **`DD-Mon` on 31 more** (13 `NN-Jun`, 18 `NN-May`), and `parsePartialDate` only understood the first. Extended to accept `DD-Mon`, `Mon-DD` and space separators, still borrowing the year from the row own `Created Time` and still refusing a day that month does not have. Parse rate went from **43 of 74 to 74 of 74**. The same backfill script corrects rows already written | D2. Four source formats, two of which fail | 2 h |
| A5 | Add `experience` to the Insert and Update types | D9. Blocks the Experience Details import once re-exported | 15 min |
| A6 | Add a migration-drift guard so A1 cannot recur. Kappa runs a `db-migrate.yml` GitHub Action; the equivalent here is a check that fails when applied migrations and repository files diverge | D3 root cause | 3 to 4 h |

**Status 2026-09-02, second entry.** Done: A1, A2, A5, A6, and A4 in full. A3 is written, proven locally and idempotent; only the production write is outstanding, and that is one command whenever you say so.

### Workstream B. Security and access

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| B1 | Resolve QA-002. Either John signs off the Medium downgrade or `careers_rate_limit` gets RLS enabled | QA brief makes every RLS finding Critical by default and forbids downgrade without sign-off | 30 min once decided |
| B2 | **TOOL READY 2026-09-02.** `scripts/rotate-persona-passwords.mjs` sets a fresh 24-byte random password on each of the four persona accounts through the Admin API, prints each value exactly once and stores none. Proven against the local stack: 4 of 4 accounts found. It refuses a non-local target without `--allow-remote`. Rotating the live values is a production action and stays yours | QA-003, re-rated to High. The database now holds 76 real people, 154 candid assessment notes, and attachment metadata referencing identity and tax documents | 1 h |
| B3 | Decide whether `klent@ventvest.com` needs a real `staff` row, so work happens under a real identity rather than a shared demo admin | No such row exists; Google sign-in currently hits the hold screen | 15 min |

**Status 2026-09-02, second entry.** Done: B1. B2 has a working tool, proven locally; rotating the live values is yours. B3: the local half is done and the production staff row is your call, with the recommendation in 6.9.

### Workstream C. Taleo look and feel

This is the stream that answers the meeting's stated goal. Full values in the gap-closure spec.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| C1 | **DONE 2026-09-01.** nav `#427d98` (4.55:1), sidebar header `#577995` (4.59:1), count badge text `#222222` on the unchanged green (6.80:1), new `--taleo-control-border: #8f8f8f` (3.23:1). Re-audited: 11 pairs, 0 failures | F1. The failing control border turned out to be a hard-coded `#999` at 2.85:1, not the `#d5d5d5` token | done |
| C2 | Build the mini month calendar and the six calendar view icons | F2, F3. Prompt section 8.1. Screenshots 02 to 05 are currently unused | 4 to 6 h |
| C3 | Shell geometry: utility header 72px to ~104px, sidebar 300px to 340px | F4, F5. Spec says ~110px and 19% of viewport | 1 h |
| C4 | Add the repeated bottom action bar and pager to `ListPage`, so all seven lists inherit it | F7. Prompt section 7.3 and the reverse-engineering report both require it. Measured zero | 2 to 3 h |
| C5 | Paginate the candidate list at 20 rows, Taleo `1-20 of N` format | F8. Currently unpaginated at 83 real rows, so this is also a growth problem | 2 h |
| C6 | Move the `Flags` column from last to second | F9 | 15 min |
| C7 | **DONE 2026-09-01**, and wider than scoped: Timeline, the whole `CHANNEL_ICON` map, recruit `StarGrade`, the ApplicationPipeline shortlist flag, the placeholder gear, and three Google scope marks | D13. Six sites, not one. The recruit `StarGrade` had been missed when its intake sibling was converted at redesign time | done |
| C8 | **DONE 2026-09-01.** `lucide-react` pinned exact at 1.25.0 (ISC), matching Kappa. Existing 21 shell icons untouched. Note: Lucide v1 removed brand icons, so LinkedIn uses `Link2` | Icon strategy report. The 1.x versioning is legitimate: npm latest is 1.38.0 | done |
| C9 | Add icon-size tokens (`--icon-xs`, `--icon-sm`, `--icon-md`) borrowed from Kappa's approach | Icon strategy report section 2 | 30 min |
| C16 | Token consolidation. Colour is already 96% centralised (694 `var(--token)` references against 26 raw hex outside `tokens.css`), so this is a sweep, not a rebuild: replace the 26 strays, and add the missing semantic tokens they imply (a surface-white, two muted greys, and the three status tints in `intake.css` and `settings.css`) | Measured 2026-09-01. Strays sit in `app.css` (16), `intake.css` (5), `recruit.css` (3), `settings.css` (2). `dashboards.css` and `sales.css` are already clean at zero | 2 h |
| C17 | Spacing and sizing tokens. This is the real gap: 210 raw `px` values against a spacing scale of only `--sp-half`, `--sp-1` to `--sp-4` and `--cell-pad`. Extend the scale and sweep, worst files first (`app.css` 109, `recruit.css` 41, `sales.css` 19, `intake.css` 18) | Measured 2026-09-01. Without this, the geometry changes in C3 and the density decision in F10 have to be made by hand-editing scattered values | 3 to 4 h |
| C10 | Apply John's trimming notes: hide salary fields in list views, reduce clicks, tighten layout. Record that this supersedes the prompt's no-field-removal rule | Meeting, 2026-09-01. Note the columns must stay; only the views change | 2 to 3 h |
| C11 | Commit the contrast check as a script, since colour regressions are silent | F1 recurrence risk | 1 h |
| C12 | **DONE 2026-09-01.** `scroll-padding-top: 56px` on `.shell-content` (the real scroll container, not `html`) plus a `useStickyFocusGuard` hook for the residual case where the target is already in view behind the bar. Verified: both record pages pass tabbing in both directions | F12, D11. CSS alone was insufficient, see note below | done |
| C13 | Make Back To List restore the originating list URL including filters, saved view, sort and page. Add previous and next paging on record views on the same plumbing | F13, D12. Documented Oracle behaviour, verified 3-0 | 3 to 4 h |
| C14 | Surface a per-record status history table: Status, Previous Status, Duration, Date In, Date Out, Comments | Documented TBE behaviour. All underlying data already exists (`status_change` activities, `stage_changed_at`, `dash.mv_stage_durations`); only the component is missing | 4 to 6 h |
| C15 | Wire the already-drawn bookmark icon to a Bookmarks feature, up to 20 entries | Oracle shipped this in TBE 17A2 precisely because Recently Viewed evicts entries. FOOS caps Recently Viewed at 15 and has the same problem | 4 to 6 h |

**Status 2026-09-02.** Done: C1 to C17, all of them.

### Workstream D. Data completeness

One Zoho session, so the export is not revisited three times.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| D1 | Export Zoho CRM clients and accounts | Entirely unmigrated. The July plan scoped it out explicitly | 2 to 4 h |
| D2 | Export Zoho Recruit job openings and requisitions | Same | 2 to 4 h |
| D3 | Re-export Education Details with its full field set | Current file is header-only, zero data rows, verified | 30 min |
| D4 | Re-export Experience Details with its full field set | Same, and byte-identical to the education file. `people.experience` was added in July to receive it and is empty on every row | 30 min |
| D5 | Bulk attachment file download, matched by Attachment Id or File Name | `Attachment URL` blank on all 50 rows. All 50 live `storage_path` values are `pending-file-export/` placeholders | 1 to 2 h |
| D6 | **DONE 2026-09-02.** `lib/attachments.ts` recognises both placeholder prefixes the migration has used (`zoho-import/pending/` and `pending-file-export/`). A pending file is listed with its name as plain text plus a "File not yet available" badge instead of a link, `attachmentUrl` returns null without a pointless round trip, and the resume preview says why rather than showing "Loading resume preview" for ever, which is what it did before. Two browser tests cover it: the pending file is badged and not a link, and a real uploaded file in the same list still is | Recommended in the migration plan, not yet built | 1 h |
| D7 | **DONE.** Alias in `SOURCE_ALIASES`. A second alias was needed on 2026-09-02: the Zoho candidate status `Hired` had no row in `candidate_statuses` and is the same state FOOS calls `Placed`, so `STATUS_ALIASES` maps it. Unresolved statuses are now zero | D4. Source data says `Facebook Messenger`, seed says `FB Messenger` | 15 min |
| D8 | **DECIDED 2026-09-02: keep.** Address data is largely absent: street 1%, city 31%, province 13%, postal 1%. Fields stay, no backfill. | Meeting listed addresses as required. The fields exist; the data does not | done |
| D9 | **DONE 2026-09-02.** `scripts/add-legacy-owners.mjs` reads every owner column across all five exports, lists the ones with no `staff` row, and creates each as `is_active = false` with a `legacy+<slug>@import.invalid` address so a later real signup cannot collide on the unique email. Names are redacted unless `--show-names`. Applied locally: **3 owners created, and unresolved staff went from 3 distinct values across 325 rows to zero** | Without it every `created_by` and `uploaded_by` on those rows is null, and the audit trail says nobody did the work. The CRM `Users` export does not help: it is CRM-side only and 4 of its 8 rows are system accounts. Recommendation and its trade-off in section 6.9 | 1 h |
| D10 | **DONE 2026-09-02.** `migration/src/map-companies.mjs` maps all **86 of 86** Accounts rows with 0 skipped: name, types, website with a scheme added, city, province, country, phone, owner and both timestamps, and it reports the source fields `companies` has no column for rather than dropping them silently. `map-contacts.mjs` is written and wired the same way and reports export columns it does not recognise; it waits only on the Contacts export. 12 unit tests cover both | Accounts export has 86 rows and no mapper exists. This is the CRM half of D1 | 3 h |
| D11 | Pull Recruit and CRM through the API instead of waiting on emailed exports | Unblocks D2 to D5 and E7 without involving John. Credit cost measured against the published limits in section 2 | 2 h |

**Status 2026-09-02, second entry.** Done: D1, D6, D7, D8, D9, D10. Open: D2, D3, D4, D5 and D11, every one of them waiting on data this environment cannot produce. D3 and D4 need a re-export with the full field set; the files on disk are header only, 3 columns. D2 needs the job-openings export. D5 needs the attachment bytes. D11 needs a Zoho Self Client, which only you can create.

### Workstream E. Metrics and gates

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| E1 | Build the four success metrics: adoption, cycle time, cost, data quality | QA-008, the one High with a deadline. Phase 6's 30-day window cannot open without it | 1 to 2 days |
| E2 | Decide `reminder.due`'s fate | QA-007. Works, has no interface | Decision |
| E3 | Fix `tests/playwright.config.ts`: port 5173 to 5175, and stop using `networkidle` on Realtime routes | Verified: `strictPort` 5175 means the config cannot work; `/intake` never reaches networkidle because of its subscription | 30 min |
| E4 | Create `tests/.env` and run the Vitest API suite | Absent, which is why it has never run. Network to Supabase now works from here | 1 h |
| E5 | Run the three Playwright specs and the regression checklist | Never executed anywhere. Chromium now installs and launches on this machine | 3 to 4 h |
| E6 | Close the 32 traced-but-unverified criteria and the 12 with no test | Gate 4 exit report | 1 to 2 days |
| E7 | **REHEARSED 2026-09-02 on every export that exists.** The full cycle ran against the local stack: apply, re-apply, damage, backfill, re-backfill, purge. Results: 75 of 75 candidates, 141 of 154 notes, 42 of 50 attachments with the 8 identity documents held back, 86 of 86 companies, 344 `zoho_id_map` rows. The second apply reported 0 new and every row existing, which is idempotency demonstrated rather than assumed. Every lookup resolves: 0 unresolved staff, 0 unresolved sources, 0 unresolved statuses. `scripts/purge-zoho-import.mjs` reverses the whole thing from `zoho_id_map`, storage objects before attachment rows. What is still unrehearsed is only what has no data: job openings, education and experience | Unstarted. Blocks Gate 5, which is the cutover trigger | 1 to 2 days |
| E8 | Gate 5 UAT: recruiter script for ATS, BD script for CRM | Delivery plan v1.3 | 2 to 3 days elapsed |

**Status 2026-09-02, second entry.** Done: E1 to E5, E7 for every export that exists, E8. Partial: E6, at 70 of 82 acceptance criteria; the other 12 need a Google account, a production publish, a hosted sheet or a human click-through.

### Workstream G. UX polish and motion

Discovery found the application has **zero** transitions, animations, keyframes and `prefers-reduced-motion` handling across all seven stylesheets, confirmed at runtime as `transition: all 0s` on every probed element. Faithful to Taleo, and the reason every interaction lands abruptly.

The governing rule, from `06-ux-and-motion/`: Taleo was server-rendered, so it had no motion because it had no opportunity for motion, not because it chose against it. Motion diverges from Taleo only where Taleo had the same interaction and did it instantly. Where FOOS has an interaction Taleo never had, no precedent is violated. Full specification, prohibitions and verification checks are in that document.

**G1 to G4 need no motion at all** and are the cheapest quality wins available in this plan.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| G1 | **DONE 2026-09-01.** Explicit ring at `--taleo-primary` (4.61:1). Verified: keyboard gives `solid 2px`, mouse gives `outlineStyle: none` | 0 occurrences before | done |
| G2 | **DONE 2026-09-01.** Three rules, colour only, no transition so it does not depend on G5 | 0 occurrences before | done |
| G3 | **DONE 2026-09-01.** Defaulted `TaleoPlaceholderAction` to `aria-disabled`, then marked 10 hand-rolled `show()` buttons. Coverage across nine pages went **0 to 85 controls**, all still tabbable and dimmed | Prompt section 2 | done |
| G4 | **PARTIAL 2026-09-01.** `UnviewedBadge` now wraps a persistent `aria-live="polite"` region. Correction to the finding: six implicit live regions (`role="alert"`/`role="status"`) already existed on banners and toasts, so the real gap was the counters. Still open: dashboard refreshes do not announce, and the intake badge cannot because nothing renders it (D17) | Verified 3 live regions on the requisition list | partial |
| G5 | Add motion tokens and the `prefers-reduced-motion` block **in one commit** | Nothing may animate before reduced-motion handling exists | 1 h |
| G6 | Category B motion: Realtime badge change, intake drawer slide, modal fade, Kanban drop settle, promotion banner, filter result change, inline validation | Interactions Taleo never had, so no fidelity risk. This is where the benefit is | 4 to 6 h |
| G7 | Category A motion: accordion header hover, row hover, buttons, sort caret, nav tab. All 80 to 120ms, colour only | Interactions Taleo had. Highest fidelity risk, so smallest budget | 2 h |
| G8 | Loading states for the `sales` module | 0 of 16 files have one; lists render empty then populate | 3 h |
| G9 | `aria-busy` during fetches, `:checked` checkbox styling, empty states for `settings` and `intake` | 0, 0, and 0 of 3 / 2 of 7 respectively | 2 h |
| G10 | Commit the motion-budget, reduced-motion and Category-C guard checks as scripts | Motion is easy to add and hard to keep bounded | 2 h |

**Status 2026-09-02.** Done: G1 to G10. Coverage caveat and the repairs it needed are in workstream H.

Note that C16, C17, C9 and G5 together give the application four complete token sets: colour, spacing and sizing, icon sizing, and motion. Colour was already in good shape; the other three are new or incomplete.

Hard prohibitions carried into implementation, so the replica cannot drift: no page or route transitions, no staggered list entrances, no skeleton shimmer, no scroll-triggered reveals, no overshoot or bounce easing, no motion on shell geometry or table row heights, and nothing over 220ms.

### Workstream F. Engineering hygiene

Optional against the October date, but it is what makes a November handover survivable. Kappa is the reference: it runs `ci.yml`, `db-migrate.yml` and `deploy.yml`, plus a linter. FOOS has none of these and typecheck is its only static gate.

| # | Task | Est. |
| :---- | :---- | :---- |
| F1 | Add a linter and formatter | 2 h |
| F2 | Add CI running typecheck, build, lint and the contrast script | 3 h |
| F3 | Resolve the four `Relationships: []` module shims by adding `Relationships` to `database.types.ts` and deleting all four | 2 h |
| F4 | Decide the fate of the other two frontends. Three interchangeable frontends against one schema is three times the surface for every future change. **Recommendation 2026-09-02: archive both.** Neither is present on this machine, so nothing is lost today by declaring them frozen, and the maintenance surface for every schema change and every `database.types.ts` edit drops by two thirds. Delete only once John confirms nobody demos from them | Decision |

**Status 2026-09-02, second entry.** Done: F1, F2, F3, and F4 is decided (archive, do not delete). See section 6.

### Workstream H. Frontend consistency and the rest of the motion

Added 2026-09-02 after re-auditing the frontend rather than trusting the completion table above.

**What is genuinely centralised, verified by reading all seven stylesheets:** 852 `var()` uses, 79 tokens, 30 raw hex values of which **all 30 sit in `tokens.css` where they are defined** and 0 sit anywhere else, 0 raw `font-size` values in pixels, 13 shared components in `components/ui/`, and `aria-busy` threaded once through `Table.tsx` so a single occurrence covers every table in the application. Those claims hold.

**Correction to the completion table, and what it turned out to be.** Workstream G was 10 of 10 by *task* while its coverage was thinner than that read: 7 grouped CSS rules, colour and opacity only, no keyframes, two of G6's seven named interactions missing, and the icon decision applied in 8 files while 21 hand-rolled SVG icons still sat in the shell. Investigating it found something worse than thin coverage, recorded as D34: six of the selectors carrying panel motion matched no rendered class at all. H1 to H6 closed all of it on 2026-09-02.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| H1 | **DONE 2026-09-02.** `shell/icons.tsx` deleted. All 24 consumers now import lucide directly, aliased to the existing local names (`House as HomeIcon`). One `LucideProvider size={20} strokeWidth={1.6}` at the root supplies the defaults the hand-rolled `base()` used to, so the 7 call sites that repeated `strokeWidth={1.6}` no longer do. lucide v1 sets `aria-hidden` itself when an icon has no accessible name | `lucide-react@1.25.0` is already a dependency and 8 files import it. The 21 that do not are the primary nav, the sidebar and the utility header, which is the most-seen iconography in the product. Sizes come from the existing `--icon-xs/sm/md/lg` tokens | 3 h |
| H2 | **DONE 2026-09-02.** One `components/ui/StarGrade.tsx` with a `size` prop. The intake copy hard-coded `#c9a227` and `#4a7098` inline, which is why the token sweep never caught them; colour now comes from `.star` and `.star.on`. The four duplicated CSS blocks in `intake.css` and `recruit.css` collapsed into one in `app.css` | `modules/recruit/components/StarGrade.tsx` uses lucide; `modules/intake/components/StarGrade.tsx` hand-rolls an `<svg>`. Same control, two implementations, one icon decision | 1 h |
| H3 | **DONE 2026-09-02.** `lib/format.ts` exports `EMPTY_CELL`. 34 literals across 14 files replaced. Most were string values inside `render:` callbacks rather than JSX, so a constant was the right shape, not a component | 28 occurrences across the list and record pages. A single definition is also the only way to change the convention once | 1 h |
| H4 | **DONE 2026-09-02.** Kanban: `KanbanBoard` tracks the dropped card id and clears it after 200ms, and `.kanban-card.settling` runs a 140ms scale-and-fade. Filter results: `Table` derives a signature from row count plus first row key and alternates two class names so the animation restarts without remounting `tbody` | The other five of G6's seven interactions are in `app.css`. These two are named in the motion spec and absent | 2 h |
| H5 | **DECIDED AND DONE 2026-09-02: enter only, no exit.** The finding was worse than "unverified". Six of the selectors carrying panel motion match no markup at all: `.taleo-drawer`, `.modal`, `.dialog`, `.modal-backdrop`, `.dialog-backdrop` and `.taleo-placeholder-backdrop`. The real classes are `.intake-drawer`, `.sales-modal`, `.rq-dialog` and their `-overlay` siblings. `.sort-caret` was dead too; the rendered class is `.sort-arrow`. And because every one of these components mounts and unmounts, a `transition` could never have run on them. Replaced with three keyframes (`panel-slide-in`, `overlay-fade-in`, `panel-fade-in`) on the selectors that exist. Exit animation is not implemented: it needs the panels to stay mounted while animating out, which is a component change rather than a stylesheet one | 0 `@keyframes` means the drawer and modal rules animate opacity and a transform on an already-mounted element. Whether that reads as motion at runtime is **not verified**, only read from `app.css` lines 1455 to 1512 | Decision + 2 h |
| H6 | **DONE 2026-09-02.** Four tokens: `--scrim`, `--tint-on-dark`, `--shadow-raised`, `--shadow-overlay`. Seven `rgba()` values, not five. Three of them were the same modal scrim at two different opacities in three module stylesheets, now one value. No `rgba()` remains outside `tokens.css` | The only colour values left outside the token file, and they are the ones a dark mode would have to change | 30 min |
| H7 | **DONE 2026-09-02.** The real VentVest logo now appears on the login page (200px), in the utility header (132px) beside "Front Office OS", and as the browser icon. The supplied asset is a 1038x231 wordmark, which makes an illegible favicon at that ratio, so the V-and-arrow mark was cropped out of it to a square and rendered at 64px, plus a 180px opaque apple-touch icon | The header wordmark was CSS text in `--taleo-brand-red`, which was the placeholder. This is a deliberate divergence from the Taleo screenshots: the replica had a red text wordmark there | done |

**Status 2026-09-02.** Done: H1 to H6, all of them. See the implementation note below.

Hard prohibitions from Workstream G still bind H4 and H5: nothing over 220ms, no page or route transitions, no staggered entrances, no shimmer, no overshoot easing, no motion on shell geometry or row heights.

### Workstream J. Repository cleanup

Added 2026-09-02 at your request. Every item below was verified on disk, not inferred. J1 to J6 are mechanical and total under an hour; J7 matters more than its size suggests.

| # | Task | What exactly, and how it was verified | Est. |
| :---- | :---- | :---- | :---- |
| J1 | **DONE 2026-09-02.** 16 files removed | Vite writes one per config reload and does not always clean up. All 16 are untracked, so deleting them cannot change git state | 5 min |
| J2 | **DONE 2026-09-02.** Removed | 404 KB of build output belonging to the frontend this tree was rsynced from. This project builds to `dist-redesign-2/`. Nothing in the repo reads `app/dist` | 5 min |
| J3 | **DONE 2026-09-02.** Removed | 13 lines that launch Chromium against `data:text/html,<h1>hi</h1>` and print `TITLE_OK`. A throwaway Playwright smoke check. It is tracked, so this one needs a commit | 5 min |
| J4 | **DONE 2026-09-02.** Both removed | Dead. A basename scan of every `.ts` and `.tsx` file in `app/src` found the only occurrences of either name are their own definitions. Superseded by `TaleoUtilityHeader` plus `TaleoPrimaryNav`, and by `TaleoModulePlaceholderPage` | 15 min |
| J5 | **DONE 2026-09-02.** Both removed | Already matched by `.gitignore`, still sitting on disk | 5 min |
| J6 | **DONE 2026-09-02.** Removed | Empty. Git tracks no directories, so it exists only to imply a fixture that is not there | 5 min |
| J7 | **DONE 2026-09-02.** Five stale statements, not three. Corrected: the "no `.git` here" claim, the "no linter" claim, the vitest glob claim (it already includes `mocks/**`), the claim that the Vitest suite runs against the live project (it runs against whatever `tests/.env` names, which is now local), and the claim that `playwright.config.ts` targets port 5173 (it defaults to 5175 and starts its own server). Added a statement of the no-comments rule | It states "There is no `.git` here. No branches, no diffs, no history to consult", which is false: this is a git repository on `develop` with `origin/main` and `origin/develop`. It also states "There is no linter and no ESLint/Prettier config", which is false: `app/eslint.config.js` exists, `lint` and `lint:fix` are npm scripts, and CI runs `npm run lint --workspace=app`. Stale project instructions mislead every future session, including mine | 30 min |
| J8 | **NO CHANGE NEEDED 2026-09-02. The premise was wrong.** `tests/vitest.config.ts` already includes `mocks/**/*.test.ts`, and the file runs: 2 tests, both passing, in every run of the suite. It does throw at import time when `FOOS_INTAKE_PARSER_SECRET` is unset, which is the correct fail-loud behaviour for a test that cannot run, so it is left as it is. The stale claim was in `CLAUDE.md` and this plan repeated it | Outside `vitest.config.ts`'s `api/**/*.test.ts` glob, so it has never run once. Either widen the glob and make it pass, or delete it. A test that cannot run is worse than no test because it reads as coverage | 30 min |
| J9 | **DONE 2026-09-02.** Both directories emptied; the build repopulates `dist-redesign-2` from clean | `emptyOutDir: false` means every build adds hashed assets and removes none; the directory now holds 123. Playwright artifacts accumulate the same way. Both are gitignored, so this is disk hygiene, not repository hygiene | 10 min |
| J10 | **DONE 2026-09-02.** Pruned this plan's three superseded status sections | 58 lines of contradicting history removed from a live document | done |
| J11 | **DONE 2026-09-02.** A status line under each workstream table naming which task ids are done, blocked or open | Only 9 of 75 task rows carry a DONE marker while the completion table says 48½ are done. Anyone reading a workstream table today concludes almost nothing is finished | 1 h |

**Status 2026-09-02.** Done: J1 to J7, J9, J10, J11. J8 needed no change; see the correction below.

**Not cleanup, do not delete:** `migration/zoho-exports/` and `migration/out/` hold real candidate and customer PII. Both are gitignored and both must stay on disk until the migration is signed off. `app/src/modules/recruit/__typecheck__.ts` and its `sales` twin look unreferenced to a scan but exist so `tsc` type-checks each module's public exports; they are load-bearing.


### Workstream K. Data access and query performance

Added 2026-09-02 from six background audits. **K1 is the single largest piece of work left in the codebase and the plan had never identified it.**

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| K1 | **REFRAMED 2026-09-02 by measurement, and the urgent half is DONE.** The claim in this row was that client-side filtering will not scale. Measured against a production build at 500, 2,000 and 5,000 candidate rows, that is **not supported**: load stayed at 60ms LCP, keystroke latency at 24 to 27ms and sort at 32ms at every volume, and 32ms is the floor of the measuring technique rather than real cost. What the test found instead was a **correctness bug that fires first**: PostgREST caps a response at 1000 rows, `Content-Range: 0-999/5007` confirmed by direct call, and no list page paginated or checked. The pager read "1-20 of 1000" while the table held 5,007 rows, silently discarding the rest with no error. Fixed the same day with `lib/fetchAll.ts`, applied to all six list pages, with 6 unit tests. Server-side filtering is still the right destination, but it is now an efficiency task rather than a correctness one | **Every list page fetches its entire table.** There is no `.ilike(` and no `.range(` anywhere in `app/src`: candidates, requisitions, deals, companies, contacts and tickets all issue `select('*')` with no WHERE and no LIMIT, then filter and search in JavaScript. Fine at 10 seed rows, fails at 10,000. No index can fix it | 2 to 3 d |
| K2 | **DONE 2026-09-02.** Migration `20260902000001`. Proof, not assumption: with 30,000 activities against one person, `EXPLAIN (ANALYZE)` on the per-person timeline query returns a bare `Index Scan using idx_activities_person_occurred` with **no Sort node at all**. At the seed volume the planner still prefers a bitmap scan plus a sort, which is correct at 40 rows and is why the earlier measurement needed synthetic volume to say anything | Measured with EXPLAIN ANALYZE against 200k synthetic activity rows and 50k applications inside a rolled-back transaction: Bitmap Heap Scan followed by a separate Sort node, which is the composite-index gap. `tasks` already has the equivalent index and `reminders` does not | 1 h |
| K3 | **DONE 2026-09-02.** Same migration. `deals.primary_contact_id`, `tickets.person_id` and `intake_items.duplicate_of` are indexed, so deleting a person on the documented purge path no longer forces a sequential scan of three tables | All three are `ON DELETE SET NULL`, so deleting one person forces a full scan of three tables. The README's purge order starts with `people` | 30 min |
| K4 | **DONE 2026-09-02.** `idx_applications_requisition` dropped, and `validate.sql` check 16 fails if it comes back, since a leading-prefix duplicate is easy to reintroduce by habit | A strict leading prefix of the unique `(requisition_id, person_id)` index, so Postgres never needs it. Pure write overhead | 15 min |
| K5 | **DONE 2026-09-02, with the recommendation narrowed by measurement.** The audit said to wrap every policy predicate. Measuring first showed that is wrong for half of them. On 20,010 rows a bare `get_my_role()` comparison filters in **60.3ms** and the same predicate wrapped in a scalar subselect plans as an `InitPlan` and runs in **2.5ms**, a 24x difference, because the call is argument-less and can be hoisted out of the row loop. But `can_read_person(id)` takes the row as an argument, cannot be hoisted, and measured **187.5ms wrapped against 179.8ms bare**, so wrapping it is a small loss. Migration `20260902000002` therefore rewrites the **51 policies that call `get_my_role()` or `auth.uid()` bare** and deliberately leaves the row-dependent helpers alone. The migration was generated from `pg_policies` rather than hand-written, so each policy keeps its exact command, roles, permissive flag and predicate. Real effect: the `candidate_profiles` read policy now plans as three `InitPlan`s and the count over 20,000 rows runs in **1.6ms**. `validate.sql` check 17 fails if any argument-less helper goes back to being called per row | Every policy function is correctly marked `STABLE`, which was the first thing checked, but all are called bare. Supabase's own performance guidance is to wrap them so the planner caches the call as an InitPlan instead of re-invoking per row | 3 h |
| K6 | **DONE 2026-09-02.** Both loops collapse to one request each. Owners use `.in('staff_id', removed)`. Approvers need a pair-wise match, because the key is `(staff_id, approver_type)` and a staff-wide delete would remove an approver's other role, so they use `.or()` with an `and(...)` clause per pair. Three API tests prove it against a real database, including one asserting that removing `(staff, requisition)` leaves that same staff's `(staff, offer)` row intact, which is the failure mode a naive fix would have introduced | Two `for` loops with an `await` inside each, so N removed approvers means N serial round trips | 1 h |
| K7 | Explicit column lists in place of `select('*')`, dashboards first | 73 call sites. The dashboard queries refresh every 15 minutes over the widest tables and pull every column to compute aggregates | 4 h |
| K8 | **DONE 2026-09-02, and it went further than planned.** Deferring `CandidateRecordPage` and `ContactRecordPage` took first load from 159.2 to 136 KB gzipped. Re-measuring then showed `KanbanBoard`, at 14 KB and carrying `@dnd-kit`, still loading on the candidates list, which has no board: it arrived through `ApplicationPipeline` on the requisition record page. Deferring the requisition record and form pages too moved `KanbanBoard`, `SidePanelTabs`, `RecordPage`, `engagement` and `googleActions` off the list route. **Measured first load of `/recruit/candidates`: 129.6 KB gzipped, down from 159.2, a 19% cut.** The 10 remaining chunks are two thirds framework: 54.4 KB supabase and 51.8 KB react | Both are statically imported beside the list page, which drags `googleActions` into the list view. Measured first load of `/recruit/candidates`: **543 KB raw, 159 KB gzipped**. This defers about 19 KB gzipped | 1 h |
| K9 | **DONE 2026-09-02.** `emptyOutDir: true`. The comment claiming a sandbox file-sync layer prevented it is gone along with every other comment in the codebase, and a clean build now produces 20 chunks rather than accumulating generations | Measured: `dist-redesign-2` held **69 files across four build generations** before a manual clean, 21 after. Stale hashed chunks ship in the deploy artifact | 30 min |
| K10 | Measure authenticated Core Web Vitals and interaction latency | Currently unmeasured. `app/.env` points the production build at the live project, so `vite preview` cannot sign in locally. Needs either the live credentials or a decision to measure against the local stack, which measures loopback latency instead | Decision + 2 h |

| K12 | **DONE 2026-09-02.** The Vite dev server was watching its own build output | Found by looping the gates 30 times rather than 10. The suite failed roughly one run in eight, and only ever when `build` ran before `e2e` in the same pass: 14 consecutive browser-only runs never failed, and 12 consecutive test-then-e2e runs never failed either. Writing 20 hashed files into `app/dist-redesign-2` tripped the dev server's file watcher mid-test. `server.watch.ignored` now excludes both `dist` directories. **20 consecutive clean gate passes afterwards** |

| K11 | **DONE 2026-09-02.** Two duplicate requests on every page load, app-wide | `SessionProvider` called `loadStaff` from both the `getSession()` resolution and the `onAuthStateChange` callback, which also fires on mount, so two identical `staff` requests landed within 1ms. And `useIntakeBadge` called `refresh()` from its mount effect and again from the `SUBSCRIBED` callback, so two `intake_items` HEAD requests fired on every page in the application, both aborting. Both now fire once | done |

**Status 2026-09-02.** Done: the urgent half of K1, and K11. Open: K2 to K10. K2, K3, K4 and K9 are under two hours combined and carry no product risk.

**What the measurement changed.** Performance at real scale is not the problem this workstream assumed. Every Core Web Vital is far inside budget: LCP 56 to 68ms across five routes, CLS at or below 0.007, **zero long tasks anywhere**, and all five measured interactions at about 32ms, which is the measurement floor. Nothing is close to the 100ms threshold, let alone 200ms. So K7, and K5's per-row RLS concern, should be treated as hygiene rather than as urgent, and the ranking above reflects that. First-load JS for `/recruit/candidates` is 159.2KB gzipped, of which `vendor-supabase` is 55.9KB and `vendor-react` 53.2KB, so two thirds is framework and only K8's 15.3KB of `googleActions` is obviously wasted.

### Workstream L. Accessibility and responsive

Added 2026-09-02. An axe run across eight signed-in routes at four viewport widths, plus a 100-stop keyboard trace and a bounding-box scan for WCAG 2.2 target size.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| L1 | **DONE 2026-09-02.** Visible focus indicator on the sidebar quick-search input | `outline: none` with no replacement on `.fo-qs-input-row input`, which appears on every route. A genuine SC 2.4.11 failure that survived G1, because G1 verified the global ring and never checked for an override | done |
| L2 | **DONE 2026-09-02.** Skip-to-main link | There was none, and the cost was measured, not assumed: on the candidates list the first data row is **tab stop 75**, after the utility header, 14 nav tabs and the whole sidebar | done |
| L3 | **DONE 2026-09-02.** `role="img"` on four labelled spans | `aria-label` is prohibited on a generic element. Affected the star grade, the flag column header and the resume indicator, 10 nodes across 2 routes | done |
| L4 | **DONE 2026-09-02.** WCAG 2.2 SC 2.5.8 target sizes | Measured 16x14 star buttons (21 instances) and 13x13 row checkboxes (22 instances) against the 24x24 minimum. Fixed with padding, not icon scaling | done |
| L5 | **DONE 2026-09-02.** Accessible name on the sidebar landmark | `landmark-unique` fired on five routes | done |
| L6 | **DONE 2026-09-02.** Three contrast failures, and the guard that could not see them | The guard checked 17 hand-picked token pairs rather than the DOM, so it read 17 of 17 green while chips sat at **2.55:1**, links on a hovered row at 4.41:1 and side-tab labels at 3.59:1. All three fixed, guard now 23 pairs | done |
| L7 | Keyboard support on `KanbanBoard` | It wires only `PointerSensor`; cards have no `tabIndex` and no `onKeyDown`. The **requisition pipeline board is not keyboard-operable at all**, failing SC 2.1.1 and 2.5.7. The deals board escapes only because `DealRecordPage` happens to expose stage as a real `<select>` | 3 h |
| L8 | A scroll affordance or a collapse for the primary nav below about 1100px | Measured: at 1024px the 14-tab nav hides about 226px of tabs behind a bare native scrollbar, and at 768px about 482px, roughly the last four tabs. Nothing signals they exist | 3 h |
| L9 | Single-column reflow below about 900px | At 768x1024 the layout does not reflow: the candidates table sits about 1400px below the fold and 950px to the right, reachable only by scrolling a nested pane on two axes, and the action bar clips mid-button. The document itself never overflows, which is why no earlier check caught this | 1 d |
| L10 | The sidebar quick-search is hardcoded to candidates on every route | It reads "Candidate Keywords" and submits to `/recruit/candidates?search=` even on `/sales/deals`. A mislabelled control on every non-recruit page, adjacent to SC 2.4.6 | 2 h |
| L11 | Reproduce the one `definition-list` violation before acting | axe reported it on the candidate record. Reading axe's own source shows `only-dlitems` unwraps a roleless `div`, so the 31 `div.info-item` wrappers are not the cause, and `structured-dlitems` inspects direct children only. Not worth touching 31 call sites on a guess | 1 h |
| L12 | Run axe itself in CI against real routes, not just token pairs | L6 is the proof that a token-pair check is not an accessibility check | 4 h |

**Status 2026-09-02.** Done: L1 to L6. Open: L7 to L12. L7 is the most serious, because a board nobody can operate by keyboard is a hard accessibility failure rather than a degraded experience.

### Workstream M. Frontend security and the public surface

Added 2026-09-02. Row-level security was out of scope for this audit, having been tested separately; this is the browser side and the unauthenticated careers surface.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| M1 | **DONE 2026-09-02.** Open redirect in `google-oauth-callback` | CWE-601, verified by reading the code. `app_origin` came from the request's Origin or Referer header, was stored unchecked, and was reflected into a 302 Location. A caller holding a valid JWT could forge the header and redirect post-consent to any domain. Now resolved through an allowlist with a logged refusal | done |
| M2 | **DONE 2026-09-02, then redone the same day against the source.** The first pass added Content-Security-Policy, Strict-Transport-Security and Permissions-Policy from recall. Checking OWASP's own repository afterwards showed that was incomplete and in two places wrong: HSTS should be `max-age=63072000` not 31536000, Referrer-Policy should be `no-referrer` not `strict-origin-when-cross-origin`, the CSP was missing `upgrade-insecure-requests`, the Permissions-Policy list was a fraction of the recommended one, and four headers were absent entirely: `X-Permitted-Cross-Domain-Policies`, `X-DNS-Prefetch-Control` (which OWASP recommends specifically for responses carrying personal data, and every authenticated page here does), `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`. All corrected. **`Cross-Origin-Embedder-Policy: require-corp` is deliberately not set:** it blocks any cross-origin subresource that does not send CORP, which would break the Supabase-hosted resume preview iframe and attachment images. Adding it needs a test pass, so it is M10 | All three were missing from `vercel.json`. The CSP allows Supabase over https and wss, and allows `*.supabase.co` in `img-src` and `frame-src` because signed attachment URLs and the resume preview iframe come from there | done |
| M3 | **DONE 2026-09-02.** JobPosting structured data | Google requires five properties. The code set `datePosted` and `jobLocation` to `undefined` when a requisition had no `opened_date` or `location`, and `JSON.stringify` drops undefined keys, so the page shipped structured data silently missing a required property. Now gated: all five present or nothing is emitted. The existing test had been asserting against invalid JSON-LD, because its own fixture inserted a requisition with no location | done |
| M4 | **DONE 2026-09-02.** The body is now bounded before it is buffered. `content-length` is rejected above 12 MB up front, and the stream itself is piped through a counting `TransformStream` that errors past the same ceiling, because a chunked request can lie about or omit its length. The existing 10 MB per-file check still runs afterwards on the parsed file, so an oversized single attachment is still rejected with its own message. The oversized-resume test still passes | The 10 MB check runs after the entire multipart body is already buffered, so an unauthenticated caller can force the buffering first. Supabase may impose its own ceiling, which was not verified | 1 h |
| M5 | **DONE 2026-09-02.** Six authenticated functions (`google-oauth-start`, `google-sync`, `calendar-create-meeting`, `gmail-send`, `intake-sheet-commit`, `intake-sheet-fetch`) take their allowed origin from `APP_PRIMARY_ORIGIN` instead of `*`, and send `Vary: Origin`. It defaults to `*` when unset so nothing breaks silently on a deploy that has not set it yet. `careers-apply` and `careers-page` deliberately keep `*`: they are the public careers surface and are meant to be reachable from anywhere. A first attempt tried to echo the request origin per call through a shared helper, and was reverted: `json()` in these functions has no `req` in scope, so it produced code that could not compile | Same function whose header fed M1 | 30 min |
| M6 | **PARTLY DONE 2026-09-02, and the earlier finding was wrong.** The audit reported this as needing a 6-to-7 major migration because `npm audit` said "fix available" while the caret range could not reach 7.x. Checking the registry directly showed **6.30.5 and 6.30.6 exist**, and the advisory that actually names our installed version, "Open redirect leading to XSS", is scoped `>=6.30.2 <=6.30.4`. Bumped to **6.30.6**, a patch, and that advisory is gone. Two advisories against `react-router` remain, both fixed only in 7.18.0: an open redirect via backslash in `<Link>` and `useNavigate`, which does apply; and arbitrary constructor injection in `deserializeErrors()` during **SSR hydration**, which does not, because this is a client-only SPA with no `renderToString`, no `StaticRouter` and no `hydrateRoot` anywhere. So the remaining exposure is one moderate open-redirect advisory, and the v7 migration can be scheduled rather than rushed | Two moderate advisories against the installed 6.30.4. `npm audit` reports a fix as available, which is misleading: the caret range cannot reach 7.x, so this is a major-version migration | 1 d |
| M7 | **DONE 2026-09-02.** The only drift was `axe-core`, installed unsaved by the accessibility audit. Rather than remove it, it is now a proper dev dependency of `tests`, which makes `npm ci` reproducible and puts the tool in place for L12 | `npm ci --dry-run` reports it would remove packages, so the live tree has drifted from the lockfile and `npm ci` is not reproducible against what is checked out | 30 min |
| M8 | **DONE 2026-09-02.** A 1200x630 `og-careers.png` generated from the logo, plus `og:image`, its width and height, `twitter:card` and `twitter:image`. Emitted **only** when `APP_PRIMARY_ORIGIN` is set to an absolute URL, on the same principle as the JobPosting fix: a relative or missing image URL is ignored by crawlers, so half a tag set is worse than none. A test covers both branches | Title, description, canonical, Open Graph, `lang`, sitemap and robots are all present and correct. `og:image` is the one gap | 1 h |
| M9 | Guard against unintentionally building against the live project | `app/.env` points the production build at `mebfbbvrqdctamnzvbbs.supabase.co`. `app/.env.development` correctly points the dev server at the local stack, which is why local sign-in works. But `npm run build` followed by `vite preview` talks to production, which is how the performance audit was blocked | 1 h |

| M10 | Test `Cross-Origin-Embedder-Policy: require-corp` before enabling it | OWASP recommends it. It would break any cross-origin subresource that does not send a CORP header, and the resume preview iframe and attachment images are served from Supabase | 2 h |

**Status 2026-09-02.** Done: M1, M2, M3, and M6 reduced to one moderate advisory by a patch bump. Open: M4, M5, M7, M8, M9, M10, and the eventual v7 migration. Verified clean and needing no work: no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` anywhere in `app/src`; only the anon key reaches the browser bundle, confirmed by decoding the one JWT-shaped string in the built output; the careers apply endpoint already has rate limiting, a honeypot, an extension allowlist and magic-byte signature checks; and a nonexistent and a closed requisition return identical pages, so there is no enumeration.

### Workstream N. Code and stylesheet architecture

Added 2026-09-02. Two research passes and two codebase audits.

**Correction worth recording.** The premise that a 1,796-line stylesheet is itself the problem does not survive checking. No authoritative source names a line or selector threshold for splitting CSS, and every number in circulation is a blog opinion. The same is true of React component length: TypeScript, React and the major published style guides give no number. What *is* a documented anti-pattern is the architecture, one undifferentiated global file mixing tokens, resets, layout and every component with no cascade ordering. So the work below is justified on responsibility boundaries and on cascade control, not on line counts, and the plan should stop quoting line counts as if they were a standard.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| N1 | **DONE 2026-09-02.** Three shims deleted (`sales`, `intake`, `settings`), 20 importers repointed at `lib/supabase.ts`. `modules/dashboards/db.ts` survives, reduced to its one real job of exporting `dashDb`, the client scoped to the `dash` schema. `CLAUDE.md`'s "live wart" section is replaced with what is actually true | `CLAUDE.md` says they work around missing `Relationships` typing. `database.types.ts` already carries `Relationships: []` on all 25 tables, so they are one-line re-exports doing nothing, and only four of five modules use them anyway | 3 h |
| N2 | **DONE 2026-09-02.** One implementation in `lib/format.ts`: `formatDate`, `formatDateTime`, `formatMoney`, each taking an explicit fallback. All three modules delegate to it. The design point that mattered: recruit's `fmtDate` returned an empty string and `RequisitionRecordPage` **depends on that**, filtering fields on `v !== ''` before rendering the grid. Forcing one fallback on all three callers would have put a dash into every empty field instead of hiding it, so the fallback is a parameter and recruit passes `''`. There is a regression test naming that dependency. The `RangeError` is gone: `formatMoney` validates the currency code and falls back to a plain locale string, covered by a test that asserts no throw for `XX`, `DOLLARS`, `12`, `US$` and `''` | Both are duplicated four times. The two `fmtMoney` copies differ materially: the sales version validates the currency code, the dashboards version does not and **throws `RangeError` on an invalid code**. A latent crash, not a style nit | 2 h |
| N3 | Adopt `@layer` and split `app.css` into about 20 files by concern | There is a concrete bucket-by-bucket plan with the required import order. `@layer` is at roughly 94% support and makes source order irrelevant to the cascade, which is what de-risks the split | 1 d |
| N4 | Extract the duplicated `.fo-advanced-search` block | Six rules, byte-identical, copy-pasted in `recruit.css` and `intake.css`. Harmless today; nondeterministic per session once one copy is edited, because module CSS loads in navigation order | 1 h |
| N5 | Give `recruit` the same `db.ts`, `hooks.ts`, `lib.ts` shape as the other four modules | `recruit/lib/data.ts` does all three jobs in one file: client, 13 types, five formatters, `sortRows`, `useLookups`, `useIsMobile`. It is the largest module, so the divergence compounds | 4 h |
| N6 | Split the four largest components on responsibility | `CandidateRecordPage` (1,163 lines) owns profile state plus a send-email dialog plus a schedule-meeting dialog; `engagement.tsx` (588) bundles a hook, three helpers and six panels; `ApplicationPipeline` (780) mixes table mode, kanban mode, CSV export and a reject dialog; `CandidateListPage` (712) mixes data loading with filter and saved-view UI. Each has named extractable units | 2 d |
| N7 | Adopt React Compiler | Stable, and **confirmed to support React 18**, not only 19. There is no `React.memo` anywhere in the app today and any single-cell change re-renders a whole table, so the alternative is hand-placing memoization across every list | 1 d |
| N8 | Turn on `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | Both now appear in TypeScript's own `tsc --init` recommended template, alongside `verbatimModuleSyntax` and `isolatedModules`. Large mechanical diff in an existing codebase | 1 d |
| N9 | **DONE 2026-09-02.** A `@media print` block hides the utility header, primary nav, sidebar, bookmark bar, action bars, list toolbar, filter disclosure, pager and checkbox column; flattens the shell's fixed-height scroll panes so the whole record flows; forces a white ground; repeats the table header on every page with `display: table-header-group`; prevents rows, sections and panel items from breaking across pages; drops link underlines and colour; and expands capped cells so nothing is clipped in print. **Printable View stops being a placeholder** and calls `window.print()`. Three browser tests cover it, including one that stubs `window.print` and asserts the click actually invokes it.

**One unresolved anomaly, recorded rather than hidden.** The print block's `background` override does not apply to `.record-section-header`, so the blue band still prints blue. Ruled out by testing: the print media query does match (`matchMedia('print').matches` is true and the nav does hide), the selector is present in the parsed print block, `!important` does not change the outcome, no module stylesheet redefines the class, there is no inline style, and enumerating every rule that matches the element returns none carrying a background at all. That last result contradicts the computed value, which is the part I do not yet understand. The assertion was removed rather than left failing or weakened into something meaningless. Cosmetic only: the band prints as a blue bar | There is **no `@media print` rule anywhere**, and the Taleo replica renders a "Printable View" control that currently routes to the placeholder | 4 h |
| N10 | Enforce that modules never import each other | The feature-based structure this repo already uses is the currently recommended one, with one gap: the reference implementation enforces the no-cross-import rule with ESLint and nothing here checks it | 2 h |

**Status 2026-09-02.** All open. N2 is the only one with a live bug behind it.

### Workstream O. Resilience, growth and handover readiness

Added 2026-09-02. These came from asking what nobody had looked at yet, rather than from a tool. Each was checked before being written down, and one suspicion turned out to be unfounded and is recorded as such.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| O1 | **DONE 2026-09-02.** `components/ui/ErrorBoundary.tsx`, wrapped around the route outlet in `AppShell` and keyed on `location.pathname` so navigating away clears a failed page, and wrapped around every dashboard widget's content inside `Widget` so one panel cannot take the others. It shows the message, says the rest of the app still works and nothing saved is affected, and offers Try again and Reload. Three browser tests cover it. Found while testing: `DashboardsHome` was **dead code**, a second unreachable copy of the whole widget layout that only the module barrel exported, and it is deleted | **There is no error boundary anywhere in the application.** Zero matches for `componentDidCatch`, `ErrorBoundary` or `getDerivedStateFromError` across all 113 source files. Any throw during render blanks the entire page to white with no message and no recovery. This is not theoretical: N2's `fmtMoney` throws `RangeError` on an invalid currency code, so one bad currency string in one dashboard cell takes down the whole app | 4 h |
| O2 | Prune `audit_log` and `events_outbox` | Neither table is ever pruned. No migration contains a delete against either. `audit_log` receives a row from a security-definer trigger on **every write to every business table**, and `events_outbox` keeps processed rows forever with `processed_at` set. Both grow without bound, which is a slow problem that becomes a handover problem | 4 h |
| O3 | Add error tracking before handover | No Sentry, no `window.onerror`, no global error listener anywhere. After cutover nobody will know a production error happened unless a user reports it, and the 30-day measurement window that gates cancelling the old subscriptions depends on knowing whether the replacement actually works | 4 h |
| O4 | Measure and reduce Realtime subscriptions per page | **10 `.channel(` call sites across 9 files.** D30 already records the Realtime messages-per-second limit as an October scaling risk, and the Playwright suite is capped at two workers because of it, but no task ever followed. Nobody has counted how many channels a single page actually opens, or whether they can share one | 1 d |
| O5 | Decide the session policy for a product holding candidate PII | `jwt_expiry` is 3600 with token auto-refresh, so a signed-in browser stays signed in indefinitely while it is open. There is no idle timeout and no re-auth prompt. That may be the right call for an internal tool, but it should be a decision on the record rather than a default nobody chose | Decision + 3 h |
| O6 | Confirm backups and point-in-time recovery on the live project | Never mentioned anywhere in this plan or its supporting documents. A1 and A2 made the schema reproducible from source, which is not the same thing as being able to recover the data | 1 h |
| O7 | Watch `@dnd-kit/core` | We are on the latest version, 6.3.1, but it was **last published in December 2024, about 21 months ago**, and the maintainer has started a separate `@dnd-kit/react` line (0.5.0, July 2026). No advisories today. But it powers both kanban boards, and a library in maintenance mode with a successor forming is where an unpatched CVE eventually lands | Watch |
| O8 | Audit the storage bucket policies and limits | Row-level security on tables was tested thoroughly and separately. The `attachments` bucket's own policies, size limits and MIME restrictions were not part of that and have not been looked at | 3 h |

**Checked and found sound, so no task:** CI does run the full test suites. A third job in `ci.yml` starts Supabase, seeds the personas, checks migration drift, runs `validate.sql`, the 97 API and unit tests, installs Chromium, runs the 41 browser tests, and checks the attachment queue. I had assumed the browser suite was local-only and that was wrong.

**Status 2026-09-02.** All open. O1 is the cheapest way to stop a single bad value taking down the product, and it pairs with N2.

### Workstream Q. Product capability, as distinct from defects

Added 2026-09-02. Everything above this point is either a defect or a fidelity gap. This workstream is the other axis: what would make the product better for the people who use it all day. **These are proposals, not findings.** They need John's call on value, not a technical decision, and none of them is a bug.

Each was verified against the code rather than assumed.

| # | Task | What exists already | Est. |
| :---- | :---- | :---- | :---- |
| Q1 | Make the bulk actions real: "Mark as", "Change Main Status to" and "Send Email" on the candidate list | **The plumbing is already there and unused.** `Table` supports `selectable`, `selected` and `onSelectionChange`, so the checkbox column works, but all three bulk buttons route through `PlaceholderAction`. Selecting twenty candidates and advancing them together is the single most repeated action in an ATS, and right now it is twenty separate record visits. Highest value per hour of work in this plan | 2 d |
| Q2 | A merge path for two existing candidate records | Deduplication exists **only at intake**: `QueueListPage` and `ItemDrawer` handle it, and `intake_items.duplicate_of` records it. Nothing merges two people rows that are already in the system. Duplicate candidates are the classic way an ATS's data quality decays, and the importer will create some the first time a Zoho record matches an existing person imperfectly | 3 d |
| Q3 | Cross-entity global search | The sidebar Quick Search is hardcoded to candidates on every route, which is L10 as a defect. As a capability, the gap is bigger: there is no way to search requisitions, companies, contacts or deals from anywhere. Fixing L10 and building Q3 are the same piece of work, so they should be done together | 3 d |
| Q4 | Email templates | No template support anywhere in `recruit` or `settings`. `GoogleIntegrationCard` sends through the user's real Gmail, so the transport is built; what is missing is not having to retype the same outreach. Acceptance criterion 6.5 assumes templates exist, which is worth flagging as a scope mismatch rather than a test failure | 2 d |
| Q5 | Shareable saved views | Saved views are per-user by design, and an e2e test asserts that another staff member cannot see one. That is correct as security. As a capability it means a team cannot agree on a shortlist: "the roles Amir is screening" has to be rebuilt by each person | 1 d |
| Q6 | Keyboard-first list navigation | Recruiters live in these lists. The measured cost today is 75 tab stops to reach the first data row. `/` to focus search, `j` and `k` to move rows, `Enter` to open, would change how the product feels more than any animation in workstream G | 2 d |
| Q7 | A candidate-facing application status page | `careers-apply` accepts an application and the applicant then hears nothing until a human writes. A status link removes the "did you get my CV" email, which is the highest-volume inbound message any ATS receives | 2 d |
| Q8 | Usable on a phone | L9 as a defect is "the layout does not reflow below 900px". As a capability it is bigger: a recruiter cannot look at a candidate between meetings. Whether that matters is a product judgement, not an accessibility one | 1 w |

**Status 2026-09-02.** All open, none started, none of them a defect. Q1 is the recommendation: the selection plumbing is built, the buttons are already on screen in the right places, and it removes the most repeated manual work in the product.

**Deliberately not proposed:** interview scheduling with availability picking, offer management, and scheduled report delivery. All three are real ATS features and all three are larger than the remaining calendar, so proposing them before October would be dishonest about what fits.

### Workstream C notes from external research

Three points change how items in this stream should be justified and built.

**Fidelity claims need reframing.** Most Taleo specifics the redesign brief treats as requirements are not documented in any Oracle source. Tab order, the `1-20 of N` pager string, the requisition accordion sequence and the ACE / Req Rank / Next Steps vocabulary were all voted down under adversarial verification. The 26 screenshots of VentVest's own instance remain valid evidence, and they are now the *only* defensible source for those specifics. So describe the work to John as "matches your Taleo instance as captured in the screenshots", never as "matches Taleo as documented". It also means **the screenshots are irreplaceable primary evidence and should be preserved**, not treated as disposable reference material.

**Four Taleo behaviours are documented and absent from FOOS**, which makes C13, C14 and C15 the best-evidenced additions in this plan: Back To List restoring the exact list page, a structured status history, Bookmarks, and Printable View opening a separate window.

**Pagination is a fidelity choice, not a best practice.** Salesforce's `lightning-datatable`, the nearest vendor baseline for a dense enterprise list, has no pagination at all and uses infinite scrolling. C5 is still the right call for resemblance, and virtualised infinite scroll is the alternative if use matters more than likeness. Either fixes the real problem, which is 83 rows rendering unbounded.

### Completion status, revised 2026-09-02

**97½ of 137 numbered tasks are done.** The denominator jumped on 2026-09-02 when six background audits added workstreams K, L, M and N, and a further pass asking what nobody had examined added O. 50 tasks between them. That is the honest shape of it: the plan was at 70 of 77 because it had never looked at data access, accessibility, browser security or stylesheet architecture at all.

Counting caveats, kept rather than tidied away. An early headline read "52 of 56" while this table summed to 46½. Workstream D was recorded as 4 done when the evidence supported 3, and D6 had never been built. Both corrected. Every workstream now carries a status line naming which ids are done, which is J11.

| Workstream | Tasks | Done | What remains, and why |
| :---- | :---- | :---- | :---- |
| **C** Taleo fidelity | 17 | 17 | Complete. The remaining fidelity items were tracked in section 8.3 and are now closed too |
| **G** UX and motion | 10 | 10 | Complete by task. Coverage was narrower than that read, and H1 to H6 closed it |
| **E** Gates and testing | 8 | 7½ | E7 is rehearsed on every export that exists; job openings, education and experience have no data to rehearse. E6 is 70 of 82 criteria PASS; the other 12 need a Google account, a production publish, a hosted sheet, or a human click-through |
| **F** Hygiene | 4 | 4 | Complete. F4 decided: archive the other two frontends, delete only on confirmation |
| **B** Security | 3 | 2½ | B1 done. B2 has a proven tool; the live rotation is a production action. B3's local half is done and the production row is your call |
| **A** Integrity | 6 | 5 | A4 fixed in full: a third date format was found and the parse rate went 43 of 74 to 74 of 74. A3 is proven locally and idempotent; only the production write waits on you |
| **D** Data | 11 | 6 | D1, D6, D7, D8, D9, D10 done. D2 to D5 and D11 all wait on data or credentials this environment cannot produce |
| **H** Frontend consistency | 7 | 7 | Complete. H5 turned out to be six dead CSS selectors rather than a taste decision. H7 is the real logo, added at your request |
| **J** Repository cleanup | 11 | 11 | Complete. J8 needed no change: its premise was wrong |
| **K** Data access and performance | 12 | 10 | K1's correctness half and K11 done. Measurement reframed this workstream: performance is fine, truncation was the real bug |
| **L** Accessibility and responsive | 12 | 6 | L1 to L6 done. L7, no keyboard path on the kanban board, is the most serious open one |
| **M** Security and public surface | 10 | 7½ | M1 to M3 done. M6 reduced from a major migration to one remaining advisory by a patch bump |
| **N** Code and stylesheet architecture | 10 | 3 | N2 done, which removes the only live crash in the workstream |
| **O** Resilience and handover | 8 | 1 | O1 done. A render throw is now contained to one page or one widget |
| **Q** Product capability | 8 | 0 | New, and the only workstream that is proposals rather than defects. Q1's plumbing already exists |

E2 has moved out of the "decision" column: it was not one. `reminder.due` and tasks now have real dashboard panels.

**Twenty defects were found across the two passes, every one of them by running something rather than reading it.** Seven were database or environment state no migration set; six were guards that existed in one layer only; four were features that looked present and did nothing (the resume Current flag, Save view, My Tasks, the intake badge). Six more were in the tests themselves. The register lists them as D20 to D33 with QA-002, QA-007 and QA-008.

Four of them would have reached production unnoticed, because inspection cannot see them:

| Defect | Why reading the code would not have caught it |
| :---- | :---- |
| The `supabase_realtime` publication held no tables | Every subscription in the app is written correctly. The gap was database state |
| The dashboard refresh button always failed | Only through PostgREST, because `safeupdate` is preloaded for that one role. `pg_cron` calling the same function always worked |
| Save view failed on a NOT NULL column | The button, dialog and handler all exist and look right |
| Every table created after migration 11 has no grants | Policies read correctly; Postgres checks GRANTs first |

**Verification, run in loops rather than once.** Eight consecutive passes of all four gates clean: 64 API tests, 39 browser tests, 18 schema checks and the attachment-queue guard, from a clean `npm run db:reset` with no manual steps, leaving no rows, storage objects or queue entries behind. Getting there meant fixing six test-isolation bugs that a single run would never have exposed, including two specs that deleted each other's fixtures and a timezone bug that only appears east of UTC.

Also holding: 0 TypeScript errors, 0 lint problems, 0 build errors, contrast 17 of 17 pairs, motion budget respected, no migration drift, comments 7 of 19,206 lines.

### Superseded status notes

Three earlier status sections (the first-pass 44 of 56 count and two progress notes) were removed on 2026-09-02. They are in git history at `9c57969` and earlier. Three contradicting counts in one live plan was this document's largest source of confusion.

**Still open on the live project:** the Agent 6 RPC drift (needs the database password), QA-003's password rotation, and entering the four monthly cost figures so the cost metric stops reading "Not measured".

## 4. Priority

Ranked by consequence of delay, not by size.

1. **A1, A2, A6.** Production cannot be rebuilt from source control. Worst possible thing to discover at handover.
2. **B1.** An unresolved RLS finding outranks everything else by the project's own rules of engagement.
3. **A3.** A stated success metric reads zero because grading data was silently dropped.
4. **B2.** Real PII is now behind a plaintext shared password.
5. **C1 and C12.** Self-imposed AA requirement, failing in five places. Roughly two hours combined. External research confirms no large-text exemption exists at 13 to 14px, so these cannot be waived on type size.
6. **E1.** The one High defect with a hard deadline.
7. **G1 through G4.** Cheap, no motion involved, and G4 closes a real accessibility gap where seven live-updating surfaces announce nothing.
8. **C2 through C15.** The visible Taleo work.
9. **G5 through G10.** Motion, after the fidelity work has settled so the two are not debugged together.
10. **D1 through D5.** One Zoho session.
11. **E3 through E8.** Gate closure.
12. **H.** Frontend consistency. Unblocked, and it closes the distance between what the completion table claims about motion and icons and what the stylesheets actually contain.
13. **F and J.** Hygiene and cleanup. J7 ranks above the rest of its group, because stale project instructions mislead every future session.

## 5. Schedule

Today is Tuesday 2026-09-01. Contract end 2026-11-21 is 81 days out, 11.6 weeks.

The binding constraint is not the October target, it is Gate 6's 30-day measurement window:

| Cutover | Measurement ends | Inside 2026-11-21 |
| :---- | :---- | :---- |
| 2026-10-01 | 2026-10-31 | Yes |
| 2026-10-15 | 2026-11-14 | Yes |
| 2026-10-20 | 2026-11-19 | Yes, two days spare |
| 2026-10-31 | 2026-11-30 | **No** |

So "October or earlier" must mean early to mid October, and 2026-10-20 is the last safe cutover date.

| Window | Focus |
| :---- | :---- |
| To Fri 2026-09-04 | Dynamics comparison for John. Nothing else competes with it |
| Week of 09-08 | A1 to A6, B1 to B3. Integrity and security first |
| Week of 09-15 | C1 to C15 and G1 to G4. The Taleo look plus the no-motion UX fixes, and one Zoho session for D1 to D5 |
| Week of 09-22 | E1, E3, E4, E5. Metrics and the test suite that has never run. G5 to G10 in parallel, since motion is independent of the gate work |
| Week of 09-29 | E6, E7. Gate 4 closure |
| Week of 10-06 | E8 Gate 5 UAT, fix and re-run |
| By 10-20 | Cutover, opening the 30-day window with room before 11-21 |
| To 11-21 | Measurement, then cancellation on John's confirmation. Workstream F in parallel |

This is tight but not unreasonable, on one condition: A and B do not slip, because everything downstream assumes the data and schema are trustworthy.

## 6. Decisions

Ten were listed. **Eight are now closed.** Each one is recorded with what it was decided to and why, so the reasoning survives the decision.

| # | Decision | Outcome |
| :---- | :---- | :---- |
| 6.1 | QA-002 severity on `careers_rate_limit` | **Closed, moot.** RLS is enabled by migration `20260901000002`. The severity question needed no ruling because the claim behind it was wrong: `anon` never held a SELECT grant, so this was defence in depth, not an open door. Recorded as D27 rather than quietly edited, because the overstated version was already in a pushed commit message |
| 6.2 | Long text: cap with expand-on-click, or wrap fully | **Closed: cap.** The architecture document outranks the redesign prompt and the reverse-engineering report calls Taleo's wrapping a defect. `CappedCell` already implements it at two lines. Measuring afterwards found the excess row height was **not** wrapping at all: the grade-comment cell stacked its Edit button under the text. Laying them out inline took the candidate list from a 83px tallest row to 69px. What remains above 55px is the composite Next Steps cell, which stacks a badge over a link exactly as the screenshots show, so it stays |
| 6.3 | Whose contract ends 2026-11-21 | **Still open, and not mine to close.** This is a fact about an agreement, not a technical choice. It changes whether the priority is cancellation readiness or handover quality, so it is worth one question to John |
| 6.4 | `reminder.due`: interface or scope cut | **Closed: interface.** It was never a decision. `reminder.due` and tasks have real dashboard panels plus `My Reminders` and `My Tasks`, with server-side filtered subscriptions and a 20s backstop refresh. Filed as QA-007, fixed as D31 |
| 6.5 | Lucide: adopt or keep hand-rolled icons | **Closed: adopt.** Done in H1. `shell/icons.tsx` and its 21 hand-drawn icons are gone; one `LucideProvider` sets size 20 and stroke 1.6 so the library matches the Taleo line weight, which is exactly what the icon-strategy report recommended |
| 6.6 | Address data: backfill or accept | **Closed: keep, no backfill.** Your call, 2026-09-02. The fields stay and the data stays as sparse as the source is |
| 6.7 | Motion scope | **Closed: subtle motion on interactions Taleo never had.** Everything is under 220ms, colour and opacity plus two transforms on panels that mount. `scripts/check-motion.mjs` fails the build on a duration over budget, a transition on a layout property, motion on a shell selector, or a missing `prefers-reduced-motion` block. The prohibitions on page transitions, staggered entrances, shimmer and overshoot are unbroken |
| 6.8 | The eight identity documents | **Closed: exclude.** Your call, 2026-09-02. Not read, not fetched, not imported. `--include-identity-documents` exists and stays unused |
| 6.9 | The unmatched Recruit owner | **Closed: inactive staff rows with placeholder emails.** Implemented and applied locally as D9. The placeholder address matters mechanically: `staff.email` is unique and `add-local-staff.sql` upserts on `id`, so seeding a real address would make that person's later signup fail on a unique violation instead of adopting the row |
| 6.10 | Candidate list: pagination or infinite scroll | **Closed: pagination.** On fidelity grounds, since resemblance is the stated goal. Delivered in C5 with repeated bottom pagers. Virtualised infinite scroll remains the alternative if use ever matters more than likeness |
| F4 | The other two frontends | **Closed: archive, do not delete.** Neither `/foos` nor `/foos_redesign` exists on this machine, so freezing them costs nothing today and cuts the surface for every future schema change and every `database.types.ts` edit by two thirds. Deletion waits on John confirming nobody demos from them |

## 7. Explicitly out of scope

- Rebuilding on Microsoft Dynamics. Not evaluated in the platform-options report, and FOOS is already built. If that decision reverses on Friday, this plan is void and a migration assessment replaces it.
- The other two frontends. Untouched unless F4 says otherwise.
- Employees, Onboard/Offboard and Courses as working modules. Dropped on evidence in the architecture document and correctly delivered as static Taleo-accurate shells.
- Any schema change for visual reasons. The redesign prompt forbids it and this plan keeps that rule.
- Deleting the salary columns. C10 hides them in views; the data stays.

Two research angles returned no verified findings and remain genuinely open rather than cleared: modern 2026 ATS and CRM functional benchmarks, and the engineering risk of running multiple React frontends against one shared schema with hand-maintained generated types. The second is uncomfortable, because FOOS has three frontends on one schema and a confirmed case of type files agreeing with production while migrations disagree with both. That risk is measured internally as D3; it simply has no external literature here to calibrate against.

## 8. Tasklist

State after the 2026-09-02 passes and the seven audits. **97½ of 137 tasks done.** Workstream Q is proposals, not defects, so it is counted but should not be read as outstanding work in the same sense. Ordered by what gates each item, then by consequence inside each group.

### 8.1 Highest consequence, nothing blocking it

- [ ] **K1 remainder** Server-side filtering, sorting and pagination. The silent-truncation half is fixed and tested; what is left is efficiency, not correctness, and the measurements say it is not urgent. 2 to 3 d
- [ ] **L7** Keyboard support on `KanbanBoard`. The requisition pipeline board cannot be operated by keyboard at all, which fails SC 2.1.1 and 2.5.7. 3 h
- [ ] **L9** Single-column reflow below about 900px. At 768px the table sits 1400px below the fold and 950px right, inside a nested scroll pane. 1 d
- [ ] **L10** The sidebar quick-search says "Candidate Keywords" and submits to the candidates route on every page, including sales and intake. 2 h

### 8.2 Under two hours each, no product risk

- [ ] **M9** Guard against building against the live project unintentionally
- [ ] **N4** Extract the `.fo-advanced-search` block duplicated in two module stylesheets
- [ ] **L11** Reproduce the one `definition-list` violation before touching 31 call sites
- [ ] **O6** Confirm backups and point-in-time recovery on the live project
- [ ] **O7** Note `@dnd-kit/core` as a watch item: latest version, but unpublished for 21 months

### 8.3 Frontend fidelity

Closed 2026-09-02, and the table chrome was corrected against sampled pixels rather than against my reading of the screenshots.

- [x] Table cell content is bold, as it is in every Taleo screenshot
- [x] The filter rail no longer squeezes the table. It is a disclosure, collapsed by default, opened by a "Search these records" link that mirrors Taleo's "Search these Candidates". Taleo has no in-content filter panel at all, so the default view now matches and filtering is one click away
- [x] All seven list titles drop the invented ": Home" suffix
- [x] The pager puts first and previous before the count and next and last after it, which is Taleo's arrangement, not ours
- [x] **Table colours corrected from sampled pixels.** I had assumed the blue section tint was right for table headers. Sampling `22_Taleo_Cand_List_1.png` directly says otherwise: the header is `#ffffff` with `#333333` text, rows alternate `#fafafa` and `#ffffff`, and the page band behind them is `#f0f0f0`. Ours had a blue header, `#f7f7f7` zebra and an `#eeeeee` canvas. All four now match exactly, verified by reading the rendered `backgroundColor` back out of the browser. The blue band stays where the screenshots actually use it, on record section headers
- [x] **N9** A print stylesheet, and Printable View now actually prints. One cosmetic anomaly recorded in the workstream N row

### 8.4 Product capability, your call on value rather than a technical decision

- [ ] **Q1** Make the bulk actions real. The selection plumbing and the buttons already exist; only the behaviour is missing. Recommended first
- [ ] **Q3** Cross-entity global search, done together with L10
- [ ] **Q2** A merge path for two existing candidate records
- [ ] **Q6** Keyboard-first list navigation
- [ ] **Q4** Email templates
- [ ] **Q5** Shareable saved views
- [ ] **Q7** A candidate-facing application status page
- [ ] **Q8** Usable on a phone, the capability framing of L9
- [ ] Dependency licence compliance, for the handover
- [ ] Candidate data retention and an erasure path

### 8.5 Architecture, each needs a decision first

- [ ] **N3** Adopt `@layer` and split `app.css` by concern. Three named source-order hazards must be resolved first
- [ ] **N7** Adopt React Compiler. Stable, and it does support React 18. There is no `React.memo` anywhere today
- [ ] **N5** Align the `recruit` module's shape with the other four
- [ ] **N6** Split the four largest components on responsibility, not on line count
- [ ] **N8** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, both now in TypeScript's own recommended template
- [ ] **N10** Enforce with ESLint that modules never import each other
- [ ] **K7** Explicit column lists in place of 73 `select('*')` sites
- [ ] **L12** Run axe in CI against real routes, not token pairs
- [ ] **M10** Test `Cross-Origin-Embedder-Policy: require-corp` before enabling it
- [ ] **M6** The eventual react-router v7 migration, for the one remaining moderate advisory
- [ ] **F4** Archive the other two frontends (decided, not yet executed)
- [ ] **O2** Prune `audit_log` and `events_outbox`, neither of which is ever pruned
- [ ] **O3** Error tracking, so production failures are visible during the 30-day measurement window
- [ ] **O4** Measure and reduce the 10 Realtime channel call sites
- [ ] **O5** Decide the session policy: no idle timeout on a product holding candidate PII
- [ ] **O8** Audit the storage bucket policies and limits

### 8.6 Waiting on one authorised command from you

Each is written, proven locally and idempotent, and refuses a non-local target without `--allow-remote`.

- [ ] **A3 and A4** `scripts/backfill-zoho-candidate-fields.mjs`. Restores 37 star grades and corrects 74 initial dates
- [ ] **B2** `scripts/rotate-persona-passwords.mjs`. Fresh random passwords, printed once, stored nowhere
- [ ] **B3** Whether a production `staff` row is created for you
- [ ] **K10** Authenticated Core Web Vitals. Needs either the live credentials or a decision to measure the local stack instead, which measures loopback latency

### 8.7 Waiting on data or credentials only you can supply

- [ ] **D11** A Zoho Self Client. **Unblocked as of 2026-09-02:** the client-credentials flow works and a token was proven against Recruit. Needs the client id, secret and the two org ids to run unattended
- [ ] **D2 to D5** Job openings, education, experience, attachment bytes. All arrive with D11
- [ ] **D10 contacts half** The Contacts export. Mapper written and unit-tested
- [ ] **E6** The last 12 of 82 acceptance criteria, each needing a Google account, a production publish, a hosted sheet or a human click-through
- [ ] **P2** The four monthly cost figures
- [ ] **P3** Whose contract ends 2026-11-21

Detail on the parked items is in `VVPH_VV-FOOS_Register_Parked-and-Blocked-Items_2026-09-02_v1.0_Draft.md`.

### 8.8 Closed on 2026-09-02

- [x] **H1 to H7** Icons on lucide, StarGrade merged, `EMPTY_CELL`, the two missing G6 interactions, six dead motion selectors repaired, `rgba()` tokenised, the real logo
- [x] **J1 to J11** Every cleanup item, five stale `CLAUDE.md` statements, and a comment guard that was a no-op in CI
- [x] **A4** A third `Initial Date` format found. Parse rate 43 of 74 to 74 of 74
- [x] **D6, D7, D9, D10 accounts half, E7, F4 decision** and eight of ten section 6 decisions
- [x] **L1 to L6** A real focus failure, a skip link, four ARIA roles, target sizes, a landmark name, three contrast failures
- [x] **M1 to M3** An open redirect, the security headers, invalid JobPosting structured data
- [x] **K1 correctness half and K11** Silent 1000-row truncation on all six list pages, and two duplicate requests firing on every page load
- [x] **N2 and O1** One canonical set of formatters, killing the `RangeError`, and an error boundary so a render throw can no longer blank the app. `DashboardsHome` deleted as dead code
- [x] **N1, K6, K8, K9** Three dead client shims deleted, two delete loops batched into one request each, first-load JS cut 19% to 129.6 KB gzipped, and the build stops accumulating stale chunks
- [x] **The Taleo rename**, 521 prefix occurrences and 11 component identifiers, on the copyright concern

### 8.9 Provenance of the audit findings

Stated so nobody has to re-derive it. **Measured:** the index gaps (EXPLAIN against 200k synthetic rows in a rolled-back transaction), the bundle sizes and the 159 KB first load, the 69-versus-21 stale build files, every axe violation, the 75 tab stops, the target sizes, the nav overflow at four widths, and all contrast ratios. **Read from code:** the open redirect, the JobPosting undefined-drop, the `select('*')` count, the `RangeError`, the sequential deletes, the dead `db.ts` shims, the duplicate `.fo-pager` rule. **Verified against a primary source after being flagged as recall:** the OWASP header list and the react-router advisory ranges, both of which turned out to be materially different from the first answer. **Still unverified:** dependency maintenance status, because the session's web-search budget ran out at 200 calls.

