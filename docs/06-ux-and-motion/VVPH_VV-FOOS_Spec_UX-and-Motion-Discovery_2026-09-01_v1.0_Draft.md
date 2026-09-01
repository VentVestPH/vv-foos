# UX and Motion Discovery and Specification

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft · **Target:** `foos_redesign_2/app/`

A discovery pass across the whole application, then a specification for adding motion and interaction polish **without diverging from the Oracle Taleo design language**. Every number below is measured from the source or the running application on 2026-09-01, not estimated.

## 1. Discovery: what is actually there

### 1.1 Surface area

76 `.tsx` files, 13,792 lines. Seven stylesheets. The ten largest files carry most of the interaction:

| File | Lines |
| :---- | :---- |
| `modules/recruit/candidates/CandidateRecordPage.tsx` | 1,168 |
| `modules/recruit/requisitions/ApplicationPipeline.tsx` | 797 |
| `modules/recruit/candidates/CandidateListPage.tsx` | 724 |
| `modules/recruit/requisitions/RequisitionRecordPage.tsx` | 595 |
| `modules/recruit/components/engagement.tsx` | 572 |
| `modules/recruit/requisitions/RequisitionListPage.tsx` | 566 |
| `modules/recruit/requisitions/RequisitionFormPage.tsx` | 550 |
| `modules/sales/components/EngagementPanel.tsx` | 484 |
| `modules/sales/pages/ContactRecordPage.tsx` | 468 |
| `modules/sales/pages/DealRecordPage.tsx` | 364 |

### 1.2 Motion inventory: there is none

Counted across `styles/app.css`, `styles/tokens.css` and all five module stylesheets:

| Property | Occurrences |
| :---- | :---- |
| `transition` | **0** |
| `animation` | **0** |
| `@keyframes` | **0** |
| `prefers-reduced-motion` | **0** |
| `will-change` | 0 |
| `transform` | 1 |

Confirmed at runtime: every probed element computes `transition: all 0s`. The section header, buttons and links all report zero transition duration.

This is faithful to Taleo and it is also why every interaction lands abruptly. It is a clean starting point: there is no existing motion to unpick, and no accidental animation to reconcile.

### 1.3 Interaction state coverage

| Selector | Occurrences | Assessment |
| :---- | :---- | :---- |
| `:hover` | 16 | Present |
| `:focus` | 6 | Present, but see below |
| `:focus-visible` | **0** | Missing. Focus rings therefore show on mouse click as well as keyboard |
| `:active` | **0** | Missing. No pressed state on any control |
| `:disabled` | 6 | Present |
| `[aria-disabled]` | **0** | No styling hook exists |
| `:checked` | 0 | Checkboxes are browser default |

### 1.4 Asynchronous state handling

| Module | Files | With loading state | With error state | With empty state |
| :---- | :---- | :---- | :---- | :---- |
| `recruit` | 11 | 5 | 10 | 6 |
| `sales` | 16 | **0** | 9 | 9 |
| `intake` | 7 | 2 | 4 | 2 |
| `dashboards` | 13 | 1 | 3 | 6 |
| `settings` | 3 | 1 | 2 | 0 |
| `components/ui` | 11 | 0 | 2 | 3 |

Across the whole application: zero skeletons, zero spinners, zero `aria-busy`, two `role="status"`, four `role="alert"`. The `sales` module has no loading affordance in any of its 16 files, so its lists render empty and then populate.

### 1.5 Live updates that arrive silently

Seven files hold Supabase Realtime subscriptions:

`CandidateListPage.tsx`, `RequisitionListPage.tsx`, `ApplicationPipeline.tsx`, `RequisitionRecordPage.tsx`, `HiredPromotionListener.tsx`, `intake/hooks.ts`, `dashboards/hooks.ts`.

Measured on the requisition list, which is one of them: **0 `aria-live`, 0 `role="status"`, 0 `role="alert"` in the entire document.**

**Correction, 2026-09-01.** That measurement was per-page and understated the app-wide position. A full sweep found **six implicit live regions already present** (`role="alert"` on the login error, the do-not-contact banner, the hired-promotion banner and the contact dedup warning; `role="status"` on two deal toasts). So the banners and toasts were already announced. The genuine gap was narrower and specific: the **Realtime-driven unviewed counters** had no announcement at all, which is now fixed on `UnviewedBadge` with `aria-live="polite"`. Dashboard refreshes still do not announce, and the intake badge cannot, because nothing renders it (see D17).

So when an unviewed counter drops from 3 to 2, when the intake queue badge increments, or when a dashboard refreshes on an outbox event, the value swaps instantly with no visual acknowledgement and no announcement. If you are not looking at that exact pixel at that exact moment, the change is invisible. This is the single strongest case for motion in the whole application, and section 3 explains why it carries no fidelity risk.

### 1.6 Placeholder controls give no advance signal

Measured on the requisition list: 41 buttons, **0 natively disabled, 0 with `aria-disabled`, all 41 tabbable**.

Keyboard reachability is correct and should stay. But the redesign prompt section 2 asks for `aria-disabled` "where the action cannot safely run", and none of the 41 `FOOS-TBD` placeholder controls carries it. They look fully enabled, so you only discover a control is unavailable after clicking it. Note that 75 `disabled={...}` props exist elsewhere in the codebase for genuine form states, which is correct usage and not in question here.

### 1.7 Other measurements

- Accordion toggle settles in **4.5ms** with no transition. The candidate record has 15 sections.
- Inline `style={{` appears 8 times across 6 files, so the token system is not being bypassed at any scale.
- `@dnd-kit` supplies drag transforms internally; the Kanban board adds no motion of its own.

## 2. The discipline: when motion diverges from Taleo and when it cannot

The tension is real and worth resolving explicitly rather than by taste. Taleo Business Edition is server-rendered: every meaningful interaction was a full page load. It had no motion because it had no opportunity for motion, not because it made a design choice against it.

FOOS is a single-page application. It has entire classes of interaction Taleo never had. That gives a clean test:

**Motion diverges from Taleo only where Taleo had the same interaction and performed it instantly. Where FOOS has an interaction Taleo never had, there is no Taleo precedent to violate.**

That yields three categories, and everything in section 4 is assigned to one.

| Category | Definition | Motion policy |
| :---- | :---- | :---- |
| **A. Taleo had it** | Accordion expand and collapse, tab switch, column sort, page navigation, hover feedback | Near-instant only. 80 to 120ms, linear or `ease-out`. Motion here must be almost subliminal; anything longer reads as a modern app and breaks the replica |
| **B. Taleo never had it** | Realtime count changes, optimistic updates, drawer open and close, Kanban drag, client-side filtering, promotion banner, toast and inline validation | Motion is free. No precedent is violated. Use it to make state changes legible |
| **C. Never animate** | Shell geometry, nav band, table row heights, section header bands, anything decorative | No motion, ever. These are the load-bearing elements of the replica |

The redesign prompt already sanctions restraint in this direction: "hover changes are subtle" and "modals may use only a restrained overlay/shadow needed for separation". It forbids gradients, glass, floating cards, large radii and decorative illustration. **None of those are motion.** Nothing in the prompt or the architecture document forbids transitions.

Hard prohibitions, so the replica cannot drift:

- No page or route transitions. No fade-in, no slide-in on navigation. Taleo pages appeared; so do these.
- No staggered list-item entrance animation. This is the single most recognisable "modern SaaS" tell.
- No scroll-triggered reveals, no parallax, no skeleton shimmer. A static grey block is fine; a sweeping gradient is not.
- No easing curves with overshoot or bounce (`back`, `elastic`, spring physics).
- No motion on any Category C element.
- Nothing exceeds 200ms except a drawer, which is capped at 220ms.

## 3. Motion tokens

Add to `tokens.css`. Defining these as tokens rather than ad-hoc values is what stops the budget being exceeded one component at a time.

```css
:root {
  /* Motion. Taleo-replica budget: subliminal for interactions Taleo had,
     modest for interactions it never had. Nothing here exceeds 220ms. */
  --motion-instant:  90ms;   /* Category A: accordion, sort, tab, hover */
  --motion-quick:   140ms;   /* Category B micro: badge change, validation */
  --motion-panel:   220ms;   /* Category B only: drawer and modal */
  --ease-out: cubic-bezier(0.2, 0, 0.2, 1);   /* decelerate, no overshoot */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Reduced motion is mandatory, not optional.** The application currently has zero `prefers-reduced-motion` handling, which is trivially compliant only because nothing moves. The moment motion is added, this block must land in the same commit:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Never animate `width`, `height`, `top` or `left`. Restrict to `opacity`, `transform`, `background-color`, `border-color` and `color`, which the compositor can handle without layout work.

## 4. Specification by component

### 4.1 Category A: interactions Taleo had

| Component | Change | Duration |
| :---- | :---- | :---- |
| Accordion section header (`.record-section-header`) | Transition `background-color` on hover. Do **not** animate panel height: 15 sections on the candidate record means height animation costs layout on every toggle, and the current 4.5ms instant toggle is correct Taleo behaviour | `--motion-instant` |
| Table row hover | Transition `background-color` only. The row-hover token measured 13.91:1 against body text, so no contrast risk | `--motion-instant` |
| Buttons and links | Transition `background-color`, `border-color`, `color` | `--motion-instant` |
| Sort header | Transition the sort caret `opacity` only. Carbon's verified pattern shows unsorted arrows on hover only, which this supports | `--motion-instant` |
| Primary nav tab | Transition `background-color`. Never animate position or size, the active tab rectangle is Category C geometry | `--motion-instant` |

### 4.2 Category B: interactions Taleo never had

This is where the real gains are.

| Interaction | Change | Why it carries no fidelity risk |
| :---- | :---- | :---- |
| **Realtime count change** (unviewed badges, intake queue badge) | Brief `background-color` flash on the badge, settling to its resting state over `--motion-quick`. Pair with an `aria-live="polite"` region so the change is announced | Taleo had no live updates at all. Today a 3 becoming a 2 is invisible unless you happen to be watching that pixel |
| **Intake queue drawer** | Slide from the right on `transform: translateX()`, plus `opacity`. Currently opens instantly | Taleo had no drawers. The redesign report already describes this as "a Taleo record overlay" |
| **Modal and dialog** (`Dialog.tsx`, `Modal.tsx`, `LostReasonDialog.tsx`, `TaleoPlaceholder.tsx`) | Backdrop `opacity` fade, dialog `opacity` only. **No scale, no slide-up.** The prompt permits "a restrained overlay/shadow needed for separation" | Scale and slide are the modern tell; a plain fade is not |
| **Kanban card drop** | Settle the card into its column over `--motion-quick` rather than snapping | Kanban is a FOOS addition. Taleo's pipeline was accordions, so there is no precedent |
| **Hired-promotion banner** | Fade in over `--motion-quick`, with `role="status"` | Arrives from a Realtime event with no warning; instant appearance is startling |
| **Client-side filter and search** | Fade the result set over `--motion-instant` when the row set changes | Taleo used a `Go!` round trip. Instant client-side replacement gives no confirmation the filter applied |
| **Inline validation** | Fade the error message in over `--motion-quick`, with `role="alert"` | Taleo validated on server round trip |

### 4.3 Category C: never animate

Shell geometry (header height, sidebar width, content edges), the nav band, section header band colours, table row heights, borders and rules, page titles. These carry the replica. Changing them under motion is what would make the app stop looking like Taleo.

## 5. UX improvements that add no motion at all

Several discovery findings are pure interaction quality and need no animation. They are the cheapest wins in this document.

| # | Fix | Evidence |
| :---- | :---- | :---- |
| U1 | Replace `:focus` with `:focus-visible` for the ring, keeping `:focus` for form fields | 0 occurrences of `:focus-visible`. Focus rings currently appear on mouse click, which reads as a bug to sighted mouse users |
| U2 | Add `:active` pressed states to buttons and action-bar controls | 0 occurrences. Clicking currently gives no acknowledgement whatsoever. Taleo's bordered buttons did depress, so this is fidelity as well as feedback |
| U3 | Add `aria-disabled="true"` plus a dimmed style to the 41 `FOOS-TBD` placeholder controls, keeping them tabbable | Prompt section 2 asks for exactly this. Measured 0 of 41 |
| U4 | Add `aria-live="polite"` regions to the seven Realtime surfaces | 0 live regions anywhere. Live updates are currently silent to assistive technology |
| U5 | Add loading states to the `sales` module | 0 of 16 files have one |
| U6 | Add `aria-busy` during fetches | 0 occurrences |
| U7 | Style `:checked` on the selection checkboxes to match the Taleo palette | 0 occurrences, currently browser default |
| U8 | Empty states for `settings` (0 of 3 files) and `intake` (2 of 7) | Prompt section 9 requires "a plain Taleo-style sentence within the appropriate table or panel" |

U1 through U4 are the ones that change daily experience most, and none of them touches a pixel of the Taleo visual language.

## 6. Verification

Motion is easy to add and hard to keep bounded, so verify with checks rather than judgement:

1. **Budget check.** Grep every `transition-duration` and `animation-duration` and assert none exceeds 220ms. Commit it as a script beside the contrast check.
2. **Reduced-motion check.** Load each route under Playwright with `reducedMotion: 'reduce'` and assert every computed `transition-duration` is under 1ms.
3. **Category C check.** Assert that no shell element (`.taleo-utility-header`, `.taleo-primary-nav`, `.taleo-sidebar`, `.record-section-header`, `.table th`) carries a non-zero transition on any geometry property.
4. **Property check.** Assert no rule transitions `width`, `height`, `top` or `left`.
5. **Re-run the fidelity audit.** Screenshots at 2560 x 1600 must remain comparable to the reference set, since motion is invisible in a still and a diff should therefore show nothing.

Check 5 is the honest test of whether the replica survived: if a still frame changed, motion was not the only thing that changed.

## 7. Sequencing note

Do U1 through U4 first. They are cheap, they need no motion tokens, and they carry no fidelity risk at all. Then add the motion tokens and the reduced-motion block together in a single commit. Only then work through section 4, Category B before Category A, since Category B is where the benefit is and Category A is where the risk is.
