#!/bin/sh
# Run the fixture suite against the CURRENT build.
#
#   test/run.sh          structure only  (~15s)
#   test/run.sh --pdf    structure + layout assertions rendered to PDF
#
# It builds first, on purpose: a blocked or forgotten build is how a run ends up
# measuring yesterday's code and reporting phantom regressions.
set -e
cd "$(dirname "$0")/.."

CHROME=${CHROME:-}
if [ -z "$CHROME" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$(command -v google-chrome || true)" \
           "$(command -v chromium || true)"; do
    [ -x "$c" ] && CHROME="$c" && break
  done
fi
[ -x "$CHROME" ] || { echo "no Chrome found; set CHROME=/path/to/chrome" >&2; exit 1; }
export CHROME

./build.sh >/dev/null
node test/lib/prepare.js

# Each fixture is an independent headless render, so run them at once: wall
# clock becomes the slowest fixture instead of the sum of all of them.
for f in test/.tmp/*.html; do
  case "$f" in *-out.html|*-print.html) continue;; esac
  base=$(basename "$f" .html)
  # 12s, not 90: the dump lands within ~8s and headless Chrome then sits there
  # rather than exiting, so the timeout IS the runtime. Killing it after the
  # dump is written takes the suite from 90s to ~15s.
  timeout 12 "$CHROME" --headless=new --disable-gpu \
    --user-data-dir="test/.tmp/chrome-dump-$base" \
    --virtual-time-budget=6000 --dump-dom "file://$PWD/$f" \
    > "test/.tmp/$base-out.html" 2>/dev/null &
done
wait

node test/lib/report.js
status=$?

if [ "$1" = "--pdf" ]; then
  echo
  node test/lib/pdf-check.js || status=1
fi

exit $status
