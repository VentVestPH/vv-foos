# V5: how Taleo presents these controls, and where this replica departs

Sources, in the order the project's own hierarchy puts them: the screenshots and the reverse-engineering report that `docs/02-taleo-fidelity/` was built from, then the measured findings in `VVPH_VV-FOOS_Report_Taleo-Fidelity-Audit_2026-09-01_v1.0_Draft.md`, then this workstream's own measurements.

**This item did not need new research.** A fidelity audit already exists with measured numbers, and the honest job here was to read it, extract what it says about controls, and correct it where it has since gone stale. Two of its findings have.

## What Taleo's own presentation establishes

| Property | Taleo, per the fidelity audit | FOOS today, as measured there |
| :---- | :---- | :---- |
| Border radius | 0 to 3px | 0px, 2px, 3px only. Matches |
| Table cell padding | dense | 10px. Matches |
| Page title | around 25 to 28px, regular weight | 26px, weight 400. Matches |
| Checkbox first column on lists | required | present on both list pages. Matches |
| Left rail width | around 380px measured on Taleo; the prompt permits 300 to 380 | 300px, the bottom of the range, and "reads too thin against the reference" at a wide viewport |
| Action bar and pager repeated at the bottom of long pages | "The action bar and pager repeat below the table" | zero bottom action bars |
| Home page fill | "Taleo's home fills the screen because the month grid and populated panels occupy it" | **47% of the viewport empty**, content bottom at 844px in a 1600px viewport |
| Long text in cells | Taleo wraps fully, and the reverse-engineering report calls that a **defect**, not a feature: "a real readability cost visible on the candidate list" | wrapping currently wins; candidate row measured 69px against the requisition list's 55px |

## The finding that answers Klent's complaint, and it predates it

Klent, 2026-09-04: "taleo is still the standard, but i can see ugly designs with huge spaces and what not. i want that change."

The fidelity audit reached the same conclusion on 2026-09-01, independently, as **F6**, rated Medium:

> "Measured content bottom on `/` is 844px inside a 1600px viewport. Taleo's home fills the screen because the month grid and populated panels occupy it. **This is the single most visible departure from 'feels like Taleo'.**"

So the sprawl is not a fidelity trade at all. Tightening it moves *towards* Taleo, and the audit had already named it the single most visible gap. That settles the question V12 was going to have to ask: there is no conflict to arbitrate here between usability and fidelity, because on this point they agree.

## Row height has a defensible target already

The fidelity audit did this arithmetic and it should be reused rather than redone. Carbon publishes five row sizes, 24 / 32 / 40 / 48 / 64, with 64 reserved for two-line content ([data-table/style](https://carbondesignsystem.com/components/data-table/style/)). Measured then: the candidate list at **69px exceeds Carbon's largest size entirely**, and the requisition list at 55px sits between the two largest.

The audit's conclusion, which V9 and W1 should adopt: capping grade comments at two lines lands the candidate row near 64px, "which is what Carbon reserves that size for. This gives the decision a defensible target rather than a preference."

## Two findings in that audit are now stale, and this corrects them

The rule is that a measurement beats an earlier claim, including one in another document.

- **F8, "Candidate list has no pagination at all"**, is no longer true. It described a list rendering all 83 rows in one pass. Workstream U1.1 moved the candidate list to server-side paging: the list now pages 20 at a time from a database count, and this session measured its pager reading `1-20 of 72,917`. The growth problem F8 warned about, "will render unbounded rows as the pool grows", is exactly what U1.1 fixed at 72,917 candidates.
- **F10's premise has moved.** It recorded candidate rows at 69px on a list of 83 seeded rows. The list now holds 72,917 real rows whose grade comments come from Zoho, so the row height must be re-measured rather than carried forward, which is what V9 and V13 do. The *decision* F10 identified, cap versus wrap, is still open and still Klent's.

**F7 stands** and is worth restating because it is cheap: Taleo repeats the action bar and pager at the bottom of long lists, and FOOS has none. On a screen the candidate record now measures at 9.7 viewports, a user who scrolls to the bottom has no way back to the actions without scrolling all the way up.

## What Taleo does not settle

The fidelity material describes layout, density and chrome. It does not describe the internals of a native control, because Taleo's own controls are the browser's: its selects, date fields and checkboxes are native too, drawn by whatever browser the recruiter uses.

That has a consequence worth stating plainly, because it protects the replacement work from a fidelity objection: **replacing FOOS's native select with a styled listbox does not diverge from Taleo's design, it diverges from Taleo's browser.** The visible field keeps Taleo's geometry, border radius and colours; only the option list, which Taleo never designed and cannot style either, becomes ours. Where the replacement must make a genuinely new choice that Taleo has no answer for, such as the maximum popup height or the type-ahead timing, the specification says so and cites the design reference instead.
