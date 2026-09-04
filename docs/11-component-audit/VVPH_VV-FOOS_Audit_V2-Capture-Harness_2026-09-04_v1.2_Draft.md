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

## The ten defects it had, and what each would have cost

Recorded because the harness is the instrument, and an instrument's error rate belongs in the report.

| # | Defect | What it would have produced |
| ----: | :---- | :---- |
| 1 | Measured `document.documentElement.scrollHeight` | Every screen reported as exactly 900px tall. The shell scrolls in `.shell-content`, so the document never grows |
| 2 | `fullPage: true` with an inner scroller | Every long screen captured down to the fold and no further, silently |
| 3 | Index-based locators reused after a click that navigates | 34 elements lost per area, reported as "would not scroll into view" |
| 4 | Overlay captured with `.last()` of a selector including always-present containers | **Every overlay element capture was of an unrelated node.** The one labelled `administration` showed the Recently Viewed panel |
| 5 | Programmatic `.focus()` | No focus ring on anything, which would have been written up as a global defect instead of finding the two real contrast failures |
| 6 | `aria-disabled` treated as disabled, and Playwright refusing to click it anyway | All **51** `PlaceholderAction` controls unclickable, so the placeholder pattern was never captured once |
| 7 | A **read implemented as a POST** aborted by the write guard | PostgREST exposes every RPC as a POST, so `rpc/get_my_google_status` was blocked. The Settings screen would have been captured with its Google card in a failure state the harness itself caused. Fixed before Settings was swept |
| 8 | **Accessible names computed in the wrong order**: `aria-label`, `title`, `placeholder`, `innerText`, never consulting `aria-labelledby` or `<label for>` | Produced two false findings, 61 apparently unlabelled controls and three selects apparently sharing a name, both of which are correctly labelled. Fixed in `measure.spec.ts`; left as-is in the sweep mid-run so the duplicate-name analysis stays comparable across areas |
| 9 | **The analysis step's path resolved from the wrong directory**, twice | `analyse.mjs` computed the corpus from `process.cwd()` while the chain `cd`s into `tests/`; and the orchestration script then invoked it as `tests/audit/analyse.mjs` from inside `tests/`, which does not exist, with the failure swallowed by a `&& echo`. Either one produces no V9 and no V13 while the chain reports success |
| 10 | **A supplementary pass overwrote the manifest of the area it was supplementing.** `flush()` writes `manifest.<area>.json` from scratch, and the focus-only pass ran with the same `FOOS_AUDIT_AREA` | Destroyed the record of what had been captured: recruit from **4,358 entries to 163**, dashboards to 206, shell to 56. The PNGs survived; the manifest that says what they are did not, and the V9 height distribution computed from them stopped being reproducible |

**Seven of the ten would have left a silent hole** rather than a visible failure, which is the kind that survives into a report. Three of them, 4, 5 and 8, would have produced confident wrong findings, and 8 actually did before it was caught. Defect 10 went further than any of them: it did not produce a wrong finding, it **destroyed the evidence for a right one**, and it did so while reporting success.

Defects 9 and 10 share a property none of the first eight has: **they damage the record rather than the capture.** A capture defect leaves a missing or wrong image, which the notes or the corpus eventually reveal. A record defect leaves the images intact and the index wrong, or absent, and nothing in the run complains. Both were found by reading, one before it fired and one four minutes after.

The fix for 10 is two lines: `AREA_TAG` now appends `-focus` or `-aria` when those modes are set, so a supplementary run can never write over a full one. The better fix was to delete the supplementary pass entirely, which is what happened, because the main sweep had already been fixed to capture verified `focus-visible` states and the extra pass existed only to backfill three areas swept before that fix. Re-sweeping those three in full gets the manifests and the focus captures in one step, and removes the step that caused the damage instead of repairing it.

Defect 9 is the other one worth dwelling on, because it is the only one the notes could never have caught. A capture defect shows up as a missing or wrong image. An **analysis** defect shows up as nothing at all: the script exits non-zero, the `&&` swallows it, the orchestrator prints `ALL PASSES DONE`, and V9 and V13 are simply never written. It was found by reading the chain end to end and asking what each step's working directory would be, which is the same way its predecessor was found. **Every step that transforms the corpus needs to fail loudly**, so the script now writes its output to a log and prints the line count of what it produced, or prints `ANALYSIS FAILED` and the last twenty lines.

The pattern in how the capture defects were caught is the other transferable part: **the harness's own notes contained the answer every time.** "vanished before its state capture" was defect 3, "would not accept a value" was a number input being filled with prose, "could not be captured: clipped area is empty" was defect 2's cousin, and "button Delete would not click" was defect 6. Reading the notes was faster than reasoning about the corpus, and none of the six was found by staring at a screenshot.

## What it does not do

- **Chromium only.** For a workstream whose claim is that the browser decides too much, that is a real limitation, stated in V6.
- **No hover-plus-focus combinations**, and no keyboard-driven traversal of a whole screen in one pass. It captures states per element, not sequences.
- **Loading and error states are out of reach**, because they are not a click away. Pass 3 drives those separately.
- **It cannot capture a native select's open list**, which is the finding rather than the limitation.
