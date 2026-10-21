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
