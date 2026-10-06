#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:56322/postgres}"
node scripts/local-db.mjs check "$DB_URL"
SNAPSHOT="${SNAPSHOT:-$HOME/.foos-ci-parity-snapshot.sql}"

# Both halves of this need a client whose major version matches the server.
# pg_dump refuses a newer server outright ("aborting because of server version
# mismatch"). psql fails far more quietly and far more expensively: pg_dump 17
# wraps its output in \restrict / \unrestrict, psql 16 does not know those
# commands, and with ON_ERROR_STOP off it carries on and starts reading the
# COPY data as SQL. On 2026-09-14 that emptied the local database and reported
# only "syntax error at or near \"good\"". Resolve the binary, do not assume it.
resolve_pg_bin() {
  local name=$1 override=$2 server major candidate
  if [ -n "$override" ]; then echo "$override"; return; fi
  server=$(psql "$DB_URL" -tAc 'show server_version' 2>/dev/null || true)
  major=${server%%.*}
  for candidate in \
    "/opt/homebrew/opt/postgresql@${major}/bin/${name}" \
    "/usr/local/opt/postgresql@${major}/bin/${name}" \
    "/usr/lib/postgresql/${major}/bin/${name}"; do
    [ -x "$candidate" ] && { echo "$candidate"; return; }
  done
  echo "$name"
}

case "${1:-}" in
  snapshot)
    PG_DUMP_BIN=$(resolve_pg_bin pg_dump "${PG_DUMP:-}")
    echo "Writing $SNAPSHOT with $PG_DUMP_BIN"
    "$PG_DUMP_BIN" "$DB_URL" --clean --if-exists --quote-all-identifiers > "$SNAPSHOT"
    du -h "$SNAPSHOT"
    ;;
  run)
    [ -f "$SNAPSHOT" ] || { echo "No snapshot at $SNAPSHOT. Run: bash scripts/ci-parity.sh snapshot" >&2; exit 1; }
    npm run db:reset
    ( cd tests && npx playwright test --reporter=line )
    ;;
  restore)
    [ -f "$SNAPSHOT" ] || { echo "No snapshot at $SNAPSHOT" >&2; exit 1; }
    PSQL_BIN=$(resolve_pg_bin psql "${PSQL:-}")
    echo "Restoring $SNAPSHOT with $PSQL_BIN"
    "$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=0 -f "$SNAPSHOT" > /dev/null
    restored=$(psql "$DB_URL" -tAc "select count(*) from candidate_profiles")
    psql "$DB_URL" -tAc "select 'candidate_profiles='||count(*) from candidate_profiles"
    psql "$DB_URL" -tAc "select 'requisitions='||count(*) from requisitions"
    if [ "$restored" -eq 0 ]; then
      echo "RESTORE FAILED: the snapshot is still at $SNAPSHOT. Re-run with PSQL=/path/to/matching/psql" >&2
      exit 1
    fi
    ;;
  *)
    echo "usage: bash scripts/ci-parity.sh snapshot | run | restore" >&2
    echo "CI runs the browser suite against a freshly reset database: migrations, seed.sql and the" >&2
    echo "four personas, and nothing else. This checkout holds the Zoho copy, so a test that assumes" >&2
    echo "a full page of rows or that a search term matches something passes here and fails there." >&2
    exit 1
    ;;
esac
