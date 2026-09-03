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

## U1.13, and two measurements that flattered the result

Rows and count are now separate requests on the candidate list, and the count is keyed on the filters rather than the page. First data row: 1,893 to 1,912 ms becomes 190 to 200 ms over three runs each way.

Both of my first measurements were wrong in the flattering direction, which is the direction to distrust:

1. **"Page turn 1,839 ms to 24 ms"** was measuring the click, not the data. `from` and `to` come from `page` state and the known total, so the pager label repaints immediately. Waiting on the first data row's own text gives 1,930 to 1,944 ms before and 1,073 to 1,089 ms after.
2. **"First row 126 ms on baseline"** was the empty-state row, which carries a `colspan` cell and matches `table tbody tr`. `.table-wrap tbody tr:not(:has(td[colspan]))` gives the honest 1,893 ms.

The corrected page-turn number is what exposed U1.15: with the count gone, a page turn still costs about 1,080 ms, and that is a rows-only request that costs 42 ms at offset 0.

## U1.15: offset flips the plan, and RLS is why

Measured in psql under RLS as the recruiter: `limit 20 offset 0` is 3 ms, `offset 20` is 751 ms, `offset 200` is 736 ms, and `offset 20` with `enable_seqscan = off` is 2.9 ms.

At offset 0 the plan is an Incremental Sort over `idx_people_last_first` that stops after 21 rows. At any other offset it is a Seq Scan on `candidate_profiles` feeding a top-N heapsort over all 72,917 rows. The reason is that `people_select` is `can_read_person(id)`, an opaque plpgsql function, so the planner gets a default selectivity and estimates the join at 267 rows against 72,917 actual. That is the same 273x error that `count: 'planned'` shows. It makes the index path look expensive (136,619) and the seq scan cheap (12,706), and the decision flips on 12,843 against 12,714.

I checked the environment before blaming the product. `effective_cache_size` is 16,384 pages, 128 MB, and `random_page_cost` is 4: both stock Postgres defaults. Supabase's docs say it generates per-compute-size optimisations that a custom config overrides, and do not publish the values, so this may not reproduce on hosted and cannot be checked from here. Setting `effective_cache_size` to 8 GB with `random_page_cost` 1.05 flips the plan back to 2.97 ms. Left unfixed rather than shipping a config change that would override Supabase's own tuning, or disabling seq scans. The durable fix is keyset pagination, which costs arbitrary page jumps, so it is a product decision.

## One invalid control run

After committing the coalescer, I re-ran the starvation spec with U1.13 stashed and it passed three times, which looked like the regression test had gone vacuous. It had not: stashing uncommitted work no longer removes the fix, because the fix is in HEAD. Bypassing the coalescer directly gives 3 of 3 failures again.

## Two more of mine, from the U1.13 work

1. **I ran the gate loop twice concurrently.** `kill %1` does nothing in a non-interactive `bash -c`, so my first loop survived and a second joined it: two gates, two dev servers fighting over `strictPort: true` on 5175, four Playwright workers. That produced two failures I had never seen, in global search and in a pressed-button colour, neither related to anything I had changed. Both pass in isolation. Concurrency in my own tooling produced exactly the kind of phantom failure I have been telling myself not to accept. `setsid` also does not exist on macOS, which swallowed a relaunch silently.
2. **Splitting the count opened a hole in the export cap.** The export refuses filters matching more than 10,000 rows, and it read the total that used to arrive with the rows. With the count now asynchronous, `total` is null for about 1.5 s after a filter change, so a click in that window skipped the cap. The export now fetches its own count when the total is unknown, which keeps the guard exact rather than approximately right.

Also fixed while reading the diff: a realtime reload refreshed the rows but not the total, because the count effect keys on the filters alone. `reloadAll` now refreshes both, without blanking the total first, so the number never flickers to empty on a live update.


## Verifier state at the end of U1.13

`scripts/verify-zoho-migration.mjs`: all seven passes clean. PASS 5 compares Modified_Time on the full population: candidate 72,910 of 72,910, requisition 687 of 687, company 104 of 104, zero drifted. PASS 6 reads 1,747 enumerated, 8 identity documents held back, 1 over the 25 MB bucket limit, 1,738 expected, 1,738 rows with bytes, 1,738 objects in the bucket, 0 metadata-only rows and 0 placeholders whose file has since arrived.

`scripts/verify-zoho-sample.mjs` did **not** run: it needs `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` and `ZOHO_RECRUIT_ORG_ID`, and this checkout has no root `.env` and no file holding them. They were in a previous shell's environment, and shell state does not persist between commands here. Recorded as not run rather than as green.

Gate runs on the finished U1.13 code: runs 2 to 5 clean at 20 ok and 153 browser tests each. Run 1 failed on the browser step and its failing test name was lost, because my report snapshotter only started during run 3. Run 1 was also the first run after force-killing two concurrent gate loops, so contamination is the likely explanation rather than a defect, and runs 6 to 8 are measuring that rather than assuming it.

## The pressed-button flake, chased to its cause

`interaction-states.spec.ts` "a pressed primary button darkens instead of turning grey": 3 of 8 gate runs failed, 5 of 5 passed in isolation. Cause: `page.locator('.btn-primary').first()` re-resolves. On `/settings` the first primary button is "Add template" at 398,821 until the Google card's data lands, then "Connect Google account" at 398,410. The test hovered one and polled the other, which was never under the cursor. Fixed by settling on the first button's text and box, pinning it with `elementHandle()`, and using that handle for the hover and the polls. Assertion unchanged.

Two wrong readings of mine while chasing it:

1. I read the background immediately after `mouse.down()`, saw the idle colour with `:hover` and `:active` both matching, and nearly wrote up "hover and active never apply". The motion layer transitions `background-color`, so an immediate `getComputedStyle` returns the interpolated start value. The test's own 5 s poll was never affected by this.
2. I went looking for a module-layer rule overriding the button, since a later layer beats a more specific shared rule. There is none: `.btn-primary` appears in three shared rules and one recruit print rule, and the settings stylesheet does not touch buttons.

Also noted, not a defect I fixed: `:hover` and `:active` both resolve to `--fo-primary-hover`, so this test cannot tell pressed from hovered, only either from grey.

## The gate failure I caused with pkill

Gate runs 9 to 12 each reported 19 ok and 1 fail with the browser suite passing 153. The failing check was `attachments`: "2 orphaned storage object(s) and 2 queued file(s) still present". The two objects were `qa-older-*.pdf` and `qa-newer-*.pdf` on a demo person, so plainly a test fixture rather than migration data. Cause: I force-killed gate and Playwright processes with `pkill -9` while chasing the concurrency mess, so those tests' `afterEach` teardown never ran and the files outlived their rows. `node scripts/purge-orphan-attachments.mjs --apply` cleared them, 1,207 stale queue entries closed with them, and the next gate was 20 of 20 green.

Two lessons, both about my own tooling rather than the product: killing a test run leaks exactly what the teardown was there to prevent, and a check that says "an attachment row was deleted without removing its file first" is describing my `pkill`, not the code.

## Gate evidence for U1.13 and U1.16

Thirteen gate runs. Browser suite clean at 153 passed in runs 2 to 6 and 9 to 13, ten runs. Runs 7 and 8 failed the pressed-button test, which is now fixed and has since passed four consecutive gate runs plus five in isolation. Runs 9 to 12's single failure was the orphan cleanup above. Run 13 is 20 of 20.

## U1.15: the covering index that fixed exactly one page

Tried `people (last_name, first_name, id) include (middle_name, emails, city, state, country, updated_at)`, 12 MB against a 94 MB table. It works, in the narrowest possible sense: offset 20 flips to an Index Only Scan touching exactly 40 rows, 751 ms to 3.5 ms. Then offsets 40, 60, 80, 100 and 140 measure 744, 737, 777, 744 and 752 ms, because the index path's estimated cost grows with the offset while the seq-scan-and-sort cost is flat, so the planner flips back at page 3.

Dropped it. Twelve megabytes to fix page 2 alone would have looked like a fix in a changelog while leaving the 273x misestimate exactly where it was. `check-migrations` confirms no drift, and offset 0 and 20 are back to 2.7 ms and 732 ms.

What is left for U1.15 is a decision with three costed options: keyset pagination (loses page jumps and the Last button, which are part of the Taleo pager), expressing the visibility rule in the policy as an estimable subquery (removes the cause, but the rule then lives in two places), or re-measuring on the develop Supabase project first, since 128 MB `effective_cache_size` is a stock local default and Supabase tunes it per compute size. The third is the one to do first: the other two both cost something real and neither should be paid until the flip is known to happen off this laptop.
