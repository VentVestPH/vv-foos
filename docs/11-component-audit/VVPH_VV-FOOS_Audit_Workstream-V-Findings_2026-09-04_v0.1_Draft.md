# VV-FOOS Workstream V: component and usability audit, findings

Status: in progress. Started 2026-09-04. Pass 1 of 6 complete.

Audit and specification only. Workstream W builds from this; nothing here changes a component.

The screenshot corpus lives in `audit/corpus/` and is **gitignored**, because the screens render real candidate names from the Zoho migration. `audit/corpus/manifest-pass1.json` names every capture.

## The six passes

| Pass | Question | Status |
| :---- | :---- | :---- |
| 1 Breadth | what exists and where, nothing opened | **done 2026-09-04** |
| 2 States | every control in every state | not started |
| 3 Use | the real tasks, walked as their user | not started |
| 4 References | judged against cited published sources | not started |
| 5 Measurement | heights, spacing, density, in numbers | not started |
| 6 Reconciliation | what the first five missed | not started |

## Pass 1: breadth

28 routes captured at 1440x900 and 390x844, **56 screenshots**, no route rendering an error boundary and no page error on any of them.

### Two defects in the harness, found before any finding was trusted

The first run reported every screen as exactly 900px tall, one viewport, which is the kind of uniform result that is always an instrument fault rather than a discovery. The shell scrolls in `.shell-content`, which is `flex: 1; overflow: auto`, so the document itself never grows and `document.documentElement.scrollHeight` is always the window height. Two consequences, both silent:

1. **The height metric measured nothing.** It now measures `.shell-content`'s `scrollHeight` against its `clientHeight`.
2. **`fullPage: true` captured only the visible viewport.** Playwright's full-page capture expands the document, and here the document was never the thing that overflowed, so every screenshot stopped at the fold and the corpus was missing most of every long screen. The harness now expands `.shell-content` and its ancestors before capturing, so a capture holds the whole screen.

Worth stating plainly because the same trap applies to anything measuring this app: the page is not the scroller.

### Page height, desktop, measured after the fix

| Screen | Content height | Viewports tall |
| :---- | ----: | ----: |
| Candidate record | **7,304px** | **9.71** |
| Deal record | 3,498px | 4.65 |
| Requisition record | 3,333px | 4.43 |
| Requisition list | 2,172px | 2.89 |
| Candidate list | 2,058px | 2.74 |
| Contacts list | 1,674px | 2.23 |
| Companies list | 1,572px | 2.09 |
| Settings | 1,396px | 1.86 |
| Requisition new | 1,369px | 1.82 |
| Requisition edit | 1,369px | 1.82 |

This is the measured form of "ugly designs with huge spaces". The candidate record is nearly ten screens of scrolling for one person's record. It is also the same screen section 7.13 of the improvement plan already measured at 5,979px in a 572px window; the figure has grown because the record now carries migrated attachments and activity, which is the point: the screen was designed against seed data and the real data is larger.

Nothing here is a fix yet. Pass 5 measures where the space goes, and V13 sets a target height per screen.

### Routes covered

28: three dashboard tabs, global search, four recruit screens plus two record and one edit, nine sales screens, two intake, settings, and the four Taleo placeholder mounts. The full list with paths and ids is `tests/audit/routes.ts`.

## Open questions carried into pass 2

- Settings declares no child routes and renders as one page of cards, so its states are card-level rather than route-level.
- The four placeholder mounts (`/employees`, `/onboard`, `/users`, `/courses`) render `TaleoModulePlaceholderPage`. They are in the corpus for completeness; whether they belong in the component audit at all is a question for pass 6.
- `sales-promote` and the `new` forms are the only screens with no list behind them, so their empty and error states need deliberate setup in pass 2 rather than a navigation.
