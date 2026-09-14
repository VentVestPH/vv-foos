# VVPH VV-FOOS Record: Deals Pass and CI Recovery

**Date:** 2026-09-14
**Status:** Final
**Branch:** `feat/accounts-ui-pass` (PR #3), green at `9d93b66`

## Scope

The deals list and record pass, the seed data behind it, the repairs that made the local test harness usable, and every defect found on the way. Companion record to `VVPH_VV-FOOS_Record_Candidates-Pass-And-Quick-Search_2026-09-10_v1.0_Final.md` and `VVPH_VV-FOOS_Record_Requisitions-UI-Pass_2026-09-10_v1.0_Final.md`.

## 1. What the deals pages gained

`/sales/deals` now carries the same chrome as accounts and contacts.

| Item | Detail |
| :---- | :---- |
| Search | In `fo-page-head`, suggesting from three characters via `dealSearchHints`, filtering the table only on Enter or the magnifying glass |
| Export | In the page head, honouring the visible column set |
| Saved views | `useSavedViews('deal')`; the saved state carries the view mode and the stage arrangement as well as filters, columns and sort |
| New Deal | Carries the `+` svg |
| Table view | Checkbox column leading the row; bulk Delete in the growing bulk bar |
| Column settings | Table view picks and orders the columns; **kanban view picks and orders the stage columns**, because a board has stages where a table has headers |
| View switch | The shared `SegmentedToggle`, replacing the bespoke `.sales-view-toggle` |

`/sales/deals/<id>` gained an **Edit** button on the shared `RecordEditDialog`, with every editable column present and grouped so related fields sit together: name alone; company, primary contact and owner; value with currency, probability and expected close; stage with lost reason. Contacts are listed with their company in the label, which avoids a dependent select without losing the field.

The details section became read-only label/value pairs, matching the account record, since editing now happens in the dialog.

## 2. Where related-record links belong

"Open primary contact record" sat below the last accordion. Salesforce's Lightning record page puts identity and related-record links in the **Highlights Panel** in the top region, above the record body, so they never require scrolling.

`RecordPage` gained a `headerMeta` slot rendered as a sibling after `.fo-page-header-title-row` inside `.fo-page-header-text`, where the existing rule `.fo-page-header-text > *:not(.fo-page-header-title-row) { grid-column: 1 / -1 }` already spans the full width. No new layout CSS was needed. The deal record renders its company and primary contact there.

## 3. Fixes made while testing

- **Kanban drag tilt removed.** `.kanban-card.is-dragging` dropped `transform: rotate(1.5deg)`; the primary border and overlay shadow already read as lifted.
- **The view switch measured 34px and should be 32.** The stack was 1px border plus 2px padding either side of a 28px button. `.fo-segmented` is now pinned to `--control-h` with the buttons stretching. Measured in the browser at **32px on both `/sales/deals` and the requisition pipeline**, with 26px buttons.
- **The Delete button did not decay smoothly.** Fixed by keeping it mounted with a `title` explaining why it is disabled, rather than unmounting it. See section 5.
- **`.checkbox-list` row margins removed** along with the scroll-shade offsets that compensated for them. Six components use the class.
- **`.fo-dialog-foot` was inset by `--sp-2` while `.fo-dialog-body` is inset by `--section-pad`**, so every dialog's buttons sat 8px right of the content above them. Both are `--section-pad` now. Pre-existing, not introduced by this pass.
- **The accounts filter rail** wraps its fields in the shared `FilterGroup`, as the candidate rail does, giving the two the same rhythm. Contacts, deals and intake still use bare rails, deliberately unchanged.
- **Zoho activity bodies rendered as raw HTML.** `activities.body` holds HTML from the import and both the timeline and the side panel printed the tags. `htmlToText` in `lib/format.ts` strips tags, drops `<script>`/`<style>`, maps `<br>` and block ends to line breaks and decodes entities. It stays text rather than `innerHTML` because that column holds imported third-party content.

## 4. Seed data

Two deals on the Meridian account, appended to `supabase/seed.sql`.

**DEAL-0004, "Meridian - executive search programme"** fills every editable column and all eight Activity tabs.

| Tab | Rows |
| :---- | :---- |
| Notes | 2 |
| Calls | 2 |
| Meetings | 3 |
| Events | 2 |
| Emails | 2 |
| Tasks | 3 (one done) |
| Reminders | 2 |
| Files | 3 |

**Events are meetings that carry attendees**, so Meetings and Events render identically unless the seed includes one meeting without attendees. It now has one internal meeting with none and two client meetings with them.

**DEAL-0005, "Meridian - contract-to-hire pilot"** is the lost counterpart, because `lost_reason` and a zero probability only render on a lost deal and are otherwise unreachable in the UI.

Verified on a scratch database rather than the working one: rebuilt from the migrations plus this seed, ran `validate.sql`, **35 PASS, exit 0, no failures**, then dropped the scratch database. Check 9 is a floor, so extra rows are not a regression, and the two checks that touch a specific deal are pinned to `DEAL-0001`.

## 5. One product defect, and the fix that had to be made twice

`disabled-reasons.spec.ts` U22 requires that a control a user cannot press explains why, in a `title`. `/intake` rendered a disabled bulk Delete with none. The same shape existed on accounts and contacts, which the audit's ten-route list does not walk.

The first fix unmounted the button when nothing was selected. That removed `.fo-page-head-grow` from the DOM, which is the element that interpolates `grid-template-rows` from `0fr` to `1fr`, so `accounts-list` A2 failed and the bar would have popped rather than grown. The second attempt gated only the button, which left the bar collapsing around an empty box, the un-smooth decay reported during testing.

**The settled shape:** the button is always mounted and carries a `title` naming what to do when it is disabled. `ListPage` already sets `aria-hidden` and `inert` on the closed wrapper, so the mounted button is out of the accessibility tree and unreachable by keyboard. That satisfies the audit, keeps the transition smooth, and prevents the `aria-hidden-focus` regression of `3335827` returning. Applied to accounts, contacts, deals and intake.

A consequence worth recording: a test must not assert the closed state with `getByRole`. The button is in the DOM but not in the accessibility tree, so a role query correctly returns nothing. Assert DOM presence with a CSS locator and accessibility state with `aria-hidden` separately.

## 6. Why the pull request kept going red

Thirteen distinct failures across six runs. Ten were self-inflicted.

| Cause | Count |
| :---- | :---- |
| A UI change landed without the spec that describes it | 6 |
| A **seed** change landed without the spec that describes it | 2 |
| A wrong premise in a newly written spec | 1 |
| A real product defect | 1 |
| One of my own fixes breaking another test | 1 |
| Pre-existing order-dependent fragility | 2 |

Two structural reasons this surfaced only in CI:

1. **The browser suite was never run locally**, by standing instruction, so CI was the first execution of any spec against a change. Static gates cannot see a renamed button.
2. **`scripts/ci-parity.sh` had never worked on this machine.** Homebrew's Postgres client is 16; the container runs 17.6. The one tool that reproduces CI's data shape locally was unusable, so data-shape failures kept reaching CI.

The data shapes are not close. Local holds **73,022 candidate profiles, 691 requisitions, 196 companies**. CI resets to **7, 4 and 6**. Three failures (`empty-columns`, `menu-keyboard` C1, `server-side-list` U1.10) can only occur on the small one.

With the script repaired, the PR's specs run against CI's shape gave **100 passed, 2 skipped, 0 failed in 2.1 minutes**.

## 7. Harness repairs

- **`scripts/ci-parity.sh`** resolves a Postgres client matching `show server_version` for both `snapshot` and `restore`. The restore previously ran `psql` 16 against a `pg_dump` 17 file; 17 wraps output in `\restrict`/`\unrestrict`, 16 does not know them, and with `ON_ERROR_STOP=0` it read the `COPY` data as SQL and emptied the database, reporting only `ERROR: syntax error at or near "good"`. Recovered in full from the same snapshot. `restore` now counts rows afterwards and exits non-zero if nothing landed.
- **`.github/workflows/ci.yml`** pins the Supabase CLI to `2.110.0`. `version: latest` resolves through an unauthenticated GitHub API call that was rate-limited, failing a shard before a single test ran and reporting as a plain failed check.
- **`tests/api/deal-probability.test.ts`** rejected any probability below 1 to catch 60 percent written as `0.6`. A lost deal at 0 percent is legitimate and is what `deals_probability_pct` permits. The guard now tests for values strictly between 0 and 1, and its rewritten message immediately surfaced two local demo rows at `0.6` and `0.7`. Nothing in the app writes a fraction: `DealNewPage:119` and `DealEditDialog:140` both pass `Number(probability)` through unchanged.

## 8. Suite changes

Cosmetic specs were deleted, behavioural ones kept. The line: delete what asserts appearance (spacing, colour, alignment, wrapper presence, copy wording, node counts); keep what fails when something is genuinely unusable (overflow, print, breadcrumbs, single scroller, sidebar reachability, document titles).

Deleted whole: `accordion-rhythm`, `color-family`, `icon-label-alignment`, `page-head-wrapper`, `copy-conventions`. Two tests excised from files otherwise kept.

Added `tests/e2e/deals-list.spec.ts`, 8 tests.

Counts measured with `npx playwright test --list`, not estimated:

| Point | Files | Tests |
| :---- | :---- | :---- |
| Start of the cull | 79 | 339 |
| After the first four deletions | 75 | 324 |
| After this round's deletions | 70 | 312 |
| After `deals-list.spec.ts` | 71 | 320 |

## 9. Code hygiene

- `DealsBulkDeleteDialog` and `DealDeleteDialog` were the same dialog in two files. One now, taking `targets`; the record page passes an array of one, which also removed a redundant activity-count query from that page.
- `components/ui/BulkBar.tsx` owns the bulk-bar wrapper and the "N selected." hint that four list pages were retyping. Requisitions and candidates keep their own markup: requisitions' hint says something different when every selected row is closed, and candidates delegates to `CandidateBulkActions`.
- The kanban issued **one query per stage in sequence**, six round trips before the board could paint. They now go out together.
- `.range(0, 499)` became `CONTACT_OPTION_CAP`; `ALL_STAGE_KEYS` is spread from `DEAL_STAGES` rather than mapped through an identity function.

## 10. Open

- PR #3's title still reads "Accounts and contacts: one edit dialog, and the write-once tables that turned up" and no longer describes its contents.
- `.sales-badges` changed from `gap: var(--sp-half)` to `var(--sp-2)` in commit `1ecb115`. It was in the working tree when `git add -A` ran and is attributed to that commit in error. The class is app-wide: the 16px now sits between a deal name and its TEST badge and in the account Type column. Unreviewed.
