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

28 routes in total, which is what the capture harness enumerates in `tests/audit/routes.ts`.

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

## The states each control has to be captured in

From the capture harness, which records each of these where the control supports it: `default`, `hover`, `focus-visible`, `disabled`, `populated-long` (a value long enough to overflow), plus `opened-by-<name>` for anything that opens an overlay, `navigated-by-<name>` for anything that leaves the screen, and `clicked-<name>` for a click that changes state in place.

Loading and error states are not reachable by clicking, so they are captured separately in pass 3 by driving the conditions: an empty search, a validation failure, and a slow response.
