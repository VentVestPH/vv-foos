# FOOS App Shell

Shared frontend chassis for the VentVest Front Office OS. Vite + React 18 + TypeScript, react-router v6, Supabase JS. Agents 2 (ATS) and 3 (CRM) mount their routes into this shell; the auth, design system, and shared components below are already wired.

## Run it

```sh
cd foos/app
npm install
cp .env.example .env   # fill in both keys from Supabase Project Settings > API
npm run dev            # http://localhost:5173
npm run build          # tsc --noEmit + vite build
npm run typecheck      # types only
```

Note: `foos/package.json` declares `app` as an npm workspace, so `npm install` hoists dependencies to `foos/node_modules`. Run npm scripts from `foos/app`.

## Environment variables

| Variable | What it is |
|---|---|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key. Safe in the client — RLS is the boundary |

The client (`src/lib/supabase.ts`) throws at boot if either is missing.

## Where modules mount

`src/App.tsx` holds the route map. Replace the stub element on your mount with your own `<Routes>` tree:

- `/recruit/*` — Agent 2 (ATS): requisitions, candidates, intake. Guarded to admin/recruiter/sourcer.
- `/sales/*` — Agent 3 (CRM): companies, contacts, deals. Guarded to admin/recruiter/bd.
- `/` — dashboard placeholder, Agent 7 replaces it.
- `/settings` — stub for a later phase.

Everything under `/` renders inside `AppShell` (left nav + top bar), behind `RequireAuth`. Nav items live in `src/shell/navConfig.ts`; add entries there when your list pages exist — visibility is filtered by role per architecture section 5. Role checks in the UI are a courtesy; RLS in Postgres is the actual boundary.

## Auth and session

- `SessionProvider` (`src/auth/SessionProvider.tsx`) tracks the Supabase session and loads the signed-in user's `staff` row (`staff.id = auth.users.id`).
- `useSession()` returns `{ session, staff, role, loading, signOut }`; `useRole()` returns just the role.
- `RequireAuth` redirects signed-out users to `/login` (returning them after login), shows a hold screen when no active staff row exists, and accepts a `roles` prop to limit a subtree.
- `/login` offers Google OAuth (ventvest.com hosted-domain hint; Supabase enforces the restriction server-side) and email/password fallback.

## Database types

`src/lib/database.types.ts` is hand-derived from `foos/supabase/migrations/` — all 24 tables with Row/Insert/Update, all 12 enums, the locked stage-order arrays, and the jsonb shapes for `people.emails/phones/education`. The Supabase client is typed with it, so `supabase.from('deals')` autocompletes columns. If a migration changes, this file changes in the same commit. Convenience aliases: `Tables<'deals'>`, `TablesInsert<'deals'>`, `TablesUpdate<'deals'>`.

Never generate `display_code` client-side; the database sequence owns it (leave it out of inserts).

## Design system

`src/styles/tokens.css` carries the architecture section 7 variables verbatim (`--primary`, `--primary-deep`, `--slate`, `--surface`, `--canvas`, `--section-tint`, `--success`, `--warning`, `--danger`, `--text`, `--text-secondary`, `--border`, plus radius/shadow/type/spacing). `src/styles/app.css` is the single stylesheet — no CSS framework. Use the variables; never hard-code colors. Inter with Roboto fallback, 8px grid, 12px cell padding, max shadow `0 1px 2px rgba(0,0,0,.05)`.

## Component inventory (`src/components/ui/`)

| Component | One-line usage |
|---|---|
| `Button` | `<Button variant="primary" size="sm" onClick={…}>Save</Button>` — variants primary/secondary/danger/ghost |
| `Input` | `<Input label="Email" error={msg} required …nativeProps />` — label + error wrapper around a native input |
| `Select` | `<Select label="Status" options={[{value,label}]} placeholder="All" />` |
| `Badge` / `StatusBadge` | `<StatusBadge status={deal.stage} />` — `statusTone()` maps locked stage values to token colors (won/hired → success, on_hold → warning, rejected/lost → danger) |
| `UnviewedBadge` | `<UnviewedBadge count={n} />` — red "n Unviewed" pill; zero renders nothing |
| `Table` / `CappedCell` | `<Table columns={cols} rows={rows} rowKey={r => r.id} selectable zebra onRowClick={…} />` — sortable headers, checkbox column, two-line text cap with expand-on-click (`capped: true` on a column) |
| `InfoGroup` | `<InfoGroup label="Contact" hint="…">{grid}</InfoGroup>` — a labelled, ruled group inside a record section. Use it whenever a section holds more than about a dozen label/value pairs; a flat `.info-grid` stops being readable well before that |
| `SearchBox` | `<SearchBox value onValueChange fetchHints={globalSearchHints} onClear={…} />` — a `SearchField` plus a suggestion pop on a 300ms debounce past three characters. `fetchHints` comes from `lib/searchHints.ts` (`globalSearchHints` for everything, `requisitionSearchHints` / `candidateSearchHints` for one list); omit it and the box simply does not suggest. `onClear` adds the X, which also cancels a pending suggestion fetch. **It navigates to `/search` when `onSubmitTerm` is absent**, so any caller that must stay put has to pass one |
| `ListPage` | `<ListPage title search onSearchChange filterRail={…} savedViewsSlot={…} exportRows={visible}>{table}</ListPage>` — live search, filter rail, saved-views slot, CSV export of visible rows. `flush` joins `.fo-page-toolbar` to `.fo-page-head` instead of leaving it as its own box; `bulkBar` with `bulkBarOpen` grows an action bar into the sticky head when a row is selected; `searchHints` takes a fetcher from `lib/searchHints.ts` and turns the toolbar box into a suggesting one, scoped to that list. Take the search state from `useQuickSearchTerm()` so `?search=` from the sidebar arrives. Never skeleton the search row |
| `RecordPage` / `RecordSection` | `<RecordPage code="REQ-0001" title actionBar={…}><RecordSection title="Details">…</RecordSection></RecordPage>` — title row, sticky single action bar, collapsible sections |
| `KanbanBoard` | `<KanbanBoard stages={DEAL_STAGES.map(…)} cards={cards} onMove={(id, stage) => write(id, stage)} />` — generic columns-from-stage-list board on @dnd-kit/core; do any blocking dialog (rejection/lost reason) inside `onMove` before the write |
| `Timeline` | `<Timeline items={activities} />` — feed grouped by day, newest first, one icon per activity kind |
| `SidePanelTabs` | `<SidePanelTabs tabs={[{key,label,count,content}]} />` — frame for the nine-panel person toolkit (Notes, Calls, Meetings, Events, Emails, Tasks, Reminders, Files, Resumes); `PERSON_TOOLKIT_TABS` lists the keys in Gate 1 order |
| `StarGrade` | `<StarGrade value={grade} size={18} onChange={setGrade} />`. 1 to 3 stars, read-only without `onChange`, `role="radiogroup"` with it. One component for recruit and intake; colour comes from `.star` and `.star.on`, never from a prop |
| `StatusHistory` | `<StatusHistory rows={changes} />`. The structured status-change list on both record pages |
| `Pager` | `<Pager from to total page pageCount onPage={…} />`. The `1-20 of N` pager, repeated above and below every list and inside the application pipeline. All four chevrons always render and disable rather than disappear, so a one-page list is the same height as a paged one |
| `Breadcrumbs` | `<Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Requisitions', to: listHref }, { label: code }]} />`. `ListPage` and `RecordPage` take the same array as a `breadcrumbs` prop; the last entry is the current page and is never a link |
| `SegmentedToggle` | `<SegmentedToggle value={view} onChange={setView} ariaLabel="Pipeline view" options={[{ value, label, icon }]} />`. Two or three segments with a sliding thumb; pass `label: ''` plus `title` for an icon-only segment |
| `SettingsDialog` | The shell both settings dialogs sit on: `fo-dialog-*` chrome, a hint paragraph, a footer render prop. Reach for it before hand-rolling another `Dialog` wall |
| `SectionSettingsDialog` | `<SectionSettingsDialog sections={titles} prefs={useSectionPrefs(scope)} defaultOpenFor={fn} />`. Per-staff accordion visibility plus a second column choosing which sections open on page load |
| `ColumnSettingsDialog` | `<ColumnSettingsDialog columns order hidden onOrderChange onToggle onReset />`. Drag to reorder (pointer and touch, via @dnd-kit/core), tick to show; the grip also takes Arrow Up/Down for the keyboard |
| `SettingsButton` | `<SettingsButton label="Section settings" onClick={…} />`. The borderless sliders icon that opens any of the settings dialogs |
| `Skeleton` | `<Skeleton rows={6} label="Loading requisitions" />`. One bar shape, full width, `--control-h` tall. The `card` variant is for dashboard KPI blocks |
| `RecordSkeleton` | `<RecordSkeleton label="Loading requisition" sections={n} panel />`. A record page's loading state: two head bars, then `n` collapsed-accordion shapes. `panel` wraps them in the white form panel the edit page uses |
| `BootScreen` | The first-load gate behind `RequireAuth`. Brand card, "Taking you to Front Office OS", indeterminate bar |
| `EmptyState` | `<EmptyState compact icon={<Icon size={32} />} title="No owner assigned" hint="…" />`. Every empty accordion body and every empty table uses it; `Table` renders one automatically from `emptyText` |

Shared helpers:

- `src/lib/csv.ts` — `downloadCsv(filename, rows, columns?)`; exports only rows already on the client, so RLS holds.
- `src/lib/format.ts`: `EMPTY_CELL`. Use it for an empty table or record cell; never write the dash literal.
- `src/lib/useBackstopRefresh.ts`: a 20s interval plus `visibilitychange` and `online`, for surfaces that must not go stale if a Realtime message is dropped.
- `src/hooks/useRecentlyViewed.ts` — `record({ type, id, label, href })` on record mount; the nav rail renders the most recent, persisted per staff in `integration_settings` under `ui.recentlyViewed`. It is **not** browser-local, so a test context inherits whatever that staff row already holds.
- `src/lib/format.ts`: `sentenceCase(value)`. The database stores enum labels lower case with underscores (`on_hold`), so every status, record type and company-type chip goes through this rather than printing the raw value.
- `src/lib/sanitizeHtml.ts`: `sanitizeHtml(html)` and `looksLikeHtml(value)`. Imported requisition descriptions carry real markup: headings, lists, links and tables are kept, `script`/`style`/`iframe`/`svg` subtrees are dropped whole rather than unwrapped, and only a scheme-checked `href` plus numeric `colspan`/`rowspan` survive.
- `src/lib/printRecord.ts`: `printExpanded(expand)`. Expands every accordion, waits for the sections it just mounted to finish loading, then prints. Never call `window.print()` behind a fixed delay.
- `src/hooks/useScrollShadow.ts` — a callback ref that keeps `data-shadow-top`/`data-shadow-bottom` on any scroller; `.fo-scroll-shade` turns those into a white fade at whichever edge has more content. The scroller must carry no vertical padding, or the fade cannot reach its border. Its teardown lives in the ref, not in an effect, because StrictMode's second effect pass would otherwise strip the listeners for good.
- `src/hooks/useSectionPrefs.ts` — `{ isHidden, toggle, showAll, opensOnLoad, toggleOpensOnLoad }` for a scope such as `recruit.requisition.record`, stored per staff in `integration_settings` under `ui.sections.<scope>`.
- `src/hooks/useMinimumVisible.ts` — holds a skeleton on screen for a second so a fast response does not flash it. A response slower than that adds no delay of its own.

Icons: `lucide-react` only, imported directly and aliased where the local name differs. There is no local SVG icon set. Size and stroke come from the single `LucideProvider size={20} strokeWidth={1.6}` in `main.tsx`; pass `size` at a call site only for a deliberate exception.

## Rules that carry over from the architecture doc

- Stage sets are locked (section 2); `database.types.ts` exports the ordered arrays. Do not reorder or extend.
- Stage/status changes are plain UPDATEs — Agent 1's triggers write the `status_change` activity, audit_log row, and outbox event. Never write those tables directly.
- Tag every demo row `is_test = true`.
- Design for the five pillars: safe, professional, trustworthy, calm, easy to navigate. Responsive to tablet; mobile read-only in v1.
