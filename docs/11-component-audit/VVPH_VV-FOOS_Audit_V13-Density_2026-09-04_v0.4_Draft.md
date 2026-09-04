# V13: density and wasted vertical space

Version 0.4. **The mechanism is established and the numbers are not yet in.** `measure.spec.ts` is queued behind the recruit re-sweep; this document holds the method, what is already known from source, and the shape of the answer, so that only figures are missing.

Klent, 2026-09-04: "taleo is still the standard, but i can see ugly designs with huge spaces and what not. i want that change."

## The mechanism, which is not what I expected

Two candidate explanations for a sprawling page, and the first one is ruled out.

**It is not fixed heights holding empty chrome.** Grep across all fourteen layer files and all five module stylesheets for `height` and `min-height`, excluding `line-height`, `max-height` and the `auto`/`100%`/`0` cases, returns twenty declarations. The largest are `min-height: 48px` on a panel header in `panels.css:49` and `min-height: 44px` in `shell.css:198`. Everything else is 40px or smaller, and most are the 24px target-size floors on shell controls. **No rule reserves vertical space for content that is not there**, so there is no single declaration to change.

**It is accumulation.** Counting every declaration that adds vertical space across the layers and the module stylesheets:

| Property | Declarations |
| :---- | ----: |
| `gap` | 123 |
| `padding` | 106 |
| `margin-top` | 15 |
| `margin` | 12 |
| `margin-bottom` | 12 |
| `padding-bottom` | 6 |
| `padding-top` | 4 |
| `row-gap` | 3 |
| **total** | **281** |

The spacing scale itself is small and disciplined: `--sp-half` 4px, `--sp-1` 8px, `--sp-2` 16px, `--sp-3` 24px, `--sp-4` 32px, used 44, 128, 93, 10 and 4 times respectively. `--sp-5` is declared and never used. Nothing is reaching for 48px or 64px gaps.

## Why that matters for how W10 is done

Three approaches are ruled out by the mechanism, which is the useful part of knowing it before measuring.

**Do not shrink a spacing token.** `--sp-2` at 16px is used 93 times for horizontal spacing as well as vertical, and the architecture document fixes 12px table cell padding and an 8px grid. Changing the token to buy vertical space would move horizontal spacing everywhere and break the cell padding the fidelity audit confirms already matches Taleo.

**Do not sweep the 281 declarations.** Most of them are correct. A gap of 8px between a label and its control is right; the fidelity audit found border radius, cell padding and page title size all already matching. An untargeted tightening pass would regress the things that match in order to fix the things that do not.

**Do not treat it as one number.** The candidate record's height is disputed between two of my own earlier measurements, 7,304px over 9.71 viewports against the plan's 5,979px in a 572px window, and V6 row 3 records both rather than picking one. A single page-height figure is not actionable anyway: it says a page is long without saying which part of it is empty.

So W10 has to be **targeted at measured gaps**, which is what the measurement collects: per screen and viewport, the scroll height, the empty pixel count and its share, the largest single gap and the element it follows, and the distinct label-to-control and control-to-control distances. A gap is worth closing when it is large *and* carries nothing; a page is worth shortening when a named section accounts for most of it.

## What is already known without the measurement

Three facts from source and from the earlier audits, all independent of the pending numbers.

**One section dominates the record page.** The plan's T3 work measured History Log / Timeline at **563 of 894 nodes and 2,812 of 5,979px, 47% of the page on its own**, already capped at 50 entries. Everything else on that page put together is smaller. And the two sections holding history disagree about their defaults: Status History is closed at load, History Log / Timeline is open. Closing the timeline by default would take the page to roughly 3,220px, which is the single largest available reduction anywhere in the product and needs no design work.

**Section defaults are already explicit and already used.** `RecordSection` accepts `defaultOpen` and **26 of its 76 call sites pass it**, so eight of the seventeen sections on the candidate record are closed at load by deliberate choice. The mechanism for the paragraph above therefore exists and is in service; what is left is one default, which is the parked T3a decision.

**Empty panels keep their full chrome.** This is the mechanism behind the fidelity audit's F6, which called the home page's **47% empty viewport** "the single most visible departure from feels like Taleo". A panel with nothing in it still renders its header, its body padding and a one-line message, and three of them stack on the home page. That is a component behaviour, not a spacing value, which is why V6 row 3 files it under density rather than under the height scale.

## What this document needs to be final

- `emptyPx` and `emptyShare` per screen at 1440x900, which settles how much of each screen carries nothing.
- `largestGapPx` and the element it follows, which names the specific gaps W10 should close.
- The distinct `labelToControl` and `controlToControl` distances per screen, which is the alignment half of W1.
- `rowHeight` against the tallest control in the row, which is the case the fidelity audit flagged at 69px against Carbon's 64px maximum.
- A settled page height for the candidate record, replacing the two figures that disagree.
