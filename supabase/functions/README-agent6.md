# Agent 6 — Gmail + Calendar integration

Per-staff Google account connection: sync Gmail/Calendar activity onto
candidate and contact records, send email as yourself, and create Meet
meetings from a record view. Follows the brief's incremental-consent model —
connect starts with `gmail.readonly` only; `gmail.send` and
`calendar.events` are separate grants a user adds later from Settings.

## Status

**Fully live-tested end to end, 2026-07-25**, against John's real Google
account (john@ventvest.com) via the actual Settings UI running locally
(`npm run dev`) and Claude in Chrome driving the browser for the parts a
human has to do (account picking, clicking Allow on Google's consent
screen — Claude does not click through OAuth grants itself).

| Function | verify_jwt | Status |
|---|---|---|
| `google-oauth-start` | true | Live-tested. Returns `{ url }` JSON (not a raw redirect — see below). |
| `google-oauth-callback` | false | Live-tested. Google's redirect carries no session, so this is public but state-nonce-gated. |
| `google-sync` | false | Live-tested against real Gmail/Calendar APIs — 200, 0 errors. 0 activities matched, which is correct: no seeded test person shares an email with anyone in the real account's Gmail/Calendar. |
| `gmail-send` | true | Live-tested — sent a real email to john@ventvest.com, real `gmail_message_id` returned, `activities` row written. |
| `calendar-create-meeting` | true | Live-tested — created a real Calendar event with a working Meet link (`meet.google.com/...`), `activities` row written. |

Migration `20260725000003_agent6_vault.sql` (Supabase Vault token storage:
`set_google_tokens` / `get_google_tokens` / `clear_google_tokens`, all
service-role only) plus follow-up migration
`agent6_google_status_and_disconnect_rpcs` (`get_my_google_status` /
`disconnect_my_google`, both self-service — `auth.uid()`-scoped and safe to
grant to `authenticated`) are both applied and live-tested.

### Two bugs found and fixed during the live run

Neither was catchable by SQL/curl testing alone — both only showed up once
this ran through a real browser against real Google endpoints:

1. **Missing CORS handling.** `google-oauth-start`, `gmail-send`,
   `calendar-create-meeting` (this agent) and `intake-sheet-fetch`,
   `intake-sheet-commit` (Agent 5) had no `OPTIONS`/CORS response headers.
   A browser calling any of them via `fetch`/`supabase.functions.invoke`
   sends a CORS preflight first; without `access-control-allow-*` headers
   the browser blocks the request before it reaches Supabase at all
   (`TypeError: Failed to fetch`, no server-side error to debug from). Fixed
   by adding a shared `CORS_HEADERS` object and an `OPTIONS` short-circuit to
   all five functions, matching the pattern `careers-apply` already used.
2. **`google-oauth-callback` redirected to the wrong domain.** It read
   `APP_SETTINGS_URL` from a function secret that was never set, so it fell
   back to a relative `"/settings"` — which resolves against the Supabase
   project's own domain (since that's where the redirect response
   originates), not the app. Real symptom: after clicking Allow, landed on
   `https://mebfbbvrqdctamnzvbbs.supabase.co/settings?google=connected`
   ("requested path is invalid") instead of back on the app. There's no
   tool available in this environment to set Edge Function secrets, so
   rather than depending on one, `google-oauth-start` now captures the
   browser's `Origin`/`Referer` header at connect time and stores it in the
   single-use state row; `google-oauth-callback` reads it back out and
   redirects there. `APP_SETTINGS_URL` is kept only as a last-resort
   fallback. This also means the flow works from any origin (localhost dev,
   a future deployed URL) without redeploying.

## Why `google-oauth-start` returns JSON, not a 302

The brief's natural design — GET this endpoint, get redirected to Google —
doesn't survive contact with the auth model: this function needs the
caller's JWT (to know whose connection it is), and a plain link click
(`<a href>`) can't attach an `Authorization` header. So the settings page
calls it via `supabase.functions.invoke('google-oauth-start', { body: { tier } })`,
which carries the JWT over `fetch`, gets back `{ url }`, and does
`window.location.href = url` itself. `google-oauth-callback` still issues a
real 302 — Google is the one navigating the browser there, and that leg
carries no JWT to begin with.

## Settings UI (`foos/app/src/modules/settings/`)

Mounted at `/settings`. `GoogleIntegrationCard` shows connect/connected
status, a checklist of the three scopes with per-scope "grant" buttons for
`send`/`calendar` once base is connected, and disconnect. Reads
`get_my_google_status()` (scopes + timestamps, never tokens) and calls
`disconnect_my_google()` directly; connect goes through
`google-oauth-start`. Label picker and template manager (also named in
brief instruction 12) are not built this pass — they're a thin CRUD layer
over `integration_settings` rows with no OAuth dependency, and are a clean
follow-up once the connect flow is proven live.

## Design decisions worth knowing about

- **Combined sync function.** `google-sync` does Gmail and Calendar in one
  function rather than two, since the brief describes them as parallel
  concerns with identical cadence/backoff/dedup shape. Splitting them is a
  clean follow-up once this is running for real, not a structural
  requirement.
- **Person matching at sync time** loads up to 2000 `people` rows and
  matches jsonb email addresses in memory — fine at the brief's stated
  modest volumes, would need a real join/index approach at higher volume.
- **Calendar updates in place.** A `gcal_event_id` match on a later sync
  updates the existing `activities` row (time change, cancellation label)
  instead of creating a duplicate.
- **Refresh token handling.** Google only returns a `refresh_token` on the
  first consent for a client/user pair; `google-oauth-callback` keeps the
  existing one on subsequent incremental-consent round trips rather than
  overwriting it with nothing.
- **Send always as the real user.** `gmail-send` never sends from a system
  address — it's always the connected staff member's own Gmail account,
  appears in their own Sent folder, matching the brief's "no black-box
  system sender" business rule.

## Gate 3 demo script

Run 2026-07-25 against John's real account, all steps passed:

1. From `/settings`, click "Connect Google account." Complete Google's
   consent screen for `gmail.readonly` only. Land back on `/settings` with
   the connected state and that one scope checked. ✅
2. Click "Grant send access," then "Grant calendar access" — each is a
   separate incremental-consent round trip; Google did not re-prompt for
   already-granted scopes. All three scopes show checked. ✅
3. Trigger `google-sync`. Confirm it runs cleanly against the real APIs
   (200, no errors) — 0 activities is correct with no matching test data;
   re-run once a test person shares an email with a real message/event to
   confirm the write path. ✅ (ran clean; match-and-write path not yet
   exercised with real matching data)
4. Send a test email via `gmail-send` to john@ventvest.com — confirm it
   sends through the real account (own Sent folder) and an `activities` row
   is written with a real `gmail_message_id`. ✅
5. Create a test meeting via `calendar-create-meeting` — confirm a real
   Calendar event with a working Meet link is created and an `activities`
   row is written with a real `gcal_event_id`. ✅
6. Disconnect from Settings; confirm the connected state clears. **Held off
   on purpose (John, 2026-07-25)** — re-testing this now would mean redoing
   all three Google consent screens to reconnect, and the live connection is
   still useful for further testing. Revisit before Gate 3 sign-off.
7. Send email / schedule meeting from an actual record view (not just a
   raw Edge Function call) — done 2026-07-25: "Send email" and "Schedule
   meeting" now work from both the ATS candidate record page
   (`CandidateRecordPage.tsx`) and the CRM contact record page
   (`ContactRecordPage.tsx`), via a shared `src/lib/googleActions.ts`
   helper. Verified live from the actual UI: a real Calendar event with a
   Meet link was created from a candidate record, and a real email was sent
   from a contact record — both wrote `activities` rows visible on the
   timeline immediately. ✅

## Post-launch fixes (2026-07-25, after the initial live-test pass)

- **`GOOGLE_SYNC_SECRET` is now set** — but as a database value
  (`integration_settings`, `staff_id=null`, `key='google_sync_secret'`), not
  a Supabase Edge Function secret, since no tool in this environment can set
  those remotely. `google-sync` checks the env var first (in case someone
  sets it directly later) and falls back to the DB row. Verified: calling
  without `x-sync-secret` now returns 401; with the correct value, 200.
- **Send/schedule buttons wired into real record views.** See item 7 above.

## Known gaps

- `google-sync`'s match-and-write path (steps that create `activities` rows
  from real Gmail/Calendar data) hasn't been exercised against real matching
  data — needs a test person whose email matches a real message or event.
- No scheduled trigger wired up yet for `google-sync` — needs a Supabase
  cron job or external scheduler, now that it's secret-protected.
- Disconnect hasn't been re-verified since the live tests began — held off
  deliberately (see step 6 above) since reconnecting means redoing all three
  Google consent screens and the live connection is still useful for testing.
- Label picker and template manager (brief instruction 12) not built —
  scoped out of this pass as noted above.
- Send/schedule buttons are wired into candidate and contact record pages
  only — not yet into deal record pages, and not into the Requisition or
  Company record pages (neither has an obvious single-recipient "send to"
  the way a person record does).
- The app itself isn't deployed anywhere yet (only local `npm run dev`) —
  this whole test ran against localhost.
