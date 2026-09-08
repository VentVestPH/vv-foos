# ACTIVE GOAL: Goal 10 — Every settings gear works, and no gear opens a placeholder

**Klent, 2026-09-08, verbatim:** "make all the settings gear icon work. do not make excuses and defer it. there's no p[oint of defering it."

**Deferral is not an available verdict in this goal.** Goal 2 rated 43 controls `Defer` and this is Klent rejecting that outcome for the gears. Every gear either does a real job or it is removed, and removal needs its reason stated in one sentence.

## The six gears, found by grep rather than memory

| # | Where | Current behaviour | Verdict |
| :---- | :---- | :---- | :---- |
| 1 | `shell/UtilityHeader.tsx:69` "Settings" | `window.location.href = '/settings'` | **Real, but wrong mechanism.** A full page reload in a SPA: it discards the React tree, refetches the session and the staff row, and flashes. Also wrongly marked `is-placeholder`. Fix to `navigate('/settings')` and drop the false class |
| 2 | `modules/recruit/candidates/CandidateListPage.tsx:667` "Configure candidate list columns" | `show('Configure columns', 'Column visibility is already available in the Advanced Search panel on this page.')` | **A signpost to a feature that exists**, which is a gear telling the user to go and find something. It must **open the filter rail and move focus to the column list** |
| 3 | `modules/intake/QueueListPage.tsx:135` "Configure columns" | the same signpost text | Same fix as #2 |
| 4 | `pages/DashboardPage.tsx:67` "Dashboard settings" | `show('Dashboard settings')` | **Dead.** Must open a real panel controlling which dashboard sections are visible, persisted per staff |
| 5 | `pages/DashboardPage.tsx:203` "Configure report categories" | `show('Configure report categories')` | **Dead**, and it sits beside report tabs that are themselves placeholders. See the decision below |
| 6 | `pages/ModulePlaceholderPage.tsx:133` "Configure this list" | `show('Configure this list')` | **Dead**, on the four Taleo module placeholders (`/employees`, `/onboard`, `/users`, `/courses`) which hold no real data. See the decision below |

## What "work" means, per gear

**#1, the header gear.** Import `useNavigate`, call `navigate('/settings')`, remove `is-placeholder`. One line, and it removes a full reload from the most-used control in the shell.

**#2 and #3, the two column gears.** Both lists already have a working column picker in the filter rail; `CandidateFilterRail.tsx:107-125` is the live one. The gear must call the same thing `openFilterRail()` does in the test helpers, then move focus to the first column checkbox, so the gear **does** the job instead of describing it. Reuse, do not rebuild.

**#4, dashboard settings.** Build it. The dashboard renders named sections (`My Calendar`, `My Reminders`, `My Tasks`, and the role-gated panels). The gear opens the shared `Dialog` from `components/ui/`, listing those sections with a checkbox each, and the choice persists per staff. **Persistence pattern already exists**: `ats_saved_views` stores per-staff JSON with RLS keyed on `staff_id`, and `useBookmarks` and `useRecentlyViewed` both read `staff` from `useSession()`. Follow that shape. If a new table is needed it is a new migration with RLS on, deny-by-default, in the same commit as the `database.types.ts` edit.

**#5, report categories.** The gear is honest only if the thing it configures is real. Two acceptable outcomes, and **the recommendation is the first**: make the four report tabs (`Requisition`, `Compliance`, `More`) into a real category filter over the reports that exist, and the gear picks which categories show; or, if the reports genuinely do not exist yet, **remove the gear** and say so in one sentence in the commit. What is not acceptable is a gear that opens a placeholder.

**#6, the module placeholders.** These four routes render `ModulePlaceholderPage`, a Taleo-shaped screen with no FOOS data behind it. A configuration gear on a page with nothing to configure cannot be made to work, so **remove it from that component**, and record the one-sentence reason: the page has no list, so there are no columns to configure. This is a removal, not a deferral, and it is the honest answer rather than an excuse.

## Enterprise precedent, from published sources

The pattern being built is the standard one. Carbon puts **table display settings in the data-table toolbar** alongside search and filtering ([Carbon Design System](https://carbondesignsystem.com/components/data-table/usage/)), which is exactly where gears #2 and #3 sit and what they should open. Salesforce's `lightning-datatable` exposes column configuration declaratively per column ([Salesforce](https://developer.salesforce.com/docs/component-library/bundle/lightning-datatable/documentation)), which is the shape the picker's state should take. Taleo remains the fidelity standard for how it looks; these two set what it does.

## The bar

- **Every gear is exercised by a test that fails if it stops working.** For #1, that navigation happens without a reload. For #2 and #3, that the rail opens and focus lands on a column control. For #4, that the choice persists across a reload. For #5 and #6, either the new behaviour or the absence of the button.
- `usePlaceholder()` call sites drop by the number of gears fixed. Count before and after and report both.
- `bash scripts/gate.sh` **5 times**, 22 of 22 each. Chase any intermittent failure to its cause; a retry is never the answer.
- No comments in `.ts`, `.tsx`, `.css`. Rationale goes in the commit message.
- Anything touching the database is local-only. **Never write to production.**
- **No commit until Klent has reviewed.** He said: "do not commit, as i apparenlty need to make sure you're doing the right thing."

**ON FINISHING: `bash scripts/arm-goal.sh 11`, and do not commit.**

---

## What was actually built, 2026-09-08

### There are seven gears, not six

The goal's own table says the six were "found by grep rather than memory". The grep missed one: **`shell/ShellSidebar.tsx:150`, `aria-label="Configure Recently Viewed"`**, which renders a `GearIcon` in the `Recently Viewed` panel header on **every page in the product**. It is visible in all 104 tall audit images. It called `show('Recently Viewed settings')`, so it was a dead gear by the goal's own definition, and it is now gear 7.

### Verdicts as delivered

| # | Where | Now does | Deviation from the plan |
| :---- | :---- | :---- | :---- |
| 1 | `shell/UtilityHeader.tsx` Settings | `navigate('/settings')`, `is-placeholder` removed | **Also fixed the Reports icon beside it**, which had the identical `window.location.href = '/?tab=reports'` defect and the identical false `is-placeholder`. Fixing one and leaving the other would have been arbitrary |
| 2 | `CandidateListPage.tsx` | opens the filter rail and moves focus to the first column checkbox | none |
| 3 | `modules/intake/QueueListPage.tsx` | the same | Extracted to an `IntakeGearButton` component, because the gear was inline in the `actions` prop and a hook cannot be called from an inline handler |
| 4 | `pages/DashboardPage.tsx` My View | opens a real dialog listing the 7 My View sections; unchecking one removes it; the choice is read back from the database on load | **Persistence is `integration_settings`, not a new table and not `ats_saved_views`.** See below |
| 5 | `pages/DashboardPage.tsx` Reports | opens the same dialog over the 5 or 6 report sections that actually render, and hides them for real | Took the plan's **first** option. The sections are real (`Pipeline by Stage`, `Requisition Aging`, `Recruiter/Sourcer Activity`, `Time in Stage`, `Source Effectiveness`, plus `Experiment Metrics` for admin), so the gear configures those rather than the four placeholder category tabs beside it. Those tabs remain placeholders; making them real is Goal 11 work under `U58` |
| 6 | `pages/ModulePlaceholderPage.tsx` | **removed** | none. Reason, in one sentence: the four Taleo module placeholders render a table that is always empty, so there are no columns to configure |
| 7 | `shell/ShellSidebar.tsx` | opens a popover that sets how many records the list keeps (5, 10 or 15) and clears the list | new; not in the plan |

### Why `integration_settings` and not a new table

The plan pointed at `ats_saved_views` or a new migration. Neither is the cheapest correct answer, because a staff-scoped key/value store **already exists** and its own header comment defines it that way: *"Agent 6 key/value store: staff-scoped sync cursors, label config, email templates, unlink suppression list. staff_id null = global setting."*

Its RLS is already exactly what a per-staff preference needs:

```sql
create policy integration_settings_select on integration_settings for select
  using (public.get_my_role() = 'admin' or staff_id = auth.uid()
         or (staff_id is null and public.get_my_role() is not null));
create policy integration_settings_write on integration_settings for all
  using (public.get_my_role() = 'admin' or staff_id = auth.uid())
  with check (public.get_my_role() = 'admin' or staff_id = auth.uid());
```

So gear 4 and gear 5 write rows keyed `ui.sections.dashboard.myview` and `ui.sections.dashboard.reports`, and the cost is **zero migrations, zero `database.types.ts` edits, zero new RLS to review**. The one thing given up is the table's name, which says "integration" and now also holds UI state. That is a worse name than `staff_preferences` and a better trade than a 55th migration against a ledger that already will not push.

**`uq_integration_settings_staff_key` is a partial unique index** (`where staff_id is not null`), and Postgres cannot use a partial index for `ON CONFLICT` inference through PostgREST, so `useSectionPrefs` reads the row id first and then updates or inserts. An `upsert` here would have failed at runtime, not at compile time.

Gear 7's limit stays in `localStorage`, because the list it bounds is itself `localStorage` (`foos.recentlyViewed.<staffId>`). Putting the bound in the database while the data stays in the browser would make the two disagree on a second device.

### New shared code

- `app/src/hooks/useSectionPrefs.ts` — per-staff section visibility over `integration_settings`, returning `hidden`, `isHidden`, `toggle`, `showAll`, `ready`, `error`
- `app/src/components/ui/SectionSettingsDialog.tsx` — the dialog both dashboard gears open
- `app/src/components/ui/ListPage.tsx` — a `ListPageFiltersContext` and `useListPageFilters()`, so a control rendered in `actions` can open the filter rail and request focus on the column list. This is the piece the two column gears needed and the reason they could only previously describe the feature instead of opening it
- `styles/layers/taleo.css` — a `fo-dialog-*` set for shell-level dialogs, since the only existing overlay classes belonged to `recruit`, `sales`, `intake` and the placeholder itself
- `styles/layers/shell.css` — `fo-recent-settings-*` for gear 7's popover

### Counts, before and after

- `show('…')` single-line placeholder call sites: **11 to 7**
- Placeholder invocations from a gear: **7 to 0**. No gear in the product opens the placeholder any more
- Gears rendering a `GearIcon` as an action: **7 to 6**, one removed
- Files importing the placeholder: **18 to 17** as counted by `grep -rl 'usePlaceholder\|PlaceholderAction'`

### Proof

`tests/e2e/settings-gears.spec.ts`, 9 tests, **9 passed (8.3s)**:

1. the header Settings gear navigates without a document load, proven by a `window.__spaMarker` that survives the click
2. the same for the Reports gear
3. and 4. each column gear opens the rail and leaves focus on the first column checkbox
5. the dashboard gear hides `My Reminders`, the section disappears, and it is **still hidden after `page.reload()`**, then `Show all` restores it and that also survives a reload
6. the same for a report section
7. gear 7 sets the limit to 5, `aria-pressed` follows, `Clear list` empties the list and the empty state returns
8. none of the four module placeholders offers `Configure this list`
9. no gear on five routes opens `.fo-placeholder-modal`

**The tests were proven non-vacuous.** With `first?.focus()` replaced by `void first` in `ListPage.tsx` and the insert path short-circuited in `useSectionPrefs.ts`, exactly the four behavioural tests failed and the five structural ones still passed. Both edits were reverted and the suite is green again.

Database state was checked directly rather than inferred:

```
ui.sections.dashboard.myview|{"hidden": []}|t
ui.sections.dashboard.reports|{"hidden": []}|t
```

`t` is `staff_id is not null`, so the rows are staff-scoped and not global. The spec's `afterAll` deletes both, and `select count(*) ... where key like 'ui.sections.%'` returns **0** after the run, so the suite leaves nothing behind.

### One defect I introduced and caught

Adding `.fo-dialog-overlay` to `motion.css` with a plain string replace on `.rq-overlay` also hit the **closing** block, turning `.rq-overlay[data-closing='true']` into an unguarded `.rq-overlay`. Every recruit dialog would have animated itself out on open. Caught by reading the file after the edit rather than by a test, and fixed in the same turn; `check-motion` and `check-css-layers` both pass.

### Gate, five clean passes at 22 of 22

`bash scripts/gate.sh 5` then one more single pass, because pass 1 of the five failed on `attachments` for a reason that was not the code:

| Pass | Result |
| :---- | :---- |
| 1 | **21 ok, 1 FAIL** `attachments 2 client_errors row(s) present`. Both rows read `Should have a queue. This is likely a bug in React. Please file an issue.` on route `/`, timestamped **02:57:59+00**, which is six minutes **before** the run started. React HMR residue from editing `pages/DashboardPage.tsx` with a browser tab open on `/`. Read, then cleared |
| 2 | 22 of 22, `browser 190 passed (2.9m)`, `attachments  No … leaked error rows` |
| 3 | 22 of 22, `browser 190 passed (3.0m)` |
| 4 | 22 of 22, `browser 190 passed (3.1m)` |
| 5 | 22 of 22, `browser 190 passed (3.0m)` |
| 6 | 22 of 22, `browser 190 passed (3.2m)`, run separately to reach five clean passes rather than counting four |

`browser` was **181** before this goal and is **190** after, which is the nine new gear tests. The four clean passes after the rows were cleared are what proves the pass-1 diagnosis; the lesson is recorded in `_always.md`, because a live tab on a hot-reloaded route is enough to fail a gate it had nothing to do with.
