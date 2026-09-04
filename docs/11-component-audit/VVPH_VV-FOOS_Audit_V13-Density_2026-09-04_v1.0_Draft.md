# V13: density and wasted vertical space

Version 1.0. **The mechanism is established and the numbers are in.** `measure.spec.ts` is queued behind the recruit re-sweep; this document holds the method, what is already known from source, and the shape of the answer, so that only figures are missing.

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

## Measured, at 1440x900, with `.shell-content` as the scroller

The empty share is the fraction of the page's scroll height that no leaf element covers. It is measured after the page height stops changing, polled every 700ms until two reads agree, because a record page fetches its sections separately.

| Screen | Content | Viewports | Empty px | **Empty share** | Largest single gap |
| :---- | ----: | ----: | ----: | ----: | ----: |
| `not-found`, `not-found-intake` | 752px | 1 | 734px | **97.6%** | 0px |
| `global-search` | 752px | 1 | 659px | **87.6%** | 32px |
| `placeholder-onboard` | 752px | 1 | 607px | **80.7%** | 41px |
| `placeholder-courses` | 752px | 1 | 540px | **71.8%** | 32px |
| `placeholder-employees`, `placeholder-users` | 752px | 1 | 533px | **70.9%** | 32px |
| `dashboard-my-view` | 985px | 1.31 | 572px | **58.1%** | 61px |
| `sales-company-new` | 752px | 1 | 423px | **56.3%** | 41px |
| `recruit-candidate-record` | 3,241px | 4.31 | 1,795px | **55.4%** | 77px |
| `dashboard-reports` | 878px | 1.17 | 423px | **48.2%** | 61px |
| `recruit-requisition-new`, `recruit-requisition-edit` | 1,369px | 1.82 | 657px | **48.0%** | 67px |
| `dashboard-pipeline` | 770px | 1.02 | 364px | **47.3%** | 61px |
| `sales-company-record` | 1,052px | 1.4 | 485px | **46.1%** | 61px |
| `recruit-requisition-record` | 3,333px | 4.43 | 1,292px | **38.8%** | 61px |
| `settings` | 1,396px | 1.86 | 509px | **36.5%** | 64px |
| `sales-deal-record` | 3,498px | 4.65 | 1,210px | **34.6%** | 47px |
| `sales-companies` | 1,572px | 2.09 | 172px | **10.9%** | 33px |
| `sales-contacts` | 1,674px | 2.23 | 172px | **10.3%** | 33px |
| `recruit-candidates` | 2,058px | 2.74 | 222px | **10.8%** | 52px |
| `recruit-requisitions` | 2,172px | 2.89 | 204px | **9.4%** | 49px |

### The answer, and it is a clean split

**The lists are dense and everything else is half empty.** The four list screens sit at **9.4% to 10.9%** empty. Every other screen in the product sits between **34.6% and 97.6%**. There is no middle: no screen lands between 11% and 34%.

That reframes Klent's complaint precisely. He is not seeing a product with loose spacing throughout, because the screens carrying the most information are the tightest in it. **He is seeing the forms, the record pages, the dashboards and the placeholder modules**, and on those the majority of the page carries nothing.

Four things follow.

**The record page is not primarily a length problem, it is an emptiness problem.** The candidate record is 3,241px over 4.31 viewports, which is long, and **1,795px of it, 55.4%, is empty**. Shortening it by closing the timeline addresses the length; it does not address the fact that more than half of what remains is blank.

**The fidelity audit's home-page figure was conservative.** It measured 47% empty on `/` at a 1600px viewport. Measured here at 1440x900 with the settled height, `dashboard-my-view` is **58.1%** empty. Independent method, same conclusion, larger number.

**The placeholder modules are the emptiest real screens**, at 70.9% to 80.7%. They are `TaleoModulePlaceholderPage`, deliberately unbuilt, so this is expected rather than a defect, and it is worth stating so nobody spends W10 effort on them. The two not-found stubs at 97.6% are the same case.

**No single gap explains any of it.** The largest gap on any screen is **77px**, on the candidate record, and most sit at 32 to 67px. So the emptiness is not one giant hole to close; it is accumulated across the 281 declarations counted above, which is exactly what the mechanism section predicted. **W10 has to work from this table rather than from a rule change.**

### Spacing consistency, which is largely fine

| Measure | Result |
| :---- | :---- |
| Label to control | **4px on ten of the eleven screens with labelled fields.** The exception is the requisition form, which has 4px **and 37px** |
| Control to control | 16px on three sales forms, 8px on the candidate record and settings, and then outliers: **98px and 117px** on the requisition form, **194px and 341px** on the candidate record |
| Table row height | 90, 73, 56, 56, 52, 45, 24px, against Carbon's 24/32/40/48/64 |

**Label-to-control alignment is not a finding.** It is 4px almost everywhere, which closes V8 rank 11. The requisition form's second value, 37px, is the one inconsistency and it is one screen.

**Control-to-control is where the record and requisition pages differ from everything else.** 194px and 341px between adjacent controls on the candidate record, and 98px and 117px on the requisition form, against 8px and 16px elsewhere. Those gaps are the measured form of the 55.4% and 48.0% empty shares, and they are the specific targets W10 should close.

## What this document needs to be final

- `emptyPx` and `emptyShare` per screen at 1440x900, which settles how much of each screen carries nothing.
- `largestGapPx` and the element it follows, which names the specific gaps W10 should close.
- The distinct `labelToControl` and `controlToControl` distances per screen, which is the alignment half of W1.
- `rowHeight` against the tallest control in the row, which is the case the fidelity audit flagged at 69px against Carbon's 64px maximum.
- A settled page height for the candidate record, replacing the two figures that disagree.
