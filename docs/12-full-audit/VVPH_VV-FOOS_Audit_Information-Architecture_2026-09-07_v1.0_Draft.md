# Goal 3: information architecture, what to remove

**Project:** VV-FOOS · **Date:** 2026-09-07 · v1.0 Draft

Content, not controls. Which accordions, fields, columns and tabs are not needed, decided against the imported data: **72,917 candidate profiles, 86,133 applications, 690 requisitions, 212,496 activities.**

No candidate name, email, phone or free-text value appears below. Every figure is a count or a percentage.

## The headline, and it is a warning about the method

The brief calls fill rate "the best argument for removing a field that exists". **It is not sufficient on its own, and I nearly wrote a recommendation that would have deleted a field Taleo demonstrably populates.**

Thirteen fields the UI renders are filled in under 9% of records. **Nine of the thirteen were never written by the importer at all**, checked by grepping `migration/src/` for each column name. For those nine, 0% measures the migration, not the need:

| Field | Filled | of | Importer writes it? | What 0% actually means |
| :---- | ----: | ----: | :---- | :---- |
| `tenure_note` | **0** | 72,917 | **no** | unknown; never populated |
| `salary_flag` | **0** | 72,917 | **no** | unknown; never populated |
| `budget_status` | **0** | 690 | **no** | **Taleo shows it filled**, screenshot 18: `Budget Status: Budgeted` |
| `reason_for_opening` | **0** | 690 | **no** | **Taleo shows it filled**, screenshot 18: `Reason for Opening: New Position` |
| `replacement_for` | **0** | 690 | **no** | Taleo shows the label **with no value**, screenshot 18 |
| `pay_min` | 2 | 690 | **no** | the 2 are demo rows |
| `pay_max` | 2 | 690 | **no** | the 2 are demo rows |
| `next_step` | 6 | 86,133 | **no** | unknown; never populated |
| `rank` | 1 | 86,133 | **no** | unknown; never populated |
| `salary_currency` | **0** | 72,917 | yes | the Zoho export carried none |
| `current_employer` | **7** | 72,917 | yes | the Zoho export carried almost none |
| `current_salary` | 11 | 72,917 | yes | the Zoho export carried almost none |
| `filled_date` | **0** | 690 | yes | the Zoho export carried none |
| `employment_type` | 14 | 690 | yes | the Zoho export carried almost none |

**`budget_status` is the one that proves the point.** It is 0 of 690 in FOOS and visibly populated in VentVest's live Taleo. Recommending its removal on fill rate alone would have been a measurement correctly taken and an inference badly drawn.

So every verdict below carries two columns, not one: what the data says, and whether the importer could have filled it.

## Three fields where 0% is genuinely informative

Screenshot 18 shows VentVest's own requisition record with `Replacement for:` and `Filled date:` rendered as **labels with no value**. That is direct evidence those two are empty in their real Taleo as well, so their emptiness in FOOS is not a migration artefact. `filled_date` is additionally mapped by the importer and still 0, which agrees.

**And one where Taleo settles the design question outright.** Screenshot 18 renders pay as a single free-text line:

> `Pay range: $168K Base + $32K Bonus + Small Relocation ($15K) for [a named person]`

FOOS models pay as `pay_min`, `pay_max`, `pay_currency` **and** `pay_notes`. The structured three are filled in 2, 2 and 3 of 690. `pay_notes` is filled in **500 of 690, 72.46%**. So the free-text field FOOS inherited from Taleo is the one that gets used, and the three structured fields FOOS added as an improvement are the ones nobody fills, because the source system never had them. **Taleo is right here and the improvement is the thing to reconsider.**

## The candidate record: 17 accordions, 22 fields

The densest problem screen. V13 measured it at 3,241px over 4.31 viewports, **55.4% empty**.

| Field | Filled | Taleo shows it | Verdict |
| :---- | ----: | :---- | :---- |
| `Initial date` | **96.52%** | yes, `Initial Date` column, 08 | **Keep** |
| `Sourcer Grade (grade comment)` | **97.21%** | yes, `Sourcer Grade` column, 08 and 22 | **Keep**, and give it more room, see below |
| `Main status` | 100% | yes, `Main status`, 08 and 22 | **Keep** |
| `Do not contact` | 100% set | not seen | **Keep**, it is a compliance flag |
| `Expected salary` | 8.49% | not seen | **De-emphasise** |
| `Current title` | 4.89% | not as a column | **De-emphasise**, see the narrative-field finding |
| `Current employer` | **0.01%**, 7 rows | not as a column | **De-emphasise on the record, remove from the list** |
| `Current salary` | 0.02%, 11 rows | not seen | **De-emphasise** |
| `Tenure note` | **0%**, unmapped | not seen | **Defer**: nothing can be concluded yet |
| `Salary currency` | **0%**, mapped | not seen | **Remove the text input, make it a currency select**; it is a free-text field for a closed set |
| `Salary flag` | **0%**, unmapped | not seen | **Defer**: nothing can be concluded yet |

**Why the structured fields are empty, measured rather than guessed.** Recruiters put everything in one narrative field. Of 70,883 non-empty `grade_comment` values: average length **122** characters, maximum **552**, **27,557 contain a year**, **2,542 contain the `Role @ Company` pattern**, **12,519 contain the word "looking"**. The employer, the tenure and the aspiration are all in there as prose. So `current_employer` is not an unwanted field, it is a field whose content is being typed into the box next to it.

That reframes the verdict: **do not remove `Current title` and `Current employer`; stop pretending they are the primary path.** Either parse them out of the comment or accept the comment as the record and shrink the structured pair.

**And the field that is used is the one squeezed.** `grade_comment` averages 122 characters and reaches 552, and it renders in a `rows={3}` textarea, which is also the single control in the product computing `resize: both` (workstream V's finding). The most-used free-text field on the busiest record page is the smallest input on it.

### The 17 accordions

`RecordSection` accepts `defaultOpen` and **30 of its 76 call sites already pass it**, so closing a section by default needs no new mechanism.

| Section | Verdict | Why |
| :---- | :---- | :---- |
| `Candidate Information`, `Main Status Details`, `Source`, `Resumes` | **Keep open** | the fields inside are the 96 to 100% filled ones |
| `History Log / Timeline` | **Close by default** | measured at **2,812px and 563 of 894 DOM nodes** on one candidate. The median person has **2** activities, p95 is **15**, and the maximum is **346**, and `useEngagement` applies **no limit**, so the outliers render in full |
| `Contact Log`, `Events`, `Status History` | **Close by default** | all three read the same `activities` table, which is **98.8% one kind** (209,873 `note` of 212,496; then 1,499 `status_change`, 959 `call`, 93 `inmail`, 48 `email`, 24 `meeting`) |
| `Requisition Summary`, `Requisition Details` | **Close by default** | duplicate what the requisition record shows in full |
| `Resume Preview` | **Close by default** | it renders a PDF viewer; V13 attributes a large share of the page height to it |
| `Tasks`, `Reminders`, `Attachments`, `Web Links`, `Tracking`, `Resume and Cover Letter` | **Keep**, collapsed as they are | cheap, and each is a real Taleo section, 21 |

**Four sections for one table is the structural finding here.** `Contact Log`, `Events`, `Status History` and `History Log / Timeline` are four accordions over `activities`, distinguished only by `kind`, on a table that is 98.8% a single kind. Taleo has **one** `History Log` (screenshot 21). **Recommend collapsing the four into one with a kind filter**, which is a Goal 4 design change and is the largest single space win available on this page.

## The requisition record: 42 of 45 inputs are for two unused columns

14 accordions, 156 controls, 45 text and number inputs. **42 of the 45 are `Next step` and `Rank`, rendered inline once per pipeline row**, 21 rows on the sampled requisition.

`next_step` is filled in **6 of 86,133** applications. `rank` is filled in **1 of 86,133**. Neither is written by the importer, so those figures are FOOS's own usage since the tables were created.

**Verdict: remove both from the inline table and put them behind the row's own detail.** Three reasons, all checkable: the columns are effectively unused; Taleo's requisition candidate list (22) shows neither; and they are the two controls Goal 1 found being conditionally withdrawn by `canEdit`, so 42 inputs appear and disappear for fields with 7 values between them across the entire database.

This is also the answer to the requisition record's height without touching anything anyone uses.

| Section | Verdict | Why |
| :---- | :---- | :---- |
| `Application Pipeline` | **Keep open** | it is the point of the screen |
| `Requisition Information:`, `Description:`, `Requisition Owner(s):` | **Keep open** | `description` 95.65%, `location` 98.99%, `title` and `job_code` 100% |
| `History Log / Timeline`, `Status History` | **Close by default** | same `activities` finding as above |
| `Approvals:` | **Close by default** | `requisition_approvers` holds 0 rows and `Send To`, the control that would fill it, is dead (Goal 2) |
| `Tracking:` | **Close by default** | two timestamps |
| `Accounts / Company`, `Contacts`, `Tasks`, `Reminders`, `Comments`, `Attachments` | **Keep**, collapsed | all six are real Taleo sections, screenshot 21 |

## The candidate list: 14 columns against Taleo's 11

The list screens are the dense ones, **9.4% to 10.9% empty**, so the case for cutting is weaker. It is not zero.

Taleo's candidate home (08) has: two `OP` flag icon columns, `Name`, `Last updated`, `Resume`, `Location`, `Source`, `Initial Date`, `Amir Grade`, `Sourcer Grade`, `Main status`, `Requisitions`.

FOOS has those, with `Grade` and `Grade comment` for the two grade columns, plus **three Taleo does not have**:

| FOOS-only column | Filled | Verdict |
| :---- | ----: | :---- |
| `Current employer` | **0.01%, 7 of 72,917** | **Remove.** Blank on 99.99% of rows, absent from Taleo, and the content is inside `Grade comment` two columns away |
| `Current title` | 4.89% | **Remove from the list**, keep on the record |
| `Sourcer` | 99.99% | **Keep.** Not in Taleo, but `sourcer_id` drives the RLS policy that decides what a sourcer sees, so it is load-bearing here |

**One column is worse than empty.** `Grade` renders `star_grade`, filled in **334 of 72,917, 0.46%**, while `Grade comment` beside it renders `grade_comment` at **97.21%**. So the list gives a prominent star-rating column to a field that is blank 99.5% of the time, next to the field that actually carries the assessment. Taleo has both (`Amir Grade`, `Sourcer Grade`), so **this is not a removal; it is a weighting problem**, and the recommendation is to narrow the star column rather than drop it.

## The requisition list already has the feature the candidate list is missing

Measured while checking columns, and it corrects my own Goal 2 verdict.

`RequisitionListPage.tsx` has a **working column picker**: `COLUMN_DEFS` at line 94, `visibleCols` state at 141, checkboxes rendered at 523, a toggle at 529, a reset at 547, the table filtered at 398, persisted into saved-view state at 412, and it even drives the CSV export columns at 416.

So `Configure columns` is **fully built on the requisition list and dead on the candidate list and the intake queue**. In Goal 2 I filed it as Build at 1 to 2 days; the honest verdict is **port an existing implementation**, and closer to 4 to 6 hours. That is the third time in two goals that a feature turned out to exist in one module and nowhere else.

**One defect falls out of it.** `COLUMN_DEFS[0]` is `{ key: 'job_code', header: 'Job code' }` and the table's own definition at line 314 is `{ key: 'job_code', header: 'Job Code' }`. Two sources of truth for the same column label, disagreeing on capitalisation, so the picker and the table header can never read identically.

## What I got wrong

**I nearly recommended removing `budget_status` and `reason_for_opening` on fill rate alone.** Both are 0 of 690 and both are visibly populated in VentVest's live Taleo. The check that caught it was grepping `migration/src/` for each column, which showed nine of the thirteen low-fill fields were never mapped. **A 0% fill rate on an unmapped column measures the importer.** I have put that control in front of every verdict rather than mentioning it at the end.

**My Goal 2 sizing for `Configure columns` was wrong**, by roughly a factor of four, because I looked for a store (`ats_saved_views`) and not for an existing implementation. The store existing was true and it was the less useful fact.

**A note in Goal 1 that I should tighten.** I recorded the requisition record as rendering "45 inputs" without saying that 42 of them are one repeated pair. The count was right and the description was thin enough to mislead.

## What this did not cover

- **Fill rate is a property of the Zoho import, not of the business.** Even for the four mapped-and-still-empty fields, all this proves is that the previous system held nothing there. It cannot show what VentVest will use in FOOS.
- **I measured 7 tables**, the ones behind the record and list screens: `candidate_profiles`, `people`, `requisitions`, `applications`, `companies`, `contact_profiles`, `deals`. Not `tickets`, `intake_items`, `email_templates`, `ats_saved_views` or `integration_settings`, all of which hold **0 rows**, so no fill rate exists to measure.
- **`companies`, `contact_profiles` and `deals` hold 195, 73 and 2 rows.** Percentages on 2 rows are noise, so I have drawn no CRM field verdicts from them. `companies.state` at 17.44% of 195 is the only CRM figure worth a second look, and 195 rows is a thin basis.
- **Tabs were in scope and I found little to say.** The record pages carry 4 and 2 `role="tab"` controls, which are the pipeline's Table/Kanban toggle and the resume viewer, and both are real. The nav tabs were settled in Goal 1: every one matches a route its role can reach.
- **No screen was re-measured for height after these changes.** Every space claim here is V13's measurement of the current build, so the saving from closing a section is asserted, not demonstrated.

## Parked for Klent

Both are judgement calls about the business, not the code.

| | Question | Why it is yours |
| :---- | :---- | :---- |
| **P6**, new | Should `budget_status`, `reason_for_opening`, `tenure_note` and `salary_flag` stay? All four are 0% filled **and never mapped by the import**, and Taleo populates the first two. They are either fields to start using or fields to drop, and the data cannot tell us which | It depends on whether VentVest intends to work the way their Taleo instance does |
| **P7**, new | Is the star grade worth its column? `star_grade` is filled in 0.46% of records while the free-text grade beside it is at 97.21%. Taleo has both columns, so keeping it is faithful and cutting it is defensible | It is a question about how you want grading to work, and Goal 3 should not decide that alone |

## Where the evidence lives

| Claim | How to re-derive it |
| :---- | :---- |
| Every fill rate | One `count(*) filter (...)` per column over the seven tables, on the local stack. Reads only |
| Importer coverage | `grep -rl <column> migration/src/` |
| Taleo evidence | Screenshots 08, 18, 21 and 22 in Drive, read as OCR |
| Section and field lists | `audit/corpus/role-matrix.admin.json`, the `controls` array per route |
| Heights and emptiness | `docs/11-component-audit/VVPH_VV-FOOS_Audit_V13-Density_2026-09-04_v1.0_Draft.md` |

**`audit/corpus/role-matrix.admin.json` contains candidate names**, because the requisition record builds its inline input labels as `Next step for <candidate name>`. That is correct for accessibility and is one more reason the corpus stays gitignored.
