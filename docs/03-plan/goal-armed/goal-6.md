# ACTIVE GOAL: Goal 6 — Hosting and cutover

Get it running on a public URL. Separate from Goal 5 because it is infrastructure rather than component code, most of it is Dashboard settings no migration can make, and three of its twelve items are Klent's decisions rather than mine. These are X1 to X12 in the plan, detailed in section 7.28.

**What is already settled, so this does not relitigate it.** The artefact is a **static SPA**: `app/` builds to **34 files, 955,154 bytes (0.91 MiB), largest 215,735 bytes**, in 990ms, with no server-side dependency and only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as configuration, both baked into the bundle. The anon key therefore ships publicly, which is by design because RLS is deny-by-default and `validate.sql` proves it over 34 checks.

**Corrected 2026-09-07 by measuring it.** Every earlier statement of this figure said "41 files, 1.0 MB, largest 212 KB", and all three numbers were wrong. A fresh `npm run build --workspace=app` writes **34 files** totalling **955,154 bytes**, which is 0.91 MiB or 0.96 MB, with the largest at **215,735 bytes** (`vendor-supabase`), in 990ms. Twenty-nine of the 34 are in `assets/`; the other five are `index.html`, `favicon.png`, `apple-touch-icon.png`, `og-careers.png` and `ventvest-logo.webp`. The direction matters as well as the size: fewer files and fewer bytes than claimed, so no host limit moves.

**Fly is ruled out on its own documentation**: static files must be packaged as a container image and run on machines, so it means maintaining nginx to serve 34 files. **Vercel is already configured** — `vercel.json` is committed with `outputDirectory: app/dist`, the SPA rewrite `/((?!assets/).*)` without which every deep link 404s, immutable asset caching, and a full header set whose CSP already allows `https://*.supabase.co`, `wss://*.supabase.co` and `accounts.google.com`. **X12 is the only open host question and it is licensing, not capability**: Vercel Hobby is "non-commercial, personal use only" per Vercel's own docs, so this needs Pro at $20 per seat per month, against Cloudflare Pages serving static assets "free and unlimited". If Cloudflare, port the rewrite and headers to `_redirects` and `_headers`.

**Updated 2026-09-07: the Cloudflare terms check is done, so stop treating it as open.** The old non-HTML-content limit, Supplemental Terms section 2.8, was retired on 2023-05-16, and the Developer Platform service-specific terms of 2026-06-02 carry no commercial-use restriction. Pages free allows 500 builds a month, 20,000 files and 25 MiB an asset, against our 34 files at 955,154 bytes. Vercel's own pricing page still reads "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan", and Pro is a $20/month platform fee including one deploying seat and $20 of usage credit. **The licensing asymmetry is real and one-sided; both hosts serve this bundle identically.** The quotes and sources are in `docs/07-environments/VVPH_VV-FOOS_Runbook_Hosting-And-Cutover`. What remains in X12 is Klent's choice of which bill to pay, not more research.

**Also corrected 2026-09-07: three of the twelve are Klent's, not two.** X8 (what data the hosted instance carries), X11 (whether the host builds on push) and X12 (which host). X1 is separately his action because only he can create the project. The other eight are mine.

## X1 IS ANSWERED, AND IT CHANGES THE RISK OF THIS WHOLE GOAL

**Klent, 2026-09-08: "use the existing supabase project. run goal 6 as the last one."**

So there is **no new develop project**. The target is `mebfbbvrqdctamnzvbbs`, "Front Office OS", which the CLI reports as `linked: true` and which is **the live project holding real candidate data**. Three things follow, and none of them may be glossed over.

1. **X2 is now a production write, not a rehearsal.** The repo holds **54** migrations and **36 of them are dated 2026-09-01 or later and exist locally and in git only**. Applying them means writing 36 migrations to production. `supabase db push` also refuses on its own with `LegacyDbPushMissingLocalError`, because ten migrations were applied there through the MCP connector under generated timestamps against six hand-written repo files. **The ledger is inconsistent and X1 was the thing that was going to sidestep it.** It no longer does.
2. **The reason backups were dropped has expired.** O6, backups and point-in-time recovery, was parked "because a new develop project is coming". There is no new project, so that justification is void. **A verified backup or a PITR window is now a precondition of X2, not an optional extra.**
3. **X8 IS ANSWERED.** Klent, 2026-09-08: **"just make sure the data in mebfbbvrqdctamnzvbbs is also in supabase local. we only basically need to add the supabase local data to existing supabase project."**

   So it is a reconciliation in **both** directions, not a one-way load:

   - **Live to local**, first. `app/.env.development` records that the hosted database holds **76 real people, real recruiter assessment notes, and attachment metadata referencing identity documents**. Anything there that local lacks must come down before anything goes up, because after the push it becomes impossible to tell which side a row came from.
   - **Local to live**, second. The measured local volume, all of it real: **72,988 people, 72,917 candidate_profiles, 86,133 applications, 214,311 activities, 690 requisitions, 195 companies, 1,738 attachments, 372,754 zoho_id_map rows.**

   **The hard parts, named now so they are not discovered mid-push:**

   - **Identity is the whole problem.** `zoho_id_map` is the reconciliation key and it holds 372,754 rows; the import is idempotent through it, which is what makes a re-run safe. Any row without a map entry, including the 76 that already live in production, needs a decided identity rule before it moves.
   - **`staff.id` must equal `auth.users.id`** and there is no FK enforcing it. Moving people without moving the staff who own them produces orphaned `created_by` and `sourcer_id` values that RLS will then hide from everyone.
   - **Storage objects do not travel with rows.** 1,738 attachment files at roughly 451 MiB live in the local bucket; the `attachments` rows without their bytes give a UI full of files that cannot be opened. `lib/attachments.ts` already distinguishes a pending import from a real file, which is the mechanism to lean on.
   - **Demo rows must not go up.** 10 test people, 5 test companies, 3 test requisitions and 2 test deals carry `is_test`, and the three demo staff have no `is_test` column at all, so they are deleted by hand. That is X9, and it now runs **before** the push rather than after.
   - **The triggers will fire on every insert.** Migration 10 writes `activities`, `audit_log` and `events_outbox` rows on stage and status changes. A bulk load either runs with them enabled and produces hundreds of thousands of derived rows, or disables and re-enables them deliberately and rebuilds what was skipped. **Decide which, in writing, before the first insert.**
   - **A backup first, not as an afterthought.** See point 2: O6 was parked because a new project was coming, and there is no new project.

**X8 is answered and X12 is not.** Klent, 2026-09-08: "as for where to deploy the webapp, let me think about it first." So the database reconciliation can be planned and dry-run, and **no deploy target is chosen**, which means X7's variables and the host settings stay unanswered.

**Nothing in this goal touches production until a backup exists and Klent has confirmed the trigger decision in writing.** Preparation, dry runs against the local stack, and `scripts/check-cutover.mjs` without `--allow-live` are all fair game meanwhile.

**The frontend is the easy part. Do the Supabase work in this order.**

1. **X1**, Klent creates the develop project and gives you the ref. This also sidesteps a real blocker rather than solving it: the live project's ledger is broken, ten migrations applied through the MCP connector under generated timestamps against six hand-written repo files, which is why `supabase db push` refuses with `LegacyDbPushMissingLocalError`. A fresh project has nothing to reconcile.
2. **X2**, apply all **54** migrations. They apply cleanly from scratch in order, which `npm run db:reset` proves on every local run.
3. **X3**, the settings no migration can make: enable `pg_cron`, add `dash` to Data API → Exposed schemas, restrict Google OAuth to the ventvest.com hosted domain with email/password fallback. **Skip the middle one and every dashboard query returns `PGRST106`**, which is defect QA-001.
4. **X4**, add the production and preview origins to Supabase Auth redirect URLs and to the Google OAuth authorised origins, or sign-in breaks on the hosted domain.
5. **X5**, deploy the **11** Edge Functions with their `verify_jwt` settings and secrets, per `supabase/functions/README.md` and `README-agent6.md`. They deploy to Supabase, not the web host, so a frontend-only deploy leaves careers, intake and the Google integration dead.
6. **X6**, set `CAREERS_PUBLIC_ORIGIN`, since `careers-page` hardcodes `https` because `req.url`'s scheme cannot be trusted behind Supabase's proxy.
7. **X7**, set the two `VITE_` variables in the host. The client throws at boot if either is missing.
8. **X8**, **Klent's decision**: what data the hosted instance carries. The **72,917 imported candidate records are real people**. Hosting seed data only is a legitimate answer. Do not import real data on your own judgement.
9. **X9**, if real data goes up, purge the demo rows first: the `is_test` rows and the three demo staff, who have no `is_test` column and are deleted by hand. Purge order is in `README.md`.
10. **X10**, verify after deploying rather than before, and make each check prove a different item above: Google sign-in; one dashboard query, which proves `dash` is exposed; a deep link such as `/recruit/candidates/<id>`, which proves the rewrite; a live update, which proves `wss://` passes the CSP; and the public careers page.
11. **X11**, **ask before enabling anything that builds on push.** The GitHub Actions workflow is disabled at Klent's instruction and **stays disabled**; a host's git integration is a separate mechanism and needs its own yes.

**Standing rules.** Verify each step by exercising it, not by reading a settings page. **When you hit an error, fix it: think about the cause, read the code, search the web, and never skip it or take a simpler path because a shortcut appears to pass.** **Never write to production**, and note that in this goal the new develop project is the intended target while `mebfbbvrqdctamnzvbbs` is not, so confirm the ref before every `--linked` command. Real candidate PII must never reach a document, a commit message or a web search. Commit each item separately saying what changed **and what you got wrong**. Stop and ask on X8, X11 and X12 rather than deciding them.

**ON FINISHING THIS GOAL, RE-ARM THE REMINDER BEFORE STARTING THE NEXT ONE:** `bash scripts/arm-goal.sh 7` — or `off`, since goal 6 is the last. An armed goal that no longer matches the work is worse than none, because it reads as confirmation. If you notice the armed goal is stale, re-arm it before doing anything else.
