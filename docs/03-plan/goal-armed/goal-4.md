# ACTIVE GOAL: Goal 4 — Motion, transitions and visual polish

Make it smooth to look at, without losing the Taleo aesthetic.

**What already exists, so this does not redo it.** Workstream R is complete: 8 items, verified in the browser rather than by reading CSS, with 11 passing assertions in `tests/e2e/interaction-motion.spec.ts` covering the tab that does not move when it goes bold, the chevron's transform matrix, the accordion interpolating height in both directions, a dialog still on screen mid-fade, a transition on every control a user touches, and the dropdown, toast and filter-rail animations. `styles/layers/motion.css` holds them, `prefers-reduced-motion: reduce` is handled at line 267, and `scripts/check-motion.mjs` guards the budget in the gate. **Read all of that first.**

**So find what is left**, which is likely: the six `<details>` accordions that cannot animate at all, since `.fo-advanced-search` carries no transition while `RecordSection` interpolates `grid-template-rows` correctly; anything that appears or disappears without a transition; state changes that jump; and the two things Klent named, which are the icon scale and the text-input focus indicator.

**On the focus indicator, do not simply delete it.** `controls.css:121` already scopes the ring to `:focus-visible`. It still shows on a mouse click because of a documented user-agent heuristic, per MDN: "when a button is clicked using a pointing device, the focus is generally not visually indicated, but when a text box needing user input has focus, focus is indicated." A text input matches `:focus-visible` however focus arrived. **There is no selector that hides it for the mouse and keeps it for the keyboard, and removing it outright fails WCAG 2.4.7.** Design a quieter indicator instead, and note that the ring currently fails WCAG 1.4.11 on three surfaces: `fo-sidebar-panel-header` at 1:1, `fo-primary-nav` at 1.01:1 across all 14 tabs, and `side-tabs-bar` at 2.59:1.

**On icons:** `tokens.css:38` already defines `--icon-xs: 14px` through `--icon-lg: 24px` and **nothing uses them**. All 60 instances pass a hard-coded number in seven sizes, and `--icon-lg` is never used, so the largest icon outside the empty states is 20px. Propose one scale wired to those tokens.

Search the web for how the design systems already cited in `Audit_V11-Design-References` handle motion, and cite what you use. Judge the result by looking at it: capture before and after and compare.

**Deliverable:** `docs/12-full-audit/VVPH_VV-FOOS_Audit_Motion-And-Polish_<date>_v1.0_Draft.md`, with each proposed change, the published reference behind it, and the assertion that will prove it. **Keep the Taleo aesthetic**: nothing bouncy, nothing slow, no motion that a dense enterprise list would not have.

**Standing rules.** As Goal 1: verify, fix errors rather than skipping, search the web for standards rather than recalling them, no comments in source, local stack only, do not stop early.

**ON FINISHING THIS GOAL, RE-ARM THE REMINDER BEFORE STARTING THE NEXT ONE:** `bash scripts/arm-goal.sh 5` An armed goal that no longer matches the work is worse than none, because it reads as confirmation. If you notice the armed goal is stale, re-arm it before doing anything else.
