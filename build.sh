#!/bin/sh
# Build the one-line bookmarklet from the readable source.
# Edit bookmarklet.src.js (multi-line, normal quotes), then run: ./build.sh
# Output: x-print-bookmarklet  (select-all + copy this into the bookmark URL field)
#
# How it works: strip the indentation from each line, join all lines with a
# single space (always a safe token separator in JS), then URL-encode the
# single quotes as %27 so they survive being pasted into a bookmark URL.
set -e
cd "$(dirname "$0")"
sed 's/^[[:space:]]*//' bookmarklet.src.js | tr '\n' ' ' | sed "s/'/%27/g" | sed 's/ *$//' > x-print-bookmarklet
echo "Built x-print-bookmarklet ($(wc -c < x-print-bookmarklet | tr -d ' ') bytes)"
