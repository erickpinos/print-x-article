// Build the throwaway harness: for each fixture, an inject script and a copy of
// the page that loads it.
//
// The inject is extension/print-article.js with the printing tail replaced by a
// dump into <pre id=out>, so --dump-dom can carry the generated document back
// out. location.hostname is substituted with the fixture's real host, which is
// what exercises the per-site table in the script.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const TEST = path.join(ROOT, "test");
const TMP = path.join(TEST, ".tmp");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(TEST, "expected.json"), "utf8"));

const TAIL = "var origTitle=document.title;";
const DUMP =
  'document.documentElement.innerHTML="<body><pre id=out></pre></body>";' +
  'document.getElementById("out").textContent=doc;})();';

fs.mkdirSync(TMP, { recursive: true });

const built = fs.readFileSync(path.join(ROOT, "extension", "print-article.js"), "utf8");
const cut = built.indexOf(TAIL);
if (cut < 0) throw new Error("print-article.js: printing tail not found, cannot build the harness");
const dumpScript = built.slice(0, cut) + DUMP;

// Readability is injected first by background.js; do the same here.
fs.copyFileSync(
  path.join(ROOT, "extension", "vendor", "Readability.js"),
  path.join(TMP, "Readability.js")
);

const names = Object.keys(EXPECTED).filter((k) => !k.startsWith("_"));
for (const name of names) {
  const host = EXPECTED[name].host || "";
  const base = name.replace(/\.html$/, "");

  fs.writeFileSync(
    path.join(TMP, "inject-" + base + ".js"),
    dumpScript.split("location.hostname").join(JSON.stringify(host))
  );

  let page = fs.readFileSync(path.join(TEST, "fixtures", name), "utf8");

  // A <base> pointing at the real origin, so root-relative URLs resolve the way
  // they do on the live site. Without it, Cloudflare's /_image?href=... becomes
  // file:///_image?... and the script rejects it as a non-http scheme, which
  // looks exactly like a regression in the header-image logic.
  if (host && !/<base\s/i.test(page)) {
    const baseTag = '<base href="https://' + host + '/">';
    page = /<head[^>]*>/i.test(page)
      ? page.replace(/<head[^>]*>/i, (m) => m + baseTag)
      : baseTag + page;
  }

  // The harness scripts must be absolute file:// URLs: the <base> above would
  // otherwise send them to the remote origin, where they do not exist, and the
  // fixture would silently render as an unprocessed page.
  const tags =
    '<script src="file://' + path.join(TMP, "Readability.js") + '"></script>' +
    '<script src="file://' + path.join(TMP, "inject-" + base + ".js") + '"></script>';
  page = /<\/body>/i.test(page) ? page.replace(/<\/body>/i, tags + "</body>") : page + tags;
  fs.writeFileSync(path.join(TMP, base + ".html"), page);
}

console.log("prepared " + names.length + " fixtures in test/.tmp");
