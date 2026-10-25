# Gated live-account Gmail/Calendar smoke script

Per brief instruction 4: "Keep the live-account script separate and run it
only on John's approval with a test mailbox." John approved running this
against his real account in this session (2026-07-25), same as Agent 6's
original live test — there is no separate "test mailbox," this runs against
John's real `john@ventvest.com` Google account, same as it will in
production.

**Do not run this against a real client/candidate's mailbox or without
fresh approval each time** — it creates a temporary `is_test` person sharing
an email with the connected account so the sync's match-and-write path
actually exercises against real Gmail/Calendar data, which is exactly the
gap Agent 6's own build-time test left open ("ran clean, 0 matches — no
seeded test person shares an email with the real account").

## Script

1. Confirm a Google account is connected with at least `gmail.readonly`
   scope (Settings → Google Integration card shows "Connected").
2. Create a temporary `is_test=true` `people` row whose `emails` array
   contains the connected account's own address (or any address you know
   has real Gmail/Calendar history with it).
3. `POST {SUPABASE_URL}/functions/v1/google-sync` with header
   `x-sync-secret: <the value in integration_settings.google_sync_secret>`.
   Expect `{"synced": N, "errors": []}` with `N > 0`.
4. Query `activities` for that person_id — expect rows with `kind='email'`
   and a real `gmail_message_id` on each.
5. Run step 3 again. Expect `{"synced": 0, "errors": []}` — confirms no
   duplicate activities on a second sync (criterion 6.3).
6. Delete the activities, any events_outbox rows referencing the person,
   then the person row itself. Confirm 0 remain.

## Run log — 2026-07-25

Ran against John's real `john@ventvest.com` account (already connected with
all three scopes from Agent 6's original live test).

- Step 3: `synced: 20, errors: []`. ✅ — first real proof the match-and-write
  path works; Agent 6's own test never exercised this (0 matches, no
  matching test data at the time).
- Step 4: all 20 activities had `kind='email'` and a non-null
  `gmail_message_id`. ✅ Subjects were real (John's own inbox) — not
  candidate/client PII, but redacted from this file anyway per the "no real
  data in QA artifacts" rule; only checked programmatically, not pasted here.
- **Found QA-006** (logged in DEFECT_LOG.md): several synced subject lines
  showed mojibake — e.g. an em-dash rendered as `Ã¢Â€Â”` — indicating a
  UTF-8-decoded-as-Latin-1 (or the reverse) double-encoding bug somewhere in
  `google-sync`'s subject handling. Cosmetic, not blocking (the
  `gmail_message_id` and person-matching logic are unaffected), but should
  be fixed before this ships to real users' timelines.
- Step 5 (idempotency): `synced: 0, errors: []`, and a direct count showed
  the person still had exactly 20 activities with no duplicate
  `gmail_message_id` values. ✅ Criterion 6.3 confirmed with real data,
  not just the empty-set case Agent 6's build-time test proved.
- No calendar/meeting activity synced for this person despite Agent 6
  having created a real Calendar event with an attendee earlier in the
  project — not diagnosed further this pass (time-boxed); logged as a GAP
  in RETEST_MATRIX.md (criterion 6.6) rather than assumed broken or fixed.
- Cleanup: activities, events_outbox rows, and the fixture person were all
  deleted; confirmed 0 remaining.

**Not re-run this pass** (time-boxed, and each needs its own real setup):
send-with-template merge fields (6.5's template part specifically), manual
link/unlink (6.4), revoke-reflects-red-status (6.9), move/cancel calendar
event (part of 6.6). These stay GAP in the matrix, not assumed passing.
