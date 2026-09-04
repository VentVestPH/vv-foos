# V3: what the browser is deciding for us

Counted from source on 2026-09-04 with `grep` over `app/src`, then cross-checked against the rendered corpus. Every count below is a measurement, not an estimate.

## The inventory, corrected

| Control | Count | Where the browser decides | Styleable? |
| :---- | ----: | :---- | :---- |
| `<select>` | **2** | the entire option list: font, size, colours, hover, scroll, max height, and its position | No. The popup is an OS-level widget outside the page |
| `input[type="date"]` | 15 | the calendar picker, the spinner arrows, the internal segment layout, the placeholder format | Effectively no. Only vendor pseudo-elements, differently per browser |
| `input[type="datetime-local"]` | 4 | same as date, plus the time segments | Effectively no |
| `input[type="number"]` | **12** | the spinner arrows and their hit area | Partly, via `-webkit-inner-spin-button` |
| `input[type="checkbox"]` | 18 | the glyph, its size, the checked and indeterminate marks, the focus ring | Only by hiding it and drawing a replacement |
| `input[type="radio"]` | 5 | the glyph and the checked dot | Same |
| `input[type="file"]` | 1 | the button label text, which is locale-dependent, and the "no file chosen" text | No. The button cannot be styled or relabelled |
| `<details>` / `<summary>` | 6 / 6 | **only the instant open and close.** Correction: the triangle is already replaced, `controls.css` hides it with `::-webkit-details-marker`, so it was never an outstanding browser decision | The instant toggle cannot be animated without JS |
| `<textarea>` | 13 | the resize grabber, and on both axes wherever no module rule reaches the element | Yes, and the fix is one shared declaration. `resize: vertical` exists already but only in five narrow module rules |
| text-ish `<input>` | 31 | autofill styling, the search field's clear button in some browsers | Partly |

**Two corrections to the workstream V plan.** It listed the inventory as "31 input, 18 checkbox, 15 date, 13 textarea, 6 details, 5 radio, 2 select, 1 file", which omitted **12 `input[type="number"]`** and **4 `input[type="datetime-local"]`**, both of which have browser-decided controls. The corrected total of native controls is **107**.

## The select is one component, not fifty-four

This is the most important structural finding of V3, because it changes the size of the work.

There are only two `<select>` elements in the entire application. One is a disabled decorative control inside `pages/ModulePlaceholderPage.tsx`. The other is the single shared `components/ui/Select.tsx`, and every real dropdown in FOOS routes through it:

- `<Select>` is used **54 times across 23 files**.
- `<Input>` is used **95 times across 27 files**.

So Klent's complaint, "dropdown options are default browser. i dont like that", resolves to replacing **one component** whose 54 call sites inherit the fix. That makes it both the highest-value and the lowest-risk item in the workstream, which is why it leads the priority order.

## What cannot even be photographed

The audit harness attempts to open the first `<select>` on every screen and capture the result. The native option list does not appear in any page screenshot, because it is drawn by the operating system rather than by the page. That is recorded in the corpus as a note on each `select-clicked` capture.

This is worth stating precisely, because it is the strongest single argument for replacement: **a control whose open state cannot be captured by the page cannot be styled by the page, tested by the page, or made to match Taleo by the page.** It is not a matter of effort. There is no CSS that reaches it.

## Two browser defaults that are one declaration each

Verified by grep on 2026-09-04, and both are W items Klent named directly.

**`resize` is declared five times, in four module stylesheets, under five narrow selectors.** Corrected within the hour: I first wrote that `resize` appears nowhere in `app/src/styles` and concluded that all 13 textareas inherit the user agent's `resize: both`. The grep was literally true and the conclusion was wrong, because these rules live in `modules/`, not `styles/`, and the W brief had already said so. The five are:

| Rule | Selector |
| :---- | :---- |
| `modules/intake/intake.css:176` | `.intake-url-textarea` |
| `modules/recruit/recruit.css:134` | `.rq-form textarea` |
| `modules/recruit/recruit.css:253` | `.panel-form textarea` |
| `modules/sales/sales.css:72` | `.sales-textarea` |
| `modules/settings/settings.css:128` | `.template-form textarea` |

All five say `vertical`, so there is no conflict to resolve, and because module layers come last in the layer order they win over anything shared regardless of specificity. What is unknown is **coverage**: a textarea is protected only if it carries one of those two classes or sits inside one of those three containers, and textareas appear in **13 files**. `analyse.mjs` reports every textarea whose computed `resize` is neither `vertical` nor `none`, so the gap is measured rather than assumed. The fix is still one declaration on the shared textarea rule, after which the five module rules are redundant and can go.

**`cursor: pointer` is declared 22 times, selector by selector, rather than once.** `.btn` carries it, so every control built from the shared `Button` is correct, and `.btn:disabled` correctly reverts to `default`. The gap is every interactive element that is not a `.btn`: the name buttons in a table cell, the icon buttons, the tab strips and the section headers. Which of those actually lack it is a measurement rather than a grep, because the cascade may reach them through another selector, so `measure.spec.ts` records the computed `cursor` of every button, link, tab and summary and `analyse.mjs` lists the ones that are not `pointer`.

## The `details` accordion

Six `<details>` elements, all of them the advanced-search accordion on a list screen: candidate filter rail, requisition list, deals, contacts, companies, and the intake queue. Several are `open` by default.

**One browser decision here, not two.** The disclosure triangle is already replaced: `controls.css` hides it with `.fo-advanced-search summary::-webkit-details-marker`. What remains is the instantaneous open and close, which cannot be transitioned, and which conflicts with the motion budget `check-motion.mjs` enforces on every other expanding element. Verified in source: `.fo-advanced-search` carries no `transition` at all, while `motion.css` transitions `.record-section-collapse` on `grid-template-rows`. FOOS already has an accordion that animates its height correctly, `RecordSection`, so the replacement has a working precedent inside the codebase rather than needing a design.
