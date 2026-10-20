# Audit harness

Slow, exploratory sweeps and measurements. They run on `config/playwright.audit.config.ts` (`npm run audit`), never in the gate, and their output is for a person to read. Output goes to `.artifacts/audit/<date>/`, which git ignores because the images render real candidate names.

A check that asserts something and should fail when it breaks does not belong here. It belongs in `e2e/<area>/`, so the gate runs it.

| File | Purpose |
| :---- | :---- |
| `visual-sweep.spec.ts` | One role per run (`SWEEP_ROLE`, narrowable with `SWEEP_ONLY`): every route in `support/routes.ts` at full height with one image per viewport fold, every accordion, combobox, tab and in-content button acted on, shell chrome pressed once per role, one JSON report per route |
| `visual-states.spec.ts` | The states a signed-in sweep cannot reach: `/login` and its error and pending states, the unauthenticated deep-link redirect, the auth gate while the staff query is in flight, the not-provisioned hold card, route transitions sampled over time, cold reloads, the 404 and the placeholder overlay |
| `tall-pages.spec.ts`, `measure-gaps.spec.ts` | Page height and section-gap measurements |
| `measure.spec.ts`, `pass3-use.spec.ts` | The density and task-cost baselines |
| `sweep-lib.ts` | The correctness of the sweeps: `settledState` re-reads until two consecutive readings agree, `readState` returns overlay kind, page fingerprint and mid-exit count from one `page.evaluate`, `pressAndRecord` reports a swallowed click as `NOT CLICKABLE` instead of a dead control, and every press returns to a per-route baseline before the next |
| `capture.ts` | `guardWrites`, which aborts every non-read request during a sweep, plus `settle` |
| `analyse-findings.mjs`, `review-manifest.mjs` | Turn the JSON reports into `MEASURED.md` and the review manifest, and hash every image: byte-identical captures are how an instrument fault shows itself |
