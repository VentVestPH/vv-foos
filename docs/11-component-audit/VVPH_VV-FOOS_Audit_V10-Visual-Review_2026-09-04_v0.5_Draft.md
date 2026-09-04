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

## Measured from the corpus, not eyeballed

These come from the capture manifest rather than from looking, so they are numbers rather than impressions.

### A fifth of the controls on the landing screen do nothing

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

## Method note

Reviewing captures in a viewer is not the same as using the app, and this document does not pretend otherwise. It is judgement on rendered evidence, which is why every quantitative claim here is marked as eyeballed and handed to V9, V13 or pass 3 to confirm. Where a claim survives measurement it will be restated with its number; where it does not, it will be struck out here and the correction recorded.
