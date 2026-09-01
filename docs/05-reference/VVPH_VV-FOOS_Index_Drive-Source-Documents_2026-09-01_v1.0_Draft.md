# Drive Source Document Index

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft · **Source folder:** `1H8kOfVezRa1EUGGqX7kcyNfEAndkaJ27`

Every file in the shared Drive folder, with what it is authoritative for. All 22 markdown documents, the workbook and all six CSVs were read in full on 2026-09-01. Re-checked the same day: no files added or modified since.

## Authority order

When two documents disagree, this is the precedence to apply:

1. `Arch_Master-Architecture` for schema, entities, stage sets, events and the RLS matrix. Locked at Gate 1; modules may not change it unilaterally.
2. The 26 Taleo screenshots for visual questions. The redesign prompt states them as the visual source of truth.
3. `Prompt_Taleo-Exact-UI-Redesign` for UI implementation detail, except where its starting token values conflict with the screenshots.
4. `Plan_FOOS-Delivery-Plan` v1.3 for delivery status and gates. Supersedes v1.0, v1.1 and v1.2.
5. The existing application code for what actually works today. The prompt states this explicitly.

Known unresolved conflict: architecture section 7 requires capping long table text with expand-on-click, redesign prompt section 7.4 requires full wrapping. See F10 in the fidelity audit.

## Claude Delivery Reports

| Document | Authoritative for |
| :---- | :---- |
| `Doc_Project-Instructions_2026-07-11_v1.0` | Working rules, VVPH ISO naming, writing style, PII confidentiality, approval gates |
| `Report_Taleo-ATS-Reverse-Engineering_2026-07-11_v1.0` | Taleo information architecture, four screen archetypes, estimated tokens, per-screen field inventory, keep/modernize/drop calls |
| `Report_Platform-Options_2026-07-11_v1.0` | The six-platform comparison behind the stack decision. Does not include Microsoft Dynamics |
| `Arch_Master-Architecture_2026-07-11_v1.0` | Gate 1 contracts. The single most authoritative document |
| `Plan_FOOS-Delivery-Plan_2026-07-11_v1.0` | Superseded, platform was Base44 |
| `Plan_FOOS-Delivery-Plan_2026-07-11_v1.1` | Superseded, records the same-day platform reversal to Claude Code plus Supabase |
| `Plan_FOOS-Delivery-Plan_2026-07-25_v1.2` | Superseded |
| `Plan_FOOS-Delivery-Plan_2026-07-25_v1.3` | **Current plan.** Phases, gates, per-track build status, open items |
| `Prompt_Taleo-Exact-UI-Redesign_2026-07-25_v1.0` | UI replication requirements, screenshot index, token targets, route-by-route map, QA matrix |
| `Report_Taleo-Redesign-Delivery_2026-07-25_v1.0` | What the replica actually did, route status, placeholder inventory, and the visual-check gap now closed |
| `Report_Gate-4-Exit_2026-07-25_v1.0` | QA pass rates, defects by severity, metric instrumentation status, conditional go |
| `Plan_Zoho-Recruit-Candidate-Migration_2026-07-25_v1.0` | Migration decisions, schema expansion DDL, transform and import design, reconciliation report |
| `Xlsx_Zoho-Recruit-Candidate-Field-Mapping_2026-07-25_v1.0` | Field-by-field mapping for 110 candidate, 15 attachment and 21 note fields, with fill rates and 15 schema-gap decisions |

## Agent Briefs

Each brief carries role and context, deliverables, data models, integration points, business rules and acceptance criteria. They are the contract for what each module was built to do, and the source of the 91 criteria the QA pass traced.

| Brief | Module |
| :---- | :---- |
| `Brief_Agent-1-Schema-Backend` | Schema, RLS, triggers, sequences, storage, seeds, pgTAP |
| `Brief_Agent-2-ATS-Module` | Requisitions, candidates, application pipeline, unviewed counters, saved views |
| `Brief_Agent-3-CRM-Module` | Companies, contacts, deals, tickets stub, promotion receiver |
| `Brief_Agent-4-Careers-Page` | Public listing, apply form, SEO, rate-limited intake function |
| `Brief_Agent-5-Intake` | Unified intake queue, four channels, dedup, grading, atomic import |
| `Brief_Agent-6-Gmail-Calendar` | OAuth, sync, send, create-meeting, label watch |
| `Brief_Agent-7-Dashboards` | Five dashboards, `dash` schema, experiment-metrics panel |
| `Brief_Agent-8-QA` | Test suite, re-test matrix, defect log, Gate 4 exit |
| `Doc_Google-OAuth-Setup_2026-07-25_v1.0` | Manual Google Cloud steps and the four required Supabase function secrets |

## Oracle Taleo Screenshots

26 PNGs. Reading them through Drive returns OCR text rather than pixels, which is useful for verifying labels, navigation order and section names, and is how the label fidelity in this audit was checked.

| Files | Covers |
| :---- | :---- |
| 01 | Master shell reference: utility header, nav, sidebar, dashboard accordions |
| 02, 03, 04, 05 | Calendar states: 1-day, 7-day, 31-day, detailed day. **Currently unused, see F2 and F3** |
| 06 | Pipeline accordion composition |
| 07 to 15 | Entity home pages: requisitions, candidates, accounts, contacts, employees, onboard, users, reports, courses |
| 16, 17 | New-requisition form, upper and lower |
| 18, 18 (dup name), 20, 21 | Requisition record sequence |
| 22 to 26 | Candidate record sequence |

Note that two files are both named `18_Taleo_Req_List_*`, so the requisition record sequence is 18, 18, 20, 21 rather than 18 to 21. The redesign prompt reproduces this numbering quirk.

## Zoho Exports

| File | Rows | State |
| :---- | :---- | :---- |
| `Candidates_001.csv` | 75 | 110 columns, 49 entirely empty. Migrated |
| `Notes_001.csv` | 154 | 21 columns, 7 empty. Migrated to activities |
| `Attachments_001.csv` | 50 | `Attachment URL` blank on every row, so no file bytes. Metadata migrated |
| `Attachment Category_001.csv` | 8 | Resume, Formatted Resume, Cover Letter, Others, Offer, Contracts, LinkedIn Profile, Email LinkedIn Profile |
| `Candidates_Educational_Details.csv` | 0 | Header only. **Needs re-export** |
| `Candidates_Experience_Details.csv` | 0 | Header only, byte-identical to the education file. **Needs re-export** |

Still outstanding from Zoho: all of Zoho CRM (clients and accounts), Zoho Recruit job openings, the two related-list re-exports above, and a bulk attachment file download.

## foos_redesign_2

A copy of the application repository including `node_modules` and `dist`. Verified byte-for-byte identical to the local working tree on 13 sampled files. No independent value; the local tree is the one to work in.
