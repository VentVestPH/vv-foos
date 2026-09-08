# ACTIVE GOAL: Goal 9 — Look at the screenshots and say what is ugly

Goal 8 produced images. This goal **opens them and reads them**, one at a time, and writes design findings. **No file under `app/src` changes in this goal.** This is the goal the previous audit never did.

**Klent, 2026-09-08, verbatim:** "the audit should be able to find ugly frontend/ui/ux/design issues, improvements, changes as part of the findings... i can see ugly and not right designs still... texts are not even vertically aligned with its icon. like what the hell is this website?"

And earlier, 2026-09-04: "taleo is still the standard, but i can see ugly designs with huge spaces and what not. i want that change."

## The failure this goal exists to correct

The previous audit produced 16 documents and rated 20 rows by severity, and every one of those ratings was about a **contract**: an ARIA role, a focus ring, a control height, a contrast pair. Not one was about whether a page looks right. A component audit was allowed to stand in for a design review. **The instrument was never pointed at the thing Klent was complaining about.**

## Method, from published sources rather than recall

Two established methods, used together, because each catches what the other misses.

**Heuristic evaluation** against Nielsen's ten heuristics, which is the standard method for finding design problems by review rather than by testing ([Maze](https://maze.co/guides/usability-testing/heuristic-evaluation/), [Lollypop](https://lollypop.design/blog/2024/december/heuristic-evaluation/), [Eleken](https://www.eleken.co/blog-posts/a-checklist-for-ux-design-audit-based-on-jakob-nielsens-10-usability-heuristics)). Nielsen's own finding is that **one evaluator finds about 35% of problems and three to five find most of them** ([Maze](https://maze.co/guides/usability-testing/heuristic-evaluation/)), so this goal runs **five independent passes with different lenses** rather than one pass claiming completeness.

**A visual design quality audit**, which reviews colour, typography, layout, spacing and alignment for consistency and hierarchy ([DesignMonks](https://www.designmonks.co/blog/ux-audit-checklist), [SiteCrafting](https://www.sitecrafting.com/articles/ux-audit-checklist/), [CleverX](https://cleverx.com/blog/ux-audit-checklist-step-by-step-evaluation-template), [Systems iO](https://systemsio.com/insight/ui-ux-audits-part-2-choosing-the-right-audit-method-for-your-product/)).

**On density specifically, which is Klent's complaint.** Modern design favours whitespace, and in a high-density enterprise interface that backfires ([Master CAWEB](https://mastercaweb.unistra.fr/en/actualites/ux-ui-design-en/minimalism-versus-density-in-ui-and-ux/)). Whitespace is a balance tool applied through a **consistent spacing system and the proximity principle**, not an absence of content ([NN/g](https://www.nngroup.com/videos/whitespace/)). The target is **density with clarity**: a strict grid and a firm typographic hierarchy let information pack tightly without becoming noise. Taleo remains the fidelity standard, so the answer is never "add more air".

**On the alignment bug Klent named.** Icon-and-label rows centred with `align-items: center` can still look wrong, because text descenders are included in the box the browser centres but the eye does not see them ([OpenStreetMap PR #3701](https://lists.openstreetmap.org/pipermail/rails-dev/2022-September/024517.html)). Mathematical centring and optical centring are different things. `align-items: center` on the flex container is the mechanism ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Aligning_items_in_a_flex_container), [CSS-Tricks](https://css-tricks.com/almanac/properties/a/align-items/)), and where the glyph's own box is off-centre the icon needs a nudge, not the row.

## The seven passes

**Corrected 2026-09-08:** this heading read "The five passes" while the list below it has always had seven. The list is right and the heading was wrong, and Nielsen's three-to-five-evaluators finding is about the number of *evaluators*, not the number of lenses.

Each pass reads **every** image in `audit/2026-09-08/screens/` and `states/`, and writes to `findings/`. A pass that skips images is a failed pass.

1. **Spacing and rhythm.** Vertical gaps between sections, label-to-control distance, padding consistency, and whether anything sits on the 8px grid the architecture document mandates. Klent's "huge spaces" is scored here, per page, in pixels, from the `measurements/` JSON rather than by eye.
2. **Alignment.** Every icon against its label, every label against its field, every column header against its cells, every row of controls against each other. **The icon-and-text case is a named acceptance criterion**: list every instance and its measured offset in pixels.
3. **Typography and hierarchy.** How many distinct sizes and weights are actually rendered, whether the hierarchy reads without reading the words, and whether anything is set at a size the token scale does not define.
4. **Consistency across pages and roles.** The same control looking different on two pages; the same page looking wrong for one role. This is the pass the four-role sweep exists for.
5. **Nielsen's ten heuristics**, applied to the flows the screenshots show: visibility of system status, match to the real world, user control, consistency, error prevention, recognition over recall, flexibility, minimalist design, error recovery, help.
6. **First impressions and transitions.** The login page, the unauthenticated redirect, the `Loading...` fallback, the route-to-route transition, first paint on a cold load. Judge these as a stranger would on their first ten seconds, because that is what they are. `App.tsx:35`'s fallback is a bare unstyled string; that is a finding before anyone measures it.
7. **Dead and lying controls.** From Goal 8's JSON: every element that was acted on and did nothing, and every control whose label promises something it does not do. A gear that opens a message telling you to go and look elsewhere is a design defect, not a placeholder.

## Dig deep, and the categories that count as findings

**Klent, 2026-09-08:** "add everytything that is an issue for the website. this is the time for you to dig deep."

Nothing is out of scope for being small or for being subjective. All of these are findings and all of them go in:

- **Spacing**: gaps that do not sit on the 8px grid, inconsistent padding between sibling panels, dead vertical space above the fold, cramped rows next to airy ones.
- **Alignment**: icon against label, label against field, header against cell, control against control, text against its own container.
- **Typography**: sizes not on the token scale, weight used to mean two different things, line length too long to read, truncation that hides the useful half of a value.
- **Colour**: two greys doing one job, a status colour reused for a non-status, contrast that passes the guard but still reads badly.
- **Borders, radii and shadows**: mixed radii on adjacent controls, a border where a gap would do, a shadow heavier than the token allows.
- **Empty, loading and error states**: an unstyled string, a table that shows nothing without saying why, an error with no recovery.
- **Copy**: a label that does not say what the control does, a message written for a developer, inconsistent capitalisation across two pages.
- **Interaction**: hover with no affordance, focus you cannot see, a click target smaller than it looks, a control that moves under the cursor.
- **Consistency**: the same thing looking different in two places, which is worth more than either instance in isolation.
- **Anything that simply looks wrong.** If it would make Klent say "what the hell is this", it is a finding, and "I could not measure it" is not a reason to leave it out. Say it in words and attach the image.

## The output

`audit/2026-09-08/findings/INDEX.md` plus one file per route. Every finding carries:

- **The image filename** it was found in. A finding with no image is not a finding.
- **A measured number** where one exists: the gap in pixels, the offset in pixels, the count of distinct sizes.
- **A severity**: `Ugly` (Klent would object on sight), `Wrong` (breaks a rule the codebase already states), `Improvement` (better but not broken).
- **A proposed change**, concrete enough to implement, naming the file and the selector.
- **The reference** behind it, if it rests on one.

**Then a top-level `findings/UGLY.md`**, ordered worst first, that a person can read in five minutes and recognise their own complaint in. That document is the deliverable. Sixteen markdown files nobody reads is what went wrong last time.

## The bar

- **Every image is opened and looked at.** Report the count read against the count captured; they must match.
- **No finding without an image and, where possible, a number.**
- Findings that contradict an earlier audit's claim say so explicitly and the measurement wins.
- If a pass finds nothing on a page, that is recorded as "read, nothing found" rather than omitted, so silence is distinguishable from not looking.
- **No commit.** Klent reviews `UGLY.md` before anything is committed.
- **An error stops the goal until its cause is fixed.** Never skipped, never worked around, never retried and hoped past.
- **Internet and parallel agents are both allowed**, one agent per review lens, never nested, each with a narrow brief and a report format. Cite anything fetched with the date it was read.
- **Every finding must be fixable from this document alone**, because Goal 11 fixes them without re-deriving anything: the file, the selector, the measured number, the proposed change.

**ON FINISHING: `bash scripts/arm-goal.sh 10`, and do not commit.**
