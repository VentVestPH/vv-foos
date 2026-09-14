# VV-FOOS Documentation Index

**Project:** VentVest Front Office OS (VV-FOOS) · **Last updated:** 2026-09-14

Documentation for the FOOS CRM and ATS programme. Every claim is marked as measured, verified live, or estimated. Where a document contradicts an earlier one, the newer measurement wins and the discrepancy is recorded rather than quietly corrected.

## Settled decisions, so they are not relitigated

| Item | Decision | Date |
| :---- | :---- | :---- |
| Host | **Cloudflare Pages**, static assets only. Vercel is not used and `vercel.json` is deleted | 2026-09-14 |
| Supabase plan | **Pro** | 2026-09-14 |
| Environments | **Two, and only two.** A developer's local stack, and the Cloudflare Pages site on the existing project `hilieyehhecrlccdveta` (Singapore). No develop project, no staging, no preview environment | 2026-09-14 |
| Frontend | `foos_redesign_2` is the only tree anyone changes. The two siblings are archived | 2026-09-02 |

## Start here

| If you want | Read |
| :---- | :---- |
| What exists today and what is missing | `05-reference/` System State and Inventory |
| What is left to do | `03-plan/` the improvement plan, workstream table |
| How to deploy, and what must be set in the Supabase Dashboard | `07-environments/` the cutover runbook |
| Why CI failed and how to write a test that does not | `05-reference/` the CI runbook |
| How the Zoho migration and the Singapore move went | `07-environments/` the migration record |
| What changed in a recent UI pass | `06-ux-and-motion/` the pass records |
| The script for user acceptance testing | `09-uat/` |

## Folders

| Folder | Holds |
| :---- | :---- |
| `03-plan/` | The improvement plan and its workstream table, the goals document, the parked and blocked register, and the `goal-armed/` brief for Goal 6 |
| `05-reference/` | Reference material that stays true: the CI runbook |
| `06-ux-and-motion/` | Records of each UI pass, written after the work |
| `07-environments/` | Local development, the cutover runbook, the Zoho and Singapore migration record |
| `09-uat/` | The acceptance script |

## What was removed on 2026-09-14, and why

Eight folders and 46 files were deleted in two passes. All of them are the working papers of workstreams that are complete, or were superseded by a document that measures the same thing more recently. **Everything is recoverable from git history**; nothing was archived to another directory because git is the archive.

| Removed | Reason |
| :---- | :---- |
| `03-plan/` workstream V and W goal documents | V is 13 of 13, W is 24 of 24 |
| `03-plan/goal-armed/` briefs for goals 1 to 5 and 7 to 11 | Those goals are complete, so the brief can never usefully be armed again. `goal-6.md` and `_always.md` remain |
| `05-reference/` Drive source index | The Drive pull finished on 2026-09-09 |
| `01-current-state/` | Superseded. The inventory is now `05-reference/`, and the defect register is `tests/DEFECT_LOG.md` |
| `02-taleo-fidelity/` | Workstream C is 17 of 17 |
| `04-research/` | One-off research whose conclusions are absorbed into the plan |
| `06-notes/` | A single session note, superseded by the second brain |
| `08-performance/` | Workstream K is 12 of 12 |
| `10-discovery/` | Screen-by-screen discovery, superseded by the product |
| `11-component-audit/` | Workstream V is 13 of 13 |
| `12-full-audit/` | Goal 5 is complete, and its remaining-work list was stale |

## Naming

`VVPH_<ProjectCode>_<DocType>_<Descriptive-Name>_v<major.minor>.<ext>`

**The version is enough.** Status and date do not belong in a filename: both change, and renaming a file to record that breaks every reference to it. They live in the document's metadata table instead. Files created before 2026-09-14 still carry `_<date>_<Status>` and are left alone rather than renamed, because the cross-references between them cite the full filename.
