# Security policy

Unshell reads every page you use it on and writes to your clipboard. A bug in it can leak what you were reading, or plant text you never saw in a prompt. Those are the reports we want most.

## Reporting

Report privately through GitHub: **[Report a vulnerability](https://github.com/dekrezz/Unshell/security/advisories/new)**. Please don't open a public issue, discussion or pull request for a security problem.

Include:

- the Unshell version and the browser with its version
- a URL, or better, a minimal HTML page that reproduces the problem
- the steps, and what happens compared with what should happen
- what an attacker gets out of it

You'll get a reply within 7 days. Once the fix ships, the advisory is published, and you're credited in it and in the release notes unless you'd rather not be.

## Supported versions

Only the latest release gets fixes. Check that the problem still exists on the latest release, or on `main`, before reporting.

## In scope

- **Page content leaving the browser** in a way not listed under [Privacy and permissions](README.md#privacy-and-permissions).
- **Hidden text in the output.** If a page can get text the reader can't see into the copied Markdown (hidden elements, zero-size text, off-screen blocks) and use it to steer the model it's pasted into, that's a prompt-injection path and we treat it as a security bug.
- **Code execution from page content** in the popup, the background script or the extension's own pages.
- **One site's data reaching another**: content, cookies or extractor results crossing between tabs or origins.
- **Permission problems**: Unshell using a permission for something other than its documented purpose, or a build that ships permissions the manifest doesn't declare.
- **Tampered bundled libraries**: a file in `extension/libs/` that doesn't match the hash or the disclosed edits in [REVIEWERS.md](REVIEWERS.md).

## Out of scope

- Bugs in Readability, Turndown, JSZip or webextension-polyfill that Unshell doesn't make worse. Report them upstream. If Unshell's use of a library creates the problem, it's in scope.
- Attacks that need a compromised browser, a malicious extension that's already installed, or physical access to the machine.
- A site's own API returning data its owner didn't mean to publish.
- Wrong or incomplete Markdown with no security impact. That's a normal bug, so use the issue tracker.
