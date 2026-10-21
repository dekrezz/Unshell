# Notes for AMO reviewers

For the submission of Unshell (`unshell@dekrezz.dev`).

## Build

```bash
git clone https://github.com/dekrezz/Unshell.git
cd Unshell
bash scripts/build.sh firefox      # -> dist/Unshell-Firefox-v<version>.zip
```

The command reproduces the uploaded package exactly. No minifier, bundler,
transpiler or template engine touches our own code: every file in the package is
the file in the repository, byte for byte. `scripts/build.sh` only copies files
and rewrites two manifest keys for Firefox (`background.scripts` instead of a
service worker, and dropping the Chrome-only `favicon` permission).

## Third-party libraries (`extension/libs/`)

Three of the four are byte-identical to their official releases:

| File | Version | License | Official file | sha256 |
|------|---------|---------|---------------|--------|
| `jszip.min.js` | JSZip 3.10.1 | MIT / GPLv3 | https://unpkg.com/jszip@3.10.1/dist/jszip.min.js | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |
| `readability.js` | @mozilla/readability 0.6.0 | Apache-2.0 | https://unpkg.com/@mozilla/readability@0.6.0/Readability.js | `34dcab3d0832d0019f02990eed6b6124e029e8c32b9f0c6f2550544ff8dff174` |
| `browser-polyfill.js` | webextension-polyfill 0.12.0 | MPL-2.0 | https://unpkg.com/webextension-polyfill@0.12.0/dist/browser-polyfill.js | `cfc53c3525587467c783ef1c6fdefbaf1d60ed197ea2fe0d45899b18069cf496` |

Readable sources: <https://github.com/Stuk/jszip/tree/v3.10.1>,
<https://github.com/mozilla/readability>, <https://github.com/mozilla/webextension-polyfill>.
Only `jszip.min.js` is minified, and it is the unmodified official build — the
`Function` constructor the linter flags inside it is part of that release.

### `turndown.js` is modified — full disclosure

`extension/libs/turndown.js` is **Turndown 7.2.1** (MIT,
<https://github.com/mixmark-io/turndown>) with four local edits. It is not
minified, so the changes are readable in place. Compare against
<https://unpkg.com/turndown@7.2.1/dist/turndown.js>:

1. Adds a helper `trimNewlines(string)`, equal to
   `trimTrailingNewlines(trimLeadingNewlines(string))`.
2. `blockquote` rule: the two-step `content.replace(/^\n+|\n+$/g, '')` becomes
   `trimNewlines(content)`. Same result in one pass.
3. `listItem` rule: leading and trailing newlines are trimmed with
   `trimNewlines`, and a single trailing newline is restored only when the
   content ended in one — so a list item containing a paragraph keeps its break
   while a plain item does not gain a blank line.
4. `listItem` rule: the newline emitted before a following sibling is
   unconditional, instead of being suppressed when the content already ends in
   a newline.

Why: without them, nested lists in Reddit threads and chat transcripts came out
with a blank line between every item, which changes what the Markdown means.
Nothing else in the library is touched — no network access, no evaluation, no
behaviour beyond whitespace in those two rules.

## Permissions

- `host_permissions`: `tiktoken.pages.dev` — static tokenizer data for the
  optional token counter, fetched once and cached.
- `tabs`, `scripting` — multi-tab copy, and injecting the converter into the
  current tab.

No remote code is executed and nothing is `eval`'d by our code.

## Data collection

`data_collection_permissions.required: ["none"]`: Unshell collects no data.
Page conversion, selection copying and chat extraction are entirely local, and
no data reaches any server operated by the developer. There is no analytics,
telemetry or account.

## How to exercise it

1. Open any article, click the toolbar icon, press **Convert & Copy** — the page
   is on the clipboard as Markdown.
2. **Copy Selection** with text highlighted returns just that fragment.

## The linter warnings

The package passes validation with 0 errors. Every warning falls into one of
three groups, and none of them is a live code path on Firefox.

**Manifest key newer than strict_min_version.**
`data_collection_permissions` (Firefox 140+) is declared while
`strict_min_version` stays at 109. Older builds ignore it rather than failing.
Raising the minimum would drop working installs to silence a warning.

**innerHTML (6 warnings).** None takes attacker-controlled input into a live
page:
- `content.js:1046` — one of three hard-coded SVG string literals defined
  directly above (lines 1022-1044). No interpolation.
- `convert-core.js:52` — copies the page into an inert document created with
  `implementation.createHTMLDocument()`. Inert documents do not execute scripts
  or load resources; this is how Readability is given a private copy.
- `convert-core.js:926` — truncates already-inert cloned content into a detached
  `div` that is only handed to Turndown, never inserted into any document.
- `libs/readability.js:1549,1928` — inside the unmodified upstream library.

**`Function` in jszip.min.js (1 warning).** Part of the unmodified official
JSZip 3.10.1 release, checksum above. We do not call it and execute no remote
code.
