# Icon Strategy and Kappa Repository Comparison

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft · **Compared against:** `/Users/klentz/Work/Kappa-Omini-typescript`

Answers the direct question, then assesses whether FOOS should adopt the same approach. All findings are measured from the installed packages and source, not inferred.

## 1. Direct answer: yes, it is Lucide

`Kappa-Omini-typescript` uses **`lucide-react`**, and the package identity was verified from the installed `node_modules` rather than the manifest alone:

| Property | Value |
| :---- | :---- |
| Package | `lucide-react` |
| Version declared | `^1.25.0` in `apps/web/package.json` |
| Version installed | `1.25.0` |
| Licence | ISC |
| Homepage | `https://lucide.dev` |
| Repository | `https://github.com/lucide-icons/lucide.git` |
| Total exports in the installed build | 5,984 |

Usage scale in Kappa: **801 import sites** across `.ts` and `.tsx`, drawing on **147 distinct icons**. It is declared in `apps/web` of a monorepo (`apps/`, `packages/`, `supabase/`, `e2e/`, `deploy/`, `scripts/`), not at the root, which is why the root `package.json` shows only two dependencies.

Most-used icons, which is a fair signal of what the visual language actually leans on:

| Icon | Sites | Icon | Sites |
| :---- | :---- | :---- | :---- |
| `Loader2` | 290 | `Pencil` | 82 |
| `Plus` | 219 | `Download` | 81 |
| `Check` | 173 | `FileText` | 77 |
| `Trash2` | 162 | `Users` | 73 |
| `X` | 150 | `ChevronDown` | 70 |
| `Package` | 100 | `MoreVertical` | 62 |
| `AlertTriangle` | 99 | `ChevronRight` | 58 |
| `Search` | 84 | `ArrowRight` | 46 |

## 2. What actually produces the look you liked

Two things, and only one of them is the library.

**The library.** Lucide is the community fork of Feather Icons: stroke-only line art on a 24x24 grid, geometrically consistent, no fills, no two-tone. That is the same family as Taleo's own iconography, which the reverse-engineering report describes as "thin-line outline glyphs in the slate/blue palette".

**The usage conventions.** Kappa sizes icons from CSS custom properties rather than ad-hoc numbers, using Tailwind arbitrary values such as `w-[var(--icon-xs)] h-[var(--icon-xs)]` and `w-[var(--icon-sm)]`, alongside direct utilities (`w-4 h-4`, `w-3 h-3`, `w-3.5 h-3.5`). Stroke weight is tuned per context rather than left at the default: 16 sites at `strokeWidth={2.5}`, 15 at `1.5`, 12 at `2`, 9 at `3`, 6 at `2.2`, 5 at `1.75`, and a scatter of `2.4`, `2.6`, `2.25`, `4`.

The transferable idea is the **icon-size token set**. The Tailwind class syntax does not transfer, because FOOS deliberately runs no CSS framework ("no CSS framework" per `README-APP.md`, with `app.css` as the single stylesheet).

## 3. What FOOS uses today

Two icon systems coexist, one good and one in breach of the redesign prompt.

**`app/src/shell/icons.tsx` is well built.** 21 hand-rolled icons in 223 lines: stroke-only, `currentColor`, 24x24 viewBox, `fill: none`, `strokeWidth: 1.6`, round caps and joins. It was written precisely against the prompt's instruction ("if no icon library exists, implement a small local SVG set") and matches the Taleo line-art style. Coverage: Home, Pipeline, Briefcase, Person, Handshake, ContactCard, IdBadge, Lock, PieChart, BarChart, Book, Bookmark, Megaphone, Gear, Search, Flag, Inbox, Ticket, Resume, ChecklistPerson, ChevronLeft.

**`app/src/components/ui/Timeline.tsx` breaks the rule.** Activity-kind icons are a map of text glyphs:

```ts
const KIND_ICONS: Record<ActivityKind, string> = {
  email: '✉',  call: '☎',  meeting: '📅',
  inmail: 'in', note: '✎',  status_change: '⇄', system: '⚙',
};
```

The redesign prompt section 6 is explicit: "Do not use letter avatars such as `R`, `C`, `Co`, or emoji as final icons." This map contains one emoji (`📅`), four dingbats, and a literal two-letter avatar (`'in'`). Timeline renders on candidate, contact, company, deal and requisition record pages, so this is visible across the product. The redesign delivery report does not mention it, so it is a previously unreported fidelity defect. Logged as **D10**.

FOOS currently has no icon dependency at all. `app/package.json` declares `@dnd-kit/core`, `@supabase/supabase-js`, `react`, `react-dom`, `react-router-dom` and the build toolchain, and nothing else.

## 4. Does Lucide cover what FOOS needs?

Tested against the installed Kappa build: the nine Taleo navigation glyphs named in the reverse-engineering report, the six calendar view icons that fidelity gap F3 requires, the four utility-header icons, and a file-type mark. **20 of 20 roles are covered.**

| Role needed | Lucide export available |
| :---- | :---- |
| House (Home) | `House`, `Home` |
| Funnel (Pipeline) | `Funnel`, `Filter` |
| Briefcase (Requisitions) | `Briefcase` |
| Person (Candidates) | `User`, `UserRound` |
| Handshake (Accounts) | `Handshake` |
| ID card (Contacts, Employees) | `IdCard`, `ContactRound`, `Contact` |
| Padlock (Users) | `Lock`, `LockKeyhole` |
| Pie chart (Reports) | `PieChart`, `ChartPie` |
| Book or play (Courses) | `BookOpen`, `Book`, `CirclePlay` |
| Calendar day view (F3) | `Calendar`, `CalendarDays` |
| Calendar 7-day view (F3) | `CalendarRange`, `Columns3` |
| Calendar 31-day view (F3) | `CalendarDays`, `Grid3x3`, `LayoutGrid` |
| Calendar person view (F3) | `UserRound`, `User` |
| Calendar group view (F3) | `Users`, `UsersRound` |
| Calendar agenda view (F3) | `List`, `ListChecks`, `AlignJustify` |
| Bookmark (utility header) | `Bookmark` |
| Announcements (utility header) | `Megaphone`, `Bell` |
| Settings gear (utility header) | `Settings`, `Cog` |
| Reports (utility header) | `FileBarChart`, `ChartColumn`, `FileChartColumn` |
| PDF or document mark | `FileText`, `FileType` |

## 5. Recommendation

**Adopt `lucide-react` in FOOS, at `strokeWidth={1.6}`, and delete the Timeline glyph map.** Reasoning, with the trade-offs stated rather than glossed:

In favour:

- It closes D10 properly. The emoji map needs replacing regardless, and replacing it with hand-drawn SVGs means drawing seven more icons by hand.
- It unblocks F3 without hand-drawing six calendar icons.
- The style matches. Lucide is Feather-derived stroke line art, which is the same family as Taleo's glyphs and as the existing `icons.tsx`.
- Consistency with the sibling VentVest codebase, which matters if the two are ever maintained by the same person.
- ISC licence, tree-shakeable per-icon imports, so bundle cost is proportional to icons used rather than to the 5,984 available.

Against, and worth weighing:

- It adds the first UI dependency to a project that has twice chosen not to add one. The dashboards module hand-rolled CSS bar charts specifically to avoid a charting library, and the module READMEs note `package.json` sits outside module write boundaries. This is a deliberate convention, and adopting Lucide is a decision to relax it, not an oversight to correct.
- Lucide's default `strokeWidth` is 2. The existing `icons.tsx` uses 1.6. Left at the default, Lucide icons will read heavier than the current shell and heavier than Taleo. Set `strokeWidth={1.6}` globally to match, which is the same kind of per-context tuning Kappa already does.
- Lucide will not reproduce Taleo's skeuomorphic file-type marks. The reverse-engineering report notes "File-type icons are skeuomorphic PDF (red) and Word (blue) marks." Lucide's `FileText` is flat line art. Either accept the flat version or keep two bespoke SVGs for those two marks.
- 21 working icons already exist. Migration is real work for no user-visible gain on the icons that are already correct.

**Suggested scope, smallest useful version:** add the dependency, replace the Timeline glyph map with Lucide components, use Lucide for the six new F3 calendar icons, and leave the existing 21 shell icons alone. That fixes the defect, unblocks the gap, and avoids a churn-only migration. Migrate the remaining 21 later only if a second inconsistency appears.

Also worth borrowing from Kappa regardless of the library decision: the **icon-size token set**. Define `--icon-xs`, `--icon-sm`, `--icon-md` in `tokens.css` and size every icon from them, instead of passing ad-hoc `size` numbers. That is a five-line change and it is the part of Kappa's approach that produces visual consistency.

## 6. One caution on the version number

`lucide-react` is published on npm in the `0.x` range. The installed package here self-reports `1.25.0`, with correct name, ISC licence and the official `lucide-icons/lucide` repository URL. Nothing suggests a fork or an alias, but before adding the dependency to FOOS, pin an exact version resolved from the public registry rather than copying `^1.25.0` across from Kappa, and confirm what that resolves to. Copying a caret range between projects is how two codebases silently end up on different builds.
