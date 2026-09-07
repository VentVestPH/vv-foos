# Goal 4: motion, transitions and visual polish

**Project:** VV-FOOS · **Date:** 2026-09-07 · v1.0 Draft

Nine proposed changes. Each carries the published reference behind it and the assertion that will prove it. Nothing here changes code.

**Workstream R is not redone.** Its 8 items are complete with 11 passing assertions in `tests/e2e/interaction-motion.spec.ts`, `styles/layers/motion.css` holds them, `prefers-reduced-motion: reduce` is handled at line 267, and `scripts/check-motion.mjs` guards the budget. I read all of it first, and the first finding below is that most of it should not be touched.

## 1. The durations are already right, and that is a finding

Measured against IBM Carbon's **productive** motion scale, which is the family for a dense enterprise product rather than the expressive one:

| Carbon token | Carbon ms | Carbon's stated use | FOOS token | FOOS ms |
| :---- | ----: | :---- | :---- | ----: |
| `duration-fast-01` | 70 | "Micro-interactions such as button and toggle" | | |
| `duration-fast-02` | 110 | "Micro-interactions such as fade" | `--motion-instant` | **90** |
| `duration-moderate-01` | 150 | "Micro-interactions, small expansion, short distance movements" | `--motion-quick` | **140** |
| `duration-moderate-02` | 240 | "Expansion, system communication, toast" | `--motion-panel` | **220** |
| `duration-slow-01` | 400 | "Large expansion" | not used | |
| `duration-slow-02` | 700 | "Background dimming" | not used | |

FOOS's three values sit within **10 to 20ms** of Carbon's productive scale at every step, and correctly declines to use the two slow tokens. **Recommendation: change no duration.** The 220ms budget in `check-motion.mjs` also lands exactly on `moderate-02`, so the guard is calibrated to a published scale whether or not that was deliberate.

## 2. Add an exit easing, because one curve is doing two jobs

FOOS has `--ease-out: cubic-bezier(0.2, 0, 0.2, 1)` and `--ease-in-out`, and **uses `--ease-out` for exits as well as entrances**, at all three closing animations: `.sales-toast[data-closing='true']` (line 131), `.filter-rail[data-closing='true']` (143), `.fo-utility-menu[data-closing='true']` (173).

Carbon separates them, and says why: ease-out is "used for adding elements to the stage", ease-in "primarily for removing elements from the screen". Its productive set is:

| | Carbon productive |
| :---- | :---- |
| standard | `cubic-bezier(0.2, 0, 0.38, 0.9)` |
| entrance | `cubic-bezier(0, 0, 0.38, 0.9)` |
| **exit** | **`cubic-bezier(0.2, 0, 1, 0.9)`** |

**Change:** add `--ease-exit: cubic-bezier(0.2, 0, 1, 0.9)` to `tokens.css` and use it on those three rules. Four lines. An element that leaves should accelerate away rather than decelerate into nothing.

**Assertion:** extend `interaction-motion.spec.ts` to read `getComputedStyle(el).animationTimingFunction` on a closing toast and assert it differs from the opening value, and that both are non-linear.

## 3. The six `<details>` accordions, and why the modern CSS route is the wrong one here

Confirmed: **exactly 6** elements, all `<details className="fo-advanced-search" open>`, in `CandidateFilterRail`, `RequisitionListPage`, `ContactsListPage`, `DealsListPage`, `CompaniesListPage` and `QueueListPage`. **No `details` or `summary` selector appears anywhere in `motion.css`**, so all six snap open and shut while `RecordSection` beside them interpolates smoothly.

The tempting fix is the new CSS: `::details-content` plus `interpolate-size: allow-keywords`. **Two independent reasons not to.**

- **`interpolate-size: allow-keywords` is still Chromium-only in 2026.** `::details-content` reached Baseline newly-available in September 2025 and is in current Chrome, Firefox and Safari, but the keyword interpolation that makes `height: 0` to `height: auto` animate is Chrome and Edge 129+ only. The animation would exist for some users and not others.
- **FOOS's own guard forbids it.** `check-motion.mjs:7` is `FORBIDDEN_PROPS = ['width', 'height', 'top', 'left']`, and the `::details-content` technique transitions `height`. Adopting it means either failing the gate or weakening a guard that exists for a good reason.

**Change: convert all six to `RecordSection`.** It transitions `grid-template-rows` (`motion.css:22`), which is not a forbidden property, works in every engine, is already asserted by workstream R, and gives one accordion mechanism instead of two. `<details open>` maps to `defaultOpen`, which **29 of `RecordSection`'s 76 call sites already pass**, so nothing new is needed. The disclosure semantics survive: `RecordSection` renders `<button aria-expanded>`, which is the [ARIA APG disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).

**Assertion:** a spec that asserts `document.querySelectorAll('details.fo-advanced-search').length === 0`, plus the existing accordion height-interpolation assertion applied to one converted rail.

## 4. The focus ring fails WCAG 1.4.11 on three surfaces, and no single blue can fix it

Computed from the token values with the WCAG relative-luminance formula, for the ring on buttons, links, `summary` and `[tabindex]` (`states.css:5-11`, `outline: 2px solid var(--fo-primary)` at `outline-offset: 1px`, so the comparison is against the **painted ancestor**, not the control):

| Surface | Background | Ratio | |
| :---- | :---- | ----: | :---- |
| `.fo-sidebar-panel-header` | `#577995` | **1.00:1** | **fail** |
| `.fo-primary-nav`, all 14 tabs | `#427d98` | **1.01:1** | **fail** |
| `.side-tabs-bar` | `#a9c6dc` | **2.59:1** | **fail** |
| page canvas | `#f0f0f0` | 4.04:1 | pass |
| card and input surface | `#ffffff` | 4.61:1 | pass |

All three match the figures the brief carried, computed independently.

**The important part is that darkening the blue does not work.** The shell's mid-blues sit too close in luminance to any blue:

| Candidate ring | vs `#577995` | vs `#427d98` | verdict |
| :---- | ----: | ----: | :---- |
| `#0b3d6b` | 2.42:1 | 2.44:1 | fails |
| `#12385f` | 2.60:1 | 2.63:1 | fails |
| `#08305a` | 2.89:1 | 2.92:1 | fails |
| `#0d2f52` | 2.96:1 | 2.99:1 | fails, and it is nearly black already |

So the answer is structural, and the GOV.UK Design System states the principle plainly: it pairs yellow with a black border because **"yellow has a high contrast with dark backgrounds"** and the black border **"has a high contrast against light backgrounds"**, which is how a single indicator satisfies 1.4.11 on any background.

**Change: a two-part ring built from tokens FOOS already has**, keeping GOV.UK's structure and not its yellow, which would not survive the Taleo aesthetic. `--fo-ink: #1a1a1a` as the ring, `#ffffff` as a 1px halo outside it:

| Surface | dark part | light part |
| :---- | ----: | ----: |
| `.fo-sidebar-panel-header` | **3.79:1** | 4.59:1 |
| `.fo-primary-nav` | **3.83:1** | 4.55:1 |
| `.side-tabs-bar` | **9.78:1** | 1.78:1 |
| page canvas | **15.27:1** | 1.14:1 |
| white | **17.40:1** | 1.00:1 |

The two parts contrast with each other at **17.40:1**, and **the dark part alone clears 3:1 on all five surfaces**, so the minimum viable change is a single `--fo-ink` ring and the halo is what keeps it reading as an indicator rather than a border. Implement as `outline: 2px solid var(--fo-ink); outline-offset: 1px; box-shadow: 0 0 0 3px #fff;` so nothing reflows.

**Assertion:** a spec that focuses one control on each of the five surfaces, reads the computed outline colour and the painted ancestor background, and asserts the computed ratio is at least 3:1. Note the trap workstream V hit: `getComputedStyle(el).outlineColor` on an **unfocused** element returns `currentColor`, so the element must actually be focused before reading.

## 5. There are two focus ring colours, and they should be one

`states.css:9` uses `var(--fo-primary)`, which is `#3679b5`. `controls.css:124` uses `var(--primary)`, which resolves through `--fo-link` to `#1b6fc9`. **Contrast between the two: 1.09:1**, so they are indistinguishable to look at and different in code, which is the worst of both.

**Change:** one token for the focus indicator, referenced by both rules.

**Assertion:** focus a button and an input in the same spec and assert `outlineColor` is identical.

## 6. The text-input ring: quieter, not gone

This is the change Klent asked for, and it cannot be done the way it was asked.

**It cannot simply be hidden for the mouse.** `controls.css:121` already scopes it to `:focus-visible`. It still appears on a click because of a user-agent heuristic MDN states directly: "when a button is clicked using a pointing device, the focus is generally not visually indicated, but when a text box needing user input has focus, focus is indicated." **A text input matches `:focus-visible` however focus arrived**, so no selector separates mouse from keyboard for it, and removing the indicator outright fails [WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

**It is also not the accessibility problem.** At `outline-offset: -1px` the input ring is drawn inside the input, so it contrasts against the input's own white background at **5.04:1**, which passes comfortably. The complaint is aesthetic, and it is a fair one: a 2px inset line inside a 1px border reads as a heavy double border.

**Change:** stop drawing a second line. Thicken the input's existing border instead, which is exactly what GOV.UK does for form inputs, "yellow outline plus thick black border (thickened if existing border present)". Concretely, drop the inset `outline` and apply `box-shadow: inset 0 0 0 2px var(--focus-ring)`, which visually thickens the border with **no layout change**, so no content shifts and `check-motion.mjs` stays satisfied.

**Assertion:** focus an input, assert `outlineStyle` is `none` while the computed `boxShadow` is non-empty, and assert the input's `getBoundingClientRect()` is byte-identical before and after focus, which proves nothing reflowed.

## 7. The icon scale: wire the tokens, and raise the floor

Measured across `app/src`: **61 `size=` instances in 7 distinct values.** Corrected on implementation, 2026-09-07: the first count said 60 because it read JSX call sites only and missed `StarGrade.tsx:12`, whose signature defaults to `size = 14` and feeds five of that component's seven call sites.

| Size | Instances | What they are |
| ----: | ----: | :---- |
| **40** | **31** | `RecordPage` page-title icons. Entirely consistent |
| 16 | 12 | general inline icons |
| 14 | 8 | dense icons, including the sidebar collapse chevron, and `StarGrade`'s prop default |
| 18 | 6 | |
| 20 | 2 | `PrimaryNav` home icon, and the global default |
| 13 | 1 | `DataExportCard.tsx:122`, inside a button |
| 12 | 1 | `BookmarkBar.tsx:70`, a close button |

**Two things the brief had wrong, corrected here.** `--icon-lg` **is** used, at `pagination.css:76-77`, giving `.fo-cal-view-btn` a 24x24 box. And the largest icon is **40px with 31 instances**, not 20px. There is also a fourth mechanism the brief does not mention: `main.tsx:12` sets `<LucideProvider size={20} strokeWidth={1.6}>`, so every icon that passes no size is already 20px.

So the real picture is better than "seven arbitrary sizes": there are **two consistent anchors** (40px for page titles, 20px as the global default) and **28 ad-hoc overrides** below them. This figure first read 26, which did not even match the table above it: the original rows below the two anchors summed to 27, and the `StarGrade` default makes 28.

**Change, and it answers "make the icons a bit larger" by raising the floor rather than scaling everything:**

| Token | Now | Proposed | Used for |
| :---- | ----: | ----: | :---- |
| `--icon-xs` | 14px | **retire** | nothing should be smaller than the next row |
| `--icon-sm` | 16px | **16px** | the floor. The 12px, 13px and 14px instances all move here |
| `--icon-md` | 20px | **20px** | the `LucideProvider` default, unchanged |
| `--icon-lg` | 24px | **24px** | icon-only buttons, which also helps WCAG 2.5.8 |
| `--icon-page` | absent | **40px** | the 31 title icons, so they stop being a magic number |

That moves 16 instances up (one 12, one 13, eight 14 including the `StarGrade` default, and six 18) and leaves the other 45 alone. Note the two smallest are both inside buttons, so raising them helps legibility and target size together.

**Corrected on implementation, 2026-09-07.** The first version of this section said "moves 9 instances up and leaves the other 51 alone", which left the six 18px instances in place, and in the next line asserted that every size must match a token. 18 matches no token, so the two statements cannot both hold. The 18px step therefore moves to 20, which keeps the assertion enforceable and raises six more icons.

**Assertion:** a static check in the style of `check-contrast.mjs` that fails if any `size=` literal in `app/src` is below 16 or is a value with no matching token. Built as `scripts/check-icons.mjs`, which derives the allowed set from `tokens.css` instead of hard-coding it.

**One thing this assertion cannot see, found by measuring the rendered boxes.** Eight icons whose literal says 16 rendered **14 wide by 16 tall**, because `.fo-gear-btn` never zeroed the user-agent `<button>` padding of `1px 6px`, leaving a 14px content box that the `<svg>` flex-shrank into. A source scan cannot detect it; `tests/audit/icon-scale.spec.ts` asserts both scale membership and `width === height` for every rendered `svg.lucide`.

## 8. The sidebar chevron jumps while the other two rotate smoothly

FOOS has three disclosure chevrons. Two animate and one does not:

| Chevron | Rotation set by | Transition |
| :---- | :---- | :---- |
| `.record-section-chevron` | CSS class | `motion.css:18`, `transform var(--motion-quick)` |
| `.fo-utility-caret` | CSS class, `motion.css:180` | `motion.css:177`, `transform var(--motion-instant)` |
| sidebar collapse chevron | **inline `style={{ transform: ... }}`**, `ShellSidebar.tsx:73` | **none** |

`motion.css:49` does list `.fo-sidebar-collapse-btn`, but that rule targets the **button**, and the rotation is applied to the `<svg>` inside it, so no `transition: transform` reaches the thing that moves.

**Change:** move the rotation to a class, matching the pattern the other two already use. To be precise about the mechanism, an inline `transform` *can* be transitioned if a rule declares `transition: transform` on that element; the reason this one jumps is that no rule does. Moving it to a class fixes it and makes all three chevrons consistent, which is the better reason.

**Assertion:** the existing chevron transform-matrix assertion from workstream R, applied to the sidebar chevron.

## 9. The dashboard bars appear instantly

`BarList.tsx:20` sets the fill width inline, `style={{ width: '<n>%' }}`. It is the only data visualisation in the product and it has no motion.

**`width` cannot be the animated property**: it is in `check-motion.mjs`'s `FORBIDDEN_PROPS`, and transitioning it forces layout on every frame.

**Change:** keep the inline width for correctness and animate `transform: scaleX()` from `transform-origin: left` on first paint, at `--motion-panel`. Compositor-only, no layout, and it is the one place in a Taleo replica where a small reveal is idiomatic rather than decorative, because a bar chart that grows communicates magnitude.

**Assertion:** assert the fill's computed `transformOrigin` is `left` and that a keyframed `animationName` is present; guard against regression by asserting no rule anywhere transitions `width`, which `check-motion.mjs` already does.

## What this deliberately does not change

Recording these so nobody "fixes" them later.

- **All three durations and both existing easings.** They match Carbon's productive scale, per section 1.
- **The `.fo-sidebar` collapse is unanimated by policy**, not by oversight: `.fo-sidebar` is one of four `SHELL_SELECTORS` in `check-motion.mjs` that the guard forbids from carrying motion at all. The chevron in section 8 is a separate element and is fair game.
- **`.fo-sidebar-panel` and `.dash-widgets-panel` need no entry motion.** I nearly filed both as gaps because they are in the audit harness's overlay selector list and absent from `motion.css`. Both are **unconditionally rendered** containers, so there is no appearance to animate.
- **`.intake-reject-panel`, `.panel-form`, `.fo-toast` and `.unviewed-dot`** appear in that same harness list and **do not exist as CSS classes at all**, with zero rules across every layer. The harness list was speculative and is not evidence of a gap.
- **The 220ms budget.** It equals Carbon's `moderate-02`, and every proposal above fits inside it.

## What I got wrong, and what this did not cover

**Two false gaps caught before they reached a recommendation**, both from trusting a selector list instead of the DOM: the two always-rendered panels above, and the four classes that do not exist. The lesson is the same one Goal 1 recorded, that a list of things to check is not a list of things that are there.

**Three claims in the brief were wrong.** Section 7 corrects two: `--icon-lg` is used, and the largest icon is 40px rather than 20px. The third is smaller and I had repeated it before checking: **29** of `RecordSection`'s 76 call sites pass `defaultOpen`, not 30. A line-based grep says 28 and a multi-line-safe parse says 29, which is the figure to trust, and it is the same class of counting error that produced four wrong numbers in workstream V.

**One overstatement of my own, caught while writing.** I first concluded that the sidebar chevron "can never be animated because an inline style beats every layered rule". That is wrong: inline styles set a value, and a `transition` declared in CSS still applies to a change in that value. The rotation jumps because no rule declares `transition: transform` for that element, which is a different and smaller fault.

**Not covered.**

- **Nothing here was judged by looking at it.** The brief asks for before-and-after captures compared by eye, and every proposal above is computed from tokens, source and published references. **A capture pass belongs at the start of Goal 5**, once a change exists to photograph, and no claim in this document rests on appearance.
- **Chromium only**, as with every measurement in this audit. That matters more than usual for section 3, where the whole argument turns on Firefox and Safari behaviour that I read about rather than tested.
- **`prefers-reduced-motion` was read, not exercised.** The block at `motion.css:267` uses the standard `*` override, and I did not run the suite with the media feature forced on. Every proposal inherits that block automatically, section 9's keyframe included.
- **No motion is proposed for tables, rows, or the Kanban board** beyond what workstream R already ships. On a screen holding 20 rows of 72,917 records, the right amount of movement is very little, and the four list screens are the part of the product that already works.

## Sources

- [Carbon Design System, Motion overview](https://carbondesignsystem.com/elements/motion/overview/) and [the v10 motion page](https://v10.carbondesignsystem.com/guidelines/motion/overview/), for the duration tokens and the productive easing curves
- [GOV.UK Design System, Focus states](https://design-system.service.gov.uk/get-started/focus-states/), for the two-colour indicator and its rationale
- [MDN, `interpolate-size`](https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size) and [Chrome for Developers, More options for styling `<details>`](https://developer.chrome.com/blog/styling-details), for `::details-content` support
- [WCAG 2.2, Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [ARIA APG, Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
