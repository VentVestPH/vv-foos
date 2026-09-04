# Workstream V: the audit, and where each part of it lives

Version 0.9. Audit and specification only: nothing here changes a component. Workstream W builds from it.

The screenshot corpus is `audit/corpus/`, **gitignored**, because the screens render real candidate names from the Zoho migration. Each area has its own `manifest.<area>.json` naming component, state and viewport.

## The documents

| Item | Document | State |
| :---- | :---- | :---- |
| V1 | `Audit_V1-Component-Inventory` | 1.1, with the completed passes 1 and 2 coverage, 11,832 captures over 31 routes |
| V2 | `Audit_V2-Capture-Harness` | 1.1, including the nine defects the harness had, six of which would have failed silently |
| V3 | `Audit_V3-Browser-Defaults` | done |
| V4 | `Audit_V4-ARIA-Contracts` | done, read from w3.org |
| V5 | `Audit_V5-Taleo-Comparison` | done, and it corrects two stale findings in the 2026-09-01 fidelity audit |
| V6, V12 | `Audit_V6-Audit-Table` | **1.3**, 28 rows, every one verified in source or measured, none pending, plus seven things checked and found correct |
| V7 | `Spec_V7-Select-Combobox`, `Spec_V7-Remaining-Replacements` | done |
| V8 | `Audit_V8-Priority-Order` | 0.96, rank 1 confirmed by measurement; pending only the density numbers |
| V9 | `Audit_V9-Control-Geometry` | 0.7, partial: four of seven areas, heights and the row-level controls done, computed values pending |
| V10 | `Audit_V10-Visual-Review` | 0.6, the looking half done with two more observations corrected, the task costs pending pass 3 |
| V11 | `Audit_V11-Design-References` | done, with the "not published" answers kept |
| V13 | not yet written | pending the density measurement |
| Pass 6 | `Audit_Pass6-Reconciliation` | 0.9, fifteen of my own claims corrected, six findings added, thirteen acquittals, three harness gaps closed |

## The six passes

| Pass | Question | State |
| :---- | :---- | :---- |
| 1 Breadth | what exists and where | **reopened and redone**, 31 routes at two viewports plus `/login` in its own spec. It was 28 until diffing the route maps on 2026-09-04 found `/intake`, and the two not-found stubs, never visited |
| 2 States | every control in every state | **complete**, 11,832 captures across all 7 areas, except every radio and one datetime-local, which live inside dialogs the sweep never descends into |
| 3 Use | the real tasks walked as their user | harness written, queued |
| 4 References | judged against cited published sources | done, V4 and V11 |
| 5 Measurement | heights, spacing, density in numbers | harness written, queued |
| 6 Reconciliation | what the first five missed | **0.9**, source half done: 15 wrong claims corrected, 11 verified rows re-checked and all 11 held, 6 findings added, 13 acquittals recorded, 3 harness gaps closed. The measured half waits on the chain |

## The findings that would change what W builds first

1. **The bulk-select header shows the wrong state and can silently widen a bulk action.** `indeterminate` appears nowhere in the codebase. With 3 of 20 rows selected the header renders unchecked, and clicking it replaces the selection with all 20. Verified in `Table.tsx`. Promoted to rank 2a in V8, because it is a handful of lines and needs no design decision.
2. **The keyboard focus ring is invisible on the two dark shell surfaces, and the count of surfaces was wrong.** `outline: 2px solid var(--fo-primary)` at `#3679b5` scores **1.013:1** against the primary nav's `#427d98` and **1.003:1** against the sidebar panel header's `#577995`, where WCAG 1.4.11 requires 3:1, so a keyboard user has no visible position across all 14 nav tabs or the sidebar panel headers. **Corrected on 2026-09-04:** I had listed four surfaces, adding Logout and any hovered primary button. Both were wrong, because `outline-offset: 1px` places the ring outside the element's border box, so the surface it must contrast against is the nearest painted ancestor rather than the control. Logout's ring lands on the white utility header at 4.606:1 and a primary button's on the white page surface at 4.606:1, and both pass. `check-contrast.mjs` line 20 tests the ring against `--fo-surface` only, so the gate is green. The measurement pass now records the painted ancestor of every control and computes the ratio, so V9 will give the definitive list rather than my reading of the cascade.
3. **The select is one component, not fifty-four.** Two `<select>` elements exist; `components/ui/Select.tsx` is used 54 times across 23 files. The complaint resolves to one replacement.
4. **Nothing declares a control height, and 14.4% of buttons are below the AA target size.** Fifteen distinct chrome-button heights across 1,066 desktop captures in four areas, a 28px spread, of which **154 (14.4%) are shorter than the 24px WCAG 2.5.8 requires at AA** and only **42.0%** sit on the 8px grid the architecture mandates. The pager's four navigation arrows are 22px on all 14 call sites, and they **conform** by 2.5.8's spacing exception at 30px between centres, which I checked after briefly writing that they failed. How many of the 154 fail outright is being computed from the measured boxes; it may be zero. A `select` is 36px everywhere and an `input-text` is 21, 24, 25 or 34, so the two controls most likely to share a filter row never match. Corrected upward from eight heights on 2026-09-04, which was two areas rather than four; the 28px spread was right.
5. **Density is a component behaviour, not a spacing token.** Panels keep their full chrome when empty, which is the mechanism behind the 47% empty home page the fidelity audit already called the single most visible departure from Taleo. **The candidate record's height is disputed between two of my own earlier measurements**, 7,304px over 9.71 viewports against the plan's 5,979px in a 572px window, and V13 takes the 900px measurement over both rather than picking one.
6. **`aria-disabled` on 51 controls that respond** gives screen-reader and sighted users different products. `ariaDisabled` defaults to true in `PlaceholderAction` and no call site opts out. A further 11 `show(...)` calls open the same dialog from buttons that are not `aria-disabled`, so the pattern is inconsistent with itself across 62 actions. Corrected from 66 on 2026-09-04: that figure counted imports and the definition alongside the call sites.
7. **Row-level controls carry no row identity, so 61% of the candidate list's controls are indistinguishable by name.** `Table.tsx:268` labels every row checkbox `Select row`, `StarGrade.tsx:31` labels every star group `Star grade` and names each star from a `title` alone, and `ApplicationPipeline.tsx:428` gives 21 controls the same `Add to shortlist`. Measured: 100 of 163 controls on the candidate list share a name with nineteen others. This compounds finding 1: the header checkbox shows the wrong state *and* no row can be told apart by name.
8. **Twelve of 31 routes set no document title, plus `/login`.** WCAG 2.4.2 is **Level A**, and its Understanding document says an SPA must change the title per view. `useDocumentTitle` already exists and `ListPage` and `RecordPage` call it; the dashboard, global search, both intake importers, all four placeholder modules, both not-found stubs and the login screen call nothing, so all of them read `VentVest Front Office OS`.
9. **Sortable column headers are mouse-only, and five dialogs assert an inertness they do not enforce.** Two Level A and near-Level-A failures found in source on 2026-09-04. `Table.tsx:212` renders a sortable `<th>` with `onClick` and no `tabIndex`, no inner button and no `onKeyDown`, while line 249 gives every `<tr>` a correct roving `tabIndex`: keyboard support was implemented for rows and skipped for headers in one file. And all five dialog components declare `aria-modal="true"` while nothing in `app/src` traps or restores focus, which the APG warns can hide the rest of the page from assistive technology while Tab still reaches it.
10. **`Table` has no loading state, and the pager announces the page position rather than the result count.** Corrected on 2026-09-04: I had written that no list announces anything, and `Pager` does have an `aria-live` region. It is on `.fo-pager-pos` ("1 / 3646"), not on `.fo-pager-count` ("1-20 of 72,920"), and it renders only when there is more than one page. So a filter narrowing 72,920 rows to 3 announces nothing, and a screen-reader user is told "No candidates match." while the query runs and never told it finished.

## What this audit does not know

- **Chromium only.** No Firefox or Safari, which matters for a workstream about browser-decided controls.
- **No error or validation evidence yet.** Row 14 of V6 is the only row still unverified, and pass 3 supplies it.
- **The placeholder modal has never been captured**, because Playwright refuses to click an `aria-disabled` button. Fixed, and a targeted pass is queued.
- **Nothing is rated Blocks**, and V8 says plainly that the closest candidate is kept out by the definition rather than by being harmless.
