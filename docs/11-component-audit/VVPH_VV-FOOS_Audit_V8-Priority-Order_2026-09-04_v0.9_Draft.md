# V8: the order workstream W should build in

Version 0.9. The order follows V12's severity, then the number of screens a change reaches. It does **not** follow ease of implementation, which is why the cheapest item is not first.

## The order

| Rank | Item | Severity | Reach | Why here | W |
| ----: | :---- | :---- | :---- | :---- | :---- |
| 1 | **Control height scale** | Degrades | 363 usages, every screen | It touches every other item. Building the select, the checkbox or the date field before the height scale exists means building them to a height that then changes, and re-touching all of them. It is also the complaint Klent can see | W1 |
| 2a | **The bulk-select header's missing `indeterminate`** | Costs | `Table`, 17 uses | Promoted after reading the source. A partial selection renders as unchecked, and clicking it replaces the selection with all rows. It is a handful of lines, it prevents a silent data-scope error on a 72,917-row list, and it needs no design decision, so it should ship first and alone | W4 |
| 2 | **Select → combobox** | Costs | 54 usages, 23 files | The case Klent named, and the only control whose open state no CSS can reach. One component, so 54 call sites inherit the fix | W2 |
| 3 | **Density and wasted space** | Costs | every screen | 7,304px and 9.71 viewports on the candidate record, and the fidelity audit's F6 already called the empty home page the single most visible departure from Taleo. Ranked below the select only because the select is a component and this is a sweep whose targets V13 is still measuring | W10 |
| 4 | **Date and datetime input** | Costs | 19 controls | Filters, forms and reminder dialogs. Above the checkbox because a wrong date is a wrong record, while a browser-drawn checkbox is only ugly | W3 |
| 5 | **Empty state before first load** | Costs | every list | Lists show a "no results" row while the first query is still in flight, which NN/g names as "particularly harmful". Cheap to fix and it removes a lie from the screen | W8 |
| 6 | **Bottom action bar and pager** | Costs | every long list and record | Fidelity audit F7. On a 9.7-viewport record, the actions are only at the top | W10 |
| 7 | **Error and validation presentation** | pending pass 3 | every form | Judged against GOV.UK's published rule. The rank will move once pass 3 shows what the forms actually do | W8 |
| 8 | **Disclosure, replacing `details`** | Degrades | 6 controls | The cheapest item in the workstream, and deliberately not first. `RecordSection` already does it correctly, so it is a copy rather than a design | W6 |
| 9 | **Checkbox glyph, including `mixed`** | Degrades | 18 controls | Carries the 20px-versus-24px WCAG decision. The tri-state half of this moved to rank 2a below, because it is a wrong state rather than a glyph | W4 |
| 10 | **Focus ring consistency** | pending V9/V13 | every control | One ring is defined; whether every control adopts it is what the corpus shows | W7 |
| 11 | **Label and control alignment** | pending V9/V13 | every form | Position is already correct per GOV.UK and Carbon; the open question is gap consistency | W1 |
| 12 | **Radio glyph** | Cosmetic | 5 controls | Bundled with the checkbox work since the mechanics are shared, despite the different APG contract | W4 |
| 13 | **File input** | Cosmetic | 1 control | One control, and no APG pattern exists for it | W5 |
| 14 | **Number spinners** | Cosmetic | 12 controls | **Recommended not to build.** Hide the spinners and validate as text; a custom stepper is a real component with its own contract and 12 call sites do not justify it | W8 |
| 15 | **Scrollbars** | Cosmetic | every scroller | **Recommended not to change.** Restyling a user agent control removes the rationale for the WCAG exemption it relies on | W7 |

## Two orderings this deliberately rejects

**Cheapest first.** The disclosure replacement is six controls with a two-key contract and a working precedent in the codebase. It would take an afternoon and produce a visible win. It sits at rank 8 because six accordions toggling instantly is a smaller cost to a recruiter than every control on every screen being a slightly different height.

**Loudest first.** The select is the item Klent named, and it is rank 2 rather than rank 1, because building it before the height scale means building it twice. That is a case where the right order and the requested order differ by one step, and it is worth saying out loud rather than quietly reordering.

## What would change this order

- **V9 and V13's numbers.** If the measured height spread turns out to be one or two pixels, rank 1 drops and the select leads. If it is large and visible on every toolbar, rank 1 is confirmed. This document is 0.9 until that is known.
- **Pass 3.** If a form's validation genuinely loses a user's work, row 7 becomes **Blocks** and jumps to the top.

**On "nothing is rated Blocks", which I wrote earlier and no longer fully believe.** Rank 2a comes close. A user with three rows selected sees an unchecked box, clicks it, and their selection becomes all rows on the page; if they then run a bulk action, they have acted on twenty records instead of three without being told. That is not "the user cannot complete the task", so it stays **Costs** by the definition in V12. It is worth naming as the closest thing in the audit to a Blocks defect, because the definition, not the harm, is what keeps it out.
