# V10, first half: looking at the screens

Version 0.5. This is the half of V10 that no script produces: opening the captures and judging them as the person who has to work in them. The task costs, in clicks and page loads, come from the pass 3 harness and are added when it runs.

Figures marked *(eyeballed)* are read off a screenshot and must be replaced by a measurement before they are quoted anywhere else. That distinction matters: three times in this project an eyeballed number has turned out to be wrong.

## The dashboard, desktop, as it opens

The first screen a recruiter sees every morning. What is actually on it:

1. **Three stacked empty-state panels**, My Calendar, My Reminders and My Tasks, consuming roughly the whole first viewport to say "No events scheduled", "No reminders due or upcoming" and "Task list is empty" *(eyeballed: about 600px of vertical space for three sentences)*. Carbon's published rule is the opposite: "Empty states should replace the element that would ordinarily show", including the table's headers and footer. Here the empty state sits *inside* a full-height panel that keeps its chrome. **This is the mechanism behind the 47% empty viewport the fidelity audit recorded as F6.**
2. **The empty states offer nothing to do.** Carbon requires a title, a body explaining the next action, and optionally an action. "Task list is empty." is a status with no pathway. There is a "New Task" link above it, outside the empty state, which is the wrong place for it.
3. **The left rail's lower two thirds are void.** "Recently Viewed" says "Records you open will appear here", and below it is empty grey to the fold *(eyeballed: roughly 340px)*. On a first session that is honest but it is also the largest single block of nothing on the screen.
4. **An unlabelled gear icon floats alone** between the page title and the first panel, at roughly 32px square with no adjacent text. It is the only control in that band. Whatever it does, the screen does not say.
5. **Quick Search uses underline-only inputs** while every form elsewhere uses a bordered box. Two input idioms on one screen, and this one is in the persistent rail, so it is on every screen.
6. **The calendar grid is a dense island.** Its day cells are markedly tighter than anything else on the page, so the one part of the screen carrying real information is also the smallest.

## The same screen at 390px

7. **Chrome consumes the top half before any content.** The utility header wraps to three rows, the primary nav scrolls horizontally with a `›` affordance, and there is a **second scroll row below it carrying only another `›`** *(eyeballed: header and nav together about 190px, and the first content panel does not start until about 405px of an 844px viewport)*. Two stacked horizontal scrollers, one of which contains nothing but an arrow, is worth calling out on its own.
8. **The title wraps to two lines and "Switch to My Dashboard" then takes a third**, right-aligned and alone.
9. **A window chip sits at the bottom**, "My View: John Buena (Admin at VentVest) ×", taking a row of the viewport on the smallest screen. It is Taleo-faithful, and it is also the least useful row on a phone.

## The candidate list, desktop: the complaint in one frame

The screen a recruiter spends the day on, and the clearest single illustration of the height problem.

10. **One toolbar row contains five controls at three different heights.** Left to right: a `Search:` label, a wide search input, a `Go!` button, the native `Saved views…` select, then `Save view` and `Export CSV` buttons. The select is visibly the tallest thing in the row and the buttons the shortest *(eyeballed; V9's measurement gives select 36px against buttons at 28 to 32)*. This is what "multiple fields and buttons that have different heights" looks like, and it is the first row of the screen.
11. **Two label idioms on one screen.** The second filter row uses inline left-aligned labels, `First Name:` and `Last Name:`, sitting beside their inputs. Every form elsewhere puts the label above the control via `.field-label`, which is what GOV.UK mandates and Carbon offers as its only arrangement. So the same product does both, eight pixels apart.
12. **Rows are roughly 100px tall** *(eyeballed)*, driven by two columns wrapping: `Grade comment` wraps to two lines and `Main status` wraps to as many as four, "Resume Provided by Third Party" being the worst case. That is well above the 69px the fidelity audit measured on seeded data and far above Carbon's 64px maximum, which Carbon reserves for **two**-line content. The real migrated data made the rows taller than the design anticipated, which is the same lesson as the record page growing to 9.7 viewports.
13. **Seven disabled bulk-action buttons occupy a permanent row.** `Mark as…`, `Change Main Status to…`, `Send Email`, `View Resume`, `Print Resume`, `Submit` and `More`, all greyed until a row is selected, plus an unlabelled gear. They take a full band of the screen to do nothing, and they are the same `disabled`-rather-than-explained pattern counted on the dashboard.
14. **The migration's data quality is visible in the UI.** Names render as "Adam -", "Alan .", "Mayank ." and "Rishi ." because the Zoho last names are literally "-" and ".", and one Location reads "-1". Not a component defect, and worth recording here because it is what the user sees: the list looks broken even though the import was faithful. Whether the UI should suppress a single-punctuation surname is a product decision.

## The candidate record, desktop: 9.7 viewports, and why

15. **Two label idioms again, this time in the same panel.** The Candidate Information section opens with right-aligned labels beside read-only values, `First name  Harry`, `Email (personal)`, `State/Territory`, and then switches mid-panel to labels above editable fields, `Initial date`, `Sourcer Grade (grade comment)`, `Current title`. Three label arrangements now exist in the product: above, inline-left on the list filter row, and inline-right on this record panel.
16. **The date field shows the browser's calendar glyph** at the right of `Initial date`, which is the unstyleable control W3 replaces, next to a plain bordered text field. The two sit in the same column at what look like different heights *(eyeballed)*.
17. **Eleven controls in the action bar**, `Edit`, `Merge duplicate…`, `Erase…`, `Send Email`, `Schedule meeting`, `View Resume`, `Print Resume`, `Submit`, `More`, `Save profile`, at three visual weights: outlined, red destructive, and filled primary. `Erase…` sits fourth from the left, two positions from `Send Email`, which is the proximity NN/g warns about: "confirmatory and destructive actions should sit far apart with redundant visual signals" ([nngroup.com/articles/proximity-consequential-options](https://www.nngroup.com/articles/proximity-consequential-options/)). It does have a distinct red fill, which is the redundant signal, and it is still adjacent to routine actions.
18. **A textarea with the resize grabber visible**, bottom-right of `Sourcer Grade (grade comment)`, which is W13: the default `resize: both` lets a drag break the two-column layout it sits in.
19. **`Country` reads `-1`**, the same migration artefact the list shows, here rendered as a value in a record rather than a cell.
20. **The Recently Viewed rail is now full**, eight candidates deep, which is the same rail that was an empty void on the dashboard. So the left rail's emptiness is a first-session state, not a permanent one, and finding 3 should be read that way.

## The requisition list, desktop, and what it does better

Worth recording where a screen is right, because the audit is meant to produce a scale rather than a complaint list.

21. **The bulk action bar shows three enabled controls, not seven disabled ones.** `Delete`, `Forms` and `Change status to…` are live. The candidate list's equivalent band holds seven greyed buttons and a gear. Two screens in the same product, two different answers to the same problem, and this is the better one.
22. **A primary action sits in the title band**, `New requisition`, top right and filled. The candidate list has no create action at all, which is correct because candidates arrive through intake, but the asymmetry means the two lists teach different habits.
23. **Rows are shorter here**, roughly 45 to 90px against the candidate list's 100 *(eyeballed)*, and the tall ones are tall for the same reason: `Title` wrapping to five lines on `VVPH-5 AU MELBOURNE BD Manager (Israel-connected)` and `Next Steps` wrapping to three. So row height is a wrapping problem on both lists, not a padding problem.
24. **The unviewed badge does real work.** `4 Unviewed Candidates (4)` in red, against `Candidates (0)` in plain text for a draft. This is the count U1.3 fixed after it was computed from 1,000 of 14,008 applications, and it reads clearly.
25. **The candidate count column uses a filled green pill**, `4`, `0`, `44`, `65`, next to a small person glyph. A zero rendered as a green pill reads as a positive state when it means the requisition has nobody in it, which is the one thing on this screen worth questioning.
26. **The table overflows horizontally at 1440px.** `Company` is cut mid-word at the right edge, "Aster Analyti", "Birchwood L", "Corvid Syste", so there is a horizontal scroll on a 1440-wide viewport. The architecture requires wide content to scroll inside its own container rather than the page, and what this shows is that the column set is wider than the space at the standard desktop width.

## The new requisition form: the height mismatch in a grid

The clearest instance in the product, because a form grid puts the mismatched controls in aligned columns where the eye compares them directly.

27. **Column three is taller than columns one and two, on every row.** Row one is `Title` (text input), `Job code` (text input), `Company` (**native select**). Row two is `Location` (text), `Employment type` (**select**), `Openings` (number). Row three is `Budget status` (**select**), `Reason for opening` (**select**), `Opened date` (**date, with the browser's calendar glyph**). The selects and the date carry the browser's own control furniture and sit taller than the plain text inputs they are aligned with *(eyeballed; V9's measurement gives select 36px against input 24)*. **This is the screen to put in front of anyone who asks why the height scale matters.**
28. **The required asterisk is placed inconsistently.** `Requisition Owners` renders it **before** the label, `* Requisition Owners`, while `Title *` and `Openings *` render it **after**. Two conventions in one form.
29. **A placeholder is used as a format hint.** `Job code` shows `<Client>-<n>, e.g. Acme-3` as placeholder text, which disappears the moment the user types, exactly when the format matters most. NN/g is explicit that a placeholder is not a label ([nngroup.com/articles/form-design-placeholders](https://www.nngroup.com/articles/form-design-placeholders/)), and GOV.UK mandates hint text between the label and the input for this purpose.
30. **`Save`, `Cancel` and `Reset` sit above the form**, not below it, with `Save` filled and the other two outlined. `Reset` discards everything the user has typed and sits immediately beside `Cancel`, which discards everything and leaves. Two adjacent, near-identically styled controls with different destructive outcomes is the proximity problem again, and here without the redundant visual signal that `Erase…` has on the record page.
31. **Requisition Owners is a bordered box of four native checkboxes** at 13 by 13, which is the unsized case from V9 rather than the 18px table case, and it is a required field.

## Two overlays: one that exceeds the published guidance, and one that answers the disabled-control question

32. **The erase confirmation is better than the reference it would be judged against.** Every element NN/g asks for is present: a title naming the action, a body that restates it specifically, "This deletes Harry Chawla and every application, activity, task, reminder and file attached to them. It cannot be undone, and it is not the same as marking them do-not-contact", a second paragraph explaining the audit receipt, a reason field, **type-the-name-to-confirm**, and buttons labelled `Cancel` and `Erase permanently` rather than OK and Cancel. NN/g recommends type-to-confirm only for the top tier of dangerous operations, and this is the right tier for it. The destructive button is also pale until the name matches, so the redundant signal is state as well as colour. **This is the pattern the rest of the product's destructive actions should be measured against**, and it means the audit's job on confirmation is to propagate an existing good answer rather than design one.
33. **The focus ring works, on a light ground.** The `Why (recorded on the receipt)` input shows a clear blue ring in this capture, which is the same `--fo-primary` outline that scores 1.01:1 on the primary nav. On white it scores 4.61:1 and is unmistakable. So W15 is specifically about dark grounds, not about the ring being wrong everywhere.
34. **The column picker answers the disabled-control question, and answers it the right way.** Clicking the gear opens a dialog reading "This action is not available in the current FOOS MVP. Column visibility is already available in the Advanced Search panel on this page", with a `Close` button. That is `TaleoPlaceholder` doing exactly what `CLAUDE.md` prescribes: it looks like Taleo, it explains itself, and it points at the thing that does work. **So the product already contains both answers to an unbuilt control**, this and the 31 silently disabled ones counted on the dashboard. The finding is the inconsistency, and this is the side of it to standardise on.

## The requisition record: a fourth label idiom and a wall of text

35. **Labels are inline-right here too**, `Opened Date`, `Title`, `Status`, `Pay notes` on the left column and `Job Code`, `Location`, `# of openings` on the right, matching the candidate record's read-only block. So the count settles at three arrangements in the product, not four: above for editable fields, inline-right for read-only record values, inline-left for list filter rows. Consistent within each of those three contexts and inconsistent between them.
36. **A "Next Steps" breadcrumb row of six links** sits between the action bar and the first panel: `Candidates (21)`, `Search`, `Add new candidate`, `Filled`, `Place on hold`, `Close`. Three of the six are state changes, `Filled`, `Place on hold` and `Close`, rendered as plain text links identical in weight to the two navigations beside them. A state change and a navigation should not look the same, and `Close` here is the same word as the `Close requisition` button eight pixels above it, in a different style.
37. **The Description panel is an unbroken wall of imported text.** The Zoho description renders as one paragraph running the full 1,050px width with no line-height relief, and it is the section that will drive this page's height. This is the migrated-data-versus-designed-layout problem again: it was fine on seed data.
38. **`Requisition Owner(s)` reads "No owners."** on a filled requisition, while the list screen showed `Rita Demo (recruiter)` as owner for others. That is real data, not a defect, and it is worth noting that the empty state here is a bare sentence in a full-height panel, the same pattern as the dashboard's three empty panels.
39. **The status chip is a green pill reading `filled`**, next to the title. It works, and it is the same green pill idiom the requisition list used for a candidate count of zero, which is the inconsistency: one green pill means a good state, the other means an empty one.

## Measured from the corpus, not eyeballed

These come from the capture manifest rather than from looking, so they are numbers rather than impressions.

### Correction: they are not "disabled", they are `aria-disabled` and they do respond

**This supersedes the count below, which I had wrong.** The 31 controls I recorded as disabled are mostly not disabled at all. `shell/Placeholder.tsx`'s `PlaceholderAction` defaults to `ariaDisabled = true`, so it renders a real, clickable `<button>` carrying `aria-disabled="true"`. There are **66 `PlaceholderAction` usages** in the codebase against only **11 natively disabled buttons**, and the labels include `Send To`, `Forms`, `Print Resume`, `View Resume`, `Submit`, `Change Status to…`, `New Task`, `New Event`, `Schedule interview`, `Search`, `Compliance`, `Onboard` and `Delete`.

So a click on most of them opens the placeholder dialog that explains itself, which is the good pattern, not a dead control.

**Two things follow, one about my harness and one about the product.**

My harness treated `aria-disabled="true"` as disabled and therefore never clicked any of the 66, which is why no `fo-placeholder-modal` appears anywhere in the corpus despite that class being in the overlay selector. That is the coverage gap named in the method note, now explained, and it is fixed by clicking `aria-disabled` controls rather than skipping them.

The product finding is sharper than the one it replaces. **`aria-disabled="true"` on a control that responds to a click is a contradiction.** It tells assistive technology the control is unavailable, so a screen-reader user is told not to try, while a sighted user clicks it and gets a helpful explanation. The two audiences are given different products. If the control opens a dialog it is not disabled, and the honest markup is an enabled button whose dialog says the feature is not built yet, which is what the dialog already says.

The severity therefore moves: not "a fifth of the screen is dead", which was wrong, but "the placeholder pattern is correct for sighted users and hides itself from assistive technology on 66 controls".

### The original count, superseded above

Across the three dashboard tabs, **31 of 144 controls are disabled**: 113 captured in a default state, 31 captured as disabled. On `/` alone there are **16**, including *31-day view*, *7-day view*, *Agenda view*, *Advanced Search*, *Announcements* and *Configure Recently Viewed*.

Three of those are the calendar's own view switchers, so the one panel on the screen carrying real information has three dead controls attached to it.

This is Taleo-faithful in the sense that Taleo has those controls, and it is a usability problem regardless: a disabled control with no explanation tells the user their expectation was reasonable and then refuses, which is worse than the control being absent. `CLAUDE.md` already prescribes the alternative for exactly this case, `shell/TaleoPlaceholder.tsx`, which is used in 18 files and says plainly that the feature is not built yet. **The finding is not "these should work", it is that 31 controls chose `disabled` where the project's own convention is a placeholder that explains itself.** Which of the two each control should use is Klent's call; being silently inconsistent is not.

### Two controls fail the WCAG minimum target size

| Control | Rendered | WCAG 2.5.8 needs |
| :---- | ----: | ----: |
| "Remove bookmark" × on the window chip | **20 x 16px** | 24 x 24 |
| The window chip itself | 258 x **19px** | 24 x 24 |

[WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is a AA criterion requiring 24 by 24 CSS pixels, with a spacing exception. Both of these sit in the bottom window-chip bar, adjacent to each other, so the spacing exception is unlikely to save them and would need to be demonstrated rather than assumed.

### The focus ring, which is the worst thing in this document

Recorded in full as W15. The ring is `outline: 2px solid var(--fo-primary)` at `#3679b5`, and against the primary nav's `#427d98` that is **1.01:1** where WCAG 1.4.11 requires 3:1. A keyboard user has no visible position across all 14 nav tabs, the sidebar panel headers, the Logout button, or any hovered primary button. `check-contrast.mjs` tests the ring against the white page surface only, where it passes at 4.61:1, so the gate is green.

Two things made this findable rather than missable. Looking at a capture and not believing it, then checking the CSS. And discovering that `:focus-visible` does not match a programmatic `.focus()`, which meant my own harness was showing no ring on anything: without that fix this would have been written up as "no focus ring anywhere", which is both wrong and unactionable.

## What this already tells W

- The density work is not mainly about padding. It is about **panels that keep their full chrome when they have nothing in them**, which is a component behaviour, not a spacing token. That reframes W10: the empty-state component and the density work are the same job.
- The empty-state rewrite is worth more than its severity suggests, because it is the mechanism behind the most visible fidelity gap in the product.
- Two input idioms in the shell rail means the height scale has to cover the underline variant too, or W1 will make the mismatch worse rather than better.

## What reading the source did to this document's own findings

Nine of the observations above were written from a screenshot and then checked against the code. Four changed materially, and one was simply wrong. Recorded here because the pattern is the useful part.

| Observation, as first written | After reading the source |
| :---- | :---- |
| "31 of 144 controls are disabled and do nothing" | **Wrong.** 66 `PlaceholderAction` usages carry `aria-disabled="true"` on real clickable buttons that open an explanatory dialog. The finding became the contradiction between `aria-disabled` and a control that responds |
| "Every list's bulk-select header is a tri-state checkbox drawn by the browser" | **Understated.** `indeterminate` appears nowhere in the codebase. A partial selection renders unchecked, and clicking it replaces the selection with every row |
| "The browser's disclosure triangle is a decision we have not made" | **Already made.** `::-webkit-details-marker` is hidden in `controls.css`. Only the instant toggle remains |
| "The required asterisk is placed inconsistently in one form" | **Three implementations**, two of them hand-written bypasses of `Input` and `Select`, one on the wrong side |
| "A placeholder is used as a format hint" | **65 placeholders and no hint-text pattern exists**, so there is nowhere else for a hint to go |
| "Reset sits beside Cancel, near-identically styled" | **Byte-identical.** `Button` defaults to `secondary`, so both carry the same class list |
| "The green pill means two things" | **One call site.** `badge-success` is used to render a count, so a requisition with nobody shows a green success pill reading `0` |
| "Three label arrangements coexist" | **The third is module-scoped.** `.info-item dt` lives in `recruit.css` and is used by two pages; `sales.css` has no equivalent |
| "State changes styled as navigation" | **Five identical `link-btn`s**, three calling `changeStatus`, two scrolling the viewport |

The direction is consistent and worth noting: **every one of these was worse or more specific than the screenshot suggested, never better.** A capture shows what a thing looks like; only the source shows what it does. An audit built on captures alone would have produced nine softer findings and missed the one that can silently widen a bulk action from three records to twenty.

## Method note: what the write guard changes about the corpus

The capture harness blocks every non-GET request to `/rest/v1/` and `/functions/v1/` at the network layer, so nothing it clicks can write. That is what makes it safe to click every button in the product, and it distorts two things that a reader of the corpus has to know about.

**State-changing controls appear to do nothing.** `Close requisition` and `Publish to careers page` are captured as "clicked, no overlay and no navigation", because their write was aborted. The blocked-write log is the record of what they attempted: `PATCH candidate_profiles` appears from both the candidate list and the candidate record, which is the star-grade control writing on click.

**One read is implemented as a POST and is therefore blocked on every screen.** `POST rpc/get_my_google_status` is aborted on all 28 routes, so every capture shows the Google integration in its unavailable state. That is an artefact of the guard, not a finding about the product. It is worth one line in its own right though: a read shaped as a `POST` will break under any read-only mode, mine or a future one.

**One coverage gap to close in pass 6.** The requisition record's `Send To` and `Forms` produced neither an overlay nor a navigation, and no `fo-placeholder-modal` was captured anywhere in the corpus despite that class being in the overlay selector and `TaleoPlaceholder` being used in 18 files. Either those two buttons are wired differently or the modal is not being detected. Pass 6 resolves which, because "no capture" is not the same as "nothing happened" and the difference matters for the disabled-versus-placeholder finding.

## Method note

Reviewing captures in a viewer is not the same as using the app, and this document does not pretend otherwise. It is judgement on rendered evidence, which is why every quantitative claim here is marked as eyeballed and handed to V9, V13 or pass 3 to confirm. Where a claim survives measurement it will be restated with its number; where it does not, it will be struck out here and the correction recorded.
