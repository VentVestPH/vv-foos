# V9: control geometry

Version 0.4, **partial**. The figures here come from the capture manifest for the dashboards and shell areas only, which is what has been captured so far. The full measurement across all 28 routes, with the computed padding, line-height and border behind each height and every side-by-side mismatch named, replaces this document when the sweep finishes. Nothing here should be quoted as final.

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
| `button` | 120 | **16, 19, 24, 28, 30, 32, 40, 44** | **28px** |
| `select` | 2 | 36 | 0 |
| `link` | 4 | 34 | 0 |
| `input-text` | 13 | 21, 24 | 3px |

**Eight distinct button heights on two areas of the app**, and a select at 36px sharing forms with inputs at 24px, a 12px mismatch between the two controls most likely to sit side by side in a filter row.

## The finding stated precisely

It is not that every button should be one height. An icon button in a utility header and a primary nav tab have different jobs and Carbon publishes four sizes for exactly that reason.

The finding is that **eight arbitrary values are not a scale**. Carbon publishes 24 / 32 / 40 / 48 with a documented pairing rule, sm buttons with 32px fields and md with 40px ([carbondesignsystem.com/components/button/usage](https://carbondesignsystem.com/components/button/usage/)). FOOS has 16, 19, 24, 28, 30, 32, 40 and 44, of which 16, 19, 28 and 30 correspond to nothing published and are simply what padding plus a font produced. Three of the eight, 24, 32 and 40, already sit on the 8px grid the architecture document mandates. Five do not.

Two of those values are also accessibility failures rather than inconsistencies: the 16px and 19px controls are below the 24 by 24 that [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) requires at AA, and they are recorded with their names in the V10 document.

## What the full measurement still has to establish

- The same distribution across recruit, sales, intake, settings and the placeholder pages, which hold every form and every table in the product.
- Every pair of controls that sits side by side within 8px vertically and differs by 2px or more, with the difference in pixels, which is what makes the complaint concrete for each screen.
- The computed `font-size`, `line-height`, padding and border behind each distinct height, which is what tells W1 whether a control is one declaration away from the scale or needs restructuring.
- Table row height against the tallest control inside the row, which is the case the fidelity audit already flagged at 69px against Carbon's 64px maximum.
- Label-to-control against control-to-control spacing, for the alignment half of W1.
- The computed `resize` of every textarea and `cursor` of every button, which are W13 and W14.
