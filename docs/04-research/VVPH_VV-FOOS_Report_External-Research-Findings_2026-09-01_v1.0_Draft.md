# External Research Findings

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft

Cited external research on Taleo interface specifics, dense-UI patterns and accessibility, run to test whether the redesign programme's assumptions hold against documented sources. Method: fan-out web search across five angles, source fetching, then adversarial verification where each candidate claim faced three independent skeptical voters and needed at least two refutations to be killed. 110 agents, 812 tool calls. Vote counts are recorded per finding so you can see how contested each one was.

Read this alongside the internal evidence. Where the two disagree, the internal measurement wins for questions about FOOS, and this report wins for questions about what is documented externally.

## 1. The headline result, and it is uncomfortable

**Most of the Taleo UI specifics the redesign brief treats as requirements are not documented anywhere Oracle publishes.** Five Taleo-specific claims were put to the verifiers and four were voted down:

| Claim tested | Vote | Outcome |
| :---- | :---- | :---- |
| Top-level tab set and order | 1-2 | Refuted |
| List-view archetype: arrow paging, `Go!` button, Smart Views dropdown | 0-3 | Refuted |
| Requisition accordion section sequence and action-bar button set | 0-3 | Refuted |
| Main Status enumeration, Rank, ACE flag, Merge | 0-3 | Refuted |

Nothing in the surviving evidence supports a `1-20 of N` pager string.

**What this does and does not mean.** It does not mean the redesign is wrong. The 26 screenshots are direct evidence of VentVest's own Taleo instance, and the redesign prompt already declares them the visual source of truth. It means the fidelity argument has to be made as "this matches your instance, captured in these screenshots" and never as "this is how Taleo is documented to work". Tab order, pager format, accordion sequence and status vocabulary are product decisions defensible on their own merits and on the screenshots, not facsimiles of published behaviour.

Practical consequence: **the 26 screenshots are irreplaceable primary evidence and should be preserved, not treated as disposable reference material.** They are currently the only defensible source for most of the replica's concrete requirements.

## 2. Taleo behaviour that IS documented, and that FOOS is missing

Three findings survived 3-0, from Oracle's own materials. All three describe behaviour FOOS does not fully have, so these are the best-evidenced feature additions available.

### 2.1 The left pane, Back To List and Printable View

Source: Taleo Business Edition 11.4 User Guide, October 2011, pp. 26-27 (`milcorp.com/assets/TaleoUserGuide11_41.pdf`). Verbatim:

> "The left navigation pane contains the Search feature, along with Recently Viewed Items options. This section can be collapsed and expanded based on your preference."

> "Just to the left of each Recently Viewed Item, you will see an icon which represents the record type"

> "if the last list page you viewed was the third page in a list of Candidates, clicking Back To List on any candidate details page returns you to that page of the Candidates list"

> "click the Printable View button, which opens the current page in a separate window for cleaner printing."

FOOS matches the left-pane structure. It does **not** match Back To List: the implementation is `navigate('/recruit/candidates')` with no state, so filters, saved view, sort and page are all discarded. That is a documented-fidelity gap and one of the few where Oracle's own guide is the authority. Printable View is currently a placeholder.

Scope warning from the verifiers: this is TBE-specific. Taleo Enterprise 20B/22B documents a different Recently Viewed panel, so do not generalise these findings to Taleo Cloud Service.

### 2.2 Recently Viewed eviction, and Bookmarks

Source: Oracle 17A2 What's New for Taleo Business Edition, 12 April 2017. Verbatim:

> "Unlike the Recently Viewed items list, where the items will be removed from the bottom of the list as the user accesses more and more documents, the bookmarks will remain until the user deletes them."

Bookmarks: up to 20, created from a bookmark icon in the upper left, shown by default in a bar at the bottom of the screen.

FOOS has Recently Viewed capped at the last 15 records, so it has the eviction problem Oracle shipped Bookmarks to solve. FOOS has no bookmarks feature. This is a documented Taleo capability, absent from FOOS, that addresses a real workflow need.

Implementation limit worth knowing: Taleo's bookmarks are URL-based, so pages without a stable unique URL cannot be bookmarked and the icon greys out. FOOS's routes are URL-addressable, so it would not inherit that limitation.

### 2.3 The two-level status model, with structured history

Source: TBE 11.4 User Guide, TBE 7.5 Release Notes, Oracle 17A2 What's New. TBE distinguishes candidate-level **Main Status** from per-candidate-per-requisition **Req. Specific Status**, driven by two separate workflows, and records transitions in a structured history carrying **Status, Previous Status, Duration, Date In, Date Out and Comments**.

FOOS implements the two-level model correctly: `candidate_profiles.status_id` and `applications.stage`, exactly as the architecture document specifies. What it does not have is the structured history *surfaced on the record*. FOOS writes `status_change` activities and maintains `stage_changed_at`, and the `dash.mv_stage_durations` materialised view computes durations for dashboards, but no record page shows a Status / Previous Status / Duration / Date In / Date Out / Comments table. The data exists; the presentation does not.

This is the highest-value documented feature gap found, because the data is already captured and the migrated Zoho notes give it content.

## 3. Dense-table design, with vendor specifications

Verified 3-0 against IBM Carbon v11 (fetched live, page footer "Last updated 27 August 2026") and Salesforce developer documentation.

### 3.1 Carbon row density

Five row sizes, and only five: **extra small 24px, small 32px, medium 40px, large 48px, extra large 64px**. The column header row "should always match" the body row size. Extra large is reserved for two-line content.

Measured against FOOS:

| Table | Measured row height | Against Carbon |
| :---- | :---- | :---- |
| Requisition list | 55px | Between large and extra large |
| Candidate list | 69px | **Exceeds Carbon's largest size** |

This gives the long-text decision an external landing point. If grade comments are capped at two lines, the candidate row lands near 64px, which is precisely what Carbon reserves extra large for. Uncapped at 69px it is off the scale, and the migrated Zoho grade prose runs to several hundred characters in places, so it will get worse rather than better.

Qualifications the verifiers insisted on: Carbon's wording is "should", normative guidance rather than an enforced requirement; the five sizes are a per-table configuration, not a user-facing density toggle, so this does not justify a runtime density switcher.

### 3.2 Carbon batch actions and sorting

A batch action bar appears at the top of the table **only once a row is selected**, with per-row action icons and overflow menus disabled while batch mode is active, and exit via a cancel button at the far right or by deselecting all. Sortable headers are three-state (unsorted, sorted-up, sorted-down) where only the sorted column shows an icon and unsorted arrows appear on hover only.

FOOS shows its action bar permanently, which matches Taleo and therefore wins on fidelity. Recording the Carbon pattern as the modern alternative, not as a recommendation to change.

Verifier caveat: Carbon's own `TableBatchActions.tsx` contains no logic touching per-row overflow menus, so suppressing row actions during batch mode is guidance to the consuming team rather than behaviour the component provides.

### 3.3 Salesforce lightning-datatable, and the pagination question

Documented supported features, verified verbatim: sorting, infinite scrolling of rows, row-level actions, header actions, column resizing, inline editing for some data types, row numbering, text wrapping and clipping.

**It contains no pagination at all.** So this source underwrites infinite scroll, not a numeric pager, and cannot be used to justify a Taleo-style `1-20 of N` control.

This matters for the recommendation to paginate the candidate list. That recommendation now rests on the screenshots of your instance, not on external best practice, and the mainstream enterprise alternative is virtualised infinite scroll. Both solve the real problem, which is that the list currently renders 83 rows unbounded. Pagination is the fidelity-preserving choice; infinite scroll is the vendor-precedented one.

Two adjacent claims were refuted 0-3 and are worth knowing were tested: that clipping-by-default proves capping long text is the mainstream enterprise default, and that accessible dense tables require an explicit arrow-key two-mode grid keyboard model. Neither is supported, so expand-on-click capping needs its own justification and does not get one from vendor practice.

## 4. Accessibility, verified against normative sources

### 4.1 Sticky bars and SC 2.4.11, which FOOS is currently exposed to

Verified 3-0 against W3C WCAG 2.2 Technique F110, whose own title is "Failure of Success Criterion 2.4.11 Focus Not Obscured (Minimum) due to a sticky footer or header completely hiding focused elements".

Example 1 covers a sticky footer covering the focused element while tabbing down; Example 2 covers a sticky header while tabbing up. The test procedure requires tabbing **in both directions**. The AA threshold is *complete* coverage; partial overlap fails only AAA 2.4.12. Named mitigation: `scroll-padding-top` / `scroll-padding-bottom`, or `scroll-margin` on focusable rows, sized to the sticky bar.

**FOOS is exposed.** `app.css` has two `position: sticky` rules and no `scroll-padding` or `scroll-margin` anywhere:

- `.record-action-bar` at `position: sticky; top: 0; z-index: 10`, on record pages that carry up to 15 accordion sections below it. Tabbing upward from a lower section is F110 Example 2 exactly.
- `.table th` at `position: sticky; top: 0`, a sticky table header. Lower risk, since a header row is unlikely to completely cover a focused element and table rows are not focusable here.

This is a genuine Level AA exposure that the internal audit did not catch, because the audit measured focus *visibility* and not whether a sticky element obscures the focused element after scrolling. Logged as D11.

### 4.2 Accordion ARIA, narrower than assumed

Verified against the W3C ARIA Authoring Practices Guide accordion pattern. `aria-expanded` must be bound to panel visibility on the header button for script-driven button-based disclosures. FOOS does this correctly on all 15 candidate-record sections.

More useful, verbatim from APG:

> "Avoid using the region role in circumstances that create landmark region proliferation, e.g., in an accordion that contains more than approximately 6 panels that can be expanded at the same time"

FOOS's candidate record has 15 simultaneously expandable sections. Checked: FOOS has **no** `role="region"` anywhere, so it is already on the right side of this. Recording it so nobody "improves" accessibility by adding 15 landmark regions.

Two claims were refuted: that the header button must be the sole child of a `role="heading"` element (0-3), and that `aria-controls` must point at a stable per-section id (1-2). Treat `aria-controls` as good practice, not a requirement. Also note APG is explicitly non-normative, so the `aria-expanded` mandate derives from WCAG SC 4.1.2 Name, Role, Value rather than from APG itself.

### 4.3 Table markup, less prescriptive than assumed

Verified 3-0 on the anchoring: table-structure failures land at **SC 1.3.1 Info and Relationships, Level A**, and since AA conformance requires satisfying all Level A criteria, a structural failure blocks AA.

But both specific markup prescriptions were refuted 0-3: `<th>` for headers versus `<td>` for data, and explicit `scope="col"` / `scope="row"` on two-directional headers. These are *sufficient techniques* (H51, H63, H39), not requirements. Only a genuine loss of programmatically determinable structure fails 1.3.1.

This confirms the internal audit's framing was right: FOOS's missing `scope` attributes and captions are good practice rather than conformance failures on single-header-row tables. Keep the recommendation, drop any suggestion that it is required.

### 4.4 Contrast, with no escape hatch at this type size

Verified 2-1. WCAG SC 1.4.3 Level AA requires 4.5:1 for text and 3:1 only for large-scale text, where large scale is at least 18 point (approximately 24px) or 14 point bold (approximately 18.5px). FOOS body text is 14px and meta text is 13px, both far below either threshold, so **the 3:1 allowance is unavailable and 4.5:1 applies without exception.**

That closes any argument that the four measured contrast failures might be excusable at small sizes. They are not.

One correction to how such findings should be cited: focus-indicator contrast belongs to SC 1.4.11 Non-text Contrast and SC 2.4.13, not to SC 2.4.7, which carries no contrast threshold of its own. SC 2.4.7 covers only whether a visible indicator exists.

The verifiers also refuted a specific arithmetic claim about a pale blue measuring 2.5:1, and their instruction was blunt: **measure the actual tokens.** That is what the internal audit did, so the four failures stand on measurement rather than on a general claim about pale blues.

## 5. Two of the five angles produced nothing

Verified as a gap, not as an absence of risk. Of the surviving claims, three concern Taleo, four concern dense-table design systems, and seven concern WCAG and ARIA. **Zero** address:

- **Modern ATS and CRM functional benchmarks for 2026:** requisition approval chains, candidate scorecards, unviewed-since-last-look signals, kanban stage boards, saved views, duplicate detection on intake, schema.org JobPosting careers-page SEO.
- **Engineering risk of two React frontends against one shared Postgres and Supabase schema**, and of hand-maintained generated database type files drifting from applied migrations.

The verifiers' own words: "Treat these two angles as open work, not as 'no risk found'."

The second gap is the more awkward one, because FOOS has three frontends on one schema and a confirmed case of type files agreeing with production while migrations disagree with both. That risk is real and measured internally; it simply has no external literature in this evidence set to calibrate against. One adjacent fragment is negative: a claim that TBE handled duplicates through a manual per-record Merge button was refuted 0-3, so even the legacy baseline for duplicate detection is unestablished.

## 6. What changed in the other documents because of this

| Finding | Effect |
| :---- | :---- |
| Sticky bars fail SC 2.4.11, FOOS has two with no scroll-padding | New defect D11; new task in the gap-closure spec and plan |
| Back To List must restore the exact list page, per Oracle's guide | New defect D12; new task |
| Most Taleo specifics undocumented | Fidelity claims reframed as "matches your instance", and the screenshots reclassified as irreplaceable evidence |
| Salesforce dense tables have no pagination | Candidate-list pagination reframed from best practice to a fidelity choice, with infinite scroll named as the alternative |
| Carbon caps rows at 64px for two-line content | Gives the long-text decision a target: cap at two lines, land near 64px |
| `role="region"` should be avoided past ~6 panels | Recorded so it is not added to the 15-section record page |
| `th` and `scope` are sufficient techniques, not requirements | Recommendation kept, "required" framing removed |
| No large-text allowance at 13-14px | The four contrast failures have no exemption available |

## 7. Sources

Taleo: `milcorp.com/assets/TaleoUserGuide11_41.pdf` (TBE 11.4 User Guide, October 2011), `oracle.com/webfolder/technetwork/tutorials/tutorial/cloud/taleo/17A2-tbe-wn.htm` (17A2 What's New), `tbe.taleo.net//common/TBE75ReleaseNotes.pdf` (TBE 7.5 Release Notes).

Design systems: `carbondesignsystem.com/components/data-table/usage/` plus the Carbon docs repo and `TableBatchActions.tsx`, `v10.carbondesignsystem.com/components/data-table/usage/`, `developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-datatable.html`.

Accessibility: `w3.org/TR/WCAG22/`, `w3.org/WAI/WCAG22/Techniques/failures/F110`, `w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html`, `w3.org/WAI/WCAG22/Understanding/contrast-minimum.html`, `w3.org/WAI/WCAG22/Understanding/focus-visible.html`, `w3.org/WAI/ARIA/apg/patterns/accordion/`, `w3.org/WAI/tutorials/tables/`, `webaim.org/articles/contrast/`, `scottohara.me/blog/2022/09/12/details-summary.html`, `github.com/IBMa/equal-access/issues/1301`.

## 8. Honest note on cost

This run used 110 agents, 812 tool calls and roughly 3.9M subagent tokens over 24 minutes, against a standing preference for one subagent at a time. It returned 11 verified findings, of which 3 changed a recommendation and 2 found a defect the internal audit missed. Judged on outcome it earned its place; judged on cost per finding it did not, and the two angles that mattered most for engineering risk returned nothing. A narrower brief on the two or three genuinely external questions would have been the better call.
