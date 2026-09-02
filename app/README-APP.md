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
| `ListPage` | `<ListPage title search onSearchChange filterRail={…} savedViewsSlot={…} exportRows={visible}>{table}</ListPage>` — live search, filter rail, saved-views slot, CSV export of visible rows |
| `RecordPage` / `RecordSection` | `<RecordPage code="REQ-0001" title actionBar={…}><RecordSection title="Details">…</RecordSection></RecordPage>` — title row, sticky single action bar, collapsible sections |
| `KanbanBoard` | `<KanbanBoard stages={DEAL_STAGES.map(…)} cards={cards} onMove={(id, stage) => write(id, stage)} />` — generic columns-from-stage-list board on @dnd-kit/core; do any blocking dialog (rejection/lost reason) inside `onMove` before the write |
| `Timeline` | `<Timeline items={activities} />` — feed grouped by day, newest first, one icon per activity kind |
| `SidePanelTabs` | `<SidePanelTabs tabs={[{key,label,count,content}]} />` — frame for the nine-panel person toolkit (Notes, Calls, Meetings, Events, Emails, Tasks, Reminders, Files, Resumes); `PERSON_TOOLKIT_TABS` lists the keys in Gate 1 order |
| `StarGrade` | `<StarGrade value={grade} size={18} onChange={setGrade} />`. 1 to 3 stars, read-only without `onChange`, `role="radiogroup"` with it. One component for recruit and intake; colour comes from `.star` and `.star.on`, never from a prop |
| `StatusHistory` | `<StatusHistory rows={changes} />`. The structured status-change list on both record pages |
| `TaleoPager` | `<TaleoPager page total pageSize onPage={…} />`. The `1-20 of N` pager, repeated above and below every list |

Shared helpers:

- `src/lib/csv.ts` — `downloadCsv(filename, rows, columns?)`; exports only rows already on the client, so RLS holds.
- `src/lib/format.ts`: `EMPTY_CELL`. Use it for an empty table or record cell; never write the dash literal.
- `src/lib/useBackstopRefresh.ts`: a 20s interval plus `visibilitychange` and `online`, for surfaces that must not go stale if a Realtime message is dropped.
- `src/hooks/useRecentlyViewed.ts` — `record({ type, id, label, href })` on record mount; the nav rail renders the last 15, persisted in localStorage keyed by staff id.

Icons: `lucide-react` only, imported directly and aliased where the local name differs. There is no local SVG icon set. Size and stroke come from the single `LucideProvider size={20} strokeWidth={1.6}` in `main.tsx`; pass `size` at a call site only for a deliberate exception.

## Rules that carry over from the architecture doc

- Stage sets are locked (section 2); `database.types.ts` exports the ordered arrays. Do not reorder or extend.
- Stage/status changes are plain UPDATEs — Agent 1's triggers write the `status_change` activity, audit_log row, and outbox event. Never write those tables directly.
- Tag every demo row `is_test = true`.
- Design for the five pillars: safe, professional, trustworthy, calm, easy to navigate. Responsive to tablet; mobile read-only in v1.
