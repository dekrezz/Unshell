// Where the popup's page card gets the site's own icon from.
//
// Chrome keeps every tab's favicon in its own cache and serves it to an
// extension page that declares the "favicon" permission, at
// /_favicon/?pageUrl=…&size=…, so the icon costs no request to the site.
// Firefox has no such endpoint; it reports the tab's icon address on the tab
// itself (the "tabs" permission). A browser page, or a tab with no icon, has no
// icon, and the card keeps the host's initial.

const UnshellPageIcon = require('../extension/page-icon.js');

const getURL = (path) => `chrome-extension://abcdefgh${path}`;

describe('page icon source', () => {
  it('asks Chrome\'s favicon cache for a web page, by the page address, at 32 px', () => {
    const tab = {
      url: 'https://docs.python.org/3/library/tomllib.html?highlight=load#tomllib.load',
      favIconUrl: 'https://docs.python.org/favicon.ico'
    };
    expect(UnshellPageIcon.sourceFor(tab, { firefox: false, getURL })).toBe(
      'chrome-extension://abcdefgh/_favicon/?pageUrl=' +
      encodeURIComponent('https://docs.python.org/3/library/tomllib.html?highlight=load#tomllib.load') +
      '&size=32'
    );
  });

  it('has no icon in Chrome for a browser page', () => {
    expect(UnshellPageIcon.sourceFor({ url: 'chrome://extensions/' }, { firefox: false, getURL })).toBe('');
    expect(UnshellPageIcon.sourceFor({ url: 'about:blank' }, { firefox: false, getURL })).toBe('');
  });

  it('uses the icon Firefox reports for the tab, as an address or as data', () => {
    expect(UnshellPageIcon.sourceFor(
      { url: 'https://example.com/', favIconUrl: 'https://example.com/icon.png' },
      { firefox: true }
    )).toBe('https://example.com/icon.png');
    expect(UnshellPageIcon.sourceFor(
      { url: 'https://example.com/', favIconUrl: 'data:image/png;base64,AAAA' },
      { firefox: true }
    )).toBe('data:image/png;base64,AAAA');
  });

  it('has no icon in Firefox when the tab reports none, or only a browser-internal one', () => {
    expect(UnshellPageIcon.sourceFor({ url: 'https://example.com/' }, { firefox: true })).toBe('');
    expect(UnshellPageIcon.sourceFor(
      { url: 'about:addons', favIconUrl: 'chrome://mozapps/skin/extensions/extension.svg' },
      { firefox: true }
    )).toBe('');
  });

  it('has no icon without a tab', () => {
    expect(UnshellPageIcon.sourceFor(null, { firefox: false, getURL })).toBe('');
    expect(UnshellPageIcon.sourceFor(undefined, { firefox: true })).toBe('');
  });
});

// When the browser has no icon for the tab — Firefox's favIconUrl is
// intermittently missing even while the tab strip shows one (bug 1417721) —
// or the one it has will not draw, the page itself is asked which icon it
// declares, and that is tried next.
describe('icon candidates, in the order they are tried', () => {
  const declared = 'https://example.com/static/icon.svg';

  it('in Chrome: the favicon cache first, then the icon the page declares', () => {
    const tab = { url: 'https://example.com/docs/page.html' };
    expect(UnshellPageIcon.candidates(tab, { firefox: false, getURL, pageIcon: declared })).toEqual([
      'chrome-extension://abcdefgh/_favicon/?pageUrl=' + encodeURIComponent('https://example.com/docs/page.html') + '&size=32',
      declared
    ]);
  });

  it('in Firefox: the icon reported for the tab first, then the declared one', () => {
    const tab = { url: 'https://example.com/', favIconUrl: 'data:image/x-icon;base64,AAAA' };
    expect(UnshellPageIcon.candidates(tab, { firefox: true, pageIcon: declared }))
      .toEqual(['data:image/x-icon;base64,AAAA', declared]);
  });

  it('in Firefox with no reported icon: the declared one alone', () => {
    expect(UnshellPageIcon.candidates({ url: 'https://example.com/' }, { firefox: true, pageIcon: declared }))
      .toEqual([declared]);
  });

  it('never lists one icon twice, and never a browser-internal or script address', () => {
    const tab = { url: 'https://example.com/', favIconUrl: declared };
    expect(UnshellPageIcon.candidates(tab, { firefox: true, pageIcon: declared })).toEqual([declared]);
    expect(UnshellPageIcon.candidates({ url: 'https://example.com/' }, { firefox: true, pageIcon: 'javascript:alert(1)' }))
      .toEqual([]);
    expect(UnshellPageIcon.candidates({ url: 'https://example.com/' }, { firefox: true, pageIcon: 'chrome://branding/icon.png' }))
      .toEqual([]);
  });

  it('is empty with no tab and nothing declared', () => {
    expect(UnshellPageIcon.candidates(null, { firefox: true })).toEqual([]);
  });
});

describe('the icon a page declares', () => {
  const page = (head) => {
    const doc = document.implementation.createHTMLDocument('');
    doc.head.innerHTML = head;
    return doc;
  };
  const at = new URL('https://example.com/docs/page.html');

  it('is its rel="icon" link, resolved against the page address', () => {
    expect(UnshellPageIcon.declaredIcon(page('<link rel="shortcut icon" href="../static/fav.png">'), at))
      .toBe('https://example.com/static/fav.png');
  });

  it('prefers a rel="icon" link over an apple-touch-icon', () => {
    const doc = page('<link rel="apple-touch-icon" href="/touch.png"><link rel="icon" href="/icon.svg">');
    expect(UnshellPageIcon.declaredIcon(doc, at)).toBe('https://example.com/icon.svg');
  });

  it('falls back to an apple-touch-icon', () => {
    expect(UnshellPageIcon.declaredIcon(page('<link rel="apple-touch-icon" href="/touch.png">'), at))
      .toBe('https://example.com/touch.png');
  });

  it('keeps a data: icon as it is', () => {
    const icon = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';
    expect(UnshellPageIcon.declaredIcon(page(`<link rel="icon" href="${icon}">`), at)).toBe(icon);
  });

  it('is /favicon.ico at the page origin when nothing is declared', () => {
    expect(UnshellPageIcon.declaredIcon(page(''), at)).toBe('https://example.com/favicon.ico');
  });

  it('is nothing on a page that is not on the web', () => {
    expect(UnshellPageIcon.declaredIcon(page(''), new URL('file:///tmp/notes.html'))).toBe('');
  });
});
