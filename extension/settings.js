// Unshell Settings Utilities
// Shared settings constants and functions used across popup and background scripts

const SettingsUtils = (function() {
  // Default metadata format template
  const DEFAULT_METADATA_FORMAT = "---\nSource: [{title}]({url})";

  // Chat copy range. By date first: what was said in the last three days is
  // what a conversation usually needs carried over. The range picker on the
  // popup's page card is hidden until the user turns it on.
  const DEFAULT_CHAT_RANGE = { chatRangeMode: 'days', chatDays: 3, showChatRange: false };

  // Get user settings with defaults
  async function getUserSettings(browserAPI) {
    return await browserAPI.storage.sync.get({
      contentScope: 'mainContent',
      preserveTables: true,
      includeImages: true,
      includeTitle: true,
      includeLinks: true,
      includeMetadata: true,
      metadataFormat: DEFAULT_METADATA_FORMAT,
      debugMode: false,
      // Off by default. Triggers a scroll-pass on lazy-loading surfaces (chat
      // UIs, virtualised feeds) before extraction. Has visible side effects
      // (page movement, optional footer warning) so users opt in explicitly.
      triggerLazyLoading: false,
      // Reddit-aware extraction: renders the post plus its comment tree from
      // Reddit's own JSON instead of letting Readability drop the discussion.
      redditMode: true,
      // Comment sort passed to Reddit ('confidence' is what the UI calls "Best")
      redditCommentSort: 'confidence',
      // Comment ceiling per thread; 'all' means no cap.
      redditMaxComments: 250,
      // Chat export: how many exchanges (one user turn plus the assistant's
      // reply) to copy, counted from the end. Defaults to a slice rather than
      // 'all' — a two-year-old thread can be tens of thousands of messages,
      // and copying it whole is a good way to hang the tab.
      chatExchangeLimit: 10,
      ...DEFAULT_CHAT_RANGE,
      // GitHub-aware extraction: builds a repository page from the REST API —
      // heading, description, the README as its original Markdown, and the
      // whole file tree. The rendered page cannot give either: its README is
      // HTML compiled from Markdown, and its file list is one level deep.
      githubMode: true,
      // Whether the capture carries the README.
      githubIncludeReadme: true,
      // Whether the capture carries the recursive file tree.
      githubIncludeTree: true,
      // Ceiling on tree entries; 'all' means no cap. A monorepo can hold six
      // figures of paths, which is not a thing to paste into a model.
      githubMaxTreeEntries: 1000,
      // YouTube-aware extraction: title, channel, the full description and the
      // comment thread. The page shows the description clamped to two lines and
      // has no comments in the document until you scroll to them.
      youtubeMode: true,
      youtubeIncludeDescription: true,
      youtubeIncludeComments: true,
      // Comment ceiling; 'all' means no cap. YouTube pages them 20 at a time.
      youtubeMaxComments: 100,
      // Telegram-aware extraction: the open channel, group, forum topic or
      // private chat as a transcript. Telegram has no REST API for a user
      // account, so this reads the rendered conversation.
      telegramMode: true,
      // Ceiling counted from the newest message; 'all' means whatever
      // scrolling reaches inside the time budget.
      telegramMaxMessages: 50,
      // Optional YYYY-MM-DD bounds. Empty means unbounded on that side.
      telegramDateFrom: '',
      telegramDateTo: '',
      // Discord-aware extraction: the open channel as a transcript, read from
      // the rendered list. Deliberately not the API — that needs the account
      // token, which Discord bans for.
      discordMode: true,
      // Message ceiling, counted from the newest; 'all' means whatever
      // scrolling reaches inside the time budget.
      discordMaxMessages: 200,
      // X-aware extraction: renders the thread (post + replies) or the timeline
      // by walking the virtualised list instead of the first visible post only.
      xMode: true,
      // Post ceiling per page (thread replies or timeline entries); 'all' means
      // no cap, bounded only by the extractor's own time budget.
      xMaxPosts: 100,
      // Whether a thread capture includes the replies under the focused post.
      xIncludeReplies: true
    });
  }

  // Public API
  return {
    DEFAULT_METADATA_FORMAT,
    DEFAULT_CHAT_RANGE,
    getUserSettings
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsUtils;
}

// For use in browser extension contexts (not modules)
if (typeof window !== 'undefined') {
  window.SettingsUtils = SettingsUtils;
}
