# ACTIVE GOAL: Goal 5 — Execute the findings

Implement the verdicts from Goals 1 to 4, together with workstreams W and X, which are already specified.

**Order, and it matters.** First the **rank 0 Level A cluster** and **V6 row 5**, the audit's only `Blocks` finding, because they are conformance failures that each take a few lines: the mouse-only sort header, the three `onClick`-on-a-`div` interactions, the twelve routes with no `document.title`, the radio group with no `name`, and the bulk-select header that renders empty at 3 of 20 selected and then selects all 20. Then **W1**, the control height scale, because it touches every other component. Then Goal 2's build list, Goal 3's removals, Goal 4's motion, and W2's combobox.

**The bar for each change.**

- The two static gates and all five guard scripts pass: `npm run typecheck --workspace=app`, `npm run lint --workspace=app`, and `check-contrast`, `check-motion`, `check-comments`, `check-migrations`, `check-css-layers`.
- `bash scripts/gate.sh` run **5 to 10 times**, not once. Chase every intermittent failure to its cause; **a retry is never the answer**.
- **A component that did not make its task cheaper has not earned its commit.** Re-walk the six task costs in `Audit_V10-Visual-Review` and report the deltas: finding a candidate currently costs 4 page loads and 2 clicks; the validation task costs 31 keystrokes and returns two duplicated, unannounced messages.
- Re-capture the states the corpus holds and diff, so an intended change is visible and an unintended one fails.
- Commit each item separately, saying what changed **and what you got wrong**. Push to `develop`.

**Standing rules.** Verify in multiple passes and report what each found, including failures. **When you hit an error, fix it: think, read the code, search the web. Never skip an error, never work around one, and never take a simpler path because it happens to pass.** No comments in `.ts`, `.tsx`, `.js`, `.mjs`, `.css`; rationale goes in the commit message or `docs/`. Everything is the local stack at `127.0.0.1:55321`; **never write to production**, and the CI workflow stays disabled. If a measurement contradicts a finding, an earlier claim, or the plan, **the measurement wins and you correct the record**. Keep counts honest, never round up, and correct downward without being asked. Do not stop until the list is done.
