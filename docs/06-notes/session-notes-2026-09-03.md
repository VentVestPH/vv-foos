# Session notes, 2026-09-03

Running record of errors, fixes and realisations, so nothing is lost to compaction.

## The recurring lesson

Counting records proved nothing about correctness. All nine field-level losses had already passed record-count reconciliation and the referential-integrity checks. Reports produced by the code under test were repeatedly wrong in the alarming direction. Three "flaky tests" turned out to be real product bugs.

## Errors I made, and the fix

| # | Error | How it surfaced | Fix |
| :---- | :---- | :---- | :---- |
| 1 | `data.id` ReferenceError in `importNotes`/`importAttachments` | Report claimed 210,922 notes failed; the database was correct | `inserted.id`; proved from the DB (27,769 activities less 27,760 mappings = 9 seed) |
| 2 | `loadIdMap` paged without ORDER BY | Loaded 47,453 of 72,910 | Keyset paging plus a count self-assertion that throws |
| 3 | Staff attribution empty | Bulk CSV emits bare ids, `resolveStaff` indexed names | `zoho-users.mjs`; Recruit 401 needed `ZohoRecruit.users.ALL` |
| 4 | Nine field-level losses | Column-by-column comparison against the export | Aliases (`Zip_Code`, `LinkedIn__s`, `Facebook__s`, `Note_Owner`), `Number_of_Positions`, `parseZohoDate` bare `YYYY-MM-DD`, `parsePartialDate` `MM/YYYY` and lists, `mapContact` bare-id fallback |
| 5 | My own verifier was wrong | 26 mismatches all exactly 8 hours; the uniformity was the tell | I stripped `+08:00` and stamped `Z`; compare instants instead |
| 6 | Bucket rejected `application/x-downLoad` and `application/pdf;charset=UTF-8` | Upload failures | Derive MIME from the file extension |
| 7 | Uncaught `TimeoutError` | `res.arrayBuffer()` sat outside the try/catch | Guarded; timeout raised to 120s |
| 8 | `getBucket` returns `file_size_limit`, not `fileSizeLimit` | My size pre-check silently never fired | Read both spellings |
| 9 | `gate.sh` assertions were stale | Importer asserted seed-era counts; backfill accepted `matched 0` as success | Idempotency invariant; `bfsrc == bfmatched` |
| 10 | I added a 7-line comment block to `drag-and-drop.spec.ts` | `check-comments.mjs` failed | Removed. The real mistake was not running the guard before committing |
| 11 | I claimed the keyboard flake "reproduces reliably" after 2 failures | Run 3 passed | It is about 2 in 7 |
| 12 | I claimed the attachment UI was "person-only", inferred from the DB | Reading the screens disproved it | Requisition and company panels already existed; only `application` was missing. Corrected in the plan |
| 13 | `useLatestOnly` can starve a list permanently | `list-keyboard` intermittent: 7 loads, `pager "0 of 0"`, totals moving 72,919 to 72,917 | See below |

## Defect 13, in full

`CandidateListPage` subscribes to `postgres_changes` on `candidate_profiles` with `event: '*'` and calls `load()` from the handler with no coalescing. Under a trickle of concurrent writes, every event restarts the load; each restart increments the `useLatestOnly` sequence and invalidates the in-flight request that was about to paint. On a 72,917-row table the list query takes long enough that a steady trickle starves it forever: no response is ever the newest when it lands, `setProfiles` never runs, and the table renders empty with no error.

This is not test-only. Two recruiters editing candidates while a third has the list open reproduces it. The guard is right to drop stale responses; the defect is restarting the load per event.

Fix: coalesce realtime-triggered reloads (trailing debounce, and never restart while one is in flight), and re-check the guard before the later `set` calls in `load`, which currently let a stale load write `apps` and `reqs`.

## Defect 13, measured

| Measurement | Result |
| :---- | :---- |
| `candidate_list` page of 20 with `count: 'exact'`, through PostgREST as recruiter | 1,809 ms, three runs within 6 ms |
| Same page, rows only, no count | 42 ms |
| Exact count alone, through PostgREST | 1,752 ms |
| Exact count on `candidate_profiles` directly | 20 ms |
| `count(*) from candidate_list` in psql as `postgres` | 24 ms |
| Same, wrapped in a materialised CTE as PostgREST does | 276 ms |
| Same materialised CTE, RLS active as recruiter | 2,026 ms |
| Slim projection, no `search_text` or `has_resume`, materialised, RLS active | 1,457 ms |
| One churn write to `candidate_profiles` | about 700 ms, because migration 10's triggers fire on every write |

So the starvation window is 1.8 s and events arrive every 0.7 s: two concurrent writers starve the list permanently. That is the whole mechanism behind the `list-keyboard` intermittent.

The reproduction is `tests/e2e/list-realtime-starvation.spec.ts`: it fails 3 of 3 without the fix and passes 3 of 3 with it. Two earlier versions of that spec were worthless and I nearly believed both:

- the assertion allowed 30 s while the churn ran only 9 s, so it passed by waiting for the writes to stop rather than by painting under them;
- the churn wrote to a `comments` column that does not exist on `candidate_profiles`, and the loop did not check `error`, so `writes` counted 11 failures as successes and the run had zero real events.

The rule that caught both: check the error on every call, fixtures included, and make a regression test fail on the unfixed code before believing it.

`RequisitionListPage` carries the same defect, an unfiltered `event: '*'` subscription on `applications`, and gets the same fix. No test is claimed for it: its list query measures 76 ms over 690 requisitions, so starving it needs events closer together than 76 ms, and one write costs 700 ms. The exposure is real in production data volumes but not deterministically reproducible here, so asserting it would prove nothing.

## New finding: the pager's exact count dominates every list load

97% of the candidate list's 1,809 ms is the pager count, and PostgREST recomputes it on every request, so a page turn costs 1.8 s as well as the first paint. The cost is not the view's expensive columns: Postgres prunes those, and a slim projection still costs 1,457 ms. It is `people_select`, which is `can_read_person(id)`, a plpgsql security-definer function taking a per-row argument. It cannot be hoisted the way `candidate_profiles_select` already hoists `(select get_my_role())`, so it runs 72,917 times per count.

Not yet fixed, and not to be fixed by duplicating the policy logic into a counting function: that would put the visibility rules in two places and they would drift. Recorded as a plan item.

## Defect 14: one channel name, five subscribers

`node scripts/check-attachment-queue.mjs` failed with "4 client_errors row(s) left behind", and its message assumes a test recorded a failure and did not clean up. Reading the rows contradicted the message: all four were `cannot add postgres_changes callbacks for realtime:dash-outbox-refresh`, route `/?tab=pipeline`, two events each recorded once by `window.error` and once by the error boundary. The dashboard had crashed twice inside a suite that reported 152 passed.

Proven against the local stack rather than inferred: `supabase.channel(topic)` returns the same instance for a topic, and binding after `subscribe()` throws with exactly that message. Four `useOutboxRefresh` callers plus the widgets panel all used `dash-outbox-refresh`. While every panel mounts before the socket joins, all five bindings land on one channel and nothing goes wrong, which is how it survived this long.

Fix: `useOutboxRefresh` is a refcounted singleton with a listener set, the pattern `modules/intake/hooks.ts` already used, which also takes the dashboard from four channels to one. `lib/realtimeChannel.ts` gives every subscription a unique topic so a channel whose removal is in flight cannot be rebound. All nine subscription sites use it. The O4 budget test pinned the exact topic `realtime:intake-items` and now allows an instance suffix while still asserting one channel.

Lesson: the guard's wording sent me looking for a leaky test. The rows were the answer and reading them was faster than trusting the message.

## U3.2 and U3.5, and two of my own numbers corrected

| Claim | Correction |
| :---- | :---- |
| "432 MB in Storage" | 472,697,067 bytes, which is 451 MiB |
| "1,738 of 1,739 files" | 1,747 enumerated once the CRM modules are included: 1,738 stored, 8 identity documents held back, 1 file of 76.5 MiB the 25 MiB bucket refuses |

The reconciliation is exact, module by module: requisition 1,056 against Job_Openings 1,056, application 29 against Applications 29, company 54 against Clients 43 plus CRM_Accounts 12 less the oversized one, person 599 against Candidates 607 less the 8 held back. `storage.objects` holds 1,738 for 1,738 rows claiming bytes, so no row points at a missing file.

U3.5: the 42 rows still on a `zoho-import/pending/` path were duplicates. The Zoho attachment id in all 42 paths appears in a downloaded path, and every downloaded twin sits on the same parent and `parent_type`, so records were showing a working file and a dead "File not yet available" placeholder for the same document. 40 distinct ids behind 42 rows, so two were duplicated at source. Removing them is what closes D5.

## Open: the unviewed-badge live update

Fails about 3 of 3 full-suite runs with today's changes and passed 2 of 2 without them, so it is being treated as mine until measured otherwise. Instrumentation settles what is *not* wrong: the channel reaches SUBSCRIBED, its subscribe callback fires a reload, and then no realtime event arrives for the full 30 s while the test upserts `application_views` repeatedly. So the reload path works and the messages are not being delivered. `MessagePerSecondRateLimitReached` appears in the Realtime container, which CLAUDE.md already names as the reason for the 2-worker cap and the symptom "live-update tests going stale".

**Corrected by measurement.** The badge test fails on baseline too: full-suite baseline run 1 gave 4 failures, and it was one of them, with 9 `MessagePerSecondRateLimitReached` events in the container. My earlier "passed 2 of 2 without them" was a *pair* run, not a full suite, so it was not a baseline at all. The other three baseline failures are accounted for: `list-realtime-starvation` and `settings-export` U3.4 fail because their fixes are stashed, and `list-keyboard` "End and Home" is the original intermittent reproducing on unfixed code, which is independent confirmation that the starvation defect is real and predates today.

What is still being measured is whether today's changes made it more likely. They should reduce Realtime load rather than raise it: the dashboard went from four channels to one, and unique topics do not change how many channels are live. Measuring 3 baseline runs against 3 changed runs, counting both failures and rate-limit events per run, rather than asserting either way. Note the baseline runs also fail `list-realtime-starvation.spec.ts` by design, since the fix is stashed for them.


## Three more corrections, all mine

1. **"Starves it permanently" was wrong.** A load completes whenever jitter opens a gap longer than the query. Over 8 s it does not; over 18 s it usually does. The defect is a list empty for many seconds, not one that never recovers.
2. **A tighter budget and a denser churn both made the regression test worse.** Widening the budget to 18 s let the unfixed code pass 2 of 2. Four concurrent writers let it pass 2 of 3, because the denser stream trips the 100 messages per second ceiling and the dropped messages are the events the test needs. The counterintuitive part is that more churn produces fewer events.
3. **The version that works does not race the database.** It delays every `candidate_list` response by 2 s with `page.route`, the idiom `list-persistence.spec.ts` already used for U1.10, and churns one change per second. Deterministic against any query speed and any suite load: 3 of 3 fail unfixed, 3 of 3 pass fixed.

Also: the gate came back fully green at two workers, 153 browser tests including the badge test that QA-009 is about, so QA-009's rate needs re-measuring before it is published as an expected failure. Four measured runs are in flight.
