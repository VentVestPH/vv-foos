# V8: the order workstream W should build in

Version 0.96. Rank 1 confirmed by measurement; its severity was raised to Costs and put back to Degrades the same day, see the rank 1 cell. Error presentation moved from rank 7 to rank 5 once it was verified from source rather than left to pass 3. The order follows V12's severity, then the number of screens a change reaches. It does **not** follow ease of implementation, which is why the cheapest item is not first.

## The order

| Rank | Item | Severity | Reach | Why here | W |
| ----: | :---- | :---- | :---- | :---- | :---- |
| 1 | **Control height scale** | **Degrades** | 363 usages, every screen | **Confirmed by measurement on 2026-09-04**, and the rank holds. 15 distinct chrome-button heights across 1,066 desktop captures, a 28px spread, **154 of them (14.4%) shorter than the 24px WCAG 2.5.8 requires at AA**, and only 42.0% on the mandated 8px grid. I raised the severity to Costs on the strength of the pager's 22px arrows and **put it back the same day**: `min-width: 26px` plus a 4px gap puts their centres 30px apart against the 24px the spacing exception needs, so the pager conforms. How many of the other 154 fail outright is being computed from the measured boxes rather than argued. The rank does not depend on that: it is first because it touches every other item, since building the select, the checkbox or the date field before the scale exists means building them to a height that then changes | W1 |
| 2a | **The bulk-select header's missing `indeterminate`** | Costs | `Table`, 17 uses | Promoted after reading the source. A partial selection renders as unchecked, and clicking it replaces the selection with all rows. It is a handful of lines, it prevents a silent data-scope error on a 72,917-row list, and it needs no design decision, so it should ship first and alone | W4 |
| 2 | **Select → combobox** | Costs | 54 usages, 23 files | The case Klent named, and the only control whose open state no CSS can reach. One component, so 54 call sites inherit the fix | W2 |
| 3 | **Density and wasted space** | Costs | every screen | 7,304px and 9.71 viewports on the candidate record, and the fidelity audit's F6 already called the empty home page the single most visible departure from Taleo. Ranked below the select only because the select is a component and this is a sweep whose targets V13 is still measuring | W10 |
| 4 | **Date and datetime input** | Costs | 19 controls | Filters, forms and reminder dialogs. Above the checkbox because a wrong date is a wrong record, while a browser-drawn checkbox is only ugly | W3 |
| 5 | **Error and validation presentation** | Costs | 46 renderings, 149 field call sites | **Moved up from rank 7 on 2026-09-04, and no longer pending.** It was answerable from source: `Input` and `Select` already accept an `error` prop and already render a styled, animated `.field-error-text` span, and no call site passes it, so the per-field half of this is wiring an existing mechanism rather than designing one. `aria-invalid` appears 0 times and 45 of 46 error messages carry no `role="alert"`, so the accessible half is also additive | W8 |
| 6 | **Empty state before first load** | Costs | every list | Lists show a "no results" row while the first query is still in flight, which NN/g names as "particularly harmful". Cheap to fix and it removes a lie from the screen | W8 |
| 7 | **Bottom action bar and pager** | Costs | every long list and record | Fidelity audit F7. On a 9.7-viewport record, the actions are only at the top | W10 |
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

- **V9's numbers, now in.** The test I set was that rank 1 drops if the measured spread is one or two pixels and is confirmed if it is large and on every toolbar. It is 28px across 15 values with 14.4% of buttons below the AA target size, so **rank 1 is confirmed**. Its severity stays Degrades: I raised it to Costs and reverted within the hour, because the pager arrows I cited conform to 2.5.8 by the spacing exception once the exception is actually computed. V13's density numbers are still outstanding, which is what keeps rank 3 provisional.
- **Pass 3.** If a form's validation genuinely loses a user's work, error presentation becomes **Blocks** and jumps to the top. What is already known is that it does not lose work: native constraint validation blocks the submit and focuses the first invalid field, so the browser is doing the job badly rather than not at all.

**On "nothing is rated Blocks", which I wrote earlier and no longer fully believe.** Rank 2a comes close. A user with three rows selected sees an unchecked box, clicks it, and their selection becomes all rows on the page; if they then run a bulk action, they have acted on twenty records instead of three without being told. That is not "the user cannot complete the task", so it stays **Costs** by the definition in V12. It is worth naming as the closest thing in the audit to a Blocks defect, because the definition, not the harm, is what keeps it out.
