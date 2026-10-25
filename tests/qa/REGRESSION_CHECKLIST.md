# FOOS Regression Checklist

Project: VV-FOOS · Agent 8 (QA) · 2026-07-25

Purpose: a single click-through a human can run before any release to catch a broken build fast, without re-running the full Agent 8 suite. Time-boxed to under half a day. Run on `is_test = true` data throughout unless a step says otherwise. Each step lists the expected result and its source (so a failure points straight at the owning module's fuller demo script for follow-up).

Run order follows dependency: auth/RLS first, then ATS, then CRM (needs ATS for the cross-module hire step), then Intake, then Dashboards (reads data the earlier steps just created), then the Google integration.

## 0. Sign-in and role gating (5 min)

1. Sign in as each of the four personas (admin, recruiter, sourcer, bd). Confirm each lands on the dashboard home and sees only the nav sections their role grants (ATS for recruiter/sourcer, CRM for bd, both plus Experiment metrics for admin).

## 1. ATS / Recruit (20 min) — source: `app/src/modules/recruit/README.md`

2. Create a requisition (title, company, pay, two owners, one approver, "Test data" ticked). Confirm it lands as **draft** with a REQ code.
3. Submit for approval, then approve as the approver persona. Confirm **open** unlocks and `opened_date` is set.
4. Add three candidates to the pipeline. Confirm the header/list badge reads **3 Unviewed**.
5. Open one candidate. Confirm the unviewed badge drops to 2 with no reload.
6. Drag a candidate through `phone_screen` → `submitted` on the kanban. Confirm each drop logs a timeline `status_change` entry.
7. Drag one to `rejected` without a reason. Confirm the dialog blocks the write until a reason is entered.
8. Drag one to `hired`. Confirm `hired_at` is set and a promotion prompt appears.
9. Save a candidate-list filter view, reload the page, reapply it. Confirm the same filtered set returns.
10. Export the pipeline table to CSV. Confirm the file matches the on-screen rows.

## 2. CRM / Sales (20 min) — source: `app/src/modules/sales/README.md`

11. Create a company, a contact on it, and a deal on both ("Test data" ticked throughout). Confirm the deal gets a `DEAL-` code.
12. Drag the deal `lead` → `qualified` → `proposal` → `negotiation`. Confirm each drop logs a `status_change` activity.
13. Drag a second deal straight to `lost` without a reason. Confirm the `LostReasonDialog` blocks it; cancel once, then complete with a reason and confirm `lost_reason` is saved.
14. Drag a third deal to `won`. Confirm no reason prompt and the stage updates immediately.
15. Cross-module: advance the ATS candidate from step 8 to `hired` if not already, and confirm the `HiredPromotionListener` banner appears in CRM with no reload, naming the right company.
16. Click "Review," confirm `/sales/promote` opens pre-filled, confirm the promotion, and confirm exactly one `contact_profiles` row now exists for that person (no duplicate `people` row).
17. Repeat the hire on a second candidate and click "Dismiss" instead. Confirm no `contact_profiles` row is created and the banner clears.
18. Walk one ticket through `new → open → pending → resolved → closed`. Confirm each transition logs a `status_change` activity (tickets emit no v1 outbox event by design — don't expect one).

## 3. Intake (15 min) — source: `app/src/modules/intake/README.md`

19. Stage five LinkedIn URLs as a batch. Confirm all five appear in the queue at `pending` and the nav badge increments live.
20. Grade three items, then open one whose email/LinkedIn matches an existing test person. Confirm the dedup panel surfaces the match and defaults to "merge."
21. Merge that one, import the other four as new. Confirm all five show `imported` and appear in the ATS candidate list with grade, source, and sourcer attribution intact.
22. Fetch a public Google Sheet of contacts, map columns, preview, and import. Confirm the flagged duplicate is caught and the rest import as companies/contacts.

## 4. Dashboards (10 min) — source: `app/src/modules/dashboards/README.md`

23. As a sourcer, confirm the ATS tab only shows applications for candidates that sourcer sourced, and the CRM tab is empty. As bd, confirm the reverse.
24. Change the date-range preset and confirm every widget re-queries and KPI numbers change.
25. Click a CRM pipeline-by-stage bar. Confirm it lands on `/sales/deals` pre-filtered to that stage.
26. In a second tab (or via SQL), move a deal or advance an application. Confirm the open dashboard tab picks up the change within ~5 seconds with no manual reload.
27. As admin only, confirm the Experiment metrics tab is visible; as any other role, confirm it's absent (not just disabled).

## 5. Google integration (10 min, live account — see `supabase/functions/README-agent6.md`)

28. Send a test email from an actual record view (candidate or contact record page, not a raw function call). Confirm it sends and an `activities` row lands on the timeline immediately.
29. Create a test meeting from a record view. Confirm a real Calendar event with a working Meet link is created and logged on the timeline immediately.
30. **Open item, not yet re-verified**: the disconnect path (`/settings` → disconnect Google) was deliberately held off during Agent 6/8 testing because redoing all three consent screens to reconnect wasn't worth the cost mid-build. Run this once, standalone, before Gate 4 sign-off, since it's the one step never actually exercised end to end.

## Total time budget

~80 minutes if every step passes clean — comfortably under the half-day ceiling. Any step that fails, stop and file it in `DEFECT_LOG.md` using the same QA-### format and severity rules as the rest of Agent 8's findings (RLS-related failures are Critical by default, no downgrade without John's sign-off).
