
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
| 5 Execute the findings | **IN PROGRESS** |
| 6 Hosting, X1 to X12 | **NOT STARTED** |

**Never skip an issue, an error, or a failure.** When anything fails: read the code, form a hypothesis, test the hypothesis, fix the cause. Never retry and hope. Never route around it. Never pick a simpler path because it happens to pass. Never leave a failing check as "pre-existing" without first proving it is, and then fixing it anyway if it is in scope.

**A text reply to the user is not a checkpoint.** Report only what the user cannot get from the commits, keep it short, and continue working in the same turn. If a long job is running, do work the job does not own rather than waiting on it.

**Never edit `app/src` while `gate.sh` is running.** Vite HMR delivers a partial update, the suite loads a page mid-swap, and the app throws for real. It cost 16 `client_errors` rows reading `StubPanel is not defined` on every route, with `origin` of `window.error`, from adding one new component file mid-run. A `FAIL attachments` on `client_errors row(s) present` is the symptom. Either wait for the gate, or do documentation and database work while it runs, never source.

**Restart the dev server before a verification run if it has been up for days.** The one in this session had been up 2 days 22 hours; a long-lived Vite graph is its own risk, and `reuseExistingServer: true` means the gate inherits it.

**Three mistakes already made more than once in this engagement. Do not repeat any of them.**

1. **Never `pkill` a running Playwright suite.** Teardown does not run and fixtures leak, which fails `validate.sql` on `FAIL 9: people count`. Let the gate finish, or clean up deliberately afterwards.
2. **Never read a stale artefact as a current measurement.** `audit/corpus/notes.*.txt` and `manifest.*.json` are per-area and persist across runs. Check the file's date before believing it.
3. **Never change the tree a verification run is measuring.** Editing `app/src` mid-gate, or restarting the dev server mid-suite, invalidates the run and can inject real runtime errors. Finish, then change.

**Run scripts the way the gate runs them.** `validate.sql` under `psql "$DATABASE_URL"`, not `docker exec -U supabase_admin`; the latter invents failures. Never read an exit code through a pipe: `cmd | tail` reports `tail`'s status.
