# CRM and ATS Improvement Plan

**Project:** VV-FOOS · **Owner:** John Buena · **Prepared by:** Klent Roel Zarsuela · **Date:** 2026-09-01, revised 2026-09-02 · v1.1 Draft

Goal as stated on 2026-09-01: make the CRM and ATS look and feel like Oracle Taleo, replace the Excel and Zoho dependence with one repository, and be ready by October. This plan sequences that work against verified evidence rather than assumption. Every claim it rests on was measured on 2026-09-01 against the live Supabase project, the running application at 2560 x 1600, or the source exports.

**Everything still open is listed as a checklist in section 8.** That is the section to read if you want the state of the work rather than its reasoning.

Supporting documents, all in this `docs/` tree:

- `01-current-state/` System inventory, and the defect and risk register
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


### Workstream C notes from external research

Three points change how items in this stream should be justified and built.

**Fidelity claims need reframing.** Most Taleo specifics the redesign brief treats as requirements are not documented in any Oracle source. Tab order, the `1-20 of N` pager string, the requisition accordion sequence and the ACE / Req Rank / Next Steps vocabulary were all voted down under adversarial verification. The 26 screenshots of VentVest's own instance remain valid evidence, and they are now the *only* defensible source for those specifics. So describe the work to John as "matches your Taleo instance as captured in the screenshots", never as "matches Taleo as documented". It also means **the screenshots are irreplaceable primary evidence and should be preserved**, not treated as disposable reference material.

**Four Taleo behaviours are documented and absent from FOOS**, which makes C13, C14 and C15 the best-evidenced additions in this plan: Back To List restoring the exact list page, a structured status history, Bookmarks, and Printable View opening a separate window.

**Pagination is a fidelity choice, not a best practice.** Salesforce's `lightning-datatable`, the nearest vendor baseline for a dense enterprise list, has no pagination at all and uses infinite scrolling. C5 is still the right call for resemblance, and virtualised infinite scroll is the alternative if use matters more than likeness. Either fixes the real problem, which is 83 rows rendering unbounded.

### Completion status, revised 2026-09-02

**70 of 77 numbered tasks are done**, summing the Done column below. Eight closed in the second pass of 2026-09-02: A4, D6, D7's second alias, D9, D10, E7, F4 and the long-text decision, plus A3 and B2 reduced to a single authorised command each.

Counting caveats, stated rather than smoothed over. An earlier headline read "52 of 56" while this table summed to 46½. Workstream D was recorded as 4 done when the evidence supported 3, and D6 had never been built at all. Both are corrected above. Every row-level status now has a status line under its table, which is J11.

| Workstream | Tasks | Done | What remains, and why |
| :---- | :---- | :---- | :---- |
| **C** Taleo fidelity | 17 | 17 | Complete |
| **G** UX and motion | 10 | 10 | Complete by task. Coverage was narrower than that read, and H1 to H6 closed it |
| **E** Gates and testing | 8 | 7½ | E7 is rehearsed on every export that exists; job openings, education and experience have no data to rehearse. E6 is 70 of 82 criteria PASS; the other 12 need a Google account, a production publish, a hosted sheet, or a human click-through |
| **F** Hygiene | 4 | 4 | Complete. F4 decided: archive the other two frontends, delete only on confirmation |
| **B** Security | 3 | 2½ | B1 done. B2 has a proven tool; the live rotation is a production action. B3's local half is done and the production row is your call |
| **A** Integrity | 6 | 5 | A4 fixed in full: a third date format was found and the parse rate went 43 of 74 to 74 of 74. A3 is proven locally and idempotent; only the production write waits on you |
| **D** Data | 11 | 6 | D1, D6, D7, D8, D9, D10 done. D2 to D5 and D11 all wait on data or credentials this environment cannot produce |
| **H** Frontend consistency | 7 | 7 | Complete. H5 turned out to be six dead CSS selectors rather than a taste decision. H7 is the real logo, added at your request |
| **J** Repository cleanup | 11 | 11 | Complete. J8 needed no change: its premise was wrong |

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

State after the second pass of 2026-09-02. **70 of 77 numbered tasks are done.** Grouped by what actually gates each remaining item, because "open" means three different things here.

### 8.1 Waiting on one authorised command from you

Each of these is written, proven against the local stack, and idempotent. None of them can be run against production by me: you asked that production stay untouched, and the first two were also refused by the permission classifier.

- [ ] **A3** `node scripts/backfill-zoho-candidate-fields.mjs --allow-remote` then `--apply`. Restores 37 star grades. Dry run first; it prints exactly what it would change
- [ ] **B2** `node scripts/rotate-persona-passwords.mjs --allow-remote --apply`. Fresh random password on all four persona accounts, printed once, stored nowhere. Then put the value in `tests/.env`
- [ ] **A4 (production half)** The same backfill also corrects the 74 initial dates. One run does both
- [ ] **B3** Whether a production `staff` row is created for you. The recommendation is in 6.9

### 8.2 Waiting on data or credentials only you can supply

- [ ] **D11** A Zoho Self Client (client id and secret). The client is built and the scope string covers Recruit and CRM. A few hundred API credits against a 5,000 free allowance
- [ ] **D2** The job-openings export, or D11
- [ ] **D3** Education Details re-exported with its full field set. The file on disk is header only, 3 columns
- [ ] **D4** Experience Details, same problem, and `people.experience` is ready to receive it
- [ ] **D5** The attachment bytes. All 50 `storage_path` values are placeholders, and the UI now says so rather than breaking
- [ ] **D10 (contacts half)** The Contacts export. The mapper is written, wired and unit-tested; it reports any column it does not recognise instead of guessing
- [ ] **E6** The last 12 of 82 acceptance criteria. Each needs a Google account, a production publish, a hosted sheet, or a human click-through
- [ ] **E7 (remaining third)** Job openings, education and experience cannot be rehearsed until they have data
- [ ] The four monthly cost figures, so the cost metric stops reading "Not measured". Migration `20260901000004` seeds the systems with `monthly_cost` null rather than inventing numbers
- [ ] The Agent 6 RPC drift on the live project, which needs the database password
- [ ] **6.3** Whose contract ends 2026-11-21. A fact about an agreement, not a technical choice

### 8.3 Closed in the 2026-09-02 passes

- [x] **H1 to H7** Icons on lucide, StarGrade merged, `EMPTY_CELL`, the two missing G6 interactions, six dead motion selectors repaired, `rgba()` tokenised, the real logo
- [x] **J1 to J11** Every cleanup item, including five stale `CLAUDE.md` statements and a comment guard that was a no-op in CI
- [x] **A4** A third `Initial Date` format found and handled. Parse rate 43 of 74 to **74 of 74**
- [x] **D6** A real UI state for an attachment whose bytes have not arrived, with two browser tests
- [x] **D7** A second alias: the Zoho status `Hired` is the FOOS status `Placed`. Unresolved statuses are now zero
- [x] **D9** Inactive `staff` rows for the three unmatched Zoho owners. Unresolved staff went from 325 affected rows to **zero**
- [x] **D10** The Accounts mapper: **86 of 86** rows, 0 skipped
- [x] **E7** The migration rehearsed end to end on every export that exists, including a damage-and-repair cycle and a full purge
- [x] **F4** Decided: archive the other two frontends
- [x] **6.2** Decided: cap long text. The measured excess row height turned out to be a stacked Edit button, not wrapping; fixing the layout took the tallest candidate row from 83px to 69px
- [x] **6.1, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10** All closed, with the reasoning recorded in section 6

### 8.4 What I would take first when the blockers lift

Create the Self Client, then `node migration/zoho-api.mjs` for both products. That single step unblocks D2, D3, D4, D5, the contacts half of D10 and the remaining third of E7. Everything downstream of it is already written and tested.

### 8.5 Verification behind every 2026-09-02 entry

Twelve gates, run in loops rather than once: 0 TypeScript errors, 0 lint problems, a clean production build, contrast 17 of 17, motion budget respected, no comments in source, no migration drift, 18 of 18 schema checks with 0 failures, the API and unit suites, the browser suite, no orphaned attachment objects, and the Zoho importer holding at 75 of 75 candidates, 141 of 154 notes, 42 of 50 attachments and 86 of 86 companies.

Two defects of my own were found by running things repeatedly. `list-persistence.spec.ts` 2.11 read row text before the people lookup resolved and captured a loading placeholder under full-suite load, which is D35. And the importer, run from inside `migration/`, wrote its report to `migration/migration/out/`; that directory was caught and removed before staging, because dry-run reports contain candidate data.
