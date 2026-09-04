# V9: control geometry

Version 0.6, **still partial**. Heights are now computed from every capture in the dashboards, shell, recruit and sales manifests, 1,609 desktop element captures in the default or disabled state. Intake, the placeholder pages and settings are still being swept, and the computed padding, line-height and border behind each height arrive with `measure.spec.ts`. Nothing here is final, but the distribution is now four areas wide rather than two.

## What the stylesheet declares

No control declares a height anywhere in `app/src/styles`. Grep found `height` and `min-height` only on shell chrome, one 28px Taleo control and widget internals. Every control's height is therefore computed from its own padding, border and font metrics:

| Rule | Declared | Height comes from |
| :---- | :---- | :---- |
| `.btn` | `padding: 9px 18px`, `font-size: 14px`, `line-height: 1.25` | 20px box + 17.5px text |
| `.btn-sm` | `padding: 6px var(--sp-1)` = 6px 8px, `font-size: 13px` | 14px box + text at the inherited line-height |
| `.field input`, `.field select`, `.field textarea`, `.input` | `padding: 8px var(--cell-pad)` = 8px 10px, `font-size: 14px`, **no `line-height` at all** | 18px box + whatever the browser picks for that font |

That last row is the mechanism. An input's content box is decided by the user agent because nothing in the cascade sets it, so its height is not a design decision at all.

## What actually renders, so far

Desktop, default state, dashboards and shell only:

| Kind | n | Distinct heights | Spread |
| :---- | ----: | :---- | ----: |
| `button` | 1,313 | 16, 17, 18, 19, 20, 22, 24, 28, 30, 32, 34, 36, 38, 40, 44, 47, 48, 51, 64, 80, 96, 112 | 96px |
| `input-text` | 93 | 21, 24, 25, 34 | **13px** |
| `input-checkbox` | 63 | 13, 18 | 5px |
| `input-number` | 33 | 25, 34 | **9px** |
| `tab` | 30 | 23, 33, 34 | 11px |
| `link` | 28 | 16, 17, 34 | 18px |
| `select` | 28 | 36 | 0 |
| `input-date` | 7 | 36 | 0 |
| `input-search` | 6 | 34 | 0 |
| `textarea` | 4 | 50, 66, 145 | 95px |
| `input-file` | 2 | 21 | 0 |
| `input-datetime-local` | 1 | 36 | 0 |
| `input-email` | 1 | 34 | 0 |

**The 96px button spread is not a finding and must not be quoted as one.** Reading the labels behind it shows every capture from 47px up is a candidate name or a requisition title rendered as a button and wrapping onto two, three or four lines: `VVPH-3 AU MELBOURNE BD or Non-Tech` at 112px, `Comerica-6 NYC June 2026 Portfolio` at 96px. Those are content-sized by design. Excluding them, which means every button at 44px or below:

| Height | Captures | On the 8px grid | WCAG 2.5.8 AA, 24px |
| ----: | ----: | :---- | :---- |
| 16px | 55 | yes | **below** |
| 17px | 31 | no | **below** |
| 18px | 2 | no | **below** |
| 19px | 18 | no | **below** |
| 20px | 16 | no | **below** |
| 22px | 32 | no | **below** |
| 24px | 263 | yes | meets |
| 28px | 66 | no | meets |
| 30px | 110 | no | meets |
| 32px | 62 | yes | meets |
| 34px | 9 | no | meets |
| 36px | 2 | no | meets |
| 38px | 38 | no | meets |
| 40px | 68 | yes | meets |
| 44px | 294 | no | meets |

**Fifteen distinct chrome-button heights across 1,066 captures, a 28px spread.** The 28px spread from version 0.4 was right; the count of eight was low because it was two areas rather than four.

Three figures matter more than the list:

- **154 of 1,066 captures, 14.4%, are shorter than 24px**, which is the AA minimum target size in WCAG 2.5.8. This is the accessibility half of the height problem and it was invisible in the 0.4 figures.
- **Only 448 of 1,066, 42.0%, sit on the 8px grid** that the architecture document mandates.
- The two most common heights are **44px with 294 captures and 24px with 263**. The two values a user meets most often differ by 20px, so the inconsistency is not confined to rare controls.

And the field mismatch is worse than 0.4 recorded: a `select` is 36px everywhere, `input-text` is 21, 24, 25 or 34, and `input-number` is 25 or 34. A select sharing a filter row with a text input is a **12px** mismatch at worst and never matches at best, because 36 is not among the four heights an input takes.

## What is below the AA target, by name

The 154 sub-24px captures are not scattered noise. They cluster in five identifiable groups, which is what makes them fixable:

| Height | Distinct labels | What they are |
| ----: | ----: | :---- |
| 16px | 41 | `Remove bookmark My View: ...` and candidate name buttons in the Recently Viewed panel |
| 17px | 11 | `Add to shortlist` and more name buttons |
| 18px | 1 | `Back To List` |
| 19px | 4 | `My View: John Buena (Admin at ...)`, `Candidates`, `Accounts`, `Contacts` |
| 20px | 8 | `Undo`, `Redo`, `Bold`, `Italic`, `Underline`, `Bullet list` and two more: a rich-text toolbar |
| 22px | 4 | `First page`, `Previous page`, `Next page`, `Last page`: the pager arrows |

The pager row is the one to note. Every list in the product uses `Pager`, and its four navigation arrows are **22px tall**, two pixels under the AA minimum, on all 14 call sites.

## The finding stated precisely

It is not that every button should be one height. An icon button in a utility header and a primary nav tab have different jobs and Carbon publishes four sizes for exactly that reason.

The finding is that **eight arbitrary values are not a scale**. Carbon publishes 24 / 32 / 40 / 48 with a documented pairing rule, sm buttons with 32px fields and md with 40px ([carbondesignsystem.com/components/button/usage](https://carbondesignsystem.com/components/button/usage/)). FOOS has 16, 19, 24, 28, 30, 32, 40 and 44, of which 16, 19, 28 and 30 correspond to nothing published and are simply what padding plus a font produced. Three of the eight, 24, 32 and 40, already sit on the 8px grid the architecture document mandates. Five do not.

Two of those values are also accessibility failures rather than inconsistencies: the 16px and 19px controls are below the 24 by 24 that [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) requires at AA, and they are recorded with their names in the V10 document.

## Checkbox and radio size, which is more specific than "browser default"

Two different treatments, one deliberate and one absent:

| Checkbox | Rendered | Where it comes from |
| :---- | ----: | :---- |
| In a table, `.table .checkbox-col input[type='checkbox']` | **18 x 18px** with a 3px margin in a 44px column | declared deliberately in `widgets.css` |
| Everywhere else | **13 x 13px**, measured on the dashboard's "Include Onboarding/Offboarding Tasks" | no rule at all, so the browser's default |
| Radios | unsized | no rule beyond an `accent-color` transition in `motion.css` |

Both are below the 24 by 24 that WCAG 2.5.8 requires at AA, and the 18px table checkbox is below even Carbon's own in-table glyph of 20 by 20, which itself only passes through the spacing exception ([carbondesignsystem.com/components/data-table/style](https://carbondesignsystem.com/components/data-table/style/)).

**The spacing exception probably does apply here, and that has to be demonstrated rather than assumed.** For the table case the geometry is favourable: rows are 55 to 69px apart so the 24px circles around vertically adjacent checkboxes cannot intersect, and an 18px checkbox centred in a 44px column keeps its circle inside that column, away from the name link's box. If that holds, FOOS passes 2.5.8 by exception rather than by size.

W4 should size them to 24 regardless, because passing by exception means the compliance argument has to be re-made every time the table layout changes, and because a 13px glyph is small for a recruiter working a list all day whatever the specification permits.

## What the full measurement still has to establish

- The same distribution across recruit, sales, intake, settings and the placeholder pages, which hold every form and every table in the product.
- Every pair of controls that sits side by side within 8px vertically and differs by 2px or more, with the difference in pixels, which is what makes the complaint concrete for each screen.
- The computed `font-size`, `line-height`, padding and border behind each distinct height, which is what tells W1 whether a control is one declaration away from the scale or needs restructuring.
- Table row height against the tallest control inside the row, which is the case the fidelity audit already flagged at 69px against Carbon's 64px maximum.
- Label-to-control against control-to-control spacing, for the alignment half of W1.
- The computed `resize` of every textarea and `cursor` of every button, which are W13 and W14.
