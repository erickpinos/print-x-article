# Fixture suite

```sh
test/run.sh          # structure only, ~12s
test/run.sh --pdf    # structure + layout, ~15s (first run downloads images)
```

Exit code is non-zero on failure. `CHROME=/path/to/chrome` overrides browser
detection.

It builds before it runs, on purpose. Measuring a stale build is how a run
reports phantom regressions.

## What it does

1. `lib/prepare.js` takes the current `extension/print-article.js`, replaces the
   printing tail with a dump into `<pre id=out>`, and substitutes each fixture's
   real hostname for `location.hostname`. That substitution is what exercises
   the per-site `SITES` table.
2. Every fixture renders in its own headless Chrome, all at once. Wall clock is
   the slowest fixture rather than the sum: measured, one fixture alone took
   90.0s and all five together took 90.2s.

   Then most of that 90s turned out to be nothing. Headless Chrome writes its
   output and **does not exit**, so the timeout was the runtime. The dump lands
   within ~8s, and the PDF within ~2s, so the dumps use a 12s timeout and the
   PDF render polls until the file stops growing and then kills the process.
   Together: 90s to 12s, and `--pdf` from 3m30s to 15s.
3. `lib/report.js` checks the generated document against `expected.json`:
   counts, title, header image, avatar, and strings that must or must not
   appear.
4. With `--pdf`, `lib/pdf-check.js` renders the generated document the way the
   print dialog would and reads it back with `pdftotext`.

## Why the PDF pass exists

Structural checks cannot see a layout bug. The long-gap bug had every block
correct and in the right order, and still left half of page 1 blank: a tall hero
image plus `orphans: 3` pushed a whole paragraph to the next page. The assertion
that catches it is one line of text, `page1EndsWith`, plus a page-count ceiling.

Verified by reintroducing the bug: with the hero cap back at 11cm the suite
reports 9 pages instead of 8 and page 1 ending mid-paragraph.

Needs `pdftotext` (`brew install poppler`).

## Image cache

`--pdf` downloads each image once into `test/cache/` (gitignored) and rewrites
the document to point at the local copies.

Images have to load, because their height is what the page breaks depend on. But
re-fetching ~20 MB per run is most of the wall clock, and a CDN hiccup or a
changed image would show up as a layout regression that isn't one. Cached, the
render is deterministic and offline. Delete the directory to re-fetch.

## Fixture hygiene

Captured pages are trimmed with `lib/trim-fixture.js` before being committed:

```sh
node test/lib/trim-fixture.js test/fixtures/*.html && test/run.sh --pdf
```

It strips scripts, styles, link tags, SVG, iframes, comments and oversized
inline `style`/`data-*` payloads. 1.2 MB became 628 KB, renders got faster and
more deterministic (the page's own JS no longer runs), and the publishers'
client tokens went with the scripts.

It deliberately does **not** trim to the article container. The promo and login
modules reader mode has to drop, the header-image wrapper and the byline
furniture are all things the suite asserts on; cutting to the article would
delete the evidence. The check that a trim kept what matters is the suite
itself, so always re-run it after trimming.

`x-thread.html` is hand-written and carries no real accounts: the handles,
display names and status ids are invented.

## Fixtures

Seven, chosen so no fixture is one person's personal writing:

| File | Source | What it covers |
|---|---|---|
| `x-thread.html` | hand-written | Thread continuation, replies, a quoted tweet, a promoted tweet that must be skipped, emoji, an inline `@mention`. Invented handles and status ids |
| `xda-free-vpns.html` | XDA (live DOM dump) | Header image from `data-img-url` inside `<header>`, login and promo modules reader mode must drop, byline furniture, and the layout assertion |
| `github-case-folding.html` | github.blog | Long engineering post, code-heavy |
| `microsoft-typescript-57.html` | devblogs.microsoft.com | Release notes: many headings, many inline links |
| `aws-sqs-20.html` | aws.amazon.com/blogs | Enterprise template wrapped around a short article |
| `cloudflare-agentic.html` | blog.cloudflare.com (live DOM dump) | Client-rendered; a `curl` of it returns almost no prose |
| `wikipedia-prediction-market.html` | en.wikipedia.org | Long, link-dense, heavily nested |

The four company blogs earn their place: on their very first run they caught a
crash that all the earlier fixtures missed. A `<time>` element with no
`datetime` attribute made `getAttribute(...).slice()` throw, which killed the
whole script and printed nothing at all. Every X page has that attribute, so the
bug was invisible until a fixture from somewhere else existed.

**Flaky signals, do not assert on them:** Wikipedia's figure count moves between
runs, and the Microsoft lead image loads inconsistently in a headless render, so
its `hero` is not asserted.

`xda-free-vpns.html` is a **live** DOM dump because a `curl` of that page is not
the same page: the header image exists only as `data-img-url` on a wrapper until
the lazy loader runs. Refresh a live fixture with:

```sh
chrome --headless=new --virtual-time-budget=15000 --dump-dom "$URL" > test/fixtures/<name>.html
```

