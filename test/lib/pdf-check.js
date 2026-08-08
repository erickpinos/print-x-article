// Layout assertions: render the generated document the way the print dialog
// would, then read the result back with pdftotext.
//
// Structural checks cannot see this class of bug. The long-gap bug was a tall
// hero image interacting with `orphans: 3`: every block was correct and in the
// right order, and half of page 1 was still blank. "Where does page 1 end" is
// one line of text, which makes it cheap to assert and cheap to bisect.
//
// Images are cached to disk first. They have to load, because their height is
// what the page breaks depend on, but re-fetching them per run costs ~20 MB and
// most of the wall clock, and a CDN hiccup would look like a layout regression.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const TEST = path.resolve(__dirname, "..");
const TMP = path.join(TEST, ".tmp");
const CACHE = path.join(TEST, "cache");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(TEST, "expected.json"), "utf8"));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const RENDER_CONCURRENCY = 3;
const FETCH_CONCURRENCY = 8;

function run(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1 << 26 }, (err, stdout) =>
      resolve({ err, stdout: stdout || "" })
    );
  });
}

// Headless Chrome writes the PDF and then does not exit, so a fixed timeout IS
// the runtime: 2s of work behind a 120s wait. Poll until the file has stopped
// growing, then kill it.
function renderPdf(chrome, args, out, hardTimeoutMs) {
  return new Promise((resolve) => {
    const child = execFile(chrome, args, { timeout: hardTimeoutMs }, () => {});
    let lastSize = -1;
    let stable = 0;
    const started = Date.now();
    const tick = setInterval(() => {
      let size = 0;
      try { size = fs.statSync(out).size; } catch (e) { size = 0; }
      if (size > 0 && size === lastSize) stable++;
      else stable = 0;
      lastSize = size;
      const done = stable >= 2;
      if (done || Date.now() - started > hardTimeoutMs) {
        clearInterval(tick);
        try { child.kill("SIGKILL"); } catch (e) {}
        setTimeout(() => resolve(done), 150);
      }
    }, 300);
  });
}

// Run `jobs` (thunks returning promises) with a ceiling on how many are in
// flight. Renders are heavy; unbounded parallelism just swaps.
async function pool(jobs, limit) {
  const out = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    })
  );
  return out;
}

function cacheName(url) {
  const ext = (url.split("?")[0].match(/\.(jpe?g|png|gif|webp|avif)$/i) || [".img"])[0];
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + ext;
}

async function cacheImages(doc) {
  fs.mkdirSync(CACHE, { recursive: true });
  const urls = [...new Set((doc.match(/<img[^>]*src="(https?:[^"]+)"/g) || []).map(
    (t) => t.match(/src="(https?:[^"]+)"/)[1]
  ))];

  const jobs = urls.map((url) => async () => {
    const file = path.join(CACHE, cacheName(url));
    if (fs.existsSync(file)) return { url, file, cached: true };
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) return { url, file: null };
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return { url, file, cached: false };
    } catch (e) {
      return { url, file: null };
    }
  });

  const got = await pool(jobs, FETCH_CONCURRENCY);
  let out = doc;
  let hits = 0, misses = 0;
  for (const g of got) {
    if (!g.file) { misses++; continue; }
    if (g.cached) hits++;
    // The print HTML lives in .tmp/, the cache one level up.
    out = out.split('"' + g.url + '"').join('"../cache/' + path.basename(g.file) + '"');
  }
  return { html: out, total: got.length, hits, misses };
}

async function checkOne(name) {
  const want = EXPECTED[name];
  const base = name.replace(/\.html$/, "");
  const dumped = path.join(TMP, base + "-out.html");
  if (!fs.existsSync(dumped)) return { base, problems: ["no dump to render"] };

  const m = fs.readFileSync(dumped, "utf8").match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!m) return { base, problems: ["no generated document in the dump"] };
  const doc = m[1]
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&");

  const { html, total, hits, misses } = await cacheImages(doc);
  const printHtml = path.join(TMP, base + "-print.html");
  const pdf = path.join(TMP, base + ".pdf");
  const txt = path.join(TMP, base + ".txt");
  fs.writeFileSync(printHtml, html);
  fs.rmSync(pdf, { force: true });

  await renderPdf(CHROME, [
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--user-data-dir=" + path.join(TMP, "chrome-" + base),
    "--print-to-pdf=" + pdf, "--virtual-time-budget=8000",
    "file://" + printHtml,
  ], pdf, 60000);

  if (!fs.existsSync(pdf)) return { base, problems: ["chrome did not produce a pdf"] };
  await run("pdftotext", [pdf, txt], 60000);
  if (!fs.existsSync(txt)) return { base, problems: ["pdftotext failed (brew install poppler)"] };

  const pages = fs.readFileSync(txt, "utf8").split("\f");
  const page1 = pages[0].split("\n").filter((l) => l.trim()).join("\n");
  const problems = [];

  if (want.pdf.maxPages && pages.length - 1 > want.pdf.maxPages)
    problems.push("rendered " + (pages.length - 1) + " pages, want <= " + want.pdf.maxPages);
  if (want.pdf.page1EndsWith && !page1.trimEnd().endsWith(want.pdf.page1EndsWith))
    problems.push(
      'page 1 ends "' + page1.trimEnd().slice(-52) + '", want it to end "' + want.pdf.page1EndsWith + '"'
    );

  return { base, problems, pages: pages.length - 1, images: total, hits, misses };
}

(async () => {
  const names = Object.keys(EXPECTED).filter((k) => !k.startsWith("_") && EXPECTED[k].pdf);
  if (!names.length) { console.log("no pdf assertions declared"); return; }

  const results = await pool(names.map((n) => () => checkOne(n)), RENDER_CONCURRENCY);
  let failures = 0;
  for (const r of results) {
    if (r.problems.length) failures++;
    console.log(
      (r.problems.length ? "FAIL " : "ok   ") + r.base.padEnd(32) +
      " pages=" + (r.pages ?? "-") +
      " images=" + (r.images ?? 0) + " (cached " + (r.hits ?? 0) + ", missing " + (r.misses ?? 0) + ")"
    );
    r.problems.forEach((p) => console.log("       " + p));
  }
  console.log(failures ? "\n" + failures + " layout check(s) failing" : "\nall layout checks pass");
  process.exit(failures ? 1 : 0);
})();
