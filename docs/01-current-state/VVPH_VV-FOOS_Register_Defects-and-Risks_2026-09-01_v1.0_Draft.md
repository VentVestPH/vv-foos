# Defect and Risk Register

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft

Consolidates every open item from the Gate 4 exit report with the findings verified on 2026-09-01. D11 to D13 were added after external research completed; D16 and D17 while implementing the fixes; D11 and D12 rest on normative W3C and Oracle sources respectively. D14 and D15 were found and fixed while executing Workstream A on 2026-09-01. D9 has been withdrawn as a false finding. Format follows the Agent 8 brief: id, source, severity, evidence, owner action. Severity scale is the QA brief's: Critical means data loss or corruption, RLS breach, auth bypass, or careers page down. High means a core workflow broken with no workaround, or wrong data a user would act on. Medium means broken with a workaround, or wrong counts. Low means cosmetic.

Migration records are referenced by field value and count only, never by candidate name, per the QA brief's rules of engagement.

## 1. Open items carried forward from Gate 4

| ID | Item | Severity | Status |
| :---- | :---- | :---- | :---- |
| QA-002 | `careers_rate_limit` has row-level security disabled | Medium as logged, **treat as Critical** | Open. The QA brief makes every RLS finding Critical by default and forbids downgrading without John's explicit sign-off. That sign-off has not been given, so the working-log downgrade does not stand. **New information 2026-09-01:** it is now also a verification blocker, not only a severity question. `validate.sql` halts at check 2 on this table, so checks 3 to 14 cannot run until it is resolved. With it enabled in a throwaway local database, all 14 checks pass |
| QA-003 | Four demo Auth identities share one password committed in plaintext at `tests/fixtures/personas.sql` | Low as logged, **re-rate to High** | Open. Rationale for re-rating in section 3 |
| QA-007 | `reminder.due` fires correctly but has no interface | Medium | Open, needs a product decision rather than a fix |
| QA-008 | None of the four success metrics is instrumented | High | Open, with a deadline attached: the Phase 6 measurement window cannot open without it |
| QA-004, QA-006 | Cosmetic findings | Low | Open |
| Gate 4 | 32 of 91 acceptance criteria are traced rather than independently re-verified | n/a | Open |
| Gate 4 | 12 of 91 acceptance criteria have no test at all | n/a | Open |
| Gate 4 | Three Playwright specs have never executed anywhere | n/a | **Now unblocked**, see section 4 |

## 2. Findings verified on 2026-09-01

### D1. Star grades lost for every migrated candidate (High)

The Zoho migration plan maps `Rating` to `candidate_profiles.star_grade`. Source data has `Rating` on 37 of 75 rows, 27 values of "3.0" and 10 of "2.0". Live, all 75 imported candidates have `star_grade` null. Split by `people.is_test`: the 7 seed rows carry grades of 3, 2 and 1; the 76 non-test rows carry exactly one grade and 75 nulls. Three candidates were checked individually against the CSV, with source Ratings of 2.0, 3.0 and 3.0; all three show null live while correctly carrying the `Amir Grade:` prefix in `grade_comment`.

Consequence: "grading history preserved" is one of the four success metrics gating cancellation of the Taleo and Zoho subscriptions, and it currently measures zero for migrated data. QA-008 means nothing was watching. The migration's own reconciliation reports zero errors because it counted rows, not fields.

### D2. `Initial Date` mis-parsed and partly dropped (Medium)

74 of 75 source rows carry `Initial Date`; 44 landed. Source values use four formats: `6/26`, `5/26`, `26-Jun`, `26-May`. Live, `6/26` became `2026-06-26`, reading a month and year as a month and day and inventing a day of month. `26-Jun` became null. The reverse-engineering report had already described this field as carrying "one or two mm/yy values".

### D3. Two applied migrations absent from source control (High)

Confirmed present live: `people.street`, `people.experience`, `candidate_profiles.expected_salary`, `candidate_profiles.current_salary`, `candidate_profiles.salary_currency`, `candidate_profiles.assessment_scores`, `attachments.file_size_bytes`, the `zoho_id_map` table, the `offer` value on `attachment_kind`, and 18 rows in `candidate_statuses` against the repository seed's 4.

Confirmed absent from `supabase/migrations/`: all of it. `20260711000002_enums.sql:22` still declares `attachment_kind as enum ('resume', 'cover', 'contract', 'other')`. A third migration named in the Agent 6 documentation, `agent6_google_status_and_disconnect_rpcs`, is missing the same way.

`app/src/lib/database.types.ts` has been updated with all seven columns and the `offer` value. So production and the TypeScript contract agree, and the migrations disagree with both. `supabase db reset` from this repository produces a schema the application's own types contradict.

### D4. Zoho source-name mismatch (Low)

Source data value is `Digital Assistant - Facebook Messenger`. The seeded row is `Digital Assistant - FB Messenger`. The field-mapping workbook carries both spellings in different tabs, which is where the error entered.

### D5. Four WCAG AA contrast failures (High). FIXED 2026-09-01

Measured on the running application. White on the primary nav band 3.69:1, white on the sidebar panel header 4.23:1, white on the candidate-count green 2.34:1, and control borders on white against the 3.0:1 required by success criterion 1.4.11. Both the architecture document and the redesign prompt require AA.

**One correction to the original finding.** I reported the failing control border as the `#d5d5d5` token at 1.47:1. Reading the actual rules per selector showed the control border was a hard-coded `#999` on `.field input/select/textarea` at **2.85:1**, a near miss rather than a gross failure, and that `.btn-secondary` already used `--taleo-primary` at 4.61:1 and never failed. The `#d5d5d5` token is used only on panels and table rules, which SC 1.4.11 does not govern. The original figure came from inferring the value from the token rather than reading the selector.

Fixed: nav `#427d98` (4.55:1), sidebar header `#577995` (4.59:1), count badge text `#222222` on the unchanged green (6.80:1), new `--taleo-control-border: #8f8f8f` (3.23:1). Re-audited: **11 token pairs, 0 failures.**

### D6. Missing Taleo affordances (Medium)

No mini month calendar and no calendar view icons, both required by redesign prompt section 8.1. Four of the 26 reference screenshots (02 through 05) exist solely to document the calendar states these would satisfy. Consequence: 47% of the home viewport is empty at 2560 x 1600.

### D7. No bottom action bar or pager on list pages (Medium)

Prompt section 7.3 and the reverse-engineering report both require the action bar and pager to repeat below the table. Measured zero on both list pages, including a candidate list rendering 83 rows.

### D8. Candidate list is unpaginated (Medium)

The requisition list renders the pager correctly. The candidate list has none and renders all 83 rows. It is now backed by real data and will grow.

### D9. WITHDRAWN, not a defect

Originally reported as `people.experience` being present on the Row type only, so inserts could not set it. **This was wrong.** Re-checked line by line on 2026-09-01: all seven Zoho columns appear in both Row and Insert (`street` and `experience` at lines 164, 165, 188, 189; the four `candidate_profiles` columns at 311 to 314 and 330 to 333; `file_size_bytes` at 693 and 704), and all 10 tables define `Update` as `Partial<Insert>`, so Update inherits them too.

The original finding came from a grep that counted two occurrences per column and read that as Row-only. Two is in fact Row plus Insert, which is complete. No action needed.

### D11. Sticky action bar risks WCAG SC 2.4.11 with no mitigation (High). FIXED 2026-09-01

WCAG 2.2 Technique F110: a sticky header or footer tall enough to completely cover the focused element fails SC 2.4.11 Focus Not Obscured (Minimum), Level AA, and the test procedure requires tabbing in both directions. `app/src/styles/app.css` contains two `position: sticky` rules and no `scroll-padding` or `scroll-margin` anywhere.

`.record-action-bar` (`position: sticky; top: 0; z-index: 10`) sits above record pages carrying up to 15 accordion sections, so tabbing upward from a lower section is F110's Example 2 exactly. `.table th` is also sticky but lower risk, since a header row is unlikely to completely cover a focused element and rows are not focusable.

Fix: `scroll-padding-top` sized to the bar. Found by external research; missed by the internal audit, which measured whether the focus ring is visible rather than whether a sticky element obscures the focused element after scrolling.

### D12. Back To List discards list state, against documented Taleo behaviour (Medium)

The Taleo Business Edition 11.4 User Guide states that Back To List "returns you to that page of the Candidates list", preserving page position. FOOS implements `navigate('/recruit/candidates')` with no state on both the candidate and requisition record pages, so filters, saved view, sort and page are lost on every return. One of the few Taleo specifics that survived external verification 3-0, making it documented behaviour rather than an inference from screenshots.

### D13. Emoji and letter avatars used as final icons (Medium). FIXED 2026-09-01, and wider than first reported

`app/src/components/ui/Timeline.tsx` maps activity kinds to text glyphs: `email: '✉'`, `call: '☎'`, `meeting: '📅'`, `inmail: 'in'`, `note: '✎'`, `status_change: '⇄'`, `system: '⚙'`. The redesign prompt section 6 forbids this outright: "Do not use letter avatars such as `R`, `C`, `Co`, or emoji as final icons." Timeline renders on candidate, contact, company, deal and requisition record pages. Not mentioned in the redesign delivery report, so previously unreported.

By contrast `app/src/shell/icons.tsx` is correct: 21 stroke-only icons, `currentColor`, 24x24 viewBox, `strokeWidth: 1.6`, round caps.

**Correction: the defect was larger than Timeline.** A broader sweep on 2026-09-01 found five more sites of the same class, all now fixed with `lucide-react` at `strokeWidth={1.6}`:

| Site | Was | Note |
| :---- | :---- | :---- |
| `components/ui/Timeline.tsx` | `✉ ☎ 📅 ✎ ⇄ ⚙` and the literal `'in'` | The originally reported case |
| `modules/intake/lib.ts` `CHANNEL_ICON` | `'in'`, `'@'`, `'#'`, `'★'`, `'…'` | An entire map of letter and symbol avatars. `'in'` for LinkedIn is the clearest instance of what the prompt names |
| `modules/recruit/components/StarGrade.tsx` | `★` | **The sibling copy in `modules/intake` was converted at redesign time and this one was missed**, so the two components rendered the same value differently |
| `modules/recruit/requisitions/ApplicationPipeline.tsx` | `★` at two sites | The shortlist / ACE flag |
| `pages/TaleoModulePlaceholderPage.tsx` | `⚙` | Also had `onClick={() => undefined}`, see D16 |
| `modules/settings/GoogleIntegrationCard.tsx` | `'✓' : '—'` at three sites | Scope status marks, now `Check` / `Minus` with `aria-label` |

Constraint discovered while doing it: **Lucide removed brand icons in v1** for trademark reasons, so there is no `Linkedin` export. The LinkedIn intake channel uses the generic `Link2`. A real LinkedIn mark would have to be a local SVG in `shell/icons.tsx`.

### D16. A dead control bypassed the centralized placeholder (Low). FIXED 2026-09-01

`pages/TaleoModulePlaceholderPage.tsx` had `onClick={() => undefined}` on its column-configuration gear. That is not a placeholder, it is a control that silently does nothing, which the redesign prompt forbids twice over: it requires unimplemented controls to announce themselves, and to do so through the one centralized modal. Now routed through `usePlaceholder().show()` with `aria-disabled`.

### D17. `useIntakeBadge` has no consumer (Low). OPEN

`modules/intake/hooks.ts` exports `useIntakeBadge`, which opens a Supabase Realtime subscription and maintains a live count of pending plus parsed intake items. Nothing renders it: the only reference anywhere is the re-export in `modules/intake/index.tsx`. So the intake nav badge described in the Agent 5 brief ("A red badge on the nav item counts pending + parsed rows, driven live by Realtime") does not exist in this frontend, while the hook that would feed it runs its query. Either wire the badge into the primary nav or delete the hook.



### D14. Migration 04 called `cron.schedule` unguarded, so the repo could not rebuild (High). FIXED 2026-09-01

Found while executing A2. `20260725000004_agent7_dash_schema.sql` called `cron.schedule(...)` at two sites with no availability check. On any host without `pg_cron`, the migration aborted partway and left the `dash` schema half-built at 18 objects, so the repository could not rebuild the schema from scratch at all. That is the exact environment the README documents for local validation, and the exact environment CI would use.

The inconsistency was internal: `20260711000001_extensions.sql` guards `pg_cron` with an availability check and a `raise notice` fallback, and `20260711000010_triggers.sql` guards its own `cron.schedule` call the same way. Migration 04 was the only one that did not.

Fixed by applying migration 10's own guard pattern to both call sites. Behaviour on Supabase is unchanged, since `pg_cron` is present there and the job is still scheduled. On plain Postgres it now emits a notice and continues.

Note for the record: this edits a migration that has already been applied to production. That is normally forbidden. It is safe here because the change is behaviour-preserving wherever `pg_cron` exists, and Supabase tracks applied migrations by version rather than re-running them. Flagged for John rather than done silently.

### D15. `validate.sql` seed-count assertions were stale (Low). FIXED 2026-09-01

Check 9 asserted 7 `sources` and 4 `candidate_statuses`, which the reconstructed migration 20260725000006 correctly changes to 12 and 18. The assertion was out of date, not the migration.

Fixed, and improved while there: instead of pinning the full 18-label list, it now asserts that the **four originally seeded labels are intact and still first in sort order**. `candidate_statuses` is admin-editable by design per architecture section 2.2, so an exact full-list assertion would fail the moment an admin adds a status, which is sanctioned behaviour. The invariant worth protecting is that seeded labels are never renamed, and that is now what is checked.

## 3. Re-rating QA-003 from Low to High

The Gate 4 report rates the shared test-persona password as a Low operational follow-up. That rating was made when the database held only seed data. It no longer holds. The live project now contains 76 non-test people with real PII, 154 activity records of candid recruiter assessments, and attachment metadata referencing identity and tax documents. One password, committed in plaintext in the repository and reused across all four role personas including admin, now reads all of it.

This is a change in circumstances, not a disagreement with the original assessment. Recommended action: rotate the four persona passwords, move the value to an environment variable that is not committed, and confirm whether the demo identities are still needed now that real data is present.

## 4. Environment blockers that are now cleared

The Gate 4 report and the redesign delivery report both list environment limitations as the reason certain verification never ran. Three are now resolved on this machine:

| Blocker as reported | Current state |
| :---- | :---- |
| "This sandbox has no outbound network access to `*.supabase.co`" | Cleared. Authenticated REST and GoTrue calls to the live project succeed |
| "Playwright's browser can't launch here (no root access to install its system dependencies)" | Cleared. Chromium 1234 installed and launching. macOS needs no root for this, unlike the Linux sandbox |
| "background dev-server processes don't survive between tool calls" | Cleared. The dev server runs and serves on 5175 |

Consequence: the four Gate 4 open items that were blocked on environment, principally running the regression checklist and the three Playwright specs, are now executable. One code change is needed first: `tests/playwright.config.ts` targets port 5173 and starts a dev server there, while this frontend pins 5175 with `strictPort`. It also should not use `networkidle` on Realtime-bearing routes.

## 5. Recommended severity-ordered work order

1. D3, missing migrations. An hour of work, and it is the item that most damages a handover.
2. D1, lost star grades. Recoverable from the CSV, and it is a stated success metric reading zero.
3. QA-002 sign-off or fix, since an unresolved RLS finding outranks everything else by the project's own rules.
4. QA-003 password rotation, given real PII is now present.
5. D5 and D11, the accessibility failures. D5 is four token-level changes; D11 is one `scroll-padding-top` rule. Both are low risk and both close a self-imposed AA requirement. External research confirms there is no large-text exemption available at 13 to 14px body type, so the contrast failures cannot be waived on type size.
6. QA-008, success-metric instrumentation, before the Phase 6 window.
7. D6 through D8, D12 and D13, the Taleo fidelity gaps. D13 should be taken with the icon decision, since replacing the emoji map is the trigger for adopting an icon library.
8. D2, D4, D9, then the remaining Low items.
