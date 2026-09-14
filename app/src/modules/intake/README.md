# Intake module (Agent 5)

The single front door through which every new candidate and contact enters
FOOS: the review queue, its channels (LinkedIn paste, sheet import, email —
mocked pending Agent 6, careers-form read-only), dedup, grading, and the
atomic import step. Mounted at `/intake/*` — top-level, not nested under
`/recruit` or `/sales`, because it's genuinely shared: sourcers and
recruiters work candidate rows, bd works contact rows. RLS on `intake_items`
(architecture section 5) is the real boundary; the route accepts all four
roles and lets Postgres decide what each one sees.

## The queue page, after the 2026-09-11 pass

- The head is `flush`, so the search row and Export share one sticky band joined to
  the title row, as on requisitions and candidates. Before that the toolbar drew its
  own border and read as a separate card.
- The gear is `SettingsButton` opening `ColumnSettingsDialog`, so columns are
  arranged in a dialog rather than in the filter rail. The rail keeps Channel,
  Target and Status; its Columns section is gone.
- `Refresh the queue` and `Show imported / rejected` are controls on the page, not
  entries in an overflow menu. Both are 32-square `.fo-gear-btn` and a plain
  checkbox respectively.
- `intakeSearchHints` in `lib/searchHints.ts` suggests **only** `intake_items`,
  matching name, batch label and LinkedIn URL. A suggestion links to
  `/intake?item=<id>` and the queue seeds its open drawer from that param.
- `.intake-advanced-search` wraps the rail's fields so intake can change their
  spacing without reaching the other four rails.
- `Target` renders through `TARGET_LABEL`. It was the one column printing its raw
  enum while Channel and Status had label maps.
- The drawer waits behind `SectionSkeleton` while the duplicate check runs, so the
  body lands complete instead of growing a section underneath itself. `Dedup check`
  is `Possible duplicates`, and its empty case is the shared `EmptyState`.
- `.badge-tone` is a neutral outlined chip and the read-only note is a warning
  callout. Both used `--section-tint`, which also paints accordion headers, so the
  drawer was three shades of the same blue.

## Saved views, added 2026-09-14

The queue takes `useSavedViews('intake')` from `components/ui/SavedViews.tsx`, the same control the four other list pages use, so a view records the Channel, Target, Status and Show-imported choices, the visible columns and the sort. A view ticked **Share with the team** is readable by everyone: `ats_saved_views_read` allows a row through when `is_shared` is true, and `entity` is plain text with no check constraint, so `intake` and `company` needed no migration.

Wiring this exposed a defect worth knowing about, logged as QA-062. **The queue used to sort only the page you were looking at.** It handed `pager.pageRows` to an uncontrolled `Table`, and `Table` sorts whatever array it is given, so clicking `Batch` reordered twenty rows and nothing else. Controlling the sort is what a saved view needs anyway, and `Table` returns `rows` untouched when `onSortChange` is passed, so the page now sorts the whole filtered array and pages the result. If you add a column here, give it a `sortValue` or it will sort on its raw field.

## Deleting an intake item, added 2026-09-14

Until now the only way out of the queue was **reject**, which sets `status = 'rejected'` and leaves the row there for good. That is why the toolbar needs a "Show imported / rejected" checkbox at all. Delete is the missing verb for junk: a pasted URL that was a typo, a spreadsheet row that was a header.

It is safe here in a way it is not elsewhere. **Nothing in the schema references `intake_items`** (zero inbound foreign keys), so a delete cascades to nothing. Compare `requisitions`, where four tables cascade and `applications` is one of them.

**The UI does not decide who may delete what; `intake_items_delete` does.** The policy is admin anything, recruiter candidate items, sourcer their own candidate submissions, bd contact items. Mirroring that predicate in the client would be a second hand-maintained list that drifts from the first, which is the failure this codebase already has a rule about. Instead the delete runs `.delete().in('id', ids).select('id')`, and PostgREST returns only the rows that actually went. The difference between what was asked for and what came back is what the notice reports: `3 of 5 deleted. 2 left in place, because your role cannot remove them.`

Verified against the live policy rather than assumed: with one candidate item and one contact item selected, a `bd` sign-in deleted the contact and silently left the candidate; an `admin` sign-in then removed the candidate. `I18` in `tests/e2e/intake-list.spec.ts` holds that behaviour.

## Why the queue was empty

The Zoho migration never went through intake, by design. `migration/import.mjs`
wrote straight to `people`, `candidate_profiles`, `applications` and the rest,
and `zoho_id_map` proves it: 72,939 candidates, 86,155 applications, 211,040
notes, 1,747 attachments, 687 requisitions, and **no intake entity type at
all**. The table held one row. Intake is the front door for new arrivals; a bulk
migration is not an arrival. There is no Zoho intake data to recover.

`intake_items` has no `is_test` column, so seeded rows are marked by a
`DEMO-` prefix on `batch_label` and are removed with
`delete from intake_items where batch_label like 'DEMO-%'`.

## Routes

| Route | Screen |
|---|---|
| `/intake` | Queue list — filters, live badge, item detail drawer |
| `/intake/linkedin` | Paste LinkedIn URLs, batch label, grading flow (Deniece/VVPH workflow) |
| `/intake/sheet` | Google Sheet / hosted .xlsx import — fetch, map, preview, commit |

## Edge Functions (`foos/supabase/functions/`)

- **`intake-sheet-fetch`** — authenticated. Fetches a Google Sheet or hosted
  .xlsx/.csv URL, parses the header + up to 500 rows, returns columns + rows
  so the client can show a 10-row sample immediately and a full preview
  later without a second fetch.
- **`intake-sheet-commit`** — authenticated, runs as the calling staff
  user's own JWT (not service role) so the existing `intake_items` RLS
  policies decide what they're allowed to stage. Writes one row per record
  and optionally saves the column mapping as an `intake_mapping_templates`
  row.
- **`intake-email-parser`** — the agreed handoff contract with Agent 6
  (brief: "agree the interface before either side builds"). Unauthenticated
  by design (Agent 6's backend watch calls it server-to-server, not from a
  browser session) but gated by a shared secret header
  (`x-intake-secret`, set as a function secret `INTAKE_EMAIL_PARSER_SECRET`).
  **Independently testable right now** — see "Testing the email channel
  without Agent 6" below. Full request/response contract is documented in
  the function's header comment.

## Database (migration `20260725000002_intake_import.sql`)

`intake_mapping_templates` and `integration_settings` already existed from
Gate 2's approved additions (migration 08) — nothing new needed there. This
migration adds the two functions the brief's "import is transactional"
business rule requires:

- **`import_intake_item(p_intake_id, p_mode, p_merge_person_id, p_company_id, p_new_company_name)`**
  — security definer, does the whole candidate-or-contact import (person +
  profile + staged attachments + intake_items update) in one plpgsql
  function, so it either all succeeds or all rolls back. Also re-checks
  authorization internally against the same rules as the `intake_items` RLS
  policies, because a sourcer importing their own graded candidate has no
  direct INSERT grant on `candidate_profiles` — this function is the
  sanctioned path from "my graded intake item" to "a real candidate record."
  Verified live against the deployed project (reject path, contact import
  with company create+link, candidate import with the grading gate
  correctly blocking an ungraded linkedin_url item, then succeeding after
  grading) — test rows created and cleaned up, no test artifacts remain.
- **`reject_intake_item(p_intake_id, p_reason)`** — sets status `rejected`
  with a required reason; nothing is deleted.

## Testing the email channel without Agent 6

Agent 6 doesn't exist yet as a live integration. To exercise the email
channel now, POST directly to the deployed function:

```sh
curl -X POST https://mebfbbvrqdctamnzvbbs.supabase.co/functions/v1/intake-email-parser \
  -H "content-type: application/json" \
  -H "x-intake-secret: <the secret you set>" \
  -d '{
    "staffId": "a0000000-0000-4000-8000-000000000002",
    "label": "intake-test",
    "message": {
      "id": "test-message-001",
      "from": "Jordan Candidate <jordan@example.com>",
      "to": ["foos.recruiter@ventvest.com"],
      "subject": "Application for Senior Data Engineer — resume attached",
      "bodyText": "Hi, please find my resume attached for the role.",
      "date": "2026-07-25T10:00:00Z",
      "attachments": []
    }
  }'
```

This lands a `parsed` intake item with `channel=email`, inferred
`target_type` (candidate, per the "resume/application" hint), and shows up
in the queue exactly as it will once Agent 6's real Gmail watch calls the
same endpoint.

## Gate 3 demo script (run on `is_test = true` data where possible)

Note: LinkedIn/sheet/email intake writes real (non-`is_test`) `people` rows
by design — the import RPC always sets `is_test = false`, matching how a
recruiter's real workday would import a real candidate. For a demo, either
accept that the demo people are real-looking records to be cleaned up after,
or manually flag them `is_test = true` post-import before Gate 3 sign-off.

1. Go to `/intake/linkedin`. Paste five LinkedIn URLs, batch label "VVPH-3
   demo", target Candidate. Stage the batch — five items appear in the
   queue at `pending`, badge increments live.
2. Walk the grading flow: grade three as 2★, one as 3★, one as 1★, each with
   a comment. Saving each sets status `graded`.
3. Back in the queue, open one graded item whose email or LinkedIn URL
   matches an existing test person (seed one first if needed) — the dedup
   panel shows the match and defaults to "merge."
4. Merge that one; import the other four as new. Confirm all five now show
   `imported` and appear in the ATS candidate list with grades, source
   LinkedIn, and sourcer attribution intact.
5. Test the email channel per "Testing the email channel without Agent 6"
   above with an attachment (base64-encode a small PDF). Confirm the item
   appears `parsed` in the queue with the resume staged; import it and
   confirm the resume lands as an `attachments` row on the person.
6. Go to `/intake/sheet`. Fetch a public Google Sheet of eight contacts, map
   columns, save the mapping as a template, continue to preview — confirm
   one duplicate is flagged. Import all — contacts exist with companies
   matched or created.
7. Reject one item with a reason; confirm it stays queryable with "Show
   imported & rejected" toggled on.
8. Throughout: watch the nav badge move live as items are staged and
   imported.

## Known gaps

- Email channel is real code against the agreed contract but has no live
  Gmail feed yet — Agent 6 supplies that. Testable manually now (above).
- No manual-entry UI for `channel=manual` rows (brief marks this
  out-of-scope for this brief; the queue already renders such rows without
  choking on them).
- Sheet import dedup check runs one RPC call per row client-side — fine at
  the volumes in the brief (tens of rows), would need batching for very
  large sheets.
