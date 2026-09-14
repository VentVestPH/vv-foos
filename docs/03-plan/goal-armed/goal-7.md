# ACTIVE GOAL: Goal 7 — Names, deletions and a folder a human can navigate

Housekeeping first, because the next three goals write into it and Klent cannot review output he cannot find. **Nothing in `app/src` changes in this goal.**

**Klent, 2026-09-08, verbatim:** "delete thge audit/corpus and do it again. this is not what i want... also delete the discovery fodler as you're duplicating stuff. create a dedicatetd folder and add dates to them. also, why is it still dist-redesign-2? that's a stupid ass name. delete it or rename it. reorganize the files inside as i don't know what that is."

## 7.1 Delete the two screenshot folders

- `audit/corpus/` — **628 MB, 25,231 PNGs**, and not one of them is a full page. Delete it.
- `discovery/` — **4.1 MB**, a second set of the same screens at `-desktop` and `-phone`, which is the duplication he means. Delete it.
- Both are already gitignored, so neither deletion touches git history. **Confirm that with `git check-ignore -v audit/corpus discovery` before deleting**, and if either is tracked, stop and say so rather than deleting tracked files.

## 7.2 Rename the build output

`dist-redesign-2` was a name from a two-frontend era that no longer exists. Renamed to **`dist`** on 2026-09-08.

Twelve files reference it and every one must change in the same commit, because a stale reference means the build output goes to one place and the deploy reads another:

`.gitignore`, `app/.gitignore`, `app/public/_headers`, `app/vite.config.ts`, `app/eslint.config.js`, `CLAUDE.md`, `tests/DEFECT_LOG.md`, `docs/03-plan/VVPH_VV-FOOS_Plan_CRM-ATS-Improvement`, `docs/03-plan/VVPH_VV-FOOS_Goals_Full-Audit-And-Execution`, `docs/03-plan/goal-armed/goal-6.md`, `docs/07-environments/VVPH_VV-FOOS_Runbook_Hosting-And-Cutover`, `docs/07-environments/cloudflare/_redirects`, `docs/01-current-state/VVPH_VV-FOOS_Report_System-Inventory-and-Verified-State`.

**Prove it after:** `grep -rl "dist-redesign-2" . | grep -v node_modules --exclude-dir=.git` returns nothing, `npm run build --workspace=app` writes `app/dist/`, and `app/public/_headers`'s `outputDirectory` matches. Then re-verify the two facts the runbook depends on: the file count and total bytes, and which Supabase URL the bundle bakes.

## 7.3 One dated folder for audit output, organised so it can be browsed

Create **`audit/2026-09-08/`**, a dated child of `audit/`, with this shape and nothing else:

```
audit/2026-09-08/
  README.md                 what this folder is, when it was captured, how to regenerate
  screens/<role>/<route>/   full-page and per-fold PNGs, named 01-full.png, 02-fold-1.png, ...
  states/<role>/<route>/    one PNG per opened modal, dropdown, accordion, tab, menu
  findings/                 the review output, one file per page, plus INDEX.md
  measurements/             the raw JSON each spec emits
```

Every file name must say what it is without opening it. `01-full.png` and `modal-add-candidate.png`, never `shot-7.png`.

**The README is not optional.** Klent said "i don't know what that is" about the current output, and that is the defect this fixes. It states the date, the roles, the viewport, the route count, how many images, what each folder holds, and the one command that regenerates it.

**Fix `.gitignore` first, before a single screenshot is written.** Line 50 currently ignores `audit/corpus/` by name, not `audit/`, so a dated folder underneath it is **not ignored** and every screenshot would be committable. Verified: `git check-ignore -v audit/2026-09-08` matches nothing today. These images render **real candidate names**, so this is a PII leak waiting on one `git add -A`.

Replace the narrow rule with one that covers every dated run and keeps the reason attached:

```
# Audit output: screenshots render real candidate names. Never committed.
audit/*/
```

Then prove it: `git check-ignore -v audit/2026-09-08` must match, and `git status --short` must stay silent after the capture runs. Delete the now-redundant `discovery/` line in the same edit, since that folder is gone.

## 7.4 Retire the old harness honestly

`tests/audit/` holds 26 specs. Most are contract checks that belong in the gate, not in a design audit. Do **not** delete them. Instead:

- Move the ones that assert a contract and are worth keeping into `tests/e2e/` so they run in the gate, or leave them where they are if they already run there.
- Write `tests/audit/README.md` naming, per spec, whether it is a **contract check** or was **capture scaffolding for the corpus that has been deleted**.
- The new capture harness for Goals 8 and 9 is a **new** spec file, not an edit to `capture.ts`, so the old and new methods are never confused.

## The bar

- `git status` shows only intended changes, and **no commit is made.** Klent reviews first.
- Both static gates and all ten guards still pass: `bash scripts/gate.sh` once is enough for this goal, because no product code changed.
- Report the freed disk space, the twelve reference edits, and the new folder tree as output he can read.

**ON FINISHING: `bash scripts/arm-goal.sh 8`, and do not commit.**
