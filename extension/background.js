// Toolbar click (or Alt+Shift+P) injects print-article.js into the active tab.
// Same logic as the bookmarklet; print-article.js is generated from
// bookmarklet.src.js by ../build.sh.

const X_HOST = /(^|\.)(x\.com|twitter\.com)$/;

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
  let host = "";
  try {
    host = new URL(tab.url || "").hostname;
  } catch (e) {
    host = "";
  }
  if (!X_HOST.test(host)) {
    await badge(tab.id, "!", "#c0392b");
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["print-article.js"],
    });
  } catch (e) {
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
