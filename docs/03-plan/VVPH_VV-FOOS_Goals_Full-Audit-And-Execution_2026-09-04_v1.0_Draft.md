# Goal prompts: the full audit, per page and per role, and its execution

**Project:** VV-FOOS · **Date:** 2026-09-04 · v1.0 Draft

Five goals, run one at a time. Goals 1 to 4 produce findings and change no product code. Goal 5 executes them.

Each prompt is self-sufficient, so the standing rules are repeated in each rather than referenced.

## Before running any of them: arm the reminder

The reminder hook is installed at `scripts/goal-reminder.sh`, wired into `PostToolUse` in `.claude/settings.json`. It is **silent until armed**. To arm it:

```sh
cp docs/03-plan/goal-armed/goal-1.md .claude/goal-armed.md   # or whichever goal is running
rm -f .claude/.goal-reminder-stamp
```

It then re-injects the goal and the standing rules **every 8 minutes of tool activity**, which prevents drift during a long run without firing while idle. Override the interval with `FOOS_REMINDER_SECONDS`. Disarm with `rm .claude/goal-armed.md`.

## What already exists, so no goal rediscovers it

Workstream V is complete: **34 audit rows**, 16 documents in `docs/11-component-audit/`, **16,879 recorded captures** over 31 routes at two viewports, **3,948 controls measured**. The capture harness is `tests/audit/` on its own Playwright config. Read `Audit_Workstream-V-Findings` and `Report_Workstream-V-Final` first. **A finding V already recorded is not a new finding.** What V did *not* do is the point of these goals: it swept as `admin` only, with one pass as `recruiter`, and it never judged what should be removed or built.

---

## Goal 1 — Functional coverage, per page and per role

Establish what actually works, for all four roles, on all 31 routes. Discovery only: decide nothing, remove nothing, build nothing.

**The gap this closes.** Every workstream V capture spec signed in as `admin`; only `pass3-use.spec.ts` used `recruiter`. **`sourcer` and `bd` were never swept.** That matters here because `App.tsx` gates each module mount on `RequireAuth roles={[...]}`, `shell/navConfig.ts` filters tabs by role, and RLS decides rows through `get_my_role()`. So two of four roles see screens nobody has looked at.

**Method.** Use the existing harness, `tests/audit/sweep.spec.ts`, changing the persona: it is one line, and it already captures every control in every state with writes blocked. Personas are in `tests/fixtures/personas.sql`, seeded by `npm run db:reset`. Run all four roles at both viewports. Use the global Playwright MCP only for ad-hoc probing of something the sweep cannot reach; do not rebuild the harness with MCP calls, it exists and is proven over 16,879 captures.

**Produce a matrix**, one row per route per role, recording: does it load or error; which controls render; which respond; which do nothing; which open the "not available in the current FOOS MVP" dialog; and the row counts the role can see.

**Hunt these four classes specifically, because no audit has looked for them.**

1. **A control the UI offers that RLS then refuses.** Route guards and nav filters are UI courtesy only; Postgres decides. So a control rendered for a role whose RLS policy rejects the write produces a runtime error the user meets. Find every one. This is the highest-value class in this goal.
2. **A route reachable by a role that should not have it**, or blocked for a role that should.
3. **A screen that is empty for a role** because RLS returns nothing, rendering as though it were broken.
4. **Anything that errors, blanks, or hangs** for one role and not another.

**Deliverable:** `docs/12-full-audit/VVPH_VV-FOOS_Audit_Role-Coverage_<date>_v1.0_Draft.md`, with the matrix, every finding numbered, and each carrying the file and line or the measurement it rests on. State plainly what you did not cover.

**Standing rules.** Verify every claim against source, the database or a real run; separate what you measured from what you inferred, and name what you did not check. **When you hit an error, fix it: think about the cause, read the code, search the web. Do not skip it, do not work around it, and do not take the easy path because a shortcut passes.** No comments in `.ts`, `.tsx`, `.js`, `.mjs`, `.css`. Everything is the local stack; never write to production. Commit each finding batch separately, saying what you found **and what you got wrong**. Do not stop until the matrix is complete.

---

## Goal 2 — The dead-control verdict: build, remove, or defer

Decide what happens to every control that does not work. Judgement, not discovery. Requires Goal 1's matrix.

**What is known.** **61 placeholder actions**: 50 rendered `<PlaceholderAction` call sites plus 11 buttons calling `show(...)` directly, and one hand-rolled copy, `PlaceholderActionGear`. All but one carry `aria-disabled="true"` while responding to clicks, which is V6 row 16. Their labels include `Send To`, `Forms`, `Print Resume`, `View Resume`, `Submit`, `Change status to…`, `Delete`, `New Ticket`, `Assign Course`, `New Course`, `New Packet`, `Onboard`, `Print Forms` and `Configure this list`. All are captured in the corpus.

**For each one, and for every other dead control Goal 1 found, return exactly one verdict:**

- **Build** — with a scope, the tables and RLS policies it touches, and an honest size. Prefer this where the data already exists and the control is the natural way to reach it.
- **Remove** — with the evidence that Taleo does not have it, or that no role needs it. **Removing a control is a change to the replica, so it needs a reason a reader can check**, not a preference.
- **Defer** — with the specific thing it waits on, and where that is recorded.

**Evidence that counts.** The 26 screenshots of VentVest's own Taleo instance in `docs/02-taleo-fidelity/` are the **only** defensible source for Taleo specifics; most Taleo behaviour the redesign brief treats as required is not documented in any Oracle source and was voted down under adversarial verification. So: if the screenshots show a control, it stays and probably gets built. If they do not, say so and let removal be arguable. You may search the web for how comparable ATS products handle a given action, and cite it.

**Deliverable:** `docs/12-full-audit/VVPH_VV-FOOS_Audit_Dead-Control-Verdicts_<date>_v1.0_Draft.md`. A table with one row per control: label, where it lives, what it does now, verdict, evidence, size. End with the build list ordered by value over effort. **Every control gets a verdict; "unclear" is not one.** Where a verdict is genuinely Klent's, say so and put it in the parked register rather than guessing.

**Standing rules.** As Goal 1: verify, separate measured from inferred, **fix errors rather than skipping them, search the web, no shortcuts**, no comments in source, local stack only, commit in batches saying what you got wrong, do not stop early.

---

## Goal 3 — Information architecture: what to remove

Decide which accordions, fields, columns and tabs are not needed. This is the "remove unnecessary" half, and it is separate from Goal 2 because that one is about controls and this one is about content.

**Use the strongest evidence available, which nobody has used yet: the data itself.** The local database holds **72,917 real imported candidates, 690 requisitions** and the rest of the Zoho migration. So for every field the UI renders, **query its fill rate**. A field null or empty in 99% of 72,917 records is either dead, mis-mapped by the import, or genuinely rare, and the three have different answers. That is a measurement, not an opinion, and it is the best argument for removing a field that exists.

**Also weigh:** whether the Taleo screenshots show it; whether any role uses it, from Goal 1's matrix; and what it costs in vertical space, which V13 has measured per screen.

**What V13 already established, so build on it rather than repeat it.** The four list screens are **9.4% to 10.9% empty** and every other screen is **34.6% to 97.6%**, with nothing in between, so the lists are dense and the forms, records and dashboards are not. `global-search` is 87.6% empty, `dashboard-my-view` 58.1%, the candidate record 55.4%. The largest single gap anywhere is 77px, so **no one gap explains it**: it accumulates across 281 spacing declarations. The candidate record is 3,241px over 4.31 viewports with 1,795px empty, and `History Log / Timeline` alone was measured at 2,812px and 563 of 894 nodes. `RecordSection` accepts `defaultOpen` and **30 of its 76 call sites already pass it**, so the mechanism for closing a section by default exists and is in use.

**Deliverable:** `docs/12-full-audit/VVPH_VV-FOOS_Audit_Information-Architecture_<date>_v1.0_Draft.md`. Per screen: every accordion, field, column and tab, with its fill rate where it is a field, whether Taleo shows it, which roles use it, and a verdict of keep, close by default, de-emphasise, or remove. **Taleo stays the standard**, and where genuine Taleo fidelity is what makes a screen harder to use, that is a recommendation for Klent rather than a change to make alone.

**Standing rules.** As Goal 1, and one more: a fill-rate query is a read; **never write to production**, and the migration data is real candidate PII, so **never paste a name, email or phone into a document, a commit message or a web search.** Describe the shape and omit the value, as `Audit_V10-Visual-Review` observation 14 does.

---

## Goal 4 — Motion, transitions and visual polish

Make it smooth to look at, without losing the Taleo aesthetic.

**What already exists, so this does not redo it.** Workstream R is complete: 8 items, verified in the browser rather than by reading CSS, with 11 passing assertions in `tests/e2e/interaction-motion.spec.ts` covering the tab that does not move when it goes bold, the chevron's transform matrix, the accordion interpolating height in both directions, a dialog still on screen mid-fade, a transition on every control a user touches, and the dropdown, toast and filter-rail animations. `styles/layers/motion.css` holds them, `prefers-reduced-motion: reduce` is handled at line 267, and `scripts/check-motion.mjs` guards the budget in the gate. **Read all of that first.**

**So find what is left**, which is likely: the six `<details>` accordions that cannot animate at all, since `.fo-advanced-search` carries no transition while `RecordSection` interpolates `grid-template-rows` correctly; anything that appears or disappears without a transition; state changes that jump; and the two things Klent named, which are the icon scale and the text-input focus indicator.

**On the focus indicator, do not simply delete it.** `controls.css:121` already scopes the ring to `:focus-visible`. It still shows on a mouse click because of a documented user-agent heuristic, per MDN: "when a button is clicked using a pointing device, the focus is generally not visually indicated, but when a text box needing user input has focus, focus is indicated." A text input matches `:focus-visible` however focus arrived. **There is no selector that hides it for the mouse and keeps it for the keyboard, and removing it outright fails WCAG 2.4.7.** Design a quieter indicator instead, and note that the ring currently fails WCAG 1.4.11 on three surfaces: `fo-sidebar-panel-header` at 1:1, `fo-primary-nav` at 1.01:1 across all 14 tabs, and `side-tabs-bar` at 2.59:1.

**On icons:** `tokens.css:38` already defines `--icon-xs: 14px` through `--icon-lg: 24px` and **nothing uses them**. All 60 instances pass a hard-coded number in seven sizes, and `--icon-lg` is never used, so the largest icon outside the empty states is 20px. Propose one scale wired to those tokens.

Search the web for how the design systems already cited in `Audit_V11-Design-References` handle motion, and cite what you use. Judge the result by looking at it: capture before and after and compare.

**Deliverable:** `docs/12-full-audit/VVPH_VV-FOOS_Audit_Motion-And-Polish_<date>_v1.0_Draft.md`, with each proposed change, the published reference behind it, and the assertion that will prove it. **Keep the Taleo aesthetic**: nothing bouncy, nothing slow, no motion that a dense enterprise list would not have.

**Standing rules.** As Goal 1: verify, fix errors rather than skipping, search the web for standards rather than recalling them, no comments in source, local stack only, do not stop early.

---

## Goal 5 — Execute the findings

Implement the verdicts from Goals 1 to 4, together with workstreams W and X, which are already specified.

**Order, and it matters.** First the **rank 0 Level A cluster** and **V6 row 5**, the audit's only `Blocks` finding, because they are conformance failures that each take a few lines: the mouse-only sort header, the three `onClick`-on-a-`div` interactions, the twelve routes with no `document.title`, the radio group with no `name`, and the bulk-select header that renders empty at 3 of 20 selected and then selects all 20. Then **W1**, the control height scale, because it touches every other component. Then Goal 2's build list, Goal 3's removals, Goal 4's motion, and W2's combobox.

**The bar for each change.**

- The two static gates and all five guard scripts pass: `npm run typecheck --workspace=app`, `npm run lint --workspace=app`, and `check-contrast`, `check-motion`, `check-comments`, `check-migrations`, `check-css-layers`.
- `bash scripts/gate.sh` run **5 to 10 times**, not once. Chase every intermittent failure to its cause; **a retry is never the answer**.
- **A component that did not make its task cheaper has not earned its commit.** Re-walk the six task costs in `Audit_V10-Visual-Review` and report the deltas: finding a candidate currently costs 4 page loads and 2 clicks; the validation task costs 31 keystrokes and returns two duplicated, unannounced messages.
- Re-capture the states the corpus holds and diff, so an intended change is visible and an unintended one fails.
- Commit each item separately, saying what changed **and what you got wrong**. Push to `develop`.

**Standing rules.** Verify in multiple passes and report what each found, including failures. **When you hit an error, fix it: think, read the code, search the web. Never skip an error, never work around one, and never take a simpler path because it happens to pass.** No comments in `.ts`, `.tsx`, `.js`, `.mjs`, `.css`; rationale goes in the commit message or `docs/`. Everything is the local stack at `127.0.0.1:55321`; **never write to production**, and the CI workflow stays disabled. If a measurement contradicts a finding, an earlier claim, or the plan, **the measurement wins and you correct the record**. Keep counts honest, never round up, and correct downward without being asked. Do not stop until the list is done.
