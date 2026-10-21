// Unshell Popup Script
const MAX_FILENAME_LENGTH = 100;

// Create a proper browserAPI wrapper for the popup
const browserAPI = (function () {
  // Check if we're in Firefox (browser is defined) or Chrome (chrome is defined)
  const isBrowser = typeof browser !== "undefined";
  const isChrome = typeof chrome !== "undefined";

  // Base object
  const api = {};

  if (isBrowser) {
    // Firefox already has promise-based APIs
    api.tabs = browser.tabs;
    api.runtime = browser.runtime;
    api.storage = browser.storage;
    api.commands = browser.commands;
    api.permissions = browser.permissions;
  } else if (isChrome) {
    // Chrome APIs
    api.tabs = {
      query: function (queryInfo) {
        return new Promise((resolve, reject) => {
          chrome.tabs.query(queryInfo, (tabs) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
            } else {
              resolve(tabs);
            }
          });
        });
      },
      sendMessage: function (tabId, message) {
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
            } else {
              resolve(response);
            }
          });
        });
      },
    };

    api.runtime = chrome.runtime;


    // The settings live in `sync`, wrapped in promises like the rest.
    const promiseArea = (area) => ({
      get: function (keys) {
        return new Promise((resolve, reject) => {
          area.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
            } else {
              resolve(result);
            }
          });
        });
      },
      set: function (items) {
        return new Promise((resolve, reject) => {
          area.set(items, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
            } else {
              resolve();
            }
          });
        });
      },
    });

    api.storage = {
      sync: promiseArea(chrome.storage.sync),
    };

    api.commands = chrome.commands;
  }

  return api;
})();

// DOM elements - Main view
const convertBtn = document.getElementById("convertBtn");
const convertSplit = document.getElementById("convertSplit");
const pageGlyph = document.getElementById("pageGlyph");
const pageHost = document.getElementById("pageHost");
const pageTitle = document.getElementById("pageTitle");
const pageTabs = document.getElementById("pageTabs");
const convertOverrideBtn = document.getElementById("convertOverrideBtn");
const convertOverrideLabel = convertOverrideBtn ? convertOverrideBtn.querySelector(".override-label") : null;
const copySelectionBtn = document.getElementById("copySelectionBtn");
const chatAction = document.getElementById("chatAction");
const telegramAction = document.getElementById("telegramAction");
const copyTelegramBtn = document.getElementById("copyTelegramBtn");
const telegramBtnText = document.getElementById("telegramBtnText");
const telegramSegments = document.getElementById("telegramSegments");
const telegramPeriods = document.getElementById("telegramPeriods");
const telegramCustomDates = document.getElementById("telegramCustomDates");
const telegramDateFromInput = document.getElementById("telegramDateFrom");
const telegramDateToInput = document.getElementById("telegramDateTo");
const telegramDateClearBtn = document.getElementById("telegramDateClear");
const aboutVersionEl = document.getElementById("aboutVersion");
const aboutBuildEl = document.getElementById("aboutBuild");
const copyChatBtn = document.getElementById("copyChatBtn");
const chatSegments = document.getElementById("chatSegments");
const chatPageFallbackBtn = document.getElementById("chatPageFallbackBtn");
let chatExchangeLimitValue = "10";
let chatRangeModeValue = "days";
let chatDaysValue = "3";
const chatDaySegments = document.getElementById("chatDaySegments");
const chatDaysSelect = document.getElementById("chatDays");
const chatExchangeSelect = document.getElementById("chatExchangeDefault");
const showChatRangeCheckbox = document.getElementById("showChatRange");
const chatRangeRadios = document.querySelectorAll('input[name="chatRangeMode"]');
const downloadBtn = document.getElementById("downloadBtn");
const statusIndicator = document.getElementById("statusIndicator");

// DOM elements - Multi-tab mode
const singleTabActions = document.getElementById("singleTabActions");
const multiTabActions = document.getElementById("multiTabActions");
const selectedTabCount = document.getElementById("selectedTabCount");
const copyAllBtn = document.getElementById("copyAllBtn");
const downloadMergedBtn = document.getElementById("downloadMergedBtn");
const downloadZipBtn = document.getElementById("downloadZipBtn");

// DOM elements - Views
const mainView = document.getElementById("mainView");
const settingsView = document.getElementById("settingsView");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const backToMainBtn = document.getElementById("backToMainBtn");

// DOM elements - Theme
const lightThemeBtn = document.getElementById("lightThemeBtn");
const darkThemeBtn = document.getElementById("darkThemeBtn");
const autoThemeBtn = document.getElementById("autoThemeBtn");
const bodyTag = document.querySelector("body");

// DOM elements - Settings
const popupShortcut = document.getElementById("popupShortcut");
const quickConvertShortcut = document.getElementById("quickConvertShortcut");
const downloadShortcut = document.getElementById("downloadShortcut");

const THEME_KEY = "unshell-theme";
// Which of the three the user actually picked: "light", "dark" or "auto".
// THEME_KEY alone could not answer that — older builds wrote it on every start,
// so a popup that had merely *shown* a theme was indistinguishable from one the
// user had chosen, and "follow the browser" could never come back on.
const THEME_CHOICE_KEY = "unshell-theme-choice";
const THEMES = { DARK: "dark", LIGHT: "light" };

// Get all settings elements
const contentScopeRadios = document.querySelectorAll('input[name="contentScope"]');
const preserveTablesCheckbox = document.getElementById("preserveTables");
const includeImagesCheckbox = document.getElementById("includeImages");
const includeTitleCheckbox = document.getElementById("includeTitle");
const includeLinksCheckbox = document.getElementById("includeLinks");
const includeMetadataCheckbox = document.getElementById("includeMetadata");
const metadataFormatTextarea = document.getElementById("metadataFormat");
const metadataFormatContainer = document.getElementById("metadataFormatContainer");
const resetMetadataFormatBtn = document.getElementById("resetMetadataFormat");
const debugModeCheckbox = document.getElementById("debugMode");
const copyLogsBtn = document.getElementById("copyLogsBtn");
const triggerLazyLoadingCheckbox = document.getElementById("triggerLazyLoading");
const redditModeCheckbox = document.getElementById("redditMode");
const redditCommentSortSelect = document.getElementById("redditCommentSort");
const redditMaxCommentsSelect = document.getElementById("redditMaxComments");
const xModeCheckbox = document.getElementById("xMode");
const xIncludeRepliesCheckbox = document.getElementById("xIncludeReplies");
const xMaxPostsSelect = document.getElementById("xMaxPosts");
const githubModeCheckbox = document.getElementById("githubMode");
const githubIncludeReadmeCheckbox = document.getElementById("githubIncludeReadme");
const githubIncludeTreeCheckbox = document.getElementById("githubIncludeTree");
const githubMaxTreeEntriesSelect = document.getElementById("githubMaxTreeEntries");
const youtubeModeCheckbox = document.getElementById("youtubeMode");
const youtubeIncludeDescriptionCheckbox = document.getElementById("youtubeIncludeDescription");
const youtubeIncludeCommentsCheckbox = document.getElementById("youtubeIncludeComments");
const youtubeMaxCommentsSelect = document.getElementById("youtubeMaxComments");
const discordModeCheckbox = document.getElementById("discordMode");
const discordMaxMessagesSelect = document.getElementById("discordMaxMessages");

// Token Counter DOM elements
const tokenCounter = document.getElementById("tokenCounter");
const tokenCountValue = document.getElementById("tokenCountValue");
const showTokenCountCheckbox = document.getElementById("showTokenCount");


// Current token count for display
let currentTokenCount = 0;

// Default token counter settings
const DEFAULT_TOKEN_SETTINGS = {
  showTokenCount: true,
  // The threshold that decides clipboard versus file. 8k was a 2023 number and
  // would send almost every real page to a download; 128k is what the models
  // people paste into actually take, so the file route is reserved for the
  // documents that genuinely will not fit.
  tokenContextLimit: 128000
};

// ---------------------------------------------------------------------------
// FLUID NAVIGATION
// ---------------------------------------------------------------------------
// The settings panel is a surface the user can push, not a slide that plays.
// One spring owns a single 0..1 progress value; the pointer writes to it
// directly while a finger is down and hands its release velocity to the spring
// afterwards, so a half-open panel can be grabbed, reversed or thrown at any
// moment without waiting for anything to finish.

const Motion = window.UnshellMotion;

const navSpring = new Motion.Spring(0, {
  damping: Motion.PRESETS.move.damping,
  response: Motion.PRESETS.move.response,
  onUpdate: (progress) => renderNav(progress)
});

function renderNav(progress) {
  // Settings fades in over the main view, in place. Neither view travels: a
  // panel that slid sideways moved under a held pointer and under text being
  // selected, and read as the popup sliding away from the hand.
  const shown = Motion.clamp(progress, 0, 1);
  settingsView.style.opacity = String(shown);
  mainView.style.opacity = String(1 - shown);

  const settingsShown = progress > 0.01;
  settingsView.setAttribute("aria-hidden", settingsShown ? "false" : "true");
  mainView.setAttribute("aria-hidden", progress > 0.99 ? "true" : "false");
  settingsView.classList.toggle("active", progress > 0.5);
}

function showSettingsView() {
  navSpring.to(1, Motion.PRESETS.move);
  // Focus the exit before the panel lands: the user must never be trapped.
  backToMainBtn.focus({ preventScroll: true });
}

function showMainView() {
  navSpring.to(0, Motion.PRESETS.move);
  openSettingsBtn.focus({ preventScroll: true });
}

// Both directions travel the same axis, and either can be driven by hand:
// drag left anywhere on the main view to reveal settings, drag right on the
// settings view to put it back.

// Theme management
function setTheme(theme, options) {
  const isDark = theme === THEMES.DARK;
  bodyTag.classList.toggle("dark-theme", isDark);
  bodyTag.classList.toggle("light-theme", !isDark);

  // The highlighted button is the *choice*, not the theme on screen: under
  // "auto" the popup may be dark while the chosen option is still auto.
  const choice = (options && options.choice) || localStorage.getItem(THEME_CHOICE_KEY) || "auto";
  if (autoThemeBtn) autoThemeBtn.classList.toggle("active", choice === "auto");
  lightThemeBtn.classList.toggle("active", choice === THEMES.LIGHT);
  darkThemeBtn.classList.toggle("active", choice === THEMES.DARK);

  // Following the system is a state of its own, not a third theme: the class
  // says which one is showing, storage says whether the user ever chose. Saving
  // on a system-driven change would silently pin the theme at whatever the OS
  // happened to be the first time the popup opened.
  if (!options || options.remember !== false) localStorage.setItem(THEME_KEY, theme);
}

// Picking light or dark pins it; picking auto hands control back to the browser.
function chooseTheme(choice) {
  localStorage.setItem(THEME_CHOICE_KEY, choice);
  if (choice === "auto") {
    localStorage.removeItem(THEME_KEY);
    applySystemTheme();
  } else {
    setTheme(choice, { choice });
  }
}

function applySystemTheme() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? THEMES.DARK : THEMES.LIGHT, { remember: false, choice: "auto" });
}

function initTheme() {
  // A stored theme with no stored choice is a leftover from a build that saved
  // one on every start. Treating it as a decision is what left people stuck on
  // light forever, so it is discarded and the browser decides again.
  let choice = localStorage.getItem(THEME_CHOICE_KEY);
  if (choice !== THEMES.LIGHT && choice !== THEMES.DARK && choice !== "auto") {
    choice = "auto";
    localStorage.setItem(THEME_CHOICE_KEY, choice);
    localStorage.removeItem(THEME_KEY);
  }

  if (choice === THEMES.LIGHT || choice === THEMES.DARK) {
    setTheme(choice, { choice });
    return;
  }

  applySystemTheme();

  // Keep following it while the popup is open — the OS can flip at sunset.
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", () => {
      if (localStorage.getItem(THEME_CHOICE_KEY) === "auto") applySystemTheme();
    });
  }
}

/**
 * Update token counter display
 * @param {number} count - Token count
 * @param {number} limit - Context limit
 */
function updateTokenDisplay(count, limit) {
  currentTokenCount = count;

  // The count is the whole display: a number and its unit. Nothing warns about
  // the budget, because nothing needs to — going over it changes where the
  // result is delivered, not whether the user gets one.
  tokenCountValue.textContent = count.toLocaleString();

  // Show/hide the counter
  if (showTokenCountCheckbox.checked) {
    tokenCounter.classList.remove('hidden');
  } else {
    tokenCounter.classList.add('hidden');
  }

}

/**
 * Hide token counter display
 */
function hideTokenDisplay() {
  tokenCounter.classList.add('hidden');
}

// Show proper keyboard shortcuts based on OS
function updateShortcutDisplay() {
  // Detect OS
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modifier = isMac ? "⌥⇧" : "Alt+Shift+";

  // Shortcuts are listed in Settings only; the action buttons no longer carry
  // badges, so there is nothing to fill in on the main view.
  popupShortcut.textContent = `${modifier}L`;
  quickConvertShortcut.textContent = `${modifier}M`;
  if (downloadShortcut) {
    downloadShortcut.textContent = `${modifier}D`;
  }

  // Detect browser - check for Firefox-specific APIs
  // browser-polyfill defines 'browser' in Chrome too, so we need a different check
  const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");

  // Update shortcut customization link
  const shortcutLink = document.getElementById("shortcutLink");
  if (shortcutLink) {
    const shortcutPage = isFirefox ? "about:addons" : "chrome://extensions/shortcuts";
    shortcutLink.textContent = shortcutPage;

    // Handle click to open the shortcuts page
    shortcutLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (isFirefox) {
        browser.tabs.create({ url: "about:addons" });
      } else {
        chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
      }
    });
  }

}

// Offer the selection action only when there is a selection to act on: a
// button that is present but inert teaches people to ignore it.
async function initSelectionAction() {
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    const response = await browserAPI.tabs.sendMessage(tabs[0].id, { action: "getSelectionInfo" });
    const info = response && response.success ? response.info : null;
    if (!info || !info.hasSelection) return;

    // The kind and line range end up in the copied text itself, so the button
    // stays a plain label.
    copySelectionBtn.classList.remove("hidden");
  } catch (error) {
    // Restricted pages (store, about:, PDF viewer) have no content script.
    // Staying silent is the correct outcome, not an error to report.
  }
}

// Set once the popup knows this page holds a conversation: the page-conversion
// key is hidden and Download follows the chat, not the rendered slice.
let chatPageFallback = false;

// How many exchanges a chat copy takes, as segments on the page card: the
// menu it used to be had more items than the popup had room for below the
// key, and ran off the bottom of the popup.
function selectSegment(container, value) {
  container.querySelectorAll(".card-segment").forEach((segment) => {
    const selected = segment.dataset.value === value;
    segment.classList.toggle("is-selected", selected);
    segment.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setChatExchangeLimit(value, options) {
  chatExchangeLimitValue = value;
  selectSegment(chatSegments, value);
  chatExchangeSelect.value = value;
  if (!options || options.persist !== false) saveSettings();
}

// The chat range: by recent days (the default), by the last exchanges, or the
// whole chat. Settings → Chats holds it; the page card shows the active mode's
// segments only when the user turns that row on.
function applyChatRange() {
  mainView.dataset.chatRange = chatRangeModeValue;
  mainView.dataset.chatCard = showChatRangeCheckbox.checked ? "on" : "off";
}

function setChatRangeMode(value, options) {
  chatRangeModeValue = value;
  chatRangeRadios.forEach((radio) => { radio.checked = radio.value === value; });
  applyChatRange();
  if (!options || options.persist !== false) saveSettings();
}

function setChatDays(value, options) {
  chatDaysValue = value;
  selectSegment(chatDaySegments, value);
  chatDaysSelect.value = value;
  if (!options || options.persist !== false) saveSettings();
}

// Offer the chat action only where there is a conversation to copy: LLM
// front-ends, including self-hosted ones on a local port.
async function initChatAction() {
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    const response = await askPage(tabs[0].id, { action: "getChatInfo" });
    const info = response && response.success ? response.info : null;
    if (!info || !info.isChat) return;

    chatAction.classList.remove("hidden");
    setPageMode("chat");

    // A chat transcript is virtualised: converting the page captures whichever
    // messages happen to be rendered, which is a slice of the middle dressed up
    // as a document. So on a chat the page conversion steps off the front row —
    // it stays one click away inside this action's menu, because a chat
    // detection can be wrong and the page is sometimes what the user wants.
    convertSplit.classList.add("hidden");
    chatPageFallback = true;
  } catch (error) {
    // No content script on this page (store, about:, PDF viewer).
  }
}

// Ask the page a question, and if nothing answers, put the content script there
// and ask again. Two situations look identical from here and both end in
// silence: no content script at all (the tab predates the extension), and one
// from an older build that has never heard of this message. Re-injecting fixes
// both, and is safe because every content-script file guards its own
// declaration against being evaluated twice.
async function askPage(tabId, message) {
  try {
    const response = await browserAPI.tabs.sendMessage(tabId, message);
    if (response) return response;
  } catch (error) {
    // Falls through to the injection below.
  }
  try {
    const manifest = browserAPI.runtime.getManifest();
    const entry = (manifest.content_scripts || [])[0];
    if (!entry || !browserAPI.scripting) return null;
    await browserAPI.scripting.executeScript({ target: { tabId }, files: entry.js });
    return await browserAPI.tabs.sendMessage(tabId, message);
  } catch (error) {
    return null;
  }
}

// The version alone cannot answer "did my reload actually take?" — a rebuilt
// package usually carries the same version. So the build id is hashed from the
// files the browser actually loaded: it moves whenever a single byte of the
// code does, and stays put when nothing did.
async function computeBuildId() {
  const manifest = browserAPI.runtime.getManifest();
  const entry = (manifest.content_scripts || [])[0];
  const files = (entry && entry.js ? entry.js.slice() : []).concat(['popup.js', 'popup.html', 'styles.css']);
  const chunks = [];
  for (const file of files) {
    try {
      const response = await fetch(browserAPI.runtime.getURL(file));
      chunks.push(await response.text());
    } catch (error) {
      chunks.push('missing:' + file);
    }
  }
  const bytes = new TextEncoder().encode(chunks.join('|'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 5)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// A period is a shorthand for the from/to pair the extractor actually takes:
// "7d" is simply today minus six days, resolved here so the extractor keeps one
// way of being told what to include.
// The year is noise in a chat you are reading now, so the field takes "DD.MM"
// and the year is inferred: this year, unless that would put the date in the
// future, in which case it is last year. Storage keeps the full date, because
// that is what the extractor compares against.
function displayFromStored(stored) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(stored || '').trim());
  return parts ? `${parts[3]}.${parts[2]}` : '';
}

function storedFromDisplay(display) {
  const parts = /^(\d{1,2})[.\/-](\d{1,2})$/.exec(String(display || '').trim());
  if (!parts) return '';
  const day = Number(parts[1]);
  const month = Number(parts[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let candidate = new Date(today.getFullYear(), month - 1, day);
  if (candidate > today) candidate = new Date(today.getFullYear() - 1, month - 1, day);
  return localDateString(candidate);
}

function localDateString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function setTelegramPeriod(period, options) {
  telegramPeriods.querySelectorAll(".telegram-segment").forEach((segment) => {
    const selected = segment.dataset.period === period;
    segment.classList.toggle("is-selected", selected);
    segment.setAttribute("aria-checked", selected ? "true" : "false");
  });
  telegramCustomDates.classList.toggle("hidden", period !== "custom");

  if (period === "all") {
    telegramDateFromInput.value = "";
    telegramDateToInput.value = "";
  } else if (period !== "custom") {
    const days = Number(period);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    telegramDateFromInput.value = displayFromStored(localDateString(from));
    telegramDateToInput.value = "";
  }
  if (!options || options.persist !== false) saveSettings();
}

// Which segment matches the stored pair, so reopening the popup shows the
// period the user actually left it on.
function periodFromDates(from, to) {
  // `from` and `to` here are stored values, not what the fields show.
  if (!from && !to) return "all";
  if (to) return "custom";
  for (const days of [1, 7, 30]) {
    const candidate = new Date();
    candidate.setHours(0, 0, 0, 0);
    candidate.setDate(candidate.getDate() - (days - 1));
    if (localDateString(candidate) === from) return String(days);
  }
  return "custom";
}

async function initAbout() {
  try {
    const manifest = browserAPI.runtime.getManifest();
    aboutVersionEl.textContent = manifest.version;
    aboutBuildEl.textContent = await computeBuildId();
  } catch (error) {
    aboutBuildEl.textContent = 'unavailable';
  }
}

let telegramMaxMessagesValue = "200";

function setTelegramLimit(value, options) {
  const offered = Array.from(telegramSegments.querySelectorAll(".telegram-segment"))
    .map((segment) => segment.dataset.value);
  // A value saved before the steps changed — "all", say — would leave every
  // segment unselected and the copy running on a number nothing shows.
  telegramMaxMessagesValue = offered.includes(String(value)) ? String(value) : "50";
  telegramSegments.querySelectorAll(".telegram-segment").forEach((segment) => {
    const selected = segment.dataset.value === telegramMaxMessagesValue;
    segment.classList.toggle("is-selected", selected);
    segment.setAttribute("aria-checked", selected ? "true" : "false");
  });
  if (!options || options.persist !== false) saveSettings();
}

// What the button says. "Convert & Copy" is silent about which of four
// documents you would get, so the label names the target: the topic on a forum,
// the person in a private chat, the channel or group otherwise.
function telegramButtonLabel(info) {
  const kindWord = info.kind === "topic" ? "topic"
    : info.kind === "channel" ? "channel"
    : info.kind === "group" ? "group"
    : info.kind === "bot" ? "bot"
    : "chat";
  const name = (info.kind === "topic" && info.topicName) ? info.topicName : info.title;
  const trimmed = (name || "Telegram").length > 22 ? (name || "").slice(0, 21) + "…" : (name || "Telegram");
  return `Copy ${trimmed} ${kindWord}`;
}

// Offer the Telegram action only on an open conversation, and take the page
// conversion off the front row while it is up: on a virtualised message list
// "the page" is whichever messages happen to be painted, dressed up as a
// document.
async function initTelegramAction() {
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    const response = await askPage(tabs[0].id, { action: "getTelegramInfo" });
    const info = response && response.success ? response.info : null;
    if (!info || !info.isTelegram) return;

    telegramBtnText.textContent = telegramButtonLabel(info);
    telegramAction.classList.remove("hidden");
    setPageMode("telegram");
    convertSplit.classList.add("hidden");
    chatPageFallback = true;
  } catch (error) {
    // No content script on this page.
  }
}

// The card at the top names what is about to be copied: the page's host and
// title, and the mode that decides which action leads. It is filled from the
// tab the popup opened on; a page the browser keeps to itself (about:, the
// store) keeps the card's own "This page" rather than a guess.
function setPageMode(mode) {
  mainView.dataset.mode = mode;
}

// The address under the title: host and path, without the scheme or "www.",
// so a chat or a document reads as where it is, not only which site.
function displayAddress(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return url;
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return parsed.hostname.replace(/^www\./, "") + path;
  } catch (error) {
    return url;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function renderPage(tab) {
  const url = tab.url || "";
  const host = hostOf(url);
  pageHost.textContent = displayAddress(url);
  pageGlyph.textContent = (host || url || "·").charAt(0).toUpperCase();
  const title = (tab.title || "").trim();
  pageTitle.textContent = title || host || "This page";
  renderPageIcon(tab).catch((error) => console.error("Unshell: page icon failed", error));
}

const IS_FIREFOX = navigator.userAgent.toLowerCase().includes("firefox");

function loadIcon(source) {
  return new Promise((resolve) => {
    const icon = new Image(UnshellPageIcon.SIZE, UnshellPageIcon.SIZE);
    icon.alt = "";
    icon.decoding = "async";
    icon.addEventListener("load", () => resolve(icon));
    icon.addEventListener("error", () => resolve(null));
    icon.src = source;
  });
}

async function showFirstIcon(sources, tried) {
  for (const source of sources) {
    if (tried.has(source)) continue;
    tried.add(source);
    const icon = await loadIcon(source);
    if (!icon) continue;
    if (mainView.dataset.mode === "multi") return true;
    pageGlyph.replaceChildren(icon);
    pageGlyph.classList.add("has-icon");
    return true;
  }
  return false;
}

// The site's own icon replaces the initial once one has actually loaded. The
// browser's icon for the tab is tried first; when it has none or that one
// will not draw, the page is asked which icon it declares. Until then, and on
// a page with no icon at all, the tile keeps the initial.
async function renderPageIcon(tab) {
  const options = { firefox: IS_FIREFOX, getURL: (path) => browserAPI.runtime.getURL(path) };
  const tried = new Set();
  if (await showFirstIcon(UnshellPageIcon.candidates(tab, options), tried)) return;
  if (!/^https?:/i.test(tab.url || "")) return;
  const response = await askPage(tab.id, { action: "getPageIcon" });
  if (!response || !response.success) return;
  await showFirstIcon(UnshellPageIcon.candidates(tab, Object.assign({}, options, { pageIcon: response.icon })), tried);
}

async function initPageCard() {
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) return;
  // The highlighted-tabs probe runs alongside this one; when it has already
  // turned the card into a list of tabs, the active tab is only one of them.
  if (mainView.dataset.mode === "multi") return;
  renderPage(tabs[0]);
}

// Several highlighted tabs: the card lists them, so the count on the key is
// backed by names the user can check before merging.
const PAGE_TABS_SHOWN = 4;

function renderPageTabs(tabs) {
  pageGlyph.classList.remove("has-icon");
  pageGlyph.textContent = String(tabs.length);
  pageHost.textContent = `${tabs.length} tabs, merged into one document`;
  pageTitle.textContent = `${tabs.length} tabs, merged into one document`;
  const items = tabs.slice(0, PAGE_TABS_SHOWN).map((tab) => {
    const item = document.createElement("li");
    item.textContent = (tab.title || "").trim() || hostOf(tab.url || "") || tab.url || "Untitled tab";
    return item;
  });
  if (tabs.length > PAGE_TABS_SHOWN) {
    const more = document.createElement("li");
    more.className = "page-tabs-more";
    more.textContent = `and ${tabs.length - PAGE_TABS_SHOWN} more`;
    items.push(more);
  }
  pageTabs.replaceChildren(...items);
  pageTabs.classList.remove("hidden");
}

// The recipe chips on the card drive the Formatting checkboxes in Settings and
// follow them back. A chip that points at a setting that is not there is a
// build mistake, so it says so instead of quietly doing nothing.
const recipeChips = Array.from(document.querySelectorAll(".recipe-chip"));

function syncRecipeChips() {
  recipeChips.forEach((chip) => {
    const box = document.getElementById(chip.dataset.setting);
    chip.setAttribute("aria-pressed", box && box.checked ? "true" : "false");
  });
}

function initRecipeChips() {
  recipeChips.forEach((chip) => {
    const box = document.getElementById(chip.dataset.setting);
    if (!box) throw new Error(`Recipe chip points at a missing setting: ${chip.dataset.setting}`);
    chip.addEventListener("click", () => {
      box.checked = !box.checked;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    });
    box.addEventListener("change", syncRecipeChips);
  });
  syncRecipeChips();
}

// Load user settings
async function loadSettings() {
  try {
    const data = await SettingsUtils.getUserSettings(browserAPI);

    // Also get token settings
    const tokenSettings = await browserAPI.storage.sync.get({
      showTokenCount: DEFAULT_TOKEN_SETTINGS.showTokenCount,
      tokenContextLimit: DEFAULT_TOKEN_SETTINGS.tokenContextLimit,
    });

    // Apply settings to UI
    document.querySelector(`input[name="contentScope"][value="${data.contentScope}"]`).checked = true;
    preserveTablesCheckbox.checked = data.preserveTables;
    includeImagesCheckbox.checked = data.includeImages;
    includeTitleCheckbox.checked = data.includeTitle;
    includeLinksCheckbox.checked = data.includeLinks !== false;
    includeMetadataCheckbox.checked = data.includeMetadata;
    metadataFormatTextarea.value = data.metadataFormat;
    debugModeCheckbox.checked = data.debugMode;
    triggerLazyLoadingCheckbox.checked = data.triggerLazyLoading === true;
    redditModeCheckbox.checked = data.redditMode !== false;
    redditCommentSortSelect.value = data.redditCommentSort;
    redditMaxCommentsSelect.value = String(data.redditMaxComments);
    setChatExchangeLimit(String(data.chatExchangeLimit), { persist: false });
    setChatRangeMode(data.chatRangeMode, { persist: false });
    setChatDays(String(data.chatDays), { persist: false });
    showChatRangeCheckbox.checked = data.showChatRange === true;
    applyChatRange();
    xModeCheckbox.checked = data.xMode !== false;
    xIncludeRepliesCheckbox.checked = data.xIncludeReplies !== false;
    xMaxPostsSelect.value = String(data.xMaxPosts);
    githubModeCheckbox.checked = data.githubMode !== false;
    githubIncludeReadmeCheckbox.checked = data.githubIncludeReadme !== false;
    githubIncludeTreeCheckbox.checked = data.githubIncludeTree !== false;
    githubMaxTreeEntriesSelect.value = String(data.githubMaxTreeEntries);
    setTelegramLimit(String(data.telegramMaxMessages ?? "200"), { persist: false });
    telegramDateFromInput.value = displayFromStored(data.telegramDateFrom);
    telegramDateToInput.value = displayFromStored(data.telegramDateTo);
    setTelegramPeriod(periodFromDates(data.telegramDateFrom || "", data.telegramDateTo || ""), { persist: false });
    youtubeModeCheckbox.checked = data.youtubeMode !== false;
    youtubeIncludeDescriptionCheckbox.checked = data.youtubeIncludeDescription !== false;
    youtubeIncludeCommentsCheckbox.checked = data.youtubeIncludeComments !== false;
    youtubeMaxCommentsSelect.value = String(data.youtubeMaxComments);
    discordModeCheckbox.checked = data.discordMode !== false;
    discordMaxMessagesSelect.value = String(data.discordMaxMessages);
    showTokenCountCheckbox.checked = tokenSettings.showTokenCount;

    // Show/hide metadata format container based on checkbox state
    updateMetadataFormatVisibility(data.includeMetadata);

    // Show/hide debug logs button based on debug mode
    updateDebugModeVisibility();
  } catch (error) {
    console.error("Error loading settings:", error);
    statusIndicator.textContent = "Error loading settings";
    statusIndicator.classList.add("error");
  }
}

// Save user settings
async function saveSettings() {
  try {
    const contentScope = document.querySelector('input[name="contentScope"]:checked').value;
    const preserveTables = preserveTablesCheckbox.checked;
    const includeImages = includeImagesCheckbox.checked;
    const includeTitle = includeTitleCheckbox.checked;
    const includeLinks = includeLinksCheckbox.checked;
    const includeMetadata = includeMetadataCheckbox.checked;
    const metadataFormat = metadataFormatTextarea.value;
    const debugMode = debugModeCheckbox.checked;
    const triggerLazyLoading = triggerLazyLoadingCheckbox.checked;
    const redditMode = redditModeCheckbox.checked;
    const redditCommentSort = redditCommentSortSelect.value;
    const redditMaxComments = redditMaxCommentsSelect.value;
    const chatExchangeLimit = chatExchangeLimitValue;
    const chatRangeMode = chatRangeModeValue;
    const chatDays = chatDaysValue;
    const xMode = xModeCheckbox.checked;
    const xIncludeReplies = xIncludeRepliesCheckbox.checked;
    const xMaxPosts = xMaxPostsSelect.value;
    const githubMode = githubModeCheckbox.checked;
    const githubIncludeReadme = githubIncludeReadmeCheckbox.checked;
    const githubIncludeTree = githubIncludeTreeCheckbox.checked;
    const githubMaxTreeEntries = githubMaxTreeEntriesSelect.value;
    const telegramMaxMessages = telegramMaxMessagesValue;
    const telegramDateFrom = storedFromDisplay(telegramDateFromInput.value);
    const telegramDateTo = storedFromDisplay(telegramDateToInput.value);
    const youtubeMode = youtubeModeCheckbox.checked;
    const youtubeIncludeDescription = youtubeIncludeDescriptionCheckbox.checked;
    const youtubeIncludeComments = youtubeIncludeCommentsCheckbox.checked;
    const youtubeMaxComments = youtubeMaxCommentsSelect.value;
    const discordMode = discordModeCheckbox.checked;
    const discordMaxMessages = discordMaxMessagesSelect.value;
    const showTokenCount = showTokenCountCheckbox.checked;
    const tokenContextLimit = DEFAULT_TOKEN_SETTINGS.tokenContextLimit;

    await browserAPI.storage.sync.set({
      contentScope,
      preserveTables,
      includeImages,
      includeTitle,
      includeLinks,
      includeMetadata,
      metadataFormat,
      debugMode,
      triggerLazyLoading,
      redditMode,
      redditCommentSort,
      redditMaxComments,
      chatExchangeLimit,
      chatRangeMode,
      chatDays,
      showChatRange: showChatRangeCheckbox.checked,
      xMode,
      xIncludeReplies,
      xMaxPosts,
      githubMode,
      githubIncludeReadme,
      githubIncludeTree,
      githubMaxTreeEntries,
      telegramMaxMessages,
      telegramDateFrom,
      telegramDateTo,
      youtubeMode,
      youtubeIncludeDescription,
      youtubeIncludeComments,
      youtubeMaxComments,
      discordMode,
      discordMaxMessages,
      showTokenCount,
      tokenContextLimit,
    });
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

// Update metadata format container visibility
function updateMetadataFormatVisibility(isVisible) {
  if (isVisible) {
    metadataFormatContainer.classList.remove("hidden");
  } else {
    metadataFormatContainer.classList.add("hidden");
  }
}

// Copy debug logs from content script
async function copyLogs() {
  const btn = copyLogsBtn;
  const originalText = btn.querySelector('.btn-text').textContent;

  try {
    const tabs = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tabs || tabs.length === 0) {
      statusIndicator.textContent = "No active tab";
      statusIndicator.className = "status error";
      return;
    }

    const response = await browserAPI.tabs.sendMessage(tabs[0].id, {
      action: "getDebugLogs",
    });

    if (response.success && response.logs) {
      await navigator.clipboard.writeText(response.logs);

      // Update button text temporarily to show feedback
      btn.querySelector('.btn-text').textContent = "Copied!";
      btn.classList.add('success');

      setTimeout(() => {
        btn.querySelector('.btn-text').textContent = originalText;
        btn.classList.remove('success');
      }, 2000);
    } else {
      statusIndicator.textContent = "No logs to copy";
      statusIndicator.className = "status error";
      setTimeout(() => {
        statusIndicator.textContent = "";
        statusIndicator.className = "status";
      }, 2000);
    }
  } catch (error) {
    statusIndicator.textContent = "Error: " + error.message;
    statusIndicator.className = "status error";
    setTimeout(() => {
      statusIndicator.textContent = "";
      statusIndicator.className = "status";
    }, 2000);
  }
}

// Toggle copy logs button visibility based on debug mode
function updateDebugModeVisibility() {
  const debugEnabled = debugModeCheckbox.checked;
  if (debugEnabled) {
    copyLogsBtn.style.display = '';
  } else {
    copyLogsBtn.style.display = 'none';
  }
}

// Multi-tab functionality

// Detect highlighted tabs and update UI
async function detectSelectedTabsAndUpdateUI() {
  // Start with single-tab mode as default (immediate render)
  showSingleTabUI();

  try {
    const validTabs = await MultiTabUtils.getHighlightedTabs(browserAPI);

    if (validTabs.length > 1) {
      // Multi-tab mode - switch to multi-tab UI
      showMultiTabUI(validTabs.length);
      setPageMode("multi");
      renderPageTabs(validTabs);
      return validTabs;
    } else {
      // Single-tab mode (already showing)
      return null;
    }
  } catch (error) {
    console.error('Error detecting tabs:', error);
    // Already showing single-tab UI, just return
    return null;
  }
}

function showMultiTabUI(count) {
  singleTabActions.classList.add('hidden');
  multiTabActions.classList.remove('hidden');
  selectedTabCount.textContent = count;
}

function showSingleTabUI() {
  singleTabActions.classList.remove('hidden');
  multiTabActions.classList.add('hidden');
}

// Progress callback for status updates
function updateStatus(message) {
  statusIndicator.textContent = message;
  statusIndicator.className = "status processing";
}

// Get current settings from UI
function getCurrentSettings() {
  return {
    contentScope: document.querySelector('input[name="contentScope"]:checked').value,
    preserveTables: preserveTablesCheckbox.checked,
    includeImages: includeImagesCheckbox.checked,
    includeTitle: includeTitleCheckbox.checked,
    includeLinks: includeLinksCheckbox.checked,
    includeMetadata: includeMetadataCheckbox.checked,
    metadataFormat: metadataFormatTextarea.value,
    debugMode: debugModeCheckbox.checked,
    triggerLazyLoading: triggerLazyLoadingCheckbox.checked,
    redditMode: redditModeCheckbox.checked,
    redditCommentSort: redditCommentSortSelect.value,
    redditMaxComments: redditMaxCommentsSelect.value,
    chatExchangeLimit: chatExchangeLimitValue,
    chatRangeMode: chatRangeModeValue,
    chatDays: chatDaysValue,
    xMode: xModeCheckbox.checked,
    xIncludeReplies: xIncludeRepliesCheckbox.checked,
    xMaxPosts: xMaxPostsSelect.value,
    githubMode: githubModeCheckbox.checked,
    githubIncludeReadme: githubIncludeReadmeCheckbox.checked,
    githubIncludeTree: githubIncludeTreeCheckbox.checked,
    githubMaxTreeEntries: githubMaxTreeEntriesSelect.value,
    telegramMaxMessages: telegramMaxMessagesValue,
    telegramDateFrom: storedFromDisplay(telegramDateFromInput.value),
    telegramDateTo: storedFromDisplay(telegramDateToInput.value),
    youtubeMode: youtubeModeCheckbox.checked,
    youtubeIncludeDescription: youtubeIncludeDescriptionCheckbox.checked,
    youtubeIncludeComments: youtubeIncludeCommentsCheckbox.checked,
    youtubeMaxComments: youtubeMaxCommentsSelect.value,
    discordMode: discordModeCheckbox.checked,
    discordMaxMessages: discordMaxMessagesSelect.value,
  };
}

// Check if user confirms large tab operation
// Returns true to proceed, false to cancel
function confirmLargeTabCount(tabs) {
    if (MultiTabUtils.shouldWarnAboutLargeTabCount(tabs.length)) {
        return confirm(MultiTabUtils.getLargeTabCountWarning(tabs.length));
    }
    return true; // Proceed if below threshold
}

// Shared helper for multi-tab actions (copy, download merged, download ZIP)
async function processMultiTabAction(actionFn) {
  statusIndicator.textContent = "Converting...";
  statusIndicator.className = "status processing";

  try {
    const tabs = await detectSelectedTabsAndUpdateUI();
    if (!tabs || tabs.length < 2) {
      throw new Error('Please select multiple tabs');
    }

    if (!confirmLargeTabCount(tabs)) {
      statusIndicator.textContent = "Operation cancelled";
      statusIndicator.className = "status";
      return;
    }

    const settings = getCurrentSettings();
    const results = await MultiTabUtils.processMultipleTabs(tabs, settings, browserAPI, updateStatus);

    const { prefix, suffix } = await actionFn(results);

    let totalTokenCount = 0;
    results.forEach(result => {
      if (result.success && result.tokenCount) {
        totalTokenCount += result.tokenCount;
      }
    });

    const { message } = MultiTabUtils.getResultsSummary(results);

    statusIndicator.textContent = `${prefix || ''}${message}${suffix}`;
    statusIndicator.className = "status success";

    if (totalTokenCount > 0) {
      const contextLimit = DEFAULT_TOKEN_SETTINGS.tokenContextLimit;
      updateTokenDisplay(totalTokenCount, contextLimit);
    }

    await saveSettings();
  } catch (error) {
    console.error('Multi-tab action error:', error);
    statusIndicator.textContent = `Error: ${error.message}`;
    statusIndicator.className = "status error";
    hideTokenDisplay();
  }
}

// Copy All button handler
async function copyAllTabs() {
  await processMultiTabAction(async (results) => {
    const merged = MultiTabUtils.mergeMarkdownResults(results);
    await navigator.clipboard.writeText(merged);
    return { suffix: " copied to clipboard" };
  });
}

// Download Merged button handler
async function downloadMergedFile() {
  await processMultiTabAction(async (results) => {
    const merged = MultiTabUtils.mergeMarkdownResults(results);
    const filename = `unshell-merged-${MultiTabUtils.getDateString()}`;
    downloadMarkdownFile(filename, merged);
    return { suffix: " downloaded" };
  });
}

// Download ZIP button handler
async function downloadZipArchive() {
  await processMultiTabAction(async (results) => {
    statusIndicator.textContent = "Creating ZIP archive...";
    const { blob, filename } = await MultiTabUtils.createZipArchive(results);
    downloadFile(filename, blob, 'application/zip');
    return { prefix: "ZIP with ", suffix: " downloaded" };
  });
}

// Convert current page to Markdown
async function convertToMarkdown(scopeOverride) {
  statusIndicator.textContent = "Converting...";
  statusIndicator.className = "status processing";

  try {
    // Get current tab
    const tabs = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }

    // Get current settings (scopeOverride bypasses the saved contentScope for one conversion)
    const contentScope = scopeOverride || document.querySelector('input[name="contentScope"]:checked').value;
    const preserveTables = preserveTablesCheckbox.checked;
    const includeImages = includeImagesCheckbox.checked;
    const includeTitle = includeTitleCheckbox.checked;
    const includeLinks = includeLinksCheckbox.checked;
    const includeMetadata = includeMetadataCheckbox.checked;
    const metadataFormat = metadataFormatTextarea.value;
    const debugMode = debugModeCheckbox.checked;
    const triggerLazyLoading = triggerLazyLoadingCheckbox.checked;
    const redditMode = redditModeCheckbox.checked;
    const redditCommentSort = redditCommentSortSelect.value;
    const redditMaxComments = redditMaxCommentsSelect.value;
    const chatExchangeLimit = chatExchangeLimitValue;
    const chatRangeMode = chatRangeModeValue;
    const chatDays = chatDaysValue;
    const xMode = xModeCheckbox.checked;
    const xIncludeReplies = xIncludeRepliesCheckbox.checked;
    const xMaxPosts = xMaxPostsSelect.value;
    const githubMode = githubModeCheckbox.checked;
    const githubIncludeReadme = githubIncludeReadmeCheckbox.checked;
    const githubIncludeTree = githubIncludeTreeCheckbox.checked;
    const githubMaxTreeEntries = githubMaxTreeEntriesSelect.value;
    const telegramMaxMessages = telegramMaxMessagesValue;
    const telegramDateFrom = storedFromDisplay(telegramDateFromInput.value);
    const telegramDateTo = storedFromDisplay(telegramDateToInput.value);
    const youtubeMode = youtubeModeCheckbox.checked;
    const youtubeIncludeDescription = youtubeIncludeDescriptionCheckbox.checked;
    const youtubeIncludeComments = youtubeIncludeCommentsCheckbox.checked;
    const youtubeMaxComments = youtubeMaxCommentsSelect.value;
    const discordMode = discordModeCheckbox.checked;
    const discordMaxMessages = discordMaxMessagesSelect.value;

    // Send message to content script
    const response = await browserAPI.tabs.sendMessage(tabs[0].id, {
      action: "convertToMarkdown",
      settings: {
        contentScope,
        preserveTables,
        includeImages,
        includeTitle,
        includeLinks,
        includeMetadata,
        metadataFormat,
        debugMode,
        triggerLazyLoading,
        redditMode,
        redditCommentSort,
        redditMaxComments,
        chatExchangeLimit,
        chatRangeMode,
        chatDays,
        xMode,
        xIncludeReplies,
        xMaxPosts,
        githubMode,
        githubIncludeReadme,
        githubIncludeTree,
        githubMaxTreeEntries,
        telegramMaxMessages,
        telegramDateFrom,
        telegramDateTo,
        youtubeMode,
        youtubeIncludeDescription,
        youtubeIncludeComments,
        youtubeMaxComments,
        discordMode,
        discordMaxMessages,
      },
    });

    if (!response.success) {
      throw new Error(response.error || "Unknown error");
    }

    // Use token count from content script response for consistency
    let tokenCount = response.tokenCount || 0;

    // Fallback to TokenCounter if needed (shouldn't happen)
    if (tokenCount === 0 && typeof TokenCounter !== 'undefined') {
      try {
        tokenCount = await TokenCounter.count(response.markdown);
      } catch (tokenError) {
        console.error("Token counting error:", tokenError);
      }
    }

    // Past the context limit the clipboard is the wrong destination: pasting
    // a document that cannot fit is a dead end, and a warning telling the user
    // so leaves them holding it. Hand over a file instead — the result is
    // delivered either way, and the route is the only thing that changes.
    const contextLimit = DEFAULT_TOKEN_SETTINGS.tokenContextLimit;
    if (tokenCount > contextLimit) {
      const filename = await generateFileNameFromPageTitle();
      downloadMarkdownFile(filename, response.markdown);
      statusIndicator.textContent = "Too large to paste — downloaded instead";
      statusIndicator.className = "status success";
    } else {
      await navigator.clipboard.writeText(response.markdown);
      // A copy that could not follow the chosen range says what it took.
      if (response.notice) {
        statusIndicator.textContent = response.notice.charAt(0).toUpperCase() + response.notice.slice(1);
        statusIndicator.className = "status success has-notice";
      } else {
        statusIndicator.textContent = "Copied to clipboard!";
        statusIndicator.className = "status success";
      }
    }

    // Update token display
    updateTokenDisplay(tokenCount, contextLimit);

    // Save settings
    await saveSettings();

  } catch (error) {
    console.error("Conversion error:", error);
    const errorMessage = error.message || error.toString() || "Failed to convert page";
    statusIndicator.textContent = `Error: ${errorMessage}`;
    statusIndicator.className = "status error";
    hideTokenDisplay();
  }
}

// Download markdown file
async function downloadMarkdown() {
  statusIndicator.textContent = "Converting...";
  statusIndicator.className = "status processing";

  try {
    // Get current tab
    const tabs = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }

    // Get current settings. On a chat the download follows the same rule the
    // buttons do: a file full of half a transcript is the same mistake as a
    // clipboard full of one.
    const contentScope = chatPageFallback
      ? "chat"
      : document.querySelector('input[name="contentScope"]:checked').value;
    const preserveTables = preserveTablesCheckbox.checked;
    const includeImages = includeImagesCheckbox.checked;
    const includeTitle = includeTitleCheckbox.checked;
    const includeLinks = includeLinksCheckbox.checked;
    const includeMetadata = includeMetadataCheckbox.checked;
    const metadataFormat = metadataFormatTextarea.value;
    const debugMode = debugModeCheckbox.checked;
    const triggerLazyLoading = triggerLazyLoadingCheckbox.checked;
    const redditMode = redditModeCheckbox.checked;
    const redditCommentSort = redditCommentSortSelect.value;
    const redditMaxComments = redditMaxCommentsSelect.value;
    const chatExchangeLimit = chatExchangeLimitValue;
    const chatRangeMode = chatRangeModeValue;
    const chatDays = chatDaysValue;
    const xMode = xModeCheckbox.checked;
    const xIncludeReplies = xIncludeRepliesCheckbox.checked;
    const xMaxPosts = xMaxPostsSelect.value;
    const githubMode = githubModeCheckbox.checked;
    const githubIncludeReadme = githubIncludeReadmeCheckbox.checked;
    const githubIncludeTree = githubIncludeTreeCheckbox.checked;
    const githubMaxTreeEntries = githubMaxTreeEntriesSelect.value;
    const telegramMaxMessages = telegramMaxMessagesValue;
    const telegramDateFrom = storedFromDisplay(telegramDateFromInput.value);
    const telegramDateTo = storedFromDisplay(telegramDateToInput.value);
    const youtubeMode = youtubeModeCheckbox.checked;
    const youtubeIncludeDescription = youtubeIncludeDescriptionCheckbox.checked;
    const youtubeIncludeComments = youtubeIncludeCommentsCheckbox.checked;
    const youtubeMaxComments = youtubeMaxCommentsSelect.value;
    const discordMode = discordModeCheckbox.checked;
    const discordMaxMessages = discordMaxMessagesSelect.value;

    // Send message to content script
    const response = await browserAPI.tabs.sendMessage(tabs[0].id, {
      action: "convertToMarkdown",
      settings: {
        contentScope,
        preserveTables,
        includeImages,
        includeTitle,
        includeLinks,
        includeMetadata,
        metadataFormat,
        debugMode,
        triggerLazyLoading,
        redditMode,
        redditCommentSort,
        redditMaxComments,
        chatExchangeLimit,
        chatRangeMode,
        chatDays,
        xMode,
        xIncludeReplies,
        xMaxPosts,
        githubMode,
        githubIncludeReadme,
        githubIncludeTree,
        githubMaxTreeEntries,
        telegramMaxMessages,
        telegramDateFrom,
        telegramDateTo,
        youtubeMode,
        youtubeIncludeDescription,
        youtubeIncludeComments,
        youtubeMaxComments,
        discordMode,
        discordMaxMessages,
      },
    });

    if (!response.success) {
      throw new Error(response.error || "Unknown error");
    }

    // Use token count from content script response for consistency
    let tokenCount = response.tokenCount || 0;

    // Fallback to TokenCounter if needed (shouldn't happen)
    if (tokenCount === 0 && typeof TokenCounter !== 'undefined') {
      try {
        tokenCount = await TokenCounter.count(response.markdown);
      } catch (tokenError) {
        console.error("Token counting error:", tokenError);
      }
    }

    // Download the file
    const filename = await generateFileNameFromPageTitle();
    downloadMarkdownFile(filename, response.markdown);

    // Update UI
    statusIndicator.textContent = "Downloaded!";
    statusIndicator.className = "status success";

    // Update token display
    const contextLimit = DEFAULT_TOKEN_SETTINGS.tokenContextLimit;
    updateTokenDisplay(tokenCount, contextLimit);

    // Save settings
    await saveSettings();

  } catch (error) {
    console.error("Download error:", error);
    const errorMessage = error.message || error.toString() || "Failed to download";
    statusIndicator.textContent = `Error: ${errorMessage}`;
    statusIndicator.className = "status error";
    hideTokenDisplay();
  }
}

// The key beside the primary copy is the opposite of the saved scope, for this
// copy only. Selection scope has no useful inverse, so the key steps away.
function updateConvertSplitVisibility() {
  const checked = document.querySelector('input[name="contentScope"]:checked');
  const scope = checked ? checked.value : "mainContent";

  if (scope === "mainContent") {
    convertOverrideBtn.classList.remove("hidden");
    convertOverrideLabel.textContent = "Full page";
    convertOverrideBtn.dataset.scope = "fullPage";
  } else if (scope === "fullPage") {
    convertOverrideBtn.classList.remove("hidden");
    convertOverrideLabel.textContent = "Main content";
    convertOverrideBtn.dataset.scope = "mainContent";
  } else {
    convertOverrideBtn.classList.add("hidden");
  }
}

// Event Listeners
// Every startup step is isolated. They used to run in a row, ahead of the code
// that binds the buttons, so one failure left a popup where nothing responded
// at all — the theme toggle included. A step that throws now costs only itself,
// and a step that rejects is reported rather than stopping the rest.
function safely(label, run) {
  try {
    const result = run();
    if (result && typeof result.catch === "function") {
      result.catch((error) => console.error(`Unshell: ${label} failed`, error));
    }
  } catch (error) {
    console.error(`Unshell: ${label} failed`, error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Feedback on pointer-down, gestures available from the first frame.
  safely("press feedback", () => Motion.pressable(
    document,
    "button, a.icon-btn, .setting-option"
  ));
  safely("nav", () => renderNav(0));

  safely("theme", initTheme);
  safely("shortcuts", updateShortcutDisplay);
  // Not awaited: the buttons below must be wired whether or not stored
  // settings can be read. Firefox refuses storage.sync for an add-on loaded
  // with a temporary id, and that refusal used to take the whole popup with it.
  safely("recipe chips", initRecipeChips);
  safely("settings", () => loadSettings().then(syncRecipeChips));
  safely("page card", initPageCard);
  safely("selection action", initSelectionAction);
  safely("chat action", initChatAction);
  safely("telegram action", initTelegramAction);
  safely("about", initAbout);

  // Detect multi-tab selection (non-blocking, runs in background)
  // UI defaults to single-tab mode, then switches if multiple tabs detected
  detectSelectedTabsAndUpdateUI().catch(error => {
    console.error('Error detecting multi-tab selection:', error);
  });

  // Single-tab button clicks
  convertBtn.addEventListener("click", () => convertToMarkdown());
  copySelectionBtn.addEventListener("click", () => convertToMarkdown("selection"));
  copyChatBtn.addEventListener("click", () => convertToMarkdown("chat"));

  copyTelegramBtn.addEventListener("click", () => convertToMarkdown());

  telegramSegments.querySelectorAll(".telegram-segment").forEach((segment) => {
    segment.addEventListener("click", () => setTelegramLimit(segment.dataset.value));
  });

  telegramPeriods.querySelectorAll(".telegram-segment").forEach((segment) => {
    segment.addEventListener("click", () => setTelegramPeriod(segment.dataset.period));
  });

  [telegramDateFromInput, telegramDateToInput].forEach((input) => {
    input.addEventListener("change", () => saveSettings());
  });

  telegramDateClearBtn.addEventListener("click", () => {
    telegramDateFromInput.value = "";
    telegramDateToInput.value = "";
    saveSettings();
  });
  chatPageFallbackBtn.addEventListener("click", () => convertToMarkdown());
  chatSegments.querySelectorAll(".card-segment").forEach((segment) => {
    segment.addEventListener("click", () => setChatExchangeLimit(segment.dataset.value));
  });
  chatDaySegments.querySelectorAll(".card-segment").forEach((segment) => {
    segment.addEventListener("click", () => setChatDays(segment.dataset.value));
  });
  chatRangeRadios.forEach((radio) => {
    radio.addEventListener("change", () => { if (radio.checked) setChatRangeMode(radio.value); });
  });
  chatDaysSelect.addEventListener("change", () => setChatDays(chatDaysSelect.value));
  chatExchangeSelect.addEventListener("change", () => setChatExchangeLimit(chatExchangeSelect.value));
  showChatRangeCheckbox.addEventListener("change", () => {
    applyChatRange();
    saveSettings();
  });
  downloadBtn.addEventListener("click", downloadMarkdown);

  // Convert split-button menu (override contentScope for one-shot full-page copy)
  updateConvertSplitVisibility();
  contentScopeRadios.forEach((radio) => {
    radio.addEventListener("change", updateConvertSplitVisibility);
  });

  convertOverrideBtn.addEventListener("click", () => {
    convertToMarkdown(convertOverrideBtn.dataset.scope || "fullPage");
  });

  // Multi-tab button clicks
  copyAllBtn.addEventListener("click", copyAllTabs);
  downloadMergedBtn.addEventListener("click", downloadMergedFile);
  downloadZipBtn.addEventListener("click", downloadZipArchive);

  // View navigation
  openSettingsBtn.addEventListener("click", showSettingsView);
  backToMainBtn.addEventListener("click", showMainView);

  // Theme buttons
  lightThemeBtn.addEventListener("click", () => chooseTheme(THEMES.LIGHT));
  darkThemeBtn.addEventListener("click", () => chooseTheme(THEMES.DARK));
  if (autoThemeBtn) autoThemeBtn.addEventListener("click", () => chooseTheme("auto"));

  // Save settings when changed
  contentScopeRadios.forEach((radio) => {
    radio.addEventListener("change", saveSettings);
  });

  preserveTablesCheckbox.addEventListener("change", saveSettings);
  includeImagesCheckbox.addEventListener("change", saveSettings);
  includeTitleCheckbox.addEventListener("change", saveSettings);
  includeLinksCheckbox.addEventListener("change", saveSettings);
  debugModeCheckbox.addEventListener("change", () => {
    updateDebugModeVisibility();
    saveSettings();
  });
  triggerLazyLoadingCheckbox.addEventListener("change", saveSettings);
  redditModeCheckbox.addEventListener("change", saveSettings);
  redditCommentSortSelect.addEventListener("change", saveSettings);
  redditMaxCommentsSelect.addEventListener("change", saveSettings);
  xModeCheckbox.addEventListener("change", saveSettings);
  xIncludeRepliesCheckbox.addEventListener("change", saveSettings);
  xMaxPostsSelect.addEventListener("change", saveSettings);

  // Metadata format settings
  includeMetadataCheckbox.addEventListener("change", () => {
    updateMetadataFormatVisibility(includeMetadataCheckbox.checked);
    saveSettings();
  });

  metadataFormatTextarea.addEventListener("input", saveSettings);

  resetMetadataFormatBtn.addEventListener("click", () => {
    metadataFormatTextarea.value = SettingsUtils.DEFAULT_METADATA_FORMAT;
    saveSettings();
  });

  // Copy logs button
  copyLogsBtn.addEventListener("click", copyLogs);

  // Token counter settings
  showTokenCountCheckbox.addEventListener("change", () => {
    saveSettings();
    // Toggle visibility immediately
    if (showTokenCountCheckbox.checked && currentTokenCount > 0) {
      const contextLimit = DEFAULT_TOKEN_SETTINGS.tokenContextLimit;
      updateTokenDisplay(currentTokenCount, contextLimit);
    } else {
      hideTokenDisplay();
    }
  });

  // Initialize token counter
  if (typeof TokenCounter !== 'undefined') {
    TokenCounter.init().then(() => {
      console.log("TokenCounter initialized");
    }).catch(err => {
      console.error("Failed to initialize TokenCounter:", err);
    });
  }

  // Review banner buttons
});

async function generateFileNameFromPageTitle() {
  let baseFilename = "unshell"; // Default filename
  try {
    const tabs = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs && tabs.length > 0 && tabs[0].title) {
      let pageTitle = tabs[0].title.trim();
      if (pageTitle) {
        // Sanitize the title to be a valid filename
        let sanitizedTitle = pageTitle
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // Remove invalid characters
          .replace(/[\s./]+/g, "_") // Replace spaces, dots, slashes with underscores
          .replace(/_+/g, "_") // Consolidate multiple underscores
          .replace(/^_+|_+$/g, ""); // Trim leading/trailing underscores

        if (sanitizedTitle.length > MAX_FILENAME_LENGTH) {
          // Limit length
          sanitizedTitle = sanitizedTitle
            .substring(0, MAX_FILENAME_LENGTH)
            .replace(/_+$/g, "");
        }
        if (sanitizedTitle) baseFilename = sanitizedTitle;
      }
    }
  } catch (error) {
    console.error("Error getting tab title for filename:", error);
    // Silently use default filename if error occurs, or show a non-critical error
  } finally {
    return baseFilename;
  }
}

// Generic file download function
function downloadFile(filename, content, mimeType = "text/markdown") {
  let a = null;
  let url = null;

  try {
    // Create a blob and download
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    url = URL.createObjectURL(blob);

    a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
  } catch (error) {
    console.error("Error downloading file:", error);
  } finally {
    // Clean up, ensuring 'a' and 'url' are defined if an error occurred before their assignment
    if (a && a.parentElement) {
      document.body.removeChild(a);
    }
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

// Helper for markdown file downloads
function downloadMarkdownFile(filename, content) {
  downloadFile(`${filename}.md`, content, "text/markdown");
}
