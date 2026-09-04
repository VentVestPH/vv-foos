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
| V6, V12 | `Audit_V6-Audit-Table` | 0.98, every row verified in source or measured, none pending |
| V7 | `Spec_V7-Select-Combobox`, `Spec_V7-Remaining-Replacements` | done |
| V8 | `Audit_V8-Priority-Order` | 0.91, pending the geometry numbers |
| V9 | `Audit_V9-Control-Geometry` | 0.4, partial: dashboards and shell only |
| V10 | `Audit_V10-Visual-Review` | 0.5, the looking half done, the task costs pending pass 3 |
| V11 | `Audit_V11-Design-References` | done, with the "not published" answers kept |
| V13 | not yet written | pending the density measurement |

## The six passes

| Pass | Question | State |
| :---- | :---- | :---- |
| 1 Breadth | what exists and where | done, 28 routes at two viewports |
| 2 States | every control in every state | running: dashboards, shell and recruit complete at 5,470 captures, sales in progress |
| 3 Use | the real tasks walked as their user | harness written, queued |
| 4 References | judged against cited published sources | done, V4 and V11 |
| 5 Measurement | heights, spacing, density in numbers | harness written, queued |
| 6 Reconciliation | what the first five missed | not started |

## The findings that would change what W builds first

1. **The bulk-select header shows the wrong state and can silently widen a bulk action.** `indeterminate` appears nowhere in the codebase. With 3 of 20 rows selected the header renders unchecked, and clicking it replaces the selection with all 20. Verified in `Table.tsx`. Promoted to rank 2a in V8, because it is a handful of lines and needs no design decision.
2. **The keyboard focus ring is invisible on four surfaces.** `outline: 2px solid var(--fo-primary)` scores **1.01:1** against the primary nav where WCAG 1.4.11 requires 3:1, so a keyboard user has no visible position across all 14 nav tabs, the sidebar headers, Logout and any hovered primary button. `check-contrast.mjs` tests the ring against the white page surface only, so the gate is green.
3. **The select is one component, not fifty-four.** Two `<select>` elements exist; `components/ui/Select.tsx` is used 54 times across 23 files. The complaint resolves to one replacement.
4. **Nothing declares a control height.** Eight rendered button heights on two areas alone, a 28px spread, with a select at 36px sharing forms with inputs at 24px.
5. **Density is a component behaviour, not a spacing token.** Panels keep their full chrome when empty, which is the mechanism behind the 47% empty home page the fidelity audit already called the single most visible departure from Taleo.
6. **`aria-disabled` on 66 controls that respond** gives screen-reader and sighted users different products.
7. **`Table` has no loading state and no list announces its results**, so a screen-reader user is told "No candidates match." while the query runs and never told it finished.

## What this audit does not know

- **Chromium only.** No Firefox or Safari, which matters for a workstream about browser-decided controls.
- **No error or validation evidence yet.** Row 14 of V6 is the only row still unverified, and pass 3 supplies it.
- **The placeholder modal has never been captured**, because Playwright refuses to click an `aria-disabled` button. Fixed, and a targeted pass is queued.
- **Nothing is rated Blocks**, and V8 says plainly that the closest candidate is kept out by the definition rather than by being harmless.
