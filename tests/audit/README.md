# `tests/audit/` — what each spec is, and which ones are obsolete

These run on `playwright.audit.config.ts`, **not** on `playwright.config.ts`, so `scripts/gate.sh` never runs any of them. That is deliberate for the slow sweeps and a **defect** for the contract checks, which is recorded per row below.

Measured 2026-09-08: **24 spec files, 26 tests.** Two of those are the Goal 8 capture harness, added the same day:

| Spec | What it does | Reads |
| :---- | :---- | :---- |
| `visual-sweep.spec.ts` | one role per run (`SWEEP_ROLE`), every route from `routes.ts` at full height plus one image per viewport fold, every accordion, combobox, tab and in-content button acted on, shell chrome pressed once per role, one JSON report per route | `sweep-lib.ts` |
| `visual-states.spec.ts` | the states a signed-in sweep cannot reach: `/login` and its error and pending states, the unauthenticated deep-link redirect for five protected routes, the auth gate while the staff query is in flight, the not-provisioned hold card, five route transitions sampled at 0/150/400/800ms, cold reload at five marks, the 404 and the placeholder overlay | `sweep-lib.ts` |

`sweep-lib.ts` is where the correctness lives, not the specs: `settledState` re-reads until two consecutive readings agree with nothing mid-exit, `readState` returns overlay kind, page fingerprint and mid-exit count from a single `page.evaluate` so the two can never disagree, `pressAndRecord` reports a swallowed click as `NOT CLICKABLE, <error>` rather than as a dead control, and every press is returned to a per-route baseline fingerprint before the next one. `analyse-findings.mjs` turns the JSON reports into `audit/2026-09-08/findings/MEASURED.md` and hashes every image, because byte-identical captures are how an instrument fault announces itself.

## The seven that fed the deleted corpus

`audit/corpus/` was deleted on 2026-09-08 because none of its 25,231 images was a whole page. These seven imported `capture.ts` and wrote into it, so **their output no longer exists**. They still run, and they still write, but into a folder nothing reads.

| Spec | What it captured | Status |
| :---- | :---- | :---- |
| `sweep.spec.ts` | the 31-route × 2-viewport sweep, viewport-only | **Superseded** by `visual-sweep.spec.ts`. Do not extend |
| `role-matrix.spec.ts` | per-role route matrix, explicitly `fullPage: false` | **Superseded.** Its role-and-route loop is the useful part and the new spec takes that shape |
| `pass3-use.spec.ts` | task-cost walkthroughs, explicitly `fullPage: false` | **Superseded** for capture. Its six task-cost measurements are still the V10 baseline and are worth keeping as measurement |
| `measure.spec.ts` | the V13 density measurements | **Keep as measurement.** V13 records this as "queued"; it was never finished, and Goal 9's spacing pass needs exactly these numbers |
| `overlay-interior.spec.ts` | overlay interiors, clipped | **Superseded.** The new spec captures overlays at full page plus clipped |
| `selection-states.spec.ts` | table selection states | **Superseded** as capture; the state enumeration is reusable |
| `unauthenticated.spec.ts` | the only spec that ever visited `/login` | **Superseded 2026-09-08** by `visual-states.spec.ts`, which captures `/login` at full height with its folds plus the pending, empty-submit and rejected-credential states. This file still writes clipped element shots into the deleted corpus path |

## The fifteen contract checks

These assert something and fail when it breaks. **None of them clipped screenshots**, so none is affected by the corpus deletion.

| Spec | Asserts | Note |
| :---- | :---- | :---- |
| `control-heights.spec.ts` | every control on the 24/32 scale | **Now redundant against the gate.** `scripts/check-control-heights.mjs` is the guard V9.5 asked for and it *is* in the gate; this spec is the browser cross-check, and its selector had gone stale until 2026-09-08 |
| `icon-scale.spec.ts` | 3 tests, icon sizes on the token scale | `check-icons.mjs` covers this statically in the gate |
| `focus-ring-contrast.spec.ts` | the ring meets 1.4.11 on every ground | Candidate to move into `tests/e2e/` |
| `document-titles.spec.ts` | every route sets `document.title` | Candidate to move into `tests/e2e/` |
| `dialog-focus.spec.ts` | dialogs trap and restore focus | Candidate to move into `tests/e2e/` |
| `level-a-keyboard.spec.ts` | the Level A keyboard cluster | Candidate to move into `tests/e2e/` |
| `kanban-keyboard.spec.ts` | space-grab, arrow-move, escape-cancel | **A copy already runs in the gate** as `tests/e2e/kanban-keyboard.spec.ts` |
| `inline-input-keys.spec.ts` | inline inputs do not eat their parent's keys | Candidate to move into `tests/e2e/` |
| `row-names.spec.ts` | row-level controls carry their row's identity | Candidate to move into `tests/e2e/` |
| `placeholder-cursor.spec.ts` | `aria-disabled` controls that respond show a pointer | Candidate to move into `tests/e2e/` |
| `textarea-resize.spec.ts` | textareas resize vertically only | Candidate to move into `tests/e2e/` |
| `select-all-probe.spec.ts` | the bulk-select header at a partial selection | This is V6 row 5, the only `Blocks` finding V raised |
| `pipeline-dead-controls.spec.ts` | 2 tests, pipeline controls that look live and are not | Feeds Goal 9's dead-control pass |
| `candidate-record-400s.spec.ts` | the candidate record issues no 400s | Candidate to move into `tests/e2e/` |
| `dashboard-funnel-zero.spec.ts` | the Pipeline dashboard is not zero over real data | This is G1-4, a `Blocks` defect workstream V never saw |

## The rule going forward

- **A contract check belongs in `tests/e2e/` so the gate runs it.** Ten of the fifteen above are marked as candidates and none has moved yet; that is tracked work, not a claim.
- **A capture sweep belongs here**, because it is slow and its output is for a person to read, not for an assertion to pass.
- **`capture.ts` is frozen.** The new harness is `visual-sweep.spec.ts` with its own helpers, so the clipped-and-viewport-only method and the full-height cadence can never be confused. Do not add to `capture.ts`.
