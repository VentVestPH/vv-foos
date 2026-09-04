# V2: the capture harness, and the six defects it had

The harness is `tests/audit/` with its own Playwright config, so `testDir: './e2e'` keeps it out of the gate. It captures every interactive element on every route in every state it supports, clicks everything that opens, and writes a manifest naming component, state and viewport.

## How it works

Per route, per viewport:

1. Navigate, settle, capture the screen.
2. Tag every interactive element with `data-audit="N"` in one `page.evaluate`, returning a descriptor per element: kind, accessible name, whether it is disabled natively or by ARIA, whether it accepts text, whether it opens something, and its box.
3. For each element: `default` or `disabled`, `hover`, a **verified** `focus-visible`, and `populated-long` for anything typeable.
4. For each opener: re-navigate, re-tag, click, and capture whatever appeared, distinguishing an overlay from a navigation from an in-place change.
5. Flush the manifest after every route, so a run that dies mid-area leaves usable data.

**Every non-GET request to `/rest/v1/` and `/functions/v1/` is aborted**, so the harness can click every button in the product without writing anything. What each blocked click attempted is logged.

## The six defects it had, and what each would have cost

Recorded because the harness is the instrument, and an instrument's error rate belongs in the report.

| # | Defect | What it would have produced |
| ----: | :---- | :---- |
| 1 | Measured `document.documentElement.scrollHeight` | Every screen reported as exactly 900px tall. The shell scrolls in `.shell-content`, so the document never grows |
| 2 | `fullPage: true` with an inner scroller | Every long screen captured down to the fold and no further, silently |
| 3 | Index-based locators reused after a click that navigates | 34 elements lost per area, reported as "would not scroll into view" |
| 4 | Overlay captured with `.last()` of a selector including always-present containers | **Every overlay element capture was of an unrelated node.** The one labelled `administration` showed the Recently Viewed panel |
| 5 | Programmatic `.focus()` | No focus ring on anything, which would have been written up as a global defect instead of finding the four real contrast failures |
| 6 | `aria-disabled` treated as disabled, and Playwright refusing to click it anyway | All **51** `PlaceholderAction` controls unclickable, so the placeholder pattern was never captured once |

Four of the six would have left a **silent hole** rather than a visible failure, which is the kind that survives into a report. Two of them, 4 and 5, would have produced confident wrong findings.

The pattern in how each was caught is the transferable part: **the harness's own notes contained the answer every time.** "vanished before its state capture" was defect 3, "would not accept a value" was a number input being filled with prose, "could not be captured: clipped area is empty" was defect 2's cousin, and "button Delete would not click" was defect 6. Reading the notes was faster than reasoning about the corpus, and none of the six was found by staring at a screenshot.

## What it does not do

- **Chromium only.** For a workstream whose claim is that the browser decides too much, that is a real limitation, stated in V6.
- **No hover-plus-focus combinations**, and no keyboard-driven traversal of a whole screen in one pass. It captures states per element, not sequences.
- **Loading and error states are out of reach**, because they are not a click away. Pass 3 drives those separately.
- **It cannot capture a native select's open list**, which is the finding rather than the limitation.
