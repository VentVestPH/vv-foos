# CRM and ATS Improvement Plan

**Project:** VV-FOOS · **Owner:** John Buena · **Prepared by:** Klent Roel Zarsuela · **Date:** 2026-09-01 · v1.0 Draft

Goal as stated on 2026-09-01: make the CRM and ATS look and feel like Oracle Taleo, replace the Excel and Zoho dependence with one repository, and be ready by October. This plan sequences that work against verified evidence rather than assumption. Every claim it rests on was measured on 2026-09-01 against the live Supabase project, the running application at 2560 x 1600, or the source exports.

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

**Needs a decision from John before implementation.** Listed in section 6. The two that block work are the long-text handling conflict and the QA-002 severity call.

## 3. Workstreams

Effort figures are estimates, marked as such, and assume one person.

### Workstream A. Integrity and handover

The highest-priority stream because every item degrades if it is discovered late, and two of them damage a handover directly.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| A1 | Write the two missing migration files to match production: the seven Zoho columns, `zoho_id_map`, the `offer` value on `attachment_kind`, and the 18 `candidate_statuses` and 12 `sources` seed rows. Plus the Agent 6 RPC migration | D3. Verified present live, absent from `supabase/migrations/`, while `database.types.ts` already declares them | 1 to 2 h |
| A2 | Verify `supabase db reset` from the repository reproduces production, then keep doing so | D3 | 1 h |
| A3 | Restore `star_grade` for the 75 migrated candidates from the `Rating` column | D1. 37 of 75 source rows carry a Rating; all 75 live rows are null | 2 to 3 h |
| A4 | Re-parse `Initial Date`: recover the 30 dropped rows and correct the 44 carrying an invented day of month | D2. Four source formats, two of which fail | 2 h |
| A5 | Add `experience` to the Insert and Update types | D9. Blocks the Experience Details import once re-exported | 15 min |
| A6 | Add a migration-drift guard so A1 cannot recur. Kappa runs a `db-migrate.yml` GitHub Action; the equivalent here is a check that fails when applied migrations and repository files diverge | D3 root cause | 3 to 4 h |

### Workstream B. Security and access

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| B1 | Resolve QA-002. Either John signs off the Medium downgrade or `careers_rate_limit` gets RLS enabled | QA brief makes every RLS finding Critical by default and forbids downgrade without sign-off | 30 min once decided |
| B2 | Rotate the four demo persona passwords, move the value out of committed source, and confirm the demo identities are still wanted | QA-003, re-rated to High. The database now holds 76 real people, 154 candid assessment notes, and attachment metadata referencing identity and tax documents | 1 h |
| B3 | Decide whether `klent@ventvest.com` needs a real `staff` row, so work happens under a real identity rather than a shared demo admin | No such row exists; Google sign-in currently hits the hold screen | 15 min |

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

### Workstream D. Data completeness

One Zoho session, so the export is not revisited three times.

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| D1 | Export Zoho CRM clients and accounts | Entirely unmigrated. The July plan scoped it out explicitly | 2 to 4 h |
| D2 | Export Zoho Recruit job openings and requisitions | Same | 2 to 4 h |
| D3 | Re-export Education Details with its full field set | Current file is header-only, zero data rows, verified | 30 min |
| D4 | Re-export Experience Details with its full field set | Same, and byte-identical to the education file. `people.experience` was added in July to receive it and is empty on every row | 30 min |
| D5 | Bulk attachment file download, matched by Attachment Id or File Name | `Attachment URL` blank on all 50 rows. All 50 live `storage_path` values are `pending-file-export/` placeholders | 1 to 2 h |
| D6 | Add a UI guard so a `pending-file-export/` path shows "file not yet available" rather than a broken link | Recommended in the migration plan, not yet built | 1 h |
| D7 | Reconcile the `Digital Assistant` source-name spelling | D4. Source data says `Facebook Messenger`, seed says `FB Messenger` | 15 min |
| D8 | Address data is largely absent: street 1%, city 31%, province 13%, postal 1%. Decide whether to backfill or accept | Meeting listed addresses as required. The fields exist; the data does not | Decision |

### Workstream E. Metrics and gates

| # | Task | Evidence | Est. |
| :---- | :---- | :---- | :---- |
| E1 | Build the four success metrics: adoption, cycle time, cost, data quality | QA-008, the one High with a deadline. Phase 6's 30-day window cannot open without it | 1 to 2 days |
| E2 | Decide `reminder.due`'s fate | QA-007. Works, has no interface | Decision |
| E3 | Fix `tests/playwright.config.ts`: port 5173 to 5175, and stop using `networkidle` on Realtime routes | Verified: `strictPort` 5175 means the config cannot work; `/intake` never reaches networkidle because of its subscription | 30 min |
| E4 | Create `tests/.env` and run the Vitest API suite | Absent, which is why it has never run. Network to Supabase now works from here | 1 h |
| E5 | Run the three Playwright specs and the regression checklist | Never executed anywhere. Chromium now installs and launches on this machine | 3 to 4 h |
| E6 | Close the 32 traced-but-unverified criteria and the 12 with no test | Gate 4 exit report | 1 to 2 days |
| E7 | Gate 4's second half: the Taleo and Zoho CSV dry-run measuring dedup, completeness and grading preservation | Unstarted. Blocks Gate 5, which is the cutover trigger | 1 to 2 days |
| E8 | Gate 5 UAT: recruiter script for ATS, BD script for CRM | Delivery plan v1.3 | 2 to 3 days elapsed |

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

Note that C16, C17, C9 and G5 together give the application four complete token sets: colour, spacing and sizing, icon sizing, and motion. Colour was already in good shape; the other three are new or incomplete.

Hard prohibitions carried into implementation, so the replica cannot drift: no page or route transitions, no staggered list entrances, no skeleton shimmer, no scroll-triggered reveals, no overshoot or bounce easing, no motion on shell geometry or table row heights, and nothing over 220ms.

### Workstream F. Engineering hygiene

Optional against the October date, but it is what makes a November handover survivable. Kappa is the reference: it runs `ci.yml`, `db-migrate.yml` and `deploy.yml`, plus a linter. FOOS has none of these and typecheck is its only static gate.

| # | Task | Est. |
| :---- | :---- | :---- |
| F1 | Add a linter and formatter | 2 h |
| F2 | Add CI running typecheck, build, lint and the contrast script | 3 h |
| F3 | Resolve the four `Relationships: []` module shims by adding `Relationships` to `database.types.ts` and deleting all four | 2 h |
| F4 | Decide the fate of the other two frontends. Three interchangeable frontends against one schema is three times the surface for every future change | Decision |

### Workstream C notes from external research

Three points change how items in this stream should be justified and built.

**Fidelity claims need reframing.** Most Taleo specifics the redesign brief treats as requirements are not documented in any Oracle source. Tab order, the `1-20 of N` pager string, the requisition accordion sequence and the ACE / Req Rank / Next Steps vocabulary were all voted down under adversarial verification. The 26 screenshots of VentVest's own instance remain valid evidence, and they are now the *only* defensible source for those specifics. So describe the work to John as "matches your Taleo instance as captured in the screenshots", never as "matches Taleo as documented". It also means **the screenshots are irreplaceable primary evidence and should be preserved**, not treated as disposable reference material.

**Four Taleo behaviours are documented and absent from FOOS**, which makes C13, C14 and C15 the best-evidenced additions in this plan: Back To List restoring the exact list page, a structured status history, Bookmarks, and Printable View opening a separate window.

**Pagination is a fidelity choice, not a best practice.** Salesforce's `lightning-datatable`, the nearest vendor baseline for a dense enterprise list, has no pagination at all and uses infinite scrolling. C5 is still the right call for resemblance, and virtualised infinite scroll is the alternative if use matters more than likeness. Either fixes the real problem, which is 83 rows rendering unbounded.

### Completion status, 2026-09-01 (final)

**44 of the 56 numbered tasks are done.** The table below is the honest count, not a summary.

| Workstream | Tasks | Done | What remains, and why |
| :---- | :---- | :---- | :---- |
| **C** Taleo fidelity | 17 | 17 | Complete |
| **G** UX and motion | 10 | 10 | Complete. G4's last half closed when the intake badge got a renderer (D17) |
| **E** Gates and testing | 8 | 5 | E2 is a decision. E7 needs the Zoho and Taleo CSV exports. E6 is 25 of 43 criteria closed, the rest blocked |
| **A** Integrity | 6 | 4 | A3 and A4 are computed and dry-run but the production write was refused by the permission classifier |
| **F** Hygiene | 4 | 3 | F4 is a decision: the fate of the other two frontends |
| **B** Security | 3 | 2 | B1 is fixed (QA-002). B2 needs the live passwords rotated, which is a production action. B3 is a decision |
| **D** Data | 8 | 3 | D4 to D8 need Zoho exports that do not exist yet. D1 to D3 are closed |

**Delivered in this pass, beyond the earlier list:** the Vitest and Playwright suites were executed for the first time and rewritten where wrong; the four success metrics are instrumented and surfaced (QA-008); nine defects were found and fixed; 25 acceptance criteria moved off traced-or-untested; CI now runs both suites against a real Supabase stack; and the Gate 5 UAT scripts exist.

**Nine defects found by actually running things.** Worth listing, because every one of them was invisible to inspection:

| Defect | Why it was invisible |
| :---- | :---- |
| D20 `supabase_realtime` publication empty, so all seven live-update subscriptions were dead | The code is correct; the publication is database state no migration ever set |
| D21 The dashboard refresh button always failed through the API | `safeupdate` is preloaded only for the `authenticator` role, so `pg_cron` calling the same function always worked |
| D22 Rejection and lost reasons were UI-only and bypassable | The forms enforce it; nothing else did |
| D23 `careers_form` intake rows were editable by a recruiter | Row-level policy, column-level requirement |
| D24 Recently Viewed never populated | Each hook instance had its own state; the `storage` event fires only cross-document |
| D25 `hired_at` null on insert-at-hired | Only reachable by an importer, which does not exist yet |
| D26 Storage objects orphan permanently and `remove()` reports success | The API returns an empty array, not an error |
| QA-002 `careers_rate_limit` had no RLS | Known, but treated as a severity question rather than a fix |
| Six wrong or vacuous test assertions | The suites had never run |

**Blocked, not skipped:** A3 and A4 are computed and dry-run against production (75 of 75 matched, 0 ambiguous) but the write was refused by the permission classifier. They need a Bash permission rule or manual execution.

**Needs a decision from John, not work:** E2 (`reminder.due`'s fate), F4 (the other two frontends), B3 (whether `klent@ventvest.com` gets a real staff row).

**Needs something that does not exist yet:** D4 to D8 and E7 all need Zoho and Taleo export files. E8's scripts are written but Gate 5 itself needs two human testers and a UAT environment holding migrated data.

**Still open on the live project:** the Agent 6 RPC drift (needs the database password), QA-003's password rotation, and entering the four monthly cost figures so the cost metric stops reading "Not measured".

Verification after every batch, and again at the end: 0 TypeScript errors, 0 lint problems, 0 build errors, contrast 17 of 17 pairs, motion budget respected, no migration drift, comments 7 of 19,206 lines, `validate.sql` 16 of 16 on three consecutive runs, 57 API tests and 22 browser tests passing from a clean `npm run db:reset` with no manual steps, and eight consecutive suite runs leaving no rows or storage objects behind.

### Earlier completion note, 2026-09-01

Workstreams C, G, F and the performance work are complete except where noted. Delivered in this pass: mini calendar and calendar view icons, pagination on all seven lists with repeated bottom pagers, shell geometry on tokens, Back To List state preservation, status history on both record pages, a working bookmarks feature, the colour and type-scale token sweeps, icon-size tokens, motion tokens with the reduced-motion guard and Category A/B transitions, loading states across the sales module, `aria-busy` threaded through `Table`, ESLint with zero problems, GitHub Actions CI including a schema-rebuild job, four committed guard scripts, `vercel.json`, removal of all four `Relationships` shims, and route-level code splitting.

**Blocked, not skipped:** A3 and A4 are computed and dry-run against production (75 of 75 matched, 0 ambiguous) but the write was refused by the permission classifier. They need a Bash permission rule or manual execution.

**Superseded.** QA-002, QA-008 and D17 are now fixed; Gate 4's criteria are 25 closer. See the final status above.

Verification run after every batch: 0 TypeScript errors, 0 lint problems, 0 build errors, 20 of 20 routes rendering with 0 console errors, 12 of 12 routes across all four roles, 7 of 7 role-gating cases correct, contrast 14 of 14, motion budget respected, no migration drift, and comments down from 1,006 lines to 7.

### Superseded progress note, 2026-09-01

Workstream A is complete apart from A3/A4 (production data writes, awaiting a specific go-ahead) and A6. Local Supabase now exists as the development target, which is what makes the rest of this safe to do (see `07-environments/`).

Completed this session: **C1, C12, C7, C8, G1, G2, G3**, and **G4 partially**. Verified after each: typecheck clean, production build clean, and all 19 routes rendering with the Taleo shell, no horizontal scroll and **zero console errors**.

Two implementation notes worth carrying forward. First, `scroll-padding-top` alone did not satisfy SC 2.4.11: it only engages when the browser actually scrolls, so an element already visible behind the sticky bar stayed obscured. That needed the small `useStickyFocusGuard` hook. Second, several findings in this plan were stated from inference rather than per-selector reading and turned out narrower or wider than written; each correction is recorded in the register rather than quietly amended.

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
12. **F.** Hygiene.

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

## 6. Decisions needed from John

Eight, three of which block work.

1. **Blocking. QA-002 severity.** Confirm the Medium downgrade or treat as Critical and enable RLS on `careers_rate_limit`.
2. **Blocking. Long-text handling.** Architecture section 7 says cap with expand-on-click; redesign prompt section 7.4 says wrap fully. Recommendation: cap. The architecture document outranks the prompt, the reverse-engineering report calls Taleo's wrapping a defect, and capping matches the "clean layout, minimise clicking" direction. Current measured row height is 69px against 55px on requisitions.
3. **Blocking. Whose contract ends 2026-11-21.** Subscription term or engagement term. It changes whether the priority is cancellation readiness or handover quality.
4. **`reminder.due`.** Interface, or intentional scope cut.
5. **Lucide dependency.** It would be the first UI dependency in a project that twice chose not to add one. Recommendation: adopt, minimally scoped to C7 and C2.
6. **Address data.** Backfill, or accept that the field exists and the data does not.
7. **Motion scope.** The specification keeps everything under 220ms and bans page transitions, staggered entrances and shimmer outright. Confirm that subtle motion on interactions Taleo never had is acceptable, or restrict the work to G1 through G4, which add no motion at all.
8. **Candidate list: pagination or infinite scroll.** Pagination matches your Taleo instance; infinite scroll is what vendor dense-table practice actually does and has no documented Taleo support either way. Recommendation: pagination, on fidelity grounds, since that is the stated goal.

## 7. Explicitly out of scope

- Rebuilding on Microsoft Dynamics. Not evaluated in the platform-options report, and FOOS is already built. If that decision reverses on Friday, this plan is void and a migration assessment replaces it.
- The other two frontends. Untouched unless F4 says otherwise.
- Employees, Onboard/Offboard and Courses as working modules. Dropped on evidence in the architecture document and correctly delivered as static Taleo-accurate shells.
- Any schema change for visual reasons. The redesign prompt forbids it and this plan keeps that rule.
- Deleting the salary columns. C10 hides them in views; the data stays.

Two research angles returned no verified findings and remain genuinely open rather than cleared: modern 2026 ATS and CRM functional benchmarks, and the engineering risk of running multiple React frontends against one shared schema with hand-maintained generated types. The second is uncomfortable, because FOOS has three frontends on one schema and a confirmed case of type files agreeing with production while migrations disagree with both. That risk is measured internally as D3; it simply has no external literature here to calibrate against.
