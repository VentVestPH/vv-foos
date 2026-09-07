
---

## STANDING ORDER, APPENDED TO EVERY GOAL. READ THIS EVERY TIME.

# DO NOT END THE TURN. DO NOT WRITE A REPORT. KEEP CALLING TOOLS.

**The single most repeated correction in this engagement, three times in one session: STOP STOPPING.** Klent, verbatim: "stop stopping man", "why do you keep stopping", "THEN WHY ARE YOU STOPPING. I TOLD YOU THREE TIMES NOW."

**Ending a turn with a text reply IS stopping.** It does not matter that the text is accurate, short, or a progress update. It does not matter that a gate is running. It does not matter that a goal just finished. **A turn ends only when all six goals are complete.**

The rule in mechanical terms:

- After a commit: **do not write prose.** Start the next item with a tool call.
- After a goal: **do not write prose.** Run `bash scripts/arm-goal.sh <next>` and begin.
- While a gate runs: **do not write prose.** Do documentation or database work in the same turn.
- Asked "how is it going": answer in **two sentences at most**, inside a turn that continues working, and never as the last thing in the turn.
- Never ask whether to proceed. Never offer a choice. Decide, state the decision in one line inside continuing work, and proceed.

**The work ends when all six goals are complete**, not when the current one is. On finishing a goal: re-arm the next one and start it in the same turn.

**Goal completion ledger. Keep this current; it is the only place that says what is left.**

| Goal | State |
| :---- | :---- |
| 1 Functional coverage per page and role | **DONE** f9d8b72 |
| 2 Dead-control verdicts | **DONE** 69377c6 |
| 3 Information architecture | **DONE** e4a2b0e |
| 4 Motion and polish | **DONE** f004088 |
| 5 Execute the findings | **DONE** 4d5c401, the last of 18 commits, from 2fed123 |
| 6 Hosting, X1 to X12 | **AS FAR AS IT GOES** 425cf9e. The 8 items that are mine are prepared and verified; X2 rehearsed into a scratch database, X3/X4/X5/X9/X12 checked against a source. **Blocked on X1**, which only Klent can do, and on his 3 decisions: X8 what data goes up, X11 build on push, X12 which host |
| **W24**, the login flash | **DONE 2026-09-07.** `SessionProvider` holds a `staffResolvedFor` marker so `loading` covers the staff fetch. `tests/e2e/login-flash.spec.ts` proves it both ways: `holdCardRenders=0` with the fix, `1` without. Workstream W is now 23 of 23 |
| **After W24** | **DONE 2026-09-07.** QA-019, a race the W24 gate exposed, is fixed in two specs and the whole suite was swept for the same class: 2 of 9 reads of an asynchronously populated control were unanchored, both now anchored. QA-006's decoding gap is fixed with a 16-case unit test; its mojibake half stays open and needs one raw header from a live Gmail account |
| **W25**, one control height of 32px | **DONE 2026-09-07.** One `--control-h: 32px` replaces W1's four-token scale. Measured at `controlsMeasured=369 distinctHeights=1` across all 31 routes; guarded by `scripts/check-control-heights.mjs`, gate check 9 of 22, proven to fail on a broken tree. Its own gate found two races, QA-022, neither of them W25's doing, and both are fixed |
| **Still open, and none of it mine to close** | QA-003 and QA-008, both parked by Klent. QA-006's second half. Goal 6's X1, X8, X11 and X12. The plan reads **251 of 266** with 15 left: 12 in workstream X and 3 in the parked register, and nothing outside those two |

**Never skip an issue, an error, or a failure.** When anything fails: read the code, form a hypothesis, test the hypothesis, fix the cause. Never retry and hope. Never route around it. Never pick a simpler path because it happens to pass. Never leave a failing check as "pre-existing" without first proving it is, and then fixing it anyway if it is in scope.

**A text reply to the user is not a checkpoint.** Report only what the user cannot get from the commits, keep it short, and continue working in the same turn. If a long job is running, do work the job does not own rather than waiting on it.

**Never edit `app/src` while `gate.sh` is running.** Vite HMR delivers a partial update, the suite loads a page mid-swap, and the app throws for real. It cost 16 `client_errors` rows reading `StubPanel is not defined` on every route, with `origin` of `window.error`, from adding one new component file mid-run. A `FAIL attachments` on `client_errors row(s) present` is the symptom. Either wait for the gate, or do documentation and database work while it runs, never source.

**Restart the dev server before a verification run if it has been up for days.** The one in this session had been up 2 days 22 hours; a long-lived Vite graph is its own risk, and `reuseExistingServer: true` means the gate inherits it.

**Three mistakes already made more than once in this engagement. Do not repeat any of them.**

1. **Never `pkill` a running Playwright suite.** Teardown does not run and fixtures leak, which fails `validate.sql` on `FAIL 9: people count`. Let the gate finish, or clean up deliberately afterwards.
2. **Never read a stale artefact as a current measurement.** `audit/corpus/notes.*.txt` and `manifest.*.json` are per-area and persist across runs. Check the file's date before believing it.
3. **Never change the tree a verification run is measuring.** Editing `app/src` mid-gate, or restarting the dev server mid-suite, invalidates the run and can inject real runtime errors. Finish, then change.

**Run scripts the way the gate runs them.** `validate.sql` under `psql "$DATABASE_URL"`, not `docker exec -U supabase_admin`; the latter invents failures. Never read an exit code through a pipe: `cmd | tail` reports `tail`'s status.
