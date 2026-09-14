# VVPH_VV-FOOS_Record_Requisitions-UI-Pass_2026-09-10_v1.0_Final

**Project:** VentVest Front Office OS (VV-FOOS) · **Scope:** `/recruit/requisitions`, its record and edit pages, and the shared components the work produced · **Branch:** `feat/requisitions-ui-pass` · **Commits:** `6fc02c8`, `df3077e`, `3a402a9`, `688890d`

Every claim below is marked as measured, verified, or open. Numbers came from the browser or from a guard script, not from reading code.

## 1. What shipped

### 1.1 New shared components (`app/src/components/ui/`)

| Component | Purpose |
| :---- | :---- |
| `SettingsDialog` | The `fo-dialog-*` shell both settings dialogs sit on: chrome, hint paragraph, footer render prop |
| `SectionSettingsDialog` | Per-staff accordion visibility, plus a second column choosing which sections open on page load |
| `ColumnSettingsDialog` | Drag to reorder plus show/hide, on `@dnd-kit/core` so it works with pointer, pen and touch; Arrow Up/Down on the grip for the keyboard |
| `SettingsButton` | The borderless sliders icon that opens any of them |
| `RecordSkeleton` | A record page's loading state: two head bars then collapsed-accordion shapes; `panel` wraps them in the white form panel |
| `SegmentedToggle` | Two or three segments with a sliding thumb; `label: ''` plus `title` gives an icon-only segment |
| `Breadcrumbs` | `ListPage` and `RecordPage` both take the same array as a `breadcrumbs` prop |
| `BootScreen` | The first-load gate behind `RequireAuth` |
| `PageSkeleton` / `RouteSkeleton` | `RouteSkeleton` waits 200ms before painting, so a fast lazy-chunk load shows nothing |

Deleted: `BackToList`, `LoadingPane`.

New shared code: `lib/printRecord.ts` (`printExpanded`), `lib/format.ts` (`sentenceCase`), `hooks/useScrollShadow.ts`.

### 1.2 Behaviour

- **Saved views carry column order.** The requisition list keeps an ordered `columnOrder` plus a `hiddenCols` set; the table, the CSV export and the Advanced Search column list all read that order. Saving a view captures the arrangement as well as the visibility. Saved views do not carry the search term.
- **The list search waits 2000ms** and the timer restarts on every keystroke, insertion or deletion alike. The magnifier and Enter bypass the wait through `ListPage`'s `onSearchSubmit`. Measured: 0 queries across 7 keystrokes, then one at **2008ms** after the last.
- **A skeleton is held for 1000ms** so a fast response cannot flash it, and a slower response adds no delay of its own. Measured: **984ms** held on a fast load, **2500ms** with no added delay on a slow one, **0 frames** on the new-requisition form, which fetches nothing.
- **Printable View settles before printing.** `printExpanded` expands the accordions, then polls until nothing inside `.record-page` matches `[aria-busy="true"], .skeleton, .spinner`, with a 200ms floor and a 6000ms cap. Measured at the moment `window.print` fires: `{"busy":0,"skeletons":0,"loadingText":false,"openSections":14,"sections":14}`. Ctrl+P still prints whatever is loaded, because a browser-initiated print cannot be delayed.
- **Requisition Aging rows open the requisition they name** rather than filtering the list. The contract in `app/src/modules/dashboards/README.md` was corrected accordingly.
- **Every empty accordion body renders an `EmptyState`**, and `Table` builds one from `emptyText`. Verified: 6 on the requisition record, all 32px icons, all centred, no bare empty text left.
- **Statuses, record types and company-type chips go through `sentenceCase`**, because the database stores `open`, `on_hold`, `candidate`.
- **Imported descriptions keep their structure.** `sanitizeHtml` now allows `H1`–`H6` and the table set. Evidence for that: of 687 rows in `migration/zoho-exports/bulk/ZohoRecruit_Job_Openings_p1/837085000005021001.csv`, 11 carry HTML, and those use `h2`×22, `h3`×10, `h1`×5, `h5`×3 and `table`/`thead`/`tbody`/`tr`/`td`×50, all of which were being stripped. `script`, `style`, `iframe` and `svg` subtrees are now dropped whole rather than unwrapped, which was leaking their text into the page.
- **Per-staff section preferences** live in `integration_settings` under `ui.sections.<scope>` as `{ hidden, open }`. Verified across a reload: a section told to open on load came back `aria-expanded="true"`.

### 1.3 Removed at Klent's instruction

The two "Switch to…" dashboard links, the `Back To List` buttons on the candidate, contact, deal and company records (breadcrumbs replaced them), and the chevron pair in the column dialog.

## 2. Defects found and fixed

### 2.1 In the product

| # | Defect | Evidence |
| :---- | :---- | :---- |
| 1 | The scroll fade never showed at the top and never cleared at the bottom | Flags frozen at mount values: `scrollTop: 98` with `flags: "false/true"` |
| 2 | The fade began 8px inside the border on any padded scroller | Pixel scan: content visible in the first rows inside the border |
| 3 | Every shaded dropdown lost its positioning and fell into the document flow | `.fo-scroll-shade { position: relative }` overrode `position: fixed` and `absolute` |
| 4 | A horizontal scrollbar on every capped menu | `overflow-y: auto` makes `overflow-x: visible` compute to `auto` |
| 5 | The Save-view checkbox rendered 273×32 instead of 16×16 | `.fo-search-row input` rules reached into a dialog rendered inside the toolbar |
| 6 | `<script>` text leaked into rendered descriptions | Disallowed elements were unwrapped, not dropped |
| 7 | The editor toolbar was never joined to its field | `.field`'s 8px gap held them apart despite joined corners |
| 8 | Requisition Aging drilled into a filtered list, not the record | `navigate('/recruit/requisitions?company_id=…&status=…')` |
| 9 | Breadcrumb links sat on the page band at **4.43:1** | See section 3 |

### 2.2 Root causes worth carrying (now in `CLAUDE.md`)

- **A callback-ref hook must tear down in the ref, not a cleanup-only effect.** `main.tsx` wraps the app in `StrictMode`, so React runs each effect, its cleanup, then the effect again. `useScrollShadow` kept `useEffect(() => () => detach(), [])`, so the second pass removed its scroll listener and nothing put it back, because a callback ref is not re-invoked when the DOM node has not changed. Scrollers that remount when their data lands hid the bug; a dialog list that mounts once exposed it. Defect 1.
- **A `position: sticky` child is clamped to its containing block**, which for a flex item is the content box. So a sticky overlay cannot reach into the scroller's own padding, and no negative margin moves it there. A scroller wanting an edge-to-edge fade must carry no vertical padding, with the spacing moved onto its rows. Defect 2.
- **Within one layer, a later single-class rule beats an earlier one.** A utility class must not set `position` unless every element that will carry it wants that position. Defect 3.
- **`overflow-y: auto` makes `overflow-x: visible` compute to `auto`.** Defect 4.

## 3. The CI failure, and why the local run passed

CI run `34437359599`: `frontend` and `schema` green, `integration` failed at `Browser flow tests` with **254 passed, 2 failed** in 17.6 minutes. It tested `3a402a9`, confirmed by `headSha`.

```
1) e2e/accessibility.spec.ts:64:3 › no serious or critical violation on any signed-in screen route
    Error: serious or critical accessibility violations:
    global search: color-contrast (serious, 1 node(s)) e.g. li:nth-child(1) > a[href="/"][data-discover="true"]
```

The same spec passed locally: **5 passed (34.2s)**.

Measured rather than assumed. `--fo-link` is `#1b6fc9` and `--fo-canvas` is `#f0f0f0`, a **4.43:1** pair against the 4.5:1 that WCAG AA requires for 14px normal-weight text:

```
/recruit/requisitions :: {"fg":"rgb(27, 111, 201)","bg":"rgb(255, 255, 255)","ratio":5.04}
/search?q=a           :: {"fg":"rgb(27, 111, 201)","bg":"rgb(240, 240, 240)","ratio":4.43}
/employees            :: {"fg":"rgb(27, 111, 201)","bg":"rgb(240, 240, 240)","ratio":4.43}
/pipeline             :: {"fg":"rgb(27, 111, 201)","bg":"rgb(240, 240, 240)","ratio":4.43}
```

`ListPage` and `RecordPage` put the trail inside `.fo-page-head`, which is opaque, so those pages were never affected. Four pages took `<Breadcrumbs>` as a bare child of `.list-page` or `.record-page`: `GlobalSearchPage`, `ModulePlaceholderPage`, and both `DashboardPage` tabs. They now wrap their header in `.fo-page-head`.

**Why local passed:** axe's `color-contrast` rule reports *incomplete* rather than *violation* when it cannot fully resolve a node's background, and that resolution depends on rendering. The ratio was 4.43 on both machines; only the classification differed. The local pass was luck, and reporting it as evidence was the error.

**Guard.** `tests/e2e/breadcrumbs.spec.ts` B1 now walks up from the trail's first link on all ten routes and fails if it does not land on `rgb(255, 255, 255)`. `scripts/check-contrast.mjs` was deliberately **not** extended: it already declares `--fo-link` on `--fo-surface` and `--fo-link-on-tint` on `--fo-canvas`, so the design system had already decided that a link on the band uses the darker token. It has no pair for `--fo-link` on `--fo-canvas` because that pair is not meant to exist, and adding one would encode the mistake.

Second CI failure, same run: `scroll-shadow` S1 asserted the company listbox overflows, which holds here (196 imported companies) and not on a fresh seed. Retargeted to the column settings list, whose 12 rows come from `COLUMN_DEFS`.

Fix committed as `688890d`. **CI run `34440229385`: success in 19m39s.**

## 4. Suite cost, measured

`npx playwright test --reporter=json`, local stack, 2 workers:

| Quantity | Value |
| :---- | :---- |
| Results | 263, 0 failures |
| Test time | **857s across 73 files** |
| Wall clock | **510s (8.5m)** |
| One sign-in through the login form | **256ms** |
| 191 sign-ins | **~49s, 5.7% of test time** |

Slowest files: `server-side-list` 67s, `realtime-channels` 51s, `accessibility` 33s, `settings-gears` 33s, `form-affordances` 28s. Nine of the ten slowest individual tests are whole-app route sweeps; the slowest is `realtime-channels` "every route settles on at most three channels" at 41s.

**`storageState` is therefore not the lever**, contrary to the recommendation made on 2026-09-08 from the sign-in *count* without timing one. Recorded as decision 0008 in the second brain.

**Parallelism is the lever.** At `FOOS_PW_WORKERS=4` the suite ran in **4.5m against 8.5m**, 262 passed, 1 failed. The Realtime rate limit that the 2-worker cap exists for fired 25 times (`docker logs supabase_realtime_* | grep -c MessagePerSecondRateLimitReached` → 25) and failed nothing.

The single failure was not the rate limit. `record-ui.spec.ts` asserted the Recently Viewed rail read exactly `["Candidate", "Company"]` and got `["Candidate", "Candidate"]`, because the rail is stored per staff in `integration_settings` under `ui.recentlyViewed` and four workers all signed in as `admin` write to that one row. The product is correct; the assertion was not expressible under concurrency. It now asserts that its own two records appear and that the later sits above the earlier.

Three consecutive 4-worker passes then ran clean: **263 passed at 4.4m, 4.5m and 4.6m**. So the cap is soft, and 4 workers is safe once the rail test no longer asserts shared state.

**That win does not transfer to CI, and raising the worker count there was therefore not done.** This machine has 10 cores; `ubuntu-latest` on a private repository is a 2-vCPU runner. Four Chromium workers plus the Supabase containers on 2 vCPU would contend rather than parallelise. The runner is already about twice as slow per test at the same worker count (17.6m against 8.5m), which says it has no headroom to give.

The levers that would actually move CI, both of which are Klent's to choose because one costs money and the other changes shipped behaviour:

| Option | Effect | Cost |
| :---- | :---- | :---- |
| Shard the browser job three ways, 2 workers each | Roughly 10m wall clock: about 4m of per-shard setup in parallel plus about 6m of tests | Three runners instead of one, so more billable minutes |
| Put the 1000ms skeleton floor behind an env flag the suite sets | Removes a cost paid on every navigation to a requisition list, record or edit page, across about ten whole-app route sweeps | The suite stops exercising the floor that ships |
| Larger runners | Would let the worker count rise | Paid tier |

Locally, `FOOS_PW_WORKERS=4` is a free halving and needs no config change.

## 5. Corrections to existing documentation

| Document | Was | Is |
| :---- | :---- | :---- |
| `CLAUDE.md` | `useRecentlyViewed` keeps its list and item limit in `localStorage` | It reads and writes `integration_settings` under `ui.recentlyViewed`, with no `localStorage` path, so the rail follows a person between browsers and a Playwright context inherits whatever that staff row holds |
| `app/README-APP.md` | Component inventory listed `TaleoPager` | That component no longer exists; the entry is now `Pager`, and the nine components from this pass were added |
| `app/src/modules/dashboards/README.md` | Requisition Aging rows drill to `/recruit/requisitions?company_id=X&status=Y` | They open `/recruit/requisitions/<requisition_id>` |
| `app/src/modules/recruit/README.md` | Saved views store filters, visible columns and sort | The `columns` array is ordered, and the debounce and section-preference behaviour are documented |

## 6. Verification

| Check | Result |
| :---- | :---- |
| `check-comments.mjs` | No comments in source, 403 files |
| `check-css-layers.mjs` | 21 stylesheets, every rule in one of the 19 declared layers |
| `check-contrast.mjs` | All 37 pairs meet WCAG AA |
| `check-motion.mjs` | Motion budget respected |
| `check-icons.mjs` | 111 icon sizes on the 20, 24, 32, 64 scale |
| `check-control-heights.mjs` | 1 token and 10 declarations at or under 32px |
| `check-unbounded-queries.mjs` | 53 files, no unbounded reads |
| `check-paged-order.mjs` | Every paged read orders by a unique tie-break |
| `check-licences.mjs` | Every runtime dependency permissively licensed |
| `check-migrations.mjs` | No drift |
| ESLint, both typechecks, knip, build | Clean |
| Playwright, local, 2 workers | **262 passed (8.5m)**, then 263 passed after the CI fix |
| CI `34440229385` | **success, 19m39s** |

## 7. Open items

| Item | Owner | Next action |
| :---- | :---- | :---- |
| Raise the CI worker count to 4 | Klent | Confirm the three 4-worker passes are clean, then set `FOOS_PW_WORKERS` in `.github/workflows/ci.yml` |
| Or shard the CI browser job three ways | Klent | Costs three runners for roughly 10m wall clock |
| The 1s skeleton floor's share of suite time | Klent | Could sit behind an env flag the suite sets; keeps the product behaviour, removes the cost. Not done unprompted, because it makes the suite stop testing what ships |
| F23: `fn_fire_due_reminders` has PUBLIC EXECUTE | Open | Security definer, so any signed-in user can fire another person's reminders. Needs a caller guard, not a revoke |
| Favicon variant | Klent | Previews in `~/Desktop/foos-favicon-previews/`; recommendation `plate-r16-plain` |
| `attachments.file_size_bytes` null on all imported rows | Open | Backfill needs a stat call per object across 1,747 files |
| Two `.fo-gear-btn` call sites still hand-rolled | Open | `CandidateListPage`, `QueueListPage`; switching them changes the icon on pages not yet reviewed |
