# W9: what is left after Goal 5

Written at the close of Goal 5, from the code as it stands rather than from the earlier briefs. Every count here was measured on 2026-09-07 and every claim that contradicts an earlier document says so.

## Workstream W is 24 of 24

| Item | State | Where the evidence is |
| :---- | :---- | :---- |
| W1 control height scale | Done, then superseded | 332 controls measured, 2 distinct heights, 32px and 40px. **W25 replaces both with one**, because two heights is what Klent objected to |
| W2 select and combobox | Done | `tests/e2e/select-combobox.spec.ts`, 11 tests |
| W3 date field | Done | `tests/e2e/date-field.spec.ts`, 4 tests, 0 `type="date"` left |
| W4 checkbox and radio glyphs | Done | `indeterminate` set through a ref, mixed state asserted |
| W5 file input | Done | `tests/e2e/form-affordances.spec.ts` |
| W6 disclosure | Done | 0 `details` and 0 `summary` on the six list routes |
| W7 focus ring and scrollbars | Done, one part a deliberate no | Ring is W15's; scrollbars stay native, argued from WCAG 2.5.8's own exemption |
| W8a wiring what exists | Done | 44 messages announce, `aria-invalid` wired, `busy` at every table, `useListLink` carried by every list-to-record path |
| W8b loading and error summary | Done | `Spinner`, `Button loading`, `ErrorSummary` on six forms |
| W8c the small and the deferred | Done except one deferred part | `TICK_MS`, spinners hidden. V6 row 32's mobile gate waits on P4 |
| W10 information architecture | Done | Nine sections closed, 42 inline inputs replaced by one toggle |
| W13 to W22 | Done | Items 7 to 15 of the Goal 5 log |
| **W9 the remaining task list** | **Done, this document** | Closed with Goal 5 on 2026-09-07, taking W to 22 of 22 |
| **W24 the login flash** | **Done** | Fixed the same day, after Goal 6, which is where Klent asked for it. `SessionProvider` holds a `staffResolvedFor` marker so `loading` covers the staff fetch; `tests/e2e/login-flash.spec.ts` proves it both ways, `holdCardRenders=0` with the fix and `1` without. That takes W to 23 of 23 |
| **W25 one control height** | **Done** | One `--control-h: 32px` replaces the four-token scale W1 shipped. Measured across all 31 routes at `controlsMeasured=369 distinctHeights=1`, and guarded by `scripts/check-control-heights.mjs`, gate check 9 of 22, proven to fail on a broken tree. The 44px nav tabs and the 48px kanban column are out of scope with the reason recorded |

## Goal 2's build list, restated with what Goal 5 changed

Twenty-one rows, ordered by value over effort. One is now done and one changed size.

| | Build | State | Size |
| :---- | :---- | :---- | :---- |
| 1 | `New Task` | Open | 2 to 4 h |
| 2 | `New Contact` | Open | 2 to 4 h |
| 3 | `Go!` | Open | 2 h |
| 4 | `Next` | Open, and cheaper now: `useListLink` carries the list URL from every list to every record | 2 h |
| 5 | `Send Email` (contacts) | Open | 4 to 6 h |
| 6 | `Print Resume` | Open | 2 to 4 h |
| 7 | `View Resume` | Open | 4 to 6 h |
| 8 | `Flag` | Open | 4 to 6 h |
| 9 | `Search` (on a requisition) | Open | 4 to 6 h |
| 10 | `Web Support`, `Administration` | Open, and P5 is the blocker: nobody has given the support URL | ~2 h |
| 11 | `Change status to…` | Open | 1 to 2 d |
| 12 | `New Ticket` | Open | 1 to 2 d |
| 13 | `Delete` (4 lists) | Open | 1 to 2 d |
| 14 | `Configure columns` | **Done in Goal 5.** It was already live on the requisition and candidate lists; the intake queue was the only gap and now has one | was 4 to 6 h |
| 15 | `Advanced Search` | Open | 4 to 6 h |
| 16 | `Send To` | Open | 2 to 3 d |
| 17 | `Submit` | Open | 2 to 3 d |
| 18 | `Attach Contact` | Open | 1 to 2 d |
| 19 | `New Event`, `Schedule interview` | Open | 1 to 2 d |
| 20 | `Career Section` | Open | 2 to 3 d |
| 21 | `User Accounts` | Open | 2 to 3 d |

**Items 1 to 10 are still the whole of the first day's work**, about 28 hours now that item 4 is cheaper, and they light up ten controls across the shell, both recruit lists, the candidate record and the CRM.

Goal 1's two dead-control fixes stay attached to **P4**, which is Klent's: the pipeline shortlist star and the Kanban card drag both respond on a phone and then write nothing. The shape of the fix depends on whether the ATS is meant to be read-only at that width.

## Seven findings Goal 5 raised, five of them still open

Numbered G5-1 to G5-7 so they can be argued about separately. G5-5 was closed in the batch that found it, and G5-6 is a naming sweep rather than a defect.

| | Finding | Measured | Size |
| :---- | :---- | :---- | :---- |
| G5-1 | **Four accordions still cover one table.** `Contact Log`, `Events`, `Status History` and `History Log / Timeline` all read `activities`, which is 98.8% one kind (209,873 `note` of 212,496). Goal 3 called collapsing them into one with a kind filter the largest single space win on the candidate record. Goal 5 closed all four by default instead, which is the cheap half | Goal 3, section "The 17 accordions" | 1 to 2 d |
| G5-2 | **Corrected downward on measurement, and it is much weaker than I first wrote it.** `useLookups` does page every company through `fetchAllRows`, but `select count(*) from companies` is **195**, not the thousand I claimed: I had misread the 1,053 in plan section 7.26, which counts attachment-flagged records across four Zoho modules, not companies. A 195-option popup with type-ahead is fine, and the unbounded read is the only part still worth watching, because the query grows with the table rather than with the screen | `recruit/hooks.ts:32`, `companies` = **195** | ~2 h if it grows |
| G5-3 | **Corrected 2026-09-07, and it is four lists rather than one.** I wrote that the deals list is the odd one out and that "the candidate and requisition lists do sync". They do not. `grep -rn "setSearchParams\|replaceState\|pushState" app/src/` returns **nothing**: no page in the application writes a filter back to the URL. Four list pages read filters from the query string on mount for dashboard drill-through and none of them writes back, **16 params in total**: `CandidateListPage.tsx:88-93` reads 6, `RequisitionListPage.tsx:139-144` reads 6, `DealsListPage.tsx:73-75` reads 3, `ContactsListPage.tsx:72` reads 1. So no filtered list anywhere can be shared or bookmarked, and the fix is one shared hook applied at four sites rather than an effect in one file. The dashboard is not part of this: `DashboardPage.tsx:20` renders from `?tab=` and the nav links put it there, so that state is already in the URL | 4 files, 16 params, 0 write-backs | 1 d, not 2 h |
| G5-4 | **Four `datetime-local` inputs are still browser controls.** Deliberate in Goal 5: a date-and-time picker is a second component, and the four sites are reminder and meeting times where the native time spinner is good. Recorded so the absence is not read as an oversight | `CandidateOutreachDialogs.tsx:103`, `engagement.tsx:424`, `EngagementPanel.tsx:469`, `ContactRecordPage.tsx:399` | 1 to 2 d |
| G5-5 | **Closed in the same batch that found it.** `.rq-error` and `.form-error` were byte-identical under two names in two layers, and `motion.css` transitioned opacity on one and not the other, so 16 of the 22 page-level messages appeared instantly while 6 faded in. One `.form-error` in the `controls` layer now, 16 sites renamed, 0 references to `rq-error` left | 16 sites | done |
| G5-6 | **Fifteen `.rq-*` rules remain in `recruit.css`.** Two were promoted to the shared layer in Goal 5 (`.checkbox-list`, `.checkline`). The rest are plausibly recruit-specific, but `.rq-dialog`, `.rq-overlay` and `.rq-dialog-x` describe a dialog that `components/ui/Dialog.tsx` now owns for all three modules, so the names outlive their reason | `grep '^\.rq-' recruit.css` | ~2 h |

| G5-7 | **QA-014 is open.** `error-reporting.spec.ts` read 0 rows for a message the browser should have written, then passed on the next pass of the same tree. Ruled out: auth, RLS, the insert path, and both specs that delete `client_errors`. The remaining candidate is that the page was not on the route the test assumed. Two diagnostics are in place and the collision spec's routes are now run-unique; it stays open until a run reproduces it or ten consecutive passes do not | `tests/DEFECT_LOG.md` QA-014 | unknown |

## Outside workstream W

- **Goal 6, X1 to X12.** Hosting and cutover. `docs/07-environments/VVPH_VV-FOOS_Runbook_Hosting-And-Cutover` is the working document; plan section 7.28 carries the item list. **Updated 2026-09-07:** the eight items that are mine are prepared as far as they can go without a target, and the four that are Klent's are named as his rather than assumed.

| X | State after Goal 6's preparation |
| :---- | :---- |
| X1 create the develop project | **Klent's action.** Everything below waits on the ref |
| X2 apply the 54 migrations | **Rehearsed.** All 54 applied in order into a scratch database on plain Postgres 17.6 with the local shim, 0 failures. Cannot be applied for real until X1 |
| X3 `pg_cron`, `dash` exposed, OAuth domain | **Documented from the local stack.** Four cron jobs, not the two the plan named; ten `dash` objects, seven views over three materialized views; and the `hd` parameter is a hint, so the domain restriction has to be set on the provider |
| X4 redirect URLs | **Documented, with the trap named.** `redirectTo` is `window.location.origin`, and Supabase's list is exact URLs, so preview deploys need a pattern rather than enumeration |
| X5 deploy the 11 functions | **Table verified against `config.toml` and every reachable `Deno.env.get`.** Six run `verify_jwt=false`; ten secrets to set. Needs a target |
| X6 `CAREERS_PUBLIC_ORIGIN` | **Documented.** Needs a target |
| X7 the two `VITE_` variables | **Documented.** Baked at build time, so a change needs a rebuild |
| X8 what data goes up | **Klent's decision.** 72,988 `people` and 72,917 `candidate_profiles` are real people |
| X9 purge the demo rows first | **Coverage verified.** Every base table carrying `is_test` is one of the four in the purge order; the other three hits are views |
| X10 verify after deploy | **Three of the five automated** in `scripts/check-cutover.mjs`; Google sign-in and the live update stay manual |
| X11 build on push | **Klent's decision**, with the mechanism written up and a recommendation: production from `main`, previews elsewhere, no automatic production deploy from `develop` |
| X12 which host | **Klent's decision.** The research is finished: Vercel Hobby forbids commercial use, Cloudflare Pages carries no such restriction as of the 2026-09-07 read, and the Cloudflare port is committed |

Two defects came out of preparing this rather than out of shipping it: **QA-017**, the cutover check reading `VITE_SUPABASE_URL` and therefore talking to the live project on its first real run, and **QA-018**, a `_redirects` port that would have proxied every hashed bundle request to `index.html`. Both are closed and both are in `tests/DEFECT_LOG.md`, which now holds **19** entries.
- **W24, the login flash.** Klent, 2026-09-07: "upon successful login, i can see an account not provision display, then redirects me to home page. i don't like that." Scheduled after Goal 6 and before the final test pass.
- **The parked and blocked register.** T3a, A3, A4, B2, B3, K10b and E6, none of which are mine to close.
- **P4 to P7.** The read-only-on-a-phone question, the Web Support URL, the four unmapped 0% fields, and the star grade column.

## What the gate says about this state

Run F, the whole batch with QA-014, QA-015 and QA-016 fixed, is **five clean passes, 21 of 21 checks each**, `browser 175 passed`, `validate.sql 35 check(s) pass`, `importer 11 module(s) idempotent`, `attachments` clean. It is recorded pass by pass in the Goal 5 log's gate table. The `35` there is what the gate printed at the time; it counted `PASS` lines and one check prints two, so the distinct total is **34** and the gate now says so.

**The last run of the day, gate J, is 5 clean passes of 22 checks each** over the tree that carries W24, W25, QA-006 and the fixes for QA-019 through QA-022: `browser 179 passed` every pass, `api-tests 265 passed`, `validate.sql 34 check(s) pass`, `contrast All 35 pairs`, `control-h` ok, `attachments` clean. Three runs preceded it and two of those failed once each, at H on QA-020 and QA-021 and at I on QA-022; every failure named a condition and every condition was fixed rather than retried.

Run G covers the two changes made after F, which F therefore did not verify: the date field naming the real fault, and the error summary reaching the one form of six that the audit had actually measured. A commit claiming five clean passes has to mean five passes over the tree it contains, which is why they are a separate commit and a separate run. **Run G finished clean five times, 21 of 21 each, `browser 176 passed` every pass.**

Six new shared components carry the replacements, **929 lines** in total: `Select` 372, `DateField` 364, `dateParts` 73, `FileField` 53, `ErrorSummary` 49 and `Spinner` 18. The two large ones are large because a browser control is being replaced rather than restyled, and each is asserted by its own spec rather than by inspection.

The suite counts have grown with the work: **265 vitest tests** (119 `api`, 144 `unit`, 2 `mocks`), **178 browser tests**, **34 schema checks**, **35 contrast pairs** and **nine** guard scripts. Every one of those figures has been corrected downward or restated at least once: the browser total was 175 at gate F, 176 after gate G's added assertion and 178 after W24's two; the vitest total was 249 until the MIME-header decoder added 16 unit tests; "API and RLS tests" was a misnomer, because the vitest config includes `api/**`, `mocks/**` and `unit/**`; the schema checks read 35 until the gate stopped counting `PASS` lines; and the guards were described as "four" in `CLAUDE.md` and as "six" here when there are nine.
