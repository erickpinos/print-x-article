// Shrink a captured page to the parts under test.
//
//   node test/lib/trim-fixture.js test/fixtures/*.html
//
// Removes what the extraction never looks at and what makes a fixture heavy or
// non-deterministic: scripts (including JSON-LD and inline analytics payloads,
// which is where a site's own client tokens live), stylesheets, link/meta
// preloads, SVG sprites, noscript, iframes and comments.
//
// It deliberately keeps the page's whole element structure, not just the
// article: the promo and login modules reader mode has to drop, the header
// image wrapper, and the byline furniture are all things the suite asserts on.
// Trimming to the article container would delete the evidence.
//
// Re-run the suite after trimming. That is the check that the trim kept
// whatever mattered.
const fs = require("fs");

const RULES = [
  [/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""],
  [/<style\b[^>]*>[\s\S]*?<\/style>/gi, ""],
  [/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ""],
  [/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ""],
  [/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ""],
  [/<!--[\s\S]*?-->/g, ""],
  [/<link\b[^>]*>/gi, ""],
  // Inline styles are layout-irrelevant here (the print document brings its
  // own CSS) and are a large share of the bytes on a modern page.
  [/\sstyle="[^"]{200,}"/gi, ""],
  // Long data-* payloads (Wikipedia's data-mw, editor state, tracking blobs).
  // The threshold keeps the short ones the extraction actually reads:
  // data-img-url, data-testid, data-nosnippet.
  [/\sdata-[a-z-]+="[^"]{200,}"/gi, ""],
  [/\n{3,}/g, "\n\n"],
  [/[ \t]{4,}/g, "  "],
];

for (const file of process.argv.slice(2)) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [re, to] of RULES) after = after.replace(re, to);
  fs.writeFileSync(file, after);
  const kb = (n) => (n / 1024).toFixed(0) + " KB";
  console.log(
    file.replace(/^.*\//, "").padEnd(34) +
    kb(before.length) + " -> " + kb(after.length) +
    "  (-" + Math.round((1 - after.length / before.length) * 100) + "%)"
  );
}
