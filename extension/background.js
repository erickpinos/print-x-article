// Toolbar click (or Alt+Shift+P) injects print-article.js into the active tab.
// Same logic as the bookmarklet; print-article.js is generated from
// bookmarklet.src.js by ../build.sh.
//
// The script routes itself: X article, X tweet/thread, or reader-mode
// extraction for any other site. So there is no host check here, and the
// permission is activeTab, which Chrome grants for the tab you are on at the
// moment you click the button or press the shortcut. That is deliberately
// narrower than host access to every site you visit.

async function badge(tabId, text, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 2500);
  } catch (e) {
    // tab closed mid-flight; nothing to report
  }
}

async function run(tab) {
  if (!tab || !tab.id) return;
  try {
    // Readability first: print-article.js uses it for the non-X path when the
    // global is there, and falls back to its own root pick when it isn't.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["vendor/Readability.js", "print-article.js"],
    });
  } catch (e) {
    // chrome:// pages, the Web Store, and PDFs refuse injection outright.
    console.error("Print X Article: injection failed", e);
    await badge(tab.id, "err", "#c0392b");
  }
}

chrome.action.onClicked.addListener(run);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "print-article") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await run(tab);
});
