# Parked and blocked items

**Project:** VV-FOOS · **Date:** 2026-09-02 · v1.0 Draft

Everything here is real but deliberately not being worked on. It is parked so it can be recalled without re-deriving it, not because it is finished. Nothing in this file blocks the product work in the improvement plan.

Recall this file when the product work is done, or when the named dependency arrives.

## 1. Needs one thing from a person, then it is minutes of work

| # | Item | The one thing needed | What it unblocks |
| :---- | :---- | :---- | :---- |
| P1 | Zoho Self Client credentials | John, once, for the OTP at `api-console.zoho.com`. Client ID plus Client Secret. The refresh token issued afterwards never expires, so this is a one-time ask, not a recurring one | D2 job openings, D3 education, D4 experience, D5 attachment bytes, the contacts half of D10, the last third of E7, and the 13 notes that currently have no parent |
| P2 | The four monthly cost figures | Four numbers for Oracle Taleo, Zoho Recruit, Zoho CRM and VentVest FOOS in `dash.cost_inputs` | One dashboard cell that reads "Not measured". Nothing technical. Raised only because `RETEST_MATRIX.md` row 7.8 calls the metric an open FAIL |
| P3 | Whose contract ends 2026-11-21 | One sentence from John | Whether the priority after cutover is cancellation readiness or handover quality |

## 2. Production actions, deliberately held

Held because the instruction is that production stays untouched until it has been tested locally. Each one is written, proven against the local stack, idempotent, dry-run by default, and refuses a non-local target unless `--allow-remote` is passed.

| # | Item | Command | Effect |
| :---- | :---- | :---- | :---- |
| P4 | A3 and A4 backfill | `scripts/backfill-zoho-candidate-fields.mjs --allow-remote --apply` | Restores 37 star grades and corrects 74 initial dates on the live candidates |
| P5 | B2 password rotation | `scripts/rotate-persona-passwords.mjs --allow-remote --apply` | Fresh random password on the four demo personas, printed once, stored nowhere |
| P6 | B3 production staff row | `npm run db:add-staff` against the live project | Stops Google sign-in hitting the hold screen for a named identity |
| P7 | Agent 6 RPC drift | Needs the live database password, which is separate from the service-role key | One drifted function definition on the hosted project |

Each of P4 to P7 also needs the live `SUPABASE_SERVICE_ROLE_KEY` in the shell, never in a file in this repository.

## 3. Acceptance criteria that need a real account or a human

These are the last 12 of 82. They are not automatable in this environment and should be run as a session with the right accounts to hand, not chased individually.

| Criterion | What it needs |
| :---- | :---- |
| 1.3 | A non-ventvest.com Google account, to prove the hosted-domain restriction rejects it |
| 6.4 | Manual link and unlink of an activity |
| 6.5 | Compose from a record with a template, sending through a real Gmail, threading verified |
| 6.6 | A calendar event moved and cancelled, to prove it updates rather than duplicates |
| 6.7 | Create-meeting from a record, with a real Meet link and invite |
| 6.8 | A labelled email reaching the parser and landing as `intake_items(channel=email)` |
| 6.9 | Revoking access, to prove the red status and reconnect prompt appear |
| 6.11 | A bd session, to prove zero candidate-linked email activities are visible |
| 6.12 | The full connect, reply, meeting, status demo |
| 4.11 | One requisition published for real, or a seeded one temporarily un-flagged. All three seeds are `is_test = true`, so the public careers listing correctly shows zero roles |
| 5.4 | A hosted sheet or `.xlsx` with deliberately mismatched headers, to exercise the column-mapping half |
| 2.15, 3.10, 5.14 | The Gate 3 demo click-throughs for recruiter, BD and intake. Human by design; the script is `tests/REGRESSION_CHECKLIST.md` |

## 4. Why these are parked rather than pursued

Every item above is either an administrative action on a live system, a credential, or a manual verification. None of them changes what the product looks like or how it behaves for a user. The improvement plan's remaining value is in the Taleo replica and the interaction quality, so that is where the work goes until one of the dependencies above actually arrives.
