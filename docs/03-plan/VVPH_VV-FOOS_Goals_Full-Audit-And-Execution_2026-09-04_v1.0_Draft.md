# Goal prompts: the full audit, per page and per role, and its execution

**Project:** VV-FOOS · **Date:** 2026-09-04 · v1.0 Draft

**Six** goals, run one at a time. Goals 1 to 4 produce findings and change no product code. Goal 5 executes the component work. Goal 6 is hosting, which is separate because it is infrastructure rather than code and is gated on Klent creating the project.

Each prompt is self-sufficient, so the standing rules are repeated in each rather than referenced.

## Before running any of them: arm the reminder

The reminder hook is installed at `scripts/goal-reminder.sh`, wired into `PostToolUse` in `.claude/settings.json`. It is **silent until armed**. To arm it:

```sh
cp docs/03-plan/goal-armed/goal-1.md .claude/goal-armed.md   # or whichever goal is running
rm -f .claude/.goal-reminder-stamp
```

It then re-injects the goal and the standing rules **every 8 minutes of tool activity**, which prevents drift during a long run without firing while idle. Override the interval with `FOOS_REMINDER_SECONDS`. Disarm with `rm .claude/goal-armed.md`.

## Coverage map: every existing W and X item, and which goal executes it

Written because the first draft of Goal 5 said "together with workstreams W and X" and only named W1, W2, the rank 0 cluster and row 5. That is too loose for work we run one item at a time, and it hid three duplicates. **Nothing below is orphaned and nothing is done twice.**

| Item | Executed by | Note |
| :---- | :---- | :---- |
| rank 0 cluster, V6 row 5 | **Goal 5**, first | Level A failures and the only `Blocks` finding |
| W1 control geometry | **Goal 5** | Touches every other component, so it precedes them |
| W2 select → combobox | **Goal 5** | Spec already written, `Spec_V7-Select-Combobox` |
| W3 date input | **Goal 5** | |
| W4 checkbox, radio, and the keyboard contracts | **Goal 5** | Carries row 5, rows 25, 27, 29, 31 |
| W5 file input | **Goal 5** | |
| W6 disclosure, both halves | **Goal 5** | The 6 `<details>`, plus wrapping `RecordSection`'s header in a heading |
| W7 focus and scrollbars | **Goal 5** | Scrollbars are **recommended not to change** |
| W8a wiring what exists | **Goal 5** | The five props and calls that already exist and are unused |
| W8b the two that need designing | **Goal 4** designs, **Goal 5** builds | A loading affordance; the error-summary pattern |
| W8c small and deferred | **Goal 5** | `TICK_MS`; number spinners **recommended not to build** |
| W9 remaining task list | **Goal 5** | `verify-zoho-sample.mjs`, the offset re-measure, two decisions of Klent's |
| W10 density and wasted space | **Goal 3** decides, **Goal 5** implements | Goal 3 supplies the per-field verdicts |
| W11 prove it as the user | **Goal 5**, as its bar | Re-walk the six task costs after each change |
| W12 prove it visually | **Goal 5**, as its bar | Re-capture and diff against the corpus |
| W13 textarea resize | **Goal 5** | Measured: **one** control, not thirteen |
| W14 pointer cursor | **Goal 5**, with row 16 | Corrected: **not** already satisfied, see below |
| W15 focus ring contrast | **Goal 4** designs, **Goal 5** builds | Three failing surfaces, 1,079 captures |
| W16 row-level accessible names | **Goal 5**, with W4 | |
| W17 one unlabelled control, one weak name | **Goal 5** | |
| W18 one dialog replacing five | **Goal 5**, with W20 | Same work as W20's dialog |
| W19 codebase cleanup | **Goal 5** | The duplications the audit found |
| W20 make shared components shared | **Goal 5** | W19's cause; includes W18's dialog |
| W21 icon scale | **Goal 4** proposes, **Goal 5** wires | |
| W22 search-box focus indicator | **Goal 4** designs, **Goal 5** builds | With W15, same ring |
| **W23 sweep as sourcer and bd** | **Goal 1 owns it outright** | **Duplicate resolved.** It is an audit task, so it leaves workstream W and is Goal 1's method rather than a thing Goal 5 does |
| X1 to X12 hosting and cutover | **Goal 6** | Lifted out of Goal 5 |

**The three duplicates, resolved explicitly.** W23 belongs to Goal 1 and is removed from Goal 5's scope. W21 and W22 are split at the seam that matters: **Goal 4 decides what the icon scale and the focus indicator should be, Goal 5 changes the code.** An audit goal never edits a component.

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

---

## Goal 6 — Hosting and cutover

Get it running on a public URL. Separate from Goal 5 because it is infrastructure rather than component code, most of it is Dashboard settings no migration can make, and two of its twelve items are Klent's decisions rather than mine. These are X1 to X12 in the plan, detailed in section 7.28.

**What is already settled, so this does not relitigate it.** The artefact is a **static SPA**: `app/` builds to **34 files, 955,095 bytes (0.91 MiB), largest 215,735 bytes**, in 905ms, with no server-side dependency and only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as configuration, both baked into the bundle. The anon key therefore ships publicly, which is by design because RLS is deny-by-default and `validate.sql` proves it over 35 checks.

**Fly is ruled out on its own documentation**: static files must be packaged as a container image and run on machines, so it means maintaining nginx to serve 34 files. **Vercel is already configured** — `vercel.json` is committed with `outputDirectory: app/dist-redesign-2`, the SPA rewrite `/((?!assets/).*)` without which every deep link 404s, immutable asset caching, and a full header set whose CSP already allows `https://*.supabase.co`, `wss://*.supabase.co` and `accounts.google.com`. **X12 is the only open host question and it is licensing, not capability**: Vercel Hobby is "non-commercial, personal use only" per Vercel's own docs, so this needs Pro at $20 per seat per month, against Cloudflare Pages serving static assets "free and unlimited". If Cloudflare, port the rewrite and headers to `_redirects` and `_headers`, and read their commercial-use terms first, which I have not done.

**The frontend is the easy part. Do the Supabase work in this order.**

1. **X1**, Klent creates the develop project and gives you the ref. This also sidesteps a real blocker rather than solving it: the live project's ledger is broken, ten migrations applied through the MCP connector under generated timestamps against six hand-written repo files, which is why `supabase db push` refuses with `LegacyDbPushMissingLocalError`. A fresh project has nothing to reconcile.
2. **X2**, apply all **54** migrations. They apply cleanly from scratch in order, which `npm run db:reset` proves on every local run.
3. **X3**, the settings no migration can make: enable `pg_cron`, add `dash` to Data API → Exposed schemas, restrict Google OAuth to the ventvest.com hosted domain with email/password fallback. **Skip the middle one and every dashboard query returns `PGRST106`**, which is defect QA-001.
4. **X4**, add the production and preview origins to Supabase Auth redirect URLs and to the Google OAuth authorised origins, or sign-in breaks on the hosted domain.
5. **X5**, deploy the **11** Edge Functions with their `verify_jwt` settings and secrets, per `supabase/functions/README.md` and `README-agent6.md`. They deploy to Supabase, not the web host, so a frontend-only deploy leaves careers, intake and the Google integration dead.
6. **X6**, set `CAREERS_PUBLIC_ORIGIN`, since `careers-page` hardcodes `https` because `req.url`'s scheme cannot be trusted behind Supabase's proxy.
7. **X7**, set the two `VITE_` variables in the host. The client throws at boot if either is missing.
8. **X8**, **Klent's decision**: what data the hosted instance carries. The **72,917 imported candidate records are real people**. Hosting seed data only is a legitimate answer. Do not import real data on your own judgement.
9. **X9**, if real data goes up, purge the demo rows first: the `is_test` rows and the three demo staff, who have no `is_test` column and are deleted by hand. Purge order is in `README.md`.
10. **X10**, verify after deploying rather than before, and make each check prove a different item above: Google sign-in; one dashboard query, which proves `dash` is exposed; a deep link such as `/recruit/candidates/<id>`, which proves the rewrite; a live update, which proves `wss://` passes the CSP; and the public careers page.
11. **X11**, **ask before enabling anything that builds on push.** The GitHub Actions workflow is disabled at Klent's instruction and **stays disabled**; a host's git integration is a separate mechanism and needs its own yes.

**Standing rules.** Verify each step by exercising it, not by reading a settings page. **When you hit an error, fix it: think about the cause, read the code, search the web, and never skip it or take a simpler path because a shortcut appears to pass.** **Never write to production**, and note that in this goal the new develop project is the intended target while `mebfbbvrqdctamnzvbbs` is not, so confirm the ref before every `--linked` command. Real candidate PII must never reach a document, a commit message or a web search. Commit each item separately saying what changed **and what you got wrong**. Stop and ask on X8 and X11 rather than deciding them.

