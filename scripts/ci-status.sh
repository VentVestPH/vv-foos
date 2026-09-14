#!/bin/zsh
# Reports the newest CI run for the current branch. Temporary: remove when the
# PR merges. Silent unless something needs attention.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0
command -v gh >/dev/null 2>&1 || exit 0
sha="$(git rev-parse HEAD 2>/dev/null)"
[ -z "$sha" ] && exit 0
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"

# Prefer the PR this commit belongs to, so a local branch name that differs
# from the pushed one still finds the run.
row="$(gh run list --commit "$sha" --limit 1 \
  --json status,conclusion,displayTitle,databaseId \
  --jq '.[0] | "\(.status)\t\(.conclusion // "")\t\(.databaseId)"' 2>/dev/null)"
if [ -z "$row" ]; then
  pr_branch="$(gh pr view --json headRefName --jq .headRefName 2>/dev/null)"
  [ -n "$pr_branch" ] && row="$(gh run list --branch "$pr_branch" --limit 1 \
    --json status,conclusion,displayTitle,databaseId \
    --jq '.[0] | "\(.status)\t\(.conclusion // "")\t\(.databaseId)"' 2>/dev/null)"
fi
[ -z "$row" ] && exit 0

ci_status="${row%%$'\t'*}"
rest="${row#*$'\t'}"
ci_conclusion="${rest%%$'\t'*}"
ci_id="${rest##*$'\t'}"

if [ "$ci_conclusion" = "failure" ] || [ "$ci_conclusion" = "timed_out" ]; then
  jobs="$(gh run view "$ci_id" --json jobs \
    --jq '[.jobs[] | select(.conclusion=="failure") | .name] | join(", ")' 2>/dev/null)"
  printf '{"systemMessage":"CI %s on %s (run %s). Failing jobs: %s. Read it with: gh run view %s --log-failed"}\n' \
    "$ci_conclusion" "$branch" "$ci_id" "${jobs:-unknown}" "$ci_id"
elif [ "$ci_status" = "in_progress" ] || [ "$ci_status" = "queued" ]; then
  printf '{"systemMessage":"CI is %s on %s (run %s)."}\n' "$ci_status" "$branch" "$ci_id"
fi
exit 0
