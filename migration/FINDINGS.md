# Zoho export findings, 2026-09-02

Re-checked the Drive folder. **No files added or changed since 2026-07-24.** The two
related-list exports are still 46 bytes, and there is still no Zoho CRM (clients,
accounts) or job-openings export.

| File | Size | Rows | State |
| :---- | :---- | :---- | :---- |
| `Candidates_001.csv` | 59,176 | 75 | Usable. Already migrated to production in July, with two fields unapplied (A3, A4) |
| `Notes_001.csv` | 68,243 | 154 | Usable |
| `Attachments_001.csv` | 17,382 | 50 | Metadata only. `Attachment URL` empty on every row, so no file bytes |
| `Attachment Category_001.csv` | 603 | 8 | Usable as a lookup |
| `Candidates_Educational_Details.csv` | 46 | 0 | Blocked, see below |
| `Candidates_Experience_Details.csv` | 46 | 0 | Blocked, see below |

## The two related-list exports need a different export, not just a re-run

Both files contain exactly this header and nothing else:

```
TABULARROWID,"Candidate Id","Candidate Name"
```

The earlier note in the field-mapping workbook says they exported with "no data rows".
That understates it. **The header carries no education or experience fields at all**:
no institution, degree, discipline, start or end year, employer, job title, or dates.
So re-exporting the same view with rows included would still yield nothing importable.
The export has to be reconfigured to select the subform's own fields before it is run
again. Worth saying explicitly in the request to whoever runs it.

## Identity documents are present as attachments, and need a decision

The field-mapping workbook recommends excluding SSN, Passport Number and License
Number as *fields*. The attachments export shows the same class of data arriving as
*files*. Among the 50 rows, under the "Others" category, are:

- a passport scan
- a PSA birth certificate
- an NBI clearance
- a BIR 2316 tax form
- a certificate of graduation and a certificate of employment
- an employee profile form

These belong to a person who is now staff rather than a candidate, which is why they
were uploaded. No file bytes are in this export, so nothing has been imported yet and
nothing is at risk today. But the outstanding request is a **bulk download of all
candidate attachment files**, and if that is imported wholesale these documents come
with it, into a candidates table, under a generic "other" kind.

Decision needed before the bulk file import runs, not after:

1. Are identity documents in scope for FOOS at all? They are employment-records data,
   not recruitment data, and FOOS has no employee-records module in this phase.
2. If they are imported, should they carry a distinct `attachment_kind` so they can be
   found and access-controlled, rather than sitting in `other` alongside portfolios?
3. Retention: a passport scan has a different retention profile from a CV.

The importer treats this as a hard gate: `--include-identity-documents` must be passed
explicitly, and without it those rows are skipped and counted in the report. Nothing is
silently dropped and nothing is silently imported.

## Attachment categories actually used

Of the 8 categories defined, only 3 appear in the 50 exported rows: `Resume`,
`Formatted Resume` and `Others`. `Offer`, `Contracts`, `Cover Letter`, `LinkedIn
Profile` and `Email LinkedIn Profile` are defined but unused in this sample, so the
mapping for them is written from the category table rather than observed data.

## Staff names to resolve

Two distinct owner names appear across the Recruit exports. Only one of them has a
matching `staff` row today. The other owns the majority of the attachment and note
rows, so without a staff row (or an explicit mapping) every one of those loses its
`uploaded_by` and `created_by` provenance.

The CRM `Users` export does not close this gap: it lists Zoho **CRM** users, and the
unmatched Recruit owner is not among them. Four of its eight rows are system or
integration accounts (guest, public and integration users) that must not become staff.
Run the importer with `--show-names` to see the actual values; they are deliberately
kept out of committed files and out of the default report.
