# ACTIVE GOAL: Goal 3 — Information architecture: what to remove

Decide which accordions, fields, columns and tabs are not needed. This is the "remove unnecessary" half, and it is separate from Goal 2 because that one is about controls and this one is about content.

**Use the strongest evidence available, which nobody has used yet: the data itself.** The local database holds **72,917 real imported candidates, 690 requisitions** and the rest of the Zoho migration. So for every field the UI renders, **query its fill rate**. A field null or empty in 99% of 72,917 records is either dead, mis-mapped by the import, or genuinely rare, and the three have different answers. That is a measurement, not an opinion, and it is the best argument for removing a field that exists.

**Also weigh:** whether the Taleo screenshots show it; whether any role uses it, from Goal 1's matrix; and what it costs in vertical space, which V13 has measured per screen.

**What V13 already established, so build on it rather than repeat it.** The four list screens are **9.4% to 10.9% empty** and every other screen is **34.6% to 97.6%**, with nothing in between, so the lists are dense and the forms, records and dashboards are not. `global-search` is 87.6% empty, `dashboard-my-view` 58.1%, the candidate record 55.4%. The largest single gap anywhere is 77px, so **no one gap explains it**: it accumulates across 281 spacing declarations. The candidate record is 3,241px over 4.31 viewports with 1,795px empty, and `History Log / Timeline` alone was measured at 2,812px and 563 of 894 nodes. `RecordSection` accepts `defaultOpen` and **30 of its 76 call sites already pass it**, so the mechanism for closing a section by default exists and is in use.

**Deliverable:** `docs/12-full-audit/VVPH_VV-FOOS_Audit_Information-Architecture_<date>_v1.0_Draft.md`. Per screen: every accordion, field, column and tab, with its fill rate where it is a field, whether Taleo shows it, which roles use it, and a verdict of keep, close by default, de-emphasise, or remove. **Taleo stays the standard**, and where genuine Taleo fidelity is what makes a screen harder to use, that is a recommendation for Klent rather than a change to make alone.

**Standing rules.** As Goal 1, and one more: a fill-rate query is a read; **never write to production**, and the migration data is real candidate PII, so **never paste a name, email or phone into a document, a commit message or a web search.** Describe the shape and omit the value, as `Audit_V10-Visual-Review` observation 14 does.

**ON FINISHING THIS GOAL, RE-ARM THE REMINDER BEFORE STARTING THE NEXT ONE:** `bash scripts/arm-goal.sh 4` An armed goal that no longer matches the work is worse than none, because it reads as confirmation. If you notice the armed goal is stale, re-arm it before doing anything else.
