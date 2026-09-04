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

## What this already tells W

- The density work is not mainly about padding. It is about **panels that keep their full chrome when they have nothing in them**, which is a component behaviour, not a spacing token. That reframes W10: the empty-state component and the density work are the same job.
- The empty-state rewrite is worth more than its severity suggests, because it is the mechanism behind the most visible fidelity gap in the product.
- Two input idioms in the shell rail means the height scale has to cover the underline variant too, or W1 will make the mismatch worse rather than better.

## Method note

Reviewing captures in a viewer is not the same as using the app, and this document does not pretend otherwise. It is judgement on rendered evidence, which is why every quantitative claim here is marked as eyeballed and handed to V9, V13 or pass 3 to confirm. Where a claim survives measurement it will be restated with its number; where it does not, it will be struck out here and the correction recorded.
