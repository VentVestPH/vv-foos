# ACTIVE GOAL: Goal 2 — The dead-control verdict: build, remove, or defer

Decide what happens to every control that does not work. Judgement, not discovery. Requires Goal 1's matrix.

**What is known.** **61 placeholder actions**: 50 rendered `<PlaceholderAction` call sites plus 11 buttons calling `show(...)` directly, and one hand-rolled copy, `PlaceholderActionGear`. All but one carry `aria-disabled="true"` while responding to clicks, which is V6 row 16. Their labels include `Send To`, `Forms`, `Print Resume`, `View Resume`, `Submit`, `Change status to…`, `Delete`, `New Ticket`, `Assign Course`, `New Course`, `New Packet`, `Onboard`, `Print Forms` and `Configure this list`. All are captured in the corpus.

**For each one, and for every other dead control Goal 1 found, return exactly one verdict:**

- **Build** — with a scope, the tables and RLS policies it touches, and an honest size. Prefer this where the data already exists and the control is the natural way to reach it.
- **Remove** — with the evidence that Taleo does not have it, or that no role needs it. **Removing a control is a change to the replica, so it needs a reason a reader can check**, not a preference.
- **Defer** — with the specific thing it waits on, and where that is recorded.

**Evidence that counts.** The 26 screenshots of VentVest's own Taleo instance in `docs/02-taleo-fidelity/` are the **only** defensible source for Taleo specifics; most Taleo behaviour the redesign brief treats as required is not documented in any Oracle source and was voted down under adversarial verification. So: if the screenshots show a control, it stays and probably gets built. If they do not, say so and let removal be arguable. You may search the web for how comparable ATS products handle a given action, and cite it.

**Deliverable:** `docs/12-full-audit/VVPH_VV-FOOS_Audit_Dead-Control-Verdicts_<date>_v1.0_Draft.md`. A table with one row per control: label, where it lives, what it does now, verdict, evidence, size. End with the build list ordered by value over effort. **Every control gets a verdict; "unclear" is not one.** Where a verdict is genuinely Klent's, say so and put it in the parked register rather than guessing.

**Standing rules.** As Goal 1: verify, separate measured from inferred, **fix errors rather than skipping them, search the web, no shortcuts**, no comments in source, local stack only, commit in batches saying what you got wrong, do not stop early.
