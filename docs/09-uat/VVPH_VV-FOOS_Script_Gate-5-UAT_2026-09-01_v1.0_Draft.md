# Gate 5 UAT Scripts

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft

Two scripts: a recruiter script covering the ATS, and a BD script covering the CRM. Gate 5 is the cutover trigger, so these are the last human checks before the Taleo and Zoho subscriptions are cancelled.

Each step names the exact control to use and the exact result to look for. A step passes only if the observed result matches; anything else is a fail with a note, not a judgement call by the tester. The scripts assume the tester has never seen the system, so every step says where to click.

## 1. What is already automated, and what these scripts are for

57 API tests and 22 browser tests run from a clean `npm run db:reset` and cover the mechanical guarantees: RLS boundaries per role, trigger side effects, the careers endpoint's security behaviour, attachment access, mandatory outcome reasons, live updates, and the success metrics. `supabase/tests/validate.sql` adds 16 schema checks.

These scripts deliberately do **not** re-check any of that. They cover what only a person can judge:

- whether the workflow makes sense end to end without instruction
- whether the screen matches Taleo closely enough that a Taleo user is not retrained
- whether wording, ordering and defaults match how VentVest actually recruits
- the paths automation cannot drive: drag and drop, file pickers, real email, real calendar

## 2. Before you start

| | |
| :---- | :---- |
| Environment | The UAT environment, not production. Confirm the URL with John before starting |
| Accounts | You need your own named account, not a shared demo login. If you were given `demo-admin`, stop and ask for a real one: a shared account makes the audit trail useless |
| Data | The UAT environment must hold migrated records, not seed data. If you see "Aster Analytics" or "Marco Silva", you are on seed data and the results will not mean anything |
| Time | Recruiter script about 60 minutes, BD script about 40 minutes |
| Recording | Note the step number, what you expected, what happened, and a screenshot for any fail |

Do not use real candidate names in your notes. Refer to records by their display code (`REQ-0007`, `APP-0031`).

## 3. Recruiter script: ATS

### 3.1 Sign in and orient

| # | Do this | Expect |
| :---- | :---- | :---- |
| R1 | Open the URL and sign in with your ventvest.com Google account | You land on a page headed "My View: <your name> (<your role> at VentVest)" |
| R2 | Without clicking anything, read the left sidebar | Quick Search, Candidate Keywords, Advanced Search, Candidate First Name, Candidate Last Name, and a Recently Viewed panel that says records you open will appear here |
| R3 | Read the blue navigation bar | Home, Pipeline, Requisitions, Candidates, Intake, Accounts, Contacts, Deals, Tickets, Employees, Onboard/Offboard, Reports, Courses. If your role should not see Accounts, Contacts or Deals, say so |
| R4 | Judgement call. Compare this screen against Taleo side by side | Note anything that would make you hesitate or look for a control that is not there. This is the single most valuable note in the script |

### 3.2 Requisitions

| # | Do this | Expect |
| :---- | :---- | :---- |
| R5 | Click Requisitions | A list headed "Requisitions: Home" with a filter rail on the left |
| R6 | Count the rows, then look at the bottom of the list | A pager reading "1-20 of N". If N is under 20 there may be no pager; note the number either way |
| R7 | Use the filter rail to filter by a status you use daily, then click Go! | Only matching rows remain. The filter you chose is still visibly selected |
| R8 | Click Export CSV, open the file | The rows in the file match the rows on screen, including the filter. Note any column that is missing or in the wrong order versus your Taleo export |
| R9 | Click Save view, name it, reload the page | The saved view is offered and reapplies the same filter |
| R10 | Click a requisition title | The record opens. The URL changes to a requisition address |
| R11 | On the record, note which sections are open by default | Note any section you would want open that is closed, or vice versa |
| R12 | Click Back To List | You return to the list **with your filter and page still applied**, not to an unfiltered first page |

### 3.3 Candidate pipeline, including drag and drop

| # | Do this | Expect |
| :---- | :---- | :---- |
| R13 | Open a requisition with several candidates. Find the pipeline | Both a table view and a kanban view are offered |
| R14 | In table view, note the "Next Steps" column | Requisitions with unviewed applications show an unviewed count |
| R15 | Switch to kanban. Count the cards | The same number of candidates as the table showed |
| R16 | **Drag** a card from one stage to the next | The card lands in the new column and stays there. No page reload |
| R17 | Reload the page | The candidate is still in the new stage |
| R18 | Open that candidate's record and find Status History | A row for the move you just made, with the previous status, the date in, and a duration |
| R19 | Drag a candidate to Rejected | You are asked for a rejection reason and cannot complete the move without one |
| R20 | Type a reason and confirm | The move completes and the reason appears on the record |
| R21 | Drag a candidate to Hired | The move completes, and you are offered the option to promote that person to a CRM contact |
| R22 | Decline the promotion | Nothing is created on the CRM side. The hire itself is unaffected |
| R23 | Judgement call | Does the drag feel responsive? Is it obvious which column you are dropping into? |

### 3.4 Candidate record

| # | Do this | Expect |
| :---- | :---- | :---- |
| R24 | Open any candidate record and read the section list | Requisition Summary, Candidate Information, Main Status Details, Resume and Cover Letter, Resume Preview, Attachments, Requisition Details, Web Links, Source, Tracking, Contact Log, Events, Tasks, Reminders, Status History, History Log / Timeline |
| R25 | Expand Resume and Cover Letter | The most recent resume is marked as current. Note if the wrong one is marked |
| R26 | Expand Resume Preview | The resume renders inline. If it does not, note the file type |
| R27 | In Contact Log, click Log note, write a note, save | The note appears in the Notes panel immediately, and in History Log / Timeline |
| R28 | Click Add task, create one due tomorrow | It appears under Tasks |
| R29 | Click Add reminder, set one for tomorrow | It appears under Reminders. Note whether anything tells you where a fired reminder will show up. This is a known open question, so "nothing tells me" is the expected answer |
| R30 | Click Flag, then go to the candidate list | The flag is visible in the list. Unflag it and confirm it clears |
| R31 | Click Next | You move to the next candidate in your filtered list, not an arbitrary one |

### 3.5 Intake

| # | Do this | Expect |
| :---- | :---- | :---- |
| R32 | Look at the Intake item in the navigation bar | If items are awaiting review, a count is shown on it |
| R33 | Click Intake | A queue of inbound items with their channel and status |
| R34 | Paste several LinkedIn profile URLs at once into the batch field | One row is created per URL, and the count on the Intake nav item goes up without a reload |
| R35 | Pick a candidate item and try to import it without grading | You cannot. A 1-3 star grade and a comment are required first |
| R36 | Grade it and import | A candidate record is created with the status, grade, source, sourcer and initial date you set |
| R37 | Paste a URL for someone already in the system | The item is flagged as a probable duplicate and names the existing person |
| R38 | Reject an item | A reason is required. After rejecting, the item is still findable rather than gone |
| R39 | Open an item that came from the careers form and try to change the applicant's name | You cannot. Grading and routing are still available. This is intended |
| R40 | Import a spreadsheet of candidates | You are offered column mapping, then a preview before anything is written. Note any column the mapper cannot handle |

### 3.6 Search

| # | Do this | Expect |
| :---- | :---- | :---- |
| R41 | Use Quick Search for a candidate you know by surname | The person is found |
| R42 | Use Candidate Keywords for a skill you search for often | Results are relevant. Note if resume text is not being searched |
| R43 | Judgement call | Is this at least as good as your Taleo search? If not, say precisely what is missing. Search is the most common reason people go back to the old system |

## 4. BD script: CRM

### 4.1 Accounts

| # | Do this | Expect |
| :---- | :---- | :---- |
| B1 | Sign in and click Accounts | A list headed "Accounts: Home" with a filter rail |
| B2 | Filter by a segment you use, click Go! | Only matching accounts remain |
| B3 | Click an account name | The record opens with Details, Contacts (n), Open deals (n), Requisitions (n) and Activity sections |
| B4 | Check the counts in those section headers against what you expect for that account | Note any count that is wrong. A wrong count here is worse than a missing feature, because it looks authoritative |
| B5 | Expand Activity | Panels for Notes, Calls, Meetings, Events and Emails |
| B6 | Click + Note, write one, save | It appears in Notes immediately |
| B7 | Click + Call, log a call | It appears in Calls |
| B8 | Click + Task and + Reminder | Both are created and visible |
| B9 | Click Export CSV and open the file | The rows match the filtered list on screen |

### 4.2 Contacts

| # | Do this | Expect |
| :---- | :---- | :---- |
| B10 | Click Contacts, open one | Person Details, Contact Profile and Engagement sections, with Notes, Calls, Meetings, Events, Emails, Tasks, Reminders and Files panels |
| B11 | Use the quick-add controls to add a note and a task | Both appear without a reload |
| B12 | Confirm the contact's account is linked and clickable | It takes you to that account |
| B13 | Judgement call | Is anything you rely on daily missing from this record? |

### 4.3 Deals

| # | Do this | Expect |
| :---- | :---- | :---- |
| B14 | Click Deals | A kanban board with a column per stage, and a Table toggle |
| B15 | Count cards on the board, switch to Table, count rows | The same number both ways |
| B16 | **Drag** a deal from one stage to the next | It lands and stays. No reload |
| B17 | Reload | The deal is still in the new stage |
| B18 | Open that deal and find its timeline | The stage change is recorded |
| B19 | Drag a deal to Lost | A lost reason is required and you cannot complete the move without one |
| B20 | Enter a reason and confirm | The move completes and the reason is on the record |
| B21 | Drag a deal to Won | It completes without asking for a reason |
| B22 | With the board open in one window, have a colleague move a deal in another | Your board updates on its own, without a reload |

### 4.4 Boundaries

| # | Do this | Expect |
| :---- | :---- | :---- |
| B23 | Look for candidate data anywhere in your session: navigation, search, activity timelines | You should find none. If you can see a candidate's name, resume or emails, **stop and report immediately** |
| B24 | Click Tickets | A read-only list. New Ticket is visibly unavailable, and the empty state explains tickets arrive with the CS module |
| B25 | Try Quick Search for a candidate surname you happen to know | No candidate results |

### 4.5 Cross-module

| # | Do this | Expect |
| :---- | :---- | :---- |
| B26 | Ask a recruiter to move a candidate to Hired for one of your accounts and accept the promotion | A contact appears against the right account, with no duplicate person |
| B27 | Open that contact | The account is pre-filled from the requisition, not blank |

## 5. Google integration

Not automatable, and the least verified part of the system. Run these on a real account.

| # | Do this | Expect |
| :---- | :---- | :---- |
| G1 | Connect your Google account from Settings | A green connected status |
| G2 | From a contact record, compose an email using a template and send it | It arrives, from your own address, and appears in that contact's Emails panel |
| G3 | Reply from your normal mail client | The reply appears on the same record, threaded, not as a separate item |
| G4 | From a record, schedule a meeting | A real calendar event with a Meet link, and a meeting activity on the record |
| G5 | Move that event in Google Calendar | The record updates. **One** meeting activity, not two |
| G6 | Cancel the event | The record reflects the cancellation |
| G7 | Label an inbound email with the intake label | It appears in the Intake queue as an email-channel item, with the attachment staged |
| G8 | Revoke access in your Google account settings | The status turns red and you are prompted to reconnect. Nobody else's connection is affected |
| G9 | Reconnect | Sync resumes without duplicating anything already recorded |

## 6. Exit criteria

Gate 5 passes when all of the following hold.

1. No fail on any step marked **stop and report**: B23, and any step where one role sees another's data.
2. No fail on the mandatory-reason steps: R19, B19.
3. No fail on the drag steps: R16, R17, B16, B17. Drag and drop is the requirement John raised specifically and it is the one thing no automated test covers.
4. Both testers answer yes to: could you do a full working day in this system without going back to Taleo or Zoho?
5. Every remaining fail is logged with a severity and either fixed or accepted in writing by John.
6. The four success metrics show real figures rather than "Not measured", which requires the cost inputs to be entered.

Point 6 is the one most likely to be forgotten. The metrics are instrumented but `dash.cost_inputs` carries no amounts, so cost reads "Not measured" until an admin enters the monthly figure for Oracle Taleo, Zoho Recruit, Zoho CRM and VentVest FOOS. Those figures are recorded nowhere in this repository and have to come from the contracts.

## 7. Known-open items testers will notice

Tell testers these are known, so they do not spend time writing them up.

| What they will see | Why |
| :---- | :---- |
| A fired reminder goes nowhere visible | QA-007, open product decision |
| Some toolbar controls are visibly unavailable | Placeholders for modules not in this phase, deliberately disabled rather than hidden, so the Taleo layout is preserved |
| Tickets are read-only | Arrives with the CS module |
| Cost metrics read "Not measured" | No contract figures have been entered |
| Star grades are 1-3, not 1-5 | Matches the existing grading scheme, not a bug |
