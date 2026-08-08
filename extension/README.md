# Print X Article (Chrome extension)

The bookmarklet in this repo, packaged as an MV3 Chrome extension. Same code:
`print-article.js` is generated from `../bookmarklet.src.js` by `../build.sh`.

The two differ only where `../bookmarklet.src.js` guards a block with `IS_EXT`,
which `build.sh` flips to `true` for the extension build. Two things today: the
author's profile picture next to the byline, and reader-mode extraction for
non-X sites.

## Per-site hints

Routing is by page type, with a small table of per-site hints at the top of
`../bookmarklet.src.js`:

```js
var SITES=[
  {host:/(^|\.)(x\.com|twitter\.com)$/, kind:'x'},
  {host:/(^|\.)xda-developers\.com$/,    kind:'web',
   heroAttrs:['data-img-url'],           // header lives on a wrapper div
   furniture:['.with-excerpt']},         // author bio, two sentences, one div
];
```

These are **layered on the generic extraction, never in place of it**: an
unknown site still gets the full generic treatment, and an entry only overrides
the steps that one site gets wrong. Adding a site means adding a row.

The reason it exists: every quirk in that table started as a generic heuristic
written for one site and firing on all of them. An `og:image` header fallback
added for XDA is what put a header image on Substack posts that have none. A
named entry fails locally and visibly instead.

A rule stays generic when it identifies itself from the markup rather than from
the domain. `substack.com` therefore has no entry: its CDN crop is recognisable
from the URL shape (`/image/fetch/<transforms>/<url-encoded original>`) and its
avatar from an `alt` naming the author. `data-nosnippet` stays generic for the
same reason: it is Google's standard "not the main content" marker, not one
site's class name.

## What it prints

The script routes on what the page is:

| Page | Output |
|---|---|
| X long-form article | Headings, images, embedded tweet cards, code blocks (unchanged) |
| X tweet or thread | The tweet, then the author's own consecutive tweets as continuing body text, then a **Replies** section with each replier's avatar, name, handle and date |
| Anything else (extension only) | Reader-mode extraction of the article |

On a status page it keeps emoji (X renders them as `<img alt="😀">`, which
`innerText` drops), keeps `@mentions` and links inline instead of breaking them
onto their own lines, upgrades photos to `name=large` and avatars to
`_400x400`, renders a quoted tweet as a card, and skips promoted tweets, which
X drops into the conversation inside a `placementTracking` wrapper.

A thread needs nothing special: consecutive tweets from the same author flow
into one body, and the first sentence of the opening tweet becomes the title.

The non-X path runs **reading mode**: Mozilla's
[Readability](https://github.com/mozilla/readability), the engine behind
Firefox Reader View, vendored at `vendor/Readability.js` (Apache-2.0, from
Arc90's original). `background.js` injects it ahead of `print-article.js`, and
the script uses it when the global is present.

Chrome's own Reading Mode is not an option: it is a side panel with no
extension API to trigger it or read what it produced.

Readability gets a **clone** of the document, because it mutates the one it is
handed. When it is absent (the bookmarklet ships no vendor file) or bails on a
short page, the script falls back to the root pick ported from
**claude-chrome-bridge** (`extension/offscreen.js`): semantic container, else
the densest block, penalising link-dense nav rails.

Two things are still done against the live DOM, because Readability's output is
detached and has lost that context:

- **Image sizes.** A detached `<img>` has no `naturalWidth`, so live images are
  indexed by URL and the sizes looked up from there.
- **Byline furniture.** Reader mode keeps the dateline and the author bio,
  since both sit inside the article container, and once extracted the bio reads
  like an opening paragraph. Elements whose class or id mentions
  author/byline/bio/excerpt, plus anything marked `data-nosnippet`, are indexed
  first and their text is filtered out of the top of the body. The match is
  containment, not equality: XDA puts both bio sentences in one
  `<div class="with-excerpt">` split by `<br>`, so neither paragraph equals the
  container's text. Filtering stops as soon as the story starts, so a later
  paragraph that happens to resemble a bio is safe.

### What it keeps from the source

Reader mode is a rebuild, not a screenshot, and it deliberately prints in this
project's own type rather than the site's:

- **Inline markup** (`bold`, *italic*, links, `code`, sup/sub) instead of flat
  text. Text nodes are escaped and only a whitelist of tags is emitted.
- **Figure captions**, and the subtitle as a plain paragraph rather than as a
  stray section heading.
- **Uncropped images.** Substack-style CDNs serve
  `/image/fetch/<transforms>/<url-encoded original>`; the original URL is
  decoded back out of it.
- **A header image only when the page itself has one**, found in the live DOM
  rather than in the extracted content, since reader mode drops it (it sits
  outside the prose) and the first image of the extracted content is a body
  image, not the header. The boundary is where the prose starts, which is not
  the first `<p>`: the byline, dateline and dek are short paragraphs sitting
  above the header. XDA carries the header as `data-img-url` on a wrapper
  `<div>` with no `<img>` until its lazy loader runs, and it lives inside
  `<header>`, so the header-image search uses a narrower skip list than the
  body does. `og:image` is never used as a fallback: it exists on nearly every
  post as a social card, and on Substack it is the first body image, so falling
  back to it put a header on articles that have none.
- **The author's avatar** next to the byline, the same as the X paths. Nothing
  standardises this, so it takes an image inside a byline/author container or
  one whose `alt` says "avatar", preferring a hit whose `alt` names the author
  so a "more from this site" rail can't win, and sanity-checks the pixel size.

Heading levels are flattened to `h2`, and the font family, size, colour and
line height are this project's, not the page's. An earlier version sampled type
from the source; that was reverted deliberately, so don't reintroduce it.

The short-text filter is 40 characters only when the root pick fell back to
`<body>`, where it keeps nav and promo text out. Inside a confidently-picked
article container the floor drops to 10, so one-line paragraphs, pull quotes
and sign-offs survive.

### Printing waits for images

The print fires once the images in the built document have decoded, capped at
8 seconds so one dead image can't hold the dialog. The old fixed 700 ms delay
was invisible on X, where every image is already cached from the page you are
looking at, but a header image pulled from `og:image` is a URL the browser has
never fetched, and it printed as an empty box.

## Tests

```sh
test/run.sh          # structure only
test/run.sh --pdf    # + layout, rendered to PDF and read back with pdftotext
```

Five fixtures covering both X paths and three websites. See `../test/README.md`.
Run it before touching `../bookmarklet.src.js`: the layout assertion catches the
class of bug that structural checks cannot see.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select this `extension/` folder

## Use

On any page, either:

- click the toolbar icon, or
- press **Alt+Shift+P**

The page is reformatted into the print layout and the print dialog opens. The
document title is temporarily swapped to `Author - Title` so "Save as PDF"
suggests a sane filename, then restored when the dialog closes.

Chrome refuses injection on `chrome://` pages, the Web Store, and other
privileged tabs no matter what an extension asks for. Those flash a grey `n/a`
badge and log which origin refused, rather than reporting a failure. A `file://`
page needs **Allow access to file URLs** on `chrome://extensions`, a
per-extension toggle no manifest can request; that case names itself in the
console.

### Why host_permissions, not just activeTab

`activeTab` was the original choice, since it grants access only to the tab you
are on at the moment you invoke the extension rather than to every site you
visit. It turned out not to be reliable enough: an invocation Chrome does not
count as a user gesture on that exact tab fails with *"Cannot access contents
of the page. Extension manifest must request permission to access the
respective host."* `host_permissions: ["<all_urls>"]` covers every page, at the
cost of a broader install prompt. `activeTab` is kept alongside it so the
extension still works on the current tab if host access is ever revoked from
`chrome://extensions`.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest: `scripting` + `activeTab` + `host_permissions`, toolbar action, keyboard command |
| `background.js` | Service worker; injects `print-article.js` into the active tab on click/shortcut |
| `print-article.js` | **Generated** — do not edit; edit `../bookmarklet.src.js` and run `../build.sh` |
| `vendor/Readability.js` | Vendored Mozilla Readability (Apache-2.0), injected before the print script |
| `icons/icon.svg` | Printer with the X logo on the printed sheet; the single source for all four icon sizes |

Regenerate the icons after editing the SVG. All four sizes come from the one
file, so the toolbar, the extensions manager, and the store listing always show
the same mark:

```sh
cd extension/icons
for s in 16 32 48 128; do magick -background none icon.svg -resize ${s}x${s} icon${s}.png; done
```

Keep the shapes and the gaps between them coarse when editing it. Fine detail
survives at 128px and turns to grey mush at 16px, which is what forced a second,
simplified SVG the first time around.
