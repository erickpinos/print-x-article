// Toolbar click (or Alt+Shift+P) injects print-article.js into the active tab.
// Same logic as the bookmarklet; print-article.js is generated from
// bookmarklet.src.js by ../build.sh.
//
// The script routes itself: X article, X tweet/thread, or reader-mode
// extraction for any other site. So there is no host check here.
//
// Permissions: activeTab alone was not enough. It is granted only for the tab
// you are on at the moment you invoke the extension, and an invocation Chrome
// does not count as a user gesture on that exact tab fails with "Cannot access
// contents of the page. Extension manifest must request permission to access
// the respective host." host_permissions covers every page instead, at the
// cost of a broader install prompt.

// Pages no extension may touch, whatever it asks for. Worth naming so they
// report as "not this page" rather than as a failure.
const BLOCKED = /^(chrome|chrome-extension|chrome-untrusted|devtools|edge|about|view-source|data):/i;
const BLOCKED_HOSTS = /(^|\.)(chrome\.google\.com|chromewebstore\.google\.com)$/i;

async function badge(tabId, text, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 2500);
  } catch (e) {
    // tab closed mid-flight; nothing to report
  }
}

// Origin only, never the full URL: a query string can carry a token, and this
// goes to a console anyone can screenshot. The origin says which page refused,
// which is all the message needs.
function originOf(u) {
  try {
    return new URL(u).origin;
  } catch (e) {
    return String(u || "").split(":")[0] + ":";
  }
}

function restricted(u) {
  if (!u) return false;
  if (BLOCKED.test(u)) return true;
  try {
    return BLOCKED_HOSTS.test(new URL(u).hostname);
  } catch (e) {
    return false;
  }
}

async function run(tab) {
  if (!tab || !tab.id) return;
  const origin = originOf(tab.url);
  const isFile = /^file:/i.test(tab.url || "");

  if (restricted(tab.url)) {
    console.warn("Print X Article: Chrome blocks injection on", origin);
    await badge(tab.id, "n/a", "#7f8c8d");
    return;
  }
  try {
    // Readability first: print-article.js uses it for the non-X path when the
    // global is there, and falls back to its own root pick when it isn't.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["vendor/Readability.js", "print-article.js"],
    });
  } catch (e) {
    // A local file needs "Allow access to file URLs" on chrome://extensions,
    // a per-extension toggle no manifest can request.
    const hint = isFile ? ' Turn on "Allow access to file URLs" for this extension.' : "";
    console.error("Print X Article: injection failed on " + origin + "." + hint, e);
    await badge(tab.id, "err", "#c0392b");
  }
}

chrome.action.onClicked.addListener(run);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "print-article") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await run(tab);
});
