// Unshell Page Icon
// Where the popup's page card gets the site's own icon from, without a
// request of its own wherever the browser allows that:
// - Chrome keeps every tab's favicon in its own cache and serves it to an
//   extension page that declares the "favicon" permission, at
//   /_favicon/?pageUrl=…&size=…. Nothing leaves the browser.
// - Firefox has no such endpoint. It reports the tab's icon on the tab itself
//   (the "tabs" permission): a data: icon is used as it is, an http(s) one is
//   the address Firefox already loaded for that tab.
// - When the browser has none for the tab (Firefox's favIconUrl is
//   intermittently missing even while the tab strip shows one, bug 1417721),
//   or the one it has will not draw, the page is asked which icon it declares,
//   and that is tried next.
// A browser page, or a tab with no icon at all, has none, and the card keeps
// the host's initial.

var UnshellPageIcon = typeof UnshellPageIcon !== 'undefined' ? UnshellPageIcon : (function () {
  const SIZE = 32;

  function isWebAddress(url) {
    return /^https?:\/\//i.test(url || '');
  }

  function sourceFor(tab, options) {
    const opts = options || {};
    if (!tab) return '';

    if (!opts.firefox) {
      if (!isWebAddress(tab.url) || typeof opts.getURL !== 'function') return '';
      return `${opts.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(tab.url)}&size=${SIZE}`;
    }

    const icon = tab.favIconUrl || '';
    if (/^data:image\//i.test(icon) || isWebAddress(icon)) return icon;
    return '';
  }

  function isUsableIcon(source) {
    return /^data:image\//i.test(source || '') || isWebAddress(source);
  }

  // Every source worth trying, in order and without repeats: the browser's own
  // icon for the tab, then the icon the page declares.
  function candidates(tab, options) {
    const opts = options || {};
    const list = [];
    const primary = sourceFor(tab, opts);
    if (primary) list.push(primary);
    const declared = opts.pageIcon || '';
    if (isUsableIcon(declared) && !list.includes(declared)) list.push(declared);
    return list;
  }

  // rel="icon" (which "shortcut icon" also is) before an apple-touch-icon; a
  // page that declares neither still has /favicon.ico at its origin.
  const ICON_RELS = [/(^|\s)icon(\s|$)/i, /(^|\s)apple-touch-icon(-precomposed)?(\s|$)/i];

  function declaredIcon(doc, location) {
    const base = location && location.href ? location.href : '';
    if (!doc || !base) return '';
    const links = Array.from(doc.querySelectorAll('link[rel][href]'));
    for (const rel of ICON_RELS) {
      const link = links.find((candidate) => rel.test(candidate.getAttribute('rel')));
      if (!link) continue;
      const href = (link.getAttribute('href') || '').trim();
      if (/^data:image\//i.test(href)) return href;
      try {
        const resolved = new URL(href, base).href;
        if (isWebAddress(resolved)) return resolved;
      } catch (error) {
        // An href that is not an address at all: the next kind of link may be.
      }
    }
    return isWebAddress(base) ? `${new URL(base).origin}/favicon.ico` : '';
  }

  return { SIZE, sourceFor, candidates, declaredIcon };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnshellPageIcon;
}
