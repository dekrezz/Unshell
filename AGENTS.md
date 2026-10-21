# Unshell — contributor and agent guide

Everything an agent (or a person) needs to change this extension safely: how it is put together, what to run to prove a change works, and the rules that are not negotiable.

## Hard rules

1. **Never run tests.** No jest, vitest, or any other runner, not one file. Build, type-check and lint instead — they are seconds, not minutes, and they prove the same things about a change of this kind.
2. **No AI attribution in commits.** No `Co-Authored-By` trailers, no "generated with" footers.
3. **No silent fallbacks.** If an extraction path fails, say so with a specific message; do not quietly degrade to a worse result without telling the user.
4. **Commit message format** (enforced by a hook): area on line one (`Frontend`, `Backend`, `Docs`), blank line, `Changes:`, blank line, then bullets stating the user-visible result.

## What to run

```bash
node --check extension/<file>.js                 # syntax
npx eslint@8 --no-eslintrc --env browser,es2022 \
  --parser-options ecmaVersion:2022 extension/*.js
bash scripts/build.sh all                        # packaging, all three targets
jq empty extension/manifest.json                 # manifest validity
```

For UI work, load the built package and look at it. The popup can also be opened
directly as `file://…/extension/popup.html` with a stubbed `chrome` API for
quick visual checks.

## Architecture

```
popup.js  ──messages──▶  content.js  ──▶  extractor (selection / chat / reddit / x / generic)
   │                          │
   │                          └──▶ Turndown ──▶ Markdown ──▶ clipboard / file
   └── browser.storage.sync (settings, shared with background.js)
```

`content.js` owns `convertToMarkdown(settings)`. It dispatches on `contentScope`
and on the page itself, in this order:

| Condition | Handler |
|-----------|---------|
| `contentScope: 'chat'` | `UnshellChat.convert()` — see `chat.js` |
| `contentScope: 'selection'` | `UnshellSelection.convert()` — see `selection.js` |
| Reddit URL and `redditMode` | `UnshellReddit.convert()` |
| X URL and `xMode` | `UnshellX.convert()` |
| otherwise | Readability (main content) / full page / selection |

Extractors return `{ markdown, articleData }`, or `null` to mean "nothing here,
fall through to the generic path". Anything else throws. The popup shows only
`response.error`, which `content.js` fills with a fixed sentence per known case
and the generic "An error occurred during conversion." otherwise — so an
extractor that has something specific to say (what it looked for, what was
missing) throws an `Error` with `verbatim: true`, and that message reaches the
popup as written.

### Message actions

| Action | Direction | Purpose |
|--------|-----------|---------|
| `convertToMarkdown` | popup/background → content | Run a conversion |
| `getSelectionInfo` | popup → content | Is there a selection? (drives the Copy Selection button) |
| `getPageIcon` | popup → content | The icon the page declares, for the page card when the browser has none for the tab |
| `getChatInfo` | popup → content | Is this a conversation? (drives the Copy Chat button) |
| `getDebugLogs`, `copyToClipboard`, `downloadMarkdown`, `downloadFile`, `showNotification` | popup → content | Utilities |

### Extractors

**`selection.js`** — a highlighted fragment becomes a cited excerpt. Structure
wins over heuristics: a highlighter's markup (`pre`, `.highlight`, `language-*`,
`hljs-*`, `data-lang`) is authoritative; only when the DOM is silent does the
scored text heuristic decide code vs prose. Code is emitted verbatim in a fence
(dedented, fence length adapted to inner backticks) because Turndown escapes the
punctuation that makes code readable. Output starts with
`> Lines A to B of code|text from [host/path](url)`.

On a page that holds a conversation the popup hides the page-conversion key and
Download switches to the chat scope: a virtualised transcript converted as a page
is whichever messages happened to be rendered, which is a slice of the middle
dressed up as a document. The page conversion stays one click away in the chat
action's menu, because chat detection can be wrong and the page is sometimes what
the user wants — and when it runs there, the output carries a note saying only the
rendered messages were captured.

**`chat.js`** — the Claude request matters as much as the parsing: with
`rendering_mode=raw` the API returns no `content` array at all, and the flat
`text` it falls back to has already had thinking folded into the answer and every
tool block replaced by "This block is not supported on your current device yet".
The export therefore asks for
`?tree=True&rendering_mode=messages&render_all_tools=true` and renders the blocks
in their own order — one message can hold several text blocks, thinking before
*and* after the answer, and several tool round-trips. Reasoning goes into a
`<details>` disclosure the way the site hides it, a tool call becomes its
on-screen label plus its `display_content` code block, search results become a
list of sources, and a shell result shows its `stdout` rather than the JSON
envelope around it. `tree=True` is not optional: without it that test
conversation lost 31 of 429 messages.

**`chat.js`** — a conversation is a tree, not a list: editing a message
mid-thread grows a sibling branch and the old one stays in the database. Both
API paths (`claude.ai` via `chat_conversations?tree=True`, `chatgpt.com` via
`/backend-api/conversation/<id>` with the session bearer token) walk parents up
from the active leaf, so the export matches what the user sees. Everything else
is read from the DOM: known layouts first, then role markers (author-role
attributes, then class/testid/aria hints). Off the known hosts detection is
deliberately conservative — four or more turns *and* explicit role markers on
most of them — so a comment thread does not light the button up.
`chatExchangeLimit` defaults to 10 exchanges, not 'all'.

Google's AI Mode is handled by its own extractor rather than the role heuristic:
it has no author-role attributes and its class names are build hashes. The
answer is Google's own result column, `data-container-id="main-col"`, and a
follow-up is a new `main-col`, not more text in the first one; the question is
the level-2 heading in front of each column, outside it. Headings inside a
column are the answer's own sections and stay in it. None of this has been
checked against a live capture: the tests' fixtures are reconstructed from this
model and from the class names two third-party exporters read off the page.

The surface lives on `/search`, the same path as an ordinary result page, so the
registry entry carries a `query` guard alongside the path test: `udm=50` *and*
something that names a conversation — a question (`q`) or a saved thread
(`mtid`). Without the first every Google search would offer to copy a
conversation; without the second so would the empty AI Mode home. `/ai` and
`/aimode` with a question count too. `mstk` names nothing and is never cited: it
reads as a per-session token, and `mtid` already names the thread. The cited
URL keeps `udm`, `q` and `mtid` and drops everything else, so it never carries
an empty `q=` or the tracking tokens of the address bar.

The question heading reads "You said: <question>" in the page's language, and a
question can hold a colon of its own ("Python: which library reads TOML?"), so
the label is cut only where the page proves it is one: every question shares
it, or what follows it is the question in the URL, or it is the English label.
A question that is, whole, the one in the URL proves the page has no label. A
lone question on a saved thread in another language has no proof either way and
keeps its label — a stray label is noise, a cut question is lost text.

Copy Chat scrolls the thread (a long one unmounts turns that are off screen),
reads what is mounted on each step, and lays each step over the tail of what it
has kept. A turn is matched on its question *and* its answer, never the
question alone, so "continue" asked twice is two exchanges. It always exports
the whole conversation. Citation chips are icon-only links whose `href` is
`/goto?url=<opaque>`, so the chip is replaced with the label the pill already
shows (`Stripe +3`) rather than an empty link or that token. Formulas are images
that carry their source in `data-xpm-latex`; they are written as `$…$` inside
`.mTEjhd` and as a `$$` block for `.cPGBZb`, through a Turndown rule, because as
text every underscore and backslash would be escaped. The trims that drop the
trailing disclaimer never take a formula.

On an AI Mode thread URL the extractor never returns null. No question heading
and no answer column, or questions with no answer text under them, throws a
`verbatim` error naming Google AI Mode and what was missing: handing the page to
the generic DOM reader would copy whatever it happened to hold under the AI Mode
label. Copying the page (main content or full page) does not fall through to
Readability or the body either: both keep the search shell, and the hidden copy
of the source list is base64 image payloads. The answer comes from `main-col`.
A full-page copy also appends the source column, `rhs-col`, one entry per card,
linked to the publisher site on the card's favicon URL — the card's own link is
the same opaque `/goto`. Off an AI Mode thread `convertPage` returns null and
the page converts like any other: an ordinary search shares the AI Mode host
and path, so refusing there would refuse every search. The registry's host
pattern is Google Search only (`google.<tld>` and `www.`): a subdomain
pattern would also claim `gemini.google.com`, which is listed after it, and
Docs and Gmail. The partial-transcript note is not added on this page.

**`reddit.js`** — the post plus its comment tree from Reddit's own JSON, fetched
same-origin (no extra host permission, and the user's session applies). Falls
back to scraping `shreddit-*` or old.reddit markup when the JSON endpoint
answers with the bot check.

**`x.js`** — threads, profiles and timelines. Signed-out x.com serves a
server-rendered page with schema.org microdata and no `data-testid`; the
extractor reads that, with the logged-in app's selectors as per-field fallbacks.

### Shared modules

`convert-core.js` owns the document-to-Markdown path and is loaded as a content
script, before `content.js`. It never reads `window.location` or
`document.title` — the caller passes the page's URL and title. Selection, chat
and the live scroll pass stay in `content.js`: they need a rendered page.

`multi-tab-utils.js` owns `runPool` (index cursor, dense results, the handler
must resolve rather than reject) and `convertTabToMarkdown`, which the multi-tab
path uses with its 4-way concurrency.

### Motion and interface

`motion.js` owns every value the user can touch. Rules:

1. **Springs, never CSS transitions, for anything gesture-driven.** A transition
   cannot be grabbed and reversed mid-flight; a spring re-targets from its live
   value and carries velocity. CSS transitions are allowed only for colour,
   opacity, shadow and the press scale.
2. **Feedback on pointer-down.** `Motion.pressable()` adds `.is-pressed` on
   `pointerdown`, drops it when the pointer leaves (with ~10px of slop).
3. **Gestures track 1:1, then hand off velocity.** `Motion.draggable()` gives
   pointer capture and a release velocity; `Motion.project()` picks the landing
   target from where the flick is going; `Motion.rubberband()` resists at edges.
   Capture is taken on `pointerdown`, not once the gesture engages: a surface
   that is already animating slides out from under the finger, and without
   capture the moves that would engage the drag land on whatever is now under
   the pointer.
4. **Chrome is a material** — translucent layers with content passing under, and
   a scroll-edge mask instead of divider lines. Never two light translucent
   layers on top of each other.

| Export | Purpose |
|--------|---------|
| `new Spring(value, {damping, response, onUpdate, onRest})` | `damping` 1.0 = no overshoot, `response` = seconds to approach |
| `spring.to(target, {velocity})` / `spring.set(value)` | Re-target mid-flight / write directly during a drag |
| `PRESETS` | `move` (1.0/0.4), `sheet` (0.8/0.3), `rotate` (0.8/0.4), `snappy` (1.0/0.28) |
| `project`, `rubberband`, `draggable`, `pressable`, `prefersReducedMotion` | Momentum, boundaries, gestures, press state, accessibility |

`styles.css` answers `prefers-reduced-motion` (cross-fades, no travel),
`prefers-reduced-transparency` (solid surfaces, no spectrum glow) and
`prefers-contrast: more` (near-opaque, bordered). Type is
Geist and Geist Mono (OFL, `extension/assets/fonts/`, preloaded by
`popup.html`, `font-display: block` so the popup never paints in a fallback
first) with size-specific tracking and rem spacing, so the user's text-size
setting grows the layout. Mono carries labels, counters and section titles.
`assets/` is copied whole by every target in `scripts/build.sh`; a file added
there needs no build change, a file added beside it does.

The main view is three bands. On top is the **page card**: the host's initial
on an ink tile, the host, a mode label, and the title. Below it is **one heavy
key** that copies. Last comes a **row of equal keys** for the variants: Save .md, the
opposite scope for this copy only (`#convertOverrideBtn`, Full page or Main
content), Copy page on a conversation (`#chatPageFallbackBtn`), and Selection
when there is one.

- **Mode.** `#mainView[data-mode]` is `page`, `chat`, `telegram` or `multi`, set by
  `setPageMode()`. CSS reads it to hide what does not apply: the scope key on a
  conversation, the title where the key or the tab list already names the
  subject, and the Telegram limits off Telegram.
- **What lands on the card.** The card carries the outcome of a copy (status and token count on its
  foot), the Telegram limits and, when turned on in Settings → Chats, the chat
  range (`#chatDaySegments` or `#chatSegments`, by `data-chat-range`). Both
  limits were once dropdowns; a seven-item menu has no room in a 28rem popup.
- **Chat range.** `chatRangeMode` is `days` (default, `chatDays` 3), `exchanges`
  (`chatExchangeLimit`) or `all`. `render()` in chat.js cuts by the exchange's
  first dated message. A chat with any undated exchange is cut by the exchange
  count and returns a `notice`; content.js sends it with the result and the popup
  shows it. A date range that holds nothing throws, naming the latest date.
  Settings with no mode (older callers) mean exchanges. It also carries the recipe chips, which are views of
  the Formatting checkboxes (`data-setting` is the checkbox id), not
  settings of their own.
- **No `title` attributes.** A native tooltip only repeated a button's label
  over the button. A control with no visible text carries an `aria-label`.
- **Layout.** The popup is a fixed 28rem tall, so the card takes whatever height the
  state leaves and a new state must fit in it. Settings are grouped into Copy,
  Chats, Sites, Interface and About; a new group goes into the section it
  is about.

## Adding a setting

1. Default in `extension/settings.js` (shared by popup and background).
2. Control in `popup.html`.
3. Plumbing in `popup.js`: element handle, `loadSettings`, `saveSettings`,
   `getCurrentSettings`, the two inline conversion payloads, and a change listener.
4. Read it in `content.js` or the relevant extractor.

## Adding a file to the extension

`manifest.json` (`content_scripts[0].js`, order matters — helpers before
`content.js`) **and** `scripts/build.sh`, which copies files explicitly in three
places (Chrome, Firefox, source).

A background-only file is not a content script: add it to the `importScripts`
call at the top of `background.js` (Chrome) and to the `background.scripts`
array in the build script's Firefox jq program, in load order. `multi-tab-utils.js`
is the example.

A file that belongs to only one browser goes in that browser's `cp` block alone.

## Browser differences

Chrome is MV3 with a service worker; the build script rewrites the same MV3
manifest for Firefox — `background.scripts` (an event page), and the Chrome-only
`favicon` permission stripped, since Firefox has no favicon cache for
extensions. `browser_specific_settings` stays as declared in the source
manifest. Use the
`browserAPI` wrapper in the popup and `browserRuntime` in content scripts.
