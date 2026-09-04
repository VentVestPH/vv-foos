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
| `<textarea>` | 13 | the resize grabber | Partly, via `resize` |
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

## The `details` accordion

Six `<details>` elements, all of them the advanced-search accordion on a list screen: candidate filter rail, requisition list, deals, contacts, companies, and the intake queue. Several are `open` by default.

**One browser decision here, not two.** The disclosure triangle is already replaced: `controls.css` hides it with `.fo-advanced-search summary::-webkit-details-marker`. What remains is the instantaneous open and close, which cannot be transitioned, and which conflicts with the motion budget `check-motion.mjs` enforces on every other expanding element. Verified in source: `.fo-advanced-search` carries no `transition` at all, while `motion.css` transitions `.record-section-collapse` on `grid-template-rows`. FOOS already has an accordion that animates its height correctly, `RecordSection`, so the replacement has a working precedent inside the codebase rather than needing a design.
