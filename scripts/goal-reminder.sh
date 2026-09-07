#!/bin/bash
# Re-injects the armed goal and the standing rules on an activity interval, so a long
# run cannot drift from what was asked. Silent unless a goal is armed.
ROOT="${CLAUDE_PROJECT_DIR:-.}"
ARMED="$ROOT/.claude/goal-armed.md"
STAMP="$ROOT/.claude/.goal-reminder-stamp"
EVERY="${FOOS_REMINDER_SECONDS:-480}"

[ -s "$ARMED" ] || exit 0

now=$(date +%s)
last=0
[ -f "$STAMP" ] && last=$(cat "$STAMP" 2>/dev/null || echo 0)
case "$last" in ''|*[!0-9]*) last=0 ;; esac
[ $((now - last)) -lt "$EVERY" ] && exit 0
echo "$now" > "$STAMP"

python3 - "$ARMED" <<'PY' 2>/dev/null || exit 0
import json, sys, pathlib
body = pathlib.Path(sys.argv[1]).read_text().strip()
if not body:
    sys.exit(0)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": "REMINDER, re-injected on an interval so a long run cannot drift.\n\n" + body,
    }
}))
PY
