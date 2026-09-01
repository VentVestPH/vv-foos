# VV-FOOS Documentation Index

**Project:** VentVest Front Office OS (VV-FOOS) · **Last updated:** 2026-09-01 (external research folded in)

Documentation for the FOOS CRM and ATS improvement programme. Project documents follow the VVPH ISO naming convention (`VVPH_<ProjectCode>_<DocType>_<Descriptive-Name>_<YYYY-MM-DD>_v<major.minor>_<Status>.<ext>`). Folders are numbered in reading order.

Everything here was produced on 2026-09-01 and is evidence-based: claims are marked as measured, verified live, or estimated. Where a document contradicts an earlier one, the newer measurement wins and the discrepancy is recorded rather than quietly corrected.

## Start here

| If you want | Read |
| :---- | :---- |
| The plan and the decisions needed | `03-plan/…Plan_CRM-ATS-Improvement…` |
| What is broken and how bad | `01-current-state/…Register_Defects-and-Risks…` |
| How close the UI is to Taleo | `02-taleo-fidelity/…Report_Taleo-Fidelity-Audit…` |
| What is documented about Taleo versus assumed | `04-research/…Report_External-Research-Findings…` |
| Exactly what to change, with values | `02-taleo-fidelity/…Spec_Taleo-Fidelity-Gap-Closure…` |
| Which icons Kappa uses, and whether to copy them | `04-research/…Report_Icon-Strategy-and-Kappa-Comparison…` |
| How to add polish without breaking the replica | `06-ux-and-motion/…Spec_UX-and-Motion-Discovery…` |
| How to run the app locally without touching live data | `07-environments/…Doc_Local-Development-Environment…` |
| What was measured and what got faster | `08-performance/…Report_Performance-Baseline-and-Optimisation…` |
| Which source document governs a question | `05-reference/…Index_Drive-Source-Documents…` |

## 01-current-state

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Report_System-Inventory-and-Verified-State_2026-09-01_v1.0_Draft.md` | Frontends, toolchain, routes, backend, live data counts, accounts, environment variables, and the settings no migration can apply |
| `VVPH_VV-FOOS_Report_Drive-Review-and-Meeting-Reconciliation_2026-09-01_v1.0_Draft.md` | Full read of every Drive document (22 files, the workbook, all six CSV exports), reconciled against the 2026-09-01 meeting summary. Grades each meeting claim as confirmed, contradicted, internally inconsistent, or correct-with-caveat |
| `VVPH_VV-FOOS_Register_Defects-and-Risks_2026-09-01_v1.0_Draft.md` | Gate 4 items carried forward, thirteen findings verified 2026-09-01, the QA-003 re-rating, and the environment blockers now cleared |

## 02-taleo-fidelity

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Report_Taleo-Fidelity-Audit_2026-09-01_v1.0_Draft.md` | The visual check the redesign delivery report left open. 20 routes captured at 2560 x 1600, DOM-measured against spec, 13 deviations, contrast ratios, accessibility results, placeholder inventory |
| `VVPH_VV-FOOS_Spec_Taleo-Fidelity-Gap-Closure_2026-09-01_v1.0_Draft.md` | Implementation detail for closing all 11, with computed replacement token values. Deltas only; it does not restate the Taleo design language |

## 03-plan

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Plan_CRM-ATS-Improvement_2026-09-01_v1.0_Draft.md` | Six workstreams, priority order by consequence of delay, a schedule bounded by the Gate 6 measurement window, six decisions needed from John, and explicit scope exclusions |

## 04-research

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Report_Icon-Strategy-and-Kappa-Comparison_2026-09-01_v1.0_Draft.md` | `lucide-react` 1.25.0 confirmed in Kappa with 801 import sites and 147 icons; coverage test against the 20 glyph roles FOOS needs; the Timeline emoji defect; a scoped adoption recommendation |
| `VVPH_VV-FOOS_Report_External-Research-Findings_2026-09-01_v1.0_Draft.md` | Cited external research, adversarially verified with three skeptical voters per claim. 11 findings with vote counts. Headline result: most Taleo UI specifics are undocumented outside your screenshots. Also found two defects the internal audit missed, and records the two angles that returned nothing |

## 06-ux-and-motion

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Spec_UX-and-Motion-Discovery_2026-09-01_v1.0_Draft.md` | Whole-application discovery (76 files, 13,792 lines) finding zero motion and zero reduced-motion handling; the three-category discipline that decides when motion diverges from Taleo and when it cannot; motion tokens with a 220ms ceiling; per-component specification; eight UX fixes needing no motion; and five verification checks |

## 07-environments

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Doc_Local-Development-Environment_2026-09-01_v1.0_Draft.md` | Running local Supabase, the 553xx port map and why it differs, what `config.toml` fixes permanently (QA-001), the verification results, and the dev-versus-production env split for Vercel or Fly |

## 08-performance

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Report_Performance-Baseline-and-Optimisation_2026-09-01_v1.0_Draft.md` | Sourcemap-attributed bundle composition, the code-splitting and webfont changes, before/after timings under throttling, remaining ceilings, and the four committed guard scripts |

## 05-reference

| Document | Contents |
| :---- | :---- |
| `VVPH_VV-FOOS_Index_Drive-Source-Documents_2026-09-01_v1.0_Draft.md` | All 22 Drive documents, the workbook, six CSVs and 26 screenshots, each with what it is authoritative for, plus the authority order to apply when two disagree |

## Related, outside this folder

| Path | Contents |
| :---- | :---- |
| `../README.md` | Setup, migration order, and the local validation loop |
| `../CLAUDE.md` | Repository guidance for future Claude Code sessions |

## Authority order

When documents conflict:

1. `Arch_Master-Architecture` (Drive) for schema, entities, stage sets, events, RLS. Locked at Gate 1.
2. The 26 Taleo screenshots for visual questions.
3. `Prompt_Taleo-Exact-UI-Redesign` for UI detail, except where its starting token values conflict with the screenshots.
4. `Plan_FOOS-Delivery-Plan` v1.3 for delivery status.
5. The application code for what works today.

Two known unresolved conflicts, both awaiting John: long-text capping versus wrapping, and the QA-002 severity call. Both are listed in the plan's decisions section.

A third source of authority was added on 2026-09-01: for questions about what Taleo *documents*, the Oracle sources cited in the external research report outrank the screenshots. For questions about what VentVest's own instance *looked like*, the screenshots remain primary. Most concrete UI specifics fall in the second category, which is why the screenshots cannot be discarded.

## Structure note

Folders here are numbered in reading order, with `03-plan` as the hub that references `04`, `05` and `06`. The sibling `Kappa-Omini-typescript` repository organises its 46 documents by taxonomy instead (`requirements`, `architecture`, `governance`, `codebase-review`, `engineering`, `reference`) with an `INDEX.md` at the root. That taxonomy scales better past roughly 20 documents. Realigning this tree to match is a straightforward move if consistency across the two VentVest repositories is worth more than reading order here.
