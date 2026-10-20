#!/usr/bin/env bash
# The verification gate, staged so the cheapest feedback comes first.
#
#   gate.sh quick [N]   static checks, guards, unit and tooling tests, in parallel. No database.
#   gate.sh affected    quick, plus only the integration and browser areas your diff against
#                       develop can reach (scripts/affected.mjs maps files to areas). Falls
#                       back to everything when shared code changed.
#   gate.sh full  [N]   quick, then build and integration tests, then the browser suite,
#                       then the database checks. The default.
#   gate.sh data  [N]   the checks that compare the local database with the Zoho export:
#                       importer dry run, lookups, backfill. Slow and data-dependent.
#   gate.sh 5           a bare number is a pass count for the default mode.
#
# Every check prints "ok" or "FAIL", its seconds and what it found. The browser suite
# does not stop at the first failure, so one run lists every failing test. Logs and the
# Playwright JSON report go to .artifacts/gate/.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE=full
PASSES=1
for arg in "$@"; do
  case "$arg" in
    quick|affected|full|data) MODE="$arg" ;;
    ''|*[!0-9]*) printf 'usage: gate.sh [quick|affected|full|data] [passes]\n' >&2; exit 2 ;;
    *) PASSES="$arg" ;;
  esac
done

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:56322/postgres}"
export DATABASE_URL
if [ "$MODE" != quick ]; then
  node scripts/local-db.mjs check "$DATABASE_URL" || exit 1
fi

ARTIFACTS="$ROOT/.artifacts/gate"
mkdir -p "$ARTIFACTS"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ORDER=()

start() {
  local name="$1"; shift
  ORDER+=("$name")
  (
    local began=$SECONDS
    "$@" >"$TMP/$name.out" 2>&1
    echo $? >"$TMP/$name.code"
    echo $((SECONDS - began)) >"$TMP/$name.secs"
  ) &
}

summary_of() {
  grep -Ei 'passed|pairs|respected|no drift|no comments|no attachment|permissive|checked' "$1" | tail -1 | cut -c1-84
}

signal_of() {
  local out="$1" signal
  signal="$(grep -Ev '^npm (error|warn)' "$out" \
    | grep -EiB1 '^ +[0-9]+\) |error TS|✘|✗|[0-9]+ failed|Error:|AssertionError|Timed out' | head -24)"
  if [ -n "$signal" ]; then
    printf '%s\n' "$signal"
  else
    grep -Ev '^npm (error|warn)' "$out" | tail -12
  fi
}

finish() {
  local fail=0 name code
  for name in ${ORDER[@]+"${ORDER[@]}"}; do
    code="$(cat "$TMP/$name.code")"
    if [ "$code" -eq 0 ]; then
      printf 'ok    %-14s %4ss  %s\n' "$name" "$(cat "$TMP/$name.secs")" "$(summary_of "$TMP/$name.out")"
    else
      printf 'FAIL  %-14s %4ss\n' "$name" "$(cat "$TMP/$name.secs")"
      signal_of "$TMP/$name.out"
      fail=1
    fi
  done
  ORDER=()
  return $fail
}

stage() {
  printf '%s\n' "-- $1"
}

static_stage() {
  stage "static checks, guards and unit tests (parallel)"
  start typecheck     npm run typecheck --workspace=app
  start tc-tests      npm run typecheck --workspace=tests
  start lint          npm run lint --workspace=app
  start contrast      node scripts/check-contrast.mjs
  start motion        node scripts/check-motion.mjs
  start css-layers    node scripts/check-css-layers.mjs
  start css-overrides node scripts/check-css-override-layers.mjs
  start tokens        node scripts/check-design-tokens.mjs
  start icons         node scripts/check-icons.mjs
  start control-h     node scripts/check-control-heights.mjs
  start unbounded     node scripts/check-unbounded-queries.mjs
  start paged-order   node scripts/check-paged-order.mjs
  start licences      node scripts/check-licences.mjs
  start dead-code     npx knip --no-progress
  start comments      node scripts/check-comments.mjs
  start migrations    node scripts/check-migrations.mjs
  start unit          npm run test:unit --workspace=tests
  start tooling       node --test "tests/tooling/*.test.mjs"
  wait
  finish
}

build_and_integration_stage() {
  stage "build and integration tests (parallel)"
  start build         npm run build --workspace=app
  start integration   npm run test:integration --workspace=tests
  wait
  finish
}

browser_stage() {
  stage "browser suite${*:+ ($*)}"
  local json="$ARTIFACTS/browser-pass-${PASS_LABEL:-1}.json"
  rm -f "$json"
  start browser env FOOS_PW_MAX_FAILURES=0 PLAYWRIGHT_JSON_OUTPUT_NAME="$json" \
    npm run e2e --workspace=tests -- --retries=0 --reporter=line,json "$@"
  wait
  finish || {
    if [ -s "$json" ]; then
      printf '      failing test(s), from %s:\n' "${json#"$ROOT"/}"
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
        bad.forEach((b) => console.log("      " + b));
      ' "$json"
    fi
    return 1
  }
}

database_stage() {
  stage "database checks"
  start attachments   node scripts/check-attachment-queue.mjs
  start validate-sql  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/validate.sql
  wait
  finish
}

importer_check() {
  local out modules bad
  out="$(node --max-old-space-size=3500 migration/import.mjs 2>&1)"
  modules="$(printf '%s\n' "$out" | grep -cE '[0-9]+ rows +[0-9]+ new')"
  bad="$(printf '%s\n' "$out" | awk '
    /[0-9]+ rows +[0-9]+ new/ {
      for (i = 1; i <= NF; i++) {
        if ($i == "new"    && $(i - 1) != "0") print "  " $1 ": " $(i - 1) " new, so a re-run would insert"
        if ($i == "failed" && $(i - 1) != "0") print "  " $1 ": " $(i - 1) " failed"
      }
    }')"
  if [ "$modules" -eq 0 ]; then
    printf 'the dry run reported no module lines at all\n'
    return 1
  fi
  if [ -n "$bad" ] || printf '%s\n' "$out" | grep -q 'unresolved staff'; then
    printf '%s\n' "$bad"
    printf '%s\n' "$out" | grep -E 'unresolved' | head -3
    return 1
  fi
  printf '%s module(s) idempotent, 0 new, 0 failed, no unresolved staff\n' "$modules"
  if printf '%s\n' "$out" | grep -qE 'unresolved (staff|source|status)'; then
    printf 'unresolved lookups in the dry run\n'
    return 1
  fi
}

backfill_check() {
  local out source matched
  out="$(node --max-old-space-size=3500 scripts/backfill-zoho-candidate-fields.mjs 2>&1)"
  source="$(printf '%s\n' "$out" | awk '/source rows/ { print $NF }')"
  matched="$(printf '%s\n' "$out" | awk '/matched via zoho_id_map/ { print $4 }')"
  if [ -n "$source" ] && [ "$source" = "$matched" ] \
    && printf '%s\n' "$out" | grep -q 'no profile 0' \
    && printf '%s\n' "$out" | grep -qE 'star_grade   set 0  corrected 0' \
    && printf '%s\n' "$out" | grep -qE 'initial_date set 0  corrected 0'; then
    printf 'all %s source row(s) matched, no drift to correct\n' "$source"
    return 0
  fi
  printf '%s\n' "$out" | tail -5
  return 1
}

data_stage() {
  stage "database against the Zoho export (parallel)"
  start importer      importer_check
  start backfill      backfill_check
  wait
  finish
}

affected_stage() {
  local plan all integration targets files
  plan="$(node scripts/affected.mjs "${AFFECTED_BASE:-develop}")"
  all="$(node -p 'JSON.parse(process.argv[1]).all' "$plan")"
  integration="$(node -p 'JSON.parse(process.argv[1]).integration' "$plan")"
  targets="$(node -p 'JSON.parse(process.argv[1]).targets.join(" ")' "$plan")"
  files="$(node -p 'JSON.parse(process.argv[1]).reasons.length' "$plan")"
  printf -- '-- affected: %s file(s) reach %s\n' "$files" "${targets:-no browser area}"
  local fail=0
  if [ "$integration" = true ] || [ "$all" = true ]; then
    build_and_integration_stage || fail=1
  else
    stage "build"
    start build npm run build --workspace=app
    wait
    finish || fail=1
  fi
  if [ -n "$targets" ]; then
    # shellcheck disable=SC2086
    browser_stage $targets || fail=1
  fi
  if [ "$integration" = true ]; then
    database_stage || fail=1
  fi
  return $fail
}

one_pass() {
  local fail=0
  case "$MODE" in
    quick)
      static_stage || fail=1
      ;;
    affected)
      static_stage || fail=1
      affected_stage || fail=1
      ;;
    full)
      static_stage || fail=1
      build_and_integration_stage || fail=1
      browser_stage || fail=1
      database_stage || fail=1
      ;;
    data)
      data_stage || fail=1
      ;;
  esac
  return $fail
}

overall=0
for i in $(seq 1 "$PASSES"); do
  if [ "$PASSES" -gt 1 ]; then printf '\n===== pass %s of %s =====\n' "$i" "$PASSES"; fi
  PASS_LABEL="$i"; export PASS_LABEL
  began=$SECONDS
  one_pass || overall=1
  printf 'pass %s took %ss\n' "$i" "$((SECONDS - began))"
done

if [ "$overall" -eq 0 ]; then
  printf '\n%s clean pass(es), mode %s.\n' "$PASSES" "$MODE"
else
  printf '\nAt least one check failed.\n'
fi
exit $overall
