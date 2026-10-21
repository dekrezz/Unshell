// Unshell Page Icon
// Where the popup's page card gets the site's own icon from, without a
// request of its own wherever the browser allows that:
// - Chrome keeps every tab's favicon in its own cache and serves it to an
//   extension page that declares the "favicon" permission, at
//   /_favicon/?pageUrl=…&size=…. Nothing leaves the browser.
// - Firefox has no such endpoint. It reports the tab's icon on the tab itself
//   (the "tabs" permission): a data: icon is used as it is, an http(s) one is
//   the address Firefox already loaded for that tab.
// A browser page, or a tab with no icon, has none, and the card keeps the
// host's initial.

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

  return { SIZE, sourceFor };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnshellPageIcon;
}
