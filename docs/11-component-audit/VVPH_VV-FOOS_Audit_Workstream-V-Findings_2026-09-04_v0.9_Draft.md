# Workstream V: the audit, and where each part of it lives

Version 0.9. Audit and specification only: nothing here changes a component. Workstream W builds from it.

The screenshot corpus is `audit/corpus/`, **gitignored**, because the screens render real candidate names from the Zoho migration. Each area has its own `manifest.<area>.json` naming component, state and viewport.

## The documents

| Item | Document | State |
| :---- | :---- | :---- |
| V1 | `Audit_V1-Component-Inventory` | done |
| V2 | `Audit_V2-Capture-Harness` | done, including the six defects the harness had |
| V3 | `Audit_V3-Browser-Defaults` | done |
| V4 | `Audit_V4-ARIA-Contracts` | done, read from w3.org |
| V5 | `Audit_V5-Taleo-Comparison` | done, and it corrects two stale findings in the 2026-09-01 fidelity audit |
| V6, V12 | `Audit_V6-Audit-Table` | 0.99, every row verified in source or measured, none pending |
| V7 | `Spec_V7-Select-Combobox`, `Spec_V7-Remaining-Replacements` | done |
| V8 | `Audit_V8-Priority-Order` | 0.96, rank 1 confirmed by measurement; pending only the density numbers |
| V9 | `Audit_V9-Control-Geometry` | 0.6, partial: four of seven areas, heights done, computed values pending |
| V10 | `Audit_V10-Visual-Review` | 0.5, the looking half done, the task costs pending pass 3 |
| V11 | `Audit_V11-Design-References` | done, with the "not published" answers kept |
| V13 | not yet written | pending the density measurement |

## The six passes

| Pass | Question | State |
| :---- | :---- | :---- |
| 1 Breadth | what exists and where | **reopened and redone**, 31 routes at two viewports plus `/login` in its own spec. It was 28 until diffing the route maps on 2026-09-04 found `/intake`, and the two not-found stubs, never visited |
| 2 States | every control in every state | running: dashboards, shell and recruit complete at 5,470 captures, sales in progress |
| 3 Use | the real tasks walked as their user | harness written, queued |
| 4 References | judged against cited published sources | done, V4 and V11 |
| 5 Measurement | heights, spacing, density in numbers | harness written, queued |
| 6 Reconciliation | what the first five missed | not started |

## The findings that would change what W builds first

1. **The bulk-select header shows the wrong state and can silently widen a bulk action.** `indeterminate` appears nowhere in the codebase. With 3 of 20 rows selected the header renders unchecked, and clicking it replaces the selection with all 20. Verified in `Table.tsx`. Promoted to rank 2a in V8, because it is a handful of lines and needs no design decision.
2. **The keyboard focus ring is invisible on the two dark shell surfaces, and the count of surfaces was wrong.** `outline: 2px solid var(--fo-primary)` at `#3679b5` scores **1.013:1** against the primary nav's `#427d98` and **1.003:1** against the sidebar panel header's `#577995`, where WCAG 1.4.11 requires 3:1, so a keyboard user has no visible position across all 14 nav tabs or the sidebar panel headers. **Corrected on 2026-09-04:** I had listed four surfaces, adding Logout and any hovered primary button. Both were wrong, because `outline-offset: 1px` places the ring outside the element's border box, so the surface it must contrast against is the nearest painted ancestor rather than the control. Logout's ring lands on the white utility header at 4.606:1 and a primary button's on the white page surface at 4.606:1, and both pass. `check-contrast.mjs` line 20 tests the ring against `--fo-surface` only, so the gate is green. The measurement pass now records the painted ancestor of every control and computes the ratio, so V9 will give the definitive list rather than my reading of the cascade.
3. **The select is one component, not fifty-four.** Two `<select>` elements exist; `components/ui/Select.tsx` is used 54 times across 23 files. The complaint resolves to one replacement.
4. **Nothing declares a control height, and 14.4% of buttons are below the AA target size.** Fifteen distinct chrome-button heights across 1,066 desktop captures in four areas, a 28px spread, of which **154 (14.4%) are shorter than the 24px WCAG 2.5.8 requires at AA** and only **42.0%** sit on the 8px grid the architecture mandates. The pager's four navigation arrows are 22px on all 14 call sites, and they **conform** by 2.5.8's spacing exception at 30px between centres, which I checked after briefly writing that they failed. How many of the 154 fail outright is being computed from the measured boxes; it may be zero. A `select` is 36px everywhere and an `input-text` is 21, 24, 25 or 34, so the two controls most likely to share a filter row never match. Corrected upward from eight heights on 2026-09-04, which was two areas rather than four; the 28px spread was right.
5. **Density is a component behaviour, not a spacing token.** Panels keep their full chrome when empty, which is the mechanism behind the 47% empty home page the fidelity audit already called the single most visible departure from Taleo.
6. **`aria-disabled` on 51 controls that respond** gives screen-reader and sighted users different products. `ariaDisabled` defaults to true in `PlaceholderAction` and no call site opts out. A further 11 `show(...)` calls open the same dialog from buttons that are not `aria-disabled`, so the pattern is inconsistent with itself across 62 actions. Corrected from 66 on 2026-09-04: that figure counted imports and the definition alongside the call sites.
7. **`Table` has no loading state, and the pager announces the page position rather than the result count.** Corrected on 2026-09-04: I had written that no list announces anything, and `Pager` does have an `aria-live` region. It is on `.fo-pager-pos` ("1 / 3646"), not on `.fo-pager-count` ("1-20 of 72,920"), and it renders only when there is more than one page. So a filter narrowing 72,920 rows to 3 announces nothing, and a screen-reader user is told "No candidates match." while the query runs and never told it finished.

## What this audit does not know

- **Chromium only.** No Firefox or Safari, which matters for a workstream about browser-decided controls.
- **No error or validation evidence yet.** Row 14 of V6 is the only row still unverified, and pass 3 supplies it.
- **The placeholder modal has never been captured**, because Playwright refuses to click an `aria-disabled` button. Fixed, and a targeted pass is queued.
- **Nothing is rated Blocks**, and V8 says plainly that the closest candidate is kept out by the definition rather than by being harmless.
