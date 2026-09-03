#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:55322/postgres}"
export DATABASE_URL

PASSES="${1:-1}"
overall=0

run() {
  local name="$1"; shift
  local out code
  out="$("$@" 2>&1)"; code=$?
  if [ "$code" -ne 0 ]; then
    printf 'FAIL  %-12s\n' "$name"
    local signal
    signal="$(printf '%s\n' "$out" | grep -Ev '^npm (error|warn)' \
      | grep -EiB1 '^ +[0-9]+\) |error TS|✘|✗|[0-9]+ failed|Error:|AssertionError|Timed out' | head -24)"
    if [ -n "$signal" ]; then
      printf '%s\n' "$signal"
    else
      printf '%s\n' "$out" | grep -Ev '^npm (error|warn)' | tail -12
    fi
    return 1
  fi
  printf 'ok    %-12s %s\n' "$name" \
    "$(printf '%s\n' "$out" | grep -Ei 'passed|pairs|respected|no drift|no comments|no attachment|permissive|checked' | tail -1 | cut -c1-88)"
  return 0
}

one_pass() {
  local fail=0

  run "typecheck"   npm run typecheck --workspace=app     || fail=1
  run "lint"        npm run lint --workspace=app          || fail=1
  run "tc-tests"    npm run typecheck --workspace=tests   || fail=1
  run "build"       npm run build --workspace=app         || fail=1
  run "contrast"    node scripts/check-contrast.mjs       || fail=1
  run "motion"      node scripts/check-motion.mjs         || fail=1
  run "css-layers"  node scripts/check-css-layers.mjs     || fail=1
  run "unbounded"   node scripts/check-unbounded-queries.mjs || fail=1
  run "paged-order" node scripts/check-paged-order.mjs    || fail=1
  run "licences"    node scripts/check-licences.mjs       || fail=1
  run "dead-code"   npx knip --no-progress                || fail=1
  run "comments"    node scripts/check-comments.mjs       || fail=1
  run "migrations"  node scripts/check-migrations.mjs     || fail=1
  run "api-tests"   npm run test --workspace=tests        || fail=1
  local jsonout="$ROOT/.gate/browser-pass-${PASS_LABEL:-1}.json"
  mkdir -p "$ROOT/.gate"
  PLAYWRIGHT_JSON_OUTPUT_NAME="$jsonout" \
    run "browser" npm run e2e --workspace=tests -- --retries=0 --reporter=line,json || {
      fail=1
      if [ -s "$jsonout" ]; then
        printf '      failing test(s) from %s:\n' "${jsonout#$ROOT/}"
        node -e '
          const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
          const bad = [];
          const walk = (s) => (s.suites || []).forEach(walk) || (s.specs || []).forEach((sp) =>
            sp.tests.forEach((t) => t.results.forEach((res) => {
              if (res.status !== "passed" && res.status !== "skipped") {
                bad.push(`${sp.file} :: ${sp.title} [${res.status}] ${(res.error && res.error.message || "").split("\n")[0].slice(0, 140)}`);
              }
            })));
          (r.suites || []).forEach(walk);
          bad.slice(0, 10).forEach((b) => console.log("      " + b));
        ' "$jsonout"
      fi
    }
  run "attachments" node scripts/check-attachment-queue.mjs || fail=1

  local v code
  v="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/validate.sql 2>&1)"; code=$?
  if [ "$code" -ne 0 ]; then
    printf 'FAIL  %-12s\n' "validate.sql"
    printf '%s\n' "$v" | grep -E 'FAIL|ERROR' | head -4
    fail=1
  else
    printf 'ok    %-12s %s check(s) pass\n' "validate.sql" "$(printf '%s\n' "$v" | grep -c 'PASS')"
  fi

  local imp
  imp="$(node migration/import.mjs 2>&1)"
  if printf '%s\n' "$imp" | grep -q '75 rows    75 new' \
    && printf '%s\n' "$imp" | grep -q '141 new' \
    && printf '%s\n' "$imp" | grep -q '42 new' \
    && printf '%s\n' "$imp" | grep -q '86 rows    86 new'; then
    printf 'ok    %-12s 75 candidates, 141 notes, 42 attachments, 86 companies\n' "importer"
  else
    printf 'FAIL  %-12s\n' "importer"
    printf '%s\n' "$imp" | grep -E 'rows |unresolved' | head -6
    fail=1
  fi

  if printf '%s\n' "$imp" | grep -qE 'unresolved (staff|source|status)'; then
    printf 'FAIL  %-12s unresolved lookups in the dry run\n' "lookups"
    fail=1
  else
    printf 'ok    %-12s 0 unresolved staff, sources and statuses\n' "lookups"
  fi

  local bf
  bf="$(node scripts/backfill-zoho-candidate-fields.mjs 2>&1)"
  if printf '%s\n' "$bf" | grep -q 'matched via zoho_id_map 0'; then
    printf 'ok    %-12s nothing imported locally, so it correctly matches nothing\n' "backfill"
  elif printf '%s\n' "$bf" | grep -qE 'star_grade   set 0  corrected 0'; then
    printf 'ok    %-12s no drift against the export\n' "backfill"
  else
    printf 'FAIL  %-12s\n' "backfill"
    printf '%s\n' "$bf" | tail -4
    fail=1
  fi

  return $fail
}

for i in $(seq 1 "$PASSES"); do
  if [ "$PASSES" -gt 1 ]; then printf '\n===== pass %s of %s =====\n' "$i" "$PASSES"; fi
  PASS_LABEL="$i"; export PASS_LABEL
  one_pass || overall=1
done

if [ "$overall" -eq 0 ]; then
  printf '\n%s clean pass(es).\n' "$PASSES"
else
  printf '\nAt least one check failed.\n'
fi
exit $overall
