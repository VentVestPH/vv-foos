# V7 specifications: the remaining replacements

One section per replacement, in the order W should build them after the select. Each carries its contract, its props, what the native control gave away for free, and its tests. Contracts are from the V4 document, which was read from w3.org on 2026-09-04.

## Disclosure, replacing `details` and `summary`

**Cheapest item in the workstream and it should be built second**, because the contract is two keys and one attribute, and because FOOS already contains a working precedent.

Six `<details>` elements, all of them the advanced-search accordion: the candidate filter rail, the requisition list, deals, contacts, companies and the intake queue. Several are `open` by default.

**Contract.** [Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): `role="button"` on the trigger, `aria-expanded` reflecting visibility, `aria-controls` optional. Enter and Space toggle. Nothing else. Focus stays on the trigger.

**Why replace it at all**, since `details` is accessible already: the browser's open and close is instantaneous and cannot be transitioned, which conflicts with the motion budget `check-motion.mjs` enforces on every other expanding element. And the disclosure triangle is a browser glyph that does not match the chevron used by `RecordSection` two inches away on the same screen.

**Precedent to copy, not invent.** `RecordSection` already animates height in both directions within the budget and has a chevron with a transform transition. The replacement is `RecordSection`'s mechanics with the advanced-search markup, not a new design.

**Props.** `summary: ReactNode`, `defaultOpen?: boolean`, `children`, `id?`. No `open` prop unless a call site needs control, and none currently does.

**Tests.** Enter and Space both toggle; `aria-expanded` tracks; the height animates in both directions and stays inside the motion budget; focus stays on the trigger; the six call sites still render their filters.

## Checkbox and radio glyphs

18 checkboxes and 5 radios. The glyph, its size, the checked and indeterminate marks and the focus ring are all browser decisions today.

**Contract.** [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/): `aria-checked` true, false or **mixed**, and **Space only** changes state, since the APG does not list Enter. [Radio](https://www.w3.org/WAI/ARIA/apg/patterns/radio/): the group is one tab stop landing on the checked radio; arrows move and check, wrapping; **selection follows focus here**, which is the opposite of the combobox rule and is deliberate.

**Keep the native input.** Hide it visually, keep it in the accessibility tree and the tab order, and draw the glyph over it. That preserves form participation, the label association and screen-reader behaviour, and it is why this item is low risk.

**`mixed` is required, not optional.** Every list screen has a bulk-select header checkbox, which is exactly the tri-state case: some but not all rows selected. Today that is a browser-drawn indeterminate mark that cannot be styled.

**Size, and a conflict worth naming.** Carbon draws its in-table checkbox at 20 by 20 ([data-table/style](https://carbondesignsystem.com/components/data-table/style/)), which is below the 24 by 24 that [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) requires at AA, and passes only through the spacing exception. FOOS must either draw at 24, or draw smaller and satisfy the spacing exception deliberately and say so. Choosing 20 by accident is the failure mode.

**Tests.** Space toggles, Enter does not; `aria-checked` including `mixed` on the bulk header; the label click target still works; the focus ring matches every other control; the rendered target is at least 24 by 24 or the spacing exception is demonstrably met.

## Date and datetime input

15 `input[type="date"]` and 4 `input[type="datetime-local"]`. The calendar, the spinners, the segment layout and the placeholder format are all browser-decided and differ per browser.

**Contract.** [Date picker dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/): `role="dialog"` with `aria-modal="true"`, a `role="grid"` calendar with `gridcell` days, `aria-selected` on the chosen date, `aria-live="polite"` on the month and year header, `aria-describedby` on the input giving the expected format, and a trigger label that updates to "Change Date, DATE_STRING". Escape closes and returns focus to the trigger. Arrows move by day and week, Home and End to the week's ends, PageUp and PageDown by month, Shift+PageUp and Shift+PageDown by year. Focus moves into the dialog with roving `tabindex`, **not** `aria-activedescendant`, which is the opposite of the combobox.

**The text field stays typeable.** The calendar is an addition. A recruiter entering a date they already know must not be forced through a grid, and this is also the accessibility floor: the input keeps its name and value.

**One FOOS-specific hazard, already learned.** `tests/e2e/helpers.ts` carries `localDateTimeValue()` because `datetime-local` inputs are local time, and filling one from `toISOString()` puts the value hours out. On UTC+8 a "+1 hour" reminder lands in the past and the reminder sweep fires it. The replacement must not reintroduce that: it parses and emits local time, and its tests assert the round trip at a non-UTC offset.

**Tests.** Every key in the grid; Escape returns focus; typing a date without opening the calendar works; the format hint is announced; local-time round trip at UTC+8; 390px operability.

## Number input

12 `input[type="number"]`. The spinner arrows and their hit area are browser-decided, and their hit area is small.

Lowest priority of the replacements and possibly not worth doing: the honest options are to hide the spinners with `-webkit-inner-spin-button` and let the field behave as text with numeric validation, or to draw stepper buttons at the V9 control height. The audit's recommendation is the former unless a call site genuinely needs stepping, because a custom stepper is a real component with its own keyboard contract and 12 call sites do not obviously justify it. **This is a recommendation for Klent rather than a decision.**

## File input

1 `input[type="file"]`, in `modules/recruit/components/engagement.tsx`. The button label is locale-dependent and unstyleable, and so is the "no file chosen" text.

**There is no APG pattern for this.** Checked against the full [pattern index](https://www.w3.org/WAI/ARIA/apg/patterns/): 30 patterns, none covering file, upload or picker. The contract is therefore the [Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) plus WCAG 4.1.2 and 2.1.1, and the specification says so rather than implying the APG defines one.

**Approach.** Keep the real `<input type="file">` in the accessibility tree and the tab order, visually hidden but not `display: none`, with a styled `<label>` or button as its visible trigger. Show the chosen file name in our own markup. The button page's own warning applies: if it looks like a button it should be one.

**Tests.** Keyboard activation via Space and Enter; the input keeps its name and value; the chosen file name renders; the disabled state; and the existing attachment upload flow still works end to end.

## Focus ring and scrollbars

The two remaining browser decisions that show on every screen.

**Focus ring.** FOOS already uses `:focus-visible` in `states.css`. The audit item is consistency: every replacement above must adopt that ring rather than introduce its own, and pass 2 of the corpus is what shows whether it currently is consistent.

**Scrollbars.** A styling choice with an accessibility cost. Thin custom scrollbars reduce the target size of a control that WCAG 2.5.8 exempts as a user agent control, so restyling it removes the exemption's rationale. The audit's recommendation is to leave scrollbars alone unless Taleo's own appearance demands otherwise, and to record that as a deliberate decision rather than an oversight.
