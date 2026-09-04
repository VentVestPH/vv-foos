# V11: the published references this audit judges against

Fetched on 2026-09-04. Every figure below is quoted from a page that was actually read, and where a figure is **not published** this says so instead of estimating. That distinction is the point of the item: a target height invented here would be taste wearing a citation.

## Control height and touch target

| Source | Published figure | URL |
| :---- | :---- | :---- |
| Carbon, button | xs 24, sm 32, md 40, lg 48, xl 64, 2XL 80 (px). Label 14px, and no element within 16px of the border | [button/style](https://carbondesignsystem.com/components/button/style/) |
| Carbon, text input | sm 32, md 40, lg 48 | [text-input/style](https://carbondesignsystem.com/components/text-input/style/) |
| Carbon, dropdown | field sm 32, md 40, lg 48, and **the menu item height must equal the field height**; fluid field 64, condensed menu item 40 | [dropdown/style](https://carbondesignsystem.com/components/dropdown/style/) |
| Carbon, pairing rule | "Small: use when buttons are paired with 32px small sized input fields. Medium: … 40px medium sized input fields. Large (productive): this is the most common button size in software products. Pairs with 14px body copy." | [button/usage](https://carbondesignsystem.com/components/button/usage/) |
| GOV.UK | **Not published.** The text input and button pages carry no height, padding or target-size figure | [text-input](https://design-system.service.gov.uk/components/text-input/), [button](https://design-system.service.gov.uk/components/button/) |
| Material 3 | **Not verifiable.** m3.material.io is a JavaScript application that returns only "This website requires JavaScript" to a fetcher, so no height was reachable | [buttons/specs](https://m3.material.io/components/buttons/specs) |
| WCAG 2.5.8, AA | targets "at least **24 by 24 CSS pixels**", with exceptions for spacing, equivalent, inline, user agent control and essential | [target-size-minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| WCAG 2.5.5, AAA | "at least **44 by 44 CSS pixels**" | [target-size-enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) |

Carbon's own in-table checkbox and radio are 20 by 20 ([data-table/style](https://carbondesignsystem.com/components/data-table/style/)), below the WCAG 24, and pass 2.5.8 only through the spacing exception. Worth knowing before FOOS copies a 20px glyph into a dense row.

**Consequence for V9.** Carbon is the only source that publishes a control-height scale, and its 32 / 40 / 48 sits on the 8px grid the FOOS architecture document already mandates. That makes it the defensible anchor for the height scale, with 14px body copy pairing to the 48 productive size and the dense table pairing to 32.

## Form layout and label placement

| Source | Rule | URL |
| :---- | :---- | :---- |
| NN/g | "We recommend placing field labels above the corresponding text fields… users can see the text field in the same fixation as the label." Left labels are allowed "if form length is a concern", and right-aligned labels "make it more difficult to scan the form". **No completion-time figure is published in that article** | [form-design-white-space](https://www.nngroup.com/articles/form-design-white-space/) |
| NN/g | "the best solution is to have clear, visible labels that are placed outside empty form fields", so a placeholder is not a label | [form-design-placeholders](https://www.nngroup.com/articles/form-design-placeholders/) |
| GOV.UK | "You should align labels above the text input they refer to." Hint text sits between label and input, "a single short sentence, without any full stops" | [text-input](https://design-system.service.gov.uk/components/text-input/) |
| Carbon | Top-aligned labels are "Carbon's default… and the only label arrangement currently offered". Labels one to three words, no colons. Helper text below the label, never instead of it. For side-by-side fields where only one has helper text, "always top align the input fields, not the labels" | [forms-pattern](https://carbondesignsystem.com/patterns/forms-pattern/) |

The frequently repeated claim that top labels are measurably faster to complete is **not** supported by a figure in the NN/g article that is usually cited for it. The recommendation is published; the number is not.

## Table density and row height

| Source | Figure | URL |
| :---- | :---- | :---- |
| Carbon, rows | xs 24, sm 32, md 40, lg 48, xl 64. The column header row "should always match the row size of the table". xl is "only recommended if your data is expected to have two lines of content in a single row" | [data-table/style](https://carbondesignsystem.com/components/data-table/style/) |
| Carbon, pairing | Toolbar and batch-action bar at 48 pairs with lg and xl rows; 32 pairs with sm and xs. Column padding 16. Row text 14px, column header 14px SemiBold | same |
| Carbon, when to go dense | Only the pairings, plus "give your data table the most width on the page to help your user view dense data". **No threshold rule is published** | [data-table/usage](https://carbondesignsystem.com/components/data-table/usage/) |
| Material 3 | **Not published.** The M3 sitemap lists no data table component at all | [sitemap.xml](https://m3.material.io/sitemap.xml) |

## Empty states

| Source | Requirement, and the named anti-pattern | URL |
| :---- | :---- | :---- |
| Carbon | Anatomy: optional image, **title** phrased positively, **body** explaining the next action, optional primary action, optional secondary link, left-aligned as a block. "Empty states should replace the element that would ordinarily show", including a table's column headers and footer, so a screen reader does not read an entire empty table first. Don'ts: several options in one empty state, product jargon, content about other areas, and "don't lead the user into a dead end" | [empty-states-pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/) |
| NN/g | Three jobs: system status, learning cues, direct pathways. Named anti-patterns: **totally empty containers**, which "creates confusion and decreases user confidence", and **inaccurate system-status messages**, "particularly harmful", such as showing "No records" before the data has loaded | [empty-state-interface-design](https://www.nngroup.com/articles/empty-state-interface-design/) |

That second anti-pattern is directly relevant: FOOS list pages render a colspan "no results" row while the first query is still in flight, which is the exact case NN/g names.

## Errors and validation

| Source | Rule | URL |
| :---- | :---- | :---- |
| GOV.UK, summary | "Put the error summary at the top of the `main` container", below breadcrumbs but above the `h1`. Heading **"There is a problem"**. Show it "even if there's only one" error. "You must move keyboard focus to the error summary." Each item links to the field in error, and the summary wording must match the inline message | [error-summary](https://design-system.service.gov.uk/components/error-summary/) |
| GOV.UK, inline | "put the message in red **after the question text and hint text**", so the order is label, hint, error, input, and "use a red border to visually connect the message and the question it belongs to". A visually hidden "Error:" prefix | [error-message](https://design-system.service.gov.uk/components/error-message/) |
| WCAG 3.3.1, A | "If an input error is automatically detected, the item that is in error is identified and the error is described to the user in text." | [error-identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) |
| WCAG 3.3.3, AA | suggestions for correction must be provided when known, "unless it would jeopardize the security or purpose of the content" | [error-suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html) |

## Destructive confirmation

Source throughout: [confirmation-dialog](https://www.nngroup.com/articles/confirmation-dialog/), plus [proximity-consequential-options](https://www.nngroup.com/articles/proximity-consequential-options/)

- Confirm before "actions with serious consequences — such as destroying users' work or costing large amounts of money", particularly those that cannot be undone.
- The dialog must "restate the user's request and explain what the computer is about to do, with specific information that allows users to understand the effects of their action".
- Buttons are not OK and Cancel: "use buttons labeled **Delete file** and **Keep file**".
- Overuse defeats it: "if you cry wolf too many times, people will stop paying attention".
- **Type-to-confirm is recommended, but only for the top tier** of dangerous operations, citing MailChimp's deletion flow.
- Prefer undo where you can: "go to great lengths to provide undo, because some user errors will remain despite even the best of confirmation dialogs", and for repetitive actions prefer a salient undo over a confirmation.
- Confirmatory and destructive actions should sit far apart with redundant visual signals.

FOOS already implements type-to-confirm on candidate erasure, which is the correct tier for it. Neither GOV.UK nor Carbon publishes a type-to-confirm rule.
