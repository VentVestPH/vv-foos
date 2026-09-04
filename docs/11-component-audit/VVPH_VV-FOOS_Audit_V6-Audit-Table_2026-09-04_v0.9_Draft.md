# V6 and V12: the audit table, one row per component, ranked by what it costs its user

Version 0.9. Every row below is backed by a count from source or a measurement from the corpus. Cells that depend on the geometry and density measurements are marked **pending V9/V13** rather than guessed, and this document is not final until they are filled.

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
| 4 | `details` → disclosure | 6 | the disclosure triangle, and an instantaneous toggle that cannot be transitioned | **Degrades** | The advanced-search accordion on six list screens toggles instantly while `RecordSection` two inches away animates within the motion budget | W6 |
| 5 | Checkbox glyph, including `mixed` | 18 | the glyph, its size, the checked and indeterminate marks | **Degrades** | Every list's bulk-select header is a tri-state checkbox drawn by the browser. Carbon's own in-table glyph is 20px, under the 24px WCAG 2.5.8 minimum, so FOOS must choose 24 or meet the spacing exception deliberately | W4 |
| 6 | Date and datetime input | 15 + 4 | the calendar, the spinners, the segment layout, the placeholder format, differently per browser | **Costs** | 19 controls across filters, forms and the reminder dialogs. `datetime-local` also carries the local-time hazard the test helpers already encode | W3 |
| 7 | No bottom action bar or pager on long screens | every list and record | nothing; this is ours | **Costs** | Fidelity audit F7: Taleo repeats both below the table, FOOS has none. On a record measuring 9.7 viewports, reaching the actions means scrolling back to the top | W10 |
| 8 | Radio glyph | 5 | the glyph and the checked dot | **Cosmetic** | 5 controls, and the APG contract for radios differs from checkboxes: selection follows focus | W4 |
| 9 | `input[type="number"]` spinners | 12 | the spinner arrows and their small hit area | **Cosmetic** | The audit recommends hiding the spinners and validating as text rather than building a stepper, and says so as a recommendation | W8 |
| 10 | File input | 1 | the button label, which is locale-dependent, and the "no file chosen" text | **Cosmetic** | One control, in the attachment panel. No APG pattern exists for it | W5 |
| 11 | Focus ring consistency | every control | `:focus-visible` is ours already | **pending V9/V13** | `states.css` defines one ring; whether every control actually adopts it is what the corpus shows | W7 |
| 12 | Scrollbars | every scroller | the appearance | **Cosmetic, and recommended not to change** | Restyling a user agent control removes the rationale for the WCAG 2.5.8 exemption it relies on | W7 |
| 13 | Empty state before first load | every list | nothing; this is ours | **Costs** | List screens render a colspan "no results" row while the first query is still in flight, which is the exact anti-pattern NN/g names: "inaccurate system-status messages… particularly harmful" | W8 |
| 14 | Error and validation presentation | every form | nothing; this is ours | **pending pass 3** | Judged against GOV.UK's published rule: summary at the top of `main` with "There is a problem", focus moved to it, and the inline message after label and hint but before the input | W8 |
| 15 | Label and control alignment | every form | nothing; this is ours | **pending V9/V13** | GOV.UK and Carbon both mandate labels above the input, which FOOS already does; the open question is gap consistency | W1 |

## What is not in this table, and why

- **The four Taleo placeholder mounts** (`/employees`, `/onboard`, `/users`, `/courses`) render `TaleoModulePlaceholderPage` and have no real behaviour. They are in the corpus for completeness. Auditing their components would be auditing a stub, so they carry no rows. If they are meant to become real screens, that is a product decision, not an audit finding.
- **`KanbanBoard`, `Timeline`, `StatusHistory`, `SidePanelTabs`, `StarGrade`, `UnviewedBadge`, `Badge`, `Table`, `Pager`** are all fully ours already, with no browser-decided parts. They appear in V1's inventory and in the corpus, and they earn rows here only where a measurement finds something, which is why rows 11 and 15 are still pending.
- **Anything the corpus has not yet shown.** This document is 0.9 for that reason: pass 3 has not run, and the geometry and density numbers are still being captured.
