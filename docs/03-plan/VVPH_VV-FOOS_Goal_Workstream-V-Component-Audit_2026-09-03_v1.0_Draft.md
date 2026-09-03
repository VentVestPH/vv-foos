# Workstream V: the component audit

Agreed 2026-09-03. **Audit and specification only. No implementation.** A later session implements from the specification this one produces. That split is deliberate: the user asked for the changes to be settled before any are made.

## Why it exists

Nothing in workstreams C, G, H, L, R or T covers replacing browser-default controls. "Custom component", "native select" and "browser default" appear zero times in the plan. T1 was a screen-level discovery, 27 routes at two widths, and never opened an accordion, a modal, a tab or a dropdown.

Measured in the codebase on 2026-09-03:

| Native control | Occurrences |
| :---- | ----: |
| `<input>` | 31 |
| `type="checkbox"` | 18 |
| `type="date"` | 15 |
| `<textarea>` | 13 |
| `<details>` | 6 |
| `type="radio"` | 5 |
| `<select>` | 2, both inside `Select.tsx` |
| `type="file"` | 1 |

Fifteen components exist in `app/src/components/ui/`, but `Select.tsx` wraps a native `<select>`, so the option list is drawn by the browser and cannot be styled, which is the specific complaint.

## The items

- **V1** Inventory every interactive component and every state it has: default, hover, focus-visible, active, disabled, error, loading, empty, populated. Components and states, not routes.
- **V2** A capture harness driving Playwright through all of them: every accordion opened, every tab, every modal, every dropdown, every side panel, every filter rail, every search box, at 1440x900 and 390x844. A screenshot for every component in every state, no exceptions. Gitignored corpus with a manifest naming component, state and viewport.
- **V3** Catalogue what the browser is deciding for us in each case: the select's option list, the date picker, the file input's button, the checkbox and radio glyphs, `<details>` disclosure behaviour, focus rings, scrollbars.
- **V4** WAI-ARIA Authoring Practices read from source for each control being replaced: the keyboard contract and ARIA roles a custom listbox, combobox, disclosure, checkbox, radio group and date input must honour.
- **V5** How Taleo presents each control, since fidelity has governed workstream C throughout.
- **V6** The audit document: one row per component with its current implementation, what is browser-default, what it should become, and the accessibility contract it must not break.
- **V7** A component specification per replacement: props API, keyboard map, ARIA roles, tokens used, motion budget. Implementation should be mechanical afterwards.
- **V8** A priority order from measurement: which controls appear on the screens people actually use.
- **V9** Control geometry, raised on 2026-09-04 from a direct observation that fields and buttons have visibly different heights. **Nothing in the stylesheet declares a control height.** `.btn` is `padding: 9px 18px` with `font-size: var(--fs-body)` at 14px and `line-height: 1.25`; `.btn-sm` is `padding: 6px var(--sp-1)` with `font-size: var(--fs-meta)` at 13px; `.field input`, `.field select`, `.field textarea` and `.input` are `padding: 8px var(--cell-pad)` with `font-size: var(--fs-body)` and **no line-height at all**, so their content box is whatever the browser chooses for that font. Every control's height is therefore computed from its own padding, border and inherited line-height, which is why a button and an input in the same toolbar do not line up and why a native select or date input differs again. Grep found no `height` or `min-height` on any of them: the only explicit heights in the codebase are on shell chrome, a 28px Taleo control, and widget internals.
  - **V9.1** Measure, do not infer. Record the rendered `getBoundingClientRect().height` of every button variant, input, select, textarea, date field, checkbox, radio, badge and icon button, in every context they appear in and at both viewports, and list every pair that sits side by side and differs, with the difference in pixels.
  - **V9.2** Define one height scale as tokens, `--control-h`, `--control-h-sm` and `--control-h-lg`, chosen to sit on the 8px grid the architecture document already mandates, and state which existing control each tier is anchored to so the replica does not drift from Taleo.
  - **V9.3** Apply it by declaring the height rather than deriving it: an explicit height or min-height plus `line-height: 1` and centred content, so a control's height stops depending on its font-size or on a line-height nobody set. Native controls that cannot be made to match are then a case for the custom component V3 already lists.
  - **V9.4** Vertical rhythm and alignment belong to the same item: label-to-control spacing, the baseline of a label against its field, control-to-control gaps in a toolbar and a filter rail, and row height in a table against the controls inside it.
  - **V9.5** A guard that fails the build the way `check-contrast.mjs` and `check-motion.mjs` do, asserting every control resolves to a tier of the scale, so the next hand-tuned padding cannot reintroduce this.

## How it runs

At least three passes over every surface. Fan out by surface area, up to 10 agents: one per module (dashboards, recruit, sales, intake, settings), one each for `components/ui`, `shell` and `styles`, and two on references. Each gets a narrow brief and a word limit, because only the report returns to context.

Capture uses Playwright, and WebFetch or Claude in Chrome where a page needs eyes on it. The 2-worker Playwright cap exists because the local Realtime container rate-limits and every page subscribes; screenshot capture does not need Realtime, so the harness can probably run wider, which is to be measured rather than assumed.

## The goal prompt to use

Stored so it is not reconstructed from memory. Under 4,000 characters, inline.

Run workstream V, the VV-FOOS component audit, specified in docs/03-plan/VVPH_VV-FOOS_Goal_Workstream-V-Component-Audit_2026-09-03_v1.0_Draft.md. This is audit and specification only: produce the documents and the screenshot corpus, change no component. A later session implements from what you write. Do not stop until every item is done or I say stop, and do not stop to summarise. I do not care about session or weekly limits; I want the best result, thorough and cleanly specified. Screenshot everything, no exceptions: open every dropdown, tab, button state, accordion, search box, modal, side panel and filter rail, on every page, at 1440x900 and 390x844. A component with no screenshot is not audited. Make at least three passes over every surface and say what each pass added, because the first always misses states. Scan the entire codebase and skip nothing: app/src in full, every module, components/ui, shell, styles, and the Edge Function surfaces that render HTML. See each page for real with Playwright or Claude in Chrome rather than reasoning from the source. You may browse the web freely and you must, not recall from memory, for the WAI-ARIA Authoring Practices keyboard and role contracts of every control you propose replacing, and for how Oracle Taleo presents the same control. Cite the URL you read. You may spawn up to 10 agents in parallel, each with a narrow brief and a word limit, since only the report returns to context. Fan out by surface: one per module, one each for components/ui, shell and styles, two on references. The point is custom components rather than browser defaults. The native select's option list cannot be styled; the same applies to the date picker, the file input button, the checkbox and radio glyphs and details disclosure. Measured today: 31 input, 18 checkbox, 15 date, 13 textarea, 6 details, 5 radio, 2 select, 1 file. Control geometry is its own dimension and is not optional: nothing in the stylesheet declares a control height, so every button, input, select, textarea and badge computes its own from padding, border and an inherited line-height, and they visibly disagree. Measure the rendered height of every control in every variant and context, list every side-by-side pair that differs and by how many pixels, define one height scale as tokens on the 8px grid, and cover label-to-control alignment and toolbar rhythm with it. Deliverables: an audit document with one row per component giving its current implementation, what the browser decides, what it should become and the accessibility contract it must keep; a specification per replacement giving props API, keyboard map, ARIA roles, tokens and motion budget, so implementation is mechanical; and a priority order driven by which controls appear on the screens people actually use. Rules: measure, do not assume, and if an audit, a plan entry or your own earlier claim disagrees with a measurement then the measurement wins and you correct the record. No comments in .ts, .tsx, .js, .mjs or .css; rationale goes in the commit message or docs/. Run bash scripts/gate.sh before each commit, since the harness and any test you add must not break the gate. Tests and harnesses leave no rows, storage objects or queue entries behind, and check the error on every teardown call. Commit each item separately saying what changed and what you got wrong on the way, and push to develop. Keep counts honest, never round up, and correct downward without being asked. Add workstream V to section 8 of the plan and keep the table and the header total agreeing. Environment: everything is on the LOCAL stack at 127.0.0.1:55321 and you never write to production. Screenshots go to a gitignored corpus with a manifest naming component, state and viewport. Do not ask me for anything in docs/03-plan/VVPH_VV-FOOS_Register_Parked-and-Blocked-Items_2026-09-02_v1.0_Draft.md, or for cost figures or contract dates.
