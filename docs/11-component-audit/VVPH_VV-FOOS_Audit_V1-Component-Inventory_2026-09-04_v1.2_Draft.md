# V1: the component inventory

Counted from source on 2026-09-04. Usage counts are occurrences of the JSX tag with a word boundary, so `<Select` and `<Select\n` both count and `<SelectSomething` does not.

## Shared components, and how much of the app each one carries

| Component | Uses | Files | What a change to it reaches |
| :---- | ----: | ----: | :---- |
| `Button` | **138** | 40 | every screen |
| `Input` | **95** | 28 | every form and every list toolbar |
| `RecordSection` | **76** | 14 | every record page's accordions |
| `Select` | **54** | 23 | every dropdown in the product |
| `Badge` | 32 | 13 | status and stage chips |
| `Table` | 17 | 13 | every list |
| `Pager` | 14 | 7 | every list |
| `RecordPage` | 10 | 10 | the record shell |
| `ListPage` | 7 | 7 | the list shell |
| `StarGrade` | 7 | 4 | candidate grading |
| `Timeline` | 3 | 3 | activity |
| `UnviewedBadge` | 3 | 2 | list badges |
| `KanbanBoard` | 2 | 2 | pipeline and deals |
| `SidePanelTabs` | 2 | 2 | record side panels |
| `StatusHistory` | 2 | 2 | record history |
| `ErrorBoundary` | 2 | 2 | page and widget containment |

Four components carry the app: `Button`, `Input`, `RecordSection` and `Select` account for 363 of the 458 shared-component usages. **Any change to control height lands almost entirely in those four**, which is why W1 is one item rather than a sweep across 40 files.

## Where the code lives

| Area | `.tsx` files | Routes |
| :---- | ----: | ----: |
| `modules/recruit` | 16 | 7 |
| `modules/sales` | 16 | 11 |
| `components/ui` | 15 | shared |
| `modules/dashboards` | 12 | 3 tabs |
| `pages` | 7 | 5 |
| `shell` | 6 | shared |
| `modules/intake` | 6 | 2 |
| `modules/settings` | 5 | 1 |
| `auth` | 4 | 1 |

**31 routes in total**, which is what the capture harness enumerates in `tests/audit/routes.ts`. It was 28 until 2026-09-04, when diffing every `path=` in `App.tsx` and the module index files against the harness's list found three that had never been visited: `/intake`, the index route rendering `QueueListPage`, and the `path="*"` not-found stubs in both `App.tsx` and `modules/intake/index.tsx`. A fourth, `/login`, cannot be reached by the sweep at all because it signs in first, so it has its own spec and is not counted in the 31.

## Native controls, counted

| Kind | Count |
| :---- | ----: |
| text-ish `input` (bare, `search`, `email`) | 31 |
| `input[type="checkbox"]` | 18 |
| `input[type="date"]` | 15 |
| `textarea` | 13 |
| `input[type="number"]` | **12** |
| `details` and `summary` | 6 each |
| `input[type="radio"]` | 5 |
| `input[type="datetime-local"]` | **4** |
| `select` | 2 |
| `input[type="file"]` | 1 |

**107 native controls.** The two bolded rows were missing from the inventory in the workstream V plan, which listed only "31 input, 18 checkbox, 15 date, 13 textarea, 6 details, 5 radio, 2 select, 1 file". Both have browser-decided parts: the number spinner and the datetime segments and picker.

## What the sweep actually found on each screen, recruit and dashboards

Element counts per screen from the capture harness, which are the real denominators for anything the audit claims about coverage. Desktop first, then the same screen at 390px.

| Screen | Elements | State shots | Openers clicked | Overlays opened | Navigations |
| :---- | ----: | ----: | ----: | ----: | ----: |
| Candidate list | **177** / 94 | 486 / 236 | 132 / 53 | 23 / 6 | 48 / 35 |
| Requisition record | **171** / 90 | 513 / 241 | 113 / 84 | 8 / 3 | 56 / 39 |
| Requisition list | 125 / 82 | 334 / 213 | 88 / 71 | 5 / 5 | 72 / 55 |
| Candidate record | 123 / 85 | 353 / 202 | 78 / 51 | 17 / 11 | 32 / 17 |
| New requisition | 85 / 61 | 239 / 168 | 50 / 28 | 3 / 3 | 34 / 16 |
| Edit requisition | 85 / 61 | 239 / 168 | 50 / 28 | 3 / 3 | 34 / 16 |
| Dashboard, My View | 50 / 47 | 120 / 110 | 29 / 30 | 3 / 3 | 16 / 15 |
| Dashboard, Reports | 49 / 42 | 127 / 105 | 32 / 29 | 3 / 3 | 15 / 14 |
| Dashboard, Pipeline | 42 / 35 | 120 / 98 | 32 / 29 | 3 / 3 | 16 / 15 |
| Global search | 33 / 30 | 94 / 84 | 23 / 24 | 3 / 3 | 17 / 16 |

Recruit alone produced **4,358 captures**. Three things worth reading off this table:

- **The candidate list carries 177 interactive elements on one screen**, and 94 of them survive at 390px. That is the densest screen in the product and the one a recruiter spends the day in.
- **Mobile is not a subset.** The requisition list clicks 71 openers at 390px against 88 at 1440px, but navigates 55 times against 72, so the ratio of controls that leave the screen changes with the viewport rather than simply shrinking.
- **Overlay counts are low on the requisition screens**, 5 and 8 against the candidate list's 23. That is partly real, since the candidate list has bulk actions, star grades and column configuration, and partly the `aria-disabled` gap: 50 `PlaceholderAction` controls, and a hand-rolled 51st, were skipped as disabled before that was fixed, and the requisition record carries several of them.

## Passes 1 and 2 complete: what the whole sweep captured

Finished 10:53 on 2026-09-04, all seven areas, 31 routes at two viewports.

| Area | Screens | Captures | Of which element captures |
| :---- | ----: | ----: | ----: |
| recruit | 6 | 4,788 | 3,841 |
| sales | 11 | 4,294 | 3,366 |
| pages | 6 | 1,604 | 1,236 |
| dashboards | 3 | 1,052 | 806 |
| intake | 3 | 871 | 676 |
| settings | 1 | 335 | 264 |
| shell | 1 | 251 | 196 |
| **total** | **31** | **13,195** | **10,385** |

Regenerate this table with `node tests/audit/report-figures.mjs` rather than trusting it; every figure in it is read from the manifests.

**13,195 is the number to quote, not the 18,753 files on disk.** The manifests are rewritten from scratch when an area runs, so re-running one, which shell, dashboards and recruit all needed after harness defect 10, leaves the earlier PNGs with no manifest entry. Counting files would overstate coverage by 42%.

**Harness defect 10 is repaired and the re-swept areas came back larger than they were.** The focus-only supplementary pass had overwritten three manifests, taking recruit from 4,358 entries to 163, dashboards to 206 and shell to 56. Re-sweeping all three in full restored them to **4,788, 1,052 and 251**, each above its original, because the main sweep now captures a *verified* `focus-visible` state where the earlier runs predated that fix. So the repair also removed the reason the supplementary pass existed.

By state, across all 13,195:

| State | Captures |
| :---- | ----: |
| `default` | 2,846 |
| `focus-visible` | 2,802 |
| `hover` | 2,729 |
| `navigated-by-<name>` | 1,406 |
| `clicked-<name>` | 603 |
| `open`, an overlay's own box | 464 |
| `disabled` | 383 |
| `opened-by-<name>` | 370 |
| `populated-long` | 206 |
| `select-clicked` | 23 |

By kind, the two rows that matter are the ones still at zero or short:

| Kind | Captures | Source count |
| :---- | ----: | ----: |
| `button` | 7,219 | 138 `Button` usages plus native |
| `input-text` | 568 | 31 |
| `overlay` | 464 | - |
| `input-checkbox` | 316 | 18 |
| `tab` | 174 | - |
| `link` | 170 | - |
| `select` | 154 | 2 native, 54 via `Select` |
| `input-number` | 154 | 12 |
| `input-search` | 56 | - |
| `textarea` | 41 | 13 |
| `input-date` | 37 | 15 |
| `input-email` | 8 | - |
| `input-file` | 6 | 1 |
| `input-datetime-local` | **3** | **4** |
| `input-radio` | **0** | **5** |

**Every radio in the product, and one of the four `datetime-local` fields, remain uncaptured after 11,832 captures.** That is not a coverage accident, it is the harness being one level deep: all five radios live inside `CandidateMergeDialog`, `CandidateBulkActions` and the intake `ItemDrawer`, and the fourth datetime lives in `CandidateOutreachDialogs`. The sweep photographs an opened overlay whole and never tags the controls inside it. `overlay-interior.spec.ts` and `selection-states.spec.ts` close that, and until they have run this table is the honest statement of what pass 2 did and did not reach.

## The states each control has to be captured in

From the capture harness, which records each of these where the control supports it: `default`, `hover`, `focus-visible`, `disabled`, `populated-long` (a value long enough to overflow), plus `opened-by-<name>` for anything that opens an overlay, `navigated-by-<name>` for anything that leaves the screen, and `clicked-<name>` for a click that changes state in place.

Loading and error states are not reachable by clicking, so they are captured separately in pass 3 by driving the conditions: an empty search, a validation failure, and a slow response.
