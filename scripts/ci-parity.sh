#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:55322/postgres}"
SNAPSHOT="${SNAPSHOT:-$HOME/.foos-ci-parity-snapshot.sql}"

case "${1:-}" in
  snapshot)
    echo "Writing $SNAPSHOT"
    pg_dump "$DB_URL" --clean --if-exists --quote-all-identifiers > "$SNAPSHOT"
    du -h "$SNAPSHOT"
    ;;
  run)
    [ -f "$SNAPSHOT" ] || { echo "No snapshot at $SNAPSHOT. Run: bash scripts/ci-parity.sh snapshot" >&2; exit 1; }
    npm run db:reset
    ( cd tests && npx playwright test --reporter=line )
    ;;
  restore)
    [ -f "$SNAPSHOT" ] || { echo "No snapshot at $SNAPSHOT" >&2; exit 1; }
    psql "$DB_URL" -v ON_ERROR_STOP=0 -f "$SNAPSHOT" > /dev/null
    psql "$DB_URL" -tAc "select 'candidate_profiles='||count(*) from candidate_profiles"
    psql "$DB_URL" -tAc "select 'requisitions='||count(*) from requisitions"
    ;;
  *)
    echo "usage: bash scripts/ci-parity.sh snapshot | run | restore" >&2
    echo "CI runs the browser suite against a freshly reset database: migrations, seed.sql and the" >&2
    echo "four personas, and nothing else. This checkout holds the Zoho copy, so a test that assumes" >&2
    echo "a full page of rows or that a search term matches something passes here and fails there." >&2
    exit 1
    ;;
esac
