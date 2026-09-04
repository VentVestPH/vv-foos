# V7 specification: the select replacement

The first specification, because it is the case Klent named and because it is one component behind 54 call sites. Implementation is workstream W2 and should be mechanical from this document.

## What exists today

`app/src/components/ui/Select.tsx`, 52 lines. It renders a native `<select>` wrapped in `.field`, with an optional `.field-label`, an optional `.field-error-text`, a `placeholder` rendered as an empty-valued first `<option>`, and it spreads the rest of `SelectHTMLAttributes` onto the element.

```
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}
```

Used 54 times across 23 files. Every one of those call sites passes `options`, most pass `value` and `onChange`, and many pass `label`.

## What must not change

The replacement is a drop-in. **The public props stay the same** so no call site changes, which is what keeps W2 to one file plus its tests rather than 23 files:

- `label`, `error`, `options`, `placeholder`, `required`, `id`, `value`, `onChange`, `disabled`, `name`, `aria-label`, `className`.
- `onChange` continues to receive an event whose `target.value` is the selected value, so existing handlers written for a `<select>` keep working. If that proves impossible, the fallback is a `value: string` second signature and 54 call-site edits, and that decision belongs to Klent because it changes the size of the work.
- The rendered wrapper stays `.field` with `.field-label` and `.field-error-text`, so no existing CSS or test selector breaks.

## The contract it must honour

From the [APG combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) and the [select-only example](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/), read on 2026-09-04. Full detail in the V4 document.

**Structure.** A `role="combobox"` button-like control carrying `aria-controls` to the popup, `aria-expanded`, and its accessible name from the existing `<label>` via `aria-labelledby`. The popup is `role="listbox"` with `role="option"` children carrying `aria-selected`. Not both `aria-selected` and `aria-checked`.

**Focus model, and it is not a free choice.** DOM focus stays on the combobox, and `aria-activedescendant` names the visually focused option. The APG requires this for a listbox popup. Two consequences the implementation owns: we scroll the active option into view ourselves, because the user agent will not; and the option elements never receive real focus.

**Selection must not follow focus.** Several FOOS selects drive a filtered query and a network round trip, and the APG's keyboard-interface practice is explicit that in that case selection following focus "can be devastating to the experience for keyboard and screen reader users". Arrows move visual focus only. Enter, Space, Tab or Alt+Up commit.

**Keyboard map.**

| Key | Closed | Open |
| :---- | :---- | :---- |
| Down, Alt+Down | open, no selection change | move visual focus down |
| Up | open with focus on the first option | move visual focus up |
| Alt+Up | — | set value, close |
| Enter | open | set value, close |
| Space | open | set value, close, focus returns to the combobox |
| Home, End | open with focus on first or last | first or last option |
| PageUp, PageDown | — | move 10 options |
| Escape | — | close, focus to the combobox |
| Tab | normal tab order | set value, close, move on |
| printable characters | open and jump to the first match | jump to the first match; successive characters match the accumulated string, a repeated character cycles |

**Prohibited by the APG.** Options must not contain interactive children or semantic elements such as headings. If a FOOS dropdown ever needs a button inside a row, that is the Grid pattern and a different component.

## Tokens and geometry

No hard-coded values. The control takes its height from the V9 scale, and its menu items match the field height, which is the rule Carbon publishes for its dropdown: "the menu item height must equal the field height" ([carbondesignsystem.com/components/dropdown/style](https://carbondesignsystem.com/components/dropdown/style/)).

- Field height: `--control-h` from V9.
- Menu item height: the same token.
- Colours: existing `--fo-*` tokens only, and the focus ring is whatever `states.css` already gives every other control, so the replacement does not introduce a second focus idiom.
- Motion: the open and close must sit inside the budget `check-motion.mjs` enforces. `--motion-instant` for the colour change, and the menu appearing should reuse the dropdown animation the codebase already has rather than a new one.

## Behaviour the native control gave us for free, and now must be built

Each of these is a line item for W2, because each is a way the replacement can be worse than what it replaces:

1. **Type-ahead**, including the accumulated-string and repeated-character rules above.
2. **Scrolling the active option into view**, since `aria-activedescendant` does not do it.
3. **A maximum popup height with its own scroll**, because 54 call sites include status and source lists with tens of options.
4. **Placement**, including flipping above the field when there is no room below, which the OS popup handled.
5. **Closing on outside click, on scroll of an ancestor, and on route change.**
6. **Form participation.** A native select posts its value; a div does not. Every FOOS form using `Select` reads React state rather than the DOM, which must be confirmed call site by call site during W2 rather than assumed.
7. **Mobile.** At 390px the OS select opens a native wheel or sheet that is genuinely good. A custom popup must be at least as usable at that width, and this is the one place where the replacement risks being worse. If it is, keeping the native control below a breakpoint is a legitimate outcome and should be stated rather than hidden.

## Tests W2 must ship with it

- Every key in the map above, asserted against the rendered DOM.
- `aria-expanded`, `aria-controls`, `aria-activedescendant` and `aria-selected` correct in each state.
- Selection does not change while arrowing, and does change on Enter, Space, Tab and Alt+Up.
- Type-ahead: single character, accumulated string, repeated character cycling.
- The popup scrolls the active option into view.
- Closes on Escape, outside click and route change, with focus returned to the combobox.
- A long option list does not grow the popup past its maximum height.
- At 390px, the control is operable and the popup does not exceed the viewport.
- The existing 54 call sites still compile and their pages still render, which the browser suite covers.
