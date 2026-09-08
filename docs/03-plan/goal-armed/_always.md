
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
| 6 Hosting, X1 to X12 | **RUNS LAST**, Klent's call 2026-09-08, after goals 7 to 11. **X1 answered: use the existing project** `mebfbbvrqdctamnzvbbs`, which is the live one, so X2 becomes a 36-migration production write against a broken ledger and O6's backup deferral is void. Prepared at 425cf9e; blocked on X8, X11, X12 and a written go-ahead |
| **W24**, the login flash | **DONE 2026-09-07.** `SessionProvider` holds a `staffResolvedFor` marker so `loading` covers the staff fetch. `tests/e2e/login-flash.spec.ts` proves it both ways: `holdCardRenders=0` with the fix, `1` without. Workstream W is now 23 of 23 |
| **After W24** | **DONE 2026-09-07.** QA-019, a race the W24 gate exposed, is fixed in two specs and the whole suite was swept for the same class: 2 of 9 reads of an asynchronously populated control were unanchored, both now anchored. QA-006's decoding gap is fixed with a 16-case unit test; its mojibake half stays open and needs one raw header from a live Gmail account |
| **W25**, one control height of 32px | **DONE 2026-09-07.** One `--control-h: 32px` replaces W1's four-token scale. Measured at `controlsMeasured=369 distinctHeights=1` across all 31 routes; guarded by `scripts/check-control-heights.mjs`, gate check 9 of 22, proven to fail on a broken tree. Its own gate found two races, QA-022, neither of them W25's doing, and both are fixed |
| **7** Names, deletions, a navigable dated folder | **DONE 2026-09-08.** `audit/corpus` (628 MB, 25,231 images, not one a whole page) and `discovery` deleted, **651 MB freed**; `dist-redesign-2` renamed to `dist`; `audit/2026-09-08/` created with `.gitignore` widened from `audit/corpus/` to `audit/*/` **before** the first capture, verified by `git check-ignore -v` |
| **8** Photograph it as a person uses it | **DONE 2026-09-08.** 44 state images plus **104 tall images**, one per page per role, after three capture methods failed. Method that worked: grow the browser window until nothing is hidden, expand every shut `.record-section-header` first, touch no CSS. Heights 932px to 4,228px, **104 of 104 over 900px**, 0 `TALLWARN`, 0 accordions left shut. The earlier 1,813-image per-fold set was **deleted on Klent's instruction** after he saw the reading cost. Three harness defects and two product defects fell out: 17 false dead controls per page from a swallowed click error (admin shell 17 to 1, dashboard 17 to 0); QA-025, the harness wrote 9 rows over 5 real records, repaired from the bulk export and `seed.sql`, harness now read-only; QA-023 Critical, the second overlay of a session was undismissable behind an invisible click-eating backdrop; QA-024, the utility menus ignored Escape, and its **first fix was a regression** that broke two gated specs. **Four gate passes still owed**; 3 of 4 green in the last run, the failure being QA-026 |
| **9** Open the screenshots and say what is ugly | **DONE 2026-09-08.** **104 of 104 tall images read**, grouped by role on Klent's instruction: admin 31, recruiter 30, sourcer 19, bd 24. **144 findings**: `UGLY.md` U1-U116 (34 `Ugly`, 38 `Wrong`, 44 `Improvement`), `bd.md` B1-B8, `sourcer.md` S1-S6, `recruiter.md` R1-R2, `CARRIED-IN.md` C1-C9, indexed in `findings/INDEX.md`. The role passes **corrected ten findings** written against the admin baseline: U17/U18/U19/U21 are import artefacts not renderer faults, U26+U48 collapse into B3, U81+U105+U110 collapse into B4, U86 is four duplications not two, U97 is an empty state with a developer note not an API error, U115 had the sourcer and recruiter cases the wrong way round, and C8's user-visible-error half is unsupported by any image. Two of the five worst were replaced |
| **10** Every settings gear works | **DONE 2026-09-08.** There were **seven** gears, not six: the goal's grep missed `ShellSidebar.tsx:150` "Configure Recently Viewed", which renders on every page in the product. All seven resolved: 1 header Settings now `navigate('/settings')` (and the Reports icon beside it, same defect); 2 and 3 the column gears open the filter rail and move focus to the first column checkbox, via a new `ListPageFiltersContext`; 4 and 5 open a real `SectionSettingsDialog` over the My View and report sections, persisted per staff in **`integration_settings`** rather than a new table, because that table is already a staff-scoped key/value store with the right RLS; 6 removed from `ModulePlaceholderPage`, reason recorded; 7 is a new popover setting how many records Recently Viewed keeps, plus `Clear list`. **Placeholder invocations from a gear: 7 to 0.** `tests/e2e/settings-gears.spec.ts` **9 passed**, and proven non-vacuous: breaking the focus effect and the insert path failed exactly the four behavioural tests. Preference rows verified staff-scoped in Postgres and deleted by `afterAll`, count 0 after the run |
| **11** Resolve every finding | **SUBSTANTIALLY DONE 2026-09-08.** All eleven batches of `goal-11-plan.md` worked through, plus **all 19 of Klent's K1 to K19**. `browser` grew **181 to 248**, `api-tests` 265 to 269, every batch verified by 2 or 3 clean gate passes at 22 of 22. Headline fixes: K16's double scrollbar traced to a `.visually-hidden` span stretching the document 3,412px on **five** routes; U1's duplicated action bar removed and its destructive actions moved into a real `ActionMenu` with the full APG keyboard contract; `hideWhenEmpty` on `TableColumn`, proven to behave **per role** (admin keeps `Company`, sourcer loses it); U2's empty sections collapsed with counts; K14 built all nine dashboard controls including six real calendar views; U22's disabled controls went 18 to 0 with a guard. **Six findings were corrected rather than implemented**, each with the measurement: U41/U67 (the narrow blocks are deliberate `max-width`, widening them would regress), B7 (`Type` is constant, not empty), U111 (an asterisk would state something false where the rule is first **or** last), C6 (the Suspense fallback always existed; the audit measured its own speed), U22 (18, not 67). **Still open:** the import-artefact family (U17-U21, U74, U94-U103) which rewrites candidate data and needs its own before-and-after, C7 (print), C9 (the renderer stalls, an open question), QA-026, and S7/S8 raised during the work |
| **Still open, and none of it mine to close** |

**THE CAPTURE CADENCE, WHICH KLENT HAS NOW SAID TWICE.** Verbatim, 2026-09-08: "remember, screenshot, scrolldown, screenshot, scrolldown, screenshot... i want to see all pages in all of their heights. no exceptions." Shoot, scroll one viewport, shoot, repeat to the true bottom, detected by the scroll position ceasing to change rather than by a guessed count. Every fold is its own numbered image. **No exceptions is literal**: every route, every role, every scrolling overlay, and a one-viewport page records that it was one viewport so a missing `fold-2` is provably a short page and not a skipped capture. `fullPage: true` is captured as well and replaces nothing.

**Never skip an issue, an error, or a failure.** When anything fails: read the code, form a hypothesis, test the hypothesis, fix the cause. Never retry and hope. Never route around it. Never pick a simpler path because it happens to pass. Never leave a failing check as "pre-existing" without first proving it is, and then fixing it anyway if it is in scope.

**A text reply to the user is not a checkpoint.** Report only what the user cannot get from the commits, keep it short, and continue working in the same turn. If a long job is running, do work the job does not own rather than waiting on it.

**Never edit `app/src` while `gate.sh` is running.** Vite HMR delivers a partial update, the suite loads a page mid-swap, and the app throws for real. It cost 16 `client_errors` rows reading `StubPanel is not defined` on every route, with `origin` of `window.error`, from adding one new component file mid-run. A `FAIL attachments` on `client_errors row(s) present` is the symptom. Either wait for the gate, or do documentation and database work while it runs, never source.

**A browser tab left open on a route you are editing is enough to poison the next gate.** The rule above says never edit `app/src` while `gate.sh` runs. The wider rule is that **any** live client on a hot-reloaded route can take a partial update and throw for real, and the app reports it to `client_errors`, where the next `check-attachment-queue.mjs` finds it and fails the gate that had nothing to do with it. On 2026-09-08 that produced:

```
FAIL  attachments 2 client_errors row(s) present.
  unhandledrejection | / | Should have a queue. This is likely a bug in React. Please file an issue.
  window.error       | / | Should have a queue. This is likely a bug in React. Please file an issue.
```

timestamped **six minutes before the gate started**, from editing `pages/DashboardPage.tsx` with a tab open on `/`. The diagnosis is the timestamp: `select occurred_at, origin, route, message from public.client_errors order by occurred_at desc` and compare it to when the run began. If the rows predate the run they are your own editing; clear them and let the next pass speak. Passes 2, 3 and 4 then reported `attachments  No attachment files awaiting deletion, no orphaned objects, no leaked error rows`, which is what proves it rather than assuming it.

**Restart the dev server before a verification run if it has been up for days.** The one in this session had been up 2 days 22 hours; a long-lived Vite graph is its own risk, and `reuseExistingServer: true` means the gate inherits it.

**Three mistakes already made more than once in this engagement. Do not repeat any of them.**

1. **Never `pkill` a running Playwright suite.** Teardown does not run and fixtures leak, which fails `validate.sql` on `FAIL 9: people count`. Let the gate finish, or clean up deliberately afterwards.
2. **Never read a stale artefact as a current measurement.** `audit/corpus/notes.*.txt` and `manifest.*.json` are per-area and persist across runs. Check the file's date before believing it.
3. **Never change the tree a verification run is measuring.** Editing `app/src` mid-gate, or restarting the dev server mid-suite, invalidates the run and can inject real runtime errors. Finish, then change.

**Run scripts the way the gate runs them.** `validate.sql` under `psql "$DATABASE_URL"`, not `docker exec -U supabase_admin`; the latter invents failures. Never read an exit code through a pipe: `cmd | tail` reports `tail`'s status.

**A CSS transition cannot run from `auto`, and the element the user watches is not always the element you animated.** Klent reported the sidebar collapse as instant three times. Each time the transition was checked on `.fo-sidebar`, found present and correct, and the duration was raised instead: `--motion-panel` to `--motion-rail: 320ms`, with `check-motion.mjs` given a named exemption for it. None of that was the fault. The blue bar he was watching is `.fo-sidebar-panel-header`, which had **no width declared** in the open state (it stretched to its parent) and `width: var(--shell-sidebar-collapsed-w)` in the collapsed one. There is no interpolation from a used value back to a keyword, so it snapped to 52px on the first frame while the rail behind it animated for 320ms. The fix is one line, an explicit `width` on the open state, and the proof is a width sample rather than a screenshot: `340, 273, 173, 111, 68, 51, 49` across seven reads, where before there were two. **When a user says an animation does not run, sample the moving property on the element they are pointing at before touching the duration.**
