# ACTIVE GOAL: Goal 5 — Execute the findings

Implement the verdicts from Goals 1 to 4 and workstream W's 22 remaining items. **Hosting is Goal 6, not this goal.**

**Order, and it matters.** Every item is named, because "workstreams W and X" is not an instruction.

1. **The rank 0 Level A cluster and V6 row 5.** Conformance failures that each take a few lines: the mouse-only sort header, the three `onClick`-on-a-`div` interactions, the twelve routes with no `document.title`, the radio group with no `name`, and the bulk-select header that renders empty at 3 of 20 selected and then selects all 20. **Row 5 ships first and alone**, because it is the only `Blocks` finding and a handful of lines.
2. **W8a, wiring what already exists.** Five items with no design decision, each a prop or a call the codebase already supports: the `error` prop at some of 149 call sites, `role="alert"` on the 45 unannounced messages, `busy` gating `Table`'s empty row plus the eleven sites that lack it, `useListLink` on the nine bare navigation paths, `useDocumentTitle` on the twelve routes that call nothing. **Cheapest visible progress in the workstream.**
3. **W1, the control height scale.** Precedes every component below it, because building the select, the checkbox or the date field first means building them to a height that then changes.
4. **W19 and W20, cleanup and reuse, including W18's dialog.** One dialog in `components/ui/` with focus entry, a Tab cycle, Escape and focus return, retiring the three module copies at 43, 40 and 39 lines; then lift the patterns that exist in one module and are missing from another. W20 is W19's cause, so they land together.
5. **W4 and W16, the glyphs and the keyboard contracts.** Checkbox and radio glyphs, `indeterminate`, `StarGrade`'s arrow keys, `ItemDrawer`'s missing `name`, the group labels, and the row-level accessible names.
6. **W2, the select and combobox.** The case Klent named, spec already written.
7. **Goal 3's verdicts, which is W10.** Removals, sections closed by default, and the density targets.
8. **Goal 4's designs, which are W15, W21, W22 and W8b.** The focus ring on three failing surfaces, the icon scale wired to the four unused tokens, the quieter text-input indicator, the loading affordance and the error summary.
9. **W3, W5, W6, W7, W8c, W13, W14, W17.** The date input, the file input, disclosure and the heading wrapper, focus and scrollbars, `TICK_MS`, the one horizontally-resizable textarea, the cursor on the controls that respond, and the unlabelled select.
10. **W9, the remaining task list**, and Goal 2's build list ordered by value over effort.

**Not in this goal:** W23, which is Goal 1's, and X1 to X12, which are Goal 6's.

**The bar for each change.**

- The two static gates and all five guard scripts pass: `npm run typecheck --workspace=app`, `npm run lint --workspace=app`, and `check-contrast`, `check-motion`, `check-comments`, `check-migrations`, `check-css-layers`.
- `bash scripts/gate.sh` run **5 to 10 times**, not once. Chase every intermittent failure to its cause; **a retry is never the answer**.
- **A component that did not make its task cheaper has not earned its commit.** Re-walk the six task costs in `Audit_V10-Visual-Review` and report the deltas: finding a candidate currently costs 4 page loads and 2 clicks; the validation task costs 31 keystrokes and returns two duplicated, unannounced messages.
- Re-capture the states the corpus holds and diff, so an intended change is visible and an unintended one fails.
- Commit each item separately, saying what changed **and what you got wrong**. Push to `develop`.

**Standing rules.** Verify in multiple passes and report what each found, including failures. **When you hit an error, fix it: think, read the code, search the web. Never skip an error, never work around one, and never take a simpler path because it happens to pass.** No comments in `.ts`, `.tsx`, `.js`, `.mjs`, `.css`; rationale goes in the commit message or `docs/`. Everything is the local stack at `127.0.0.1:55321`; **never write to production**, and the CI workflow stays disabled. If a measurement contradicts a finding, an earlier claim, or the plan, **the measurement wins and you correct the record**. Keep counts honest, never round up, and correct downward without being asked. Do not stop until the list is done.

**ON FINISHING THIS GOAL, RE-ARM THE REMINDER BEFORE STARTING THE NEXT ONE:** `bash scripts/arm-goal.sh 6` An armed goal that no longer matches the work is worse than none, because it reads as confirmation. If you notice the armed goal is stale, re-arm it before doing anything else.
