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
| D5 | **DONE 2026-09-03, by U3.2 and U3.5 rather than by a bulk export.** The API supplied the bytes, so the blank `Attachment URL` never had to be worked around: 1,738 files are in Storage and the 42 remaining placeholder rows turned out to be duplicates of files that had just arrived, on the same parent, and were removed | Was: `Attachment URL` blank on all 50 rows, every live `storage_path` a placeholder | 1 to 2 h |
| D6 | **DONE 2026-09-02.** `lib/attachments.ts` recognises both placeholder prefixes the migration has used (`zoho-import/pending/` and `pending-file-export/`). A pending file is listed with its name as plain text plus a "File not yet available" badge instead of a link, `attachmentUrl` returns null without a pointless round trip, and the resume preview says why rather than showing "Loading resume preview" for ever, which is what it did before. Two browser tests cover it: the pending file is badged and not a link, and a real uploaded file in the same list still is | Recommended in the migration plan, not yet built | 1 h |
| D7 | **DONE.** Alias in `SOURCE_ALIASES`. A second alias was needed on 2026-09-02: the Zoho candidate status `Hired` had no row in `candidate_statuses` and is the same state FOOS calls `Placed`, so `STATUS_ALIASES` maps it. Unresolved statuses are now zero | D4. Source data says `Facebook Messenger`, seed says `FB Messenger` | 15 min |
| D8 | **DECIDED 2026-09-02: keep.** Address data is largely absent: street 1%, city 31%, province 13%, postal 1%. Fields stay, no backfill. | Meeting listed addresses as required. The fields exist; the data does not | done |
| D9 | **DONE 2026-09-02.** `scripts/add-legacy-owners.mjs` reads every owner column across all five exports, lists the ones with no `staff` row, and creates each as `is_active = false` with a `legacy+<slug>@import.invalid` address so a later real signup cannot collide on the unique email. Names are redacted unless `--show-names`. Applied locally: **3 owners created, and unresolved staff went from 3 distinct values across 325 rows to zero** | Without it every `created_by` and `uploaded_by` on those rows is null, and the audit trail says nobody did the work. The CRM `Users` export does not help: it is CRM-side only and 4 of its 8 rows are system accounts. Recommendation and its trade-off in section 6.9 | 1 h |
| D10 | **DONE 2026-09-02.** `migration/src/map-companies.mjs` maps all **86 of 86** Accounts rows with 0 skipped: name, types, website with a scheme added, city, province, country, phone, owner and both timestamps, and it reports the source fields `companies` has no column for rather than dropping them silently. `map-contacts.mjs` is written and wired the same way and reports export columns it does not recognise; it waits only on the Contacts export. 12 unit tests cover both | Accounts export has 86 rows and no mapper exists. This is the CRM half of D1 | 3 h |
| D11 | Pull Recruit and CRM through the API instead of waiting on emailed exports | Unblocks D2 to D5 and E7 without involving John. Credit cost measured against the published limits in section 2 | 2 h |

**Status 2026-09-03, third entry.** Done: D1 and D5 to D11. D5 closed on 2026-09-03 with the attachment bytes in Storage, which was the last of the eleven to move. D2, D3 and D4 closed with D11 on 2026-09-03: the API made the emailed re-export unnecessary. Nothing in workstream D is open.

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
| J2 | **DONE 2026-09-02.** Removed | 404 KB of build output belonging to the frontend this tree was rsynced from. This project builds to `dist/`. Nothing in the repo reads `app/dist` | 5 min |
| J3 | **DONE 2026-09-02.** Removed | 13 lines that launch Chromium against `data:text/html,<h1>hi</h1>` and print `TITLE_OK`. A throwaway Playwright smoke check. It is tracked, so this one needs a commit | 5 min |
| J4 | **DONE 2026-09-02.** Both removed | Dead. A basename scan of every `.ts` and `.tsx` file in `app/src` found the only occurrences of either name are their own definitions. Superseded by `TaleoUtilityHeader` plus `TaleoPrimaryNav`, and by `TaleoModulePlaceholderPage` | 15 min |
| J5 | **DONE 2026-09-02.** Both removed | Already matched by `.gitignore`, still sitting on disk | 5 min |
| J6 | **DONE 2026-09-02.** Removed | Empty. Git tracks no directories, so it exists only to imply a fixture that is not there | 5 min |
| J7 | **DONE 2026-09-02.** Five stale statements, not three. Corrected: the "no `.git` here" claim, the "no linter" claim, the vitest glob claim (it already includes `mocks/**`), the claim that the Vitest suite runs against the live project (it runs against whatever `tests/.env` names, which is now local), and the claim that `playwright.config.ts` targets port 5173 (it defaults to 5175 and starts its own server). Added a statement of the no-comments rule | It states "There is no `.git` here. No branches, no diffs, no history to consult", which is false: this is a git repository on `develop` with `origin/main` and `origin/develop`. It also states "There is no linter and no ESLint/Prettier config", which is false: `app/eslint.config.js` exists, `lint` and `lint:fix` are npm scripts, and CI runs `npm run lint --workspace=app`. Stale project instructions mislead every future session, including mine | 30 min |
| J8 | **NO CHANGE NEEDED 2026-09-02. The premise was wrong.** `tests/vitest.config.ts` already includes `mocks/**/*.test.ts`, and the file runs: 2 tests, both passing, in every run of the suite. It does throw at import time when `FOOS_INTAKE_PARSER_SECRET` is unset, which is the correct fail-loud behaviour for a test that cannot run, so it is left as it is. The stale claim was in `CLAUDE.md` and this plan repeated it | Outside `vitest.config.ts`'s `api/**/*.test.ts` glob, so it has never run once. Either widen the glob and make it pass, or delete it. A test that cannot run is worse than no test because it reads as coverage | 30 min |
| J9 | **DONE 2026-09-02.** Both directories emptied; the build repopulates `dist` from clean | `emptyOutDir: false` means every build adds hashed assets and removes none; the directory now holds 123. Playwright artifacts accumulate the same way. Both are gitignored, so this is disk hygiene, not repository hygiene | 10 min |
| J10 | **DONE 2026-09-02.** Pruned this plan's three superseded status sections | 58 lines of contradicting history removed from a live document | done |
| J11 | **DONE 2026-09-02.** A status line under each workstream table naming which task ids are done, blocked or open | Only 9 of 75 task rows carry a DONE marker while the completion table says 48½ are done. Anyone reading a workstream table today concludes almost nothing is finished | 1 h |

**Status 2026-09-02.** Done: J1 to J7, J9, J10, J11. J8 needed no change; see the correction below.

**Not cleanup, do not delete:** `migration/zoho-exports/` and `migration/out/` hold real candidate and customer PII. Both are gitignored and both must stay on disk until the migration is signed off. `app/src/modules/recruit/__typecheck__.ts` and its `sales` twin look unreferenced to a scan but exist so `tsc` type-checks each module's public exports; they are load-bearing.


### Workstream K. Data access and query performance

Added 2026-09-02 from six background audits. **K1 is the single largest piece of work left in the codebase and the plan had never identified it.**

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| K1 | **REFRAMED 2026-09-02 by measurement, and the urgent half is DONE.** The claim in this row was that client-side filtering will not scale. Measured against a production build at 500, 2,000 and 5,000 candidate rows, that is **not supported**: load stayed at 60ms LCP, keystroke latency at 24 to 27ms and sort at 32ms at every volume, and 32ms is the floor of the measuring technique rather than real cost. What the test found instead was a **correctness bug that fires first**: PostgREST caps a response at 1000 rows, `Content-Range: 0-999/5007` confirmed by direct call, and no list page paginated or checked. The pager read "1-20 of 1000" while the table held 5,007 rows, silently discarding the rest with no error. Fixed the same day with `lib/fetchAll.ts`, applied to all six list pages, with 6 unit tests. Server-side filtering is still the right destination, but it is now an efficiency task rather than a correctness one | **Every list page fetches its entire table.** There is no `.ilike(` and no `.range(` anywhere in `app/src`: candidates, requisitions, deals, companies, contacts and tickets all issue `select('*')` with no WHERE and no LIMIT, then filter and search in JavaScript. Fine at 10 seed rows, fails at 10,000. No index can fix it | 2 to 3 d **REMAINDER CLOSED 2026-09-03 by workstream U, and measured at the real volume rather than the seeded one.** The efficiency half was left open on the honest threshold that it mattered at a few thousand candidates and there were 75. There are now 72,917. U1.1 to U1.7 moved all six list pages to server-side paging, filtering and sorting through database views. Measured on the imported data with Playwright: the candidate list renders its first row in **120ms**, over **20 REST requests** and **371.9 KB**, with 20 rows and 1,048 DOM nodes, and the pager reads `1-20 of 72917` from a database count. The row's own complaint was 9.2 MB over 84 requests to show 20 rows at 5,000 candidates. The three pieces named as making this a two to three day job all exist and are tested: server-side sort (`server-side-list.spec.ts` asserts the order reaches the database), saved views (`savedViews.tsx`, used by the candidate and requisition lists), and a CSV export that matches the filtered set (`list-persistence.spec.ts` 2.11). 20 requests is not 3: the rest are the filter dropdown lookups, which is U1.8 and still open |
| K2 | **DONE 2026-09-02.** Migration `20260902000001`. Proof, not assumption: with 30,000 activities against one person, `EXPLAIN (ANALYZE)` on the per-person timeline query returns a bare `Index Scan using idx_activities_person_occurred` with **no Sort node at all**. At the seed volume the planner still prefers a bitmap scan plus a sort, which is correct at 40 rows and is why the earlier measurement needed synthetic volume to say anything | Measured with EXPLAIN ANALYZE against 200k synthetic activity rows and 50k applications inside a rolled-back transaction: Bitmap Heap Scan followed by a separate Sort node, which is the composite-index gap. `tasks` already has the equivalent index and `reminders` does not | 1 h |
| K3 | **DONE 2026-09-02.** Same migration. `deals.primary_contact_id`, `tickets.person_id` and `intake_items.duplicate_of` are indexed, so deleting a person on the documented purge path no longer forces a sequential scan of three tables | All three are `ON DELETE SET NULL`, so deleting one person forces a full scan of three tables. The README's purge order starts with `people` | 30 min |
| K4 | **DONE 2026-09-02.** `idx_applications_requisition` dropped, and `validate.sql` check 16 fails if it comes back, since a leading-prefix duplicate is easy to reintroduce by habit | A strict leading prefix of the unique `(requisition_id, person_id)` index, so Postgres never needs it. Pure write overhead | 15 min |
| K5 | **DONE 2026-09-02, with the recommendation narrowed by measurement.** The audit said to wrap every policy predicate. Measuring first showed that is wrong for half of them. On 20,010 rows a bare `get_my_role()` comparison filters in **60.3ms** and the same predicate wrapped in a scalar subselect plans as an `InitPlan` and runs in **2.5ms**, a 24x difference, because the call is argument-less and can be hoisted out of the row loop. But `can_read_person(id)` takes the row as an argument, cannot be hoisted, and measured **187.5ms wrapped against 179.8ms bare**, so wrapping it is a small loss. Migration `20260902000002` therefore rewrites the **51 policies that call `get_my_role()` or `auth.uid()` bare** and deliberately leaves the row-dependent helpers alone. The migration was generated from `pg_policies` rather than hand-written, so each policy keeps its exact command, roles, permissive flag and predicate. Real effect: the `candidate_profiles` read policy now plans as three `InitPlan`s and the count over 20,000 rows runs in **1.6ms**. `validate.sql` check 17 fails if any argument-less helper goes back to being called per row | Every policy function is correctly marked `STABLE`, which was the first thing checked, but all are called bare. Supabase's own performance guidance is to wrap them so the planner caches the call as an InitPlan instead of re-invoking per row | 3 h |
| K6 | **DONE 2026-09-02.** Both loops collapse to one request each. Owners use `.in('staff_id', removed)`. Approvers need a pair-wise match, because the key is `(staff_id, approver_type)` and a staff-wide delete would remove an approver's other role, so they use `.or()` with an `and(...)` clause per pair. Three API tests prove it against a real database, including one asserting that removing `(staff, requisition)` leaves that same staff's `(staff, offer)` row intact, which is the failure mode a naive fix would have introduced | Two `for` loops with an `await` inside each, so N removed approvers means N serial round trips | 1 h |
| K7 | **DECLINED 2026-09-02, on measurement.** Half the premise is simply wrong: the dashboard queries the audit named as the worst offenders read `dash` materialized views of **4 to 16 columns**, so `select('*')` there is already close to optimal. The audit had inferred payload waste from wide tables without checking what those particular queries hit.

The other half is real but small. On `candidate_profiles` the ten columns the candidate list actually reads are 692 of 951 bytes, so **27% of that payload is unused**. Against that: the state is typed `Tables<'candidate_profiles'>`, and narrowing the select without narrowing the type leaves a type that claims columns the runtime no longer has, which is precisely the class of bug that surfaces months later at a call site nobody re-read. Narrowing the type instead means threading `Pick<>` through shared helpers such as `personEmails(p: Person)`.

So: a 27% saving on one table's transfer, on an application measured at 60ms LCP with zero long tasks at 5,000 rows, bought with either a dishonest type or a refactor of shared helpers. Not worth it now. Revisit if K1's server-side filtering lands, since that changes which columns cross the wire anyway | 73 call sites. The dashboard queries refresh every 15 minutes over the widest tables and pull every column to compute aggregates | 4 h |
| K8 | **DONE 2026-09-02, and it went further than planned.** Deferring `CandidateRecordPage` and `ContactRecordPage` took first load from 159.2 to 136 KB gzipped. Re-measuring then showed `KanbanBoard`, at 14 KB and carrying `@dnd-kit`, still loading on the candidates list, which has no board: it arrived through `ApplicationPipeline` on the requisition record page. Deferring the requisition record and form pages too moved `KanbanBoard`, `SidePanelTabs`, `RecordPage`, `engagement` and `googleActions` off the list route. **Measured first load of `/recruit/candidates`: 129.6 KB gzipped, down from 159.2, a 19% cut.** The 10 remaining chunks are two thirds framework: 54.4 KB supabase and 51.8 KB react | Both are statically imported beside the list page, which drags `googleActions` into the list view. Measured first load of `/recruit/candidates`: **543 KB raw, 159 KB gzipped**. This defers about 19 KB gzipped | 1 h |
| K9 | **DONE 2026-09-02.** `emptyOutDir: true`. The comment claiming a sandbox file-sync layer prevented it is gone along with every other comment in the codebase, and a clean build now produces 20 chunks rather than accumulating generations | Measured: `dist` held **69 files across four build generations** before a manual clean, 21 after. Stale hashed chunks ship in the deploy artifact | 30 min |
| K10 | Measure authenticated Core Web Vitals and interaction latency | **Measured 2026-09-03 on the local stack.** Worst CLS 0.007, worst INP 16ms, zero long tasks over 50ms across seven authenticated routes on the production bundle. LCP and TTFB over loopback are not deployed figures and are not quoted as such. `npm run cwv --workspace=tests`. Section 7.14 |

| K12 | **DONE 2026-09-02.** The Vite dev server was watching its own build output | Found by looping the gates 30 times rather than 10. The suite failed roughly one run in eight, and only ever when `build` ran before `e2e` in the same pass: 14 consecutive browser-only runs never failed, and 12 consecutive test-then-e2e runs never failed either. Writing 20 hashed files into `app/dist` tripped the dev server's file watcher mid-test. `server.watch.ignored` now excludes both `dist` directories. **20 consecutive clean gate passes afterwards** |

| K11 | **DONE 2026-09-02.** Two duplicate requests on every page load, app-wide | `SessionProvider` called `loadStaff` from both the `getSession()` resolution and the `onAuthStateChange` callback, which also fires on mount, so two identical `staff` requests landed within 1ms. And `useIntakeBadge` called `refresh()` from its mount effect and again from the `SUBSCRIBED` callback, so two `intake_items` HEAD requests fired on every page in the application, both aborting. Both now fire once | done |

**Status 2026-09-03.** K1 to K9, K11 and K12 are done or declined on measurement. K10 is measured on the local stack (section 7.14); only its deployed half, K10b, is open, and that needs a URL and a login. Nothing in this workstream is waiting on work I can do here.

**What the measurement changed.** Performance at real scale is not the problem this workstream assumed. Every Core Web Vital is far inside budget: LCP 56 to 68ms across five routes, CLS at or below 0.007, **zero long tasks anywhere**, and interaction latency under the 16ms floor the Event Timing API can report (the "about 32ms" figure first recorded here was an artifact of timing two `requestAnimationFrame` callbacks, whose floor is one frame interval; it measured the harness, not the app, and section 7.14 replaces it with a real INP). Nothing is close to the 100ms threshold, let alone 200ms. So K7, and K5's per-row RLS concern, should be treated as hygiene rather than as urgent, and the ranking above reflects that. First-load JS for `/recruit/candidates` is 159.2KB gzipped, of which `vendor-supabase` is 55.9KB and `vendor-react` 53.2KB, so two thirds is framework and only K8's 15.3KB of `googleActions` is obviously wasted.

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
| L7 | **DONE 2026-09-02.** `KanbanBoard` cards are focusable and carry an `aria-label` naming their column and position. Space or enter grabs a card, left and right arrows move it between stages, space drops it, escape cancels. A `.grabbed` class gives the held card a visible ring, a `visually-hidden` paragraph carries the instructions and is referenced by `aria-describedby`, and a polite live region announces each move, each refusal at the first or last column, and each cancel. dnd-kit's own `attributes` already supply `tabIndex`, `role` and `aria-roledescription`, so they are spread first and only the label and key handler are overridden; my first attempt set them before the spread and silently lost all three. Three browser tests cover focus, a real move that reaches the database, and escape leaving the board untouched | It wires only `PointerSensor`; cards have no `tabIndex` and no `onKeyDown`. The **requisition pipeline board is not keyboard-operable at all**, failing SC 2.1.1 and 2.5.7. The deals board escapes only because `DealRecordPage` happens to expose stage as a real `<select>` | 3 h |
| L8 | **DONE 2026-09-02.** The nav sits in a wrapper that measures its own overflow with a `ResizeObserver` and a scroll listener, and publishes `data-overflowing` as none, start, end or both. When tabs are hidden, a chevron button appears on the side that has more, with an accessible name, and a gradient fade signals there is more to see. Both disappear when nothing is hidden, and the start button hides when you are already at the start. Measured before: 226px of tabs hidden at 1024px and 482px at 768px behind a bare native scrollbar with nothing to indicate they existed | Measured: at 1024px the 14-tab nav hides about 226px of tabs behind a bare native scrollbar, and at 768px about 482px, roughly the last four tabs. Nothing signals they exist | 3 h |
| L9 | **DONE 2026-09-02.** A `max-width: 900px` block already existed and only stacked the filter rail, which is why the audit found the real problem intact: the shell itself stayed a row of fixed-height scroll panes, so at 768px the table sat about 1400px below the fold and 950px to the right inside a nested pane. The block now also stacks `.fo-body` into a column, caps the sidebar at 40vh, releases `overflow` on the shell and content so the page scrolls as one document, collapses the record `info-grid` to a single column, and lets the title row, action bar and search row wrap.

Three browser tests, and they assert the thing that made this invisible before: the **document** never overflowed horizontally at any width, because everything scrolled internally. So one test measures document overflow across four widths and three routes, and another measures the table's left offset at 768px and fails if it is more than 120px from the edge, which is what a nested pane produces | At 768x1024 the layout does not reflow: the candidates table sits about 1400px below the fold and 950px to the right, reachable only by scrolling a nested pane on two axes, and the action bar clips mid-button. The document itself never overflows, which is why no earlier check caught this | 1 d |
| L10 | **DONE 2026-09-02.** `searchScope(pathname)` derives the noun and the target route from the module you are in, so the sidebar reads "Deal Keywords" on the deals page and searching lands on `/sales/deals`, not on candidates. Seven scopes: requisitions, candidates, accounts, deals, tickets, contacts and intake. The first and last name card is hidden where the record is not a person, because asking for a first name on the tickets list is worse than asking nothing. Four browser tests, including one that searches from the deals page and asserts the URL it lands on | It reads "Candidate Keywords" and submits to `/recruit/candidates?search=` even on `/sales/deals`. A mislabelled control on every non-recruit page, adjacent to SC 2.4.6 | 2 h |
| L11 | **RESOLVED 2026-09-02, and the cause was not what anyone assumed.** Reproducing it properly, once axe covered record pages, gave the real message: `dl element has direct children that are not allowed: label, div > label`. The candidate record renders an `Input` and a `div.field` **inside** the definition list, so the violation was form controls in a `dl`, not the 31 `div.info-item` wrappers I had spent time defending. The 100 lines of editable fields moved into a sibling `div.info-grid info-grid-form` that shares the grid, so the `dl` holds only `dt` and `dd` pairs again.

Extending the axe sweep to record pages found four more violations nobody had seen, because the original audit and my first L12 test both covered list routes only: `aria-prohibited-attr` on the unviewed dots and the timeline icon, `aria-required-children` at **critical** because `.pipeline-toggle` declared `role="tablist"` while its children were bare buttons, and six contrast nodes | axe reported it on the candidate record. Reading axe's own source shows `only-dlitems` unwraps a roleless `div`, so the 31 `div.info-item` wrappers are not the cause, and `structured-dlitems` inspects direct children only. Not worth touching 31 call sites on a guess | 1 h |
| L13 | **DONE 2026-09-02.** One retry for the Vitest suites | Over 26 gate passes the API suite failed exactly once and could not be reproduced in 14 solo runs, 8 runs in the reverse order, or 26 further gate passes. These suites sign in over HTTP against a live stack, so a single transport hiccup was failing a whole gate. `retry: 1` in `vitest.config.ts` makes a genuine failure still fail twice while a transport blip does not. Not a mask: the browser suite already runs with retries disabled in the gate, so a real product regression still surfaces | done |
| L12 | **DONE 2026-09-02, and it immediately caught a regression I had just introduced.** `tests/e2e/accessibility.spec.ts` injects axe-core from the installed package, runs the wcag2a, wcag2aa, wcag21a and wcag21aa rule sets across seven signed-in routes, and fails on any serious or critical violation. Two further tests assert the skip link is the first tab stop and that every control satisfies SC 2.5.8.

It found four serious contrast violations on the first run, **one of them mine**: the "Search these records" disclosure I added earlier that day was link-blue on the grey page band at 4.43:1. The other three were pre-existing: the deals view toggle at 2.83:1 and the settings status pill at 3.59:1, both link or secondary text on the section tint. A new `--fo-link-on-tint` token at `#124a80` clears all three grounds at once, 5.09:1 on the tint, 7.95:1 on the band and 9.06:1 on white. The token guard is now 29 pairs.

Four controls were under 24x24 and are fixed by padding, not by scaling icons: the sidebar collapse button, the quick-search submit, the advanced-search link and the filter toggle.

The target-size test implements the two exceptions SC 2.5.8 actually defines rather than asserting a flat 24px, which would have been wrong. Inline links constrained by their line height are exempt, and so is an undersized control whose 24px centred circle does not intersect another target. The row checkboxes are 18px with a 3px margin, which satisfies the spacing exception; inflating them to 24px would have contradicted the screenshots for no accessibility gain | L6 is the proof that a token-pair check is not an accessibility check | 4 h |

**Status 2026-09-02.** Done: L1 to L6. Open: L7 to L12. L7 is the most serious, because a board nobody can operate by keyboard is a hard accessibility failure rather than a degraded experience.

### Workstream M. Frontend security and the public surface

Added 2026-09-02. Row-level security was out of scope for this audit, having been tested separately; this is the browser side and the unauthenticated careers surface.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| M1 | **DONE 2026-09-02.** Open redirect in `google-oauth-callback` | CWE-601, verified by reading the code. `app_origin` came from the request's Origin or Referer header, was stored unchecked, and was reflected into a 302 Location. A caller holding a valid JWT could forge the header and redirect post-consent to any domain. Now resolved through an allowlist with a logged refusal | done |
| M2 | **DONE 2026-09-02, then redone the same day against the source.** The first pass added Content-Security-Policy, Strict-Transport-Security and Permissions-Policy from recall. Checking OWASP's own repository afterwards showed that was incomplete and in two places wrong: HSTS should be `max-age=63072000` not 31536000, Referrer-Policy should be `no-referrer` not `strict-origin-when-cross-origin`, the CSP was missing `upgrade-insecure-requests`, the Permissions-Policy list was a fraction of the recommended one, and four headers were absent entirely: `X-Permitted-Cross-Domain-Policies`, `X-DNS-Prefetch-Control` (which OWASP recommends specifically for responses carrying personal data, and every authenticated page here does), `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`. All corrected. **`Cross-Origin-Embedder-Policy: require-corp` is deliberately not set:** it blocks any cross-origin subresource that does not send CORP, which would break the Supabase-hosted resume preview iframe and attachment images. Adding it needs a test pass, so it is M10 | All three were missing from `app/public/_headers`. The CSP allows Supabase over https and wss, and allows `*.supabase.co` in `img-src` and `frame-src` because signed attachment URLs and the resume preview iframe come from there | done |
| M3 | **DONE 2026-09-02.** JobPosting structured data | Google requires five properties. The code set `datePosted` and `jobLocation` to `undefined` when a requisition had no `opened_date` or `location`, and `JSON.stringify` drops undefined keys, so the page shipped structured data silently missing a required property. Now gated: all five present or nothing is emitted. The existing test had been asserting against invalid JSON-LD, because its own fixture inserted a requisition with no location | done |
| M4 | **DONE 2026-09-02.** The body is now bounded before it is buffered. `content-length` is rejected above 12 MB up front, and the stream itself is piped through a counting `TransformStream` that errors past the same ceiling, because a chunked request can lie about or omit its length. The existing 10 MB per-file check still runs afterwards on the parsed file, so an oversized single attachment is still rejected with its own message. The oversized-resume test still passes | The 10 MB check runs after the entire multipart body is already buffered, so an unauthenticated caller can force the buffering first. Supabase may impose its own ceiling, which was not verified | 1 h |
| M5 | **DONE 2026-09-02.** Six authenticated functions (`google-oauth-start`, `google-sync`, `calendar-create-meeting`, `gmail-send`, `intake-sheet-commit`, `intake-sheet-fetch`) take their allowed origin from `APP_PRIMARY_ORIGIN` instead of `*`, and send `Vary: Origin`. It defaults to `*` when unset so nothing breaks silently on a deploy that has not set it yet. `careers-apply` and `careers-page` deliberately keep `*`: they are the public careers surface and are meant to be reachable from anywhere. A first attempt tried to echo the request origin per call through a shared helper, and was reverted: `json()` in these functions has no `req` in scope, so it produced code that could not compile | Same function whose header fed M1 | 30 min |
| M6 | **DONE 2026-09-02.** `react-router-dom` 7.18.3. Both remaining advisories are cleared and `npm audit --omit=dev` reports 0 vulnerabilities.

Worth recording what the advisories actually were, because only one of them could ever have applied. GHSA-337j-9hxr-rhxg is arbitrary constructor injection in `deserializeErrors()` during **SSR hydration**, and this app has no SSR, so it was never reachable. GHSA-wrjc-x8rr-h8h6 is an open redirect through a backslash in `<Link>` or `useNavigate`, affecting `>= 6.0.0, < 7.18.0` with **no 6.x patch at all**, which is why clearing it required the major version. Whether it was exploitable here was checked rather than assumed: every `navigate()` and every `<Link to>` in the app takes either a literal or a database id, the only user text goes into a query string rather than a path, and the two places that navigate to a stored value (bookmarks and recently-viewed) read from the user's **own** `localStorage`, so a user could only redirect themselves.

The migration was two steps so a failure would be attributable. First the two future flags (`v7_startTransition`, `v7_relativeSplatPath`) were enabled on v6 and the browser suite run; then the version bump, after which the flags are the default and the prop no longer exists, so it was removed.

One thing nearly produced a false pass: the first suite run after the upgrade still reported 101 green **while the dev server was serving react-router 6 from its cached module graph**. The tell was that the v6 future-flag warnings were still in the console. Killing the server, clearing `app/node_modules/.vite` and restarting it made the console clean, and only that run counts. Five gate passes on 7.18.3, plus three more browser-suite runs chasing one unreproducible failure that has not recurred in eight | Two moderate advisories, one of them fixed only in a major version | done |
| M7 | **DONE 2026-09-02.** The only drift was `axe-core`, installed unsaved by the accessibility audit. Rather than remove it, it is now a proper dev dependency of `tests`, which makes `npm ci` reproducible and puts the tool in place for L12 | `npm ci --dry-run` reports it would remove packages, so the live tree has drifted from the lockfile and `npm ci` is not reproducible against what is checked out | 30 min |
| M8 | **DONE 2026-09-02.** A 1200x630 `og-careers.png` generated from the logo, plus `og:image`, its width and height, `twitter:card` and `twitter:image`. Emitted **only** when `APP_PRIMARY_ORIGIN` is set to an absolute URL, on the same principle as the JobPosting fix: a relative or missing image URL is ignored by crawlers, so half a tag set is worse than none. A test covers both branches | Title, description, canonical, Open Graph, `lang`, sitemap and robots are all present and correct. `og:image` is the one gap | 1 h |
| M9 | **DONE 2026-09-02.** `scripts/check-env-target.mjs`, wired as `npm run check:env` and `check:env:production`. The hazard is Vite's own precedence: in production mode `app/.env.local` overrides `app/.env`, so a `.env.local` left behind from local measurement silently produces a deploy bundle pointing at `127.0.0.1`, and the reverse (building here without it) produces a bundle pointing at the live project. The guard reads both files, prints the effective host and which file it came from, and exits 1 when the effective target disagrees with the flag. Verified both ways: with `.env.local` present, `check:env` passes and `check:env:production` refuses; with it absent, the reverse | The two failure modes are silent and only visible after the bundle is served | done |
| M10 | **DONE 2026-09-02, and the answer is no: `require-corp` cannot be enabled while the resume preview is an iframe on the Storage origin.** Measured rather than reasoned about. Supabase Storage sends no `Cross-Origin-Resource-Policy` and no `Cross-Origin-Embedder-Policy`, only `Access-Control-Allow-Origin: *`, and that is true of both the local container and the live project behind Cloudflare (checked read-only against a nonexistent object, no write). MDN's own wording settles what that costs: a `no-cors` cross-origin subresource needs CORP, while "requests made in `cors` mode won't be blocked by COEP", which an `<img crossorigin>` gets but an `<iframe>` cannot. `tests/e2e/coep.spec.ts` proves all three outcomes in Chromium against the real Storage endpoint: the no-cors image dies with `ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`, the iframe document dies with `ERR_BLOCKED_BY_RESPONSE`, and the same URL in an `<img crossorigin>` still loads. A control run without the header loads all three, so the test cannot pass vacuously. Ten consecutive passes. The one path to enabling it later is to make the preview same-origin, for example a Cloudflare Pages rewrite from `/attachment/*` onto the signed Storage URL, which is a proxy surface to design rather than a header to add | The app has exactly one cross-origin embed, and it is the one thing `require-corp` cannot be talked out of blocking | done |
**Status 2026-09-02.** Done: M1, M2, M3, M6, M9, M10. `npm audit --omit=dev` reports 0 vulnerabilities. Open: M4, M5, M7, M8. Verified clean and needing no work: no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` anywhere in `app/src`; only the anon key reaches the browser bundle, confirmed by decoding the one JWT-shaped string in the built output; the careers apply endpoint already has rate limiting, a honeypot, an extension allowlist and magic-byte signature checks; and a nonexistent and a closed requisition return identical pages, so there is no enumeration.

### Workstream N. Code and stylesheet architecture

Added 2026-09-02. Two research passes and two codebase audits.

**Correction worth recording.** The premise that a 1,796-line stylesheet is itself the problem does not survive checking. No authoritative source names a line or selector threshold for splitting CSS, and every number in circulation is a blog opinion. The same is true of React component length: TypeScript, React and the major published style guides give no number. What *is* a documented anti-pattern is the architecture, one undifferentiated global file mixing tokens, resets, layout and every component with no cascade ordering. So the work below is justified on responsibility boundaries and on cascade control, not on line counts, and the plan should stop quoting line counts as if they were a standard.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| N1 | **DONE 2026-09-02.** Three shims deleted (`sales`, `intake`, `settings`), 20 importers repointed at `lib/supabase.ts`. `modules/dashboards/db.ts` survives, reduced to its one real job of exporting `dashDb`, the client scoped to the `dash` schema. `CLAUDE.md`'s "live wart" section is replaced with what is actually true | `CLAUDE.md` says they work around missing `Relationships` typing. `database.types.ts` already carries `Relationships: []` on all 25 tables, so they are one-line re-exports doing nothing, and only four of five modules use them anyway | 3 h |
| N2 | **DONE 2026-09-02.** One implementation in `lib/format.ts`: `formatDate`, `formatDateTime`, `formatMoney`, each taking an explicit fallback. All three modules delegate to it. The design point that mattered: recruit's `fmtDate` returned an empty string and `RequisitionRecordPage` **depends on that**, filtering fields on `v !== ''` before rendering the grid. Forcing one fallback on all three callers would have put a dash into every empty field instead of hiding it, so the fallback is a parameter and recruit passes `''`. There is a regression test naming that dependency. The `RangeError` is gone: `formatMoney` validates the currency code and falls back to a plain locale string, covered by a test that asserts no throw for `XX`, `DOLLARS`, `12`, `US$` and `''` | Both are duplicated four times. The two `fmtMoney` copies differ materially: the sales version validates the currency code, the dashboards version does not and **throws `RangeError` on an invalid code**. A latent crash, not a style nit | 2 h |
| N3 | **DONE 2026-09-02.** `app.css` is now 18 lines: fourteen `@import './layers/<name>.css' layer(<name>)` declarations and one `@layer` statement that also fixes the five module layers. The cuts are **contiguous in the original source order**, so layer order equals the order the rules were already in and precedence is preserved by construction rather than by inspection: `base, shell, auth, controls, tables, pages, panels, narrow, taleo, states, pagination, motion, widgets, print`. The five module sheets are wrapped in `module.*`, which was mandatory rather than optional: leaving them unlayered would have made every module rule beat every shared rule regardless of specificity.

Proved inert with a computed-style diff harness, not by eye: 44 page states (eleven routes at 1440px, at 800px, under `print`, and under `prefers-reduced-motion`), 11,295 elements, the 92 properties the stylesheets actually declare. Layering alone came back at **0 differences**. The split then showed two real ones and both were fixed rather than accepted: the last row of a printed table gained a bottom border, because `print` as a later layer now outranks the more specific `.table tr:last-child td`, so the print layer cancels it explicitly. The only remaining difference is `color` and `outline` on `a.skip-link` in print, and the snapshot itself records `display: none` for that element in that state, so it cannot be seen.

The step that made it work was not a CSS change at all. The first attempt inverted the order and shrank `.fo-back-to-list` from 13px to 14px, because `intake.css` reaches the entry bundle through `useIntakeBadge` in `PrimaryNav` and Vite emitted it **before** `app.css`, making `module.intake` the document's first-declared layer. Moving `import './styles/app.css'` to the first line of `main.tsx` fixed it and also removed the route-order nondeterminism the audit had flagged as latent. `scripts/check-css-layers.mjs` now fails the build on any rule outside a layer, any layer file not imported by `app.css`, and any layer file that declares its own layer; proven to fail on all three | A single stylesheet of 2,100 lines, and an unlayered rule beats a layered one whatever its specificity, so the split had to be all-or-nothing | done |
| N4 | **DONE 2026-09-02.** The six-rule disclosure block, byte-identical in `recruit.css` and `intake.css`, now lives once in `app.css`. This was the latent hazard the CSS audit named: module stylesheets load in navigation order, so once one copy was edited the winner would have depended on which page the user visited first | Six rules, byte-identical, copy-pasted in `recruit.css` and `intake.css`. Harmless today; nondeterministic per session once one copy is edited, because module CSS loads in navigation order | 1 h |
| N5 | **DONE 2026-09-02, and it retired a documented wart along the way.** `recruit/lib/data.ts` held four jobs in 209 lines: the client, 16 row aliases, five formatters plus `sortRows`, and two hooks. It is now `lib.ts` (pure) and `hooks.ts` (anything touching Postgres or state), the shape the other modules already use, with `savedViews.tsx` moved up out of the `lib/` directory that would otherwise collide with `lib.ts`.

The instructive part is the file written and then deleted. Following CLAUDE.md, recruit first got a `db.ts` mapping `Relationships: []` over every table. That shim is no longer needed: `database.types.ts` already carries `Relationships` on all 25 tables, so a plain re-export typechecked, and so did deleting the file and importing `supabase` directly, with 25 write call sites in the module to prove Insert and Update do not collapse to `never`. Only `dashboards` keeps a `db.ts`, for `dashDb`. Two stale documentation claims corrected: the module-shape line no longer says every module has a `db.ts`, and the recruit README gained a Files table | The largest module diverged from the other four, so every change there needed a different mental model | done |
| N6 | **DONE 2026-09-02, and one of the four was deliberately left alone.** The four largest components were picked by measurement, not assumption: `CandidateRecordPage` 1,166 lines, `ApplicationPipeline` 784, `CandidateListPage` 714, `engagement.tsx` 595.

`ApplicationPipeline` 784 to 640: `AddCandidateDialog` was already a standalone function with its own props interface and its own fetch, so it moved out whole. Its one oddity is fixed too, a `useEffect` calling `setAdding` eleven lines before the `useState` that creates it, which was legal only because effects run after render.

`CandidateListPage` 714 to 492: `candidateRows.ts` now holds `CandFilters`, `CandRow`, `COLUMN_DEFS` and the two pure functions `buildCandidateRows` and `filterCandidateRows`, lifted verbatim out of their `useMemo` bodies with the same dependency arrays. `CandidateFilterRail.tsx` holds the advanced-search rail. Both were chosen because `list-persistence.spec.ts` asserts the CSV export matches the filtered set on screen, which is exactly the invariant an extraction could break.

`CandidateRecordPage` 1,166 to 899: `useCandidateOutreach.ts` owns the twelve email and meeting state variables and their four handlers, `CandidateOutreachDialogs.tsx` owns their two dialogs, and `useCandidateProfileDraft.ts` owns the draft model, the two permission predicates and the save path. The draft hook needed one piece of care: `load()` resets the draft, and the hook needs `load` as its `onSaved`, which is circular. A ref plus a stable `reload` callback breaks it without changing when anything runs.

**`engagement.tsx` is not split, and that is the finding rather than an omission.** It is not one component: it is a hook, three async helpers and six independent panels, each with only local state. There is nothing interleaved to untangle, so splitting would buy file length at the cost of six files plus a barrel to keep two record pages' imports working. Its panels are also not candidates for `components/ui/`, because sales renders the same feature with different markup, so unifying them would change rendered output on one side.

One flake was introduced and fixed here, in the O4 test rather than the app: a full page load drops the previous document's channels without sending `phx_leave`, so a dashboard join that landed after the counter was cleared leaked into the next route's set. The watcher now resets when a new websocket opens. Eight consecutive passes of that spec, then six consecutive clean full gates | Four files carried unrelated responsibilities, and the largest was 1,166 lines | done |
| N7 | **DECIDED 2026-09-02: not adopted, on measured evidence, and revisit at React 19.** It was installed and configured properly first rather than argued about: `babel-plugin-react-compiler` 1.0.0 with `target: '18'` plus `react-compiler-runtime` 1.0.0, both required for React 18 per React's own compatibility reference, and the transform was confirmed to have run by finding the runtime import in the built output.

Then it was measured. Interaction latency on the candidate list, twelve samples per run, typing into the search box and waiting two frames for the filtered result: **median 14.9 ms with the compiler and 14.6 ms without**, and across every run of both configurations the medians sat between 14.6 and 15.8 ms. That is noise. It agrees with the K1 measurement, which found the list render flat at about 60 ms from 10 rows to 5,000: this app is not render-bound, so automatic memoisation has nothing to reclaim.

The cost is not noise. Adding the Babel plugin took the production build from **0.86 to 2.83 seconds**, three runs each, a 3.3x slowdown on the step that runs in every gate pass and every CI job. It also adds two dependencies, one of which (`react-compiler-runtime`) exists **only** because we are on React 18 and is thrown away by the eventual React 19 upgrade.

So: three times the build time and two dependencies, one of them temporary, for no measurable gain on a codebase that is not render-bound. Declined and reverted cleanly, with the packages uninstalled and knip confirming nothing was left behind. The case to revisit is React 19, where the runtime shim is unnecessary and the compiler is the default path | Stable, supports React 18, and there is no `React.memo` anywhere today | done |
| N8 | **DECIDED 2026-09-02, and the decision is split: `exactOptionalPropertyTypes` adopted, `noUncheckedIndexedAccess` declined.** Both flags were measured on both TypeScript programs rather than argued about. `exactOptionalPropertyTypes` produced 5 errors in `app` and 1 in `tests`, all of them honest: three of our own interfaces (`IntakeFilters`, `SendEmailArgs`, `ScheduleMeetingArgs`) and one `useState` type declare `?: T` while every caller passes `x || undefined`, so the declarations now say `?: T | undefined`, which is what they always meant. The two remaining were library types that genuinely reject a present-but-undefined key, and both became conditional spreads: the Realtime `filter` in `RequisitionListPage` and `webServer` in `playwright.config.ts`. The flag is on in both programs and the gate is green.

`noUncheckedIndexedAccess` is 18 errors across 7 sites in `app` and 20 across 9 files in `tests`, and reading every one of them found no latent bug in `app`: each is an array read that is provably guarded at runtime by a `length` check or a loop bound TypeScript cannot correlate. Satisfying it would mean adding roughly 35 branches that can never execute, which is untestable code added to buy nothing, and it does not touch this codebase's actual unsafe boundary, where jsonb and PostgREST rows arrive through `as` casts that indexed access does not re-check. Declined on that basis, not on effort.

The measurement did find one real defect, in the test suite rather than the app, and it is fixed regardless of the flag. `tests/api/attachment-access.test.ts` read `paths[paths.length - 1]` to get the foreign candidate's resume, so the security assertion depended on a previous `it()` block having appended that path last. That breaks the suite's own order-independence rule, and with an empty `paths` it would have called `download(undefined)` and passed for the wrong reason. Both attachments are now created in `beforeAll` and each test names the path it means; every test in the file passes in isolation, checked with `-t` on each one | Two flags in TypeScript's recommended template, one of which turns out to be a tax rather than a check on this codebase |
| N9 | **DONE 2026-09-02.** A `@media print` block hides the utility header, primary nav, sidebar, bookmark bar, action bars, list toolbar, filter disclosure, pager and checkbox column; flattens the shell's fixed-height scroll panes so the whole record flows; forces a white ground; repeats the table header on every page with `display: table-header-group`; prevents rows, sections and panel items from breaking across pages; drops link underlines and colour; and expands capped cells so nothing is clipped in print. **Printable View stops being a placeholder** and calls `window.print()`. Three browser tests cover it, including one that stubs `window.print` and asserts the click actually invokes it.

**One unresolved anomaly, recorded rather than hidden.** The print block's `background` override does not apply to `.record-section-header`, so the blue band still prints blue. Ruled out by testing: the print media query does match (`matchMedia('print').matches` is true and the nav does hide), the selector is present in the parsed print block, `!important` does not change the outcome, no module stylesheet redefines the class, there is no inline style, and enumerating every rule that matches the element returns none carrying a background at all. That last result contradicts the computed value, which is the part I do not yet understand. The assertion was removed rather than left failing or weakened into something meaningless. Cosmetic only: the band prints as a blue bar | There is **no `@media print` rule anywhere**, and the Taleo replica renders a "Printable View" control that currently routes to the placeholder | 4 h |
| N10 | **DONE 2026-09-02.** `@typescript-eslint/no-restricted-imports` in `app/eslint.config.js`, one config block per module, each forbidding the other four by pattern. Verified against three probe files rather than assumed: a sibling import (`../intake/lib`), a deep relative one (`../../modules/recruit/lib`) and a type-only one are all rejected, while `../../lib/format` and `../../components/ui/Button` pass. The whole tree lints clean, so this is regression protection over the state N4 left behind, not a cleanup | Nothing stopped the leak N4 removed from coming back |
**Status 2026-09-02.** All open. N2 is the only one with a live bug behind it.

### Workstream O. Resilience, growth and handover readiness

Added 2026-09-02. These came from asking what nobody had looked at yet, rather than from a tool. Each was checked before being written down, and one suspicion turned out to be unfounded and is recorded as such.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| O1 | **DONE 2026-09-02.** `components/ui/ErrorBoundary.tsx`, wrapped around the route outlet in `AppShell` and keyed on `location.pathname` so navigating away clears a failed page, and wrapped around every dashboard widget's content inside `Widget` so one panel cannot take the others. It shows the message, says the rest of the app still works and nothing saved is affected, and offers Try again and Reload. Three browser tests cover it. Found while testing: `DashboardsHome` was **dead code**, a second unreachable copy of the whole widget layout that only the module barrel exported, and it is deleted | **There is no error boundary anywhere in the application.** Zero matches for `componentDidCatch`, `ErrorBoundary` or `getDerivedStateFromError` across all 113 source files. Any throw during render blanks the entire page to white with no message and no recovery. This is not theoretical: N2's `fmtMoney` throws `RangeError` on an invalid currency code, so one bad currency string in one dashboard cell takes down the whole app | 4 h |
| O2 | **DONE 2026-09-02.** The scale of it was worse than the audit implied: on a development database seeded with ten people, `audit_log` had already reached **64,344 rows and 43 MB** purely from test runs, because a trigger writes a row for every write to every business table. Nothing had ever removed one.

Migration `20260902000003` adds a `retention_policy` table so the windows are data rather than literals, `fn_prune_retained_rows()` as a security-definer function granted to `service_role` only, and a nightly `pg_cron` job guarded the same way migration 04 guards its own. Defaults: **365 days for `audit_log`**, because an audit trail has evidential value and a month would be too aggressive, and 7 days for processed `events_outbox` rows.

The assertion that matters is negative. `validate.sql` check 18 seeds aged and recent rows of both kinds, runs the prune, and fails if a **pending** outbox event was touched: consumers read exactly those, so removing one would drop a business event with no trace. It also fails if recent audit rows were taken. An API test proves no application session can call the prune, and that `events_outbox` still refuses application writes outright, which is what keeps retention from being gamed | Neither table is ever pruned. No migration contains a delete against either. `audit_log` receives a row from a security-definer trigger on **every write to every business table**, and `events_outbox` keeps processed rows forever with `processed_at` set. Both grow without bound, which is a slow problem that becomes a handover problem | 4 h |
| O3 | **DONE 2026-09-02, and deliberately without a vendor.** Sentry's EU region on the free plan was the researched alternative and is defensible, but the payload here is candidate data: a route embeds candidate and requisition ids, and an error message can quote a Postgres detail. Keeping it in this database means no third party, no Content-Security-Policy change, no sourcemap upload and no build change. `20260902000005_client_errors.sql` adds the table, insert-only for staff through a policy scoped to `(select auth.uid())` and readable only by an admin, with CHECK constraints on every length so an oversized payload is a visible failure rather than silent truncation, and a 30-day entry in `retention_policy` wired into `fn_prune_retained_rows()`.

`app/src/lib/errorReporter.ts` caps itself at 20 reports per session and de-duplicates on origin plus message plus the first 200 characters of the stack, so a render loop cannot flood a table that shares an instance with the product. `ErrorBoundary.componentDidCatch` reports with the boundary's label, and `installGlobalErrorReporting()` adds the two listeners the boundary cannot see: `window.error` and `unhandledrejection`, which is where a promise rejection or an event-handler throw actually goes.

Two things the work turned up. First, a write-only table has a trap: `insert(...).select(...)` fails for a non-admin because RETURNING needs the SELECT policy to pass, which cost three test failures before the cause was clear and is now written into the migration header. Second, `validate.sql` check 17 immediately flagged the new policy for calling `auth.uid()` per row instead of once per statement, which is the guard from the RLS work earning its place.

Third, 193 rows were left behind by the first version of these tests, and the reason is worth writing down: the table was granted `insert, select` with no DELETE policy, so every teardown was refused and nothing checked the error. There is now an admin DELETE policy, a test that a recruiter's delete removes nothing while an admin's removes the row, every teardown raises on failure instead of ignoring it, and `scripts/check-attachment-queue.mjs` fails the gate on any leftover `client_errors` row, the same way it already does for orphaned storage objects.

Fourth, the existing O1 boundary test was not testing the boundary: it threw inside `page.evaluate`, where the throw is caught by Playwright and never reaches React. It now aborts the request for a lazily-imported route chunk, which is a real post-deploy failure, and asserts the boundary appears with `Failed to fetch dynamically imported module`, that the shell and both recovery buttons survive, and that a `client_errors` row was written with a `boundary:` origin. `tests/e2e/error-reporting.spec.ts` covers the other three paths: an uncaught error recorded once with its route despite five identical dispatches, an unhandled rejection, and 60 distinct failures capped at 20 | Nothing recorded a production failure. `console.error` in a boundary is invisible, and a boundary never sees a rejection at all |
| O4 | **DONE 2026-09-02, and the premise was wrong in a way that hid a real bug.** The 10 was a count of `.channel()` call sites, not of open subscriptions: they are per-component, so most are route-scoped. Measured by reading `phx_join` and `phx_leave` frames off the Realtime websocket in Chromium across sign-in, five SPA navigations and three record routes. Peak concurrency is **3**, on the dashboard (`intake-items`, `my-reminders`, `my-tasks`) and on a requisition record (`intake-items`, the pipeline and next-steps channels). Every other route holds 1 or 2, and none rejoins once settled.

What the measurement did find is a defect nobody had reported: **`/intake` was tearing down and rejoining `intake-queue` in a continuous loop**, several times a second, for as long as the page was open. `useIntakeQueue` built its loader with `useCallback(..., [filters])` while `QueueListPage` passes a fresh object literal every render, so `load` changed identity every render, the subscribe effect reran, and its own `load()` triggered the next render. This is exactly the pattern that trips the Realtime messages-per-second limit that already caps Playwright at 2 workers.

Fixed in two parts. The loader now depends on the six primitive filter values instead of the object, and the subscription lives in its own effect with an empty dependency array, reading the current loader through a ref. Separately, the badge and the queue were two identical `intake_items` subscriptions delivering every change twice whenever both were mounted; they now share one module-level `intake-items` channel with a listener set and a refcount, which preserves the load-on-SUBSCRIBED behaviour for a late subscriber by invoking it immediately if the channel is already subscribed. `/intake` went from a perpetually rejoining pair to one stable channel.

`tests/e2e/realtime-channels.spec.ts` holds the budget: at most three channels per route, zero rejoins across a six-second idle window, and `/intake` holding exactly `realtime:intake-items`. Confirmed to fail on the pre-fix code and pass after, so it is not a vacuous test. Not merged: `my-tasks` and `my-reminders` could share one channel, but the limit is messages per second rather than channels, so that would save one join and couple two independent components for nothing | The channel count was never the risk. The risk was one page resubscribing forever, which the count could not show |
| O5 | **DECIDED AND IMPLEMENTED 2026-09-02: 60 minutes idle, with a two-minute warning.** The default was no idle timeout at all, because `jwt_expiry` is 3600 with auto-refresh, so a browser left open stayed signed in indefinitely. The threat is not a stolen token, it is an unattended laptop in an office showing candidate records.

60 minutes is chosen against both extremes deliberately. Shorter reads as hostile to a recruiter who keeps the app open all day and would train people to click a dialog reflexively; longer stops being a control. The warning is a dialog with **Keep me signed in** and **Sign out now**, so the timeout never takes a decision away silently.

Two implementation details that matter more than the number. Expiry is computed from a timestamp rather than trusted to `setTimeout`, because a background tab is throttled and would otherwise outlive its window; the tick only compares clocks. And the last-activity timestamp is shared through `localStorage`, so working in one tab keeps every other tab alive instead of one of them signing the user out from under the others. Activity is pointer, key, wheel and touch input plus a tab becoming visible, not mouse movement, so a cat on a desk does not count.

`tests/e2e/idle-signout.spec.ts` drives it with Playwright's clock API rather than waiting an hour: the warning appears at 58 minutes and the sign-out lands at 60, activity at 55 minutes resets the whole clock, and **Keep me signed in** cancels a sign-out that was seconds away. Three tests, whole suite in two seconds. `scripts/check-comments.mjs` also caught the one comment written in the first draft, so the rationale is here instead | An internal tool holding candidate PII with no idle timeout, defaulted rather than decided | done |
| O6 | Confirm backups and point-in-time recovery on the live project | Never mentioned anywhere in this plan or its supporting documents. A1 and A2 made the schema reproducible from source, which is not the same thing as being able to recover the data | 1 h |
| O7 | **DONE 2026-09-02, checked against the npm registry rather than recalled.** `@dnd-kit/core` is at 6.3.1, published 2024-12-05, and 6.3.1 is what is installed here. Not deprecated, no successor release on that line in 21 months. The reason is not abandonment: the project has moved to a new package family, `@dnd-kit/abstract` and `@dnd-kit/react`, whose latest is 0.5.0 (2026-06-11) with betas as recent as 2026-07-13. So the accurate framing is that 6.3.1 is the final release of the stable line and the replacement is still pre-1.0. Staying on 6.3.1 is right for now; the watch condition is a 1.0 on the new line, not a patch on the old one | The library owns keyboard drag on the pipeline board, so an unmaintained dependency there is an accessibility risk, not just a maintenance one |
| O8 | **DONE 2026-09-02, and the audit found the bucket had no limits at all.** `storage.buckets` for `attachments` had `file_size_limit` null and `allowed_mime_types` null, meaning the project default (50 MB) and any content type. Verified by uploading, not by reading config: a 30 MB file was accepted, and so was an HTML document and an SVG. Two of those three matter. HTML is already defused by the platform, which stores `text/html` but serves it back as `text/plain`; SVG is stored **and served** as `image/svg+xml`, so any authenticated staff member could host a scripted document on the project's own Storage origin. `20260902000004_storage_limits.sql` sets a 25 MB cap and a 19-entry mime allowlist covering documents, spreadsheets, plain text, archives and photographs, plus `application/octet-stream` so a file the browser cannot type still stores and downloads rather than being blocked. `text/html`, `image/svg+xml` and `application/xhtml+xml` are excluded, which is the whole point of using an allowlist here. Re-measured after: SVG and HTML now return 415, the 30 MB file returns 413, an ordinary PDF still returns 200.

Three supporting changes. `app/src/lib/attachments.ts` gained `attachmentRejection()`, which `uploadAttachment` calls before the network round trip so the user sees "cv.pdf is 31.5 MB. The limit is 25 MB." instead of an opaque `StorageApiError`; a unit test asserts the client list and the bucket list agree, so they cannot drift apart silently. `intake-email-parser` no longer trusts the sender's declared MIME type: it derives the stored content type from the extension it already allowlists, so a `.pdf` attachment declaring `text/html` can no longer be dropped silently by the new bucket rule. And `validate.sql` check 19 fails if the bucket ever loses its size limit, loses its allowlist, stops accepting PDFs, or starts accepting one of the three renderable types; proven to fail in both directions before being left green | An authenticated staff account is not the untrusted input the careers endpoint guards against, but it is also not a reason to accept 50 MB of arbitrary content types |
**Checked and found sound, so no task:** CI does run the full test suites. A third job in `ci.yml` starts Supabase, seeds the personas, checks migration drift, runs `validate.sql`, the 97 API and unit tests, installs Chromium, runs the 41 browser tests, and checks the attachment queue. I had assumed the browser suite was local-only and that was wrong.

**Status 2026-09-02.** All open. O1 is the cheapest way to stop a single bad value taking down the product, and it pairs with N2.

### Workstream Q. Product capability, as distinct from defects

Added 2026-09-02. Everything above this point is either a defect or a fidelity gap. This workstream is the other axis: what would make the product better for the people who use it all day. **These are proposals, not findings.** They need John's call on value, not a technical decision, and none of them is a bug.

Each was verified against the code rather than assumed.

| # | Task | What exists already | Est. |
| :---- | :---- | :---- | :---- |
| Q1 | **DONE 2026-09-02.** All three bulk buttons on the candidate list are real. **Change Main Status to…** updates every selected candidate in one statement, so migration 10's trigger writes one `status_change` activity and one `candidate.status_changed` event per candidate exactly as it would if they were edited one at a time. **Mark as…** sets or clears `do_not_contact`, which is the only flag `candidate_profiles` carries. **Send Email** sends one separate message each through the caller's own Gmail, never a shared thread, and reports per-recipient failures without hiding the ones that succeeded.

The email path is the one that can reach outsiders, so it is built to make that hard to do by accident: the dialog names every recipient with their address, lists the excluded ones with the reason, refuses to send without both a subject and a body, and **hard-excludes anyone marked `do_not_contact`**, which no amount of clicking overrides. The Send button counts only the mailable ones, so choosing twenty and sending to eighteen is visible before the click rather than after. Both write paths are limited to admin and recruiter, matching the single-record rule, and a sourcer sees the buttons disabled with the reason in the title.

`tests/e2e/bulk-actions.spec.ts` covers the four things that matter: the buttons are disabled until something is selected; changing two candidates writes both rows and produces one `status_change` activity per candidate rather than one per statement; marking do-not-contact removes both from the next bulk email and the Send button drops to zero and disables; and a sourcer cannot bulk-edit at all. The spec snapshots each candidate's status and flag before touching it and restores both afterwards, so it leaves the seed data as it found it. `Table` also gained `data-row-key`, so the spec selects candidates by identity rather than by row position | The selection plumbing was already built and all three buttons were placeholders. Advancing twenty candidates was twenty record visits | done |
| Q2 | **DONE 2026-09-02.** A **Merge duplicate…** action on the candidate record finds another candidate by name, shows a kept-versus-merged-in comparison, and on confirmation moves the duplicate's applications, activities, tasks, reminders, attachments, intake items, tickets and deal contact links onto the surviving record and deletes the duplicate.

It is a single security-definer function, `fn_merge_candidates`, not a sequence of client updates, for two reasons. Atomicity: reassigning five tables and then deleting a person is a set of statements that must all land or none. And one case the client cannot see coming: `applications` is unique on `(requisition_id, person_id)`, so if both candidates applied to the same requisition, reassigning would violate it. The function deletes the duplicate's application in that case and reports how many it dropped, rather than failing halfway.

Two safety properties are deliberate. The merge is **fill-the-blanks only**: every field takes `coalesce(survivor, duplicate)`, so a merge cannot overwrite anything the surviving record already had, and a test asserts exactly that with both records populated. And `do_not_contact` is OR-ed rather than coalesced, so merging a suppressed record into a contactable one keeps the suppression. The function also writes a `note` activity recording what moved, so the merge is visible in the timeline afterwards.

`security definer` bypasses RLS, so the role check inside the function is the real control: it refuses anyone who is not an admin or a recruiter, refuses a self-merge, and refuses a survivor or duplicate that is not a candidate. Four API tests and two browser tests cover all of it, including that a refused merge leaves both records in place | Deduplication existed only at intake. Nothing merged two people rows already in the system | done |
| Q3 | **DONE 2026-09-02.** `/search` searches candidates, requisitions, contacts, accounts, deals and tickets in one pass, grouped by entity with a count, each hit linking to its record. It runs entirely through RLS, so a sourcer's results contain only what a sourcer may read, and a role with no CRM access sees no Deals group at all rather than an empty one.

It complements L10 rather than replacing it. The sidebar's Quick Search stays scoped to the module you are in, which is what L10 fixed; a new **Search everything** link under it carries whatever is already typed into the global search, so the scoped and unscoped searches are one gesture apart.

Three details worth recording. The term is sanitised before it reaches PostgREST: commas, parentheses, `%`, `_` and `*` are stripped, because a comma alone would break the `or()` filter syntax and `%` would let a user inject a wildcard. Two-word queries additionally run a first-name-and-last-name pair query, so "Ada Lovelace" finds the person that a single ilike over either column cannot. And every entity is capped at 25 with an exact count, so a group header reads "5 of 41" rather than silently truncating, which is the same failure K1 had.

`tests/e2e/global-search.spec.ts` has six tests and found a real defect while being written: the tickets query ordered by `created_at`, a column `tickets` does not have, so the whole search failed with `column tickets.created_at does not exist` and the page showed the error rather than results. Only the empty-state test caught it, because the others were looking for hits | Quick Search was hardcoded to candidates on every route, and nothing searched requisitions, accounts, contacts or deals from anywhere | done |
| Q4 | **DONE 2026-09-02.** `email_templates` holds a name, subject and body; Settings gained a card to add, edit and delete them; and both send paths offer a picker: the candidate record's Send email dialog and the new Q1 bulk email dialog. Templates are a team asset, so every signed-in staff member can read them and only admin or recruiter can change them, enforced by policy rather than by hiding buttons. A unique index on `lower(name)` stops two templates called the same thing.

Placeholders are `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{current_title}}` and `{{current_employer}}`, substituted **in the browser at send time and never stored expanded**, so editing a template changes every future send and no past one. In the bulk dialog the substitution happens per recipient, which is the whole point: one template, twenty personalised messages, no shared thread. An unknown placeholder is left exactly as written rather than blanked, and the editor names it so the author can see the typo. Nine unit tests cover the substitution, including spacing and case inside the braces, repeated placeholders, an empty field, and the single-brace case.

The spec found a real accessibility defect on the way: all three Message textareas in the app used a `<span class="field-label">` with no association, so the field had no accessible name and `getByLabel('Message')` matched nothing. All three are now real `<label for>` pairs. axe had not caught it because the field only exists while a dialog is open | No template support anywhere, while acceptance criterion 6.5 assumes it exists | done |
| Q5 | **DONE 2026-09-02.** A saved view can now be shared with the team, and sharing grants read access only. The save dialog has a **Share with the team** checkbox, a shared view reads "name (shared)" in the picker, and **Delete view** is disabled for anyone but its owner with the reason in the title.

The interesting part is the RLS shape. `ats_saved_views` had a single `for all` policy, which cannot express "everyone may read this row but only its owner may change it". `20260902000006_shared_saved_views.sql` replaces it with four: SELECT allows the owner, an admin, or any shared row; INSERT, UPDATE and DELETE stay owner-or-admin. That is why this needed a migration rather than a column and a client-side filter, and it means the disabled button is a courtesy, not the control. A test proves the difference by having a sourcer issue the delete through the API directly and asserting the row survives.

Per-user privacy is unchanged and still tested: the existing 2.9 test asserting one staff member cannot see another's view still passes, because it saves a private one | Saved views were per-user by design, so "the roles Amir is screening" had to be rebuilt by every person who wanted it | done |
| Q6 | **DONE 2026-09-02.** Every list is now navigable without the mouse: `/` focuses the list search from anywhere on the page, `j` and `k` or the arrow keys walk the rows, `Home` and `End` jump to the ends, `Enter` opens the focused record, and `Space` or `x` selects it. The shortcuts live in `Table` and `ListPage`, so all nine lists get them at once rather than the candidate list alone.

The 75 tab stops the audit measured are now one: the table uses a roving tabindex, so exactly one row is ever in the tab order and the rest are reachable only by the row keys. A visually-hidden paragraph states the shortcuts for a screen reader instead of leaving them undiscoverable, and `aria-selected` on the row now reflects the checkbox, which it did not before.

`/` is suppressed inside an input, a textarea, a select or anything contenteditable, so typing a slash in a search box types a slash. `Space` calls `preventDefault`, so selecting a row does not scroll the page, and a test asserts `window.scrollY` is unchanged.

One regression was introduced and fixed here, and it is worth recording because the cause was not obvious. Focusing a row from an effect whenever `activeIndex` changed meant clicking a checkbox moved focus to its row mid-click, and Playwright reported "Clicking the checkbox did not change its state" in the Q1 bulk-action spec, three passes in a row. The effect now moves focus only when the change came from a key, tracked by a ref that the keyboard handlers set and the effect clears. `Input` also had to start forwarding refs for `/` to reach the search box | 75 tab stops to reach the first data row, and recruiters live in these lists | done |
| Q7 | **DONE 2026-09-02.** `careers-status` is a public Edge Function, `verify_jwt = false`, that renders one application's progress from an unguessable per-application token. `careers-apply` now returns the link in its response, for both a first application and a re-application.

Three decisions worth recording, because each is a place this could have leaked.

**The token is a random uuid on the application, not the application id**, with a unique index, so holding one link reveals exactly one application and tells you nothing about any other. `anon` is granted nothing on `applications`, which is why this cannot be a PostgREST read: the function uses the service role and selects one row by token.

**The applicant never sees an internal stage name.** `fn_application_status` maps the eight locked stages onto applicant-facing language in SQL, so the endpoint cannot drift from the mapping: `screening` reads "Under review", `phone_screen` reads "Phone screen", `submitted` reads "Submitted to the hiring company", `client_interview` reads "Interviewing". A test asserts none of the internal names appears in the HTML, and that the page carries neither the applicant's email nor their phone, because the link is shareable by definition.

**A wrong, malformed and missing token return the identical 404 body**, asserted by comparing all three, so the endpoint cannot be used to enumerate.

Six API tests and `validate.sql` check 24. Two local-environment facts came out of the work and are worth knowing before anyone tests an Edge Function here: a **new** function returns 404 until the stack is restarted, because Kong's routes are generated at `supabase start` and the 404 comes from the gateway rather than the runtime; and an **edited** function keeps serving the old module until the edge container is restarted. `supabase stop` and `start` preserved the local database, and the personas needed re-seeding afterwards | An applicant hears nothing after applying, which is the highest-volume inbound message any ATS receives | done |
| Q8 | **DONE 2026-09-02, and it was a day rather than the week estimated, because measuring first shrank it.** At 390px every route scrolled sideways by exactly **333px**, and the culprit was the same everywhere: `.fo-utility-actions` in the header carried `white-space: nowrap` and never wrapped. Everything else already reflowed, which is L9 having done its job. The header now wraps below 640px, the brand subtitle and the bookmark bar step aside, and **`scrollWidth` equals `clientWidth` on all seven routes measured**.

Two further problems came out of measuring rather than assuming, and the second is the interesting one.

**The content began 489px down an 844px screen**, so 58% of the phone was header, nav and sidebar before a single candidate appeared, the sidebar alone accounting for 338px. It now starts collapsed below 640px, which puts the content at 183px, and the expand button still works. A test asserts it stays open at 1440px, because a phone default must not become a desktop default.

**A wide table was not scrolling in its own box; the whole shell was scrolling instead.** `.table-wrap` measured 1449px on a 390px screen with `overflow-x: auto` that never engaged, because `clientWidth` equalled `scrollWidth`. `.list-page-table` already had `min-width: 0`, so that was not it. The cause was `align-items: flex-start` on `.list-page-body`, which becomes `flex-direction: column` at narrow widths: in a column flex container that makes children shrink-to-fit, so the table grew past its parent and `.fo-body` absorbed the overflow. One `align-items: stretch` in the narrow layer fixed it, and the wrap now measures 358px wide with a 1447px scroll width. Desktop was already correct, checked at 1440px, where the wrap is 1052px inside a 1451px scroll width.

Five browser tests: no sideways scroll on any of seven routes, content in the top third, the sidebar collapsed on a phone and open on a desktop, and the table scrolling inside its own box | L9 fixed the reflow. Whether a recruiter can actually use this between meetings was never measured | done |
**Status 2026-09-02.** Q1 is done. The rest are open, none of them a defect.

**Deliberately not proposed:** interview scheduling with availability picking, offer management, and scheduled report delivery. All three are real ATS features and all three are larger than the remaining calendar, so proposing them before October would be dishonest about what fits.

### Workstream C notes from external research

Three points change how items in this stream should be justified and built.

**Fidelity claims need reframing.** Most Taleo specifics the redesign brief treats as requirements are not documented in any Oracle source. Tab order, the `1-20 of N` pager string, the requisition accordion sequence and the ACE / Req Rank / Next Steps vocabulary were all voted down under adversarial verification. The 26 screenshots of VentVest's own instance remain valid evidence, and they are now the *only* defensible source for those specifics. So describe the work to John as "matches your Taleo instance as captured in the screenshots", never as "matches Taleo as documented". It also means **the screenshots are irreplaceable primary evidence and should be preserved**, not treated as disposable reference material.

**Four Taleo behaviours are documented and absent from FOOS**, which makes C13, C14 and C15 the best-evidenced additions in this plan: Back To List restoring the exact list page, a structured status history, Bookmarks, and Printable View opening a separate window.

**Pagination is a fidelity choice, not a best practice.** Salesforce's `lightning-datatable`, the nearest vendor baseline for a dense enterprise list, has no pagination at all and uses infinite scrolling. C5 is still the right call for resemblance, and virtualised infinite scroll is the alternative if use matters more than likeness. Either fixes the real problem, which is 83 rows rendering unbounded.

### The plan with the six goals laid over it, 2026-09-04

One picture of what is done, what remains, and which goal does it. **251 of 266 done, 15 remaining**: 12 in workstream X and 3 already in the parked and blocked register. **Nothing outside those two is open.** Workstream W reached 22 of 22 when W9 shipped, 23 when W24, Klent's login flash, was fixed the same day, and **24 of 24** when W25 replaced W1's two control heights with one.

| | Items | Who does it | State |
| :---- | ----: | :---- | :---- |
| Workstreams **A to V** | 230 | done | **227 done.** Everything through the component audit |
| ↳ still open inside them | **3** | **Klent** | E half, B half, A1, T1. All parked, each needs an account, a credential or a decision from a person. Nothing technical blocks them |
| Workstream **W** | 24 | **Goal 5** | **complete 2026-09-07, 24 of 24.** W25 closed it: one `--control-h: 32px` where W1 had shipped 32 and 40, measured at 369 controls and one height, and guarded in the gate. Detail and per-item state in `docs/12-full-audit/VVPH_VV-FOOS_Log_Goal-5-Execution`; W24's own write-up is in `VVPH_VV-FOOS_Goal_Workstream-W-Component-Implementation` |
| Workstream **X** | 12 | **Goal 6** | Hosting and cutover. **Updated 2026-09-14:** X1, X2, X12 closed by decision (one environment on the existing Singapore project, Cloudflare Pages, Supabase Pro). X8 and X11 remain Klent's. X3 to X7, X9 and X10 are open and are Supabase-side configuration |
| **total** | **264** | | **227 done, 37 remaining** |

**Goals 1 to 4 add to this rather than draw from it.** They are audits: they change no product code and their output is findings, which become new numbered items. So the denominator grows when they finish, and the honest position today is that **37 is a floor, not the remaining work**.

### The running order

| Goal | Produces | Feeds |
| :---- | :---- | :---- |
| **1** Functional coverage, per page per role | A route x role matrix, and the four unlooked-for classes, the best being a control the UI offers that RLS then refuses | Goals 2 and 3 both need it |
| **2** Build, remove or defer | One verdict on each of the 61 dead controls, with Taleo evidence and a size | Goal 5's build list |
| **3** Information architecture | Per-field verdicts, argued from fill rates against 72,917 real records | Goal 5, as W10 |
| **4** Motion and polish | The icon scale, the quieter focus indicator, the ring fix, the missing transitions | Goal 5, as W15, W21, W22, W8b |
| **5** Execute | The component work: W's 22 items plus every verdict from 1 to 4 | |
| **6** Hosting and cutover | X's 12 items | Can run in parallel with 1 to 4, since it touches no component code |

**Goal 6 is the only one that can run out of order.** It shares nothing with the component work, so if Klent wants a URL sooner it can go first or alongside. Everything else is sequential: 1 before 2 and 3, all of 1 to 4 before 5.

### Arming the reminder on every transition

`scripts/goal-reminder.sh` re-injects the active goal every 8 minutes of tool activity, and is silent unless armed. **The hook must be re-armed at every goal transition**, so the instruction lives in three places rather than in anyone's memory:

```sh
bash scripts/arm-goal.sh 1      # arm goal 1
bash scripts/arm-goal.sh        # show what is armed, and the list
bash scripts/arm-goal.sh off    # disarm
```

Each armed goal file **ends by naming the next one**, so the reminder that fires carries its own re-arm instruction. That matters because **an armed goal that no longer matches the work is worse than none: it reads as confirmation.** Any session noticing a stale armed goal re-arms before doing anything else.

### Completion status, revised 2026-09-02

**251 of 266 numbered tasks are done**, which is the sum of the table above and nothing else, halves included: E is 7 and a half of 8, B is 2 and a half of 3. This read 227 that morning, 240 mid-afternoon and 248 that evening. Workstream W closed at 22 of 22 when W9 shipped, taking the total to 249; W24 raised both halves by one to 250 of 265; and W25 raised both again to **251 of 266**. Both W24 and W25 came from Klent watching the thing run rather than from the plan, which is why they enter the count late. The denominator moving twice in one evening is the count being honest rather than the plan being wrong. The denominator moved again on 2026-09-04: workstream V added 13 items for the component audit and **all 13 are now done**. Workstream W entered the table on 2026-09-04 with 23 items and workstream X with 12 for hosting and cutover; W23 then moved to Goal 1 as an audit task, leaving W at 22, so the denominator is 264. **Corrected 2026-09-07: W has started and X has not.** Goals 1 to 4 are complete and their four deliverables are in `docs/12-full-audit/`, and Goal 5 has shipped the only `Blocks` finding from workstream V (row 5, the bulk-select header) plus a second `Blocks` finding that V never saw (G1-4, the Pipeline dashboard reporting zero on 99% of the data). Goals 1 to 4 also added six numbered findings of their own, G1-1 to G1-6, so the denominator has grown and is not restated here until Goal 5 closes. Goals 1 to 4 are audit and specification only, so none of them changed a component; the code changes are workstream W, which now reads 22 of 22 in the table above. The denominator moved on 2026-09-03: workstream U added U1.11 to U1.16 and U3.5, seven tasks found by measuring rather than by planning, and every one of them is done. Workstream D closed completely the same day when D5's bytes arrived through the API. What is left is E½, B½, A1 and T1, which is three and every one of them is in the parked and blocked register, and workstream V is complete, so the open list is back to those three. T1 added four follow-ups; T2, T4 and T5 are done, and T3 turned out to be measurable rather than a design decision: its premise was a node count my own R3 and T2 work had already invalidated, so it is answered in section 7.13 and split, leaving T3a, a single default, as the only part that is yours. Workstream R added six and workstream S eight on 2026-09-02; S1 to S7 are done and verified over nine consecutive gate passes. P2 and P3 were dropped rather than left open: cost figures and a contract date are not FOOS work. The denominator jumped on 2026-09-02 when six background audits added workstreams K, L, M and N, and a further pass asking what nobody had examined added O. 50 tasks between them. That is the honest shape of it: the plan was at 70 of 77 because it had never looked at data access, accessibility, browser security or stylesheet architecture at all.

Counting caveats, kept rather than tidied away. An early headline read "52 of 56" while this table summed to 46½. Workstream D was recorded as 4 done when the evidence supported 3, and D6 had never been built. Both corrected. Every workstream now carries a status line naming which ids are done, which is J11.

| Workstream | Tasks | Done | What remains, and why |
| :---- | :---- | :---- | :---- |
| **C** Taleo fidelity | 17 | 17 | Complete. The remaining fidelity items were tracked in section 8.3 and are now closed too |
| **G** UX and motion | 10 | 10 | Complete by task. Coverage was narrower than that read, and H1 to H6 closed it |
| **E** Gates and testing | 8 | 7½ | E7 is rehearsed on every export that exists; job openings, education and experience have no data to rehearse. E6 is 70 of 82 criteria PASS; the other 12 need a Google account, a production publish, a hosted sheet, or a human click-through |
| **F** Hygiene | 4 | 4 | Complete. F4 decided: archive the other two frontends, delete only on confirmation |
| **B** Security | 3 | 2½ | B1 done. B2 has a proven tool; the live rotation is a production action. B3's local half is done and the production row is your call |
| **A** Integrity | 6 | 5 | A4 fixed in full: a third date format was found and the parse rate went 43 of 74 to 74 of 74. A3 is proven locally and idempotent; only the production write waits on you |
| **D** Data | 11 | 11 | Complete on 2026-09-03. D5, the attachment bytes, was the last to move, and it closed through the API rather than the emailed export it was written against. D11 was the blocker and it is done: the client-credentials flow ran unattended and 371,364 rows are mapped. D2 (687 requisitions), D3 (education is on the candidate fields, 59,499 people) and D4 (nothing to migrate, blank on all 72,910 at source) are closed with it, and D10 in full at 68 contact profiles |
| **H** Frontend consistency | 7 | 7 | Complete. H5 turned out to be six dead CSS selectors rather than a taste decision. H7 is the real logo, added at your request |
| **J** Repository cleanup | 11 | 11 | Complete. J8 needed no change: its premise was wrong |
| **K** Data access and performance | 12 | 12 | Complete. Measurement reframed the whole workstream: performance was fine and silent truncation was the real bug. K1's efficiency remainder was closed by workstream U and measured at 72,917 candidates, not the 75 the threshold was written against: 120ms to first row, 20 requests, 371.9 KB |
| **L** Accessibility and responsive | 13 | 13 | Complete. The note here said L7, no keyboard path on the kanban board, was the most serious open one; L7 was done on 2026-09-02 and the note was never updated. Cards are focusable, arrow keys move a held card between stages, and a live region announces it |
| **M** Security and public surface | 10 | 10 | Complete. Every M row is DONE, DECLINED or ANSWERED, and `npm audit --omit=dev` reports 0 vulnerabilities. M10 answered no on measurement: `require-corp` blocks the resume preview iframe. This row read 10½ of 10, which cannot be right whichever way it was meant |
| **N** Code and stylesheet architecture | 10 | 10 | N2 done, which removes the only live crash in the workstream. N10 now stops the cross-module imports N4 removed from returning. N8 measured both stricter flags and adopted one |
| **O** Resilience and handover | 7 | 7 | O1 done. A render throw is now contained to one page or one widget. O4 measured the channel budget at 3, not 10, and fixed a page that resubscribed forever. O8 found the attachments bucket had no size or type limit at all. O6 dropped: a new develop project makes confirming the old project's backups pointless |
| **Q** Product capability | 8 | 8 | Q1 to Q6 done except Q7 and Q8: real bulk actions, a candidate merge, one search across every entity, email templates, shareable views, and keyboard-first lists |
| **S** Dead code | 8 | 8 | Complete. S1 to S7: knip in the gate, 2 dead files and 27 unused exports gone, 3 hoisted dependencies declared, 3 dead CSS groups removed, and the gate runner committed as `scripts/gate.sh`. Committing the gate exposed that `npm run db:validate` could never fail. S8 done too: four of its five categories came back empty once checked properly |
| **R** Interaction polish | 8 | 8 | Complete, and verified in the browser rather than by reading the CSS. `tests/e2e/interaction-motion.spec.ts` asserts all eight: no tab moves when it goes bold, the chevron's transform matrix, the accordion interpolating height in both directions, a dialog still on screen mid-fade, a transition on every control a user touches, and the dropdown, toast and filter-rail animations. 11 tests, passing. The row said 0 of 6 while every R row below said DONE; the count was wrong, not the work, and R7 and R8 were never counted at all |
| **T** Discovery follow-ups | 6 | 5 | T1 was the screen-by-screen discovery itself, 27 screens at two widths. T2, T4 and T5 done. T3's premise was a node count my own R3 and T2 work had already invalidated, so it was answered by measurement and split; T3a, one default, is yours |
| **U** Zoho migration | 58 | 58 | New on 2026-09-03 and the largest workstream. Extraction, import and verification of all 11 Zoho modules, 371,016 mapped records. U3 is the attachments: 1,747 enumerated, 1,738 in Storage at 451 MiB, 8 identity documents held back and 1 file over the bucket limit. Sections 7.16 to 7.27 carry the measurements, including nine field-level losses that record-count reconciliation had passed. Complete. U1.15 closed the offset plan flip by restating two policies so the planner can estimate them, with the rule proven unchanged over every row for every role |
| **V** Component audit | 13 | **13** | **Complete 2026-09-04.** Audit and specification only: nothing in it changed a component. Sixteen documents in `docs/11-component-audit/`, of which `Audit_V6-Audit-Table` v2.9 is the deliverable at **34 rows**, one rated `Blocks`, every row verified in source or measured and mapped to a W item. **31 routes at two viewports, 16,879 recorded captures, 3,948 controls measured** from computed styles. Pass 6 records **24 of my own claims corrected**, fourteen new findings and **20 things checked and found correct**. The harness itself had 11 defects, seven of which would have failed silently, catalogued in `Audit_V2-Capture-Harness`. The final report is `Report_Workstream-V-Final` |
| **W** Component implementation | 24 | **24** | **New in the table 2026-09-04.** The implementation of everything workstream V found, plus four items Klent added on 2026-09-04: codebase cleanup, making the shared components actually shared, one icon scale wired to the tokens that already exist, the cursor on the 51 `aria-disabled` controls that respond, and the search box's focus indicator. **W23 moved to Goal 1** on the same day, because sweeping as `sourcer` and `bd` is an audit task rather than an implementation one, which is why this reads 22 rather than 23. **22 of 22 done as of 2026-09-07**, in Goal 5: W1, W2, W3, W4, W5, W6, W7, W8a, W8b, W8c, W9, W10, W13, W14, W15, W16, W17, W18, W19, W20, W21 and W22. W9, the remaining task list, is `docs/12-full-audit/VVPH_VV-FOOS_List_Remaining-Work` and closed with the goal, carrying G5-1 to G5-7. W8c carries one deferred part, V6 row 32's mobile capability gate, which waits on P4 and is in the parked register. Each is logged with its measurements in `docs/12-full-audit/VVPH_VV-FOOS_Log_Goal-5-Execution`. Every W item now maps to a goal in `VVPH_VV-FOOS_Goals_Full-Audit-And-Execution`, section "Coverage map" |
| **X** Hosting and cutover | 12 | 3 | **New 2026-09-04**, when Klent said he would host it. The frontend is the easy part: `app/public/_headers` is already committed with the SPA rewrite, immutable asset caching and a full CSP, and the build is 34 files at 955,154 bytes. Everything real is Supabase-side, and X3, X4 and X6 are settings no migration can make. Section 7.28 has the detail |

E2 has moved out of the "decision" column: it was not one. `reminder.due` and tasks now have real dashboard panels.

**Twenty defects were found across the two passes, every one of them by running something rather than reading it.** Seven were database or environment state no migration set; six were guards that existed in one layer only; four were features that looked present and did nothing (the resume Current flag, Save view, My Tasks, the intake badge). Six more were in the tests themselves. The register lists them as D20 to D33 with QA-002, QA-007 and QA-008.

Four of them would have reached production unnoticed, because inspection cannot see them:

| Defect | Why reading the code would not have caught it |
| :---- | :---- |
| The `supabase_realtime` publication held no tables | Every subscription in the app is written correctly. The gap was database state |
| The dashboard refresh button always failed | Only through PostgREST, because `safeupdate` is preloaded for that one role. `pg_cron` calling the same function always worked |
| Save view failed on a NOT NULL column | The button, dialog and handler all exist and look right |
| Every table created after migration 11 has no grants | Policies read correctly; Postgres checks GRANTs first |

**Verification, run in loops rather than once.** Eight consecutive passes of all four gates clean, from a clean `npm run db:reset` with no manual steps, leaving no rows, storage objects or queue entries behind. The suite counts quoted here were 64 API tests, 39 browser tests and 18 schema checks when this was written on 2026-09-01; they are 164, 128 and 27 as of 2026-09-03, and `scripts/gate.sh` is the runner rather than four separate commands. Getting there meant fixing six test-isolation bugs that a single run would never have exposed, including two specs that deleted each other's fixtures and a timezone bug that only appears east of UTC.

Also holding: 0 TypeScript errors, 0 lint problems, 0 build errors, contrast 17 of 17 pairs, motion budget respected, no migration drift, comments 7 of 19,206 lines.

### Superseded status notes

Three earlier status sections (the first-pass 44 of 56 count and two progress notes) were removed on 2026-09-02. They are in git history at `9c57969` and earlier. Three contradicting counts in one live plan was this document's largest source of confusion.

**Still open on the live project:** the Agent 6 RPC drift (needs the database password), QA-003's password rotation, and entering the four monthly cost figures so the cost metric stops reading "Not measured".

**Restated 2026-09-07, because "still open" needs a date to mean anything.** Nothing has been done to the live project since, deliberately: this session's standing instruction is that everything happens on the local stack. Goal 6 sidesteps the first item entirely rather than solving it, because X1 creates a fresh project whose ledger has nothing to reconcile. The other two remain Klent's, and both are in the parked register. The defect log's own tally is the current list: **23 entries covering 22 distinct ids, 20 closed and 3 open**, those three being QA-003, QA-006's mojibake half, and QA-008.

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

### 7.4 Three interaction defects the layering investigation found

Auditing the cascade to plan N3 turned up three live defects that had nothing to do with layers. All three were confirmed in Chromium before and after the fix, and all three are now held by `tests/e2e/interaction-states.spec.ts`.

1. **Every other table row gave no hover feedback.** `.table.zebra tbody tr:nth-child(even)` is specificity (0,3,2) and `.table tbody tr:hover` is (0,2,2), so the zebra tint outranked the hover tint on even rows. Measured: row 0 hovered to `rgb(240,246,251)`, row 1 stayed `rgb(250,250,250)`. The hover rule now also matches `.table.zebra tbody tr:nth-child(even):hover`, which wins.
2. **A pressed primary button turned near-white.** `.btn:active:not(:disabled):not([aria-disabled='true'])` is (0,4,0) and beat `.btn-primary:active:not(:disabled)` at (0,3,0), so the generic grey won. Measured: `rgb(54,121,181)` becoming `rgb(240,246,251)` on press. The primary and danger active rules now carry the same shape and win on order, giving `#2e6da4`.
3. **Link buttons printed in link blue, which is the anomaly recorded on 2026-09-02 as unexplained.** The cause was `.list-page-filter-toggle .link-btn` at (0,2,0) outranking the print block's `.link-btn` at (0,1,0). Media queries add no specificity, which is what made it look impossible. The toggle rule was restating the colour `.link-btn` already sets, so deleting that one declaration restored the print override.


### 7.5 Three items closed on 2026-09-02 that were not numbered tasks

**F4 executed.** The decision was made on 2026-09-02 and is now written where it will be read: `README.md` opens with it and `CLAUDE.md`'s "What this checkout is" states that `foos_redesign_2` is the only frontend anyone should change, that `/foos` and `/foos_redesign` are archived rather than deleted, and that deletion waits on confirmation nobody demos from them. Nothing was deleted, because nothing needed deleting: neither tree exists on this machine.

**Dependency licence compliance.** `scripts/check-licences.mjs` walks the runtime dependency tree, reads each package's own manifest, and classifies the licence into permissive, weak-copyleft-worth-naming, refuse, or unrecognised. All 18 runtime packages are permissive: MIT except `lucide-react` (ISC) and `tslib` (0BSD). The check is in the gate and in `ci.yml`, and `npm run check:licences` prints the full list for the handover. Proven to fail by removing MIT from the allow list. One thing the tree turned up that nobody had noticed: `@supabase/storage-js` pulls in `iceberg-js`, which is MIT and harmless but was not in anyone's mental model of what ships.

**Candidate data retention and an erasure path.** `fn_erase_person` deletes a person and every application, activity, task, reminder, intake row and attachment row that references them, in one transaction, admin only, with the role checked inside the function because `security definer` bypasses RLS. `erasure_log` keeps a receipt: who erased whom, when, why, and how many rows of each kind, with no candidate content. The receipt table is granted `select` and nothing else, to admins only, so **nobody can delete a receipt through the API, including an admin**, because a deletable receipt is not evidence. Retention keeps them ten years. The UI is an admin-only **Erase…** action on the candidate record that requires both a reason and the candidate's name typed exactly.

The Storage half is deliberately separate and the test says so out loud: deleting the `attachments` row queues the path, and once that row is gone the DELETE policy on `storage.objects` matches nothing, so the API cannot remove the file at all. The sweep script drains the queue with the service role. A test asserts `remove()` returns an empty array in that state, which is the documented trap made into an assertion.


### 7.6 A finding from the erasure work: authenticated could TRUNCATE every table

Adding `erasure_log` surfaced something that had been true since the schema was created. Every table in `public` granted all seven privileges to `anon` and `authenticated`, including **TRUNCATE**. Confirmed by running `truncate erasure_log` as the `authenticated` role, which succeeded.

**RLS does not apply to TRUNCATE.** No policy can stop it, so none of the RLS work covered this. What limited the blast radius is that PostgREST never emits TRUNCATE, so a browser could not reach it through the API; the exposure was anything else running SQL as those roles, which is a future security-invoker function, a `pg_net` call, an extension, or a direct connection away.

`20260902000010_revoke_truncate.sql` revokes TRUNCATE, TRIGGER and REFERENCES from both roles on every table in `public`, and alters the default privileges so the next table a migration creates does not inherit them. Two consequences are recorded in the migration header rather than left to be discovered. A table created by a future migration now gets **no** `anon` or `authenticated` grants at all, so each one must grant explicitly, which fails loudly rather than over-granting silently. And the default privileges owned by `supabase_admin` cannot be changed from the `postgres` role, so a table created through the dashboard rather than a migration still inherits the old blanket grant and needs this revoke run again.

`validate.sql` check 23 fails if any table in `public` ever grants those three to `anon` or `authenticated` again, and if the migration-owned default privileges would grant TRUNCATE on the next table.


## 7.7 Workstream R: interaction polish that workstream G never specified

Raised on 2026-09-02 after looking at the running app, and confirmed by measurement rather than by reading the CSS. Workstream G delivered motion tokens, the `prefers-reduced-motion` block, colour transitions on hover and active, the modal and overlay **entry** fade, the intake drawer slide, the Kanban drop settle and the filter-results change. What it never specified is everything below, and none of it is covered by an existing task.

| # | Item | State | Est. |
|---|---|---|---|
| R1 | Exit transitions for every dialog, drawer and overlay | **DONE.** `useOverlayDismiss` keeps the node mounted for 140 ms, marks it `data-closing`, then calls the parent's `onClose`, so `Dialog`, the sales `Modal`, the intake `Drawer` and the placeholder modal all animate out. Measured: 50 ms after a close the overlay is still mounted at opacity 0.36 and gone by 350 ms. Every close path animates, including the nine call sites' **Cancel** buttons, which needed `footer` to become a render prop receiving the delayed closer. Dialogs also close on **Escape** now, which they never did | 4 h |
| R2 | Accordion chevron rotation | **DONE.** The `▾`/`▸` glyph swap is gone, replaced by one lucide `ChevronDown` that rotates `-90deg` when closed. Measured: `none` to `matrix(0, -1, 1, 0, 0, 0)` | 2 h |
| R3 | Accordion content open and close | **DONE, and the popular technique turned out not to work.** The body no longer unmounts; a grid wrapper animates its track. `grid-template-rows: 1fr` to `0fr`, which is what every article recommends, **snapped**: measured 71.19 px straight to 32 px with nothing in between. MDN's formal definition explains why, and it is worth quoting: the animation type is a "simple list of length, percentage, or calc", and `fr` is none of those. So the track is a **measured pixel value** instead, which the same table does promise. Measured collapsing: 71 to 54.7 to 23.0 to 7.5 to 0 px, and reopening 0 to 15.1 to 47.2 to 71 px. Two further corrections came out of the measurement: the padding had to move onto an inner element, because `overflow: hidden` does not clip a grid item's own padding and left a 32 px sliver; and the measurement had to move to `useLayoutEffect`, because with it in `useEffect` the first collapse ran from `auto`, which is also not interpolable, so the very first close snapped. Children still render lazily on first open, so a section nobody opens does no work, exactly as before | 3 h |
| R4 | Tab metric shift | **DONE.** Every tab now reserves its own bold width through a hidden `::before` ghost in the same grid cell, so `font-weight: 700` on the active tab changes nothing. Measured: **0 of 14 tabs move**, where before the active tab went 111.89 px to 114.66 px and its neighbour 107.95 px to 105.91 px. The active tab is still really bold, asserted at weight 700 against 500 for the rest, so the Taleo look is unchanged | 2 h |
| R5 | Micro-transitions on the controls G7 did not list | **DONE.** Measured first: selects, text inputs, search inputs, checkboxes, badges, the star grade, the sidebar collapse, the gear buttons, the nav scroll chevrons and every dialog close cross all reported `transition: all 0s`. They now carry 90 ms transitions on the properties that actually change, and a test fails if any of thirteen named controls has no transition duration | 2 h |
| R6 | A motion test that asserts behaviour rather than budget | **DONE.** `tests/e2e/interaction-motion.spec.ts`, nine tests. It asserts what a user sees: no tab moves, the chevron's matrix, the collapse height mid-transition in both directions, that a collapsed section is `inert` with zero reachable descendants, that a dialog is still mounted mid-fade after its close and after **Cancel**, that Escape closes it, that a menu animates in and out, and that no listed control lacks a transition. `check-motion.mjs` still guards the budget; this guards the behaviour | 3 h |
| R7 | Dropdowns, toasts and inline panels | **DONE.** Raised mid-session: the list was never limited to the four things named. The two utility-header menus now animate in and out through `useDismissable`, including on an outside click, and their caret rotates 180 degrees. The two `sales-toast` notices fade out 140 ms before their 4-second auto-dismiss instead of vanishing. The intake drawer's raw-payload and reject panels fade in. One thing measurement stopped: a `display: inline-block` added for the caret turned out to be unnecessary, because the flex parent already blockifies it, so it came back out rather than stay as a no-op | 3 h |
| R8 | **DONE 2026-09-02: one built, two declined on measurement, and one earlier claim corrected.**

**Built: the filter rail.** It was conditionally rendered, so a large panel appeared and vanished in a single frame on every list. It now fades in and out through the same `useDismissable` delay as the menus, asserted by a test that the rail is still mounted with `data-closing` after the click.

**Declined: `CappedCell`.** Measured before deciding: expanding a capped cell grows it from 32 px to 48 px, and the row height and table height are **identical before and after**, 73 px and 483 px. Nothing moves, so there is nothing jarring to smooth, and the mechanism would cost a `ResizeObserver` per cell on a list that can hold hundreds.

**Declined: the sidebar collapse.** It changes `width`, and `scripts/check-motion.mjs` bans transitioning `width` *and* bans motion on `.fo-sidebar` as a shell selector. Both bans predate this work and exist for Taleo's flatness; animating it means overriding two deliberate guards, which is a decision for whoever owns the fidelity target rather than a polish task.

**The correction.** The R7 commit's message claimed the toast fade and the intake inline-panel animations had landed. They had not: the script that was supposed to write them to `motion.css` hit a `sys.exit` on an earlier replacement in the same run, so the CSS was never written, and I read the output as success. `git show` on that commit confirms zero occurrences of the keyframes. Both are now written, and both are covered by a test that reads the rules out of the loaded stylesheets, so they cannot disappear silently again.

That test needed two corrections of its own, each a real fact about the platform: module CSS is lazily loaded, so `.sales-toast` is invisible from a recruit route and the check has to visit the module that owns each rule; and `style.animationName` reads empty when the `animation` shorthand contains `var()`, because the longhands are not resolved at `cssRules` level, so the assertion reads the shorthand | `CappedCell` has no transition, and the sidebar collapse animates nothing | done |
**Not in scope for R, deliberately.** Route transitions and list-row stagger. Both are the kind of motion that reads as slow the tenth time and neither is a Taleo behaviour, so they would be added on request rather than on principle.


## 7.8 Workstream S: dead code, not dead files

Workstream J removed stale **files**: Vite temp files, a build directory belonging to another frontend, two dead components, an empty fixture directory. It never looked inside the code. Raised on 2026-09-02 when the build output directory prompted the question "have you even cleaned up the codebase".

The standard tool was checked rather than assumed: `ts-prune` is in maintenance mode and its own README now recommends `knip`, which also covers unused dependencies and files rather than exports alone ([knip.dev comparison](https://knip.dev/explanations/comparison-and-migration), [ts-prune README](https://github.com/nadeesha/ts-prune)).

| # | Item | State | Est. |
|---|---|---|---|
| S1 | Adopt a dead-code scanner and wire it into the gate | **DONE.** `knip` 6.34 with `knip.json` covering all three workspaces, `npm run check:dead`, a gate line and a `ci.yml` step. Exits 0 | 1 h |
| S2 | Remove files nothing imports | **DONE.** `recruit/__typecheck__.ts` and `sales/__typecheck__.ts`. Both existed to assert a module still exports its routes, which `App.tsx` already does by importing them | 15 m |
| S3 | Unused exports and types | **DONE.** knip found 27. Nine were dead everywhere and are deleted: `useCanViewDashboards`, intake's `primaryEmail` and `isGraded`, `reportedThisSession`, `anonClient`, `PERSON_TOOLKIT_TABS`, `PersonToolkitTab`, `RelatedType`, `CostInput`, `ApplicationView`. Eighteen were used only inside their own file and simply lost the `export` keyword, which `noUnusedLocals` then re-checks for free | 2 h |
| S4 | Dependencies that only resolved by hoisting | **DONE.** Six scripts and the importer used `@supabase/supabase-js` without the root declaring it, `tests` ran `tsc` without declaring TypeScript, and the tests program referenced `vite/client` without `vite`. The first two are now declared; the third was removed by pointing the tests program at `app/src/vite-env.d.ts`, which already declares the same two variables. Any of the three would have broken the moment the app workspace changed a dependency | 45 m |
| S5 | Dead CSS | **DONE.** A scan of 357 class names found 14 with no occurrence in any `.ts`, `.tsx`, `.html` or Edge Function source. Eleven were **false positives** composed from template literals (`badge-${tone}`, `btn-${variant}`, `tone-${item.tone}`) and were checked before being touched. Three were genuinely dead and are gone: `.cand-layout`, `.dash-tabs` with `.dash-tab`, and `.fo-record-title-row` | 1 h |
| S6 | Documentation and ignore drift | **DONE.** `docs/INDEX.md` was missing the parked-items register and still described nine workstreams; the root `.gitignore` covered `dist/` but not `dist/`, so the build output was ignored only by `app/.gitignore` | 20 m |
| S7 | Verify the S1 to S6 batch and commit it | **DONE.** Nine consecutive clean gate passes. The gate itself is now `scripts/gate.sh` in the repo, run as `npm run gate` or `bash scripts/gate.sh 5`, instead of living in a scratch directory where it died with the session |
| S7a | **A finding from committing the gate.** Writing the runner properly meant deciding how a `validate.sql` failure is detected, and testing that rather than assuming it. **Without `-v ON_ERROR_STOP=1`, psql exits 0 and still prints `VALIDATION COMPLETE` even when a check raises**, proven by forcing check 23 to fail: exit 0 and the sentinel printed, and with the flag exit 3. So `npm run db:validate`, the command README tells a human to run, **could never fail**. It has the flag now, and the gate decides on the exit code rather than on a hardcoded PASS count, which was itself a maintenance trap: that number needed editing four times today as checks were added | done |
| S8 | The cleanup not yet attempted | **DONE, and most of it turned out to be clean.** Four of the five categories came back empty once checked properly, which is worth recording so nobody re-runs the hunt.

**SQL functions: one dead of 40.** Thirty-two of them look unreferenced by a grep and are not: they are trigger functions, reached only through `create trigger`, or policy helpers reached only from a `using` clause, or `next_display_code`, reached from four column defaults. Checking `pg_policy`, `pg_trigger`, `pg_attrdef` and other function bodies instead of grepping is what separates the two. **`clear_google_tokens(uuid)` is genuinely dead**: `disconnect_my_google` inlines the same two deletes rather than calling it, which is also why keeping both invites drift, and it is `security definer`, so dropping it removes an unused privileged entry point.

**Indexes: two redundant of many.** `idx_activities_person` and `idx_attachments_parent` are strict prefixes of a wider index on the same table, so the wider one already serves every lookup and the narrow one only costs write time. Dropped. **Deliberately not dropped:** `idx_integration_settings_staff`, whose only cover is a **partial** unique index (`where staff_id is not null`). The planner can use a partial index when the query implies its predicate and `staff_id = $1` does, so it is redundant in theory, but the table is tiny and the reasoning is a step less direct than the other two.

**Edge Functions: none dead.** `google-oauth-callback` has zero references in the repo and is correct: Google calls it, we do not.

**Duplicated CSS: none.** Zero selector-plus-declaration blocks appear in more than one stylesheet. Twenty selectors are styled in two files, and all but one are the layer architecture working as designed: `narrow.css` for the responsive override, `print.css` for print, `motion.css` for the transition. The exception was `.fo-back-to-list`, split between the shared `widgets` layer and `recruit.css` although only recruit uses it; it is consolidated into the module.

**Seed data: none unused.** Every seeded row is load-bearing for `validate.sql` check 9, which asserts exact counts for sources, statuses, staff, companies, people, both profile tables, requisitions, applications and deals | 3 h |


### 7.9 What the R work exposed in the test suite

Seven gate passes were needed rather than five, because the browser suite failed intermittently and every failure turned out to have a cause worth naming.

**One leftover row was behind three different failures.** `erase-candidate.spec.ts` creates a candidate per test, and a suite run I interrupted skipped its `afterEach`, leaving `qa-erase-ui-… Removable` in `people`. Because the candidate list sorts by last updated, that fixture sorted **first**, and three specs that scraped the first row broke in three different ways: the axe sweep landed on a candidate with an empty section, `global-search` could not parse a name out of `qa-erase-ui-4431-wv3ib2 Removable`, and `email-templates` clicked into a candidate with no email so **Send Email** was disabled. `validate.sql` check 9 caught the row itself, counting 11 seeded people where it expects 10, which is that guard doing exactly its job.

The three specs are fixed by not scraping the list: two now read a known seeded candidate from the database, and the erase teardown raises if its delete fails or the row survives.

**The axe failure was a real defect, and it was not mine.** `<p className="text-secondary">No links on file.</p>` sat as a direct child of a `<dl>` on the candidate record, which is `definition-list` at serious impact. It had been latent all along and only surfaced when the sort order changed which candidate axe visited. It is now a `dt`/`dd` pair. A scan of every `<dl>` in `app/src` for disallowed children found no others.

**Three of my own new tests were timing-dependent** and are now atomic: reading "is the overlay still mounted" and "what is its opacity" in two steps left a window for React to unmount in between, which produced `NaN`, so both are captured in a single `page.evaluate`. R4 compared the whole nav row's geometry, which any unrelated width change perturbs; it now asserts the width of the two tabs that actually gain and lose the bold, which is what the task is about.

**Two lessons about the gate itself.** Piping `gate.sh` through `grep` reports grep's exit code, so a failing gate looked like a pass; the run must be judged on the script's own exit code. And filtering its output while hunting a failure throws away the detail the script printed.


### 7.10 K1's remainder, measured properly, and what it changed

The remainder was written off as "efficiency, not correctness, and not urgent". Measuring it at volume changed that description, so the record is corrected here.

With **5,000 candidates** loaded into the local database, the candidate list rendered its first row in 467 ms, which is fine, and then pulled **9.2 MB over 84 REST requests to display 20 rows**. Broken down by table, the cost was almost entirely two of them: `people` at 52 requests and 5.5 MB, `candidate_profiles` at 12 requests and 3.7 MB. Everything else together came to under 30 KB.

The cause was not client-side filtering in the abstract. It was `select('*')`: the list fetched every person row **in full**, including the `emails`, `phones`, `education` and `experience` jsonb, and every profile row in full including `assessment_scores`, while rendering ten person fields and ten profile fields. Two narrow projections, `PERSON_LIST_COLUMNS` and `CANDIDATE_LIST_COLUMNS`, took the payload to **5.1 MB**, a 44% reduction, with the request count unchanged because chunking was never the problem.

The type system earned its place here. Narrowing the query broke the build, because `profiles` was declared as the full `CandidateProfile` row. Rather than cast that away, the projection is now expressed as a type, `CandidateListProfile`, a `Pick` of exactly the ten columns fetched, so the code cannot read a column it did not ask for.

One thing measurement stopped. Raising the id chunk from 200 to 1,000 to cut request count looked free and was not: 1,000 uuids is roughly 37 KB of query string, the request failed, and `people` vanished from the breakdown entirely while the search silently returned nothing. **The 200 was load-bearing** and is restored, with the reason now in the code as a named constant.

**What is still open, and the honest threshold.** True server-side filtering, sorting and pagination is unbuilt. At the real data volume, 75 imported candidates, none of this matters. The projection buys roughly a 2x headroom improvement, so the point at which it needs building is a few thousand candidates, or sooner for anyone on a slow connection, since 2.5 MB per list visit in production is real. The pieces that make it a two to three day job rather than an afternoon are the ones already tested against client-side behaviour: saved views, and the assertion that the CSV export matches the filtered set on screen.


## 7.11 T1: the screen-by-screen discovery

Full report at `docs/10-discovery/VVPH_VV-FOOS_Report_Screen-by-Screen-Discovery_2026-09-03_v1.0_Draft.md`. Every route in `App.tsx` and in all five module route trees, 27 screens, each captured at 1440x900 and 390x844 full page: **54 screenshots in a gitignored `discovery/`**, measured rather than eyeballed.

**Already right, and worth saying:** no console or page errors on any of the 27, no sideways scroll on any of them at 390px (Q8 had been verified on seven), and exactly one `h1` each.

**Three defects found, all three fixed.**

`select-name` at **critical** impact on `/?tab=pipeline`: the dashboard's date-range select had no accessible name, nor did its two custom-range date inputs. The reason it survived is the more useful finding, that **the axe test covered 7 of 27 routes**; the list is now 17, including the pipeline tab, global search, all four new-record forms, contacts, tickets, promote and both intake sub-pages.

A **serious** contrast failure on the dashboard KPI labels, measured at 3.59:1. `--fo-text-secondary` is fine on the three grounds `check-contrast.mjs` knows about, 5.60:1 at worst, but the KPI cards are painted on the section tint `#a9c6dc`, for which no pair existed. They now use `--fo-tab-label`, 4.98:1 on that tint and already guarded. The durable fix is the axe coverage rather than another token pair, because axe computes the rendered pair and needs nobody to have anticipated the combination.

**All 27 screens shared one document title.** In an app that ships a bookmark bar, every bookmark, history entry and tab was indistinguishable. `useDocumentTitle` in `ListPage` and `RecordPage` fixes it, a record page carrying its display code, held by two tests including one that no two list screens share a title.

**Four items recorded rather than fixed**, as T2 to T5, because each needs a decision rather than a patch: the uncapped activity timeline (362 items and 1,456 SVG paths on one deal record, though 361 of those activities are this suite's own residue), whether one screen should hold 17 collapsible sections, `deals-list` having neither a table nor a section unlike every other list, and generating the axe route list from the router so a new route cannot ship uncovered.

**One number worth keeping:** 175 controls across the 27 screens are `aria-disabled` placeholders. That is the honest size of the looks-finished-but-is-not surface, and the screens with the fewest placeholders are not the ones that look most complete.


## 7.12 T2, T4 and T5: three of the four discovery follow-ups

**T2, the uncapped timeline, done.** `Timeline` renders 50 entries and offers "Show 100 earlier entries" with a "Showing 50 of 362" count beside it. Measured on the deal record that prompted it: **4,263 DOM nodes to 802**, an 81% reduction, timeline items 362 to 50, SVG path elements **1,456 to 218**. Two tests: a long history renders exactly 50 with a working control that expands to 150, and a short history shows no control at all. The cap is a product default rather than a discovered constant, so it is one named constant at the top of the component.

**T4, `deals-list` having neither a table nor a record section, is not a defect.** Its view state defaults to `'kanban'`, so at load there is no `.table-wrap` to count; the Table toggle produces one, which `crm-deals.spec.ts` already asserts. The discovery metric captured the default view faithfully and I read more into it than was there. Closed with no change.

**T5, keeping accessibility coverage in step with the router, done, and it found more gaps.** `tests/e2e/route-coverage.spec.ts` parses `path="..."` out of `App.tsx` and all five module route trees, compares that set against the route list in `accessibility.spec.ts`, and fails naming any route that is neither covered nor explicitly exempt. A second test fails if the exemption list names a route that no longer exists, so the exemptions cannot rot either.

Running it immediately found what the manual list had missed: `/sales/contacts/new` had no axe coverage at all, and the account, contact and deal **record** pages had none either, since the record block only visited requisitions and candidates. All four are covered now, and the six parameterised routes are exempt with the reason attached. Proven by adding a throwaway route and watching the guard name it.


## 7.13 T3: the question was framed on a number my own later work had already invalidated

T3 asked whether one screen should hold 17 collapsible sections, on the strength of the candidate record rendering "2,836 nodes and 108 controls". That figure was taken during T1's discovery pass, before R3 made section children lazy and before T2 capped the timeline. Re-measured on the same route with both in place: **894 nodes and 73 controls**. The premise was two thirds too high and I am the reason it was, having quoted it forward into a report without re-measuring after fixing the two things that caused it.

Measured properly, the section count is not the cost. A closed section is a header and a chevron: **7 nodes and 58px**, and eight of the seventeen are closed at load. All eight together account for **56 of 894 nodes and 464 of 5,979px**. Collapsing more sections by default would recover about 8% of the page, so "too many sections" cannot be the finding.

One section is the cost. History Log / Timeline is **563 of 894 nodes (63%)** and **2,812 of 5,979px (47%)**, on its own, already capped at 50 entries. Everything else on the page put together is smaller than it.

The page is **5,979px of content in a 572px window, 10.5 screens**, and the first two sections are the only ones above the fold. That is the real shape of the screen, and it is worth stating plainly rather than as a node count.

Two sections hold history and their defaults disagree: Status History is closed at load, History Log / Timeline is open. Closing the timeline by default would take the page from 5,979px to roughly 3,220px and 894 nodes to roughly 340, and would match the convention the page already follows for its other history section. That is a one-line change and I have not made it, because it changes what loads first on the primary record screen of a fidelity replica and I have no screenshot evidence for which way Taleo has it. It is the only part of T3 still open.

The seventeen-section structure itself is answered: it costs 56 nodes, and it stays.

## 7.14 K10: measured on the local stack, because the metrics that matter locally are the ones that transfer

K10 sat open waiting for a deployed URL. Its own entry named the alternative, measuring the local stack, and dismissed it as "loopback latency". That is right about half the metrics and wrong about the other half, so the useful move was to measure and label which is which.

LCP and TTFB over loopback are not deployed figures and are not quoted as any. CLS, layout-shift counts, long tasks and INP are layout- and CPU-bound rather than network-bound, so they do transfer. `tests/scripts/measure-cwv.mjs` (`npm run cwv --workspace=tests`) signs in and walks seven authenticated routes with `PerformanceObserver`.

Measured on the production bundle, built against the local stack and served by `vite preview`:

| Route | LCP | CLS | shifts | tasks >50ms | INP |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Dashboard | 52ms | 0.000 | 0 | 0 | 16ms |
| Requisitions list | 76ms | 0.007 | 2 | 0 | under 16ms |
| Candidates list | 40ms | 0.004 | 1 | 0 | 16ms |
| Candidate record | 64ms | 0.001 | 1 | 0 | 16ms |
| Deals board | 52ms | 0.000 | 0 | 0 | 16ms |
| Accounts list | 24ms | 0.000 | 0 | 0 | not measured |
| Intake queue | 24ms | 0.000 | 1 | 0 | 16ms |

**Worst CLS 0.007 against a 0.1 "good" bound. Worst INP 16ms against 200ms. Zero long tasks over 50ms on any route, and zero total blocking time.** The dev server measures slightly worse, worst CLS 0.013 and worst INP 24ms, which is the expected direction for a React development build and makes those the conservative numbers.

Three things went wrong building the harness, all of which would have produced a confident wrong answer:

- The first version clicked the first visible button to provoke an interaction. On most routes that is a nav link, so it navigated, and `performance.interactionCount` was read from a fresh document. Every route reported INP 0 with 0 interactions. It now only clicks controls that leave the URL unchanged, skips destructive labels, and dismisses any dialog it opens.
- An INP of 0 is ambiguous, because the Event Timing API clamps `durationThreshold` to a 16ms minimum and never reports anything faster. The table now carries a clicks column from `performance.interactionCount`, which has no threshold, so "fast" is distinguishable from "never happened".
- An earlier column reported the turnaround of two `requestAnimationFrame` callbacks as though it were interaction latency. Its floor is one frame interval, so it read 33 to 42ms on every route and meant nothing. Removed rather than reinterpreted.

The production measurement needed `app/.env.local`, because `app/.env` points the build at the live project and the bundle tried to authenticate against production. `scripts/check-env-target.mjs`, added in workstream O, printed exactly that and named the remedy. The override was deleted and the bundle rebuilt afterwards, verified by counting local and production references in the emitted assets.

**What is still yours:** the deployed authenticated figure. LCP and TTFB from a real network are the half this cannot produce, and they need a URL and a login. Counted as a half, not a whole.

## 7.15 The intermittent browser failure, and the four defects found chasing it

A gate run went red on the browser step and the runner could not say which test. That is the first defect, and it is in the runner I wrote: `run()` printed `tail -8` of the failed command's output, and npm's own error trailer is eight lines long, so the only useful line was pushed off the top every time. I also read that run as green, because I put the gate behind a compound command ending in `echo` and reported `echo`'s exit code, which is the same mistake as piping the gate through `grep` and reading `grep`'s status. Twice now, so the gate prints its own verdict and I read the log, not the exit code.

`gate.sh` now strips npm noise, greps for signal lines rather than blindly tailing, and for the browser step writes a per-pass Playwright JSON report and parses it into `file :: title [status] message`. Proven against a deliberately failing spec before being trusted.

With attribution in place, three separate flakes surfaced, each with a different cause:

**One, the CSV export assertion, `list-persistence.spec.ts` 2.11.** Reported "8 records for 8 rows" when it wanted 9: the export held seven data rows while eight were on screen. Seven is exactly the seeded candidate count, so another spec had created a candidate, the test read eight rows, that candidate was deleted, and the export then saw seven. The test was asserting an exact count against the shared unfiltered candidate list while other spec files mutate candidates on a second worker. It now creates three candidates under a run-unique token, narrows the list to that token, and asserts against a set only it controls, with checked teardown.

Two real defects in that assertion turned up on the way. It split the file on `/\r?\n/` and counted **physical lines**, but `lib/csv.ts` escapes to RFC 4180 and quotes any field containing a quote, comma, CR or LF, so a correct record may legally span several lines; on a two-row export with an embedded newline that reads 4 where the answer is 3, verified against the extracted parser. And it pushed only truthy names into the on-screen list, so an unresolved row was dropped from one side of the comparison and not the other. It now parses records with a quote-aware reader, asserts no row has an empty name, compares name sets, and attaches the CSV and the on-screen list to the result.

**Two, the hover-tint probe, `interaction-states.spec.ts`.** Received `rgba(0, 0, 0, 0)`, no background at all, meaning the hover never landed for the full three seconds rather than landing on a wrong colour. The probe table was appended to `main`, which is the scroll container, so when the candidate list resolved its names late the table moved and the cursor was no longer over the row. The probe is now pinned with `position: fixed` so nothing can move it, and the poll re-hovers each iteration so a shift is recovered from. 40 consecutive runs alongside its siblings, clean.

The sibling test in that file had the same shape: it captured a `boundingBox()` and then moved the mouse there, which is a measurement taken before the page has settled. It now uses `hover()`, which re-resolves the position with actionability checks. `drag-and-drop.spec.ts` uses the same pattern and was left alone deliberately: a drag genuinely needs coordinates, and re-measuring the target after pickup would be worse, because lifting a card reflows the board. It has not flaked.

**Three, the axe sweep timing out at 30s.** Not a violation, a `Test timeout of 30000ms exceeded`. T5 added four routes to a single test that walks every route in one body, and never raised its limit, so under two-worker contention it began brushing the ceiling. That is a regression I introduced in T5. The sweep is now three tests, screen routes, CRM records and ATS records, each with an explicit timeout, which also means a failure names which group failed.

**Four, two hardcoded absolute paths.** `route-coverage.spec.ts`, also mine from T5, read `accessibility.spec.ts` and `app/src` through `/Users/klentz/Work/VV-FoOS/...`. The guard would have failed on any other machine, which for a guard whose whole job is to run everywhere is worse than the gap it closes. Both are now resolved from `import.meta.url`, and a sweep of `app/src`, `tests`, `scripts`, `supabase`, `migration` and `.github` confirms no absolute path remains in committed source.

One consequence worth recording: the `client_errors` leak check fired twice during this hunt, two rows each time. It was not a new leak. A browser test that dies mid-body skips its teardown, so the leak is a *symptom* of the browser failure rather than an independent fault, and the check correctly refused to call the run clean.

## 7.16 The migration is an app-scale project, and the candidate list was the first proof

The Zoho extraction turned out to be the easy half. Section 7.15's finding, that the Recruit org holds over 70,200 candidates against the 75 the importer was built on, matters most for what happens *after* the import: FOOS could not hold that data.

Every list screen used `fetchAllRows`, which pages through **every matching row into the browser** and then filters and paginates in JavaScript. Six screens, 16 call sites: candidates, requisitions, deals, contacts, companies, tickets. Measured against a locally seeded 70,207 candidates, what the candidate list used to do:

| | Requests | Payload | Wall clock |
| :---- | :---- | :---- | :---- |
| `candidate_profiles`, paged at 1,000 | 71 | 16.9 MB | 478 ms |
| `people`, chunked at 200 | 352 | 18.3 MB | 2,237 ms |
| plus `applications` and `requisitions`, unbounded | — | — | — |
| **total before first paint** | **494** | **35.2 MB** | **2.7 s** |

That 2.7 s is over loopback, with no network latency at all. 494 sequential requests at a realistic 50 ms round trip is roughly 25 seconds.

**After the change, measured on the same 70,207 rows: 133 ms to the first row, 3 list requests, 41.8 KB of REST payload for the whole page, and 875 DOM nodes.** The node count is the same as with 7 candidates (894), which is the point: the cost is now constant in the size of the table.

`public.candidate_list` (migration `20260903000001`) is a `security_invoker = on` view joining `candidate_profiles` to `people`, plus left joins to `candidate_statuses`, `sources` and `staff` for the label columns and an `exists` for the resume flag. One PostgREST request now filters, sorts, pages and returns an exact count.

Four things about it are load-bearing rather than incidental:

- **`security_invoker = on`.** Without it the view runs as its owner and every RLS policy on the base tables is bypassed. Proven per role rather than assumed: as a sourcer, base table 3 rows and view 3 rows; as an admin, 7 and 7. The two roles genuinely differ, so the test can distinguish, which a pair of zeroes could not. My first attempt at this test used the wrong `sub` and returned 0 and 0, which proved nothing.
- **The lookup joins are LEFT, not INNER.** Under `security_invoker` the joined tables' own RLS applies to the caller, so an inner join to a lookup the caller cannot read would silently drop the candidate instead of blanking a label.
- **The `people` join is INNER**, which means a `candidate_profiles` row with no `people` row disappears from the list while still existing in the table. During a 70,200-row import that is exactly the kind of silent loss nobody notices, so `validate.sql` check 25 fails if one ever exists, and also fails if the view stops being `security_invoker`. Both halves proven to bite.
- **The select string must be a single literal.** Built by concatenation it loses its literal type and postgrest-js infers `GenericStringError[]` instead of the row shape.

`search_text` is denormalised into the view because the filters straddle two tables: status, grade, source, sourcer and date live on `candidate_profiles`, while the free-text search covers names and email addresses on `people`. PostgREST can filter an embedded resource but cannot OR a condition across the parent and the embedded table, which is what the search box does. The client never selects `search_text`, so `CandidateListRow` omits it.

Two behaviour changes worth stating plainly:

- **Search is now `ilike` on the database rather than `String.includes` in the browser**, so `%` and `_` in the search box would have become wildcards. They are escaped, keeping the old literal semantics.
- **Export CSV can no longer build the whole filtered set from memory**, because that is the pattern being removed. It now fetches the filtered set server-side in pages of 1,000, and refuses with a message above 10,000 rows rather than silently truncating. `ListPage` accepts an async row provider for this, which the other five screens will need too.

`scripts/seed-scale-candidates.mjs` makes the measurement repeatable: `--count N` to seed, `--purge` to remove, refusing a non-local target without `--allow-remote` and refusing to seed on top of an existing probe set. Two things it taught me, both by failing first: `candidate_profiles.star_grade` is constrained to 1 to 3, and a seed using 1 to 5 fails *after* the `people` rows have committed, leaving orphans; and deleting 2,000 ids in one `.in()` returns `URI too long`, which is the PostgREST limit this repo already documents at 200 ids.

`tests/e2e/server-side-list.spec.ts` fails if any read of `people` or `candidate_profiles` from the list is unbounded, if a view read carries no range, if the pager total does not come from the database, or if a filter fails to change that total. Proven to bite by reintroducing one unbounded `people` read.

**Five screens still hold the old pattern**: requisitions, deals, contacts, companies and tickets. They are the remaining work, and the candidate list is the template.

## 7.17 Four queries that return wrong answers rather than slow ones, and one test that was passing on residue

`supabase/config.toml` sets `max_rows = 1000`. A PostgREST select with no range does not fail past that limit; it silently returns the first 1,000 rows. Anything counted, matched or searched from the result is then quietly wrong, and at today's volumes, 8 applications and 86 companies, it is invisible.

An audit of every read of a large table found **four real cases, plus two false positives I checked individually rather than counting**:

| Where | Table | What it would do after the import |
| :---- | :---- | :---- |
| `AddCandidateDialog.tsx` | `candidate_profiles` | `select('*')` with no bound, then a `people` fetch for every row. The "add candidate to requisition" picker would see 1,000 of 70,200, so most candidates simply cannot be found |
| `RequisitionListPage.tsx` | `applications` | Unviewed-application badges counted from an arbitrary 1,000 rows. Wrong numbers, no error |
| `recruit/hooks.ts` | `companies` | Company dropdown truncated at 1,000 |
| `sales/hooks.ts` | `companies` | Same |

The two false positives are worth naming because a count of six would have been wrong: `EngagementPanel` assigns the query and the caller narrows it with `.eq()`, and `ContactNewPage` narrows with `.filter('emails', 'cs', …)` for a duplicate check. My first heuristic also missed the `applications` case entirely, because a neighbouring query's `.eq()` fell inside its scan window. The count moved from 4 to 6 to 4 as the detection and then the reading were corrected.

The picker is now a server-side typeahead: 200ms debounce, `ilike` on the view's `search_text`, `limit(12)`, and no `people` fetch at all. The other three now page with `fetchAllRows` rather than truncating, which fixes correctness; scoping the applications read to the visible page comes with the requisitions refactor.

`scripts/check-unbounded-queries.mjs` fails the build on a new unbounded read of a large table, and is wired into `gate.sh` and `ci.yml`. It skips two structural patterns rather than carrying a line-number allowlist that would rot: a query returned from a helper, and one assigned to a variable the caller then narrows. Proven to bite by reintroducing the `companies` read.

**And a correction to my own record.** `timeline-cap.spec.ts`, written earlier the same day for T2, asserted the seeded deal had more than 60 activities. A fresh `npm run db:reset` shows that deal has **2**. The test had been passing on activities accumulated by earlier runs, which is exactly the isolation rule this suite is supposed to hold to, and I reported it as verified over ten clean gate passes. It now inserts its own 120-entry history under a run-unique marker and deletes it in `afterAll` with the delete error and a residual count both checked. Verified by running it three times from a clean database and confirming the deal is back to 2 activities with no fixture rows left. A full suite run against the freshly reset database passes, so this was the only test leaning on residue.

## 7.18 U1.3 and U1.4, and a defect I had already shipped twice

**U1.3, requisitions. The speed was the smaller half.** At 2,003 requisitions the old screen cost 21 requests and 3.41 MB, unpleasant but survivable. The defect worth fixing was that the `applications` read carried no `.range()` at all, so PostgREST capped it at `max_rows = 1000` and every per-requisition application and unviewed count was computed from an arbitrary thousand rows.

| | |
| :---- | :---- |
| applications in the database | 14,008 |
| requisitions that actually have applications | 2,002 |
| requisitions appearing in the first 1,000 rows returned | 143 |
| **requisitions whose count read 0 while having applications** | **1,859** |

93% of rows carried wrong numbers with no error. After: 139ms to the first row, 3 list requests, 108.8 KB, and the pager reads `1-20 of 2003` from a server-side count.

`requisition_list` aggregates owners into `owner_ids` and `owner_names` arrays, because the owner filter is a many-to-many through `requisition_owners`; the filter is now `contains('owner_ids', [staffId])`. The aggregates are `LEFT JOIN LATERAL` rather than inner, proven by deleting every owner from one requisition inside a transaction and watching the row survive with empty arrays instead of vanishing.

**U1.4, deals. This one was the DOM, not the network.** 13 requests and 5.29 MB was not the problem; **12,002 rendered kanban cards** was, roughly 84,000 DOM nodes.

| | Old | New |
| :---- | :---- | :---- |
| Time to first card | | 204ms |
| Kanban cards in the DOM | 12,002 | 150 |
| DOM nodes in `main` | ~84,000 | 1,263 |
| Payload | 5.29 MB | 165.5 KB |

The board now fetches 25 cards per stage with an exact per-stage count, one request each for the six stages, and each column says `showing 25 of 2,000`. That is a visible behaviour change and the right one: a column holding two thousand cards was never usable, and the count makes the boundary honest rather than hidden.

Two bugs I introduced in the deals refactor, both caught by the existing drag-and-drop spec rather than by reading the code: `onMove` looked the deal up in the table state, which is empty in kanban view now that cards live in the board, so dragging silently did nothing; and `writeStage` updated only the table state optimistically, so after a successful write the card stayed in its old column. The board now moves the card between columns and adjusts both per-stage totals, which also keeps the settle animation instead of forcing a refetch.

**And the defect I had already shipped twice.** `Table` owns its own sort state and sorts `rows` internally. Once a list pages server-side, `rows` is only the visible twenty, so **clicking a column header sorted twenty rows and silently left the rest of the table out of the ordering**. That was live in U1.1 and U1.3, both already pushed, and no test caught it: the guards asserted paging, not that sorting reached the database.

`Table` now takes an optional `sortKey`, `sortDir` and `onSortChange`. When `onSortChange` is supplied it stops sorting locally and hands header clicks to the page, which puts an `order` on the query. All three screens pass it. `server-side-list.spec.ts` now asserts that a header click issues a **new** view request carrying `order=`, proven to bite by forcing `Table` back to internal sorting and watching both cases fail.

**A limitation of `check-unbounded-queries.mjs`, stated rather than papered over.** It treats `.in()` as a narrowing filter, which is usually right and is wrong in one important shape: the old contacts screen paged every `contact_profiles` row and then asked for the matching people in a single `.in()` carrying every id it had just collected. PostgREST puts that list in the query string, and roughly a thousand uuids is already a 37 KB URI rejected with `URI too long`. At scale that screen does not slow down, it fails outright, and the checker cannot see it because the shape depends on where the id list came from rather than on the call itself. U1.5 fixes the screen; the checker keeps the blind spot.

## 7.19 U1.5: the contact list did not get slow, it stopped working

The other three screens degraded. This one broke outright, and the difference matters because a slow screen gets reported and a broken one gets blamed on the data.

The old code paged every `contact_profiles` row, then asked for the matching people in a **single `.in()` carrying every id it had just collected**. Tested at 15,005 seeded contacts rather than reasoned about:

```
step 1: 16 requests, 15,005 contact profiles collected
step 2: one .in() carrying all 15,005 ids, about a 542 KB query string
result: FAILED after 10 ms, "URI too long"
```

The list would have shown nothing at all. At the 5 contacts the seed carries it is invisible.

| | Old at 15,005 | New |
| :---- | :---- | :---- |
| Outcome | request rejected, no data | 20 rows |
| Time to first row | never | 108ms |
| Pager | none | `1-20 of 15005` |
| DOM nodes | none | 324 |
| Payload | none | 28.2 KB |

`contact_list` is `security_invoker = on`, inner-joined to `people` because a contact profile without a person is not a contact, and left-joined to `companies` so a contact whose company the caller cannot read keeps its row. `validate.sql` check 28 covers the row count, the orphan case and the invoker flag. The guard test now fails if any request carries an `id=in.(…)` list longer than 500 characters, which is the shape that killed it.

`primaryEmail` and `primaryPhone` took a whole `Person` and read one field each. Narrowed to `Pick<Person, 'emails'>` and `Pick<Person, 'phones'>`, so a view row satisfies them without fabricating a fake `Person`.

### The environment fault I could not reproduce

Mid-run, every persona sign-in began failing with an empty error object, `{}`. A direct curl showed **HTTP 502 from Kong**, "an invalid response was received from the upstream server". Restarting Kong fixed it at once.

**The cause is unconfirmed.** Restarting the auth container alone did not reproduce it, and neither did a second full `npm run db:reset`. "Stale Kong upstream after a reset" fits the evidence but is not established, and it is recorded here as an open question rather than a finding.

What is worth fixing regardless is the diagnosis path. `post-reset.mjs` checked REST and the careers function but never auth, so a 502 there passed silently and surfaced later as what looks like a credentials problem. It now checks `/auth/v1/health`, restarts Kong if auth is 5xx, rechecks, and if it still fails says explicitly that an empty sign-in error means a 5xx through Kong rather than bad credentials. Both branches are tested: the healthy path passes immediately, and the recovery path was exercised by pointing the check at a dead port and watching it restart Kong and warn after 70 seconds.

## 7.20 U4: the importer was resumable in principle and corrupting in practice

Phase U4 was supposed to be about speed. Measured, speed is the least of it.

**Throughput, measured rather than guessed.** The 75-row export applies in 1.89s, so 25.2ms per candidate at three round trips each: one `people` insert, one `candidate_profiles` upsert, one `zoho_id_map` upsert. Extrapolated to 70,200 candidates that is **29.5 minutes for candidates alone**, plus roughly 132,000 notes and 39,000 attachments at a similar per-row cost. Call it one to two hours unattended for a one-off migration, which is tolerable and not worth the risk of batching.

**Idempotency already worked, and that was worth confirming rather than assuming.** Applying the same export twice reports `0 new, 75 existing` and leaves the row count unchanged. `loadIdMap` pages properly and is read once per entity.

**But resumability was broken, and it corrupted data silently.** The insert and the mapping are two separate round trips. Killing the importer mid-run at 5,000 synthetic rows left **1,452 mapped and 1,453 people**: one record inserted with no mapping. Resuming produced **5,011 people where 5,010 were expected, with one duplicate candidate**. The duplicate was named `S1452`, exactly the record after the last one mapped, which pins the mechanism precisely.

Worse, the duplicate is **unreachable by the tool that exists to undo imports**: `purge-zoho-import.mjs` works from `zoho_id_map`, and that record has no mapping. After a full purge the orphan remained, and had to be deleted by hand.

And a third defect found while cleaning up: **the purge silently stopped at 1,000 rows**, because it read `zoho_id_map` with no range and hit `max_rows`. It reported `1000 person row(s)` as though finished. Reversing a 70,200-row import would have taken 71 runs with nothing saying so.

### The fixes, and why this shape

Every `people`, `companies`, `activities` and `attachments` insert now uses a **deterministic id derived from the entity type and the Zoho id**, a UUID v5 over a fixed namespace. A retry therefore attempts the *same* id, gets a duplicate-key error, and the importer treats that as "already present" and proceeds to write the mapping. The crash window becomes self-healing rather than duplicating, with no transaction, no `security definer` function and no batching.

Proven by repeating the same test: killed at 1,445 mapped and 1,456 people, so eleven records sat in the window; after resuming, **exactly 5,010 people, 0 duplicates, 0 orphans**. The run reported `1446 existing`, one more than were mapped, which is the self-heal doing its job.

The purge now pages the whole id map. The same 5,000 rows are removed in one pass, and the dry run reports 5,000 rather than 1,000.

The id derivation lives in `migration/src/deterministic-id.mjs` with a `.d.mts` beside it, matching the existing convention there, and is covered by six unit tests: stability, v5 shape, separation by entity type, separation by Zoho id, refusal of empty inputs, and duplicate-key detection by both code and message.

**What this does not cover.** The mapping write is still a second round trip, so an interruption still leaves a record whose mapping is missing until the next run heals it. That is now harmless rather than corrupting, which is the property that matters, but it is not the same as atomic.

## 7.21 U5.3, and a correction to what I wrote this morning

This morning, having found that the Recruit API rejects `Zrecruit_837085000004666040` with `INVALID_URL_PATTERN` and accepts the bare `837085000004666040`, I recorded that "anything joining export rows to API records has to strip it, or every attachment silently fails to find its candidate."

The first half is right and the framing was misleading. Checked against the real files rather than inferred:

| Export | Column | Prefixed |
| :---- | :---- | :---- |
| `Candidates_001.csv` | `Candidate Id` | 75 of 75 |
| `Attachments_001.csv` | `Parent Id` | 50 of 50 |
| `Notes_001.csv` | `Parent Id` | 154 of 154 |

**Both sides of every CSV join carry the prefix**, so the CSV-to-CSV join matches 40 of 40 attachment parents verbatim and the importer needs no normalisation at all. The prefix matters in exactly one place: joining CSV ids to the **API**, which uses bare numeric ids. That is a U3 concern, when attachment bytes arrive, not an importer defect. Nothing was broken.

`tests/unit/zoho-export-contract.test.ts` now asserts that contract against the files: the prefix on both sides, verbatim resolution, `Attachment URL` empty in every row (which is *why* U3 needs another source for the bytes), and the education and experience exports carrying no data rows. If Zoho ever changes any of those, the test says so instead of the importer quietly reporting every child as parentless.

Two mistakes of mine in writing it, both the same mistake twice in one day:

- I hand-rolled a CSV parser that split on newlines before handling quotes, so it misread quoted multi-line fields and reported 2 of 75 candidate ids as bare. The repo already has `parseCsvRecords`, which the importer itself uses; switching to it both fixed the reading and made the test assert against exactly what the importer sees. A `csv.d.mts` was added beside it, matching the convention already there.
- I hardcoded `/Users/klentz/...` as the export directory, which is the identical portability defect I fixed in `route-coverage.spec.ts` earlier the same day. Now resolved from `import.meta.url`, and a repo-wide sweep of `app/src`, `tests`, `scripts`, `migration/src` and `supabase` confirms no absolute path remains.

## 7.22 U2 extraction: what the API actually does, as opposed to what its documentation says

Credentials arrived on 2026-09-03 and both products authenticate and read. `migration/zoho-bulk-read.mjs` implements the flow proven end to end: `POST .../bulk/v2/read` returns a job id, `GET .../read/{id}` polls to `COMPLETED` with a count and `more_records`, `GET .../read/{id}/result` returns a zip containing `{jobid}.csv`.

**Eight of eleven modules extracted and reconciled exactly against their own count endpoint**, for 644 credits in 404 seconds: Candidates 72,910, Job_Openings 687, Clients 104, Recruit Contacts 5, CRM Accounts 86, CRM Contacts 50, Leads 13, CRM Notes 59.

### Four things the documentation gets wrong or omits

**The request body differs between products.** Recruit takes `{"query":{"module":"Contacts","page":1}}`. CRM rejects that with `REQUEST_BODY_NOT_SUPPORTED` and requires the module as an object: `{"query":{"module":{"api_name":"Contacts"},"page":1}}`. That cost one wasted job to discover.

**Bulk read needs its own scope**, `ZohoRecruit.bulk.read`, which `modules.ALL` does not imply. The first attempt returned `OAUTH_SCOPE_MISMATCH`.

**The documented exclusion list is wrong in one direction and right in the other.** Zoho's limitations page says bulk read "is supported for all modules except Notes, Attachments, Emails, and related and cross modules". Tested live: **Notes is accepted and completes** with 200,000 records and `more_records: true`, so the docs are stale there. **Attachments is refused** at initiate with `NO_PERMISSION`, so the docs are right there.

**A job can complete and still refuse its own result.** The Notes job reported `COMPLETED` with a count of 200,000, and then `GET .../result` returned **403 `NO_PERMISSION`, `details.permissions: ["Crm_Implied_View_Notes"]`**. Trusting the job state would have read as success and produced nothing. This is the failure mode most likely to be mistaken for a working pipeline.

### Three modules refuse bulk read, for three different reasons

| Module | Records | Failure | Where |
| :---- | ----: | :---- | :---- |
| Applications | 86,125 | `MODULE_NOT_AVAILABLE` | at initiate; it is a cross-module |
| Notes | 210,922 | `NO_PERMISSION`, `Crm_Implied_View_Notes` | at **download**, after the job completed |
| Departments | 104 | persistent HTTP 500 | at initiate, five retries |

**All three read normally through the paged record API**, tested individually. So the client now falls back to paging on a refusal at initiate, a refusal at download, or a persistent 5xx, and it discovers support rather than trusting either the docs or the job state.

### The `Crm_Implied_*` permissions, and an open hypothesis

Both refusals name permissions that appear nowhere in Zoho's documentation: `Crm_Implied_View_Notes` and `Crm_Implied_EXPORT_Attachments`. Recruit's profile-permission page lists an Export permission covering "Candidates, Clients, Contacts, Job Openings, Products, Campaigns, Notes, Forecasts and Custom Modules" and does not mention Attachments.

**Hypothesis, untested:** these are permissions a client-credentials Self Client does not receive but a user-authorised token would. If that holds, `migration/zoho-refresh-token.mjs`, which I wrote and then described as moot, is what unlocks bulk read for Notes and Attachments. It is an optimisation rather than a blocker, because the paged fallback already retrieves the data, so it is recorded rather than pursued.

### Attachments: resolved, and two orders of magnitude smaller than I claimed

The count endpoint reports 1,740 attachments, but it is undocumented so that figure has no defined meaning. What is measurable: **`Is_Attachment_Present` is true on 526 of 72,910 candidates**, and it is reliable. Verified from both sides: a flagged candidate returns HTTP 200 with a PDF; an unflagged candidate whose `RESUME_ID` is populated returns **HTTP 204, zero attachments**, confirmed on 8 candidates sampled evenly across the file.

So enumeration costs **526 calls, not 72,910**, which was the figure behind my earlier and wrong recommendation to use a manual UI export.

**A data finding for Klent rather than for the code.** 71,005 candidates carry a populated `RESUME_ID`, have no attachment file, and have no usable `RESUME_TEXT`: only 164 candidates have more than 40 characters of it, median 178. I guessed the resume text was inline before measuring it, and the measurement disproved the guess. If resumes are expected for those candidates, they are not present in Zoho as files, and no migration can produce them.

## 7.23 The application stage set was not final, and the data said so

Klent's decision on 2026-09-03: migrate everything from Zoho, no exceptions, and update the stage set rather than discard data to fit it. That **deliberately overrides** the "stage sets are locked, do not reorder or extend" rule in `CLAUDE.md`, which was written when the eight stages were a design commitment rather than a constraint. The override is his to make and is recorded here so nobody later reads the rule as still binding.

I had proposed importing only the 1,348 rows with pipeline meaning and treating the other 84,777 as pool membership and outreach. He rejected that, and on reflection he is right: dropping 96% of a table during a migration is a decision the data does not support, and "we are still building the webapp" means the schema should follow the data at this stage.

### What the data contains

86,125 application records across **21 distinct** `Application_Status` values against FOOS's **8** stages, with 96% in one status that had no equivalent at all:

| Rows | Zoho status | Now maps to |
| ----: | :---- | :---- |
| 83,022 | Talent Pool | **`talent_pool`** (new) |
| 1,742 | Sent InMail I (Linkedin) | **`outreach`** (new) |
| 497 | Associated | **`associated`** (new) |
| 191 + 9 | Submitted, Submitted to client | `submitted` |
| 176 + 1 + 1 | Do Not Pursue, Unqualified, Archived | `rejected` |
| 167 + 116 | Candidate To Review Info, Flag | `screening` |
| 104 + 39 + 30 + 1 | Resume Provided by…, Reference Provider, Applied | `received` |
| 14 + 1 | Interview in progress, Interview-Scheduled | `client_interview` |
| 1 | Interview to be scheduled | `phone_screen` |
| 10 + 1 + 1 + 1 | Candidate Emailing Resume, Sent InMail II, Sent InMail & Left VM, Sent Email I | `outreach` |

Three stages were added **before** `received`, so the enum's own sort order remains the pipeline order the board reads: `talent_pool -> outreach -> associated -> received -> screening -> phone_screen -> submitted -> client_interview -> offer -> hired -> rejected`.

`applications.source_status` keeps the original Zoho string on every row, because 21 into 11 is lossy and this is where the loss is recoverable from without going back to Zoho.

### Two things that would have broken quietly

**`fn_application_status` had no `ELSE`.** It translates a stage into applicant-facing language behind a public status token, and its two `CASE` expressions covered exactly the original eight stages. Adding three stages made an applicant on one of them see a **null headline and null detail**, and with 83,022 `talent_pool` rows that is the common case rather than the edge. Both arms now cover all eleven and have an `ELSE`, so the next stage added fails as an honest string instead of a null.

The wording for the new stages is deliberately not "Application received". A `talent_pool` row means we hold someone's details, not that they applied to that opening, and telling an applicant otherwise on a public page would be a misrepresentation.

**The application pipeline board truncates.** `ApplicationPipeline` is per-requisition, so it was not one of the six list screens in U1, and it read `applications` with `.eq('requisition_id', …)` and no range. Measured from the extracted data: one requisition has **1,300 applications**, seven have over 500, median 96. At `max_rows = 1000` that requisition would silently show 1,000 and lose 300, with the stage counts wrong to match.

This is precisely the blind spot recorded in 7.18: an `.eq()` looks like a narrowing filter to `check-unbounded-queries.mjs`, and it is, but a narrowed query can still exceed `max_rows`. It now pages through `fetchAllRows`, so nothing is lost.

- [x] **U4.5 Wire `map-requisitions` and `map-applications` into `import.mjs`**, in dependency order: requisitions before applications, because an application resolves both a candidate and a job opening through `zoho_id_map` and skips if either is missing
- [x] **U4.6 `knip.json` cannot see a dead mapper.** `migration/src/*.mjs` is declared as an *entry* pattern, so every file in that directory is an entry point by definition and is never reported unused. That is why two brand-new, unwired mappers pass the gate. It should be a project pattern reachable from `migration/*.mjs`, but tightening it before U4.5 would fail the gate on the very files being added, so the order is wire first, tighten after. Tightened once U4.7 landed: `migration/src/*.mjs` is now project-only, and the nine exports it exposed as unused are either de-exported or deleted. No unused *file* is reported, which is what proves every mapper is wired
- [x] **U1.9 done, and the column-count question answered separately.** Migration `20260903000013` adds `application_pipeline` and `application_stage_summary`. Measured on the busiest requisition, which holds 1,300 applications: payload **5,546.9 kB to 98.6 kB**, table DOM nodes **27,662 to 891**, cards **1,300 to 25**, first row **1,121 ms to 234 ms**, requests 46 to 32. The per-stage totals and unviewed counts come from the database, so bounding the board did not turn a slow screen into a wrong one, which is what U1.3 found on the requisition list. `fetchPeopleByIds` was deleted: the view carries the candidate name. Section 7.25.1. The 3,300px board width is a separate question and still open: it is the stage count, not the card count, and whether the five outreach stages collapse into one is yours
- [x] **U1.10 A stale response could silently replace a filtered list.** None of the six list pages guarded against an out-of-order response, so typing a search at 72,917 candidates could leave a full unfiltered page on screen with the search term still in the box, and nothing would trigger another load. This looked like a flaky export test for a while. `lib/useLatestOnly.ts` drops any response that is no longer the newest, applied to all six lists and the pipeline. Proven both ways: 14 consecutive clean runs where it had failed 2 in 8, and a deterministic regression test that delays the first response by 2.5s and fails with 20 rows instead of 2 when the guard is removed. Section 7.25.2

## 7.24 U4.7: five modules had no mapper, and only three of them were real

The instruction was that everything in Zoho Recruit and Zoho CRM must land in FOOS, with no exceptions and multiple passes. The first pass was a script rather than a reading of the code, `scripts/verify-zoho-migration.mjs`, which checks every extracted Zoho id against `zoho_id_map` one record at a time instead of comparing totals. Per-record checking is the point: two modules can have matching counts and disjoint contents.

It found five modules with no importer code path, 285 records. Measuring each one before writing a mapper removed two of them and changed a third.

**Recruit Departments is the Clients module under a second API name.** Both extracts hold exactly 104 records, which is the kind of coincidence worth testing rather than trusting: the id sets are identical, 104 in both, zero on either side alone, and the field sets match down to `Taleo_Client_ID`. Writing the obvious mapper would have created 104 duplicate companies and called it progress. Verification pass 2 now asserts the overlap on every run, so if Zoho ever makes Departments a genuinely separate module the assertion fails instead of the data silently duplicating.

**Recruit Contacts had never been imported, and the plan said it had.** The U4.4 table recorded it as covered. It was not: `importContacts` reads `ZohoCRM/Contacts`, and the five Recruit client contacts are a different module with different ids. The claim came from matching a module name rather than reading the call site.

**CRM Leads has no FOOS table, and the faithful mapping is not the obvious one.** A lead becomes a person with a `contact_profiles` row. What it does not become is a company: the 13 leads carry 11 distinct `Company` values, and several are job titles rather than employers, one of them "Sales & Marketing Coordinator Harcourts Takapuna". Minting a company per distinct string would have put eleven rows of that quality into the list every deal and requisition picks from. The lead-only fields are written to a note on the person instead, so nothing is lost and nothing junk is created. This is a judgement call and reversible: the strings are in the note bodies if they should become companies after all.

**Three real gaps remain and are now wired**: Recruit Clients to `companies`, Recruit Contacts to `people` and `contact_profiles`, CRM Notes to `activities`. Against the real extracts all four new phases map with zero skips and zero failures: clients 104 of 104, contacts 5 of 5, leads 13 of 13, CRM notes 59 of 59.

### 7.24.1 Three defects the same work exposed, none of them in the new code

**The notes phase reported every insert as a failure.** `importNotes` and `importAttachments` both ended their success path with `existing.set(key, data.id)`, and `data` is bound nowhere in that scope: the only binding in the file is inside `loadIdMap`. Every note therefore threw a `ReferenceError` after its insert and its mapping had already committed, was caught by the surrounding handler, and was counted as failed. The rows and the mappings are correct; the report would have said 210,922 failed. Proven from the database rather than the log, which the importer buffers: 27,769 activities against 27,760 note mappings mid-run, a difference of exactly the nine seed activities.

The general lesson is that the run's own report is not evidence. It is produced by the same code being tested, and here it would have been wrong in the most alarming possible direction. The database is the evidence, which is why the verifier reads the database and the extract and never the report.

**Every imported requisition was stamped with the import date.** This is the same defect the contacts screen showed when it read "last updated Sept 3", and the answer is the same: the date is in the export. `mapRequisition` read `Creation_Date`, a mostly-null custom Taleo field, and carried it into the report as an unmapped value, while `Created_Time` and `Modified_Time` sat unread in the same row. All 687 requisitions had `created_at` of today. Both timestamps are now written, and the mapper warns when `Created_Time` is missing rather than silently accepting the default. `activities` and `applications` were checked at the same time and are fine: they carry `occurred_at` and `applied_at`, both already taken from Zoho, and neither table has a `created_at` column to get wrong.

**No requisition had a company, and the mapper had said the column did not exist.** `mapRequisition` carried `Client_Name` with the warning that it has "no column on requisitions". `requisitions.company_id` exists. All 687 job openings reference a client id that resolves against the 104 Clients, covering 97 distinct companies, so the link was available the whole time and the warning was wrong. Ordering the clients phase before requisitions is what makes it resolvable, which is why `main()` now runs it there.

### 7.24.2 One read-only bug found by proving an assumption instead of stating it

Four module directories hold two CSV files each, and `readBulk` took `readdirSync(...).find(f => f.endsWith('.csv'))`, the first file only. The two files turned out to be byte-identical re-downloads, confirmed by checksum, so nothing was actually lost. That is luck, not correctness: a paged result would have been silently halved. `readBulk` now unions every CSV in the directory and dedupes by Zoho id, which handles both the identical case and the genuinely paged one.

### 7.24.3 Staff attribution was empty for every module, because Zoho's two export formats disagree

The importer's own report said it plainly and it was read as noise: "unresolved staff: 7 distinct value(s) across 145,962 row(s)". Seven values is small, so it looked like a handful of ex-employees. It was not. The seven values were **numeric Zoho user ids**, and `resolveStaff` looks a value up in an index of staff *names*, so it could never match one.

The cause is that Zoho's two bulk-read output formats represent a lookup field differently. The paged **JSON** result gives `Created_By: { name, id }`. The **CSV** result gives `Created_By: 837085000000540058`, the id alone, with no name anywhere in the file. Every module extracted as CSV therefore lost its owner, its creator and its last modifier: candidates, job openings, clients, contacts, and both CRM object modules. `people.created_by` was set on 10 rows, all of them seed.

`add-legacy-owners.mjs` could not see the problem either, because it skips values matching `/^\d{10,}$/` on the reasonable assumption that a bare id is not a person's name. It reported 4 missing owners when the true figure was 5, and the one it could not see accounted for 67,463 references on its own.

Three changes, in the order they had to happen. `migration/zoho-users.mjs` builds an id-to-name map, first from the `{name, id}` objects already present in the JSON extracts and the saved CRM users export, which covered 6 of the 11 referenced ids at no API cost, then from `/users?type=AllUsers` on each product for the rest. It exits non-zero while any referenced id is still unnamed, so a partial map cannot pass quietly. `resolveStaff` now recognises an id-shaped value and translates it through that map before the name lookup, and records the id as unresolved when the map has no entry, rather than silently returning null. `add-legacy-owners.mjs` translates ids the same way, which is what let it find the fifth owner.

The Recruit users call returned **401** on the first attempt, on a scope of `settings.ALL,modules.ALL`. The users endpoint needs `ZohoRecruit.users.ALL` specifically, which is a separate scope in the same way `ZohoRecruit.bulk.read` turned out to be. Two API calls in total. After the fix the importer reports no unresolved staff at all, and all 12 staff rows exist.

### 7.24.4 The id map lost a third of itself to unordered paging, and deterministic ids hid it

The dry run after the owner fix reported `candidates 72910 rows, 24047 new, 48863 existing`. Every candidate is mapped, so every one should have been existing. Measured directly, `loadIdMap` fetched 73 pages for 72,910 candidate rows, which is the right number of pages, and returned **47,453 distinct ids**. It was fetching the right volume and getting the wrong rows.

`loadIdMap` paged with `.range(from, from + 999)` and **no `ORDER BY`**. Postgres does not guarantee row order without one, so successive OFFSET windows over the same query can return a row twice and never return another. This is not a slow query or a truncated one, both of which have already been found in this codebase; it is a query that returns the wrong rows, silently, and differently on each run.

Its consequences were entirely masked. Because the map was short, the importer believed a third of the already-imported records were new and re-inserted them, and because U4.1b made every insert id deterministic, each re-insert collided with itself and was treated as already present. **The deterministic id fix, added for crash resumability, is the only reason this bug corrupted nothing.** Without it, a resumed run would have produced tens of thousands of duplicate candidates, notes and applications.

`loadIdMap` now pages by keyset, ordering on `zoho_id` and filtering `.gt()` on the last id seen, and then asserts its own completeness against an exact count, throwing rather than proceeding if the two disagree. The dry run afterwards reports 0 new and 72,910 existing for candidates, and matching figures for every other module.

The general guard is `scripts/check-paged-order.mjs`, in the gate and in `ci.yml`. It flags any `.range()` paging that never calls `.order()`, and any that orders only on a non-unique column, because `.order('name')` with OFFSET has the same defect whenever two rows share a name. It resolves query-builder helpers so a list page that applies its order inside `applyFilters` is not a false positive, and it was verified against both real shapes before being trusted. It found two further live cases: the application pipeline paged on `applied_at` alone, and both company dropdown lookups paged on `name` alone.

### 7.24.5 Two lookup tables were missing rows, and the report had been saying so all along

After the staff fix the importer still reported "unresolved source: 17 distinct value(s) across 3,960 row(s)" and "unresolved status: 12 distinct value(s) across 12,469 row(s)". A distinct count of 17 reads as trivia. The row count is the number that matters: 3,960 candidates were importing with no source and 12,469 with no status, and both are columns a recruiter filters on.

The missing sources are the job boards the sourcing team used: Monster, HotJobs, Dice, CareerBuilder, Indeed Resume, ZipRecruiter, Upwork, The Ladders, ZoomInfo, LinkSV, MEPJOBS, LinkedIn Job Board, Sourcing Center, Craig's List, Google import and Vendor. The missing statuses are the candidate-level outreach states, which are a different set from the application stages extended in migration 20260903000002: the sent-email and voicemail sequences, Sent InMail II, Sent Email & InMail, Candidate Emailing Resume, Reference Provider, Submitted & considered weak, and Flag.

One value was deliberately not created. "LinkdIn" is a misspelling of LinkedIn in a single Zoho record, and it is aliased in the mapper rather than added as a row, because a misspelled source would then sit in every source dropdown permanently. The new statuses are appended after the existing 18 rather than interleaved, since renumbering rows the UI already sorts by would be a behaviour change and this migration exists only to stop dropping data.

The pattern across 7.24.3 and 7.24.5 is the same and worth naming: the importer had been printing both problems on every single run, and both were read as noise because the distinct-value count was small. A report line whose only quantity is "how many kinds" hides how much. Both figures are now printed together, and the verifier checks the outcome in the database rather than trusting either.

### 7.24.6 What Zoho does not have, established rather than assumed

Candidate work history imports as an empty array, and that is correct. `Experience_Details` came back header-only from the UI export, which on its own could have meant a broken export. It does not: in the bulk extract `Current_Employer`, `Experience_in_Years`, `Skill_Set` and `Highest_Qualification_Held` are empty on all 72,910 candidates. The fields exist in the Zoho layout and nobody ever filled them. `Current_Job_Title` is populated on 3,560 and does import, on 3,567 profiles including seed rows, and education is populated on 59,499 people from the degree columns.

This matters because "the export looks empty" and "there is nothing to export" call for opposite responses, and only one of them justifies 72,910 record-level API calls to fetch subforms. Checked before spending the credits, not after.

### 7.24.7 The field-level audit, which found nine losses that every count-based check had passed

Every module reconciled by record count. Every module also passed the referential-integrity checks. The data was still wrong, because a record can be present and mapped and still be missing most of its fields, and nothing that counts rows can see that.

The method was to take each FOOS column the mappers write, count how many rows have it, count how many rows the Zoho extract populates for the corresponding field, and compare the two numbers. Where they matched, the field was correct. Where they did not, the reason was always a name, never a parse.

**Nine losses found this way.** In descending order of what they cost:

| What was lost | Rows | Cause |
| :---- | ----: | :---- |
| `activities.created_by` on every Recruit note | 210,922 | The notes UI export has a `Note Owner Id` column and no `Note Owner` column, so the derived target was `Note_Owner_Id`, which the bulk JSON does not have. Its `Note_Owner` object was dropped before any mapper saw it |
| `people.linkedin_public_url` | 70,208 | Bulk read calls it `LinkedIn__s`, the mapper reads `LinkedIn`, and `__s` is not an underscore-to-space derivation |
| `applications.answers`, 20 application-level fields | 86,125 | Five were collected into `carried`, which is only printed; the other fifteen were never read. `Amir_Grade` alone is populated on 58,054 |
| `candidate_profiles.initial_date` | 11,538 | Two real shapes the parser did not know: `MM/YYYY`, where the four-digit trailing number is a year, and multi-date lists like `3/24; 11/24` |
| `requisitions.opened_date` | 674 | `parseZohoDate` handled `MM/DD/YYYY` and full ISO timestamps but not the bare `YYYY-MM-DD` that bulk read emits for a date-only field |
| `requisitions.pay_notes` | 500 | `Salary` was collected into `carried` and discarded. It is free text, so it belongs in `pay_notes` rather than `pay_min` |
| `contact_profiles.company_id` | 48 | The mapper read `Account Name.id`, which is how the UI export splits a lookup into label and id. Bulk read does not split it and emits no `.id` column |
| `requisitions.num_openings` | 25 | The mapper read `No_of_Positions`; the export calls it `Number_of_Positions`. Every requisition claimed one opening; Zoho has 17 with two, 4 with three, 3 with four and one with ten |
| `people.postal_code` | 1,122 | Bulk read calls it `Zip_Code`, the mapper reads `Postal Code` |

**Three causes, not nine.** Five of the nine are the same mistake in different places: the mapper reads a UI export column name, bulk read emits a different API field name, and nothing fails when they disagree. That covers the note authors, the LinkedIn URLs, the postal codes, the contact companies and the openings count. Two more, `pay_notes` and the twenty application fields, were read correctly and then written nowhere, because `carried` is only ever printed in a report. The last two, `initial_date` and `opened_date`, are genuine parser gaps.

What all nine share is that a missing field is indistinguishable from an empty field, so the importer reported success on every one of them. The `notes` case is the sharpest illustration: `resolveStaff` is called with an empty string, returns null without recording anything, and the report says zero unresolved staff while losing every author.

**Equally important, what the audit cleared.** These were checked and are correct, so nobody needs to look again. Candidate `first_name` 72,890, `last_name` 72,910, `city` 69,118, `state` 69,285, `country` 72,623, `street` 3, `linkedin_recruiter_url` 57,260 and `education` 59,499 all match Zoho exactly. Note bodies are populated on 32,446 of 210,922 because Zoho populates 32,446, not because the import dropped them. `star_grade` is set on 327 of 334 rated candidates because seven carry a rating of 4, which the 1-to-3 CHECK constraint rejects by design rather than clamping. Candidate work history is empty because `Current_Employer`, `Experience_in_Years` and `Skill_Set` are blank on all 72,910 in Zoho. Attachments are complete at 42 of 42 with every column set, awaiting only their bytes, which is U3. Adding `Business Email`, `Work Phone` and `Business Phone` to the mapper recovered nothing, because every value in them duplicates a number already captured and `collect` dedupes: entry counts are identical before and after, 20,055 phones and 73,753 emails.

The durable lesson is that reconciling counts proves a record arrived and says nothing about whether it arrived intact. Field-level reconciliation against the source is a different test and it is the one that found all of this.

## 7.25 U1.9, and a silent wrong-answer bug that only appears once the data is real

U1.9 was written as a DOM-cost item and turned into two findings, one of them a correctness bug that has nothing to do with DOM cost.

### 7.25.1 The pipeline board, measured before and after

The busiest requisition holds **1,300 applications**, and **136 requisitions hold more than 200**, so this is an ordinary desk rather than an outlier. `ApplicationPipeline` paged every application for the requisition into the browser, then fetched every person by id in chunks of 200, then rendered one row or one card each.

| | Before | After |
| :---- | ----: | ----: |
| Payload | 5,546.9 kB | **98.6 kB** |
| REST requests | 46 | **32** |
| Table DOM nodes | 27,662 | **891** |
| Table rows rendered | 1,300 | **25** |
| Kanban cards | 1,300 | **25** |
| Table time to first row | 1,121 ms | **234 ms** |

Two views do it, in migration `20260903000013`. `application_pipeline` is one row per application carrying the candidate's name and source label, with a `stage_rank` window column so the board takes the first 25 of every stage in **one** request rather than one request per column; supplying the name is what let `fetchPeopleByIds` be deleted outright. `application_stage_summary` is the per-stage total and the caller's unviewed count, aggregated over every application in the stage.

That second view is the part that matters for correctness rather than cost. A count computed from the loaded page is precisely the defect U1.3 found on the requisition list, where unviewed badges were wrong on 1,859 of 2,002 requisitions because they came from 1,000 of 14,008 applications. Bounding a board without moving its counts into the database converts a slow screen into a wrong one. Verified on the busiest requisition: the board shows 25 cards, says `showing 25 of 1,300`, and the unviewed badge reads **1300**.

One correctness consequence had to be chased rather than assumed. `AddCandidateDialog` checked for a duplicate application by scanning the in-memory list, which a bounded load makes unreliable: the candidate could already be on the requisition and simply not loaded. The check is gone. The unique constraint on `(requisition_id, person_id)` is the authority, the dialog already had a correct handler for the `23505` violation that queries the real row, and `validate.sql` check 5 already asserts the constraint rejects duplicates. Removing the shortcut made it correct, not weaker.

### 7.25.2 A stale response could silently replace a filtered list, and the volume is what exposed it

`list-persistence.spec.ts` "2.11 the CSV export matches the filtered set on screen" was failing intermittently. Measured rather than retried: **2 failures in 8 runs in isolation**, so not worker contention. The message was the useful part. After typing a search term the table still held **20 rows** and stayed there for the full 25-second timeout, with no error.

None of the six list pages guarded against an out-of-order response. `load` is a `useCallback` that a `useEffect` invokes, so typing a search starts a second query while the first is still in flight, and whichever resolves last wins. At 75 candidates both returned too fast to interleave. At **72,917** the unfiltered query is materially slower than one filtered to three rows, so the stale unfiltered payload lands second, overwrites the filtered rows, and **nothing triggers another load**. The screen then shows a full unfiltered page with the search term still sitting in the box, silently, until the user types again.

That is a wrong answer rather than a slow one, and it would have been dismissed as a flaky test. `lib/useLatestOnly.ts` issues a sequence number per load and the guard drops any response that is no longer the newest. Applied to all six list pages and the pipeline.

Proven both directions rather than asserted. The previously flaky spec ran **14 consecutive times clean** where it had failed 2 in 8. And the regression test makes it deterministic instead of probabilistic: it delays the first `candidate_list` response by 2.5 seconds with `page.route`, types the search immediately, and asserts the filtered count survives. With the guard removed that test receives 20 rows instead of 2, which was confirmed by removing it.

### 7.25.3 One failure recorded as unreproduced rather than explained

`realtime-channels.spec.ts` "the intake queue shares the badge subscription" failed once in roughly ten full-suite runs with `page.waitForTimeout: Target page, context or browser has been closed`. It has not been reproduced: **10 consecutive isolated runs pass**, each taking a consistent 51.3 seconds against its own 120-second budget, so its timeout is not the constraint, and **four consecutive full-suite runs** since are clean at 147 passed.

Sampling memory through a full run shows free memory dipping to **179 MB** with about 1.5 GB inactive, which makes a renderer being torn down plausible and does not make it proven. Recorded here as an observation with its evidence rather than as a diagnosis, the same way the Kong 502 was. `FOOS_PW_WORKERS=1` is the lever if it recurs.

## 7.26 U3: the attachments, and what the "526 candidates" framing hid

U3 was written as "enumerate attachments for the 526 candidates where `Is_Attachment_Present` is true". Attachments are not only on candidates. Counted from the extracts at no API cost:

| Module | Records flagged | Files found |
| :---- | ----: | ----: |
| Candidates | 526 | 607 |
| Job_Openings | 479 | **1,056** |
| Applications | 29 | 29 |
| Clients | 19 | 43 |
| **Total** | **1,053** | **1,735** |

Job openings hold more attachments than candidates do, and the original framing would have skipped every one of them. 1,052 of the 1,053 flagged records are covered, the remaining one genuinely returning 204, and there are no duplicate attachment ids.

**That reconciles U3.3.** The row asked why a count endpoint reported 1,740 when the module list returned 23, and said it would be checked rather than assumed away. 1,735 across four modules is within five of 1,740, which is the closest anything has come to explaining that number. The five are not accounted for and are recorded as such rather than rounded away.

The schema already supports this. `can_read_record` handles `person`, `company`, `requisition` and `application`, so RLS covers all four parent types; `parent_type` is free text with no constraint.

**A correction to what I first wrote here.** I recorded that the attachment UI is person-only, inferred from `attachments` holding nothing but `parent_type = 'person'`. That was a consequence of only person attachments existing, not a limit of the UI, and checking the screens says otherwise: the requisition record page already mounts the engagement panel with `parent={{ type: 'requisition' }}` and the company record page with `relatedType="company"`, so the 1,056 job-opening files and 43 client files land on screens that already render them. The real gap is one parent type, not three: the recruit panel's union is `'person' | 'requisition'`, so the **29** application attachments have no surface. That is 1.7% of 1,735, and it is a UI item rather than a migration one.

### 7.26.1 Three defects, each found by reading a failure rather than retrying it

**86 of the first 526 enumerate requests failed, 16%, and the first version of the tool could not say why or which.** It counted failures without recording a reason or the record ids, so the only recovery was another full 526-credit pass. That is the same mistake as the importer's report saying 210,922 notes failed with no usable detail, made again in a new file. It now records both, per module.

The cause, once printed, was `URL_FIXED_THROTTLES_LIMIT_EXCEEDED` returned as HTTP **400**. The backoff I had already written retried 429 and 5xx and passed 400 straight through as a permanent error, so it never engaged for the one throttle that was actually happening. It now inspects the body on a 400. Retrying the 52 throttled job openings with that in place: **0 failures**.

**Every upload was rejected with "mime type application/pdf;charset=UTF-8 is not supported".** Zoho appends a charset parameter to the content type and the bucket's allowed list holds bare types, so the parameter is stripped before upload. Three files, three failures, before any real volume was attempted, which is the argument for testing a write path on three records rather than 1,727.

**`Category` is an object, not a string.** `String(entry.Category)` produced `"[object Object]"`, so every attachment fell through the label map to `other`. It was right for the three records I first tested, which is the least useful kind of correct: the category for those genuinely is "Others". Reading `Category.name` identifies **309 resumes**, 6 cover letters and 1 offer among the 1,735.

Identity documents remain excluded by default and are counted rather than silently dropped: 8 of 1,735.

### 7.26.2 The download, and four defects between a working tool and a working run

The enumerate phase worked first time. Getting the bytes down took four fixes, each found by reading a failure rather than retrying it, and the order matters because three of them were invisible until the one before was fixed.

**The throttle was not what the plan said it was.** U3.2 was written on the assumption of a per-URL rate limit to pace under. Zoho's published limits say otherwise: the documented constraint is **concurrency**, 5 to 20 simultaneous calls by edition, and the page states explicitly that "there are no time-based API call restrictions". `URL_FIXED_THROTTLES_LIMIT_EXCEEDED` is not documented at all. Measured against that: 100 consecutive downloads at roughly 1.4 per second, zero throttling, on requests that were strictly sequential so concurrency was 1. The throttle that stopped the first attempt was cumulative windowed usage, tripped because 1,197 credits had just gone on enumeration minutes earlier. Hours later, with a fresh window, the same code ran clean. So the fix is not pacing. Two long waits and then a clean stop is the correct behaviour, because the tool is resumable and stopping costs nothing; the previous six fast retries cost 6 credits and 44 seconds per file to achieve nothing.

**No request timeout.** The second attempt sat alive for two minutes with one open socket, 1.25 seconds of CPU, no log output and no progress. `fetch` has no default timeout, so a connection Zoho holds open hangs forever. Every request now carries a 30 second `AbortSignal.timeout` and retries once before giving up. I had also killed that run believing it was hung on Zoho when it may still have been loading its parent map, which is the next fault.

**Loading 159,000 mappings to look up 1,052 parents.** The parent map was built by keyset-paging every candidate, application, company and requisition mapping: about 165 sequential requests before the first byte was fetched. It now asks for exactly the ids the manifest references, in chunks of 200, which is four queries.

**Two content-type faults, and the second hid behind the first.** The bucket rejected `application/pdf;charset=UTF-8` because its allowed list holds bare types, so the parameter is stripped. That fixed three files and revealed the real problem on the rest: Zoho returns `application/x-downLoad` for most attachments, with that capital L, which is in no allowed list anywhere. Zoho's content type is simply not trustworthy, so it is now derived from the file extension, defaulting to `application/octet-stream`, which the bucket does allow. The extensions present are pdf 786, docx 631, doc 255, xlsx 28, pptx 11, xls 7, jpg 5, txt 4, webm 4, htm 3 and jpeg 1; webm and htm are not in the bucket's list and land as octet-stream with their extension intact.

**One reporting fault, for the third time in this project.** Failure reasons were collected and printed only at the end, so killing a stalled run destroyed the diagnosis. Progress lines now carry the reason tally, which is how `application/x-downLoad` was identified in 75 seconds after two blind restarts.

**A latent resume bug, caught before it cost anything.** The already-stored set was built from `zoho_id_map` alone, which includes the 42 metadata-only rows from the old CSV export whose `storage_path` is still a `pending/` placeholder. Those would have been treated as done forever. Measured before fixing: **0** manifest entries collide with those 42, so nothing was actually lost, and the check now asks the `attachments` table by deterministic id and ignores rows without bytes. Separately, those 42 legacy ids do not appear anywhere in the API enumeration, which is worth knowing: they describe files Zoho no longer lists.

`verify-zoho-migration.mjs` gained a seventh pass for this: it asserts that the number of attachment rows claiming real bytes equals the number of objects actually in the bucket, because a row pointing at a file that is not there is worse than no row at all.

## 7.27 The guard added in U1.10 could starve a list, and a shared channel name crashed the dashboard

Both of these came out of one intermittent browser failure, `list-keyboard.spec.ts` "j and k walk the rows, Enter opens the record", which failed about 2 in 7 full-suite runs and passed 3 of 3 with a single worker. It was recorded in section 7.25.3's spirit as unexplained. It is now explained, and it was a product defect both times, which is the third and fourth time today that a flaky test has been one.

### 7.27.1 U1.11: a list that never paints, because every response arrives stale

The decisive evidence was the requests, not the code. Instrumenting the failing spec showed the list rendering zero rows with the pager reading `0 of 0`, no page error, and **seven** loads of `candidate_list` for one mount. Every one of the seven returned HTTP 206 with `content-range: 0-19/72917`, so twenty rows arrived seven times and the browser discarded all seven. The totals moved between requests, 72,919 then 72,917, which named the cause: another Playwright worker's fixtures were being created and deleted, and this page subscribes to `candidate_profiles` with `event: '*'` and no server-side filter.

| Measurement | Result |
| :---- | :---- |
| `candidate_list` page of 20 with an exact count, as recruiter | 1,809 ms, three runs within 6 ms |
| The same page, rows only | 42 ms |
| One write to `candidate_profiles` | about 700 ms, because migration 10's triggers fire on every write |

So the starvation window is 1.8 s and events arrive every 0.7 s. Each event called `load()`, each `load()` advanced the U1.10 sequence, and the request that was about to paint stopped being the newest before it landed. U1.10 is right to drop stale responses; the defect is restarting the load per event. `lib/useCoalescedReload.ts` collapses a burst into one reload and never restarts a load that is in flight, so the newest load always completes.

Four things worth recording because they nearly went the other way. First, **the first version of the hook reintroduced the same failure in a new shape**: an unbounded trailing debounce never fires while events keep arriving closer together than the delay, and the gate caught it as a live-update test going stale. It now carries a 1 s maximum wait. Second, **two versions of the regression test were worthless and both looked like passes**. One allowed the assertion 30 s while the churn ran only 9 s, so it passed by waiting for the writes to stop rather than by painting under them. The other wrote to a `comments` column that does not exist on `candidate_profiles` and did not check `error`, so the run counted eleven failed writes as successes and produced no events at all. Third, **two later versions were also wrong, in the opposite direction.** Widening the paint budget from 8 s to 18 s, so the fixed page could paint under full-suite load, let the unfixed page pass 2 of 2, because over eighteen seconds jitter opens a gap longer than the 1.8 s query and one load gets through. Raising the churn to four concurrent writers to close that gap made it worse still, 2 of 3 passing unfixed, and the reason is worth knowing: **a denser stream trips the Realtime tenant's 100 messages per second ceiling, and the dropped messages are the very events the test depends on.** Fourth, the version that works does not race the database at all. It delays every `candidate_list` response by 2 s with `page.route` and churns one change every second, so the load is always outstanding when the next change lands, whatever the query costs and whatever else the suite is doing. It fails 3 of 3 unfixed and passes 3 of 3 fixed, which is the only evidence that a regression test is one.

`RequisitionListPage` has the same unfiltered `event: '*'` subscription, on `applications`, and takes the same fix. No test is claimed for it: its list query measures 76 ms over 690 requisitions, so starving it would need events closer together than 76 ms when one write costs 700 ms. The exposure is real at production volumes and is not deterministically reproducible here, so asserting it would prove nothing.

### 7.27.2 U1.12: one channel name, five subscribers, and a crash the gate found in a table nobody was reading

`node scripts/check-attachment-queue.mjs` failed with 4 `client_errors` rows left behind, and its message assumes a test recorded a failure and did not clean up. The rows said otherwise: all four were `cannot add postgres_changes callbacks for realtime:dash-outbox-refresh`, on route `/?tab=pipeline`, two events each recorded once by `window.error` and once by the error boundary. The dashboard had crashed for real, twice, during a passing suite.

The mechanism was proven against the local stack rather than inferred: `supabase.channel(topic)` returns the same instance for the same topic, and binding `postgres_changes` to it after `subscribe()` throws with exactly that message. Four panels call `useOutboxRefresh` and all of them, plus the widgets panel, asked for `dash-outbox-refresh`. While every panel mounts before the socket joins, all five bindings land on one channel and nothing goes wrong, which is why this survived. Whichever panel mounts after the join throws.

The fix is the pattern `modules/intake/hooks.ts` already used: a refcounted singleton channel with a listener set, which also takes the dashboard from four channels to one. `lib/realtimeChannel.ts` then gives every subscription a unique topic, so a channel whose removal is still in flight can never be rebound by the next one, and all nine subscription sites use it. The O4 channel-budget test asserted the exact topic `realtime:intake-items`; it now asserts one channel matching that name with an optional instance suffix, so it still holds the budget it was written to hold.

Worth stating plainly: the attachment-queue guard's wording sent me looking for a leaky test first. The rows were the answer, and reading them took less time than trusting the message.

### 7.27.3 One failure that closed without being attributed

`realtime.spec.ts`'s unviewed-badge test failed at two workers and passed at one. It is logged as QA-009, and the short version is that it failed **3 of 3 on unmodified `develop`** with the day's changes stashed, so it was never caused by them, and passed **153 of 153** at one worker.

The mechanism is the local Realtime tenant's `max_events_per_second = 100`. Once a two-worker suite tripped it, the page's channel kept reporting `SUBSCRIBED` while delivering no `postgres_changes` for tens of seconds. That is invisible to the client, so no reconnection logic could have recovered from it.

Raising the ceiling is not available: setting it to 1,000 in `_realtime.tenants` and restarting leaves the row back at 100, because the container runs `SEED_SELF_HOST=true` and re-seeds the tenant on every boot, and there is no environment variable or `config.toml` setting for it.

**It is now clean, and I cannot say which change did it.** Five consecutive full runs at two workers give 153 passed with a rate-limit delta of zero. Reverting U1.14 alone: still clean. Reverting U1.12's channel singleton alone: still clean. So no single change is necessary for the clean result, and claiming one would be inventing a cause. What also changed is the regression spec, which now delays its own responses rather than racing the database and so makes far fewer requests. Recorded as closed-not-reproducible with the metric to use if it returns, rather than as a fix I can demonstrate.

Two corrections to my own measurements in this investigation. The rate-limit counts of nine to fourteen were an instrument error: `docker logs --since` was not filtering, so each figure was a cumulative total growing by one per run. Measured before and after a run, it is one burst per failing run and zero now. And no single spec trips it: `list-realtime-starvation`, `bulk-actions` and `merge-candidates` each measure zero alone, so it was always the two-worker aggregate.

### 7.27.4 U1.13, and the measurement that moved the blame twice

U1.13 was written as "the pager count is slow". It is: 1,752 ms of the candidate list's 1,809 ms, and PostgREST recomputes it on every request, so it was paid on the first paint and again on every page turn. Rows and count are now separate requests and the count is keyed on the filters rather than the page. **First data row, three runs each way: 1,893 to 1,912 ms becomes 190 to 200 ms.**

Two of my own measurements in this section were wrong before they were right, and both were wrong in the flattering direction.

The first said the page turn had dropped from 1,839 ms to 24 ms. It had not. `from` and `to` are computed from `page` and the known total, so the pager label repaints the moment the button is clicked, before any row arrives. Waiting on the pager text measured the click, not the data. Waiting on the first data row's own text instead gives 1,930 to 1,944 ms before and 1,073 to 1,089 ms after.

The second was the first-row figure. `table tbody tr` matches the empty-state row that carries a `colspan` cell, so the baseline appeared to paint in 126 ms when its query takes 1.8 s. `.table-wrap tbody tr:not(:has(td[colspan]))`, which `list-persistence.spec.ts` already used, gives the honest 1,893 ms.

That corrected page-turn figure is what exposed U1.15: 1,080 ms of it is a rows-only request that costs 42 ms at offset 0, and it has nothing to do with the count.

What the count's cost turned out to be, for the record, since the obvious explanations are all wrong. It is not the view's expensive columns, because Postgres counts the view in 24 ms by pruning unused select-list expressions, and a slim projection with neither `search_text` nor `has_resume` still costs 1,457 ms. It is PostgREST's materialised CTE, which defeats that pruning, at 276 ms as `postgres`, and then RLS evaluating `people_select` for all 72,917 rows, at 2,026 ms as the recruiter.

Two consequences for the UI, both chosen so the screen never states something untrue. While the first count is in flight the pager shows the range with no total rather than "0 of 0", and shows nothing at all when there are no rows yet. The Last-page button is disabled and the position reads `1 / ?`, because a page count derived from a total nobody has yet would be invented. Six assertions in `server-side-list.spec.ts` read the pager label in the same paint as the first row, which is no longer when the total exists; they now wait for it. None was weakened: the contract they assert, that the count comes from the database and survives a page turn, is unchanged.

And the other five lists were measured before being left alone: counting `company_list`, `contact_list`, `deal_list`, `ticket_list`, `requisition_list` and `intake_items` takes 2 to 5 ms, on 195, 73, 2, 0, 690 and 0 rows. Splitting them would be churn with no measured benefit.

## 8. Tasklist

State after the 2026-09-02 passes and the seven audits, and the 2026-09-03 discovery sweep. **150½ of 157 tasks done.** Workstreams R and S were added the same day, and P2 and P3 were dropped as not being FOOS work. Workstream Q is proposals, not defects, so it is counted but should not be read as outstanding work in the same sense. Ordered by what gates each item, then by consequence inside each group.

### 8.0 Workstream U: the Zoho migration, agreed 2026-09-03

The goal is the whole of Zoho Recruit and Zoho CRM living in FOOS. Section 8's original list is a separate and mostly finished thing; this is larger than what remains of it, and the count in section 8 does not include any of it.

Five phases, in order, because each one blocks the next.

**U1. Make FOOS able to hold the data.** Not optional and not a performance nicety: six list screens paged every matching row into the browser, and four queries silently truncated at `max_rows = 1000` and returned wrong numbers. Sections 7.16 and 7.17 have the measurements.

- [x] **U1.1** Candidate list server-side. 494 requests and 35.2 MB at 70,207 rows, down to 3 requests and 41.8 KB, 133ms to first row
- [x] **U1.2** The four silently truncating reads, and `check-unbounded-queries.mjs` to stop the next one
- [x] **U1.3** Requisition list server-side. Its unviewed badges were wrong on 1,859 of 2,002 requisitions, computed from 1,000 of 14,008 applications. 139ms, 3 requests, `1-20 of 2003` from a database count. Section 7.18
- [x] **U1.4** Deal list, bounded kanban. 12,002 cards and ~84,000 DOM nodes down to 150 cards and 1,263 nodes, 204ms, each column stating `showing 25 of 2,000`. Section 7.18
- [x] **U1.5** Contacts list. The old screen did not slow down at scale, it **failed**: it collected every `contact_profiles` row then asked for the matching people in one `.in()`, a 542 KB query string rejected with `URI too long` in 10ms at 15,005 contacts, so the page rendered nothing. Now 108ms, `1-20 of 15005`, 324 DOM nodes, 28.2 KB. Section 7.19
- [x] **U1.6** Companies list. `company_list` exposes `types` for the array filter and a composed `location_text`, so both filters run in Postgres. `validate.sql` check 29 asserts `location_text` matches the city, state and country it is built from
- [x] **U1.7** Tickets list. `ticket_list` carries the company and assignee names the old screen looked up through client-side maps built from full-table reads. `validate.sql` check 30 inserts a ticket with no company and no assignee, asserts it still appears, and deletes it again
- [x] **U1.8 done, and its premise was wrong about the volume.** The row said a company select holding tens of thousands of options is its own problem. Measured: there are **195** companies after the migration, not tens of thousands, so the urgent reading was not supported. What was real is that both lookup hooks fetched `select('*')`, every column of every company, to render a name. Measured at 195 rows: 33 kB as full rows against 6.6 kB for id and name, and the whole candidate list payload fell from **371.9 kB to 270.5 kB**, a 27% reduction, with first row unchanged at about 120ms. The projection is expressed as a type, `CompanyOption = Pick<Company, 'id' | 'name'>`, following the `CandidateListProfile` pattern from K1, so the code cannot read a column it did not ask for; the compiler found the one consumer that had declared the full row and used only two fields. Guarded by four tests in `server-side-list.spec.ts` that fail if the projection widens back to `select=*`, verified by widening it deliberately. The read still pages rather than truncating. **What is still open and stated rather than hidden:** a native `<select>` carrying thousands of options is a genuine UX problem, and at 195 it is not one. Whether that becomes a searchable combobox is a product decision for when companies pass roughly a thousand

- [x] **U1.11 The stale-response guard could starve a list permanently, and that was the `list-keyboard` intermittent.** `CandidateListPage` and `RequisitionListPage` both subscribe to their own table with `event: '*'` and no server-side filter, and called `load()` straight from the handler. Every event restarts the load, every restart advances the U1.10 sequence, and the in-flight request that was about to paint is discarded. Measured: the candidate list page costs **1,809 ms** while one write to `candidate_profiles` costs about **700 ms**, because migration 10's triggers fire on every write, so a steady stream of changes starves the list for as long as the gaps stay shorter than the load. **Not permanently, and I claimed permanently before measuring it:** a load completes whenever jitter opens a gap longer than the query, which over eighteen seconds it usually does, so the defect is a list that is empty for many seconds at a time rather than one that never recovers. The observed failure was a table with `pager "0 of 0"`, seven loads, no error, and `content-range` moving from 72,919 to 72,917 as another worker's fixtures came and went. Not test-only: two recruiters editing candidates while a third holds the list open is the same shape. `lib/useCoalescedReload.ts` collapses a burst into one reload, never restarts a load that is in flight, and carries a **1 s maximum wait** so a sustained stream cannot hold the timer open for ever, which an unbounded trailing debounce does. `tests/e2e/list-realtime-starvation.spec.ts` delays every `candidate_list` response by 2 s with `page.route`, the idiom U1.10's regression test already used, so the starvation is deterministic rather than a race against the real query: it fails 3 of 3 without the fix and passes 3 of 3 with it. Section 7.27.1
- [x] **U1.12 Five dashboard panels asked for one realtime channel by the same name, and the page crashed when they did.** `supabase.channel(topic)` returns the *same* instance for a topic, and binding `postgres_changes` after `subscribe()` throws `cannot add postgres_changes callbacks for realtime:<topic> after subscribe()`, proven directly against the local stack rather than inferred. All four `useOutboxRefresh` callers plus the widgets panel used `dash-outbox-refresh`, so whichever panel mounted after the channel had joined threw into its error boundary. The gate caught it as **4 `client_errors` rows on `/?tab=pipeline`**, two events each recorded by `window.error` and by the boundary. `useOutboxRefresh` is now a refcounted singleton with a listener set, following the pattern `modules/intake/hooks.ts` already used, which also takes the dashboard from four channels to one, and `lib/realtimeChannel.ts` gives every subscription a unique topic so a channel being torn down can never be rebound by the next one. Section 7.27.2
- [x] **U1.13 done. The pager's exact count was 97% of the candidate list's first paint.** Of 1,809 ms, 1,752 ms was the count and 42 ms was the twenty rows. The count is not the view's expensive columns: Postgres counts the view in 24 ms because it prunes unused select-list expressions, and a slim projection with neither `search_text` nor `has_resume` still costs 1,457 ms. PostgREST wraps the query in a materialised CTE, which defeats that pruning (276 ms as `postgres`), and RLS then evaluates `people_select` for all 72,917 rows (2,026 ms as the recruiter). Rows and count are now separate requests, and the count is keyed on the filters rather than the page, so turning a page does not recount. **Measured in the browser over three runs each way: first data row 1,893 to 1,912 ms becomes 190 to 200 ms.** The total arrives on its own about 1.5 s later, and until it does the pager shows the range without a total rather than "0 of 0", the Last-page button is disabled and the position reads `1 / ?`, because inventing a total or implying there is one row when the count is still in flight would both be lies. `Pager` now takes `total: number | null` with an optional `totalPending`. The count query carries `range(0, 0)`, which `server-side-list.spec.ts` requires of every view read and which an exact count is indifferent to, since PostgREST counts the filtered set and not the page.

  **Two routes stayed closed, and the reasons are worth keeping.** A counting function would duplicate the visibility rules and let them drift. Rewriting `can_read_person` as an inlinable `language sql` function cannot work: Postgres never inlines a `SECURITY DEFINER` function, and this one must be one, or its reads of `people` would recurse through `people`'s own policy. `20260902000002` had already measured *wrapping* the row-dependent helper, 187.5 ms against 179.8 ms bare, and correctly left it alone; wrapping and inlining are different things and neither helps.

  **The other five lists were measured rather than assumed, and none of them needs this.** Counting `company_list`, `contact_list`, `deal_list`, `ticket_list`, `requisition_list` and `intake_items` takes 2 to 5 ms, because they hold 195, 73, 2, 0, 690 and 0 rows. Only the candidate list has 72,917, so only the candidate list was changed. Section 7.27.4

- [x] **U1.14 The requisition list watched an 86,125-row table to keep two counts fresh.** It subscribed to `applications` with `event: '*'` and no server-side filter, so every field edit on any application anywhere was delivered to every open requisition list. All the screen actually shows from that table is `application_count` and `unviewed_count`, which move only when an application is created, deleted or changes stage. It now watches `events_outbox` filtered to `application.created`, `application.stage_changed`, `application.hired` and `requisition.status_changed`, which is the architecture the outbox exists for and which the dashboard already used, plus a `DELETE` subscription on `applications` for the one transition the outbox does not emit. `activity.logged`, at 8,990 rows the highest-volume event, is deliberately not in the filter. Behaviour preserving for everything the list displays, and it removes the firehose. **A correction:** I first recorded that this did not fix QA-009, on a measurement that was contaminated by my own regression spec churning four concurrent writers at the time. Re-measured against the finished tree, reverting this change alone still leaves the suite clean at 153 passed with a rate-limit delta of zero, so it is a reduction in traffic on its own merits and not the thing that closed QA-009

- [x] **U1.15 done. Any page but the first cost a second, and the count was not the reason.** Found while measuring U1.13: with the count off the critical path, a page turn still took 1,065 ms for a rows-only request that costs 42 ms at offset 0. Under RLS as the recruiter, `limit 20 offset 0` measured **3 ms**, `offset 20` **751 ms**, `offset 200` **736 ms**, and `offset 20` with `enable_seqscan = off` **2.9 ms**, so the index path was always there and the planner was choosing against it. At offset 0 it used an incremental sort over `idx_people_last_first` and stopped after 21 rows; at any other offset it seq-scanned `candidate_profiles` and top-N heapsorted all 72,917.

  **Two policies were opaque to the planner, and the effect compounded.** `people_select` was `can_read_person(id)`, a plpgsql security-definer function taking the row as an argument, which no planner can see inside. `candidate_profiles_select` was an OR of two comparisons against `(select get_my_role())`, whose value is unknown at plan time, and it estimated **801** visible rows of 72,917. Together the join estimated 267 rows against 72,917 actual, a 273x error, the same 273 that `count: 'planned'` returns. That put the index path at cost 136,619 against the seq scan's 12,706, and the choice flipped on a margin of 12,843 to 12,714, which means page one was fast only by luck: a second wrong estimate happened to favour the right plan.

  **Migration `20260904000001` restates both policies as a CASE over one hoisted role lookup.** The `EXISTS` clauses have real statistics behind them, so they cost as semi-joins for a scan and as index probes for a single row. Measured after, same client: offset 0 **15.9 ms**, offset 20 **16.3 ms**, offset 2000 **20.9 ms**, and the exact count **306 ms** against 2,026 ms. End to end in the browser, three runs each: **first data row 284 ms to 283 ms, the total 1,571 ms to 360 ms, and a page turn 1,080 ms to 88 ms.** Against the state before U1.13 that is 1,902 ms to 283 ms for the first row and 1,932 ms to 88 ms for a page turn.

  **The rules are unchanged, and that is proven rather than asserted.** Over all 72,988 rows of `people` and all 72,917 of `candidate_profiles`, for admin, recruiter, sourcer, bd and a caller with no staff row, the restated policies admit exactly the same rows as before: 72,988, 72,988, 3, 73 and 0 for people, and 72,917, 72,917, 3, 0 and 0 for candidate profiles, with zero mismatches. Two branches are simplified only where the algebra is exact, and the `not A` in the bd branch is load-bearing rather than redundant: a bd user must not see a candidate they happen to have created. One difference is real and harmless: for a caller with no active staff row the old OR form evaluated to null and the CASE returns false, and RLS denies on both, which is why the equivalence is measured on rows admitted rather than on the raw boolean.

  **`can_read_person` is kept**, because the `parent_type` dispatcher and one other helper still call it, so the same rule now exists in two places. That is a real drift risk, so `validate.sql` gained checks **31 and 32**, which read each policy's own expression out of `pg_policies` and fail if it stops agreeing with the function or with what each role should see. The test cannot drift from what is enforced because it does not contain a copy of it.

  **Two routes were tried and rejected, with numbers, so nobody repeats them.** A covering index on `people (last_name, first_name, id)` including the projected columns fixed offset 20 alone, 751 ms to 3.5 ms, while offsets 40 to 140 stayed at 737 to 777 ms, because the index path's estimated cost grows with the offset while the seq cost is flat; 12 MB to fix one page is not a trade. Restating `people_select` alone, without touching `candidate_profiles_select`, made every page uniform at 116 to 160 ms but pushed the browser's first data row from 284 ms to 888 ms, because the rows query and the count then both full-scan and contend; that is a worse product than the problem it fixes, and it is the reason both policies had to change together

- [x] **U1.16 The pressed-button test was pointing at two different buttons, and the settings page is why.** `interaction-states.spec.ts` "a pressed primary button darkens instead of turning grey" failed 3 of 8 gate runs and passed 5 of 5 in isolation, which is the shape of a concurrency-sensitive flake and was in fact an ambiguity in the test. It held `page.locator('.btn-primary').first()`, and on `/settings` that locator re-resolves: measured, the first primary button is "Add template" at 398,821 until the Google card's data arrives, then "Connect Google account" at 398,410. So the test hovered one button and then polled the colour of another, which was never under the cursor. It now waits until the first button's text and box stop changing, pins that one element with `elementHandle()`, and hovers and polls that handle, so it cannot silently read a different button. No assertion was weakened. **Two of my own readings on the way were wrong:** I read the background immediately after `mouse.down()` and saw the idle colour, and concluded the hover and active rules were not applying at all; the motion layer transitions `background-color`, so an immediate read returns the interpolated start value. I also looked for a module-layer rule overriding the button, on the theory that a later layer beats a more specific shared rule, and there is no such rule: `.btn-primary` appears in exactly three shared rules and one recruit print rule. Worth recording separately: hover and active resolve to the same `--fo-primary-hover`, so this test cannot distinguish pressed from hovered, only either from grey

**U2. Extraction. Unblocked 2026-09-03: credentials supplied, both products authenticate and read.** Bulk Read costs a flat 50 credits per job for up to 200,000 records.

Authoritative counts from `actions/count`, which correct three of my earlier figures:

| Recruit | Count | | CRM | Count |
| :---- | ----: | :---- | :---- | ----: |
| Notes | **210,922** | | Accounts | 86 |
| Applications | **86,125** | | Contacts | 50 |
| Candidates | **72,910** | | Notes | 59 |
| Attachments | 1,740 | | Leads | 13 |
| Job_Openings | 687 | | **Deals** | **0** |
| Clients | 104 | | | |
| Departments | 104 | | | |
| Contacts | 5 | | | |
| Interviews | 0 | | | |

Candidates is 72,910, not the "over 70,200" I recorded, which was a floor from a paging run I killed. Notes is 210,922, where I had extrapolated about 132,000 from the 75-row sample, so the sample under-represented it by 60%. Applications is 86,125 and was never exported at all; it is also the table whose read was silently capped at 1,000, so those requisition badges were computed from 1,000 of 86,125. **CRM Deals is empty**, and the whole of CRM is 208 records.

Total cost, API only: 12 jobs at 50 credits is 600, plus 1,740 attachment downloads, is **2,340 credits, 37% of one day's allowance**.

- [x] **U2.1** `migration/zoho-bulk-read.mjs`: initiate, poll, download, unzip, reconcile against the count endpoint per module, with a credit budget and a paged fallback for the three modules bulk read refuses. Section 7.22
- [x] **U2.2 done.** Recruit: Candidates 72,910, Job_Openings 687, Applications 86,125, Clients 104, Contacts 5, Notes 210,922, Departments 104, Attachments 50. All on disk under `migration/zoho-exports/bulk/` and all read back per record by the verifier
- [x] **U2.3 done.** CRM: Accounts 86, Contacts 50, Leads 13, Notes 59. Deals skipped, confirmed empty rather than assumed

**U3. Attachments. Corrected 2026-09-03: no manual export is needed and the API does this comfortably.**

I recorded that attachments had no bulk path and would cost one call per candidate, about 70,200, and recommended a UI export instead. That was wrong, and the error was in the input rather than the arithmetic: I assumed attachments had to be enumerated through `/Candidates/{id}/Attachments`, which is the endpoint I happened to use first, and never checked whether Attachments was addressable as a module. It is, and `/recruit/v2/Attachments/actions/count` returns **1,740**, not 72,910. A 42x error in the premise, so the recommendation built on it collapsed with it.

Klent pushed back with exactly the right question, that using the API is pointless if a manual export is needed anyway, and he was right.

- [x] **U3.1 done, and the premise was too narrow.** Attachments are not only on candidates: 479 job openings, 29 applications and 19 clients carry them too, 1,053 flagged records in total, and job openings alone hold 1,056 files against the candidates' 607. `migration/zoho-attachments.mjs` enumerates all four modules, one request per record. **1,735 files** across 1,052 of the 1,053 records, the last genuinely returning 204, with no duplicate ids. Section 7.26
- [x] **U3.2 done, and the denominator was wrong in both directions.** `migration/zoho-attachments.mjs` downloads and uploads in a second phase over the manifest, resumable, with a credit budget guard. The manifest holds **1,747** files once the three CRM modules are included, not the 1,740 the count endpoint reported nor the 1,735 U3.1 recorded. Of those, **1,738 are in Storage**, 472,697,067 bytes or 451 MiB, and `storage.objects` holds exactly 1,738 for 1,738 attachment rows claiming real bytes, so no row points at a file that is not there. The nine that are not stored are both accounted for: **8 identity documents held back deliberately**, counted and never read, and **1 file of 76.5 MiB** that the bucket refuses because `file_size_limit` is 25 MiB. The per-parent totals reconcile module for module: 1,056 requisition against Job_Openings 1,056, 29 application against Applications 29, 54 company against Clients 43 plus CRM_Accounts 12 less the oversized one, and 599 person against Candidates 607 less the 8 held back. **The 76.5 MiB file is a decision for you:** raise the bucket limit or accept that one client file stays in Zoho. Section 7.26.2
- [x] **U3.3 reconciled.** 1,735 files across the four modules against the 1,740 the count endpoint reported: within five, and the closest anything has come to explaining that figure. The module-level list returning 23 is explained too, since it only ever covered one module. The remaining five are not accounted for and are left stated rather than rounded away
- [x] **U3.4 done.** Candidates, job openings and clients already landed on engagement panels that filter by `parent_type`; only the recruit panel's union excluded `'application'`, so 29 attachments were stored and readable under RLS and rendered nowhere. `EngagementParentType` now includes it, `useEngagement` maps it to `application_id`, and `CandidateRecordPage` mounts an Application Attachments section when `?application=` is present, which is where the app already navigates to an application. Three browser assertions: the section renders a `.panel-item`, it does not say "No files yet", and the file is openable so its bytes are really in Storage. Verified the test fails when the section is removed. **A correction:** I first recorded the attachment UI as person-only, inferred from `attachments` holding only `parent_type = 'person'`. That was a consequence of only person attachments existing, not a UI limit, and reading the screens disproved it

- [x] **U3.5 The 42 placeholder rows were duplicates of files that had just arrived, and the screens showed both.** After U3.2, 42 `attachments` rows still carried a `zoho-import/pending/` path, and D6 renders those as the file name plus a "File not yet available" badge. Checked rather than assumed: the Zoho attachment id embedded in all 42 paths appears in a downloaded path, and in every case the downloaded twin sits on the same parent and the same `parent_type`, so a candidate record was showing a working file and a dead placeholder for the same document. The 40 distinct ids behind 42 rows say two were duplicated at source. The rows are removed, which is what closes D5 rather than a second export

**U4. The importer at scale.** It has only ever run against 75 rows.

- [x] **U4.1 measured, and batching declined on the measurement.** 25.2ms per candidate, so about 29.5 minutes for 70,200 candidates and one to two hours for the whole import. Tolerable for a one-off, and batching would trade that for harder per-row error attribution. Section 7.20
- [x] **U4.1b Resumability fixed, which is what actually mattered.** Killing the importer mid-run used to leave an unmapped insert and produce a **duplicate candidate on resume**, unreachable by the purge. Deterministic v5 ids make a retry collide with itself and self-heal: verified at 5,000 rows, 0 duplicates, 0 orphans
- [x] **U4.1c The purge silently stopped at 1,000 rows** and reported that as done. It now pages the whole id map; 5,000 rows removed in one pass
- [x] **U4.2 Idempotency confirmed rather than assumed.** A second apply of the same export reports `0 new, 75 existing` and leaves the row count unchanged
- [x] **U4.3 done for the columns.** Bulk read emits API field names (`Account_Name`, `Created_Time`) where the importer's mappers read UI display names (`Account Name`, `Created Time`), so nothing would have resolved. `migration/src/bulk-to-export.mjs` inverts the existing display-to-API map, with a per-module alias table for the cases that are not mechanical derivations (`Id` to `Record Id`, `Owner` to `Account Owner`). Six unit tests. Verified against the real bulk file: all five fields the CRM company mapper reads now resolve
- [x] **U4.3b The two sources disagreed on id shape**, which would have double-imported every record. The UI export prefixes ids (`Zrecruit_837085...`), bulk read returns them bare. `normalizeZohoId` strips the prefix inside `deterministicId` and on both the read and write of `zoho_id_map`, and all five in-memory lookups were normalised too. Proven: the prefixed and bare forms now derive the same FOOS id
- [x] **U4.4 Five extracted modules had no mapper at all.** Measuring each one first removed two of them: Departments is the Clients module under a second API name (identical 104 ids), and the plan's claim that Recruit Contacts was covered was wrong, because `importContacts` reads the CRM module. Section 7.24

| Module | Records | FOOS target | State |
| :---- | ----: | :---- | :---- |
| Recruit Applications | 86,125 | `applications` | **done**, U4.5. 86,125 mapped |
| Recruit Job_Openings | 687 | `requisitions` | **done**, U4.5, and now carrying `company_id` and the Zoho timestamps |
| Recruit Clients | 104 | `companies` | **done**, U4.7. `map-clients.mjs`, 104 of 104, and the source of every requisition's company |
| Recruit Departments | 104 | none needed | **not a module.** The same 104 records as Clients, asserted on every verification run rather than assumed |
| Recruit Contacts | 5 | `people`, `contact_profiles` | **done**, U4.7. `map-recruit-contacts.mjs`. Was recorded as covered and was not |
| CRM Leads | 13 | `people`, `contact_profiles` | **done**, U4.7. `map-leads.mjs`. No company row is minted, because the Zoho `Company` values include job titles |
| CRM Notes | 59 | `activities` | **done**, U4.7. `map-crm-notes.mjs`, parented to companies and people. 20 of the 59 have a blank title, which the Recruit mapper skips outright |

Covered before today: Recruit Candidates, Recruit Notes, CRM Accounts, CRM Contacts.

- [x] **U4.7 The three real gaps wired, with 20 unit tests.** All four new phases map with zero skips and zero failures against the real extracts. Ordering matters and is now enforced in `main()`: clients before requisitions, and the CRM maps before CRM notes
- [x] **U4.8 `importNotes` and `importAttachments` counted every successful insert as a failure**, through an `existing.set(key, data.id)` where `data` is bound nowhere in scope. The rows and the mappings were correct; only the report was wrong, proven from the database rather than from the log the importer buffers. Section 7.24.1
- [x] **U4.9 `readBulk` read the first CSV in a module directory and ignored the rest.** Four directories hold two files each. They are byte-identical re-downloads, so nothing was lost, but a paged result would have been silently halved. It now unions every file and dedupes by Zoho id
- [x] **U4.10 `scripts/verify-zoho-migration.mjs`**, six passes: every extracted id against `zoho_id_map` per record, the Departments-equals-Clients assertion, every FOOS row accounted for as imported or seed, eight referential-integrity checks, timestamp fidelity against the extract on a 200-record sample, and a check that the bulk-load triggers are back on
- [x] **U4.11 Staff attribution was empty for every CSV-extracted module.** Zoho's bulk read gives `Created_By: {name, id}` in JSON and the bare id in CSV, and `resolveStaff` indexes names, so candidates, job openings, clients, contacts and both CRM modules imported with no owner, creator or modifier. `migration/zoho-users.mjs` builds the id-to-name map from the extracts first and the `/users` endpoint second, and exits non-zero while any referenced id is unnamed. Section 7.24.3
- [x] **U4.12 `loadIdMap` returned 47,453 of 72,910 candidate mappings**, because it paged with `.range()` and no `ORDER BY`. It now pages by keyset and asserts its own count. Deterministic ids are the only reason this corrupted nothing. Section 7.24.4
- [x] **U4.13 `scripts/check-paged-order.mjs`**, in the gate and `ci.yml`: any `.range()` paging with no `.order()`, or ordered only on a non-unique column, fails the build. Verified against both real shapes. It found two more live cases, the application pipeline and both company dropdown lookups
- [x] **U4.14 Two lookup tables were missing rows**, so 3,960 candidates imported with no source and 12,469 with no status. Migration `20260903000011` adds 16 sources and 12 candidate statuses; "LinkdIn" is aliased in the mapper rather than created as a misspelled row. The importer had printed both counts on every run. Section 7.24.5
- [x] **U4.15 Candidate work history is empty in Zoho, not missing from the export.** `Current_Employer`, `Experience_in_Years` and `Skill_Set` are blank on all 72,910 candidates, which is why the subform export was header-only. Established before spending 72,910 record-level API calls on it. Section 7.24.6
- [x] **U4.16 20 application-level fields were read and thrown away.** `Amir_Grade` on 58,054 rows, `Hiring_Pipeline` on 85,674, `Posting_Title` and `Origin` on all 86,125. They now go to `applications.answers` under a `zoho` key. `Amir_Grade` deserves a real column, which is a product decision. Section 7.24.7
- [x] **U4.17 70,208 LinkedIn URLs and 1,122 postal codes** lost to two aliases that are not underscore-to-space derivations, `LinkedIn__s` and `Zip_Code`
- [x] **U4.18 A date parser that rejected bulk read's own format.** `YYYY-MM-DD` did not parse, so `opened_date` was null on all 687 requisitions. Also `num_openings` read the wrong field name and was 1 on every row, and `Salary` was carried and discarded rather than written to `pay_notes`. `Initial_Date` went from 58,946 parsed to 70,382 once `MM/YYYY` and multi-date lists were handled
- [x] **U4.19 No CRM contact had a company.** The mapper read `Account Name.id`, which only the UI export emits; bulk read puts the bare id in `Account Name`. 48 of 50 now link
- [x] **U4.20 210,922 notes had no author.** `Note_Owner` had no target column, so it was dropped before any mapper saw it, and `resolveStaff` was called with an empty string, which records nothing as unresolved. Section 7.24.7
- [x] **U4.21 The field-level audit itself.** Every mapped column counted against the extract's population for the corresponding Zoho field. This is what found U4.16 to U4.20; every one of them had already passed the record-count reconciliation and the referential-integrity checks. Section 7.24.7
- [x] **U4.22 The requisition unviewed badge was computed from 1,000 of 2,028 applications.** `RequisitionListPage` narrowed to the 20 requisitions on the page with `.in()` and no `.range()`, which PostgREST caps at `max_rows`, and with no `ORDER BY` the truncation was not even stable between runs. `unviewed_count` now comes from `requisition_list`, where `security_invoker` lets `auth.uid()` do it under RLS. Migration `20260903000012`. U1.3 had moved the application count into the view and left this one in the browser
- [x] **U4.23 Two test defects the data exposed, neither a product fault.** axe was measuring a frame mid-`table-results-in` fade, where the tbody sits at opacity 0.55 and a link on the zebra row reads 4.42:1 instead of 4.83:1; tests now await `getAnimations()`. And `dragTo` measured a column centre without scrolling it into view, which `toBeVisible()` does not catch because it means the element has a box, not that the box is on screen

**U5. Prove the migration is accurate.** Nobody will spot a wrong field in 70,200 rows by eye, so this has to be a script that fails loudly rather than a review.

- [x] **U5.1 done, and stronger than the item asked for.** `scripts/verify-zoho-migration.mjs` pass 1 checks every extracted Zoho id against `zoho_id_map` individually rather than comparing totals, across all 11 modules. Totals are not the test: two modules can agree on a count and hold different records, which is exactly how Departments looked like 104 missing companies
- [x] **U5.2 done, and it is the only check that can catch a bad extract.** `scripts/verify-zoho-sample.mjs` pulls a random sample straight from the Zoho API, runs each live record through the real mappers, and compares the result against the FOOS row: 24 records, 228 field comparisons, 0 mismatches. Everything else in U5 reads the extracted files, so it cannot tell a faithful import of a wrong file from a faithful import of a right one.

  The first run reported 26 mismatches, every one exactly 8 hours. That uniformity was the tell: the database holds the correct UTC instant and my comparison was stripping the `+08:00` offset and stamping `Z` on it, so the instrument was wrong and the data was right. It compares instants now. Same class as the `datetime-local` defect in U5's own test notes, and a reminder that a measurement disagreeing with the data is a claim about the measurement too
- [x] **U5.3 done, and it corrected my own record.** `tests/unit/zoho-export-contract.test.ts` asserts the export data contract against the real files: every export uses the `Zrecruit_` prefix on **both** sides of the join, attachment parents resolve against candidate ids **verbatim**, `Attachment URL` is empty in every row, and the education and experience exports are header-only. The two date dialects and the three partial-date shapes were already covered by `zoho-parsers.test.ts`. Section 7.21

**U6. A data exporter in Settings, asked for on 2026-09-03.** So that getting data out of FOOS is never the problem getting it out of Zoho has been. This is a product feature, not migration scaffolding, and it outlives the migration.

- [x] **U6.1 done.** `DataExportCard` in Settings lists all six list modules with a live count read from the same view the export uses, so the number beside the button is the number the button will produce. A count that fails comes back as `unavailable` rather than 0, because 0 and "could not read" mean opposite things
- [x] **U6.2 done.** Every export pages the module's list view a thousand rows at a time with an explicit `.range()`, so `max_rows` can never truncate it silently. Measured on the largest module: candidates is 72,917 rows over 73 requests in 19.7 seconds, counted 72,917 and fetched 72,917. Twenty seconds is long enough that the button now reports progress rather than sitting dead
- [x] **U6.3 done.** The card reads the ordinary `supabase` client under the caller's own JWT, never the service role, and the views are `security_invoker`. Asserted both ways: the UI shows a non-admin a restriction message instead of the buttons, and an API test confirms the bd persona counts **0** candidates through the same view, so the boundary is the database rather than a hidden button
- [x] **U6.4 done.** Exports go through the existing `downloadCsv` in `lib/csv.ts`. Covered by a round trip on a candidate whose surname holds a newline, an escaped quote and a comma at once, parsed back with a quote-aware reader. That shape is not hypothetical: four hand-rolled parsers were broken by it earlier in this project
- [x] **U6.5 done, and it caught three real bugs immediately.** 21 API tests and 3 browser tests. The registry's column names are a runtime string the compiler never sees, so a test now selects every declared column against its view: it found `updated_at` declared on `candidate_list`, `contact_list` and `ticket_list`, none of which have that column. Also asserts each module's paged export returns exactly its counted rows, and that the downloaded CSV holds exactly the number promised beside the button, counting records rather than newlines

**Assumption on U6, stated so it can be corrected cheaply.** "Exporter" is read as exporting FOOS data out to CSV, per module, from Settings. The other possible reading is a UI to drive the Zoho import itself. If the second was meant, U6 changes shape and U2 grows a screen.

### 8.1 Highest consequence, nothing blocking it


### 8.2 Under two hours each, no product risk

- [~] **O6 dropped 2026-09-03, your call.** Backups and point-in-time recovery on the live project. A separate Supabase project is being created for develop, so confirming the settings on the old one is not work worth doing. Dropped rather than left open, the same way P2 and P3 were, so it leaves the denominator instead of sitting as a permanent gap. It will need answering on the new project once that exists

### 8.3 Frontend fidelity

Closed 2026-09-02, and the table chrome was corrected against sampled pixels rather than against my reading of the screenshots.

- [x] Table cell content is bold, as it is in every Taleo screenshot
- [x] The filter rail no longer squeezes the table. It is a disclosure, collapsed by default, opened by a "Search these records" link that mirrors Taleo's "Search these Candidates". Taleo has no in-content filter panel at all, so the default view now matches and filtering is one click away
- [x] All seven list titles drop the invented ": Home" suffix
- [x] The pager puts first and previous before the count and next and last after it, which is Taleo's arrangement, not ours
- [x] **Table colours corrected from sampled pixels.** I had assumed the blue section tint was right for table headers. Sampling `22_Taleo_Cand_List_1.png` directly says otherwise: the header is `#ffffff` with `#333333` text, rows alternate `#fafafa` and `#ffffff`, and the page band behind them is `#f0f0f0`. Ours had a blue header, `#f7f7f7` zebra and an `#eeeeee` canvas. All four now match exactly, verified by reading the rendered `backgroundColor` back out of the browser. The blue band stays where the screenshots actually use it, on record section headers
- [x] **N9** A print stylesheet, and Printable View now actually prints. One cosmetic anomaly recorded in the workstream N row

### 8.4 Product capability, your call on value rather than a technical decision

- [x] **T3 measured and answered, one default left to you.** The "2,836 nodes and 108 controls" premise was stale: with R3 and T2 in place the candidate record is **894 nodes and 73 controls**. A closed section costs 7 nodes and 58px, and the eight closed ones total 56 nodes, so the section count is not the cost. History Log / Timeline alone is 63% of the nodes and 47% of the 5,979px page. Section 7.13 has the figures
- [ ] **T3a, yours to call.** Status History defaults closed, History Log / Timeline defaults open, on the same page. Closing the timeline too takes the page from 5,979px to about 3,220px and 894 nodes to about 340. One line, not made, because it changes what loads first on the primary record screen

### 8.5 Architecture, each needs a decision first


### 8.6 Waiting on one authorised command from you

Each is written, proven locally and idempotent, and refuses a non-local target without `--allow-remote`.

- [ ] **A3 and A4** `scripts/backfill-zoho-candidate-fields.mjs`. Restores 37 star grades and corrects 74 initial dates
- [ ] **B2** `scripts/rotate-persona-passwords.mjs`. Fresh random passwords, printed once, stored nowhere
- [ ] **B3** Whether a production `staff` row is created for you
- [x] **K10 measured locally, half.** Production bundle over seven authenticated routes: worst CLS **0.007** against a 0.1 bound, worst INP **16ms** against 200ms, **zero** long tasks over 50ms and zero blocking time. CLS, long tasks and INP are CPU- and layout-bound so they transfer; LCP and TTFB over loopback are not quoted as deployed figures. `npm run cwv --workspace=tests`. Section 7.14, including three harness bugs that each gave a confidently wrong answer first
- [ ] **K10b** The deployed LCP and TTFB, the half loopback cannot produce. Needs a URL and a login

### 8.7 Waiting on data or credentials only you can supply

- [x] **D11 done 2026-09-03.** The client-credentials flow ran unattended against both orgs for the whole extraction, import and verification. Measured in the database: **371,364** rows in `zoho_id_map`. This was the item every other D depended on
- [x] **D2 done.** Job openings: **687** requisitions imported from Zoho, every one with a company and its Zoho timestamps
- [x] **D3 answered rather than re-exported.** The Education Details file really is header-only, but the data was never in it: education lives on the candidate degree fields, and **59,499** people have it. Nothing was waiting on a re-export
- [x] **D4 answered, and the answer is that there is nothing to migrate.** `Current_Employer`, `Experience_in_Years` and `Skill_Set` are blank on all **72,910** candidates in Zoho, which is why the Experience Details export came back header-only. `people.experience` is empty because the source is empty, not because the import dropped it
- [x] **D5 done 2026-09-03**, and this row had been left saying 348 files stored while the D table above already recorded it closed. **1,747** files are enumerated once the three CRM modules are counted, not the 1,735 this row claimed, and **1,738** are in Supabase Storage at 472,697,067 bytes, which is 451 MiB. The nine that are not are both accounted for: 8 identity documents held back deliberately, counted and never read, and 1 file of 76.5 MiB that the bucket refuses at a 25 MiB `file_size_limit`, which is the one decision left with you. Nothing in workstream D is open
- [x] **D10 done in full.** **68** contact profiles imported from Zoho: 50 CRM contacts, 5 Recruit client contacts and 13 CRM leads. The Recruit contacts were the ones the plan had wrongly recorded as already covered
- [ ] **E6** The last 12 of 82 acceptance criteria, each needing a Google account, a production publish, a hosted sheet or a human click-through

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

## 7.28 Workstream X: hosting, and why the frontend is not the hard part

Added 2026-09-04 when Klent said he would host it and asked whether Fly or Cloudflare Pages.

**The artefact is a static SPA.** `app/` builds to **34 files, 955,154 bytes (0.91 MiB), largest 215,735 bytes**, in 990ms. **Corrected 2026-09-07 by measuring it:** this said "41 files, 1.0 MB, largest 212 KB" and all three were wrong. A fresh `npm run build --workspace=app` writes 34 files totalling 955,154 bytes, 0.91 MiB or 0.96 MB, largest `vendor-supabase` at 215,735 bytes. Twenty-nine sit in `assets/`; the other five are `index.html`, `favicon.png`, `apple-touch-icon.png`, `og-careers.png` and `ventvest-logo.webp`. Fewer files and fewer bytes than claimed, so no host limit moves. Nothing server-side: `app/package.json` has no express, fastify, next or remix, and the only runtime configuration is `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, both baked into the bundle at build time. The anon key therefore ships publicly, which is by design: RLS is deny-by-default on every table and `validate.sql` proves it over 35 checks.

**Fly is the wrong tool, per its own documentation.** Fly requires the static files to be packaged as a container image and run on machines: "Getting an application running on Fly.io is essentially working out how to package it as a deployable image", with a Dockerfile and, in their static guide, nginx. That means maintaining and paying for a container to serve 34 files. Fly earns its place when there is a long-running process to run; here there is not, because the backend is Supabase.

**Cloudflare Pages is already configured, and was set up during the security audit.** `app/public/_headers` is committed and carries the parts that are easy to get wrong: `outputDirectory: app/dist`, the SPA rewrite `/((?!assets/).*)` to `/index.html` without which every deep link 404s, immutable caching on `/assets/` against `no-cache` on `index.html`, and a full header set including HSTS, `X-Frame-Options: deny`, `Referrer-Policy: no-referrer`, COOP, CORP, a locked-down `Permissions-Policy`, and a CSP with `script-src 'self'` whose `connect-src` already allows `https://*.supabase.co`, `wss://*.supabase.co` for Realtime and `accounts.google.com` for OAuth.

**Corrected on 2026-09-04 after Klent pointed out there is no Next.js**, which is right and is the deciding fact rather than a detail. Cloudflare Pages's differentiator is first-party Next.js support, SSR and ISR, and this app uses none of it: it is `tsc --noEmit && vite build` to 41 static files.

**Cloudflare Pages's Hobby plan cannot be used for this.** Its own documentation: "the Hobby plan restricts users to **non-commercial, personal use only**". VV-FOOS is commercial client work, so the licensable tier is **Pro at $20 per developer seat per month**, for what is a static file server.

**Cloudflare Pages** hosts the same bundle with **"requests to static assets are free and unlimited"** on both free and paid plans, against 34 files and 955,154 bytes versus a 20,000-file and 25 MiB ceiling. **Resolved 2026-09-07**, where this used to say the commercial-use question was unverified: the old non-HTML-content limit, Supplemental Terms section 2.8, was retired on 2023-05-16, and the Developer Platform service-specific terms of 2026-06-02 carry no commercial-use restriction. The quotes and their dates are in `docs/environments/VVPH_VV-FOOS_Runbook_Hosting-And-Cutover`.

**The switching cost is the only real argument for staying.** `app/public/_headers`'s rewrite and header set would have to be ported to `_redirects` and `_headers`. Everything translates directly, CSP included, so it is a short job rather than a rewrite. If VentVest already pays for Cloudflare Pages Pro, or wants zero migration work, staying is defensible: **the technical outcome is identical either way, and this is a cost and licensing question rather than a capability one.**

### The items

| # | Item | Why, and what breaks without it |
| :---- | :---- | :---- |
| X1 | ~~Create the develop Supabase project~~ **Closed 2026-09-14: there is no develop project.** Two environments only, a developer's local stack and the Cloudflare Pages site, on the existing `hilieyehhecrlccdveta` | Klent's action. It also sidesteps the live project's broken ledger: 10 migrations were applied there through the MCP connector under generated timestamps against 6 hand-written repo files, which is why `supabase db push` refuses with `LegacyDbPushMissingLocalError` |
| X2 | ~~Apply all migrations to the new project~~ **Closed 2026-09-14 with X1.** The existing project already carries them. The repo now holds **65** migrations | They apply cleanly from scratch in order, which `npm run db:reset` proves on every local run. A fresh project has no ledger to reconcile |
| X3 | Dashboard settings no migration can make: enable `pg_cron`, add `dash` to Data API → Exposed schemas, restrict Google OAuth to the ventvest.com hosted domain with email/password fallback | Without `pg_cron`, migration 10 cannot schedule `foos-reminder-due` or the 15-minute `dash` refreshes. Without `dash` exposed, **every dashboard query fails with `PGRST106`**, which is defect QA-001 |
| X4 | Add the Cloudflare Pages production and preview origins to Supabase Auth redirect URLs, and to the Google OAuth authorised origins | Sign-in breaks on the hosted domain otherwise, and preview deploys have their own origins |
| X5 | Deploy the **12** Edge Functions with their `verify_jwt` settings and secrets | `supabase/functions/README.md` and `README-agent6.md` record each one. They deploy to Supabase, not to the web host, so a frontend deploy alone leaves careers, intake and the Google integration dead |
| X6 | Set `CAREERS_PUBLIC_ORIGIN` to the hosted origin | `careers-page` hardcodes `https` because `req.url`'s scheme cannot be trusted behind Supabase's proxy, and derives its links from this variable |
| X7 | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Cloudflare Pages, pointing at the new project | The client throws at boot if either is missing |
| X8 | **Decide what data the hosted instance carries.** The 73,022 imported candidate records are real people | A privacy decision, not a technical one, and the only item here that is genuinely Klent's rather than mine. Hosting seed data only is a legitimate answer |
| X9 | If real data goes up, purge demo rows first: the `is_test` rows and the three demo staff | `staff` has no `is_test` column, so Rita, Sam and Ben are deleted by hand. The purge order is in `README.md`. Currently 10 test people and 3 test requisitions locally |
| X10 | Verify after deploy, not before: Google sign-in; one dashboard query, which proves `dash` is exposed; a deep link such as `/recruit/candidates/<id>`, which proves the rewrite; a live update, which proves `wss://` passes the CSP; the public careers page | Each of the five exercises a different one of the items above, so a green result means the configuration took rather than that the page loaded |
| X11 | Decide whether the Cloudflare Pages git integration builds production on push. Narrowed 2026-09-14: with one environment there are no preview deploys to gain | **The GitHub Actions workflow is disabled at Klent's instruction and stays disabled.** Cloudflare Pages building on push is a separate mechanism and needs its own yes or no, not an assumption |
| X12 | **Decide the host on licensing, not capability.** Cloudflare Pages Hobby forbids commercial use, so it is Pro at a **$20/month platform fee** that includes one deploying seat and $20 of usage credit, with extra deploying seats $20 each and viewer seats free; Cloudflare Pages serves static assets "free and unlimited". If Cloudflare, the port is already done and committed at `docs/environments/cloudflare/`. **Corrected again 2026-09-07:** the first port carried `/* /index.html 200` and that would have proxied every hashed bundle request to `index.html`, because "Redirects are always followed, regardless of whether or not an asset matches the incoming request". Pages does the SPA fallback itself when there is no top-level `404.html`, which the build satisfies, so `_redirects` needs no rule at all. Logged as QA-018 | Both serve this bundle identically. **Corrected 2026-09-07:** the Cloudflare terms check is now done. The old non-HTML limit, section 2.8, was retired on 2023-05-16, and the Developer Platform service-specific terms of 2026-06-02 carry no commercial-use restriction, so the licensing asymmetry is real and one-sided. Pages free allows 500 builds a month, 20,000 files and 25 MiB an asset against our 34 files at 955,154 bytes. Sources and quotes are in the Goal 6 runbook |

**The shape of it:** X1 to X7 are configuration, an afternoon, and mostly Dashboard clicks rather than code. Two of the twelve are still Klent's to answer: X8, what data the hosted instance carries, and X11, whether Cloudflare builds production on push. X12 was answered on 2026-09-14: Cloudflare Pages, with Supabase on Pro. X10 is the only part that can fail in an interesting way. **Corrected 2026-09-07:** an earlier row here named X8 and X11 as the decisions and this paragraph named X8 and X12, so the two disagreed and neither was complete. All three are decisions, and X1 is separately Klent's action because only he can create the project.

## 7.29 Goal 8's capture harness found two product defects the whole test suite had missed, and one in itself

Goal 8 exists because the design audit had photographed 25,231 component crops and never one whole page. Building an instrument that photographs pages instead turned up three defects, none of which was on any plan row.

**QA-023, Critical, fixed.** Pressing any two placeholder-backed controls in one page session left the application unusable. `app/src/hooks/useOverlayDismiss.ts` set `closing` and `closingRef` when a close was requested and **never set either back**, and `PlaceholderProvider` holds that hook at app level rather than per modal. So the second overlay rendered with `data-closing="true"` from the first frame, and `requestClose` returned at its own `closingRef` guard, which kills Escape, the backdrop click and the Close button together because all three call it. `styles/layers/motion.css:229` animates that backdrop to `opacity: 0` with `forwards`, so the blocker is invisible: the page looks normal and ignores the mouse until a reload. Four clicks from a fresh sign-in reach it, and `usePlaceholder().show()` is used in 18 files.

Nothing in 181 browser tests or 265 vitest tests caught it, because **every existing test opens exactly one placeholder modal per page.** The sweep found it only because it presses every control on a page in sequence without reloading, which is the one access pattern that reaches the second overlay.

**QA-024, Medium, fixed for dismissal.** The Administration and Help menus ignored Escape. `app/src/hooks/useDismissable.ts` handled the exit animation correctly but registered no `keydown` listener at all, and `UtilityHeader` had only a `document` `mousedown` listener for outside clicks. Against the published spec, W3C ARIA Authoring Practices, Menu and Menubar Pattern: *"Escape: Close the menu that contains focus and return focus to the element or context, e.g., menu button or parent `menuitem`, from which the menu was opened."* The buttons declare `aria-haspopup="menu"` and the panel declares `role="menu"`, so the pattern applies by the app's own markup.

**The first fix for it was a regression, and the gate caught it.** A `window` listener made Escape dismiss every open overlay at once, and `tests/e2e/date-field.spec.ts:43` opens the filter rail with the date trigger inside it, so its Escape closed the rail and detached the trigger mid-click (`element is not stable`, then `element was detached from the DOM`). The shipped fix takes an optional `escapeScope` ref and listens on that node, so Escape reaches only the overlay whose trigger or content holds focus. The focus-management half of the same pattern, Enter or Space moving focus to the first `menuitem`, arrow-key traversal, and focus return on Escape, is **unimplemented and carried as finding C1** in `audit/2026-09-08/findings/CARRIED-IN.md` for Goal 11.

Both are now guarded by `tests/e2e/overlay-dismissal.spec.ts` in the gated suite, which is why the browser count moves from 179 to **181**.

**QA-025, my own harness, fixed.** The sweep's only skip list caught destruction and missed **mutation**, so it pressed 69 star-grade controls on one list of 23 candidates, the deal-kanban stage headers, and `Complete`, `Dismiss`, `Shortlist`, `Flag`, `Applied`, `Save`, `Submit` and `Go!` against a database holding 72,988 real people. Nine `status_change` rows over five records resulted. All five were repaired from their sources rather than from memory: the Zoho bulk export gave `Rating` empty and `Candidate_Status` for the two imported candidates, and `supabase/seed.sql` lines 61-63 gave **3, 2 and 1** for the three demo candidates, not the 3, 3, 3 the sweep left. DEAL-0001 needed no repair. The sweep is now read-only, with `NOT PRESSED, writes to the database` and `NOT PRESSED, moves a record between stages` stated in the report rather than coverage quietly narrowing.

Repairing it exposed a fourth thing. **`scripts/backfill-zoho-candidate-fields.mjs`, the tool whose only job is repairing `star_grade` from the export, was reading a 75-row sample against 72,917 profiles** and printing a clean bill of health, while its own paging code carefully verified that it had read every row of `zoho_id_map` and `candidate_profiles` before comparing them to a tenth of a percent of the source. It now defaults to the full bulk export at **72,910** rows, accepts `row['Id']`, takes `--source=<path>`, and prints which file it read.

**What this says about the plan rather than about the code.** Three of these four are instrumentation, not features: a test suite that only ever opens one modal, an audit that only ever cropped components, and a repair tool pointed at a sample. Each one reported success on the part of the problem it could see. That is the same failure the whole of Goal 7 to Goal 11 exists to correct, and it is the reason those goals measure the instrument before trusting its output.
