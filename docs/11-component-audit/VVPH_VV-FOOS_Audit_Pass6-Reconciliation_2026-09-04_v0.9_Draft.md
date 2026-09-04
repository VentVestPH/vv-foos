# Pass 6: reconciling the audit against the code and the corpus

Version 0.9. Pass 6 asks what the first five passes got wrong. It is not a summary of them.

The method was to take each claim, find the file or the measurement it rests on, and check it there rather than against my note of it. That is slower than re-reading the documents and it is the only thing that found any of what follows.

## Thirteen claims of mine that failed re-checking

Every one is corrected in place in the document that carried it, with the wrong version left visible. Nine of the thirteen were **corrected downward**: the finding survived but smaller.

| # | What I wrote | What is true | Where it was |
| ----: | :---- | :---- | :---- |
| 1 | "No list announces its results" | `Pager` has `aria-live="polite"`, on `.fo-pager-pos` (`1 / 3646`) and not on `.fo-pager-count` (`1-20 of 72,920`). Six lines apart in one component, and the app announces the less useful number. It also renders only when `pageCount > 1`, so a filter narrowing 72,920 rows to 3 removes the only live region on the screen | V6 row 13a, index finding 7 |
| 2 | "66 `PlaceholderAction` controls" | **51** rendered call sites. 66 counts the identifier's occurrences, including 13 imports and the definition and export | V1, V2, V6 row 16, V10 ×4, index |
| 3 | "66 usages against 11 natively disabled" | A source count compared to a rendered count. Source has **94** `disabled={...}` expressions; the corpus has 246 captures in a disabled state. Neither is 11, so the comparison is removed rather than restated | V6 row 16, V10 |
| 4 | Focus ring "fails on four surfaces", including Logout and any hovered primary button | **Two.** `outline-offset: 1px` places the ring outside the border box, so the surface it must contrast against is the nearest painted ancestor. Logout's lands on the white utility header and a primary button's on the white page surface, both **4.606:1**, both passing. What fails is `--fo-nav` at **1.013:1** behind 14 nav tabs and `--fo-sidebar-header` at **1.003:1** | V6 row 11, V8, V10, index, W15 |
| 5 | "1.01:1" and "4.61:1" | 1.013:1 and 4.606:1. There is no reason to round a computed figure | five documents |
| 6 | `get_my_google_status` "blocked on every screen, all 28 routes" | One screen. `GoogleIntegrationCard` renders only in `SettingsPage`. It appeared under 15 screen names because the guard tags a blocked call with the screen the click *started* on, and those were Administration clicks navigating to `/settings` | V10 |
| 7 | "28 routes" | **31**, after diffing every `path=` in `App.tsx` and the module index files against the harness's own list. `/intake`, and the `path="*"` stubs in `App.tsx` and `modules/intake/index.tsx`, had never been visited. `/login` makes a fourth and needs its own spec | V1, index |
| 8 | Row 2 raised from Degrades to **Costs** because the pager's 22px arrows fail WCAG 2.5.8 | **Put back to Degrades the same day.** `.fo-pager-controls button` has `min-width: 26px` in a flex row with a 4px gap, so adjacent centres are **30px** apart where the spacing exception needs 24px, and a single row has nothing vertically adjacent. The pager conforms | V6 row 2, V8 rank 1, V9, index |
| 9 | "`resize` appears nowhere in `app/src/styles`", so all 13 textareas inherit `resize: both` | Literally true and materially wrong. `resize: vertical` is declared **five times in four module stylesheets**, under `.intake-url-textarea`, `.rq-form textarea`, `.panel-form textarea`, `.sales-textarea` and `.template-form textarea`. The W brief had already said so before I contradicted it. Coverage across the 13 files holding textareas is the open question, and it is now measured | V3 |
| 10 | "61 controls have no accessible name" | A harness artefact. My name chain was `aria-label`, `title`, `placeholder`, `innerText`, and never consulted `<label for>` or `aria-labelledby`, which the accessible-name computation puts **first**. Counting call sites instead: **all 95 `<Input` pass a label and 53 of 54 `<Select` do**. One real case, `SheetImportPage.tsx:236` | V6, and it became W17 |
| 11 | "Three selects all named `Select…`" | The same artefact. They have labels | V6 |
| 12 | "Eight rendered button heights, 28px spread" | **15** distinct chrome-button heights across four areas, 1,066 captures. The 28px spread was right; the count was low because it was two areas. And the raw spread of 96px is **not** a finding: everything from 47px up is a candidate name or requisition title wrapping onto two to four lines | V9, index |
| 13 | Candidate record at "7,304px, 9.71 viewports" | Disputed against my own earlier T3 measurement of **5,979px in a 572px window**. They do not reconcile and neither window is the 900px this audit uses. Both recorded, neither quoted | V6 row 3, index |

**What survived intact.** Eleven V6 rows I had marked "verified in source" were re-checked against the files: 4, 5, 7, 13, 15, 17, 18, 19, 20, 21 and 22. All eleven hold.

That split is the most useful thing pass 6 found. **The audit table, whose cells name the file and the declaration, survived re-checking without a single change. The summary prose, written from the table plus memory, is where all thirteen errors were.** A claim degrades when it is restated, not when it is written down.

## Six findings pass 6 added

Not one came from a screenshot. Five came from reading a component's contract, and one from counting duplicate names in the manifest.

**Row-level controls carry no row identity** (V6 row 23, now W16). Found by counting duplicate accessible names per screen in the manifest. On the candidate list **100 of 163 interactive controls, 61%, share a name with nineteen others**: `1 star`, `2 stars`, `3 stars`, `Edit` and `Select row`, each twenty times. Verified in `Table.tsx:268`, `StarGrade.tsx:31` and `ApplicationPipeline.tsx:428`. It compounds row 5: with the header checkbox reporting the wrong state *and* no row distinguishable by name, the selection mechanism is unusable non-visually.

**Error and validation presentation** (V6 row 14, previously the audit's only pending row). It did not need pass 3. `Input` and `Select` each accept `error?: string` and render a `.field-error-text` span that `controls.css` styles and `motion.css` animates, and **no call site of the 149 passes it**. Errors surface form-level under four class names, `field-error-text` 22, `rq-error` 16, `form-error` 7, `settings-error` 1. `aria-invalid` appears **0** times, `noValidate` **0** times, and of the five `role="alert"` uses only LoginPage's is a form error, so **45 of 46 error messages are announced to no one**. That moved it from rank 7 to rank 5 in V8.

**Twelve routes set no document title** (V6 row 24, now W17). [WCAG 2.4.2 Page Titled](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html) is **Level A** and its Understanding document says a single-page application must change the title per view. `useDocumentTitle` exists and `ListPage` and `RecordPage` call it across 17 files; `DashboardPage`, `GlobalSearchPage`, both intake importers, `ModulePlaceholderPage`, both `path="*"` stubs and `LoginPage` call nothing, so 12 of 31 routes plus `/login` all read `VentVest Front Office OS`.

**Sortable column headers are mouse-only** (V6 row 25, now W4). `Table.tsx:212` gives a sortable `<th>` an `onClick` and no `tabIndex`, no inner `<button>` and no `onKeyDown`, while `aria-sort` at line 217 is set correctly, so a screen-reader user is told a column is sorted and cannot change it. [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) is **Level A**. The reason this is well evidenced rather than arguable: line 249 of the same file gives every `<tr>` a correct roving `tabIndex` with `onKeyDown` and `onFocus`. Keyboard support was implemented for rows and skipped for headers, twenty lines apart.

**`StarGrade` announces a radiogroup and behaves like three toggles** (V6 row 27, now W4). `role="radiogroup"` with three `role="radio"` buttons, `onClick` and nothing else. The group should be one tab stop and each star is its own; no arrow-key navigation exists; `role="radio"` on a `<button>` makes assistive technology announce a radio for an element that behaves as a button; and clicking the selected star clears the grade, which is checkbox behaviour a radio group cannot have.

**Five dialogs assert an inertness none of them enforces** (V6 row 26, now W18). `IdleSignOut`, `Placeholder`, `recruit/Dialog`, `sales/Modal` and `intake/Drawer` all set `aria-modal="true"`. Grep for `activeElement`, `trapFocus` or `focusTrap` across `app/src` returns nothing, and three of the five lack `autoFocus`. The [APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) warns the attribute should be set only when application code prevents external interaction, because misuse "can prevent users of some assistive technologies from perceiving content outside the dialog". So this is worse than incomplete: the page behind is announced as inert while Tab still reaches it. It is row 16's contradiction one level more serious, and the three module dialogs at 43, 40 and 39 lines are the same component written three times because ESLint forbids cross-module imports and `components/ui/` holds no dialog.

## Thirteen things checked and found correct

Recorded because two of them I had written up as findings first, and an audit that only lists defects is not an audit.

| Checked | Verdict |
| :---- | :---- |
| Field labelling | Correct. All 95 `<Input` and 53 of 54 `<Select` pass a label. One real case, `SheetImportPage.tsx:236` |
| `autocomplete` on 93 fields | **Correct by omission.** WCAG 1.3.5 covers fields about *the user*; every other field here holds candidate or company data, where autofill would offer the recruiter's own details for a candidate's record. The two that exist, `email` and `current-password` on `LoginPage`, are exactly the two that should |
| WCAG 2.5.8 on the pager arrows | Conforms, by the spacing exception at 30px between centres |
| `prefers-reduced-motion` | Handled at `motion.css:267`, guarded by `scripts/check-motion.mjs` |
| `lang` attribute | Set, `lang="en"` in `index.html` |
| `aria-sort` | Implemented correctly; the header's keyboard access is the defect, not the announcement |
| `aria-modal` | Present on all five dialogs; the behaviour it asserts is what is missing |
| **`KanbanBoard`'s drag interaction** | **Correct, and the best-implemented interaction in the product.** See below |
| A skip link, WCAG 2.4.1 Bypass Blocks, Level A | **Correct.** `AppShell.tsx:16` renders `Skip to main content` targeting `#main-content`, which is the `<main>` element carrying `tabIndex={-1}` so the target is programmatically focusable, and `widgets.css:209` moves it from `top: -100px` to `top: 4px` on `:focus`. Checked because a shell with 14 nav tabs and a sidebar is exactly where its absence would hurt |
| `.visually-hidden` | Really defined, at `widgets.css:9`. The Kanban board's keyboard help and its live-region announcements depend on it, so an undefined class would have made them visible instead of available |
| Star target size | **Meets 2.5.8 AA outright**, 24 x 24 across 63 captures, declared at `widgets.css:227`. What the star grade needs is the keyboard contract in row 27, not a size change |
| The idle timeout, WCAG 2.2.1 Timing Adjustable, Level A | **Correct, and generously so.** See below |
| Colour as the only means of conveying information, WCAG 1.4.1, Level A | **Correct.** `StatusBadge` renders the status as the badge's text content, `{status.replace(/_/g, ' ')}`, so all six tones carry a word as well as a colour. Row 17's finding is narrower and unaffected: one call site, `RequisitionListPage.tsx:341`, bypasses the component with a raw `badge badge-success` class and puts an application **count** inside a success tone, which is a misuse of the tone rather than a reliance on colour |

### The idle timeout, which is the second counter-example

[WCAG 2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html) is Level A and requires that a user be warned before a session times out and given at least 20 seconds to extend it with a simple action. `auth/IdleSignOut.tsx` gives **two minutes** against that 20 seconds, on a one-hour idle limit.

It is also the only dialog in the product that uses `role="alertdialog"` rather than `role="dialog"`, which is the correct role for an interruption demanding a response, and it carries `aria-labelledby` and `aria-describedby` pointing at its own title and body. Focus lands on `Keep me signed in` via `autoFocus`. Idle time is tracked in `localStorage` under `foos.lastActivity` and re-read on every tick, so activity in one tab keeps the others alive, and `visibilitychange` marks the user active when a tab comes back to the front. The copy names the reason, "for the safety of candidate records", and reassures that saved work is unaffected.

**One cosmetic defect, and it is the only thing wrong with it.** `TICK_MS` is 15 seconds while the body renders a countdown in whole seconds, so the number jumps 120, 105, 90 rather than counting down. That is a `setInterval` granularity choice, not a conformance issue, and it belongs in W8 as a one-line change.

The point of recording this alongside the Kanban board is the pattern both share. Where someone sat down and thought about a component, the result is right, including the parts that are easy to skip: a two-minute grace period, `alertdialog` over `dialog`, cross-tab state, a focused default action. The gaps this audit found are not a team that does not know the contracts. They are the components nobody has been back to yet.

### The Kanban board, which is the counter-example

Worth its own paragraph because it inverts the pattern in the rest of this document.

`KanbanBoard` is the most complex interaction in FOOS: drag and drop across pipeline stages. It registers only a `PointerSensor` with dnd-kit, so the keyboard path is hand-written, and it is complete. `onCardKeyDown` at line 151 implements Space or Enter to grab, Space or Enter again to drop, Escape to cancel, and Left and Right arrows to move between columns. Every one of those sets an `announcement` string rendered into a `role="status" aria-live="polite"` region, including the card's position and the column count. A visually-hidden `#kanban-keyboard-help` paragraph states the whole contract in words, and the implementation matches that text exactly.

So the most complicated control in the product has the best keyboard support and the best announcements, while a `<th>` needing one `tabIndex` and one `onKeyDown` has neither, and `StarGrade` claims a radiogroup with no arrow keys at all. **Accessibility here tracks how much attention a component received, not how hard it was.** That is the single most useful thing to tell whoever picks up workstream W, because it means the remaining gaps are small pieces of work rather than a missing capability, and it is why W4 bundles the checkbox, the radio, the sort header and the row naming together instead of treating them as four projects.

## Three gaps in the harness itself, beyond V2's six

| Gap | Effect | Status |
| :---- | :---- | :---- |
| **One level deep.** The sweep tags controls on the settled screen and photographs an opened overlay whole, without descending into it | No `input-radio` was captured anywhere, against 5 in source, and 3 `datetime-local` against 4. All five radios and the fourth datetime live inside dialogs | Fixed: `overlay-interior.spec.ts` reopens each of the 99 screen/viewport/opener triples the manifests prove produced an overlay and captures every control inside it |
| **No selection state.** The bulk-action bar only exists once rows are selected, and a checkbox is not an "opener" | The bulk-action dialogs and their radios were unreachable, and the `indeterminate` finding stayed a source claim | Fixed: `selection-states.spec.ts` selects 3 rows, reads `checked` and `indeterminate` off the header, and records how many rows are selected after clicking it |
| **Signs in first**, so `/login` is unreachable | The first screen every user sees was never captured, and it holds the only `role="alert"` on a form error in the product | Fixed: `unauthenticated.spec.ts`, which also submits the form empty and with wrong credentials and records what is rendered and announced |

And one guard defect: **`POST rpc/get_my_google_status` is a read**, because PostgREST exposes every RPC as a POST, so a method-based write guard aborts function reads too. Two named read-only RPCs now continue and are logged in `allowed-read-rpcs.<area>.txt`, so what is let through is as visible as what is stopped. Settings had not been swept when this was fixed.

## What pass 6 still owes

- The measured half: V9's computed values, V13's density, the ring-on-backdrop contrast table, the 2.5.8 spacing verdicts, the tab-order inversions and the duplicate-name table, all of which come from `measure.spec.ts` and `analyse.mjs`.
- V10's task costs, from `pass3-use.spec.ts`.
- Confirmation that every one of the 51 `PlaceholderAction` labels is captured, once the placeholder pass has run.
- **Chromium only** remains true and unfixed. For a workstream whose premise is that the browser decides too much, one engine is a real limit, and it is stated rather than worked around.
