# Goal 11 execution plan: 144 findings, eleven causal batches

Written 2026-09-08, after Goal 9 read all 104 tall images and Goal 10 closed the seven gears. Goal 11's own instruction is **fix the cause, not the instance**, so the unit of work here is a batch, not a finding. A batch is done when every finding it names is either resolved or explicitly reclassified.

Klent's standing rules that constrain every batch:

- *"make sure when doing crud, create a seeded record and delete that. not actual records."* Verification of any create, update or delete path uses a run-unique record the verification made and removes, teardown in `afterEach`/`afterAll`.
- *"that's the point, we're adding functions to behaviorless controls. why skip 5 because of claude.md?"* A behaviourless control gets behaviour. Removal is only correct when there is genuinely nothing to configure, as with Goal 10's gear 6, and it needs its reason in one sentence.
- *"do not add comments to the codebase"*, *"do not commit"*, and the database is local only.

## Read this before implementing anything

`findings/UGLY.md` carries a section titled **Corrections the role passes forced on this document**. Ten findings were reclassified, superseded, reframed or corrected by the sourcer and bd passes, and two of the original five worst were replaced. Implementing `U26`, `U48`, `U81`, `U105`, `U110`, `U17`, `U18`, `U19`, `U21`, `U97` or `U115` from their original text will produce the wrong fix.

## The batches, in dependency order

Order matters: batches 1 to 3 change shared components that later batches then rely on, so doing 4 first means doing parts of it twice.

| # | Batch | Findings | Where the fix lives | Why this position |
| :---- | :---- | :---- | :---- | :---- |
| **1** | **One table column rule.** A column with no value on the visible page is not rendered, which frees the width the clipped ones need | U3, U45, U77, U92, U93, U104, B7, and the sourcer's empty `Company` column | `components/ui/Table.tsx` plus each list's column defs | Six list pages inherit it. Doing it first means batch 5's row-height work measures the final column set |
| **2** | **One record action bar.** Fixed slots: back link left, one primary right, secondary between, destructive behind a menu. Bar renders once | U1, U15, U71, U90, B5, K8, K18 | a new shared record action bar in `components/ui/RecordPage.tsx`, then the four record pages | Batch 2 defines what "primary" looks like, which batches 6 and 9 both depend on |
| **3** | **One section shell.** Uniform padding, count in the header, empty sections collapsed, no duplicated pager | U2, U6, U31, U52, U62, U66, U80, U85, U99, U106, K7, K15 | `components/ui/RecordPage.tsx` `RecordSection`, `components/ui/Pager.tsx` | K16's two-scrollbar fault is downstream of section height, so this must precede batch 4 |
| **4** | **The shell scrolls in one place.** The document is pinned to viewport height and the real scroller is `main.shell-content`, so expanding accordions produces two competing scrollbars | K16, K2, K3, and the 63-65% of every page that a document-level scroll could not reach | `styles/layers/shell.css`, `shell/AppShell.tsx` | Klent reported it directly, and it is the one fault the whole audit method had to work around |
| **5** | **One vertical rhythm.** Every measured gap on the 8px grid; the nine off-grid values are 12, 47, 95, 102, 114, 152, 181, 184, 188 | U4, U7, U20, U36, U46, U67, U34, U41, U25, B6 | `styles/layers/pages.css`, `tables.css`, `panels.css` | Needs batches 1 and 3 done, or the numbers move under it |
| **6** | **One colour and one control language.** Three blues become one; quick search matches the navbar; label and icon vertically centred | U16, U13, U28, U42, U84, K4, K5, K6, K10, K11, K12 | `styles/tokens.css` and the control layers | K10 asks for published colour guidance, which is the one input still owed |
| **7** | **Delete developer copy.** Six dashboard panels, the settings internals, the `is_test` label, the `Nothing to promote` note, the two "FOOS MVP" placeholders | U38, U39, U50, U81, U97, U100, S5, B4 | the dashboard widget components, `SettingsPage.tsx`, `RequisitionFormPage.tsx`, `ModulePlaceholderPage.tsx` | Independent of the layout batches, so it can run in parallel with any of them |
| **8** | **One convention per thing.** One "no value", one `is_test` label, one capitalisation, one required marker, one header punctuation, one money format, one role display name | U9, U40, U47, U76, U82, U88, U105, U108, U110, U111, U113, B4, B8, R2 | `lib/format.ts` and every form and list that disagrees | Pure text and formatter work, low risk, high visible payoff |
| **9** | **Every behaviourless control gets behaviour**, per Klent's correction. Nine dashboard calendar controls, the six calendar views, `Switch to My Dashboard`, the report category tabs, the pipeline drill-throughs | U32, U33, U35, U50's drill-through notes, U58, U59, C4, K13, K14, K17, K19 | `pages/DashboardPage.tsx`, `pages/CalendarViewIcons.tsx`, `modules/dashboards` | The largest batch, and the one the CRUD rule governs most. `Group view` groups by role, per Klent |
| **10** | **Correctness, not appearance.** The findings where the screen states something false | U69, U44, U116, U12, U26+U48 as B3, U51, U78, U87, U91, U98, B1, B2, S1, S2, R1, U115 | route guards, `useEngagement`, the `dash` views, `DealsListPage.tsx:242`, `ModulePlaceholderPage.tsx:82` | **Do this batch first if the time available is short.** It contains every finding where a user would act on a wrong number or a wrong statement |
| **11** | **Accessibility and state.** The APG keyboard contract, `aria-invalid`, the boot gate, route transitions, print | C1, C2, C3, C5, C6, C7, U22 (67 disabled controls with no `title`) | `shell/UtilityHeader.tsx`, `auth/LoginPage.tsx`, `App.tsx`, `print.css` | C9 stays an open question, not a defect, until the CPU-throttled single-browser measurement is taken |

## What is not in a batch

- **U17, U18, U19, U21, U74, U94, U95, U101, U102, U103, and the `-1` locations.** These are **import artefacts**, proven by the sourcer's three clean candidates rendering through the same components. The fix belongs in `scripts/backfill-zoho-candidate-fields.mjs` and the import path, and it rewrites candidate data, so it is its own piece of work with its own before-and-after row counts. The renderer finding that survives, and does belong in batch 8, is that the components pass `, -1`, `-` and `.` through without sanitising.
- **C9**, the ten-second renderer stalls. Open question. Did not reproduce single-threaded at 13ms and 19ms, so it is most likely four-browser contention on one Vite dev server.
- **QA-026**, `list-persistence.spec.ts` 2.11, cause unknown, 6 of 6 in isolation. Its next step is to add the displayed error text to the failure message and run the gate until it recurs, not to retry it.
- **Goal 6**, hosting and cutover. Klent's, last, blocked on X12 and the migration-10 trigger decision.

## The bar for each batch

1. Re-measure, do not assume. The numbers every finding cites are in `audit/2026-09-08/findings/MEASURED.md` and `measurements/<role>/_gaps.json`, and `tests/audit/measure-gaps.spec.ts` regenerates them.
2. A test that fails if the fix is reverted. Goal 10's proof method is the standard: break the mechanism deliberately and confirm exactly the intended tests fail.
3. `bash scripts/gate.sh` green, and the guard scripts specifically, since batches 5 and 6 touch tokens and layers where `check-contrast`, `check-motion`, `check-css-layers`, `check-icons` and `check-control-heights` all have teeth.
4. Re-capture into `audit/2026-09-09/` with `tests/audit/tall-pages.spec.ts` and diff against `audit/2026-09-08/tall/`, which is the goal's own definition of done.

## Batch 10 groundwork, measured 2026-09-08 before any code was changed

Five of batch 10's findings were traced to their exact cause while the five-pass gate ran, so the implementation does not start with a guess.

### S1, every dashboard panel reads zero: the picker has no window wide enough

`DEFAULT_RANGE` is `rangeForPreset('30')` at `modules/dashboards/lib.ts:148`, and `PRESETS` in `modules/dashboards/components/DateRangeFilter.tsx` offers only 7, 30, 90, quarter and custom. Against `dash.vw_requisition_aging`:

```
open_30d=0  open_90d=2  open_total=18
min(opened_date)=2009-02-23  max(opened_date)=2026-06-23
```

The newest open requisition is **77 days** old. So changing the default to the widest existing preset would move `Open requisitions` from 0 to 2 out of 18, which is still wrong. **The fix needs a new `All time` preset**, in `PRESETS` and in `rangeForPreset`, and that becomes `DEFAULT_RANGE`.

### B2, the same deal counts 1 and 0: two populations, neither stated

Not the date range. Both deals were created inside 90 days.

```sql
-- dash.vw_crm_funnel
   FROM deals d JOIN companies c ON c.id = d.company_id
  WHERE NOT d.is_test AND NOT c.is_test;

-- dash.vw_requisition_aging
   FROM requisitions r JOIN companies c ON c.id = r.company_id
  WHERE NOT r.is_test;
```

Both deals in the database are `is_test = true`, so the dashboard counts real records correctly and the board counts real plus test records correctly. **Neither surface is wrong on its own terms, and neither says which population it is showing.** The fix is to state it on the panel and offer the same filter on the list, not to change either view.

### U69, the Users page says there are no users

`pages/ModulePlaceholderPage.tsx` passes `rows={[]}` with `emptyText="There are currently no users in your Front Office OS system."` while `staff` holds **12 rows, 4 active**.

`staff` is `id, full_name, email, role, title, manager_id, is_active`, which supplies four of the six columns the page already declares: `Name`, `Title`, `Role`, `Manager` (a self-join on `manager_id`). `Location` has no column behind it and `Last login` would need `auth.users.last_sign_in_at`, which is not client-readable. So this is a build, per Klent's rule about behaviourless controls, and batch 1's column rule drops the two columns with nothing behind them.

### U44 and B3, both confirmed at the code site

`modules/sales/pages/DealsListPage.tsx`:

```
239:            {d.probability !== null && ` · ${d.probability}%`}
242:            {fmtDate(d.expected_close)} · {d.owner_name ?? ''}
```

Line 239 is inside a template literal, where `·` is an escape. Line 242 is JSX text, where it is six literal characters. One file, one line apart, both conventions. Line 239 also renders `{d.probability}%` directly, which is where `0.6%` comes from and why B3 is a field-level unit problem rather than two formatting bugs.

### U116, the permanent `Loading…`: two pages of five, and the right pattern is already in the repo

`load()` in `CandidateRecordPage.tsx:74-104` fetches with `maybeSingle()`, which returns `data: null, error: null` when RLS filters the row out rather than raising. The render branch at line 149 is:

```tsx
  if (!person) {
    return error ? (
      <p className="form-error" role="alert">{error}</p>
    ) : (
      <p className="text-secondary">Loading…</p>
    );
  }
```

So "not fetched yet" and "fetched, and RLS returned nothing" are the same state, and the page shows `Loading…` for ever. Measured at 30s with `spinners=0`, which is why it is indistinguishable from a hung application.

**Only two of the five record pages have this.** `DealRecordPage.tsx:36,155`, `ContactRecordPage.tsx:40,104` and `CompanyRecordPage.tsx:48,125` all keep a `loaded` flag and branch on `loaded && !x`, which is correct. The two that do not are `CandidateRecordPage.tsx` and `RequisitionRecordPage.tsx:220`.

So the fix is to copy the existing pattern into those two, not to invent one, and the finding is narrower than `UGLY.md` records it.

### U12, twenty silent redirects: one line, and the honest fix is not a better redirect

`auth/RequireAuth.tsx:38-39`:

```tsx
  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }
```

No message, and `replace` means the browser Back button cannot return the user to where they were. Twenty route visits across the three non-admin roles end on the dashboard with nothing said, which is also why the sourcer captured 19 routes of 31 and bd 24 of 31.

**Recommendation: stop redirecting.** Render a denial in place, using the component `S4` calls for, so the URL stays, the message names what was refused, and Back works. That is the pattern `/recruit/requisitions/new` already uses correctly for the sourcer (`You do not have access to edit requisitions.`), and it resolves `U12` and `S4` in one change instead of improving a redirect that should not exist.

### U22, disabled controls with no explanation

Counted 2026-09-08: **113** `disabled` occurrences across `.tsx`, and only **2** lines that pair `disabled` with a `title`. The finding recorded 67 against 11 from the audit's own DOM sweep, which counted rendered controls rather than source occurrences; both numbers say the same thing, which is that a disabled control almost never says why.

The fix belongs with batch 2's action bar and batch 8's conventions: a disabled control carries a `title` giving the reason, and `Primary contact`'s existing `Pick a company first` is the model already in the codebase.

## Batch 1 design, decided before implementation

`TableColumn<T>` in `components/ui/Table.tsx` is `{ key, header, sortable?, sortValue?, render?, capped?, width? }`. Emptiness cannot be tested against `render`, because it returns a `ReactNode`.

**Add `hideWhenEmpty?: boolean`.** When set, `Table` reads each row's value through `sortValue` if the column has one and `row[key]` otherwise, and omits the column when every visible row yields `null`, `undefined`, `''` or `'—'`. `sortValue` already has exactly the needed signature, `(row: T) => string | number | null`, so most affected columns need no new code.

Applies to the columns the audit found empty on every visible row: `State/Territory` and `Type` on Accounts (`B7`), `Since` on Contacts (`U104`), `Company` on the sourcer's requisition list, and five of nine Application Pipeline columns (`U77`). It also frees the width that `Company` on the requisition list (`U3`) and `Website` on Accounts (`U93`) are being clipped for.

**Opt-in, not automatic.** A column that is empty today but meaningful tomorrow, such as `Location` once employees exist, should keep its header rather than vanish and reappear as data arrives. That decision belongs to each list, which is what the flag expresses.

## Batch 8 groundwork: the conventions already exist and are bypassed

`app/src/lib/format.ts` is 60 lines and already exports the single source of truth for three of the conventions the audit found split:

```ts
export const EMPTY_CELL = '—';
export const CURRENCIES = ['PHP', 'USD', 'AUD', 'NZD', 'SGD', 'EUR', 'GBP'];
export function formatDate(iso, fallback = EMPTY_CELL)
export function formatDateTime(iso, fallback = EMPTY_CELL)
export function formatMoney(value, currency?, fallback = EMPTY_CELL)
```

So `U9` and `U88` are not "the product has four conventions for no value with no rule". **The rule exists and three places bypass it**, which makes the fix a sweep to `EMPTY_CELL` rather than a design decision. The bypasses seen on screen were a bare `0`, an empty cell, and `Not set` (`CandidateRecordPage.tsx:558` uses it as a `placeholder`, which is a different thing and may be correct).

`U47`, money formatted on the list and not on the record, is the same shape: `formatMoney` exists and handles currency, fraction digits and the fallback, and the deal record simply renders the raw number instead of calling it.

**`U107` has its cause here too.** `Currency` defaults to `PHP` because `PHP` is the first element of `CURRENCIES` and the select takes the first option as its initial value. That is the arbitrary default `U107` suspected. The fix stays as `U107` proposes, deriving the currency from the selected company's country, but the array order should stop being load-bearing either way.

## Batch 3 design: two props on `RecordSection`, and the good pattern is already hand-rolled

`RecordSectionProps` is `{ title, defaultOpen?, children }`. The header renders a chevron and the bare `title`.

The company record already produces the behaviour the audit praised, `Contacts (1)` and `Open deals (0)`, by writing the count into the `title` string by hand. Two props make it the component's job:

- **`count?: number`** renders `Title (n)`, so the count is consistent and a caller cannot forget it.
- **`empty?: boolean`** defaults the section closed and renders a single line rather than a header bar, padding and a sentence. This is what turns `U2`'s nine empty sections on the candidate record from six lines each into one.

`RecordPage` already has a `record-action-bar` slot, which is where batch 2's shared bar belongs, so batches 2 and 3 both land in `components/ui/RecordPage.tsx` and should be done together in one pass over the file rather than two.

## Caused by U69's fix, and deliberately left for batch 9

`/users` now renders 12 real staff rows, and its `Search` input is `disabled` with a placeholder `Go!` beside it. Before the fix there were no rows, so a dead search cost nothing; now it is a visible gap over real data. It is not a batch 10 item, because nothing on the screen states anything false, and it belongs with batch 9's rule that a behaviourless control gets behaviour. Recorded here so the connection is not lost: **U69's fix is what makes that search worth building.**

---

## Batch 10 delivered, 2026-09-08

All seven items. Every fix has a test that fails when the fix is reverted, and every cause was measured before the edit rather than inferred from the finding text.

| # | Finding | Change | Proof |
| :---- | :---- | :---- | :---- |
| 1 | `U44` | `DealsListPage.tsx:242` moved from JSX text to a template literal, matching line 239 one line above. Checked the whole tree: the only three unicode escapes in `.tsx` are now all inside literals | `e2e/record-not-found.spec.ts` walks every text node under `main` on `/sales/deals` and fails on any `\uXXXX` in rendered text |
| 2 | `U116` | `CandidateRecordPage.tsx` and `RequisitionRecordPage.tsx` gained a `loaded` flag set in a `finally`, and a third render branch. Copied from `DealRecordPage.tsx`, which already did it right, along with the two other sales record pages | three tests: a missing candidate, a missing requisition, and a candidate the sourcer's RLS hides. Each asserts the "not found" heading appears and `Loading…` is gone |
| 3 | `U69` | `ModulePlaceholderPage.tsx` `UsersTable` now reads `staff` for real: Name, Email, Title, Role, Manager (self-join on `manager_id`), Status. `Location` and `Last login` dropped, having nothing behind them. Roles render through a display map, so `bd` reads `Business Development` rather than `Bd` | asserts the rendered row count equals `select count(*) from staff`, and that the "no users" sentence is gone |
| 4 | `B3` | migration `20260908000001_deal_probability_percent.sql` backfills `(0,1)` by 100 and adds `deals_probability_pct`; `seed.sql` corrected from `0.5`/`0.2` to `50`/`20`; both deal forms gained `step="1"` | 4 vitest cases plus a browser assertion that no card shows `0.x%`. **My first version of one test was wrong**: I asserted the constraint would reject `0.5`. It cannot, because `0.5` is a valid half-percent. The test now records that limit instead of asserting a falsehood |
| 5 | `U12` + `S4` | new `components/ui/AccessDenied.tsx`. `RequireAuth` renders it in place instead of `<Navigate to="/" replace />`, and `App.tsx` names the area (`Recruiting`, `Sales`, `Users`). `RequisitionFormPage.tsx` uses the same component, so the sourcer's refusal is framed like every other | 4 tests: the URL survives a refusal, `page.goBack()` returns to the previous route, the requisition refusal renders inside `.hold-card` with a `Back To List` link, and the admin-only route names itself |
| 6 | `S1` | new `all` preset in `DateRangePreset`, `rangeForPreset` and `PRESETS`, and `DEFAULT_RANGE` is now `rangeForPreset('all')` | asserts the range control reads `All time`, `Open requisitions` is above zero, and **`No data in range.` appears nowhere in the widgets panel**, which is `U52` closed as a side effect |
| 7 | `B2` | `Widget` gained `excludesTestRecords`, rendered as `Excludes test records` beside `Updated …`. Applied to the seven widgets whose sources filter test rows and **deliberately not** to `Applications advanced (90-day window)` or `Experiment Metrics` | the test asserts the label on five named panels **and asserts its absence** on `Applications advanced`, so a future careless sweep cannot make the note a lie |

### What I checked before writing the note in item 7

Every `dash` object, individually, rather than assuming the schema was uniform:

```
vw_ats_funnel: filters is_test          vw_crm_funnel: filters is_test
vw_requisition_aging: filters is_test   vw_source_effectiveness: filters is_test
vw_staff_activities: filters is_test    vw_staff_grading: filters is_test
mv_stage_durations: filters is_test     mv_staff_stage_advances: NO is_test filter
vw_success_metrics: NO is_test filter
```

Two of nine do not filter. Labelling all six panels would have repeated the exact defect class the finding is about.

### New finding raised while fixing, not from an image

`S7`: two open requisitions have a **null `opened_date`**, and the aging panel filters with `.gte('opened_date', range.from)`, which excludes nulls. So they are invisible under every range including `All time`, which shows 58 of the 60 rows it should. Recorded in `findings/sourcer.md` with the measurement.

### Regression check

Full browser suite **201 passed (2.5m)** after items 1, 2, 3, 5, 6 and 7, so none of them broke an existing expectation, in particular nothing depended on the old silent redirect.

### Batch 10 verification

`bash scripts/gate.sh 3`: **pass 1, 2 and 3 all 22 of 22, zero failures**, with `api-tests 269 passed` and `browser 202 passed` on each, `validate.sql 34 check(s) pass`, and `DEAL-0001` holding at **60** across all three passes, which is what proves QA-028 fixed rather than merely patched.

Four defects surfaced while validating batch 10, all fixed, none skipped:

1. **`FAIL dead-code`** on `ALL_TIME_FROM`, exported and never imported. Made module-local; `npx knip` clean.
2. **`FAIL attachments`, 1 orphaned storage object.** Cause was in `api/attachment-deletion-queue.test.ts`'s teardown, which re-inserted a row, removed the object and deleted the row **without checking any of the three for errors**, so one silent failure leaked an orphan while the suite still reported green. The teardown now collects failures and throws, naming each path and the reason.
3. **QA-027, a false 43px overflow on seven routes.** `phone.spec.ts`'s local `settleLayout` fell out of its `while (Date.now() < deadline)` loop and **returned normally** when it never stabilised, so the caller measured a mid-layout width. Reachable only under the gate's two workers, which is why the spec passed every isolated run. It now throws and names the last read. **Fourth instance of a pattern `CLAUDE.md` already documents.**
4. **QA-028, the seeded deal's probability reverting to 0.6.** `supabase/tests/validate.sql:442` proved that bd can update a deal by writing `probability = 0.6` to the real DEAL-0001 and never restoring it, impersonating bd via `set_config('request.jwt.claims', …)`, which is why every `audit_log` row named Ben Demo and why the write always landed just after the browser step. It now reads the value into `prev`, writes `55`, asserts `found`, and writes `prev` back. The first three instrumented runs saw nothing because my probe table had RLS enabled with **no policy**, so the trigger's insert was refused and the offending UPDATE aborted with it: **the instrument was suppressing the event it was meant to record.**

---

## Klent's list, part 1: K1 to K6 and K11 to K13 delivered, 2026-09-08

Done next after batch 10 because Klent asked for his own list twice, including *"is the quick section transition already added?"*, and because these are the changes he sees rather than reads about.

| K | His words | What changed | Measured proof |
| :---- | :---- | :---- | :---- |
| **K1** | "Login page, move fields above, continue with google below" | `auth/LoginPage.tsx` reordered: email and password form first with a **primary** submit, then the `or` divider, then `Continue with Google` as **secondary**. The submit label shortened from `Sign in with email` to `Sign in`, which still matches the `signIn` helper's `/sign in\|log in/i` | `login-flash.spec.ts` and `accessibility.spec.ts`, 7 passed, `holdCardRenders=0` |
| **C2** | (a finding, fixed in the same file) | both inputs now carry `aria-invalid` when sign-in fails. `Input` spreads `{...rest}` **after** its own `aria-invalid`, so a caller-supplied value wins and no duplicate error text is rendered | typecheck plus the login specs |
| **K2** | "Shorten the height of the top banner. It's too wide" | `--shell-header-h` **104px to 72px**. The brand block needs about 48px (a 132px logo at 1038:231 is 29px tall, plus a 16px subtitle), so 72px is comfortable rather than cramped | `phone.spec.ts` and `nav-overflow.spec.ts` pass |
| **K3** | "Remove strong dark border between topbar and nabber" | `.fo-utility-header` `border-bottom: 2px solid var(--text)` becomes `1px solid var(--fo-border)` | `check-contrast` 35 of 35 |
| **K4** | "Match color of quick search section to the navbar" | `--fo-sidebar-header` **#577995 to #427d98**, which is `--fo-nav` exactly. Removes one of the three blues in `U16` | `check-contrast` passes both pairs that use it, `sidebar panel header` and `focus ring on the sidebar header` |
| **K5** | "add transition to quick search section" | the sidebar cards, panel bodies and panel titles now transition `opacity`, `transform` and `visibility` over `--motion-quick`, and `display: none` was replaced by `opacity: 0; visibility: hidden; transform: translateX(-8px)` with `overflow-x: hidden` on the collapsed rail. **The rail's width is deliberately not animated**, because `check-motion.mjs` forbids animating `width`, `height`, `top` and `left`, and that guard was set on purpose | `check-motion` passes; `phone.spec.ts` still finds zero sideways scroll, which is what the `overflow-x: hidden` protects |
| **K6** | "for elements with icon and label, make label vertically centered to the icon" | **measured before changing anything.** A probe over five routes found exactly one offender, `div.fo-page-header`, where the 40px icon's centre sat **7px below** the `h1`'s text centre on every page with a header. Metrics: h1 box **32px** (26px at `line-height: normal`), icon span **43px**, `margin-top: 2px`, so the icon centre was 23.5 against the title's 16. Fixed by giving `h1` an explicit `line-height: 1.25` and `.fo-page-icon` a box of `calc(var(--fs-page-title) * 1.25)` with `display: flex; align-items: center`, so both derive from one token | `e2e/icon-label-alignment.spec.ts`, a new guard that walks every `button`, `a`, `label`, page header, section header and heading containing an `svg` and compares centres. Zero offenders on five routes, and it **fails** when the icon box height is broken |
| **K11** | "make the new event and schedule interview buttons actual button designs" | `New Event` is now **primary**, `Schedule interview` **secondary**, `New Task` primary, and the `|` divider between them is gone | `dashboard-switch.spec.ts` asserts one `.btn-primary`, one `.btn-secondary` and zero `.record-section-divider` in that row |
| **K12** | "make settings button inline with switch to my dashboard" | both now sit in a new `.fo-page-header-actions` flex row inside the title row. **The real cause of the misalignment was found on the way**: `.fo-gear-btn` carried a stale `margin-bottom: var(--sp-1)` from when the gear stood alone on its own line, which made its outer box 36px and pushed it 4px off centre. Removed | the test measures both centres and requires them within 2px; they now match exactly at 161px |
| **K13** | "make switch to my dashboard work" | it navigates to `/?tab=pipeline`, and the Pipeline and Reports tabs gained the reverse control, `Switch to My View`, back to `/`. A two-way toggle over the two dashboards that exist, replacing a placeholder that said *"Front Office OS currently has a single dashboard view."* | the test follows it there and back, and asserts no placeholder modal opens |
| **K15** | "pipeline: accordions do not have gaps with each other. i want everything consistent" | **measured: My View had 16px gaps, `/?tab=pipeline` and `/?tab=reports` had 0px on all five pairs.** The 16px comes from `.list-page { gap: var(--sp-2) }`, which `.dash-widgets-panel` never had. Added it in the dashboards module layer and dropped the now-redundant `margin-bottom` from `.dash-home-head` | `e2e/accordion-rhythm.spec.ts` asserts every consecutive pair is 16px on five routes, and **fails** when the panel's gap is reverted |
| **K7** | "have uniform padding to all the accordion content" | **no change, because it already holds.** Measured across six routes: every `.record-section-body` computes to exactly `16px`. What Klent is seeing is nesting, not padding: on the two dashboards a `.dash-widget` card with its own 16px padding sits inside the accordion's 16px body, so the content reads as 32px inset there and 16px elsewhere. Guarded by a test asserting one padding value product-wide, and the nesting is recorded for batch 5 rather than silently changed |

### Two off-grid gaps found on the candidate record, and deliberately not fixed here

Measuring K15 turned up the candidate record's own rhythm faults, named precisely:

```
32px  after "Candidate Information" before "Main Status Details"
154px after "Attachments"           before "Requisition Details"
```

The 154px is not a gap at all: it is `U1`'s **second copy of the ten-button action bar** sitting between two sections. The 32px is a nested margin. Both belong to batches 2 and 5, so `accordion-rhythm.spec.ts` asserts the candidate record has **at most two** off-grid gaps, naming them in the failure message. It ratchets down as those batches land and fails if anything makes it worse.

### K5 corrected after Klent looked at it

He replied: *"i can see that you've added changes to the quick search section. what i meant there is when you click the left chevron icon. it should smoothly move to the left. also, chevron is nowhere to be found when quicksearch is minimized"*

Both halves were right, and the second was **my regression**.

**The bug I introduced.** My first K5 attempt replaced `display: none` with `opacity: 0; visibility: hidden` on the collapsed rail's title, body and cards. `visibility: hidden` keeps an element in layout, so the title kept its `flex: 1` inside a 32px rail and pushed the chevron out, where the `overflow-x: hidden` I had added in the same edit clipped it. Measured: the chevron's right edge sat at **36px** against a 32px rail. It also left the collapsed rail as tall as its expanded content, since the body no longer collapsed.

**What it is now.** `display: none` is back for the title, body and cards, so the collapse is clean and the chevron is the only thing in the header. The collapsed header's side padding drops from 16px to 2px with `justify-content: center`, which is what actually made the 16px chevron fit inside 32px. And the rail itself now carries `transition: width var(--motion-panel) var(--ease-out)`, so it slides rather than jumps.

**The guard had to be amended, deliberately, and it is recorded here rather than done quietly.** `scripts/check-motion.mjs` blocked this twice on purpose:

```
app/src/styles/layers/shell.css: transitions layout property "width"
app/src/styles/layers/shell.css: shell selector .fo-sidebar carries motion
```

`FORBIDDEN_PROPS` bars `width` from any transition, and `.fo-sidebar` was in `SHELL_SELECTORS`, which bars **all** motion on the shell frame. A `transform` would not do: it moves pixels without reclaiming the 270px the rail occupies, so the main content would not close the gap.

So `.fo-sidebar` moved out of `SHELL_SELECTORS` into its own rule with a single allowance, `SIDEBAR_RAIL_ALLOWED = /transition:\s*width var\(--motion-panel\) var\(--ease-out\);/`. **The exemption is narrow and was negative-tested**: adding `background 400ms linear` alongside it produces three separate failures, the 220ms budget, the layout property and the rail rule, and removing it passes again. Anything other than that exact width transition on the rail still fails.

**Proof:** `e2e/sidebar-collapse.spec.ts`, 2 tests. The first collapses the rail, polls its width to exactly **32px**, then asserts the `Expand sidebar` control is visible, that the chevron's box is wider than 8px, and that its right edge is **inside** the rail, then reopens and polls the width back to its original value. The second reads the computed `transition-property` and `transition-duration` off the rail and requires `width` with a non-zero duration. The first test is the one that fails on the exact bug Klent reported.

### K16 solved at its root: a screen-reader-only span was stretching the document

Klent: *"for some reason, expanding accordions also display a main browser scrollbar. i don't like that"*

**Measured before touching anything.** On `/recruit/candidates/…`:

```
before expanding: docScroll=1522  mainScroll=2121  documentActuallyScrolls=500
after expanding 11 accordions: docScroll=2692  mainScroll=3464
```

Two scrollbars, and the document one grew with the content, exactly as reported.

**Two wrong fixes, both discarded rather than left in.**

1. `html, body, #root { overflow: hidden }`. It removes the scrollbar but is a mask, not a fix: `scrollHeight` still reported 2692, `window.scrollTo(0, 500)` still moved the page to 500, and it would have blinded `phone.spec.ts`, whose whole job is measuring document overflow. Reverted.
2. `min-height: 0` on `.shell-main`. It was genuinely missing (the classic flexbox column trap, and `.fo-body` already had it), but it changed nothing here. **Kept anyway**, because it is correct and the next tall child would have hit it.

**The actual cause, found by walking the box chain from `main` to `html`:**

```
main.shell-content  client=604  scroll=4068   of=auto      <- correct, scrolls internally
div.shell-main      client=604  scroll=604    minh=0px
div.fo-body         client=604  scroll=604    minh=0px
div.shell           client=720  scroll=720
body                client=720  scroll=720
html                client=720  scroll=3412   <- every child is 720, yet html is 3412
```

Nothing in normal flow could do that, so the next probe listed absolutely positioned elements extending past the viewport. There was exactly one:

```
span.visually-hidden  pos=absolute  top=3412.12px  bottom=3412  h=1
```

`.visually-hidden` in `styles/layers/widgets.css` is the standard screen-reader-only recipe but it set **no `top` or `left`**. With `position: absolute` and no positioned ancestor, each hidden span resolves against the initial containing block at its **static position**, which on a 4068px-tall record page is 3412px down. A 1px, clipped, invisible element was therefore stretching the document by three thousand pixels. There are five of them in the shell and shared components (`PrimaryNav`, `ListPage`, `KanbanBoard` twice, `StatusHistory`).

**Fix:** `top: 0; left: 0` on `.visually-hidden`, plus `clip-path: inset(50%)` alongside the legacy `clip`. Position is irrelevant to a screen reader, which follows DOM order, so nothing is lost.

**Result:** `docScroll` **0** before and after expanding all 11 accordions, and `window.scrollTo(0, 400)` leaves `window.scrollY` at **0**. One scroller, `main`.

**Proof, and it is not vacuous.** `e2e/single-scroller.spec.ts` expands every accordion on five routes and requires zero document overflow and zero document scroll, naming any absolutely positioned stretcher it finds. A second test confirms `main` still scrolls to the bottom, so nothing became unreachable. Reverting the `top: 0; left: 0` makes the guard report **5 offending routes**, which is the other thing this proved: **K16 was product-wide, not specific to tall records.** The dashboard and pipeline had it too, just with less content to make it obvious.

This is also the mechanical explanation for the audit's central finding, that `document.documentElement.scrollHeight` read 900 on 124 of 126 pages while 63-65% of the content sat below the fold, and why `window.scrollTo` behaved as a no-op.

### K8 and K18 delivered

**K8, "differentiate main buttons and secondary buttons."** Measured first, and the diagnosis was not what the wording suggests. The four variants **already look different**: primary is solid `rgb(54,121,181)` on white, secondary is white with a blue border, ghost is transparent with no border, danger is solid `rgb(192,57,43)`. The defect is how many primaries a page shows:

```
candidate record    4 primaries: Save profile, Save profile, Add task, Add reminder
requisition record  4 primaries: Put on hold, Mark filled, Put on hold, Mark filled
candidates list     0 primaries, 11 secondary, 20 ghost
intake              0 primaries, 5 secondary
```

Two of the four on each record are the **same button twice**, which is `U1`'s duplicated action bar and belongs to batch 2. The genuine faults were:

- **Every available lifecycle transition rendered as primary**, from `variant={target === 'closed' ? 'danger' : 'primary'}`. With an open requisition offering `on_hold`, `filled` and `closed`, two solid blue buttons competed. Fixed with a declared `REQ_PRIMARY_ACTION` map in `modules/recruit/lib.ts`, because **the forward action is not the first in the transition list**: `open` lists `['on_hold', 'filled', 'closed']`, so picking index 0 would have made "Put on hold" the main action. The map says `open` to `filled`, `on_hold` to `open`, `draft` to `waiting_approval`, `waiting_approval` to `open`. Everything else is secondary, `closed` stays danger.
- **Intake had no primary at all**, so `Paste LinkedIn URLs`, `Import a sheet` and `More` were indistinguishable. The first is now primary.
- The candidates list has no create action, so zero primaries there is correct and was left alone.

`e2e/button-hierarchy.spec.ts`, 3 tests: at most one primary per `.record-section`, `.record-action-bar`, `.list-page-toolbar` or `.dash-widget` across seven routes; the create action on deals and intake must carry `btn-primary`; and the variants must compute to distinct backgrounds, colours and borders, so a rename can never quietly collapse two of them. Reverting the lifecycle change makes the first test report **4** offenders.

**K18, "add a white wrapper to page headers, include the search box and buttons, so sticky covers everything and is not see-through."** A shared `.fo-page-head` wrapper now encloses the header, the search row and the toolbar in `ListPage`, and the title row plus action bar in `RecordPage`. It carries `background: var(--fo-surface)`, a border and `padding: var(--sp-2)`, so a later `position: sticky` on it will be opaque. `e2e/page-head-wrapper.spec.ts` checks seven routes for a wrapper that is not transparent and that actually contains both the heading and a search box or button, which is the part that makes sticky useful rather than merely opaque.

### K14 delivered: the nine dashboard controls now do real work

Klent: *"home page: review all buttons and make them actually work. not just display a modal saying not part of vvfoos."* And, when I proposed removing five of the six calendar views: *"that's the point, we're adding functions to behaviorless controls. why skip 5 because of claude.md?"*

**The one thing that made this buildable, checked in the database first.** `activities`' insert policy is `can_access_activity(person_id, company_id, deal_id, application_id, requisition_id, created_by)`, whose last clause is:

```sql
or (p_person is null and p_company is null and p_deal is null
    and p_application is null and p_requisition is null and p_creator = auth.uid())
```

A **standalone personal activity is already permitted**, so a calendar event needs no schema change and no new policy. `tasks` likewise allows an insert when `assignee_id = auth.uid()`. Neither needed a migration.

| Control | Before | Now |
| :---- | :---- | :---- |
| `New Event` | `show('New Event')` | opens a real dialog and inserts an `activities` row, `kind = 'meeting'`, `created_by` the signed-in staff, no linked record. The day view shows it immediately |
| `New Task` | `show('New Task')` | inserts a `tasks` row with `assignee_id` the signed-in staff and `status = 'open'`, which `MyTasks` already lists and can complete |
| `Schedule interview` (calendar) | `show(…)` | the same dialog with a **Candidate** combobox reading `candidate_list`, writing `person_id` so the meeting is linked |
| `Schedule interview` (My Interviews) | a second placeholder | the same real dialog. `U35` recorded this control appearing twice; both now work and both refresh their own section |
| `Day view` | `show('Day view')` | one day of entries, listed by time |
| `7-day view` | `show('7-day view')` | the week from Sunday, grouped by day |
| `31-day view` | `show('31-day view')` | the month as a 7-column grid with a per-day count |
| `Person view` | `show('Person view')` | grouped by `created_by` resolved through `staff.full_name`. `attendees` is empty on all 214,432 activity rows, so grouping by attendee is impossible and this substitution was recorded before the build |
| `Group view` | `show('Group view')` | grouped by `staff.role`, which is **Klent's own decision** when told there is no team table |
| `Agenda view` | `show('Agenda view')` | the next 30 days, flat and chronological, grouped by day |
| `My Interviews` body | the fixed sentence "There are currently no interviews scheduled." | upcoming `meeting` activities that are linked to a person or an application, and the sentence only when there genuinely are none |

New files: `pages/calendarData.ts` (range maths and one read across `activities`, `tasks` and `reminders`), `pages/MyCalendar.tsx`, `pages/NewCalendarEntryDialog.tsx`, `pages/MyInterviews.tsx`. `pages/CalendarViewIcons.tsx` stopped being a placeholder and became a controlled `role="group"` with `aria-pressed` on the current view.

**Proof, `e2e/dashboard-calendar.spec.ts`, 5 tests.** Each write is checked in the database, not just on screen: `New Event` must produce exactly one `activities` row with `kind = 'meeting'`; `New Task` exactly one `tasks` row with `status = 'open'`; `Schedule interview` one row. All six views must report `aria-pressed="true"` when selected, must not open `.fo-placeholder-modal`, and must not all describe the same range. The interviews test seeds a linked meeting, expects it on screen, and requires the "no interviews" sentence to be gone.

**Klent's CRUD rule honoured.** Every fixture is tagged `QA cal <pid>-<random>`, `afterEach` deletes by that prefix, and `select count(*) from activities where subject like 'QA cal %'` returns **0** after the run. No seeded or imported record was touched.

One test failure on the way was mine, not the product's: `getByRole('button', { name: 'Day view' })` matched three buttons, because "Day view" is a substring of "7-day view" and "31-day view". Fixed with `exact: true`.

### K17 and K19 delivered, and three of these controls could not be built on what exists

Klent: *"pipeline: review all the buttons in this page and make them work"* and *"requisitions: review all the buttons and make them work, not just display modals saying not part of foos mvp."* His correction from Goal 10 also applies: a behaviourless control gets behaviour, and removal is only right when there is genuinely nothing to build against, with the reason stated in one sentence.

**Checked in the database before deciding anything.** Three facts settled which controls were buildable:

```
no DELETE policy on public.requisitions for any role      -> bulk Delete can never work
no forms table, no template table                         -> Forms has nothing behind it
no requisition-to-contact relationship in the schema      -> Attach Contact has nothing to attach to
candidate_list has no application-stage column            -> ATS stage bars cannot drill through
/sales/deals already reads ?stage=                        -> CRM stage bars already do drill through
```

| Control | Decision | Why |
| :---- | :---- | :---- |
| `Change status to…` (requisition list bulk bar) | **Built** | A real picker offering only the statuses **every selected requisition** can legally reach, computed by intersecting `REQ_TRANSITIONS` across the selection, then one `update … in (ids)`. It reports "Select requisitions to change their status", "N selected", or "The selected requisitions share no legal next status" |
| Intake channel bars (Source Effectiveness) | **Built** | `QueueListPage` now seeds its channel filter from `?channel=`, so the bars navigate to `/intake?channel=<channel>`. The bar labels are the raw channel values, which is exactly what the filter accepts |
| CRM stage bars | **Already worked** | `onBarClick` already navigated to `/sales/deals?stage=…`. The note claiming otherwise was about the ATS panel only |
| `Delete` (bulk) | **Removed** | The database has no DELETE policy on `requisitions`, so no client can delete one. Recorded as finding `S8` |
| `Forms` (list and record) | **Removed** | There is no forms or template table in the schema, so there is nothing to render |
| `Send To` (record) | **Removed** | There is no staff-to-staff send in the product |
| `More ▾` (record) | **Removed** | It opened an empty menu |
| `Search` (Next Steps) | **Removed** | It duplicated `Candidates (n)` beside it, which already scrolls to the application pipeline |
| `Attach Contact` / `New Contact` (record) | **Replaced with something real** | No requisition-contact relationship exists, but `requisitions.company_id` does, so the section is now `Company contacts (n)`, listing the linked company's contacts from `contact_list` with their title and a primary marker, each linking to its contact record. When no company is linked it says so instead of showing an empty list |
| The five developer notes on the dashboards | **Rewritten as user copy** | `U50`. "Stage bars aren't clickable yet — no application-level list view exists in the app today" became "Open a requisition to see its applications at each stage"; "Add `useSearchParams` support there (same pattern as `/recruit/requisitions`)" became "Pick a channel to open its intake queue"; "Sourced from a definer-refreshed materialized view (audit_log is admin-read only)" became "Always the last 90 days, updated every 15 minutes. The range picker above does not apply to this panel" |

**Proof.** `e2e/requisition-bulk.spec.ts`, 3 tests: the bulk picker must exist and drive the status to `filled` **in the database**; `Send To`, `Forms` and `Attach Contact` must have a count of zero; the record must show `Company contacts (n)` and no longer say "No contacts attached." `e2e/dashboard-drillthrough.spec.ts`, 2 tests: `/intake?channel=linkedin_url` must arrive with that channel preselected, and the expanded panels on both dashboards must contain none of eight banned phrases (`useSearchParams`, `aren't clickable`, `local component state`, `published URL`, `materialized view`, `definer-refreshed`, `audit_log is admin-read`, `mv_stage_durations`). That test found **10** occurrences on the first run, in two panels I had not touched.

**The CRUD rule, and where it could not be followed.** My first version of the bulk test created a requisition and could not delete it, leaking three rows across three runs, which I found by querying and removed. Because `S8` means nothing can delete a requisition, the test now reads `REQ-0002`'s status, changes it, and restores it, with `afterEach` asserting the original value came back. `select count(*) from requisitions where title like 'QA bulk req %'` returns **0** and `REQ-0002` is back to `open`. That is the same read-modify-restore shape QA-028 was fixed into, and it is the honest answer when the delete half of the rule is impossible.

### Batches 7 and 8, first pass: developer copy and the conventions

**Batch 7, delete developer copy.** Every occurrence of the project's internal vocabulary is gone from what a user reads. `grep -rn "FOOS MVP" app/src --include='*.tsx'` went from **7 to 0**.

| Where | Was | Now |
| :---- | :---- | :---- |
| `shell/Placeholder.tsx` | "This action is not available in the current FOOS MVP." | "This is not available yet." |
| `shell/UtilityHeader.tsx` ×2 | `show('Administration', 'General configuration is not part of the FOOS MVP.')` | `show('General configuration')`, so the overlay names the thing rather than the release |
| `modules/settings/SettingsPage.tsx` | a sentence that explained the utility header's menu to the person standing in it, and quoted another message verbatim | "These areas are not available yet." Section title lost its colon too (`U40`, `U76`) |
| `pages/ModulePlaceholderPage.tsx` | "This module isn't built in the current FOOS MVP. The page shell is in place so it is ready when it is." | "Onboarding is not available yet." |
| `CandidateRecordPage.tsx` | "Flagging candidates is not implemented in the FOOS MVP yet." | `show('Flag')` |

That closes `S5` and the copy half of `U38`, `U39` and `U70`. The five dashboard notes went in the K17 work above.

**Batch 8, one convention per thing.** `B4` is closed: the `is_test` checkbox reads **`Test record`** on all four create forms, the CSV consequence moved to a `field-hint` under it, the `Flags` group heading that existed to hold one checkbox is gone, `Test data (is_test)` no longer prints a column name, and the badge on the candidate and requisition records now says `Test record` too, so the flag reads the same on a form and on a record.

**`U111` needed a different fix than the finding proposed.** It records that New Contact marks no field required while three sibling forms do. But the validation is *"A first or last name is required."*, so marking either field with an asterisk would state something false. The form now carries the rule instead: "Give at least a first or a last name." A hint that is true beats a marker that is not.

`e2e/copy-conventions.spec.ts`, 2 tests. The first collects every `label` matching `/test/i` across the four create forms and requires the set to be exactly `['Test record']`. The second reads `main` on six routes and fails on any of `FOOS MVP`, `is_test`, `useSearchParams`, `page shell` or `utility header`.

One failure on the way was mine: I anchored the measurement on `.fo-page-head`, which the K18 wrapper now renders immediately, so the evaluate ran before the form existed and found zero labels. Anchored on the checkbox itself. That is the fourth time in this goal that a too-weak anchor produced a false reading, and each time the fix was to assert the condition rather than wait longer.

### Batches 7 and 8, first pass: developer copy and the conventions

**Batch 7, delete developer copy.** `grep -rn "FOOS MVP" app/src --include='*.tsx'` went from **7 to 0**.

| Where | Was | Now |
| :---- | :---- | :---- |
| `shell/Placeholder.tsx` | "This action is not available in the current FOOS MVP." | "This is not available yet." |
| `shell/UtilityHeader.tsx` ×2 | `show('Administration', 'General configuration is not part of the FOOS MVP.')` | `show('General configuration')`, so the overlay names the thing rather than the release |
| `modules/settings/SettingsPage.tsx` | a sentence explaining the utility header's menu to the person standing in it, quoting another message verbatim | "These areas are not available yet." The section title also lost its colon (`U40`, `U76`) |
| `pages/ModulePlaceholderPage.tsx` | "This module isn't built in the current FOOS MVP. The page shell is in place so it is ready when it is." | "Onboarding is not available yet." |
| `CandidateRecordPage.tsx` | "Flagging candidates is not implemented in the FOOS MVP yet." | `show('Flag')` |

That closes `S5` and the copy half of `U38`, `U39` and `U70`. The five dashboard notes went in the K17 work above.

**Batch 8, one convention per thing.** `B4` is closed: the `is_test` checkbox reads **`Test record`** on all four create forms, the CSV consequence moved to a `field-hint` beneath it, the `Flags` group heading that existed to hold a single checkbox is gone, `Test data (is_test)` no longer prints a column name, and the badge on the candidate and requisition records says `Test record` too, so the flag reads the same on a form and on a record.

**`U111` needed a different fix than the finding proposed.** It records that New Contact marks no field required while three sibling forms do. But the validation is *"A first or last name is required."*, so an asterisk on either field would state something false. The form now carries the rule instead: "Give at least a first or a last name." A hint that is true beats a marker that is not.

`e2e/copy-conventions.spec.ts`, 2 tests. The first collects every `label` matching `/test/i` across the four create forms and requires the set to be exactly `['Test record']`. The second reads `main` on six routes and fails on any of `FOOS MVP`, `is_test`, `useSearchParams`, `page shell` or `utility header`.

**Two failures on the way, both mine.**

1. I anchored the label measurement on `.fo-page-head`, which the K18 wrapper renders immediately, so the evaluate ran before the form existed and found zero labels. Anchored on the checkbox instead. Fourth time in this goal a weak anchor produced a false reading, and every fix was to assert the condition rather than wait longer.
2. **A real regression the gate caught:** `record-ui.spec.ts:76` asserted the placeholder body matched `/not available in the current FOOS MVP/i`, which is the exact string batch 7 deleted. The product change is right and the test encoded the old copy, so the assertion moved to `/not available yet/i`. I grepped the whole suite for the old wording first rather than fixing one occurrence and rediscovering the rest: two hits, one of them `copy-conventions.spec.ts`'s own banned list, which is correct as it stands.

## Batches 1 and 2, targets located before implementing

### Batch 1, the table column rule

`Table` renders `columns.map` in two places, at `components/ui/Table.tsx:228` (the header) and `:300` (the cells), and the empty-state row spans `columns.length + (selectable ? 1 : 0)` at `:266`. So one derived `visibleColumns` list feeds all three.

The rule stays **opt-in** via `hideWhenEmpty`, and it does nothing when `rows.length === 0`, so an empty table keeps its headers, which the audit recorded as one of the things this product already gets right.

Columns that qualify, each verified against its definition rather than the finding text:

| Column | Where | Why it qualifies |
| :---- | :---- | :---- |
| `State/Territory` | `CompaniesListPage.tsx:160` | `render: (c) => c.state ?? EMPTY_CELL`, and `state` is null on all 20 visible rows. `row['state']` is what the default reader sees, so no extra plumbing |
| `Since` | `ContactsListPage.tsx:182` | already has `sortValue: (r) => r.profile.since_date ?? ''`, which is exactly the reader `hideWhenEmpty` needs |
| `Company` | `RequisitionListPage.tsx:105` | empty on every row **for the sourcer only**, because company data is not visible to that role. The flag is evaluated per render, so it disappears for the sourcer and stays for admin |
| five of nine | `ApplicationPipeline.tsx:90-98` | `Next step`, `Shortlisted`, `Rank`, `Source` and `Rejection reason` were empty on all 21 rows in the audit |

**`Type` on Accounts is deliberately not marked.** `B7` proposes dropping it, but it is not empty: it renders a `prospect` badge on all 20 rows. That is a *constant* column, not an empty one, and hiding a column because today's data happens to be uniform would remove a status column the moment a dataset is homogeneous. It stays, and `B7` is downgraded to the width argument it also makes: the space belongs to `Website`, which is clipped.

### Batch 2, one record action bar

Measured: both record pages build `actionBarContent` once and render it **twice**.

```
CandidateRecordPage.tsx:326    actionBar={actionBarContent}
CandidateRecordPage.tsx:763    <div className="record-action-bar fo-record-bottom-bar">{actionBarContent}</div>
RequisitionRecordPage.tsx:354  actionBar={actionBarContent}
RequisitionRecordPage.tsx:608  <div className="record-action-bar fo-record-bottom-bar">{actionBarContent}</div>
```

That second copy is what `accordion-rhythm.spec.ts` currently tolerates as a **154px gap** between `Attachments` and `Requisition Details`: it is not a gap at all, it is ten buttons sitting between two sections.

The fix is the one `U1` proposes and `K18` already prepared: the bottom copy goes, and `.fo-page-head`, which is now opaque and holds the header plus its controls, becomes sticky so the single bar stays reachable on a 4,187px page. `Erase…` and `Merge duplicate…` then move behind the existing `More ▾`, leaving `Save profile` as the only primary, which is what `K8`'s one-primary-per-group guard already enforces.

### Batches 1 and 2 delivered

**Batch 1, the table column rule.** `TableColumn` gained `hideWhenEmpty`, and `Table` derives one `visibleColumns` list that feeds the header, the cells and the empty-state `colSpan`. It reads each row through `sortValue` when the column has one and `row[key]` otherwise, and treats `null`, `undefined`, `''` and `EMPTY_CELL` as empty. **It does nothing when there are no rows**, so an empty table keeps its headers.

Marked: `State/Territory` on Accounts, `Since` on Contacts, `Company` on the requisition list, and five of nine on the application pipeline (`Next step`, `Shortlisted`, `Rank`, `Source`, `Rejection reason`).

**Two mistakes I made and caught by reading, not by luck.** The first flag went onto `RequisitionListPage`'s `COLUMN_DEFS`, which is the **column-picker** list typed `{ key; header }`, so TypeScript rejected it and pointed at the real definitions 280 lines later. The second went onto `ApplicationPipeline`'s `EXPORT_COLUMNS`, which is the **CSV export** list; that one type-checked cleanly and would have done nothing at all to the table while quietly polluting the export definition. Both moved to the real `TableColumn[]`.

**`B7` is declined and the reason recorded.** It asks for the `Type` column on Accounts to be dropped. It is not empty: it renders a `prospect` badge on all 20 rows. Hiding a column because today's data is uniform would make a status column vanish the moment a dataset is homogeneous. Its other half stands, that the width belongs to `Website`.

`e2e/empty-columns.spec.ts`, 4 tests, including the pair that matters most: **admin keeps `Company` and the sourcer loses it**, from the same code, because RLS leaves that column empty for one role and not the other. Disabling the rule fails 2 of the 4.

Two test-side faults on the way, both the same class. `main table tbody tr` also matches the **empty-state row**, so the first version read the headers while `rows.length` was still 0 and every column was therefore shown; anchored on `tbody tr[data-row-key]`. And `clearCookies()` does not sign a user out, because Supabase keeps the session in `localStorage`, so `/login` redirected and the email field never appeared; split into two tests with fresh contexts.

**Batch 2, one record action bar.** The second copy is gone from both record pages, `.fo-page-head` is now `position: sticky` so the single bar survives a 4,187px page, and the dead `.fo-record-bottom-bar` rules were removed from `recruit.css` and `print.css`.

`More ▾` was itself a placeholder, so `U1`'s "move them behind the existing menu" had nothing to move them into. New `components/ui/ActionMenu.tsx` is a real `role="menu"` built on `useDismissable` with the `escapeScope` ref, which is the QA-024 shape, so Escape closes only this menu. `Merge duplicate…` and `Erase…` now live in it, `Erase…` marked destructive, and the bar's only primary is `Save profile`.

**The last off-grid gap on the candidate record turned out to be a scroll anchor.** After the bottom bar went, one 32px gap remained between `Candidate Information` and `Main Status Details`. The cause was `<div ref={profileSectionRef} />`, an empty anchor used by `scrollToProfile`: as a flex child of a container with `gap: var(--sp-2)` it cost **two** 16px gaps for zero height. `RecordSection` gained an optional `id`, the section carries `id="main-status-details"`, and `scrollToProfile` scrolls to that. The anchor div and its ref are gone, and `accordion-rhythm.spec.ts` now asserts the candidate record has **zero** off-grid gaps, ratcheted down from the two it previously tolerated.

`e2e/record-action-bar.spec.ts`, 3 tests: exactly one `.record-action-bar` and zero `.fo-record-bottom-bar` on both record pages; `Erase…` and `Merge duplicate…` absent from the bar but present as `menuitem`s behind a `More` that opens a real menu and closes on Escape without a placeholder; and the head computing to `position: sticky` with the bar still visible after scrolling `main` by 1200px.

### Batch 3 delivered, and the sticky header withdrawn

**Batch 3, the section shell.** `RecordSection` gained `count?: number`, which renders `Title (n)`, and `empty?: boolean`, which forces the section closed. Applied on the candidate record to `Resumes`, `Attachments`, `Events`, `Tasks`, `Reminders` and `Status History`. That is `U2`'s proposed fix in the form the finding asked for: *"render empty ones collapsed by default with the count in the header (`Attachments (0)`), which is the Taleo idiom and costs one line each instead of six."*

**The blanket rule I first wrote was wrong, and the test told me.** My assertion was "no zero-count section starts open", which failed on `Tasks (0)` and `Reminders (0)`. Those two are open on purpose: they carry the **only** way to add a task or a reminder, so collapsing them would hide the create form behind a click. The rule is now precise and checked from the DOM rather than an allowlist: an empty section may start open **only if its body offers a way to add something**. A section that merely says "none yet" must start collapsed with its count in the header.

**The sticky page head is withdrawn, and this is a correction to my own batch 2 work.** Re-reading K18: *"add a white wrapper to it … so that if we use sticky to these components, they cover everything and not see through."* The ask is the **opaque wrapper**, so that sticky becomes possible. I went further and turned sticky on, and it cost two real test failures:

```
bulk-actions.spec.ts:88   locator.click: Test timeout
  - waiting for getByRole('dialog').getByRole('combobox', { name: 'Main status' })
  - element is not stable  (x4 retries)
erase-candidate.spec.ts:31 locator.click: Test timeout
```

Bisected by reverting only the three sticky declarations: the bulk-actions test passed immediately. A `position: sticky` head inside the `main` scroller left a dialog's combobox reporting `element is not stable` on every retry. So the wrapper keeps its opaque background, border and padding, and `position: sticky` is off. `record-action-bar.spec.ts` now asserts the wrapper is **not** transparent, **does** contain the action bar, and is **not** sticky, with the measured reason in the failure message so nobody re-enables it without reading why.

Consequence accepted: on a 4,187px record the single action bar scrolls out of view. `U1` allows exactly that, and explicitly rejects the alternative that was there before, a second copy of all ten buttons.

**The `Erase…` tests had to move with the button.** `erase-candidate.spec.ts` clicked `Erase…` directly; it now opens `More` and clicks the `menuitem`. Its sibling test, which checks a recruiter is **not** offered erase, now opens the menu and asserts the item is absent inside it, which is a stronger check than before: the old version would have passed even if the button had simply been renamed.

**One more dead export caught by the gate**, the same class as `ALL_TIME_FROM`: `ActionMenuItem` was exported and never imported. Made module-local; `npx knip` clean.

### The cost of moving a control, paid in one place

Moving `Merge duplicate…` and `Erase…` behind a real `More ▾` menu broke **five** assertions across four specs, all of which clicked those two as top-level buttons. Every one was a legitimate consequence of the product change, not a defect, and each was updated to open the menu and act on the `menuitem`:

| Spec | What it did | What it does now |
| :---- | :---- | :---- |
| `erase-candidate.spec.ts:34` | clicked `Erase…` | opens `More`, clicks the `menuitem` |
| `erase-candidate.spec.ts:68` | asserted a recruiter sees no `Erase…` button | opens `More` and asserts the item is absent **inside** it, which the old version could not distinguish from a rename |
| `interaction-motion.spec.ts` ×3 | clicked `Merge duplicate…`, twice in one test | one local `openMerge(page)` helper used at all three sites |
| `merge-candidates.spec.ts:47, :77` | clicked, and asserted the disabled title for a sourcer | both go through the menu; the sourcer case still checks `toBeDisabled` and the exact `title` |

**And one shared helper had to change, which is the part worth remembering.** `recordSection()` in `helpers.ts` matched a section by `new RegExp('^[▸▾]?\\s*' + title + '$')`. Batch 3 appends a count to those headers, so `^Attachments$` stopped matching `Attachments (0)` and every test using `expandSection` on a counted section would have failed. The regex now accepts an optional ` (n)` suffix. Fixing the helper once was the difference between one edit and a dozen.

`form-affordances.spec.ts:97` also needed an `expandSection(page, 'Attachments')`, because the file input it measures lives inside a section that batch 3 now collapses when empty. That is the intended behaviour, and the test simply had to open what it was inspecting.

**Each of these was found by grepping the whole suite for the moved label before fixing anything**, rather than fixing the one the gate happened to name and rediscovering the rest on the next run.

### Batch 5, and two of its findings turned out to rest on a false premise

**Measured before changing anything, and most of the batch was already done.** The off-grid gaps `U4` records as 47 to 188px between the stacked toolbar strips on every list page are **gone**:

```
/recruit/candidates []   /recruit/requisitions []   /sales/companies []
/sales/contacts []       /sales/deals []            /intake []
```

Zero gaps that are not a multiple of 8 between the top-level children of `.list-page`, on all six. K18's `.fo-page-head` wrapper absorbed the three or four separate strips into one container with a single 16px gap, so `U4` closed as a side effect of a change made for a different reason. The record pages were already covered by `accordion-rhythm.spec.ts`, and the candidate record is at zero after batch 2.

**`U41` and `U67` rest on a premise I could not support.** The finding is "a narrow block pinned left inside a wide container". Measured:

```
/settings        table.settings-export-table   544px of 940px
/intake/linkedin div.record-section-body       638px of 940px
/intake/sheet    div.record-section-body       638px of 940px
```

Both numbers come from deliberate declarations, `max-width: 34rem` on the export table and `max-width: 640px` on the two intake form pages. A 940px-wide form is worse to read and fill than a 640px one, and a 640px measure is ordinary good practice, so **widening them would be a regression dressed as a fix.** I have not widened either, and the finding is corrected rather than implemented.

**What was genuinely wrong there is different, and it is fixed.** The two intake pages hand-roll `<div className="record-title-row">` instead of using the shared `RecordPage`, so they never received the K18 wrapper and their headers looked unlike every other page. Rather than restructure seven hand-rolled headers across two files, one rule now covers them, and it can only ever match the hand-rolled case because `RecordPage` nests its title row inside `.fo-page-head`:

```css
.record-page > .record-title-row {
  background: var(--fo-surface);
  border: 1px solid var(--fo-border);
  padding: var(--sp-2);
}
```

`page-head-wrapper.spec.ts` gained a test that reads the computed background, border width and padding off `.record-page > .record-title-row` on both intake routes and requires all three to be set. `intake-flows.spec.ts` still passes, which is what mattered about not touching the JSX.

**`B6`, two empty states side by side, is fixed at the component.** `SidePanelTabs` returns `null` when **every** tab reports `count === 0`. Both callers, `EngagementPanel` and the candidate record, pass a count for every tab, so this is reliable rather than a guess. An untouched record now shows the left column's single "No activity yet." and no eight-tab strip; `e2e/empty-side-rail.spec.ts` asserts at most one "nothing here" message and zero `.side-tabs-bar`, then seeds one note and requires the rail and its `Notes` tab to come **back**, so the collapse cannot become a permanent disappearance. The note is deleted in `afterEach` and `select count(*) ... like 'QA rail %'` returns 0.

### A test that only passed because the product was broken

B6's collapse exposed something worth recording. `record-ui.spec.ts:84`, "3.1 a company record shows contacts, deals, requisitions and an activity timeline", asserted the side panels with:

```ts
for (const panel of ['Notes', 'Calls', 'Meetings', 'Events', 'Emails']) {
  await expect(page.getByText(panel, { exact: true }).first()).toBeVisible();
}
```

Two separate weaknesses, both invisible until now:

1. **It depended on whichever company sorted first having no activity.** With the rail collapsing when every tab is empty, the assertion started failing. The test now seeds one `note` against the company it opened, reloads, and deletes it in `afterEach`, so it no longer depends on what the data happens to look like.
2. **`exact: true` only matched because the counts were zero.** With one note, the tab's text content becomes `Notes1`, because a count badge renders beside the label, so an exact-text match cannot succeed. The assertion moved to `getByRole('tab', { name: /^Notes/ })`, which is what it always meant.

So an assertion written to prove the panels exist was, in practice, proving they were empty. That is the same class as QA-027 and the four anchor faults in this goal: **a check that cannot distinguish the state it is asserting from a different state is not a check.**

### Batch 11, accessibility and state

**`U22` was measured before it was fixed, and the finding's number was wrong.** It records "67 disabled controls carry no `title` against 11 that do". Swept across ten routes, the real count of disabled controls with no reason was **18**:

```
/                     1  the Include Onboarding checkbox
/recruit/candidates   4  First page, Previous page (x2 pagers)
candidate record      2  Add task, Add reminder
/recruit/requisitions 5  Change status to, plus the two pagers
/sales/deals/new      1  Primary contact
/intake               1  Export CSV
/settings             2  Add template, Export CSV
/employees            1  the disabled Search box
```

**Eight of the eighteen were one shared component.** `Pager`'s four buttons now say `You are on the first page`, `You are on the last page` or `Still counting the rows` rather than nothing, which fixed both pagers on every list at once. `ListPage`'s `Export CSV` says `There is nothing in this list to export` or `Building the file`. `engagement.tsx` says `Give the task a subject first` and, for reminders, distinguishes the missing subject from the missing time. `EmailTemplatesCard` names which of the three fields is still empty. `DataExportCard` distinguishes "another export is running" from "the row count is unavailable" from "there is nothing to export".

`Select` gained a `title` prop for this, typed `string | undefined` because the project runs `exactOptionalPropertyTypes`.

The sweep now returns **zero**. `e2e/disabled-reasons.spec.ts` walks `main [disabled], main [aria-disabled="true"]` on ten routes and fails on any control without a non-empty `title`.

**`C3`, the sidebar Search doing nothing on an empty field.** The submit handler returned early when the term was blank, so the button looked live and did nothing. It is now disabled with `Type something to search for`, and when there is a term the title says what it will search: `Search candidates for "…"`. Its inline `style` attribute also moved into `.fo-qs-search-btn`, since an inline style sits outside the cascade layers entirely, which is the one thing `check-css-layers` exists to prevent.

**`C1`, the APG menu keyboard contract.** QA-024 fixed only Escape. New `hooks/useMenuKeyboard.ts` implements the rest once and is used by all three menus, the two in `UtilityHeader` and the new `ActionMenu`: opening focuses the first item; `ArrowDown` and `ArrowUp` move and **wrap**; `Home` and `End` jump; `Tab` closes. `ArrowDown` or `ArrowUp` on a closed trigger opens the menu and lands on the first item, which is the part of the contract a mouse user never notices and a keyboard user cannot work without.

`e2e/menu-keyboard.spec.ts` walks the whole contract on a real menu, including the wrap from the first item back to the last, and checks `Tab` closes the new `ActionMenu`.

### C5 and C6, and a correction to C6's premise

**`C6`'s premise does not survive checking.** The finding says route transitions show no intermediate state, measured as `suspenseFallback=false authGate=false spinners=0` at 0, 150, 400 and 800ms. But `App.tsx:35` has always had `<Suspense fallback={…}>` on every lazy route. The fallback exists; it is simply never on screen long enough to photograph, because the chunks load in single-digit milliseconds against a local dev server. **The audit measured its own speed, not a missing state.** Nothing was broken, so nothing there is "fixed".

**What was genuinely wrong is that both loading states were one bare word, spelled two different ways.**

```
App.tsx:35        <div className="full-center text-secondary">Loading...</div>
RequireAuth.tsx   <div className="full-center text-secondary">Loading…</div>
```

Three dots in one place, an ellipsis in the other, no spinner in either, and nothing announced to a screen reader. That is `C5` ("the boot gate is one centred word, `shellNodes=0`") plus a convention split that belongs with batch 8.

New `components/ui/LoadingPane.tsx` uses the existing `Spinner` with its `label`, so the state is announced as `role="status"`, and names what is loading: `Loading Front Office OS…` at the boot gate, `Loading this page…` on a route swap. Both call sites now use it.

`e2e/loading-states.spec.ts` proves it by **making** the state observable rather than hoping to catch it: it intercepts `**/rest/v1/staff*` and holds the first response for three seconds, then asserts the pane, the spinner ring, the text, and a `role="status"` with the right accessible name, before releasing the route and confirming the page finishes loading. The second test walks every text node for `/Loading[.…]*/` and fails if any still ends in three dots.
