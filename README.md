<p align="center">
  <img src="extension/icons/icon128.png" alt="Unshell" width="128" />
</p>

<h1 align="center">Unshell</h1>

<p align="center"><em>Formerly called ScrapLLM.</em></p>

<p align="center">
  <strong>Browser extension that turns web pages and chats into clean Markdown for LLMs</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
  <a href="https://github.com/dekrezz/Unshell/releases"><img alt="Version" src="https://img.shields.io/github/manifest-json/v/dekrezz/Unshell?filename=extension%2Fmanifest.json&label=version&color=blue" /></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-V3-111111.svg" />
  <img alt="Chrome and Firefox" src="https://img.shields.io/badge/browsers-Chrome%20%7C%20Firefox-4d6bfe.svg" />
</p>

<p align="center">
  <a href="#start-here">Start here</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#what-you-get">What you get</a> •
  <a href="#site-aware-extraction">Sites</a> •
  <a href="#research">Research</a> •
  <a href="#shortcuts">Shortcuts</a> •
  <a href="#settings">Settings</a> •
  <a href="#privacy-and-permissions">Privacy</a> •
  <a href="#build">Build</a>
</p>

## Start here

**What it is.** Unshell turns whatever is on your screen into Markdown you can paste into ChatGPT, Claude, Gemini or any other LLM. One click copies a page, one copies a highlighted fragment, one copies a whole chat transcript. It runs in Chrome and Firefox.

**What stays private.** Conversion happens in your browser. There is no account, no telemetry, and page content is never sent anywhere. What does touch the network is listed under [Privacy and permissions](#privacy-and-permissions): the optional token counter, **Research**, and the extractors that read a site's own API instead of its rendered page.

**You need:** Chrome or Firefox, plus Git, `bash` and `zip` to build the package from source. Packaged builds are also attached to [Releases](https://github.com/dekrezz/Unshell/releases).

### 1. Build it (one minute)

```bash
git clone https://github.com/dekrezz/Unshell.git
cd Unshell
bash scripts/build.sh all          # or: make chrome / make firefox
```

Packages land in `dist/`.

### 2. Load it

| Browser | Steps |
|---|---|
| Chrome | `chrome://extensions` → Developer mode → Load unpacked → the extracted `dist/Unshell-Chrome-*.zip` |
| Firefox | `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json` from the extracted Firefox package |

Release Firefox only installs signed add-ons permanently. For a permanent unsigned install use Developer Edition, Nightly or ESR with `xpinstall.signatures.required=false`.

### 3. Copy something

Open any page and press `Alt+Shift+M`, or click the toolbar button and pick an action. Paste into your model. Everything else is below.

---

Unshell is a derivative work of LLMFeeder by Jatin K Malik (see [License](#license)). It uses Mozilla Readability to find the article and Turndown to write the Markdown, and adds extractors for the sites where a generic conversion loses the point.

---

## Contents

- [Start here](#start-here)
- [What you get](#what-you-get)
- [Features](#features)
- [Quick start](#quick-start)
- [Site-aware extraction](#site-aware-extraction)
- [Research](#research)
  - [Two capture paths](#two-capture-paths)
  - [When a source resists](#when-a-source-resists)
  - [The junk filter](#the-junk-filter)
  - [Replacements](#replacements)
  - [Limits](#limits)
- [Shortcuts](#shortcuts)
- [Settings](#settings)
- [Privacy and permissions](#privacy-and-permissions)
- [Project layout](#project-layout)
- [Build](#build)
- [Credits](#credits)
- [License](#license)

---

## What you get

| Action | What you get |
|--------|--------------|
| **Convert & Copy** | The page as Markdown: article body by default, full page on demand |
| **Copy Selection** | Only what you highlighted, prefixed with the line range and source. Code is detected and fenced with its language; prose keeps its links and lists |
| **Copy Chat** | An LLM conversation with roles and timestamps: the whole thread or just the last N exchanges |
| **Download Markdown** | The same output as a `.md` file |
| **Multi-tab** | Several selected tabs at once, merged into one file or zipped separately |
| **Research** | One question in, one Markdown file out: the extension searches the web, reads each source with no tab at all, converts it, and downloads the merged document |

## Features

- **Chrome and Firefox:** one source tree, a Manifest V3 build for each browser
- **Local conversion:** Readability and Turndown run in your browser
- **Site-aware extractors:** Reddit, X, GitHub, GitHub Discussions, YouTube, Discord, Telegram and LLM chat front-ends
- **Research:** DuckDuckGo search, credential-less capture, a junk filter and automatic replacements
- **Token counter:** optional
- **Keyboard shortcuts:** four defaults, rebindable
- **No silent fallbacks:** when an extraction path fails, you get a specific message
- **License:** MIT

---

## Quick start

```bash
git clone https://github.com/dekrezz/Unshell.git
cd Unshell
bash scripts/build.sh all
```

`build.sh` takes one of `chrome`, `firefox`, `source` or `all`, and an optional version:

```bash
bash scripts/build.sh chrome | firefox | source | all
bash scripts/build.sh --version 2.3.0 all
```

The output files are `dist/Unshell-Chrome-v<version>.zip`, `dist/Unshell-Firefox-v<version>.zip` and `dist/Unshell-Source-v<version>.zip`. `make chrome`, `make firefox`, `make source` and `make all` call the same script. Load the result as shown in [Start here](#start-here).

---

## Site-aware extraction

- **Reddit:** the post plus its full comment tree (author, score, flair), read from Reddit's own JSON so collapsed replies survive. Replies are addressed by position in the tree (`[1]`, `[1.1]`, `[1.1.1]`) rather than by indentation. Deleted comments are dropped and their surviving replies move up into the slot. Reddit's own promoted posts and comment-tree ads are removed on every path, including full-page copies.
- **X (Twitter):** threads with replies, quoted posts and engagement counts; profiles and timelines as an index.
- **GitHub Discussions:** the post and its whole reply thread, with authors, timestamps, role badges and reactions, read from the page because discussions exist only in GitHub's GraphQL API. Replies are addressed by position, and each field is read from the comment it belongs to, because GitHub nests a reply inside the comment it answers.
- **GitHub:** a repository page as the name, description and facts, then the README **as its original Markdown** and the complete recursive file tree. Both come from GitHub's API rather than the page. This costs three of the 60 requests an hour GitHub grants a signed-out caller, and says so by name when they run out.
- **YouTube:** a video as its title, channel and facts, the description **in full** (the page clamps it to two lines), and the comment thread with likes, dates and replies. Comments are read from the same endpoint the page uses, a page at a time up to your ceiling.
- **Discord:** the open channel as a transcript: authors, timestamps, reply context and attachment links, with the virtualised list scrolled upward for history. It is read from the rendered page on purpose: Discord's API needs your account token, which Discord treats as self-botting and bans for.
- **Telegram:** the open conversation on `web.telegram.org` as a transcript. Channels, groups, forum topics, private chats and bots are told apart and rendered as what they are; a bot keeps its button menus. Message bodies go through Turndown, so a linked word stays a link. Telegram's own sponsored posts are dropped. On a Telegram page the popup replaces Convert & Copy with one button naming the target (for example "Copy Жалобы topic"), with a ceiling on the last N messages and an optional date range.
- **Chats:** ChatGPT, Claude, Gemini, Google AI Mode, Grok, Perplexity, DeepSeek, Copilot, Cursor, and self-hosted front-ends on a local port (Open WebUI, LibreChat, LobeChat, AnythingLLM, Jan). On ChatGPT and Claude the transcript comes from the site's own API and follows the branch you actually see, so messages you edited away stay out.

---

## Research

Type a question into the bar at the bottom of the popup. The extension searches DuckDuckGo, captures each accepted result, and downloads one Markdown file with front matter, a numbered source list and every captured page.

### Two capture paths

Most sources are captured **quietly**, with no tab created at any point. The page's HTML is fetched in the background and converted with the same Readability and Turndown code the content script runs.

That fetch is deliberately **credential-less**. A search result, or something in its redirect chain, cannot pull your logged-in copy of a page into a file you are about to paste into a model. It also refuses anything pointing at your own machine or LAN (`localhost`, `*.local`, private IP ranges), before the request and again after redirects, and it stops reading a body at 5 MB.

A source falls back to a **rendered** capture (one muted background tab, for that source only) when the quiet path hits something a browser is genuinely needed for: a bot check or other non-2xx status, a redirect onto a consent or login host or path, an empty JavaScript shell, a failed parse, or fewer than 500 characters of extracted text. Reddit and X escalate before the fetch, because their extractors need the live page. A PDF, a 404 or 410, a network failure, or a body the server never identified are refused by name, because a tab could not help either.

Each source says which path it took: `host · rendered` on its row in the popup (quiet is the default, so it is not badged), in the screen-reader label, and in a `Note:` line in the document. The front matter counts both.

The quiet path needs read access to the sites it fetches. That is an **optional** permission, asked for from the Research button the first time you use it. If you decline, the run uses a tab per source, which needs no permission, and says so once.

### When a source resists

Each source gets a ladder: the quiet fetch, then a background tab when the fetched HTML cannot answer for the page, then **one** delayed retry of both (3 s plus up to 2 s of jitter). There is no third pass. A retry only starts when the delay plus a whole capture still fits in the run's 4 minutes. A source that only worked the second time says so, on its row and in the document.

| | Example | Retried |
|---|---|---|
| **Transient** | network failure, timeout, 5xx, an unrendered shell, a tab that never became scriptable | yes |
| **Wall** | an active bot challenge, a repeated 401/403/429, a hard paywall, a login or consent gate that yielded nothing in a tab either | no |
| **Unusable** | a PDF or other non-HTML type, a 404 or 410, a private address, a body over 5 MB | no |

A wall reads as **skipped**, not as an error, so the popup draws it as a muted dash and the result card counts the kinds apart ("2 failed, 1 skipped, 1 dropped by the filter"). Bot checks are recognised by the markers only a challenge page carries (Cloudflare, DataDome, PerimeterX, Imperva). A plain hCaptcha or reCAPTCHA script counts only when the response backs it up: a body under 60 KB or a non-2xx status.

### The junk filter

Every capture is scored as Markdown, so a page is judged by what would actually reach the model. The signals are ad-and-promo phrase density, calls to action, link-text share and links per 100 words, affiliate-shaped targets, repeated lines, how little of the page is written in paragraphs, thin content, heading-to-substance ratio, and overlap with your question. A page is dropped at 100 points and no single signal reaches that alone, so a rejection always rests on at least two independent measurements. Near-duplicates are caught by comparing 6-word shingles (Jaccard 0.75).

It deliberately does *not* treat two things as spam: **a short page** (thinness tops out at 35 points) and **a price** (only promotional phrasing is measured, so a pricing page and a hardware review survive).

The thresholds are calibrated on real pages captured through the extension's own path: 10 affiliate, coupon and paid-signal landings against 14 genuine ones (MDN, Wikipedia, the Rust book, CPython and SQLite release notes, tokio's tutorial, curl's changelog, Proton's pricing page, TechRadar's VPN deals). Every spam page that converted at all was rejected, at 100 to 135; the highest-scoring genuine page reached 70 and the next 55. The one mirrored pair scored 0.937 on the duplicate check, every other pair under 0.02. The filter is one switch in Settings, on by default.

### Replacements

Whenever a source ends without a capture (skipped at a wall, dropped by the filter, or failed after its retry), the next reserve search result is promoted and captured in its place, until the reserves run out or not enough of the run's budget is left. A promoted row is appended to the list and marked "replacement". The source it replaced keeps its verbatim reason in `### Not fetched`, and the front matter states whether the filter was on, how many pages it dropped and how many replacements were pulled in.

### Limits

- **It is not a browsing agent.** One query, one round of results. It does not follow links, reformulate the question, or read the pages it downloads.
- **5, 8 or 12 sources per run.** The number in the progress counter is how many sources survived filtering. DuckDuckGo returns ten results a page, so 12 is a ceiling rather than a promise.
- **It skips what it cannot read, and says so.** PDFs and other non-pages, login walls (LinkedIn, Facebook, Quora, Academia), paywalled publishers (WSJ, FT, NYT, Medium) and duplicate hosts are dropped before fetching, each with its reason. Every dropped or failed source is listed under `### Not fetched` in the document and in the popup.
- **Nothing is scrolled.** The lazy-load pass is forced off for research, so infinite feeds and sections that only load on scroll are captured as the server sent them. Every source carries a note saying so.
- **A quiet capture is not your session.** No cookies are sent, so a personalised or member-only page comes back walled or thin and escalates to a tab, where your own session applies.
- **A thin capture says it is thin.** Above the 500-character floor but under 1500, the text is kept and labelled.
- **Budgets, not hangs.** 10 s for a fetch, 20 s for a page to become scriptable, 30 s for its conversion, 4 minutes for the whole run, three sources at a time. Whatever is left over comes back as skipped.
- **Cancel opens no tabs.** It stops the run, closes any tab it had opened, and keeps whatever was already captured. A crashed or restarted browser has its leftover tabs cleaned up on the next start.

---

## Shortcuts

| Action | Default |
|--------|---------|
| Open Unshell | `Alt+Shift+L` |
| Convert & copy | `Alt+Shift+M` |
| Download Markdown | `Alt+Shift+D` |
| Download tabs as ZIP | `Alt+Shift+Z` |

Rebind them at `chrome://extensions/shortcuts` or in Firefox's add-on manager.

---

## Settings

- **Content scope:** main article, full page, or selection
- **Formatting:** tables, images, links, page title, metadata template
- **Reddit:** comment sort and a cap on comments per thread
- **X:** replies on or off and a cap on posts
- **Chat:** how many exchanges to copy (defaults to the last 10, not the whole thread)
- **Research:** how many sources one run tries to capture (5, 8 or 12), on the research sheet itself
- **Quality filter:** *Drop low-value sources and replace them*, on by default
- **Capture:** *Quiet* (the default: read sources without a tab, falling back to one only where a page needs it) or *Always render*, which opens a background tab for every source
- **Token counter**, **debug logging**, **lazy-load auto-scroll**

---

## Privacy and permissions

Page content is never sent anywhere. The network is touched in these cases only:

- **Token counter (optional):** fetches static tokenizer data from `tiktoken.pages.dev` once and caches it.
- **Research:** sends your question to DuckDuckGo (`html.duckduckgo.com`, falling back to `lite.duckduckgo.com`) to find sources, then reads each accepted source itself, without your cookies. Rate limiting, a blank result page and changed markup are reported as distinct, specific errors rather than as an empty file.
- **Site-specific extractors:** on Reddit, GitHub and YouTube, and for ChatGPT and Claude transcripts, the extractor calls the site's own endpoints instead of reading the rendered page, as described under [Site-aware extraction](#site-aware-extraction).

Declared in `extension/manifest.json`:

| Kind | Entries |
|---|---|
| Permissions | `activeTab`, `tabs`, `clipboardWrite`, `storage`, `scripting`, `contextMenus`, `menus`, `offscreen` |
| Required hosts | `https://tiktoken.pages.dev/*`, `https://html.duckduckgo.com/*`, `https://lite.duckduckgo.com/*` |
| Optional hosts | `*://*/*`, requested at run time for quiet Research capture |
| Firefox data collection | `searchTerms` (your Research question) |

The build drops the Chrome-only `offscreen` permission from the Firefox package. Notes for add-on reviewers, including the status of the bundled libraries, are in [REVIEWERS.md](REVIEWERS.md).

---

## Project layout

```
extension/
├── manifest.json        Extension manifest (MV3; the build rewrites it for Firefox)
├── popup.html/js        Popup UI and settings
├── settings.js          Shared setting defaults, used by popup and background
├── styles.css           Popup styles
├── assets/              Popup fonts (Geist, Geist Mono, OFL licence) and the particle halo
├── motion.js            Springs, gestures, momentum, press feedback
├── content.js           Live-page extraction: selection, chat, lazy-load scroll
├── convert-core.js      Document to Markdown, shared by content script, worker and offscreen
├── selection.js         Highlighted-fragment excerpts (code vs prose, line range)
├── chat.js              LLM conversation export (site API + DOM fallback)
├── reddit.js            Reddit threads and listings
├── github.js            GitHub repositories and Discussions
├── discord.js           Discord channels
├── telegram.js          Telegram conversations
├── youtube.js           YouTube videos and comments
├── x.js                 X threads, profiles and timelines
├── multi-tab-utils.js   Multi-tab batching, worker pool, filenames, ZIP naming
├── search.js            Research: DuckDuckGo source discovery (background only)
├── quiet-capture.js     Research: credential-less fetch, guards, escalation signals
├── research.js          Research: run engine, capture paths, merged document
├── source-quality.js    Research: the junk and duplicate filter (pure, background only)
├── token-counter.js     Token estimation
├── background.js        Keyboard shortcuts, context menus, multi-tab work, research port
├── offscreen.html/js    Chrome only: the DOM the MV3 worker does not have
├── icons/               Extension icons (16, 48, 128, 1024)
└── libs/                Readability, Turndown, JSZip, browser-polyfill
```

Contributor and agent rules, architecture and the checks to run are in [AGENTS.md](AGENTS.md).

---

## Build

```bash
bash scripts/build.sh chrome | firefox | source | all
bash scripts/build.sh --version 2.3.0 all
```

Packages land in `dist/`. The Firefox build only copies files and rewrites two manifest keys (`background.scripts` instead of a service worker, and no `offscreen` permission). The release workflow builds all three packages and attaches them to a GitHub release when one is created.

---

## Credits

- **LLMFeeder** by Jatin K Malik ([@jatinkrmalik](https://github.com/jatinkrmalik)), the original project this is derived from.
- [Mozilla Readability](https://github.com/mozilla/readability) (Apache-2.0), [Turndown](https://github.com/mixmark-io/turndown) (MIT, with local edits disclosed in [REVIEWERS.md](REVIEWERS.md)), [JSZip](https://github.com/Stuk/jszip) (MIT / GPLv3) and [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) (MPL-2.0), bundled in `extension/libs/`.
- [Geist and Geist Mono](https://github.com/vercel/geist-font) by Vercel, in collaboration with basement.studio (SIL OFL 1.1), bundled in `extension/assets/fonts/` with their licence.

## License

MIT. Copyright 2024-2026 Jatin K Malik (original LLMFeeder) and 2026 dekrezz (Unshell, formerly ScrapLLM, derivative work). See [LICENSE](LICENSE).
