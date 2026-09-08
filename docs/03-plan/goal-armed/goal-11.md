# ACTIVE GOAL: Goal 11 — Resolve every finding Goal 9 wrote down

**Klent, 2026-09-08:** "what i want is the best results and quality of the findings, so that we can resolve all of these findings in a separate goal."

This is that separate goal. It reads `audit/2026-09-08/findings/` and closes it. **Nothing is deferred without Klent saying so**, which is the lesson of Goal 2 rating 43 controls `Defer` and Goal 10 having to undo that for the gears.

## Order of work

1. **Everything rated `Ugly` first**, worst first, because that is the list Klent recognised his own complaint in.
2. **Then `Wrong`**, which breaks a rule the codebase already states, so the fix is not a judgement call.
3. **Then `Improvement`**, which is where a proposal can legitimately be declined, and a decline is one sentence of reasoning rather than silence.

## The rules for each fix

- **Fix the cause, not the instance.** If eleven pages have the same misaligned icon row, the fix is one rule in one layer, not eleven patches. Report the ratio: findings closed against edits made. A high ratio means the cause was found.
- **A token, not a value.** Nothing gets a hard-coded pixel or colour. If no token fits, add one to `tokens.css` and say why in the commit.
- **The right cascade layer.** Layer order decides across layers and specificity does not, so a conflict is fixed by moving a rule to the correct layer rather than by adding a class. `node scripts/check-css-layers.mjs` fails the build on an unlayered rule.
- **Taleo still governs.** A change that diverges from the replica needs a stated reason, not a preference. Density with clarity, never more air.
- **Each closed finding gets its assertion**, in the gate where the gate can hold it, so a fix cannot silently regress. Where a static guard is possible, prefer it over a browser test: `check-control-heights.mjs` catches what a route sweep missed for weeks.
- **Re-capture and diff.** After the batch, re-run Goal 8's harness into `audit/2026-09-09/` and compare against `2026-09-08/`, so an intended change is visible and an unintended one is caught. This is the check Goal 5 skipped.

## Standing rules

- **An error stops the goal until its cause is fixed.** Not skipped, not worked around, not retried and hoped past. Read the code, form a hypothesis, test it, fix the cause.
- **Internet and parallel agents both allowed**, never nested, each agent with a narrow brief and a report format.
- `bash scripts/gate.sh` **5 times**, 22 of 22 each, and every intermittent failure chased to its cause. A retry is never the answer.
- No comments in `.ts`, `.tsx`, `.js`, `.mjs`, `.css`. Rationale in the commit message.
- Local stack only. **Never write to production.**
- Counts honest, never rounded up, corrected downward without being asked.

## The bar

- **Every finding has a disposition**: fixed, declined with a reason, or escalated to Klent as a decision. **None may be silently dropped**, and the count of each is reported.
- `findings/UGLY.md` is re-read at the end and every entry marked closed or open with its reason.
- **No commit until Klent has reviewed.** He said: "do not commit, as i apparenlty need to make sure you're doing the right thing."

**ON FINISHING: `bash scripts/arm-goal.sh off`, since this is the last of the set.**
