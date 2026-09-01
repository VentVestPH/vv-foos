# Taleo Fidelity Gap-Closure Spec

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft · **Target:** `foos_redesign_2/app/`

Implementation detail for closing the thirteen deviations in `VVPH_VV-FOOS_Report_Taleo-Fidelity-Audit_2026-09-01_v1.0_Draft.md`. This spec does not restate the Taleo design language; that lives in `Prompt_Taleo-Exact-UI-Redesign` section 6 and `Report_Taleo-ATS-Reverse-Engineering` section 3, both of which remain authoritative. Only the deltas are here.

Every value below is computed or measured, not estimated. Contrast ratios use the WCAG 2.x relative-luminance formula against the actual token hex values.

## 1. Contrast remediation (closes F1)

Four token pairs fail AA. The fixes are deliberately minimal so the Taleo look survives. Two are sub-perceptual darkenings; one changes text colour rather than the brand green; one applies only to control boundaries.

### 1.1 Primary nav band

```css
/* was: --taleo-nav: #4b8dab;   white text = 3.69:1  FAIL */
--taleo-nav: #427d98;        /* white text = 4.55:1  PASS, 11% darker */
```

This affects every label in the primary navigation on every page, so it is the highest-traffic fix in the set.

### 1.2 Sidebar panel header band

```css
/* was: --taleo-sidebar-header: #5b7f9c;   white text = 4.23:1  FAIL */
--taleo-sidebar-header: #577995;   /* white text = 4.59:1  PASS, 4% darker */
```

A 4% darkening. Visually indistinguishable side by side.

### 1.3 Candidate-count badge

Do **not** darken the green. Reaching AA with white text requires darkening `#7fba36` by 30% to `#588225`, which visibly departs from the Taleo count badge. Change the text colour instead:

```css
.badge-count {
  background: var(--taleo-count);   /* #7fba36 unchanged */
  color: #222222;                   /* was #ffffff (2.34:1) -> now 6.80:1  PASS */
}
```

This is both the accessible option and the more faithful one.

### 1.4 Control borders

WCAG 2.2 success criterion 1.4.11 requires 3.0:1 for the boundaries of interactive components. `#d5d5d5` on white is 1.47:1. Scope the change to inputs, selects, textareas and buttons. Leave decorative table rules and panel hairlines on `#d5d5d5`, since 1.4.11 does not govern them and changing them would coarsen the flat Taleo look.

```css
:root {
  --taleo-border: #d5d5d5;          /* unchanged: table rules, panel edges */
  --taleo-control-border: #949494;  /* new: 3.03:1 on white  PASS */
}
input, select, textarea, button { border-color: var(--taleo-control-border); }
```

Values that were checked and rejected as still failing: `#c4c4c4` at 1.74:1, `#b8b8b8` at 1.98:1, `#adadad` at 2.24:1, `#a6a6a6` at 2.43:1.

### 1.5 Leave alone

`--taleo-link` is currently `#1b6fc9` at 5.04:1. The redesign prompt's stated starting value of `#0785cc` yields 3.29:1 and would fail. Keep the current value and record that the deviation from the prompt is deliberate.

## 2. My Calendar panel (closes F2, F3, and most of F6)

References: screenshots 01 for the default state, 02 for 1-day, 03 for 7-day, 04 for 31-day, 05 for detailed day. Four of the 26 references are currently unused and all four are for this panel.

### 2.1 Mini month grid

Right-aligned inside the My Calendar accordion body, beside the date line. Per screenshot 01 OCR: a month and year caption, a single-letter day-of-week header row (`S M T W T F S`), and a date grid with the current day marked.

Build as a semantic `<table>` so screen readers announce it as a grid, with `<caption>` carrying month and year, `<th scope="col">` for the day letters, and `aria-current="date"` on today. Use `--taleo-row-hover` (`#e8f1f7`) for the today cell, which the audit measured at 13.91:1 against body text.

No dependency. This is a date arithmetic loop and a CSS grid or table, roughly 60 lines. Do not add a calendar library for it.

### 2.2 View icons

Six controls in the panel header action row: day, 7-day, 31-day, person, group, agenda. Render as icon buttons in `shell/icons.tsx` style, thin outline, `--taleo-icon` (`#4a7098`).

FOOS has no calendar or events feature, so these have no data to switch between. They are therefore screenshot-accurate placeholders and must route through `TaleoPlaceholder` with a `FOOS-TBD` comment, exactly as the existing 41 markers do. Give each an `aria-label`, since the audit confirmed all current icon buttons carry accessible names and that property should not regress.

### 2.3 Do not fabricate data

The panel currently shows "No events scheduled" and "Task list is empty", which are correct Taleo empty states for a product with no calendar feature. Keep them. Prompt section 8.1 is explicit: "If data does not exist, show the Taleo empty state rather than removing the panel."

## 3. Shell geometry (closes F4, F5)

| Property | Spec | Measured | Change |
| :---- | :---- | :---- | :---- |
| Utility header height | ~110px at 2560 x 1600 | 72px | Raise to ~104px. Increases wordmark and icon-row breathing room, which is what makes the header read as Taleo rather than as a compact app bar |
| Sidebar width | 19% of viewport, ~380px in reference, 300 to 380px practical | 300px | Raise to 340px. 380px matches the reverse-engineering measurement but crowds the content area at 1440 x 900, which prompt section 14 also requires supporting. 340px is the compromise |
| Content left edge | follows sidebar | 300px | Follows automatically |

Both are single-value changes in `app.css`. Re-measure after changing, because the header height feeds the sticky-offset calculations for any sticky action bar.

## 4. List page completeness (closes F7, F8, F9)

### 4.1 Bottom action bar and pager

Prompt section 7.3 and the reverse-engineering report both require the action bar and pager to repeat below the table. Currently zero. Add to the `ListPage` component so every list inherits it rather than patching pages individually. Applies to the requisition, candidate, accounts, contacts, deals, tickets and intake lists.

The top and bottom bars should render from one definition, so the two cannot drift.

### 4.2 Candidate list pagination

The requisition list already renders the correct format, measured as `1-3 of 3`. The candidate list has none and renders all 83 rows in a single pass. Add pagination at 20 rows per page, matching Taleo's `1-20 of 677` format, with first, previous, next and last controls.

This is not only fidelity. The list is backed by 83 real candidate profiles today and grows with every import, so an unpaginated table is a live performance problem.

Honest framing of the justification, revised after external research. The `1-20 of N` pager string is **not** documented in any Oracle source; a composite claim asserting it was refuted 0-3. It is evidenced by the screenshots of VentVest's own instance and by the reverse-engineering report that read it off them, which is legitimate evidence for this instance and nothing more. Salesforce's `lightning-datatable`, the closest vendor baseline for a dense enterprise list, has **no pagination at all** and uses infinite scrolling instead. Both approaches solve the actual problem, which is the unbounded render. Pagination is the fidelity-preserving choice and is what this spec recommends; virtualised infinite scroll is the vendor-precedented alternative if John would rather optimise for use than for resemblance.

Preserve behaviour that the prompt protects: CSV export must continue to export the current filtered set rather than only the visible page, since the export contract is "rows already on the client" and RLS is what makes it safe.

### 4.3 Flag column position

Move `Flags` from last position to second, immediately after the checkbox column, per prompt section 8.3. Every other column in that table is already in the specified order.

### 4.4 Back To List must restore list state (closes F13)

Documented Taleo behaviour, verified 3-0 against the TBE 11.4 User Guide: Back To List "returns you to that page of the Candidates list", preserving the page position the user came from.

Current implementation on both the candidate and requisition record pages:

```tsx
onClick={() => navigate('/recruit/candidates')}
```

This discards filters, saved view, sort order and page. Fix by carrying list state across the drill-down. Both list pages already accept a query-param contract published for dashboard drill-through (`status`, `company_id`, `owner_id`, `location`, `date_from`, `date_to`, and the candidate equivalents), so the least invasive fix is to preserve the originating URL, including its search string, and navigate back to it rather than to the bare path. React Router's location state or a small session-scoped store both work.

Do not change the published query-param contract itself; Agent 7's dashboards depend on it.

Related affordance recorded in the code as `FOOS-TBD`: no previous or next paging within the current list view. Taleo has `Next` on record views. Worth implementing alongside this, since both need the same list-state plumbing.

### 4.5 Sticky bars need scroll-padding (closes F12)

WCAG 2.2 Technique F110 makes a sticky bar that completely covers the focused element a failure of SC 2.4.11 Focus Not Obscured (Minimum), Level AA, tested by tabbing in **both** directions. `app.css` has two sticky rules and no `scroll-padding` or `scroll-margin`.

```css
/* .record-action-bar is position: sticky; top: 0; z-index: 10
   Record pages stack up to 15 accordion sections beneath it, so tabbing
   upward scrolls the focus target under the bar. */
html { scroll-padding-top: <height of .record-action-bar>; }
```

Measure the bar rather than guessing, and re-measure after the header height change in section 3, since that change moves the sticky offset. If the bottom action bar added in 4.1 is made sticky rather than merely repeated, it needs `scroll-padding-bottom` as well. A repeated static bar carries no 2.4.11 exposure, which is one argument for repeating rather than pinning it.

Verification is a keyboard pass, not a computed value: tab forward through a record page to the last section, then tab backward, and confirm the focused element is never completely hidden.

## 5. The long-text decision (resolves F10)

Two governing documents conflict:

- Architecture section 7, locked at Gate 1: "Tables cap long text with expand-on-click."
- Redesign prompt section 7.4: "full wrapping for long grade/status notes."

Measured candidate row height is 69px against 55px on requisitions, so wrapping currently wins.

**Recommendation: cap at two lines with expand-on-click.** Three reasons. The architecture document outranks the redesign prompt in the authority order. The reverse-engineering report lists Taleo's full wrapping as a defect rather than a feature, calling it "a real readability cost visible on the candidate list". And John's 2026-09-01 direction was to keep the layout clean and minimise clicking, which a 69px row height works against once the grade comments carry the migrated Zoho prose, some of which runs to several hundred characters.

External research adds a target rather than just a preference. IBM Carbon defines five row-density sizes (24, 32, 40, 48, 64px) and reserves 64px for two-line content. Capping at two lines lands the candidate row near 64px; leaving it uncapped at 69px is off Carbon's scale altogether, and the migrated Zoho grade prose runs to several hundred characters in places. Note also that a claim that clipping-by-default is the mainstream enterprise norm was refuted 0-3, so capping is justified by Carbon's density ceiling and by the architecture document, not by an appeal to industry practice.

This needs John's confirmation before implementation, because it is the one place where faithful replication and usability genuinely diverge, and the prompt forbids resolving it unilaterally.

## 6. Token drift (resolves F11)

Record the four deviations from the prompt's starting values as deliberate, since `tokens.css` states they were calibrated against the screenshots and the prompt's own source hierarchy ranks screenshots above its own values. Add the measured contrast ratio beside each token as a comment so a future change cannot silently reintroduce an AA failure.

| Token | Prompt | Current | Action |
| :---- | :---- | :---- | :---- |
| `--taleo-sidebar-header` | `#4b8dab` | `#5b7f9c` | Change to `#577995` per 1.2 |
| `--taleo-section` | `#99c9dc` | `#a9c6dc` | Keep. 8.94:1 with body text |
| `--taleo-link` | `#0785cc` | `#1b6fc9` | Keep. Prompt value would fail AA |
| `--taleo-logout` | `#d9534f` | `#c0392b` | Keep. 5.44:1 with white |

## 7. Recommended non-blocking additions

Not required by any document, cheap, and they improve the areas the audit probed:

- `scope="col"` on table header cells and a `<caption>` on each data table. The audit found `<th>` present but no `scope` and no captions. Verified framing: table-structure failures anchor at SC 1.3.1 Level A and therefore block AA, but `<th>` versus `<td>` and explicit `scope` are *sufficient techniques*, not requirements, and both prescriptions were refuted 0-3 as stated. FOOS carries `<th>`, so structure is already exposed. This is good practice, not a conformance obligation.
- Do **not** add `role="region"` to accordion panels. The ARIA Authoring Practices Guide says to avoid it past roughly six simultaneously expandable panels, and the candidate record has 15. FOOS currently has none, which is correct.
- Fix `tests/playwright.config.ts`: it targets port 5173 and starts a dev server there, while this frontend pins 5175 with `strictPort`, so `npm run test:e2e` cannot work as configured. Also avoid `networkidle` on `/intake` and any other Realtime-bearing route, since the open subscription means it never fires. Both facts were established by running it.

## 8. Verification after implementation

Re-run the same three checks that produced this spec, so the numbers are comparable:

1. Route capture at 2560 x 1600 across all 20 routes, asserting shell present, correct h1, no horizontal body scroll, zero console errors.
2. DOM measurement of header height, nav height, sidebar width, content left edge, title size and weight, band colours, cell padding, row heights, pager format, checkbox column, zebra, and bottom action bar count.
3. Contrast computation across the full token pair set, asserting every text pair at 4.5:1 and every control boundary at 3.0:1.

Check 3 is worth keeping as a committed script rather than a one-off, since it is the check that silently regresses whenever a colour changes.

## 9. Documented Taleo features FOOS does not have

Not fidelity gaps against the screenshots, but capabilities documented in Oracle's own materials and absent from FOOS. These are the best-evidenced additions available, because the source is Oracle rather than an inference.

### 9.1 Bookmarks

Oracle shipped Bookmarks in Taleo Business Edition 17A2 specifically because Recently Viewed evicts entries: "the items will be removed from the bottom of the list as the user accesses more and more documents, the bookmarks will remain until the user deletes them." Up to 20, created from a bookmark icon in the upper left, shown by default in a bar at the bottom of the screen.

FOOS caps Recently Viewed at the last 15 records, so it has exactly the eviction problem Bookmarks solve, and it has no bookmarks feature. The utility header already renders a bookmark icon as a placeholder, so the affordance is drawn and unwired.

### 9.2 Status history on the record

TBE records status transitions in a structured history carrying **Status, Previous Status, Duration, Date In, Date Out and Comments**. FOOS captures all of the underlying data already: `status_change` activities, `applications.stage_changed_at`, and `dash.mv_stage_durations` computes durations for the dashboards. What is missing is the presentation, a per-record history table.

This is the highest-value item in this section: the data exists, the migrated Zoho notes give it content, and it needs a component rather than a schema change.

### 9.3 Printable View

Documented as opening the current page in a separate window with a "Print This Page" control. Currently a `FOOS-TBD` placeholder. A print stylesheet plus `window.open` covers it.
