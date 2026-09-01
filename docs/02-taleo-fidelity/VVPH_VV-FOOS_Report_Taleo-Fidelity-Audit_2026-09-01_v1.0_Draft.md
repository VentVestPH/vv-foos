# Taleo Fidelity Audit

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft · **Subject:** `foos_redesign_2` frontend, port 5175

This closes the gap the redesign delivery report declared open: "the prompt asks for the app to be visually checked against the references at a 2560 x 1600 viewport ... This sandbox can't do that." That check has now run. Chromium 1234 was installed, the dev server started, and all 20 routes were captured at 2560 x 1600 as a signed-in admin, then measured in the live DOM against the numeric targets in `VVPH_VV-FOOS_Prompt_Taleo-Exact-UI-Redesign_2026-07-25_v1.0_Draft.md`.

Method: measured values come from `getBoundingClientRect()` and `getComputedStyle()` in the running application, not from reading source. Contrast ratios are computed from the token values using the WCAG 2.x relative-luminance formula. Reference behaviour comes from the 26 screenshots and from `VVPH_VV-FOOS_Report_Taleo-ATS-Reverse-Engineering_2026-07-11_v1.0_Draft.md`.

## 1. Result summary

19 of 20 routes render with the Taleo shell, the correct Taleo page title grammar, no horizontal body scroll, and zero console errors. The replica is substantially correct. Thirteen deviations were found. Five are accessibility failures against a requirement the project set itself, three are missing Taleo affordances, and five are geometry or behaviour gaps.

F12 and F13 were added on 2026-09-01 after external research finished, and neither was visible to the measurement pass that produced F1 to F11. See `../04-research/VVPH_VV-FOOS_Report_External-Research-Findings_2026-09-01_v1.0_Draft.md`.

## 2. Route render check

| Route | h1 rendered | Shell | Body h-scroll | Console errors |
| :---- | :---- | :---- | :---- | :---- |
| `/` | My View: Demo Admin (Admin at VentVest) | Yes | No | 0 |
| `/?tab=pipeline` | Pipeline: Home | Yes | No | 0 |
| `/?tab=reports` | Run Report | Yes | No | 0 |
| `/recruit/requisitions` | Requisitions: Home | Yes | No | 0 |
| `/recruit/requisitions/new` | Requisitions: New Requisition | Yes | No | 0 |
| `/recruit/requisitions/:id` | Senior Data Engineer | Yes | No | 0 |
| `/recruit/candidates` | Candidates: Home | Yes | No | 0 |
| `/recruit/candidates/:id` | Priya Nair | Yes | No | 0 |
| `/sales/companies` | Accounts: Home | Yes | No | 0 |
| `/sales/contacts` | Contacts: Home | Yes | No | 0 |
| `/sales/deals` | Deals: Home | Yes | No | 0 |
| `/sales/tickets` | Tickets: Home | Yes | No | 0 |
| `/intake` | Intake: Home | Yes | No | 0 |
| `/intake/linkedin` | Intake: Paste LinkedIn URLs | Yes | No | 0 |
| `/intake/sheet` | Intake: Import a Sheet | Yes | No | 0 |
| `/settings` | Administration: Settings | Yes | No | 0 |
| `/employees` | Employees: Home | Yes | No | 0 |
| `/onboard` | Onboard/Offboard: Home | Yes | No | 0 |
| `/users` | Users: Home | Yes | No | 0 |
| `/courses` | Courses: Home | Yes | No | 0 |

`/intake` initially failed a `networkidle` wait at 25 seconds. It is not broken: with `domcontentloaded` it loads in 4.1 seconds with the correct title and rendered rows. Its Realtime subscription holds the connection open so `networkidle` never fires. This is a test-harness note, and the three Playwright specs in `tests/e2e/` should avoid `networkidle` on any route carrying a Realtime subscription.

## 3. Confirmed correct against spec

| Item | Spec target | Measured |
| :---- | :---- | :---- |
| Canvas background | `#eeeeee` | `rgb(238, 238, 238)` |
| Section header band | `--taleo-section` | `rgb(169, 198, 220)` |
| Font family | Roboto, Helvetica Neue, Arial | Matches exactly |
| Page title size | resolve around 25 to 28px, regular weight | 26px, weight 400 |
| Shadows on panels and controls | none | 0 elements with any box-shadow |
| Border radius | 0 to 3px | 0px, 2px, 3px only |
| Cell padding | dense | 10px |
| `Search:` label plus separate `Go!` button | required | Present on both list pages |
| Checkbox first column | required | Present on both list pages |
| Zebra rows | subtle | Present on both list pages |
| Requisition column order | Job Code, ID, Title, Candidates, Last updated, Location, Status, Requisition Owners, Next Steps | Exact match, with FOOS extras appended after |
| Candidate record section count | 15-section sequence | 15 section headers |
| Utility header composition | red wordmark, two-line treatment, four outline icons, Web Support, Administration, Help, red Logout | All present |
| Primary nav order | Taleo order with Intake after Candidates, Deals and Tickets after Contacts | Home, Pipeline, Requisitions, Candidates, Intake, Accounts, Contacts, Deals, Tickets, Employees, Onboard/Offboard, Users, Reports, Courses |
| Active tab treatment | light rectangle cut into the blue band, not a pill | Correct |

## 4. Deviations found

### F1. Four WCAG AA contrast failures (High)

Both the architecture document section 7 ("Verify contrast at WCAG AA") and the redesign prompt section 14 ("maintain adequate contrast while staying within the Taleo palette") require AA. Four token pairs currently in use fail. Ratios computed from the token values:

| Pair | Ratio | Required | Result |
| :---- | :---- | :---- | :---- |
| White text on primary nav band `#4b8dab` | 3.69:1 | 4.5:1 | **Fail** |
| White text on sidebar panel header `#5b7f9c` | 4.23:1 | 4.5:1 | **Fail** |
| White text on candidate-count green `#7fba36` | 2.34:1 | 4.5:1 | **Fail, worst** |
| `#d5d5d5` borders on white, for input and button boundaries | 1.47:1 | 3.0:1 | **Fail** |

The nav band failure affects every label in the primary navigation on every page. The count-badge failure at 2.34:1 is the most severe. Dark text on the same green reaches 6.80:1, so the badge is fixable without changing the green.

Passing pairs, for reference: link blue on white 5.04:1, body text on the section band 8.94:1, body text on the nested band 7.19:1, white on the Save button 4.61:1, white on Logout 5.44:1, danger red on white 5.53:1, secondary text on white 6.39:1, body text on zebra and hover rows both above 13:1.

The `#d5d5d5` border finding applies to WCAG 2.2 success criterion 1.4.11 non-text contrast, which governs the boundaries of interactive components such as inputs and buttons. Purely decorative table rules are out of scope for that criterion, so the fix is scoped to control borders, not every hairline.

### F2. Mini month calendar absent (Medium)

Redesign prompt section 8.1 requires a "mini month calendar on the right" in the My Calendar panel. Measured: no calendar grid element exists. Screenshot 01 shows the grid; the OCR of that screenshot confirms a December 2025 month grid with a day-of-week header row. The panel currently renders only a date line and "No events scheduled."

### F3. Calendar view icons absent (Medium)

Prompt section 8.1 requires "view icons for day, 7-day, 31-day, person, group, and agenda". Measured: zero such controls. Screenshots 02, 03, 04 and 05 exist solely to document these four calendar states, so this is 4 of the 26 references currently unused.

### F4. Utility header is 35% shorter than spec (Low)

Prompt section 5.1: "approximately 110 px tall at the reference 2560 x 1600 viewport". Measured: 72px. The primary nav adds 44px.

### F5. Sidebar is narrower than the reference (Medium)

Prompt section 5.3: "about 19% of the 2560 px viewport (approximately 480 px in the screenshots ... a practical CSS width around 300 to 380 px)". Measured: 300px, which is 11.7% of the viewport and the bottom of the permitted range. The reverse-engineering report measures Taleo's rail at approximately 380px. At a wide viewport the rail reads too thin against the reference.

### F6. Home page leaves 47% of the viewport empty (Medium)

Measured content bottom on `/` is 844px inside a 1600px viewport. Taleo's home fills the screen because the month grid and populated panels occupy it. This is the single most visible departure from "feels like Taleo", and F2 and F3 are its main cause.

### F7. No repeated action bar or pager at the bottom of list pages (Medium)

Prompt section 7.3: "repeat the action bar/pager at the bottom of long list and record pages where the screenshots do." The reverse-engineering report states plainly: "The action bar and pager repeat below the table." Measured: zero bottom action bars on either list page. The candidate list renders 83 rows with no bottom bar, which is exactly the case Taleo repeats it for.

### F8. Candidate list has no pagination at all (Medium)

The requisition list renders the pager in the correct Taleo format, measured as `1-3 of 3`. The candidate list has no pager and renders all 83 rows in one pass. Taleo paginates at 20 per page and displays `1-20 of 677`. Beyond fidelity this is a growth problem: the list is now backed by 83 real candidate profiles and will render unbounded rows as the pool grows.

### F9. Flag column is in the wrong position (Low)

Prompt section 8.3 specifies the candidate table order as checkbox, flag, Name, Last updated, Resume, Location, Source, Initial Date, grade, grade comment, Main status, Requisitions. Measured header order places `Flags` last, after `Sourcer`. Every other column is in the specified order.

### F10. Two governing documents contradict each other on long-text handling (needs a decision)

Architecture section 7, locked at Gate 1: "Tables cap long text with expand-on-click." Redesign prompt section 7.4: "full wrapping for long grade/status notes." These cannot both hold. Measured candidate row height is 69px against 55px on the requisition list, indicating wrapping is currently winning.

This is not a bug, it is an unresolved decision, and John's 2026-09-01 direction ("keep the layout clean ... focus on essential information ... minimise clicking") points toward capping. The reverse-engineering report also lists Taleo's full wrapping as a defect, not a feature: "Long text (recruiter grading notes) wraps fully in-cell, which makes rows very tall, a real readability cost visible on the candidate list."

External benchmark, added after research: IBM Carbon defines exactly five row-density sizes, 24, 32, 40, 48 and 64px, with 64px reserved for two-line content. The candidate list at 69px exceeds Carbon's largest size entirely; the requisition list at 55px sits between the two largest. Capping grade comments at two lines lands the candidate row near 64px, which is what Carbon reserves that size for. This gives the decision a defensible target rather than a preference.

### F11. Token values drift from the prompt's stated targets (Low, likely intentional)

`tokens.css` states its values were "calibrated against the screenshots", which the prompt's source hierarchy permits, since the screenshots outrank the prompt's starting values. Recording the drift so it is a decision rather than an accident:

| Token | Prompt value | Current value |
| :---- | :---- | :---- |
| `--taleo-sidebar-header` | `#4b8dab` | `#5b7f9c` |
| `--taleo-section` | `#99c9dc` | `#a9c6dc` |
| `--taleo-link` | `#0785cc` | `#1b6fc9` |
| `--taleo-logout` | `#d9534f` | `#c0392b` |

Note that the prompt's own `--taleo-link` of `#0785cc` yields 3.29:1 on white and would fail AA, so the current `#1b6fc9` at 5.04:1 is an improvement, not a regression.

### F12. Sticky action bar risks WCAG SC 2.4.11 with no mitigation present (High)

Found by external research after the measurement pass, then confirmed in the code. W3C WCAG 2.2 Technique F110 is titled "Failure of Success Criterion 2.4.11 Focus Not Obscured (Minimum) due to a sticky footer or header completely hiding focused elements". Its Example 2 is a sticky header obscuring the focused element as the user tabs *up* the page, and the test procedure requires tabbing in both directions.

`app/src/styles/app.css` contains two `position: sticky` rules and the file contains no `scroll-padding` or `scroll-margin` anywhere:

| Rule | Declaration | Risk |
| :---- | :---- | :---- |
| `.record-action-bar` | `position: sticky; top: 0; z-index: 10` | **Real.** Record pages carry up to 15 accordion sections below this bar. Tabbing upward from a lower section is F110 Example 2 exactly |
| `.table th` | `position: sticky; top: 0` | Low. A header row is unlikely to completely cover a focused element, and rows are not focusable here |

The AA threshold is *complete* coverage of the focused element; partial overlap fails only AAA 2.4.12. The named sufficient technique is `scroll-padding-top` sized to the sticky bar.

The internal audit missed this because it measured whether a focus ring is visible, which it is, and not whether a sticky element obscures the focused element after the browser scrolls to it. Those are different tests.

### F13. Back To List discards list state, against documented Taleo behaviour (Medium)

The Taleo Business Edition 11.4 User Guide states the behaviour explicitly, and this is one of the few Taleo specifics that survived verification 3-0:

> "if the last list page you viewed was the third page in a list of Candidates, clicking Back To List on any candidate details page returns you to that page of the Candidates list"

FOOS implements it as a bare navigation with no state:

```tsx
onClick={() => navigate('/recruit/candidates')}
```

So filters, saved view, sort order and page position are all discarded on return. Both the candidate and requisition record pages do this. A `FOOS-TBD` comment beside it also records that no previous or next paging within the current list view exists, which is the related Taleo affordance.

This matters more than most fidelity gaps because it is documented Oracle behaviour rather than an inference from screenshots, and because losing a filtered view on every drill-down is the kind of friction that shows up in daily use.

## 5. Accessibility findings beyond contrast

Semantics are in good shape and require no work:

| Check | Home | Requisition list | Candidate record |
| :---- | :---- | :---- | :---- |
| Landmarks (nav, main, header) | 1 each | 1 each | 1 each |
| Single h1 | Yes | Yes | Yes |
| Section headers that are real buttons | 6 of 6 | n/a | 15 of 15 |
| `aria-expanded` present | 8 | 2 | 17 |
| Accordion keyboard reachable | Yes, via button element | n/a | Yes, via button element |
| Icon buttons with accessible names | 9 of 9 | 8 of 8 | 8 of 8 |
| Inputs with labels | 4 of 4 | 28 of 28 | 22 of 22 |
| Clickable non-button elements | 0 | 0 | 0 |
| Visible focus ring | `outline: auto 1px rgb(0,95,204)` | same | same |

Two recommended, non-blocking improvements: data tables carry `<th>` but no `scope` attribute (0 of 1 tables) and no `<caption>`.

External research confirms this framing and sharpens it. Table-structure failures anchor at WCAG SC 1.3.1 Info and Relationships, **Level A**, and since AA conformance requires satisfying every Level A criterion, a genuine structural failure does block AA. But the specific markup prescriptions were refuted 0-3: `<th>` versus `<td>`, and explicit `scope="col"` or `scope="row"`, are *sufficient techniques* (H51, H63, H39), not requirements. Only an actual loss of programmatically determinable structure fails 1.3.1. FOOS carries `<th>`, so structure is exposed. Adding `scope` and captions remains good practice and is not a conformance obligation here.

One further point recorded so it is not "fixed" incorrectly later: the ARIA Authoring Practices Guide says to "avoid using the region role ... in an accordion that contains more than approximately 6 panels that can be expanded at the same time". The candidate record has 15. FOOS has no `role="region"` anywhere, which is already correct. Do not add it.

## 6. Placeholder inventory

41 `FOOS-TBD` markers across 14 files, all routed through the single `TaleoPlaceholder` modal as the prompt requires. Call-site density by file:

| File | Call sites |
| :---- | :---- |
| `pages/DashboardPage.tsx` | 18 |
| `pages/TaleoModulePlaceholderPage.tsx` | 14 |
| `modules/recruit/candidates/CandidateListPage.tsx` | 11 |
| `shell/TaleoUtilityHeader.tsx` | 8 |
| `modules/recruit/requisitions/RequisitionRecordPage.tsx` | 8 |
| `modules/recruit/candidates/CandidateRecordPage.tsx` | 8 |
| `shell/TaleoPlaceholder.tsx` | 7 |
| `modules/recruit/requisitions/RequisitionListPage.tsx` | 5 |
| `shell/TaleoSidebar.tsx`, `modules/settings/SettingsPage.tsx`, `modules/intake/QueueListPage.tsx` | 4 each |
| `modules/sales/pages/ContactsListPage.tsx`, `CompaniesListPage.tsx` | 3 each |
| `modules/sales/pages/TicketsListPage.tsx`, `DealsListPage.tsx`, `modules/recruit/requisitions/RequisitionFormPage.tsx` | 2 each |

No placeholder mutates data, shows a false success state, or navigates to a dead route. The centralisation requirement is met.

## 7. Artefacts

20 full-page screenshots at 2560 x 1600 are in the session scratchpad at `shots/`. They are transient. If they should be kept as a fidelity baseline, they need copying into the repository or Drive, which is a decision for John since they contain real candidate names drawn from the live database.
