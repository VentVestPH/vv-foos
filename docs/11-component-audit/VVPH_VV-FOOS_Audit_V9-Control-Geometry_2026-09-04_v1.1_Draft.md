# V9: control geometry

Version 1.1. The measurement has run and been recomputed after three flaws in the analysis, all described in pass 6. Heights, computed styles and the WCAG 2.5.8 verdict below are final; the focus-ring contrast, the cursor audit and the side-by-side mismatch table are being recomputed after three flaws in my own analysis, described in pass 6. Originally 0.6, and still carrying its sweep-derived figures above for comparison. Heights are now computed from every capture in the dashboards, shell, recruit and sales manifests, 1,609 desktop element captures in the default or disabled state. Intake, the placeholder pages and settings are still being swept, and the computed padding, line-height and border behind each height arrive with `measure.spec.ts`. Nothing here is final, but the distribution is now four areas wide rather than two.

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

The pager row is the one to note, and it is the one that turned out to conform. Every list in the product uses `Pager` and its four navigation arrows are **22px tall**, two pixels under the AA minimum, on all 14 call sites. But 2.5.8 carries a spacing exception, and computing it rather than asserting it settles the question: `.fo-pager-controls button` has `min-width: 26px` in a flex row with `gap: var(--sp-half)`, which is 4px, so adjacent centres are **30px** apart where two 24px circles need 24px. The pager is a single row, so nothing is vertically adjacent. **The pager arrows conform to 2.5.8 by the spacing exception.**

That leaves the honest position: **154 controls are below the AA size and the number that actually fail 2.5.8 is not yet known.** It may be zero. `analyse.mjs` now centres a 24px circle on every measured sub-24px control and finds the nearest other target's centre on the same screen and viewport, so the answer will be computed per control rather than argued per group. W4 should still size them up, for the reason V9 already gives about the table checkbox: conforming by exception means re-making the argument every time a layout changes.

## The finding stated precisely

It is not that every button should be one height. An icon button in a utility header and a primary nav tab have different jobs and Carbon publishes four sizes for exactly that reason.

The finding is that **eight arbitrary values are not a scale**. Carbon publishes 24 / 32 / 40 / 48 with a documented pairing rule, sm buttons with 32px fields and md with 40px ([carbondesignsystem.com/components/button/usage](https://carbondesignsystem.com/components/button/usage/)). FOOS has 16, 19, 24, 28, 30, 32, 40 and 44, of which 16, 19, 28 and 30 correspond to nothing published and are simply what padding plus a font produced. Three of the eight, 24, 32 and 40, already sit on the 8px grid the architecture document mandates. Five do not.

Two of those values are also accessibility failures rather than inconsistencies: the 16px and 19px controls are below the 24 by 24 that [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) requires at AA, and they are recorded with their names in the V10 document.

## The row-level controls, measured by name

The sub-24px groups above are named by height. These five are the controls a recruiter touches on every row of every list, measured individually, and they do not behave as one group.

| Control | Rendered | Where the size comes from | WCAG 2.5.8 |
| :---- | :---- | :---- | :---- |
| Star, `1 star` / `2 stars` / `3 stars` | **24 x 24** | `widgets.css:227`, `.star-grade .star { min-width: 24px; min-height: 24px }`, declared deliberately | **meets AA outright** |
| `Edit` | 30 x 42 | `.btn-sm` padding | meets |
| `Select row` checkbox | 18 x 18 | `widgets.css`, declared, centred in a 44px column | below; conforms by spacing, per the note below |
| `Add to shortlist` | **17 x 14** | no rule; an icon button sized by its glyph | below, **and the smallest interactive target measured anywhere in the product** |

Two things follow that I would not have guessed from the stylesheet.

**The stars already pass.** Someone declared 24 by 24 on them on purpose, and 63 star captures across the corpus render at exactly that. So the target-size work in W4 is narrower than "size the small controls up": the star grade is done, and what it needs instead is the keyboard contract in V6 row 27.

**`Add to shortlist` at 17 by 14 is the worst target in FOOS**, and there are 21 of them on the requisition record. It is 14px wide, which is under 60% of the AA minimum on that axis, and unlike the pager arrows and the table checkbox it has no declared size at all: it is an icon button whose box is whatever the glyph produced. Whether the spacing exception rescues it is being computed from the measured boxes rather than assumed, and it is the one control where I would expect the exception to fail, because the exception is about neighbours and this control's problem is its own size.

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

## Measured: 3,948 controls on all 31 routes at both viewports

The sweep-derived figures above came from capture bounding boxes. These come from `measure.spec.ts` reading the computed style of every control, and they supersede them where they differ.

### Every distinct rendered height, desktop

| Kind | Distinct heights | Count | Spread |
| :---- | :---- | ----: | ----: |
| `button` | 16, 17, 18, 20, 22, 23, 24, 28, 30, 32, 33, 34, 36, 38, 40, 44, 47, 48, 51, 64, 80, 96, 112 | 1,505 | 96px |
| `link-btn` | 16, 17, 18, 24, 32, 34, 48, 51, 64, 80, 96, 112 | 137 | 96px |
| `btn-class` | 20, 30, 38 | 199 | 18px |
| `input-text` | 21, 24, 25, 34 | 122 | **13px** |
| `badge` | 21, 23 | 97 | 2px |
| `input-checkbox` | 13, 18 | 65 | 5px |
| `input-number` | 25, 34 | 33 | 9px |
| `select` | **19, 36** | 30 | **17px** |
| `input-search` | 34 | 7 | 0 |
| `input-date` | 36 | 7 | 0 |
| `textarea` | 50, 66, 114, 145, 146 | 6 | 96px |
| `input-file` | 21 | 2 | 0 |
| `input-datetime` | 36 | 1 | 0 |
| `input-email` | 34 | 1 | 0 |

**One correction to the earlier figures: `select` is not one height.** The sweep showed 36px everywhere; the measurement finds **19px and 36px**, a 17px spread across 30 instances. Everything else holds, and the 96px spreads on `button` and `link-btn` are the content-sized wrapping already excluded from the chrome analysis above.

### Why the heights differ, from the computed styles

| Kind | `font-size` | `line-height` | padding | border | height |
| :---- | :---- | :---- | :---- | :---- | ----: |
| `button` | 14px | **normal** | 0/0 | 0 | 16px |
| `button` | 14px | **normal** | 2/2 | 1px | 22px |
| `button` | 13.33px | **normal** | 4/4 | 0 | 24px |
| `button` | 14px | **normal** | 8/8 | 0 | 32px |
| `button` | 13px | 16.25px | 6/6 | 1px | 30.25px |
| `button` | 14px | 17.5px | 9/9 | 1px | 37.5px |
| `button` | 16px | **normal** | 10/10 | 0 | 40px |
| `input-text` | 13.33px | **normal** | 1/1 | 2px | 21px |
| `input-text` | 14px | **normal** | 2/2 | 0 | 24px |
| `input-text` | 14px | **normal** | 8/8 | 1px | 34px |
| `select` | 14px | **normal** | 8/8 | 1px | 36px |
| `input-checkbox` | 13.33px | **normal** | 0/0 | 0 | 13px |

**This is the mechanism, and it is now measured rather than inferred.** Only two rules in the entire product set a `line-height` on a control: `.btn` at 17.5px and `.btn-sm` at 16.25px, which produce the two stable heights, 37.5px and 30.25px. **Every other control computes `line-height: normal`**, so its height is whatever the user agent derives from the font metrics plus padding plus border. A 13.33px font appears repeatedly, which is the browser's own default for a form control that inherits nothing. That is why there is no scale: for most controls nobody chose a height, and for several nobody chose a font size either.

### WCAG 2.5.8, computed per control rather than argued

Every control under 24px on a side, with a 24px circle centred on it, against the nearest other target's centre on the same screen and viewport:

| | Controls |
| :---- | ----: |
| Under 24px on a side | **643** |
| Rescued by the spacing exception | **615** |
| **Failing 2.5.8 outright** | **28** |

**The 28 are two groups, and neither is the one I expected.** The pager arrows conform, as V9 0.6 already established, and so do the stars at 24 by 24.

**The requisition owners checkbox list, 20 of the 28.** Four native checkboxes at **13 by 13**, stacked **23px** between centres where the exception needs 24. It fails by **one pixel**, on `recruit-requisition-new` and `recruit-requisition-edit` at both viewports, and `sales-contact-new`'s two checkboxes have the same 23px spacing. This is V10 observation 31's unsized checkbox list, now shown to fail outright rather than merely to look small.

**The rich-text toolbar at 390px, 8 of the 28.** `Bold` and `Numbered list` render 20px tall with **22px** between centres on the requisition form. At 1440px the same toolbar passes; the failure is created by the narrow layout tightening the row.

Both fixes are the same one: give those controls 24px and the spacing exception stops mattering.

### Table row height against the tallest control in the row

| Screen | Row height | Tallest control in the row | Row height as a multiple |
| :---- | ----: | ----: | ----: |
| recruit-candidates | **90px** | 18px | **5.0x** |
| recruit-requisitions | **73px** | 18px | **4.1x** |
| sales-contacts | 56px | 34px | 1.6x |
| sales-companies | 56px | 32px | 1.8x |
| recruit-requisition-record | 56px | 16px | 3.5x |
| settings | 52px | 30px | 1.7x |
| sales-company-record | 45px | none | - |
| dashboard-my-view | 24px | none | - |

Carbon publishes five row sizes, **24 / 32 / 40 / 48 / 64**, with 64 reserved for two-line content ([data-table/style](https://carbondesignsystem.com/components/data-table/style/)).

**The two recruit lists exceed Carbon's largest size outright**: 90px and 73px against a 64px maximum that is itself meant for two-line rows. The sales lists at 56px and settings at 52px sit between 48 and 64, off the scale but inside its range. The dashboard's 24px is exactly Carbon's smallest.

**The multiple is the finding, not the height.** A candidate row is 90px tall and the tallest control inside it is an 18px checkbox, so **72px of that row is not a control**. The row is five times the height of the tallest thing in it, on the screen a recruiter spends the day in and the one carrying 72,917 records.

**These figures are higher than the fidelity audit's, and the difference is the migration.** That audit measured 69px on the candidate list and 55px on the requisition list on 2026-09-01. The same screens now measure 90px and 73px. Nothing in the stylesheet changed between those dates; the data did. Real imported names, grade comments and owner lists wrap where 83 rows of seed data did not, so **the rows grew by 30% and 33% when 72,917 real candidates arrived**. That is worth stating plainly for W10: row height here is a function of content, so capping the wrapping columns is the lever, and a fixed row height would simply clip.

### The focus ring against what is actually painted behind it

The ring is `rgb(54, 121, 181)`, `--fo-primary`, declared once at `states.css:9` with `outline-offset: 1px`. Because the offset puts it outside the border box, the surface it must contrast against is the nearest painted ancestor. **The ratio is computed from that constant, not from `getComputedStyle().outlineColor`**, which on an unfocused element returns `currentColor` and made an earlier version of this table meaningless.

| Painted behind the ring | From | Ratio | 1.4.11 | Captures | Screens |
| :---- | :---- | ----: | :---- | ----: | ----: |
| `rgb(87, 121, 149)` | `fo-sidebar-panel-header` | **1:1** | **fails** | 124 | **31** |
| `rgb(66, 125, 152)` | `fo-primary-nav` | **1.01:1** | **fails** | **868** | **31** |
| `rgb(66, 125, 152)` | `fo-primary-nav-wrap` | **1.01:1** | **fails** | 31 | **31** |
| `rgb(169, 198, 220)` | `side-tabs-bar` | **2.59:1** | **fails** | 56 | 4 |
| `rgb(240, 240, 240)` | `shell-main` | 4.04:1 | passes | 460 | 21 |
| `rgb(250, 250, 250)` | `tr` | 4.41:1 | passes | 444 | 5 |
| `rgb(255, 255, 255)` | eleven containers | 4.61:1 | passes | 1,945 | 31 |

**23 distinct ring-on-backdrop combinations, 4 of them failing, covering 1,079 measured captures.**

**Three distinct surfaces fail, not two.** V9 0.6 named the primary nav and the sidebar panel header. The measurement adds a third: **`side-tabs-bar` at 2.59:1**, the `SidePanelTabs` component on four record screens, whose `background: var(--section-tint)` is `#a9c6dc`. `fo-primary-nav-wrap` is the same surface as `fo-primary-nav`.

**The nav failure is on every screen and covers every tab.** 868 captures is 14 tabs across 31 screens at two viewports, so a keyboard user has no visible position on any primary navigation tab anywhere in the product. The sidebar figure, 124, is its two panel headers on the same 31 screens.

`check-contrast.mjs` line 20 tests `['focus ring', '--fo-primary', '--fo-surface', 3.0]`, which is the 4.61:1 row: the one pair that passes. **W15 should take its background list from this table**, which is measured from the rendered ancestry, rather than from the token file, since the token file is what produced the wrong answer twice.

### Two things Klent asked for that are already done, or nearly

**Every button, link, tab and summary in the product already shows `cursor: pointer`.** The table of controls whose cursor is not a pointer is **empty**, once disabled and `aria-disabled` controls are excluded, and excluding them is correct: `states.css` gives `[aria-disabled='true']` a `default` cursor deliberately and `.btn:disabled` does the same. **W14 is satisfied as it stands.** An earlier version of this table listed 62 controls, and every one of them was a correctly-disabled control.

**Exactly one textarea can be dragged sideways, not thirteen.** Of **11 textareas measured**, **2 captures** compute `resize: both`, and they are the same control at two viewports: **`Sourcer Grade (grade comment)` on the candidate record**. The five module rules cover every other one. **W13 is a one-line fix on one component**, and the shared declaration V3 recommends is still the right shape because it prevents the sixth omission rather than fixing twelve.

### Controls that sit side by side and do not match

Same screen, same container, tops within 8px, heights differing by 2px or more, with table rows and anything over 44px excluded as content-sized:

| Screen | A | B | Difference |
| :---- | :---- | :---- | ----: |
| `sales-contact-new` | `input-date` 36px | `input-checkbox` 13px | **23px** |
| `recruit-requisition-record` | `button` 16px | `button` 30.25px | **14.25px** |
| `recruit-candidate-record` | `button` 24px | `input-date` 36px | **12px** |
| `dashboard-reports` | `button` 37.5px | `button` 28px | **9.5px** |
| `global-search` | `button` 30.25px | `input-text` 21px | **9.25px** |
| `placeholder-employees` | `button` 30.25px | `input-text` 21px | **9.25px** |

These are the specific pairs Klent can see. The worst is a 36px date field beside a 13px checkbox on the new-contact form, and the most common is a 30.25px `.btn-sm` beside a 21px bare input, which is the shell search box on every screen that has one.

## What the full measurement still has to establish

- The same distribution across recruit, sales, intake, settings and the placeholder pages, which hold every form and every table in the product.
- Every pair of controls that sits side by side within 8px vertically and differs by 2px or more, with the difference in pixels, which is what makes the complaint concrete for each screen.
- The computed `font-size`, `line-height`, padding and border behind each distinct height, which is what tells W1 whether a control is one declaration away from the scale or needs restructuring.
- Table row height against the tallest control inside the row, which is the case the fidelity audit already flagged at 69px against Carbon's 64px maximum.
- Label-to-control against control-to-control spacing, for the alignment half of W1.
- The computed `resize` of every textarea and `cursor` of every button, which are W13 and W14.
