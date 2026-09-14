#!/bin/bash
# Arms one goal for the reminder hook. Run this on every goal transition.
set -e
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SRC="$ROOT/docs/plan/goal-armed"
N="$1"

if [ -z "$N" ]; then
  cur="(none)"
  [ -s "$ROOT/.claude/goal-armed.md" ] && cur=$(head -1 "$ROOT/.claude/goal-armed.md" | sed 's/^# ACTIVE GOAL: //')
  echo "armed: $cur"
  echo
  echo "usage: bash scripts/arm-goal.sh <n>   |   bash scripts/arm-goal.sh off"
  for f in "$SRC"/goal-*.md; do
    printf '  %s  %s\n' "$(basename "$f" .md | tr -d 'goal-')" "$(head -1 "$f" | sed 's/^# ACTIVE GOAL: //')"
  done
  exit 0
fi

if [ "$N" = "off" ]; then
  rm -f "$ROOT/.claude/goal-armed.md" "$ROOT/.claude/.goal-reminder-stamp"
  echo "disarmed. The reminder is now silent."
  exit 0
fi

F="$SRC/goal-$N.md"
[ -f "$F" ] || { echo "no goal $N. Goals available: $(ls "$SRC" | sed 's/goal-//;s/\.md//' | tr '\n' ' ')"; exit 1; }

cat "$F" "$SRC/_always.md" > "$ROOT/.claude/goal-armed.md"
rm -f "$ROOT/.claude/.goal-reminder-stamp"
echo "armed goal $N: $(head -1 "$F" | sed 's/^# ACTIVE GOAL: //')"
echo "The reminder fires on the next tool call, then every ${FOOS_REMINDER_SECONDS:-120}s of activity."
