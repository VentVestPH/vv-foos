#!/bin/bash
# Heartbeat for the workstream V run: proves progress and proves alignment.
# Emits one line every 90s. Says STALLED if the corpus stops growing while a
# capture is running, DIED if the capture vanished before finishing, and lists
# which of the plan's V1-V13 items have a deliverable on disk.

ROOT=/Users/klentz/Work/VV-FoOS
LOG=/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/finish-v.log
SWEEPLOG=/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/sweep-all.log
HIGH=/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/checker.manifest-high
STATE=/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/checker.state
DOCS=$ROOT/docs/11-component-audit

prev=0
[ -f "$STATE" ] && prev=$(cat "$STATE")
stall=0

while true; do
  images=$(find "$ROOT/audit/corpus" -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
  area=$(grep -hE '^=== AREA' "$SWEEPLOG" "$LOG" 2>/dev/null | tail -1 | sed 's/=== AREA //;s/ starting.*/ (running)/;s/ done.*/ (done)/')

  # manifest integrity: a manifest must never shrink. Harness defect 10 was a
  # supplementary pass overwriting the manifest of the area it supplemented,
  # which cost recruit 4,358 entries and reported success while doing it.
  shrunk=""
  for mf in "$ROOT"/audit/corpus/manifest.*.json; do
    [ -f "$mf" ] || continue
    tag=$(basename "$mf" | sed 's/manifest\.//;s/\.json//')
    n=$(node -e "try{console.log(require('$mf').length)}catch(e){console.log(0)}" 2>/dev/null)
    hi=0
    [ -f "$HIGH.$tag" ] && hi=$(cat "$HIGH.$tag")
    if [ "$n" -lt "$hi" ]; then
      shrunk="$shrunk $tag:$n<$hi"
    else
      echo "$n" > "$HIGH.$tag"
    fi
  done
  alive=$(pgrep -f 'playwright test' | wc -l | tr -d ' ')
  finished=$(grep -c 'ALL PASSES DONE' "$LOG" 2>/dev/null)

  # alignment: one deliverable per plan item, checked on disk
  done_items=""
  pending=""
  check() { # name, path-or-glob
    if compgen -G "$2" > /dev/null 2>&1; then done_items="$done_items $1"; else pending="$pending $1"; fi
  }
  check V1 "$DOCS/*V1-Component-Inventory*"
  check V2 "$ROOT/audit/corpus/manifest.*.json"
  check V3 "$DOCS/*V3-Browser-Defaults*"
  check V4 "$DOCS/*V4-ARIA-Contracts*"
  check V5 "$DOCS/*V5-Taleo*"
  check V6 "$DOCS/*V6-Audit-Table*"
  check V7 "$DOCS/*Spec_V7*"
  check V8 "$DOCS/*V8-Priority*"
  check V9 "$ROOT/audit/corpus/measure-controls.json"
  check V10 "$ROOT/audit/corpus/pass3-steps.json"
  check V11 "$DOCS/*V11-Design-References*"
  check V12 "$DOCS/*V6-Audit-Table*"
  check V13 "$ROOT/audit/corpus/measure-density.json"

  ndone=$(echo "$done_items" | wc -w | tr -d ' ')

  status="OK"
  if [ -n "$shrunk" ]; then
    status="MANIFEST-SHRANK:${shrunk}"
  elif [ "$finished" -gt 0 ]; then
    status="ALL-PASSES-COMPLETE"
  elif [ "$alive" -eq 0 ]; then
    status="DIED-capture-not-running"
  elif [ "$images" -eq "$prev" ]; then
    stall=$((stall + 1))
    [ "$stall" -ge 2 ] && status="STALLED-${stall}-checks-no-new-images"
  else
    stall=0
  fi

  echo "$(date +%H:%M:%S) $status | images=$images (+$((images - prev))) | area=${area:-none} | plan $ndone/13 done:${done_items} | pending:${pending}"
  prev=$images
  echo "$prev" > "$STATE"
  sleep 90
done
