# Contributing to Unshell

Thanks for helping. This page covers the human side. [AGENTS.md](AGENTS.md) has the architecture, the extractor contract and the rules in full, so read it before touching `extension/`.

## Before you start

- **Bugs:** file an issue using the bug template. Include the URL, the action you used (page, selection, chat) and the Markdown you got. Most extraction bugs depend on the page, so one real URL helps more than a paragraph of description.
- **Features and new site extractors:** open a feature request first. A new extractor means maintaining it every time the site changes its markup, so it's worth agreeing on before you write it.
- **Small fixes** (typos, an obvious one-line bug) can go straight to a pull request.

## Build and load

```bash
git clone https://github.com/dekrezz/Unshell.git
cd Unshell
bash scripts/build.sh all          # Chrome, Firefox and source packages in dist/
```

Load the package as described in the [README](README.md#2-load-it), open the pages your change affects and use it the way a user would.

## Checks before you push

```bash
node --check extension/<file>.js
npx eslint@8 --no-eslintrc --env browser,es2022 \
  --parser-options ecmaVersion:2022 extension/*.js
bash scripts/build.sh all
jq empty extension/manifest.json
```

CI runs the Jest suite and the package checks on every pull request, so you don't need to run the suite locally.

## Rules the code follows

- **No silent fallbacks.** When an extraction path fails, the user gets a specific message that says what was missing. Never quietly hand back a worse result.
- **No build step for our code.** No bundler, minifier or transpiler. The packaged files are the repository files byte for byte, and add-on reviewers rely on that ([REVIEWERS.md](REVIEWERS.md)).
- **New files go into `scripts/build.sh`.** The script copies files by name. CI fails if a file in `extension/` is missing from a package.
- **Libraries in `extension/libs/` stay as released.** Any local edit is disclosed in REVIEWERS.md with the reason.
- **Network and permissions are a user-facing promise.** A new request or a new manifest permission needs the [Privacy and permissions](README.md#privacy-and-permissions) section updated in the same pull request, and a reason in the description.

## Commits

Area on line one, then a blank line, `Changes:`, a blank line and bullets describing what the user will notice:

```
Frontend

Changes:

- The Copy chat key now names the site it read from
```

The areas are `Frontend`, `Backend` and `Docs`. No `Co-Authored-By` trailers and no "generated with" footers.

## Pull requests

1. Open it as a draft and review your own diff first.
2. Fill in the template: what changed, the real URLs you tested on, and screenshots for anything visible.
3. Fill in the AI disclosure. CI checks it, and the pull request can't be merged without it. The rules are in [AI_POLICY.md](AI_POLICY.md).

## Security issues

Don't open a public issue. See [SECURITY.md](SECURITY.md).

## License

Unshell is licensed under [Apache 2.0](LICENSE). By submitting a contribution you agree it is licensed under the same terms, as section 5 of the license describes.
