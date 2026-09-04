# V4: the WAI-ARIA contract each replacement must honour

Read from the primary source on 2026-09-04, not recalled. Every URL below was fetched. Where the APG does not cover something, this says so rather than inventing a contract.

## Listbox and combobox, the select replacement

Sources: [combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/), [select-only example](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)

**Required.** `role="combobox"` on the control, `aria-controls` pointing at the popup, `aria-expanded` true/false. On the popup: `role="listbox"`, `role="option"` per item, and `aria-selected` **or** `aria-checked` but never both in one listbox. An accessible name on both the combobox and the listbox, via `aria-labelledby` or `aria-label`.

**Optional.** `aria-activedescendant` (needed for the recommended focus model), `aria-haspopup` (only when the popup is not a listbox), `aria-autocomplete`, `aria-orientation`, `aria-setsize` and `aria-posinset` for virtualised lists, `role="group"` for grouped options. `aria-owns` is legacy and superseded by `aria-controls`.

**Keyboard, closed.** Down or Alt+Down opens without moving visual focus or changing selection. Up opens with visual focus on the first option. Enter and Space open. Home and End open with focus on first or last. Printable characters open and move visual focus to the first match; characters typed in quick succession match the accumulated string, and a repeated character cycles through options starting with it.

**Keyboard, open.** Enter sets the value and closes. Space sets the value and returns focus to the combobox. Tab sets the value, closes, and moves on. Escape closes and returns visual focus to the combobox. Down and Up move visual focus without wrapping in the APG example. Alt+Up sets the value and closes. Home and End jump to first and last. PageUp and PageDown move 10 options. Type-ahead as above.

**Focus.** DOM focus never leaves the combobox for a listbox, grid or tree popup: the APG requires focus to stay put with `aria-activedescendant` naming the visually focused option. Only a `dialog` popup takes real DOM focus. On close, focus returns to the combobox.

**Warnings the APG states explicitly.** Do not capture key events that break browser text editing in an editable combobox. Options must not contain interactive children (that is the Grid pattern) nor semantic elements such as headings, because screen readers lose those semantics. Avoid repeated prefixes and very long option names.

**The two model choices, and what they cost.** These are separate decisions and the APG permits both.

- *Selection following focus* is allowed, and the [keyboard interface practice](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) explains the trade-off: it is good when the result is instantaneous, letting a keyboard user reach the fourth of six options with three arrow presses; but where the change costs a network request, "the effect of having selection automatically follow focus can be devastating to the experience for keyboard and screen reader users".
- *`aria-activedescendant` versus roving `tabindex`* is the focus-tracking choice. The listbox page calls `aria-activedescendant` an alternative to moving DOM focus. The cost, stated on the keyboard-interface page: with roving `tabindex` "the user agent will scroll the newly focused element into view", and with `aria-activedescendant` you must do that scrolling yourself.

**What that means for FOOS.** For a combobox the choice is narrower than for a bare listbox, because the pattern requires DOM focus to stay on the combobox. So `aria-activedescendant` is effectively mandatory, we own the scroll-into-view, and selection must **not** follow focus, since several FOOS selects drive a filtered query and a network round trip.

## Date picker dialog

Source: [datepicker dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)

`role="dialog"` with `aria-modal="true"`; `role="grid"` on the calendar with `role="gridcell"` days; `aria-selected="true"` on the chosen date; `aria-live="polite"` on the month and year header; `aria-describedby` on the text input giving the expected format; and an `aria-label` on the trigger that updates to "Change Date, DATE_STRING" after selection.

Keyboard: Space or Enter opens. Escape closes and returns focus to the button. Tab and Shift+Tab cycle and wrap inside the dialog. In the grid, Space or Enter selects, closes and writes the input; arrows move by day and week; Home and End go to the first and last day of the week; PageUp and PageDown change month; Shift+PageUp and Shift+PageDown change year.

Focus: real DOM focus moves into the dialog, managed by roving `tabindex`, **not** `aria-activedescendant`. On open, focus the day matching the input, or today if the input is empty or invalid. On close or cancel, focus returns to the trigger.

## Checkbox, including mixed

Source: [checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)

`role="checkbox"`, `aria-checked` true/false/mixed, and an accessible name from content, `aria-labelledby` or `aria-label`. Optionally `role="group"` with `aria-labelledby` for a set, and `aria-describedby` for static help.

**Space only** changes state. The APG does not list Enter. `mixed` applies when some but not all controlled options are checked; activation cycles the state and may optionally restore the previous partial set on a third activation.

FOOS needs `mixed`: the bulk-select header checkbox on every list is exactly the tri-state case.

## Radio group

Source: [radio pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)

`role="radiogroup"` with a name; `role="radio"` per button with `aria-checked` and its own name. Tab and Shift+Tab treat the group as one stop, landing on the checked radio or the first. Space checks the focused radio. Right and Down move forward, unchecking the previous and checking the newly focused one, wrapping last to first; Left and Up reverse it. **Selection therefore follows focus by default** for radios, which is the opposite of the combobox recommendation. Inside a toolbar, arrows do not change the checked state and Space does the checking.

The APG warns that this initial focus behaviour "differs slightly from the behavior provided by some browsers for native HTML radio groups", and that Shift+Tab entry varies across implementations.

## Disclosure, the details and summary replacement

Source: [disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)

`role="button"` on the trigger and `aria-expanded` reflecting visibility. `aria-controls` is **optional**. Enter and Space both toggle, and nothing else. No focus-management rule: focus stays on the trigger, per the [button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).

This is the cheapest replacement in the set: six `details` elements, all the advanced-search accordion, and the contract is two keys and one attribute.

## File input: the APG has no pattern for it

Checked against the full [pattern index](https://www.w3.org/WAI/ARIA/apg/patterns/): 30 patterns, none covering file input, upload or picker. **This corrects an assumption in the workstream V plan**, which listed a file-input contract as if the APG defined one.

The applicable primary guidance is the Button pattern plus WCAG. `role="button"` if the trigger is not a real button, an accessible name, Space and Enter both activating, `aria-disabled="true"` when unavailable. The button page also carries the relevant warning: when an element looks like one thing and acts like another, "a better solution is to adjust the visual design so it matches the function and ARIA role". From WCAG rather than the APG: 4.1.2 Name, Role, Value means a visually hidden `<input type="file">` must keep a programmatic name and value rather than be removed, and 2.1.1 Keyboard applies.

Anything claiming an APG keyboard contract for a file trigger is extrapolating from Button, and the specification should say so.
