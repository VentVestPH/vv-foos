# Drive Document Review and Meeting Reconciliation

**Project:** VentVest Front Office OS (VV-FOOS) · **Prepared for:** John Buena · **Prepared by:** Klent Roel Zarsuela · **Date:** 2026-09-01 · v1.0 Draft

Scope: a line-by-line read of every document in the shared Drive folder, plus all six Zoho CSV exports, reconciled against the live Supabase project and against the 2026-09-01 meeting summary. Findings are separated into information received (what the documents and the meeting state) and analysis (what was independently verified, and what turned out to be wrong).

Confidentiality: the Zoho exports contain candidate PII. Per the QA brief's rule of engagement, migration records are referenced here by field value and count only, never by name or contact detail.

## 1. Method

Every markdown document, the field-mapping workbook, and all six CSV exports were read in full. Claims that could be checked were checked against the live Supabase project (`mebfbbvrqdctamnzvbbs`) through the REST API using a real signed-in admin session, and against the local `/Users/klentz/Work/VV-FoOS` working tree. Two items were not opened byte-for-byte, and both are stated with the reason:

- The `foos_redesign_2/` folder in Drive is a copy of the local working tree. Thirteen files were size-compared against local equivalents (`package-lock.json`, `package.json`, `README.md`, `app/package.json`, `app/README-APP.md`, `app/tsconfig.json`, `app/index.html`, `app/vite.config.ts`, `app/.env`, both `.env.example` files, both `.gitignore` files). All thirteen match exactly, so the Drive copy is the same tree that was read locally, `node_modules/` and `dist/` included.
- The 26 Taleo PNGs were inventoried but not opened as images. Their content is indexed screenshot-by-screenshot in the redesign prompt and mapped route-by-route in the redesign delivery report, both read in full. Opening them is only useful beside the running application, which is the outstanding visual-QA task described in section 5.

## 2. Document inventory

### 2.1 Claude Delivery Reports (13 files)

| Document | Date | Content |
| :---- | :---- | :---- |
| `Doc_Project-Instructions_v1.0` | 2026-07-11 | Working rules consolidated from nine prior projects: architect-first, agent-brief decomposition, approval gates, decision journal, VVPH ISO naming, five UX pillars, anti-slop writing rules, PII confidentiality |
| `Report_Taleo-ATS-Reverse-Engineering_v1.0` | 2026-07-11 | 26 screenshots reverse-engineered: information architecture, four screen archetypes, estimated design tokens, per-screen field inventory, 14 inferred entities, two-track status model, keep/modernize/drop recommendations |
| `Report_Platform-Options_v1.0` | 2026-07-11 | Six-platform comparison: Base44, Lovable+Supabase, Bubble, Softr+Airtable, Retool, Zoho One. Recommends owned Postgres on exit-story grounds |
| `Arch_Master-Architecture_v1.0` | 2026-07-11 | Gate 1 contracts: 24 tables, one-Person model with profile extensions, five locked stage sets, UUID plus display-code IDs, 10-event taxonomy, 4-role RLS matrix, module boundaries, design tokens |
| `Plan_FOOS-Delivery-Plan_v1.0` | 2026-07-11 | Seven phases, seven gates. Platform: Base44 |
| `Plan_FOOS-Delivery-Plan_v1.1` | 2026-07-11 | Platform reversed to Claude Code + Supabase, same day, superseding v1.0 |
| `Plan_FOOS-Delivery-Plan_v1.2` | 2026-07-25 | Brought in line with repo state. Gates 1 and 2 confirmed retroactively. Phase 3 at five of eight tracks |
| `Plan_FOOS-Delivery-Plan_v1.3` | 2026-07-25 | All eight tracks built. Phase 3 content-complete. Gate 4 conditional go. Current authoritative plan |
| `Report_Taleo-Redesign-Delivery_v1.0` | 2026-07-25 | Taleo-exact UI replica delivered as `foos_redesign_2` on port 5175. Route-by-route status, FOOS-TBD placeholder inventory, one honest gap |
| `Report_Gate-4-Exit_v1.0` | 2026-07-25 | QA pass: 91 criteria (46 pass, 1 fail, 32 traced, 12 gap), defects by severity, metric instrumentation status, conditional go |
| `Plan_Zoho-Recruit-Candidate-Migration_v1.0` | 2026-07-25 | Schema expansion, transform script, import script, reconciliation report. Status recorded as complete |
| `Xlsx_Zoho-Recruit-Candidate-Field-Mapping_v1.0` | 2026-07-25 | All 110 candidate fields, 15 attachment fields, 21 note fields, with fill rates, proposed targets and 15 schema-gap decisions |

### 2.2 Agent Briefs (9 files)

Eight numbered specialist briefs plus one setup document, all dated 2026-07-11 except the last:

| Brief | Owns |
| :---- | :---- |
| Agent 1, Schema/Backend | Supabase project, Postgres schema, RLS, triggers, sequences, storage, seeds, pgTAP suite |
| Agent 2, ATS Module | Requisitions, candidate lists and records, application pipeline (table and kanban), unviewed counters, saved views |
| Agent 3, CRM Module | Companies, contacts, deals (list and kanban), tickets stub, hired-to-contact promotion receiver |
| Agent 4, Careers Page | Public listing, role detail with SEO and JobPosting structured data, apply form, rate-limited intake Edge Function |
| Agent 5, Intake Module | Unified `intake_items` queue, four channels, dedup, grading, atomic import |
| Agent 6, Gmail + Calendar | Per-staff OAuth with incremental consent, thread and event sync, send, create-meeting-with-Meet, label watch |
| Agent 7, Dashboards | Exactly five dashboards plus an admin-only experiment-metrics panel, `dash` schema of security-invoker views |
| Agent 8, QA | Test suite, re-test matrix, defect log, Gate 4 exit recommendation |
| `Doc_Google-OAuth-Setup_v1.0` (2026-07-25) | Manual Google Cloud steps that cannot be automated, and the four Supabase function secrets required |

### 2.3 Zoho Exports (6 CSVs, read in full)

| File | Rows | Columns | State |
| :---- | :---- | :---- | :---- |
| `Candidates_001.csv` | 75 | 110 | 49 columns are entirely empty |
| `Notes_001.csv` | 154 | 21 | 7 columns entirely empty |
| `Attachments_001.csv` | 50 | 15 | `Attachment URL` blank on every row |
| `Attachment Category_001.csv` | 8 | 5 | Complete |
| `Candidates_Educational_Details.csv` | 0 | 3 | Header only |
| `Candidates_Experience_Details.csv` | 0 | 3 | Header only, byte-identical to the education file |

### 2.4 Other folder contents

`Oracle Taleo Screenshots/`: 26 PNGs, 01 through 26, covering the shell, six dashboard states, nine entity home pages, the two-part new-requisition form, the four-part requisition record and the five-part candidate record. `foos_redesign_2/`: full copy of the application repository.

## 3. Information received: what the documents establish

The project replaces Oracle Taleo Business Edition, Zoho Recruit and Zoho CRM with one self-built platform on VentVest-owned infrastructure. Decisions on record as of 2026-07-11: Claude Code plus Supabase; ATS and CRM built in parallel on one shared schema; one `people` table for every human with role data in profile extension tables; four RBAC roles enforced by Postgres row-level security; Google sign-in restricted to ventvest.com with email/password fallback; hard cutover per module; test data flagged `is_test` and purged before cutover.

Security is enforced in the database, not the interface. Role comes from `staff.role` resolved through `auth.uid()`, and the interface is stated repeatedly as a convenience layer rather than the boundary.

Four success metrics gate the cancellation of the three incumbent subscriptions: adoption, cycle time, cost, and data quality.

Delivery status per plan v1.3: Phases 0 through 3 complete, all eight agent tracks built, Gate 4 a conditional go with four open items. Phase 4's second half, the Taleo and Zoho CSV dry-run that measures dedup rate, completeness and grading-history preservation, has not started. Phase 5 user acceptance testing is blocked behind it, and Phase 5 is the stated cutover trigger.

## 4. Analysis: verification against the live system

Six discrepancies were found between the documents and the running system. Two are data loss.

### V1. Star grades were lost for every migrated candidate (High)

The migration plan decides Zoho `Rating` maps to `candidate_profiles.star_grade`. In `Candidates_001.csv`, `Rating` is populated on 37 of 75 rows: 27 values of "3.0" and 10 of "2.0". In the live database, all 75 imported candidates have `star_grade` null. The only graded rows are the 7 seed demo records. Three candidates were spot-checked individually (Zoho `Rating` of 2.0, 3.0 and 3.0); all three show `star_grade` null live while correctly carrying an "Amir Grade: ..." prefix in `grade_comment`. The `grade_comment` half of the mapping executed on 58 of 76 rows. The `star_grade` half did not execute at all.

Consequence: "grading history preserved" is one of the four success metrics gating subscription cancellation, and it currently measures zero for migrated data. The migration's own reconciliation report reports zero errors because it counted rows, not fields. Defect QA-008 already records that data-quality metrics are not instrumented, so no check was in place to catch this.

### V2. `Initial Date` was mis-parsed and partly dropped (Medium)

74 of 75 rows carry `Initial Date`; 44 landed in the live database. The source values use four inconsistent formats: `6/26`, `5/26`, `26-Jun`, `26-May`. Live, `6/26` became `2026-06-26`, reading a month and year as a month and day and inventing a day of month. `26-Jun` became null. The Taleo reverse-engineering report already described this field as carrying "one or two mm/yy values", so the ambiguity was documented before the import ran.

### V3. Two applied migrations are absent from the repository (High)

The Zoho plan records `add_offer_attachment_kind` and `zoho_candidate_migration_schema_expansion` as applied to production on 2026-07-25. Those changes are confirmed live: `people.street`, `people.experience`, `candidate_profiles.expected_salary`, `candidate_profiles.current_salary`, `candidate_profiles.salary_currency`, `candidate_profiles.assessment_scores` and `attachments.file_size_bytes` all return values, and `candidate_statuses` holds 18 rows against the repository seed's 4.

No file in `supabase/migrations/` contains any of it. `20260711000002_enums.sql:22` still declares `attachment_kind` as `('resume', 'cover', 'contract', 'other')` without `'offer'`. `zoho_id_map` appears in no migration. A follow-up migration named in the Agent 6 documentation, `agent6_google_status_and_disconnect_rpcs`, is missing the same way.

`app/src/lib/database.types.ts` has been updated with all seven columns and the `offer` value. So the TypeScript contract and production agree with each other, and the migrations disagree with both. `supabase db reset` from this repository produces a schema the application's own types contradict, and the Zoho import is not reproducible from source control.

### V4. One Zoho source value cannot have matched by name (Low)

The value in `Candidates_001.csv` is `Digital Assistant - Facebook Messenger`. The row seeded live is `Digital Assistant - FB Messenger`. The field-mapping workbook contains both spellings in different tabs, which is where the error entered. One candidate carries this source and one live row shows the abbreviated form, so the row resolved, but the plan's claim of zero unresolved source lookups rests on a string absent from the source data.

### V5. `Amir Grade` is prose, not a number (documentation error)

The workbook lists `Amir Grade` with sample value "1", and the migration plan reasons from that sample when deciding which field drives `star_grade`. The field actually contains 25 rows of long-form recruiter assessment text with star grades embedded in the prose, including gradations of `2*`, `3*`, `3-*` and `3*+` that are finer than `Rating`'s two values. The resulting decision, folding it into `grade_comment`, is correct. The reasoning behind it was based on a wrong sample, and given V1 that prose is now the only surviving grading signal.

### V6. A field the plan says is absent is present (documentation error)

The migration plan states the candidates export "has no `Higher Degrees` column at all". The column exists and is populated on one row. The workbook recorded it correctly at 1% fill.

### Confirmed correct

| Check | Documented | Live |
| :---- | :---- | :---- |
| Candidates imported | 75 | 75; 86 people total, 76 non-test |
| Attachments imported | 50, all placeholder paths | 50, all 50 prefixed `pending-file-export/` |
| Notes converted to activities | 154: inmail 51, email 43, call 30, meeting 23, note 7 | Matches exactly |
| `candidate_statuses` | 18 rows | 18 |
| `sources` | 12 rows | 12 |
| Candidate status values in export | 17 distinct | 17 confirmed by direct count |
| Education and Experience export gap | Linking columns only | Confirmed, zero data rows in both |
| Attachment file bytes | Not exported | Confirmed, `Attachment URL` blank on all 50 rows |

### Data-state note

The live project now holds 76 non-test people with real PII, 154 activity records containing candid recruiter assessments, and attachment metadata referencing identity and tax documents. The four demo sign-in accounts share one password committed in plaintext at `tests/fixtures/personas.sql`, tracked as defect QA-003 and not yet rotated. The admin demo account reads all of it. That combination is the highest-exposure item in the project as it stands, and it changes character now that real records are present rather than seed data.

## 5. Meeting notes reconciliation (2026-09-01)

The meeting summary was machine-transcribed and contains details that conflict with the documents or with the running system. Items are graded by what the evidence supports.

### 5.1 Confirmed by the documents

| Meeting statement | Corroboration |
| :---- | :---- |
| Moving off Zoho and Oracle for ATS and CRM | The project's founding premise, stated in every plan version |
| New platform is a centralised repository for both candidates and clients, replacing Excel | Matches the one-`people`-table architecture and the shared `companies` table |
| Must hold names, emails, LinkedIn profiles, addresses, status updates | All four exist as fields. See 5.4 on addresses |
| Mirror the legacy Oracle interface, clean layout, minimal clicking | Delivered in July as `foos_redesign_2`, the Taleo-exact replica on port 5175 |
| October or earlier completion target | Consistent with the plan's 2026-10-11 platform-decision review date |

### 5.2 Contradicted by the evidence

**"The legacy Oracle interface utilised drag-and-drop features."** Taleo had no drag-and-drop. The reverse-engineering report describes its pipeline as "a page of accordions" and lists kanban under Modernize as a FOOS addition: "Taleo's pipeline is a page of accordions; recruiters think in stage columns." This works in the project's favour, because drag-and-drop already exists in FOOS on the application pipeline and the deals board via `@dnd-kit`, and the Taleo re-skin preserved both. The risk is promising Oracle parity and drag-and-drop as if they were the same requirement, since they pull in opposite directions.

**"Export candidates, clients, and job opening data from Zoho."** The candidate export is done and already migrated: 75 candidates, 50 attachment records and 154 notes are live. The migration plan explicitly scoped everything else out: "Zoho Recruit's other entities and all of Zoho CRM are out of scope here." The outstanding work is clients and job openings only. Most likely the transcript compressed a statement about the remaining data.

**Microsoft Dynamics was never one of the evaluated options.** The platform-options report compares Base44, Lovable+Supabase, Bubble, Softr+Airtable, Retool and Zoho One. Dynamics Business Central, Power Pages and Power Platform appear nowhere in it, nor in any decision record. The $116 figure is therefore being weighed against a comparison that never included it, and against a system that is already built.

### 5.3 Internally inconsistent in the summary, needs confirmation

- The cost figure is attributed twice to different things: the header says "$116 per user monthly for specialized services" for Business Central implementation, the detail says "$116 per user per month for Power Pages and Power Platform services". Business Central and Power Platform are separately licensed products. One figure cannot describe both. Treat $116 as unverified until checked against Microsoft's published pricing.
- The deadline appears as both "this Friday or Saturday" in the detail and "by Friday" in the next steps. Friday is 2026-09-04.
- Work schedule appears as both "offshore team support is needed for Australia time at 7:00 a.m." and "not required to adhere to a strict daily schedule ... may log in at any time". The recorded decision is the flexible 40-hour week. The 7:00 a.m. reference needs clarifying as a coverage expectation or a dropped qualifier.
- "The current contract concludes on November 21" does not say whose contract. Whether this is the Zoho or Oracle subscription term or the engagement term changes the entire schedule, because one sets a deadline for cancellation and the other sets a deadline for handover.
- "Zoho was four times cheaper than Oracle" is plausible but appears in no document and is not independently verifiable here.

### 5.4 Correct in intent, with a caveat

**"Remove unused fields like current or expected salary in certain views."** Safe as a view change. Note that `expected_salary` and `current_salary` were added to `candidate_profiles` in July specifically to receive Zoho data, and are 13% and 15% filled. Hide them in list views; keep the columns. Deleting them discards real data.

This instruction also contradicts the redesign prompt in writing, which states "Do not delete implemented FOOS fields merely because Taleo lacks them" and forbids "improving Taleo's density by removing fields or controls". The new instruction supersedes the prompt, and that supersession should be recorded so the next implementer does not meet two contradictory written rules.

**"Maintain addresses."** Three of the four listed data types survived the migration well: email 99% filled, LinkedIn 85%, status 100%. Addresses did not. Street is 1% filled, city 31%, province 13%, postal code 1%. The fields exist; the data does not. This is a data-collection gap, not a build gap.

## 6. Cost comparison for the Friday recommendation

Basis: 12 users, taken from the Taleo Users list in the reverse-engineering report. The Dynamics figure is as quoted in the meeting and is not verified.

| Option | Per month | Per year, 12 users |
| :---- | :---- | :---- |
| Dynamics BC plus Power Platform, as quoted | $116 per user | ~$16,700 |
| FOOS as it runs today | ~$25 total (Supabase Pro) | ~$300 |
| Zoho One, all-employee tier | ~$37 per user | ~$5,300 |

The relevant comparison is not two greenfield options. FOOS has eight built modules, the Zoho candidate data already migrated, and the Taleo-replica interface delivered. Reaching the same functional position on Dynamics is a fresh implementation on top of the licence cost.

## 7. Schedule analysis

Today is Tuesday 2026-09-01. Contract end 2026-11-21 is 81 days out, 11.6 weeks.

The delivery plan gates subscription cancellation on a 30-day post-cutover measurement window (Phase 6, Gate 6). That constrains the cutover date more tightly than the October target implies:

| Cutover date | Measurement window ends | Inside 2026-11-21 |
| :---- | :---- | :---- |
| 2026-10-01 | 2026-10-31 | Yes |
| 2026-10-15 | 2026-11-14 | Yes |
| 2026-10-20 | 2026-11-19 | Yes, with two days spare |
| 2026-10-31 | 2026-11-30 | No |

"October or earlier" only holds if it means early to mid October. Two full gates sit between today and cutover: Gate 4's unstarted CSV dry-run half, and Gate 5 user acceptance testing by a recruiter for ATS and a BD representative for CRM.

## 8. Outstanding items

### 8.1 Carried forward from the Gate 4 exit report, still open

1. Sign off or override the QA-002 severity downgrade. `careers_rate_limit` has row-level security disabled. The QA brief makes every RLS finding Critical by default and forbids downgrading one without explicit sign-off.
2. Build the four real success metrics (QA-008) before the Phase 6 measurement window opens.
3. Decide whether `reminder.due` needs an interface (QA-007) or was an intentional scope cut.
4. Run the regression checklist and the three Playwright specs on a machine with normal permissions. 32 of 91 criteria are traced rather than independently re-verified, and the browser specs have never executed anywhere.

### 8.2 Raised by this review

5. Restore `star_grade` for the 75 migrated candidates from the `Rating` column (V1).
6. Re-parse `Initial Date` for the 30 dropped rows and correct the 44 that carry an invented day of month (V2).
7. Write the two missing migration files to match production, plus the Agent 6 RPC migration (V3). Until this is done the production schema cannot be rebuilt from source control, which matters most if 2026-11-21 is a handover date.
8. Reconcile the `Digital Assistant` source-name spelling (V4).

### 8.3 Zoho export session, to be done in one pass

9. Clients and accounts (Zoho CRM, entirely unmigrated).
10. Job openings and requisitions (Zoho Recruit, out of the July scope).
11. Education Details, re-exported with its full field set. `people.education` is ready to receive it.
12. Experience Details, re-exported with its full field set. `people.experience` was added in July for this purpose and is currently empty on every row.
13. Bulk attachment file download, matched back to the 50 metadata rows by Attachment Id or File Name, replacing the `pending-file-export/` placeholders.

### 8.4 Interface work from the meeting

14. Visual pass of all 14 routes in the redesign QA matrix against their reference screenshots at 2560 × 1600. This is the redesign delivery report's one declared gap: the previous environment could not launch a browser. The current machine can.
15. Apply the field-trimming and click-reduction notes, recording the supersession of the redesign prompt's no-field-removal rule.

## 9. Recommended sequence

1. Before Friday 2026-09-04: the cost and capability comparison in section 6, with the Dynamics figure verified against Microsoft's published pricing rather than the transcript.
2. This week: items 5, 6 and 7. Lost grading data and an unreproducible schema are the two findings that get more expensive the longer they sit, and both are small pieces of work.
3. This week: the single Zoho export session covering items 9 through 13.
4. Next: item 14, then item 15.
5. Before any cutover: Gate 4's CSV dry-run half, then Gate 5.

## 10. Sources

All documents read from the shared Drive folder `1H8kOfVezRa1EUGGqX7kcyNfEAndkaJ27` on 2026-09-01: 12 markdown documents and 1 workbook in `Claude Delivery Reports/`, 9 markdown documents in `Agent Briefs/`, 6 CSV files in `Zoho Exports/ExportData/`, 26 PNG files inventoried in `Oracle Taleo Screenshots/`, and the `foos_redesign_2/` repository copy.

Live verification performed against Supabase project `mebfbbvrqdctamnzvbbs` via authenticated REST API calls on 2026-09-01. Local verification against the working tree at `/Users/klentz/Work/VV-FoOS`.

Meeting summary of 2026-09-01, machine-transcribed, treated as an unverified source throughout section 5.
