// Read each fixture's dumped output and check it against test/expected.json.
// Structural assertions only; the PDF/layout assertions live in pdf-check.js.
const fs = require("fs");
const path = require("path");

const TEST = path.resolve(__dirname, "..");
const TMP = path.join(TEST, ".tmp");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(TEST, "expected.json"), "utf8"));

function extract(base) {
  const file = path.join(TMP, base + "-out.html");
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, "utf8").match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!m) return null;
  return m[1]
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

let failures = 0;
const names = Object.keys(EXPECTED).filter((k) => !k.startsWith("_"));

for (const name of names) {
  const want = EXPECTED[name];
  const base = name.replace(/\.html$/, "");
  const doc = extract(base);
  const problems = [];

  if (!doc) {
    console.log("FAIL " + base + " — no output (render failed?)");
    failures++;
    continue;
  }

  const body = doc.slice(doc.indexOf("<body>"));
  const count = (re) => (body.match(re) || []).length;
  const stats = {
    p: count(/<p>/g),
    h2: count(/<h2>/g),
    figures: count(/<figure>/g),
    links: count(/<a href="http/g),
    strong: count(/<strong>/g),
    replies: count(/class="reply"/g),
    hero: /class="hero"/.test(body),
    avatar: /class="avatar"/.test(body),
    title: (body.match(/<h1>([^<]*)</) || [])[1] || "",
  };

  if (want.title !== undefined && stats.title !== want.title)
    problems.push('title is "' + stats.title + '"');
  if (want.hero !== undefined && stats.hero !== want.hero)
    problems.push(want.hero ? "expected a header image, got none" : "unexpected header image");
  if (want.avatar !== undefined && stats.avatar !== want.avatar)
    problems.push(want.avatar ? "expected an author avatar" : "unexpected author avatar");
  if (want.minParagraphs && stats.p < want.minParagraphs)
    problems.push("only " + stats.p + " paragraphs, want >= " + want.minParagraphs);
  if (want.minFigures && stats.figures < want.minFigures)
    problems.push("only " + stats.figures + " figures, want >= " + want.minFigures);
  if (want.minLinks && stats.links < want.minLinks)
    problems.push("only " + stats.links + " links, want >= " + want.minLinks);
  if (want.minStrong && stats.strong < want.minStrong)
    problems.push("only " + stats.strong + " bold runs, want >= " + want.minStrong);
  if (want.replies !== undefined && stats.replies !== want.replies)
    problems.push(stats.replies + " replies, want " + want.replies);
  for (const s of want.mustContain || [])
    if (!body.includes(s)) problems.push('missing: "' + s + '"');
  for (const s of want.mustNotContain || [])
    if (body.includes(s)) problems.push('junk present: "' + s + '"');

  if (problems.length) failures++;
  console.log(
    (problems.length ? "FAIL " : "ok   ") + base.padEnd(32) +
    " p=" + stats.p + " h2=" + stats.h2 + " fig=" + stats.figures +
    " links=" + stats.links + " hero=" + stats.hero + " avatar=" + stats.avatar
  );
  problems.forEach((p) => console.log("       " + p));
}

console.log(failures ? "\n" + failures + " fixture(s) failing" : "\nall fixtures pass");
process.exit(failures ? 1 : 0);
