# ACTIVE GOAL: Goal 1 — Functional coverage, per page and per role

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
