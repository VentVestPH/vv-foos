# V6 and V12: the audit table, one row per component, ranked by what it costs its user

Version 0.95. Rows 16 to 22 were added on 2026-09-04 from the corpus review, and row 15's severity moved from pending to Degrades once three label arrangements were confirmed. Every row below is backed by a count from source or a measurement from the corpus. Cells that depend on the geometry and density measurements are marked **pending V9/V13** rather than guessed, and this document is not final until they are filled.

## V12: the severity scale

Severity is what the defect costs the person doing the work, not how hard it is to fix. "Good enough" is not a severity.

| Level | Meaning |
| :---- | :---- |
| **Blocks** | the user cannot complete the task, or completes it wrongly without knowing |
| **Costs** | the task completes, but slower, or with a risk of error the user has to absorb |
| **Degrades** | it works and is noticeably inconsistent or unfinished in a way a user remarks on |
| **Cosmetic** | visible on inspection, not in use |

The priority order in V8 follows this ranking. Where two rows share a severity, the tie-break is how many users meet it, measured by how many screens the component appears on.

## The table

| # | Component | Uses | What the browser decides | Severity | Evidence | W item |
| :---- | :---- | ----: | :---- | :---- | :---- | :---- |
| 1 | `Select` → combobox | **54** in 23 files | the entire option list: font, size, colour, hover, scroll, max height, position | **Costs** | The open state cannot be captured in a page screenshot at all, because it is an OS popup. It cannot be styled, tested or matched to Taleo by any CSS. Named by Klent as the case he dislikes | W2 |
| 2 | Control height across `Button`, `Input`, `Select`, `RecordSection` | **363** combined | nothing declares a height, so each control computes its own from padding, border and an inherited line-height that inputs never set | **Degrades** | `.btn` is `9px 18px` at 14px with `line-height: 1.25`; `.btn-sm` is `6px 8px` at 13px; `.field input` is `8px 10px` at 14px with **no line-height**. Rendered spread pending V9 | W1 |
| 3 | Page density and wasted vertical space | every screen | nothing; this is ours | **Costs** | Candidate record measured at **7,304px, 9.71 viewports**. The fidelity audit's F6 already called the home page's 47% empty viewport "the single most visible departure from feels like Taleo" | W10 |
| 4 | `details` → disclosure | 6 | **only the instantaneous toggle.** Verified: `controls.css` already hides the browser triangle with `::-webkit-details-marker`, so the marker is not a finding | **Degrades** | Verified in source: `.fo-advanced-search` carries no `transition` at all, while `motion.css` transitions `.record-section-collapse` on `grid-template-rows`. So the advanced-search accordion snaps open while `RecordSection` animates within the budget, on the same screen | W6 |
| 5 | **The bulk-select header shows the wrong state on a partial selection** | `Table`, 17 uses | the glyph and its size; the state is ours and it is wrong | **Costs** | Verified in source: `indeterminate` appears **nowhere** in the codebase and the header binds `checked={allSelected}` where `allSelected = rows.every(selected)`. So with 3 of 20 rows selected the box renders **unchecked**, saying nothing is selected. `toggleAll` then does `allSelected ? clear : selectAll`, so a user who reads the unchecked box as empty and clicks it silently replaces their 3-row selection with all 20. The APG requires `aria-checked="mixed"` for exactly this case | W4 |
| 6 | Date and datetime input | 15 + 4 | the calendar, the spinners, the segment layout, the placeholder format, differently per browser | **Costs** | 19 controls across filters, forms and the reminder dialogs. `datetime-local` also carries the local-time hazard the test helpers already encode | W3 |
| 7 | No bottom action bar or pager on long screens | every list and record | nothing; this is ours | **Costs** | Verified in source: `ListPage` renders `<div className="list-page-table">{children}</div>` with **no bottom slot of any kind**, so there is nowhere for a repeated bar to go without a component change. Fidelity audit F7: Taleo repeats both below the table. On a record measuring 9.7 viewports, reaching the actions means scrolling back to the top | W10 |
| 8 | Radio glyph | 5 | the glyph and the checked dot | **Cosmetic** | 5 controls, and the APG contract for radios differs from checkboxes: selection follows focus | W4 |
| 9 | `input[type="number"]` spinners | 12 | the spinner arrows and their small hit area | **Cosmetic** | The audit recommends hiding the spinners and validating as text rather than building a stepper, and says so as a recommendation | W8 |
| 10 | File input | 1 | the button label, which is locale-dependent, and the "no file chosen" text | **Cosmetic** | One control, in the attachment panel. No APG pattern exists for it | W5 |
| 11 | Focus ring consistency | every control | `:focus-visible` is ours already | **pending V9/V13** | `states.css` defines one ring; whether every control actually adopts it is what the corpus shows | W7 |
| 12 | Scrollbars | every scroller | the appearance | **Cosmetic, and recommended not to change** | Restyling a user agent control removes the rationale for the WCAG 2.5.8 exemption it relies on | W7 |
| 13 | Empty state before first load | `Table`, **17 uses in 13 files** | nothing; this is ours | **Costs** | Verified in source: `Table` renders its empty row whenever `sorted.length === 0` and has **no loading state at all**, grep for `loading`, `isLoading` or `pending` in that file returns zero. So every one of the 17 usages shows "No candidates match." or "No records." during the first fetch, which is the exact anti-pattern NN/g names: "inaccurate system-status messages… particularly harmful" | W8 |
| 14 | Error and validation presentation | every form | nothing; this is ours | **pending pass 3** | Judged against GOV.UK's published rule: summary at the top of `main` with "There is a problem", focus moved to it, and the inline message after label and hint but before the input | W8 |
| 15 | Label and control alignment | every form | nothing; this is ours | **Degrades** | Three arrangements coexist: above for editable fields, inline-right for read-only record values, inline-left for list filter rows. Consistent within each context, inconsistent between them | W1 |
| 16 | `aria-disabled` on 66 controls that respond | **66** usages against 11 natively disabled | nothing; this is ours | **Costs** | `PlaceholderAction` renders a clickable button carrying `aria-disabled="true"`, so a screen-reader user is told the control is unavailable while a sighted user clicks it and gets an explanation. The two audiences are given different products | W7 |
| 17 | A count is rendered with a semantic success badge | 1 call site | nothing; this is ours | **Degrades** | Verified in source: `RequisitionListPage.tsx:341` renders `<span className="badge badge-success">{r.applications}</span>`, so the candidate count uses the **success** variant unconditionally. A requisition with nobody in it therefore shows a green success pill reading `0`. `badge-success` is meant to carry a state, and here it is carrying a number | W8 |
| 18 | Irreversible state changes styled as links, beside navigations styled the same way | 5 controls in one row | nothing; this is ours | **Costs** | Verified in source. `lifecycleNextStep` renders `Filled`, `Place on hold` and `Close` as `<button className="link-btn">` calling `changeStatus(target)`, and the two controls beside them, `Candidates (21)` and `Add new candidate`, are also `<button className="link-btn">` but only scroll or open a panel. Five visually identical controls, three of which change a requisition's lifecycle status and two of which move the viewport. `Close` also duplicates the `Close requisition` action bar button eight pixels above it in a different style | W8 |
| 19 | Placeholder used as a format hint or instruction | **65** `placeholder` attributes, and **no hint-text pattern exists at all** | nothing; this is ours | **Costs** | Verified in source. `<Client>-<n>, e.g. Acme-3` is a format the user needs while typing, and it vanishes on the first keystroke. Others carry instructions the same way: `Leave blank to import without a company link`, `John's grading style — a short read on fit and current situation`, `City, state, country`. Grep for `field-hint`, `hint-text` or `field-help` returns nothing, so there is nowhere for hint text to go. NN/g: a placeholder is not a label. GOV.UK mandates hint text between label and input | W8 |
| 20 | Required asterisk placed inconsistently | 3 implementations | nothing; this is ours | **Cosmetic** | Verified in source, and it is three places rather than two. `Input.tsx` and `Select.tsx` both render `{required && <span className="field-required"> *</span>}` **after** the label, which is the shared and correct path. `RequisitionFormPage.tsx:306` hand-writes `<span className="field-required">*</span> Requisition Owners`, **before** it. `LinkedInIntakePage.tsx:172` hand-writes it after. So two call sites bypass the shared components and one of them puts the marker on the wrong side | W8 |
| 21 | Table overflows horizontally at 1440px | requisition list | nothing; this is ours | **Costs** | `Company` is cut mid-word at the right edge, so the column set is wider than the standard desktop width | W10 |
| 22 | `Reset` and `Cancel` are byte-identical in style and adjacent | 2 controls | nothing; this is ours | **Costs** | Verified in source: `RequisitionFormPage.tsx:279-280` renders `<Button onClick={() => navigate(-1)}>Cancel</Button>` then `<Button onClick={resetForm}>Reset</Button>`, and `Button` defaults to `variant = 'secondary'`, so the two carry **exactly the same class list**. One discards the form and leaves, the other discards the form and stays, and nothing distinguishes them but the word. NN/g's proximity guidance asks for distance plus a redundant visual signal, and there is neither | W8 |

## How each row is known

An audit is worth what its weakest row is worth, so this states the evidence type rather than leaving every row looking equally solid.

| Evidence | Rows |
| :---- | :---- |
| **Verified in source**, by reading the component or stylesheet | 4 (no transition on `.fo-advanced-search`), **5 (no `indeterminate` anywhere, and `toggleAll` replaces a partial selection)**, **19 (65 placeholders and no hint-text pattern)**, **17 (`badge-success` used for a count)**, **18 (five identical `link-btn`s, three of them lifecycle changes)**, **22 (`Cancel` and `Reset` share an identical class list)**, **20 (three asterisk implementations, two bypassing the shared components)**, 7 (`ListPage` has no bottom slot), 13 (`Table` has no loading state), 16 (66 `PlaceholderAction` against 11 native `disabled`) |
| **Measured**, from the corpus or a computation | 1 (four `select-clicked` captures, no overlay appeared), 2 (eight rendered button heights, 28px spread), 3 (7,304px, 9.71 viewports), 11 (focus ring at 1.01:1 against `--fo-nav`, computed from the tokens) |
| **Counted** from source, with the browser behaviour seen in captures | 6, 8, 9, 10 |
| **Seen in a capture** and described | 15, 21 |
| **A recommendation, not a finding** | 12 (leave scrollbars alone) and the number-spinner half of 9 |
| **Still pending** | 14, which needs pass 3 to drive a validation failure |

One row deserves its caveat stated in the row rather than here. Row 6's 19 date controls are verified and the per-browser divergence is a published property of the control rather than something this audit measured across browsers, since the corpus is Chromium only.

**The corpus is Chromium only.** Nothing here says anything about Firefox or Safari, and for a workstream whose central claim is that the browser decides too much, that is a real limitation rather than a footnote. Pass 6 should state whether it matters for the decisions W has to make; my expectation is that it changes the date and file controls' appearance and nothing about the geometry findings, but that is an expectation, not a measurement.

## What is not in this table, and why

- **The four Taleo placeholder mounts** (`/employees`, `/onboard`, `/users`, `/courses`) render `TaleoModulePlaceholderPage` and have no real behaviour. They are in the corpus for completeness. Auditing their components would be auditing a stub, so they carry no rows. If they are meant to become real screens, that is a product decision, not an audit finding.
- **`KanbanBoard`, `Timeline`, `StatusHistory`, `SidePanelTabs`, `StarGrade`, `UnviewedBadge`, `Badge`, `Table`, `Pager`** are all fully ours already, with no browser-decided parts. They appear in V1's inventory and in the corpus, and they earn rows here only where a measurement finds something, which is why rows 11 and 15 are still pending.
- **Anything the corpus has not yet shown.** This document is 0.9 for that reason: pass 3 has not run, and the geometry and density numbers are still being captured.
