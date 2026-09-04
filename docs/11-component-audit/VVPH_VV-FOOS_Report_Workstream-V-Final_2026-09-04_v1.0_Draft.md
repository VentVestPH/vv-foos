# Workstream V: final report

**Project:** VV-FOOS · **Date:** 2026-09-04 · v1.0 Draft

Audit and specification only. Nothing in workstream V changed a component; workstream W implements from it and has not started. Its brief is `docs/03-plan/VVPH_VV-FOOS_Goal_Workstream-W-Component-Implementation_2026-09-04_v1.0_Draft.md`.

Every figure below is regenerable: `node tests/audit/report-figures.mjs` reads the coverage, the source counts, the row and severity totals and the document versions from the corpus and from `app/src`. That exists because **24 of the claims corrected during this audit were hand-typed numbers that had gone stale**.

## 1. The three things you asked about

**"dropdown options are default browser. i dont like that"**

It is **one component, not fifty-four**. Two `<select>` elements exist: one decorative and disabled, and `components/ui/Select.tsx`, which every real dropdown routes through, used **54 times across 23 files**. So this is a single replacement that 54 call sites inherit.

The strongest argument for making it is that the harness **could not photograph the open state on any screen**, because the option list is drawn by the operating system. A control whose open state the page cannot capture is one the page cannot style, test, or make match Taleo. That is not a matter of effort; no CSS reaches it.

The specification is `Spec_V7-Select-Combobox`. It flags honestly that at 390px the native control opens an OS wheel that is genuinely good, so keeping the native control below a breakpoint is a legitimate outcome rather than a failure.

**"i can see multiple fields and buttons that have different heights"**

Correct, and the cause is that **almost nothing chooses a height**. Only two rules in the entire product set a `line-height` on a control: `.btn` at 17.5px and `.btn-sm` at 16.25px. Those produce the only two stable heights in FOOS, 37.5px and 30.25px. **Every other control computes `line-height: normal`**, taking its height from font metrics plus padding, with a 13.33px user-agent default font recurring where nothing sets one.

Measured across 3,948 controls: **15 distinct chrome-button heights over a 28px spread**, a `select` at 19px or 36px, and an `input-text` at 21, 24, 25 or 34px, so the two controls most likely to share a filter row never match. The specific pairs you can see are in V9: the worst is a 36px date field beside a 13px checkbox on the new-contact form.

**"taleo is still the standard, but i can see ugly designs with huge spaces and what not"**

Correct, and measured with a clean split: **the four list screens are 9.4% to 10.9% empty, and every other screen is between 34.6% and 97.6%.** Nothing lands between 11% and 34%.

So the screens carrying the most information are the tightest in the product. What you are seeing is the forms, the record pages and the dashboards: `global-search` **87.6%** empty, `dashboard-my-view` **58.1%**, the candidate record **55.4%**, both requisition forms **48.0%**.

**It is not a fidelity trade.** The 2026-09-01 fidelity audit reached the same conclusion independently and called the home page "the single most visible departure from feels like Taleo" at 47%; this measurement puts it at 58.1%. Tightening moves *towards* Taleo.

Two things bound the work: **no single gap explains it**, since the largest gap on any screen is 77px and most are 32 to 67px, so it is accumulated across 281 spacing declarations; and **the placeholder modules at 70.9% to 80.7% are deliberately unbuilt**, so no effort belongs there.

The sharpest instance is the table row. A candidate row is **90px** and the tallest control inside it is an **18px** checkbox, so 72px of every row carries no control, on the list holding 72,917 records. And the rows **grew 30% and 33% when the migration landed**, from 69px and 55px, with no stylesheet change: real names and grade comments wrap where 83 rows of seed data did not.

## 2. What was done

| | |
| :---- | :---- |
| Routes | **31**, at 1440x900 and 390x844 |
| Recorded captures | **16,879**, of which 13,440 are individual controls |
| Controls measured | **3,948**, from computed styles |
| Screens measured for density | 31 |
| Documents | **16** in `docs/11-component-audit/` |
| Audit table | **34 rows**, every one verified in source or measured, every one mapped to a W item |

Six passes: breadth, then every control in every state, then the six real tasks walked as their user, then judgement against cited published sources, then measurement, then reconciliation. The harness is `tests/audit/` on its own Playwright config, so the gate never runs it.

**Every non-GET request to `/rest/v1/` and `/functions/v1/` was aborted**, so the audit clicked every button in the product without writing anything. Four real writes were attempted and blocked. `client_errors` holds **0 rows** after ~25,000 captures and thousands of forced clicks, and my specs left **0** fixture rows behind.

## 3. What to build first

Full ordering in `Audit_V8-Priority-Order`. The shape of it:

**Rank 1, and it is the only `Blocks` finding.** The bulk-select header. With **3 of 20** rows ticked it reports `indeterminate=false, checked=false`, so it renders as an empty box; clicking it leaves **20 rows selected**, identically at both viewports. A user with three rows selected therefore sees an empty checkbox, clicks it, and runs their next bulk action on twenty records believing it applies to three, with nothing announcing the change. `indeterminate` appears nowhere in the codebase. It is a handful of lines and needs no design decision.

**Rank 0, a cluster of Level A conformance failures that are each a few lines.** Sorting is mouse-only on every sortable column, and `Table.tsx:249` already shows the correct pattern twenty lines above the defect. Three more interactions are `onClick` on a `div`: the truncated-cell expander across five columns, every dashboard bar's drill-through, and the deal card, which gives the sharpest case — a keyboard user can move a deal between pipeline stages but cannot open it. Twelve routes plus `/login` set no `document.title`. One radio group has no `name`, so it is not a group at all, and none of the four has a group label.

**Then the height scale**, because it touches every other component: building the select, the checkbox or the date field first means building them to a height that then changes.

**Then the select**, the case you named.

## 4. The pattern under a third of the findings

**FOOS repeatedly builds the shared mechanism correctly and then does not wire it.** Six findings are the same shape:

| The mechanism, which exists and works | Call sites using it |
| :---- | :---- |
| `Input` and `Select` accept `error?: string`, styled and animated | **0 of 149** |
| `lib/listReturn.ts`, both halves of the list-return contract | **2 of 11** paths |
| `useDocumentTitle` | 17 files; **12 routes call nothing** |
| `Table`'s `busy` prop, rendering `aria-busy` | **6 of 17**, and it does not gate the empty row |
| `emptyText` gated on `loading` | 4 sales lists and 1 intake list; **0 of recruit's 3** |
| A button label changing to `Saving…` | 5 sales pages and `ListPage`; **0 in recruit** |

**No module is ahead.** Recruit has no loading feedback of any kind while the CRM beside it has all three forms; recruit is the only module that preserves the list URL or offers a `Back To List` at all, and carries 22 `aria-label` attributes against sales's 4. Every gap is a pattern invented in one module and never carried across.

That changes what W is for those six: **wiring, not building.** The one exception, a loading affordance, genuinely does not exist: `Button` has no loading prop and no spinner exists anywhere in `app/src`.

**The corollary matters as much.** Where a component received sustained attention it is right, including the parts that are easy to skip: the Kanban board hand-writes a full keyboard drag with live-region announcements carrying card position and column count; the idle dialog gives a two-minute grace against WCAG 2.2.1's 20 seconds and is the only dialog using `role="alertdialog"`; the skip link's target carries `tabIndex={-1}`; `aria-sort` is set on the active column only. **Twenty things were checked and found correct**, against fourteen new findings. The gaps are not a team that does not know the contracts. They are the call sites nobody has been back to.

## 5. Three things already satisfied, and one that conforms

Two were items you asked for, so they close rather than ship.

**Every button, link, tab and summary already shows `cursor: pointer`.** Excluding disabled and `aria-disabled` controls, where `default` is deliberate, the list of offenders is **empty**. An earlier version of my own table listed 62 and every one was a correctly-disabled control.

**Exactly one textarea can be dragged sideways, not thirteen.** Of 11 measured, one computes `resize: both`: `Sourcer Grade (grade comment)` on the candidate record. The fix is still a shared declaration, to prevent the sixth omission rather than patch the first.

**The pager arrows conform to WCAG 2.5.8**, at 30px between centres against the 24px the spacing exception requires, and the star buttons meet 24x24 outright. Neither should be resized on accessibility grounds. Of **643 controls under 24px, 615 are rescued by the spacing exception and 28 fail outright**: the requisition owners checkbox list, four 13x13 checkboxes stacked 23px apart, failing by **one pixel**, and the rich-text toolbar at 390px only.

## 6. One decision that is yours

**Is the ATS meant to be read-only on a phone?** `useIsMobile` gates **eight capabilities** on a 640px media query, so create, edit, bulk-edit and upload all vanish below that width, **in recruit only**, while sales allows them at any width. Parked as **P4**.

Four parts are defects whichever way you decide, and W8 should fix them regardless: nothing tells the user why the controls are absent, while FOOS already owns the explanatory-dialog pattern; the live listener means narrowing a desktop window removes editing mid-session; the two recruit lists disagree with each other, since the candidate list keeps its checkboxes at 390px and disables every bulk action while the requisition list removes the checkboxes entirely; and the module README names the hook without recording that it does any of this.

## 7. What this audit got wrong, and what it does not know

**24 of my own claims failed re-checking.** Fifteen were corrected downward, two withdrawn outright, one corrected upward. They are listed individually in `Audit_Pass6-Reconciliation` with the wrong version left visible in every document that carried it.

The split is the useful part. **Eleven audit-table rows marked "verified in source" were re-checked against the files and all eleven held.** Every one of the 24 errors was in summary prose written from the table plus memory. A claim degrades when it is restated, not when it is written down.

**The harness had 11 defects**, catalogued in `Audit_V2-Capture-Harness`. Seven would have failed silently, three would have produced confident wrong findings, and one destroyed evidence: a supplementary pass overwrote three manifests, taking recruit from 4,358 entries to 163, while reporting success. Four of my own counting scripts produced plausible wrong numbers by dropping rows rather than erroring.

**What it does not know:**

- **Chromium only.** For a workstream whose premise is that the browser decides too much, one engine is a real limit.
- **Two radios were never captured.** `intake_items` holds 0 rows, so the drawer cannot open. The finding is verified in source and seeding a fixture was declined deliberately, with the reason recorded.
- **The candidate record's height is disputed** between two of my own earlier measurements, 7,304px and 5,979px, against 3,241px measured here on a settled page. V6 records all three and quotes none as settled.
- **No screen reader was used.** Every accessibility finding is from the DOM, the computed styles and the published criteria, not from listening to the product.

## 8. Where everything lives

| Item | Document |
| :---- | :---- |
| Entry point, and the three complaints answered | `Audit_Workstream-V-Findings` v1.0 |
| The 34-row audit table and the severity scale | `Audit_V6-Audit-Table` v2.9 |
| Build order, including the rank 0 cluster | `Audit_V8-Priority-Order` v1.1 |
| What the browser decides, and the two one-line fixes | `Audit_V3-Browser-Defaults` |
| Geometry, target size, the focus ring, row heights | `Audit_V9-Control-Geometry` v1.1 |
| Density, and the three approaches it rules out | `Audit_V13-Density` v1.0 |
| 39 screen observations and the six task costs | `Audit_V10-Visual-Review` v1.0 |
| The combobox and the remaining replacements | `Spec_V7-Select-Combobox`, `Spec_V7-Remaining-Replacements` |
| ARIA contracts, read from w3.org | `Audit_V4-ARIA-Contracts` |
| Design references, including the "not published" answers | `Audit_V11-Design-References` |
| Taleo comparison, correcting two stale fidelity findings | `Audit_V5-Taleo-Comparison` |
| The instrument, and its 11 defects | `Audit_V2-Capture-Harness` v1.3 |
| The 24 corrections and the 20 acquittals | `Audit_Pass6-Reconciliation` |
| Component inventory and final coverage | `Audit_V1-Component-Inventory` v1.3 |

The screenshot corpus is `audit/corpus/`, **gitignored**, because the screens render real candidate names from the Zoho migration. **These documents carry no candidate data**; where a finding needed an example of imported data, the shape is described and the value is not reproduced.
