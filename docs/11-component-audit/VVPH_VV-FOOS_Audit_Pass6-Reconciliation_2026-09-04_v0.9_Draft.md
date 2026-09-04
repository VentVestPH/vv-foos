# Pass 6: reconciling the audit against the code and the corpus

Version 0.9. Pass 6 asks what the first five passes got wrong. It is not a summary of them.

The method was to take each claim, find the file or the measurement it rests on, and check it there rather than against my note of it. That is slower than re-reading the documents and it is the only thing that found any of what follows.

## Eighteen claims of mine that failed re-checking

Every one is corrected in place in the document that carried it, with the wrong version left visible. Thirteen of the eighteen were **corrected downward**, meaning the finding survived but smaller, and two were withdrawn outright.

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
| 14 | "An unlabelled gear icon floats alone" | It carries `aria-label="Configure candidate list columns"` at `CandidateListPage.tsx:668`. It is *visually* unlabelled, with no adjacent text and no `title`, which is a real affordance gap and a different claim | V10 observation 4 |
| 15 | "`Requisition Owner(s)` reads No owners on a filled requisition, while the list screen showed `Rita Demo (recruiter)`" | **Withdrawn.** Worth checking, because the two screens do read different sources: the list takes a denormalised `owner_names` from the `requisition_list` view, the record queries `requisition_owners`. Checked on the local stack and **zero of 690 requisitions disagree**. The explanation is the data: **9 owner rows exist across 690 requisitions**, so 681 have no owner at all, and I compared a record with none against a different requisition's row | V10 observation 38 |
| 16 | "`Table` has no loading state at all" | It has `busy?: boolean`, rendering `aria-busy`, passed at **6 of 17** call sites. I had grepped `Table.tsx` for `loading`, `isLoading` and `pending` and the prop is called `busy`. The finding survives, smaller and more precise: `busy` does not gate the empty row, so all 17 tables still show "No records" during the first load, and neither recruit list passes it | V6 row 13 |
| 17 | "All 17 tables show No records while loading" | **5 gate it correctly.** `emptyText={loading ? 'Loading…' : ...}` in `CompaniesListPage`, `ContactsListPage`, `DealsListPage`, `TicketsListPage` and `QueueListPage`. All five are sales or intake; recruit's three lists hard-code the empty text | V6 row 13 |
| 18 | "A long operation's button label never changes, and no mechanism exists" | **Six change it.** `ListPage` renders `Exporting…`, and five sales pages render `Saving…`. Two more show separate text, `Exporting… N of M` and `Uploading…`. Five express `busy` as `disabled` and nothing more, and those five are in recruit, settings and intake. So it is the same shape as every other finding, not the exception I called it | V6 row 30 |

**What survived intact.** Eleven V6 rows I had marked "verified in source" were re-checked against the files: 4, 5, 7, 13, 15, 17, 18, 19, 20, 21 and 22. All eleven hold.

That split is the most useful thing pass 6 found. **The audit table, whose cells name the file and the declaration, survived re-checking without a single change. The summary prose, written from the table plus memory, is where all thirteen errors were.** A claim degrades when it is restated, not when it is written down.

## Ten findings pass 6 added

Not one came from a screenshot. Eight came from reading a component's contract, one from counting duplicate names in the manifest, and one from enumerating every `onClick` on a non-interactive tag and then discarding the ten that were legitimate.

**Row-level controls carry no row identity** (V6 row 23, now W16). Found by counting duplicate accessible names per screen in the manifest. On the candidate list **100 of 163 interactive controls, 61%, share a name with nineteen others**: `1 star`, `2 stars`, `3 stars`, `Edit` and `Select row`, each twenty times. Verified in `Table.tsx:268`, `StarGrade.tsx:31` and `ApplicationPipeline.tsx:428`. It compounds row 5: with the header checkbox reporting the wrong state *and* no row distinguishable by name, the selection mechanism is unusable non-visually.

**Error and validation presentation** (V6 row 14, previously the audit's only pending row). It did not need pass 3. `Input` and `Select` each accept `error?: string` and render a `.field-error-text` span that `controls.css` styles and `motion.css` animates, and **no call site of the 149 passes it**. Errors surface form-level under four class names, `field-error-text` 22, `rq-error` 16, `form-error` 7, `settings-error` 1. `aria-invalid` appears **0** times, `noValidate` **0** times, and of the five `role="alert"` uses only LoginPage's is a form error, so **45 of 46 error messages are announced to no one**. That moved it from rank 7 to rank 5 in V8.

**Twelve routes set no document title** (V6 row 24, now W17). [WCAG 2.4.2 Page Titled](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html) is **Level A** and its Understanding document says a single-page application must change the title per view. `useDocumentTitle` exists and `ListPage` and `RecordPage` call it across 17 files; `DashboardPage`, `GlobalSearchPage`, both intake importers, `ModulePlaceholderPage`, both `path="*"` stubs and `LoginPage` call nothing, so 12 of 31 routes plus `/login` all read `VentVest Front Office OS`.

**Sortable column headers are mouse-only** (V6 row 25, now W4). `Table.tsx:212` gives a sortable `<th>` an `onClick` and no `tabIndex`, no inner `<button>` and no `onKeyDown`, while `aria-sort` at line 217 is set correctly, so a screen-reader user is told a column is sorted and cannot change it. [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) is **Level A**. The reason this is well evidenced rather than arguable: line 249 of the same file gives every `<tr>` a correct roving `tabIndex` with `onKeyDown` and `onFocus`. Keyboard support was implemented for rows and skipped for headers, twenty lines apart.

**`StarGrade` announces a radiogroup and behaves like three toggles** (V6 row 27, now W4). `role="radiogroup"` with three `role="radio"` buttons, `onClick` and nothing else. The group should be one tab stop and each star is its own; no arrow-key navigation exists; `role="radio"` on a `<button>` makes assistive technology announce a radio for an element that behaves as a button; and clicking the selected star clears the grade, which is checkbox behaviour a radio group cannot have.

**Five dialogs assert an inertness none of them enforces** (V6 row 26, now W18). `IdleSignOut`, `Placeholder`, `recruit/Dialog`, `sales/Modal` and `intake/Drawer` all set `aria-modal="true"`. Grep for `activeElement`, `trapFocus` or `focusTrap` across `app/src` returns nothing, and three of the five lack `autoFocus`. The [APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) warns the attribute should be set only when application code prevents external interaction, because misuse "can prevent users of some assistive technologies from perceiving content outside the dialog". So this is worse than incomplete: the page behind is announced as inert while Tab still reaches it. It is row 16's contradiction one level more serious, and the three module dialogs at 43, 40 and 39 lines are the same component written three times because ESLint forbids cross-module imports and `components/ui/` holds no dialog.

**`Back To List` loses the list on 9 of 11 paths** (V6 row 28, now W8). `lib/listReturn.ts` holds both halves of the pattern, `useListLink` to store the list URL and `useBackToList` to read it, and `useListLink` is used at exactly two call sites, both `onRowClick`. So on the recruit lists clicking the row background preserves the page, filters and sort while clicking the candidate's **name link** does not. On the sales lists neither works and no sales record page has the button. This is the fidelity audit's C13, recorded as absent; half-built is more precise.

**One radio group is not a group, and none carries a group label** (V6 row 29, now W4). `ItemDrawer.tsx:192` and `:199` set no `name`, so those two radios are not a native group: Tab stops on each and the arrow keys do nothing. The other two groups set `name` correctly. Across all three, `fieldset` and `legend` appear nowhere in `app/src`, so no group has a programmatic name. With row 27 that makes **four radio groups, none satisfying the APG pattern, each failing differently**.

**A long operation greys out its button and says nothing else** (V6 row 30, now W8). Five long actions all express `busy` as `disabled={busy}` and nothing more. `Button` has no loading prop, no spinner component exists in `app/src`, and there are no spinner keyframes among the fourteen layer files. The one exception, `DataExportCard`'s `Exporting… N of M`, is my own recent work and carries no `aria-live`, so its count climbs silently.

**Three interactions are attached to non-interactive elements** (V6 row 31, now W4). The truncated-cell expander across five columns, every dashboard bar's drill-through, and the deal card's navigation, which gives the sharpest case: a keyboard user can move a deal between pipeline stages but cannot open it.

## Fifteen things checked and found correct

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
| The hand-rolled bar charts, WCAG 1.1.1, Level A | **Correct.** `BarList.tsx` renders each row's `label` and its `count` as text either side of the bar, so the bar is decorative and the data is available without it. Checked because a hand-rolled CSS chart with no charting library is exactly where a text alternative goes missing. The chart is fine; its click target is row 31 |
| The 13 `onClick` handlers on non-interactive tags | **10 of 13 are legitimate**: three overlay backdrops that close on an outside click, where Escape is the keyboard path, and seven `e.stopPropagation()` guards around inputs and checkboxes, which are not interactions. Only three are real defects. Recorded because reporting 13 would have been true and misleading |

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

## The pattern under four of the findings

This is the most transferable thing in the audit, and it took until pass 6 to see because each instance had been filed as its own row.

**FOOS repeatedly builds the shared mechanism correctly and then does not wire it.** Five separate findings are the same shape:

| The mechanism, which exists and works | Call sites using it |
| :---- | :---- |
| `Input` and `Select` accept `error?: string` and render `.field-error-text`, which `controls.css` styles and `motion.css` animates | **0 of 149** |
| `lib/listReturn.ts` gives `useListLink` to store the list URL and `useBackToList` to read it | **2 of 11** list-to-record paths |
| `hooks/useDocumentTitle.ts` sets and reverts `document.title` | 17 files via `ListPage` and `RecordPage`, **not** the 12 routes using neither |
| `components/ui/Badge.tsx` with six tones | 32 uses, and `RequisitionListPage.tsx:341` bypasses it with a raw `badge badge-success` class |
| `Table` accepts `busy?: boolean` and renders `aria-busy` | **6 of 17**, and neither recruit list is among them. It also does not gate the empty row, so all 17 show "No records" while loading |

That changes what workstream W is. **Five of the findings are wiring, not building.** Nobody has to design an error presentation, a list-return contract, a title convention or a badge tone: those decisions were made and the code is in the repository. The work is passing a prop that already exists on 149 call sites, calling a hook that already exists on 12 routes, and replacing one raw class.

**I claimed one exception to this pattern and there is none.** I wrote row 30 up as a mechanism that does not exist: a long operation greying out its button, with `Button` having no loading prop and no spinner anywhere in `app/src`. Checking the strings instead of the component found six buttons that change their own label during the operation and two more that render separate progress text. So row 30 is the same shape as the rest, and the pattern has no exception among the ten findings.

**And the pattern has a boundary, which is the most actionable thing in this document.** Where the loading-feedback and progress patterns are used, they are used consistently, and where they are absent they are absent by module rather than at random:

| Pattern | recruit | sales | intake |
| :---- | :---- | :---- | :---- |
| `emptyText` gated on `loading` | **0 of 3 lists** | 4 of 4 | 1 of 1 |
| `busy` passed to `Table` | **0** | 4 | 1 |
| Button label changing to `Saving…` | **0** | 5 | 0 |
| `useListLink`, preserving the list URL | 2 | **0** | **0** |
| A `Back To List` control | 2 | **0** | **0** |
| `aria-label` occurrences | 22 | 4 | 4 |

**I nearly wrote "recruit is behind sales" and the matrix does not support it.** Recruit has no loading feedback of any kind and the CRM beside it has all three forms, which is what rows 13 and 30 are about. But recruit is the **only** module that preserves the list URL or offers a `Back To List` at all, which is row 28, and it carries 22 `aria-label` attributes against sales's 4. Neither module is ahead. **Each has patterns the other lacks, and every gap is a pattern invented in one module and never carried across.**

That reframes rows 13, 28 and 30 together, from "FOOS lacks X" to **"X is in the repository, working, and was never propagated"**. It is a copy rather than a design in every case. It also explains why my own screenshot review concluded there was no loading state anywhere: most of the screens I looked at were recruit.

**Two different causes, which matter because they need different fixes.** The loading-feedback pattern lives in sales *page* code, `emptyText={loading ? …}` written inline at each call site, and ESLint forbids a module importing another module, so recruit cannot use it without copying it or someone lifting it into `components/ui/Table.tsx` as a real loading state. The list-return pattern is the opposite: `lib/listReturn.ts` is already shared and available to every module, and sales simply never calls it. One gap is structural and one is an oversight, and the module-isolation rule that keeps the codebase clean is what turns the first kind into duplication rather than reuse.

It also predicts where else to look, which is the useful part. The question to ask of any shared component in this codebase is not "does it support X" but **"how many call sites actually pass X"**, and that is a `grep` rather than an investigation. Two of pass 6's findings and two of its acquittals came from asking exactly that: counting `<Input` against `label=` acquitted 95 fields and convicted one, and counting `<PlaceholderAction` against `ariaDisabled={false}` established that all 51 carry the default.

The corollary is worth stating for the same reason. **Where a component got sustained attention it is right**, including the parts that are easy to skip: the Kanban board's keyboard drag with live-region announcements, the idle dialog's two-minute grace and `role="alertdialog"`, the skip link's `tabIndex={-1}` target, `aria-sort` on the active column. The gaps are not a team that does not know the contracts. They are the call sites nobody has been back to.

### Every optional prop on every shared component, counted against its call sites

The predictive question, applied exhaustively rather than to the four findings that suggested it. Counts exclude `components/ui/` itself, so they are call sites in the rest of the application.

| Component | Optional prop | Passed at | Verdict |
| :---- | :---- | :---- | :---- |
| `Input` | `error` | **0 of 94** | The finding, row 14 |
| `Select` | `error` | **0 of 54** | The finding, row 14 |
| `Table` | `busy` | 6 of 17 | The finding, row 13, corrected |
| `RecordSection` | `defaultOpen` | **26 of 76** | Not dead. Section defaults are explicit at 26 sites, which is directly relevant to the parked T3a decision about which sections open at load |
| `Button` | `fullWidth` | 0 of 137 | Dead option, harmless. Defaults to `false`, so never passing it means never full-width |
| `Table` | `zebra` | 0 of 17 | Dead option, and **correct**. Defaults to `true`, which is the wanted behaviour, so passing it would be redundant |
| `Badge` | `title` | 0 of 31 | Dead option, mildly notable: a tooltip is available and unused on all 31 badges, while rows 23 and 27 found other controls relying on `title` as their only accessible name |
| `SidePanelTabs` | `count`, `defaultTab` | 0 of 2 each | Dead options |
| `ErrorBoundary` | `onReset` | 0 of 2 | Dead option. The boundary renders a reset affordance that no call site wires |

**Stopping here rather than inflating it.** Beyond the three rows already filed as findings, this is dead API surface, which is a workstream S concern and S is complete. The two facts worth carrying forward are that `RecordSection`'s defaults are explicit at 26 sites, and that `Table zebra` is an example of a never-passed prop being the correct state, which is why "never passed" is not a finding on its own.

**A methodological correction, because the first version of this table was wrong.** My first script keyed each props interface to its **filename**, which broke on `RecordPage.tsx`, a file exporting both `RecordPage` and `RecordSection`. It reported `defaultOpen` as never passed on 10 `RecordPage` call sites when it is passed at 26 of 76 `RecordSection` ones, and it silently skipped `Input` and `Select` entirely because their interfaces read `interface InputProps extends InputHTMLAttributes<...> {` and the pattern expected `{` immediately. Two runs of the same idea produced 0 of 10, then 29 of 76, then 26 of 76. **A counting script needs its own check before its output is quoted**, which is the third time today that a tool of mine has failed by dropping rows rather than erroring: the plan's arithmetic checker skipped the two half-point rows, the harness's focus pass overwrote a manifest, and this keyed props to the wrong component.

## Three things measured against the database rather than the documents

Queried directly on the local stack at 10:49 on 2026-09-04, because two of them were numbers I had written down twice with different values.

**The candidate count is 72,917, and V5 is right.** `candidate_profiles` and the `candidate_list` view both return exactly 72,917; `people` holds 72,988 and 7 candidate profiles are `is_test`. V5 quotes the pager as reading `1-20 of 72,917`, which matches. Earlier in this session I measured `EXP total=72920` during the export probe, and the difference is three: the fixtures my own spec had created at that moment. Both figures were correct when taken, and 72,917 is the steady state. Neither document needed changing, which is the first time today that checking a number of mine left it alone.

**Nothing my specs created is still there.** `select count(*) from people where last_name like 'Probe%' or first_name = 'Zaudit'` returns **0**. That is the teardown rule holding across the export probe, the starvation spec and the pass 3 walkthrough, and it is also what explains the 72,920 above resolving back to 72,917.

**The sweep produced no client-side crashes at all.** `client_errors` holds **0 rows** after roughly 12,000 captures across 31 routes at two viewports, which involved clicking every opener on every screen, filling every typeable field with an overflowing value, and forcing clicks on 51 `aria-disabled` buttons. That table is the one the gate checks, and an empty one after that much indiscriminate clicking is a real result rather than an absence of evidence: **the defects this audit found are contract and presentation defects, not stability defects.** Worth stating plainly, because a 28-row findings table invites the opposite impression.

## What pass 6 still owes

- The measured half: V9's computed values, V13's density, the ring-on-backdrop contrast table, the 2.5.8 spacing verdicts, the tab-order inversions and the duplicate-name table, all of which come from `measure.spec.ts` and `analyse.mjs`.
- V10's task costs, from `pass3-use.spec.ts`.
- Confirmation that every one of the 51 `PlaceholderAction` labels is captured, once the placeholder pass has run.
- **Chromium only** remains true and unfixed. For a workstream whose premise is that the browser decides too much, one engine is a real limit, and it is stated rather than worked around.
