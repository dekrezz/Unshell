// Research is gone: the extension searched DuckDuckGo, read every result in
// the background and merged them into one file. Removing it removes what it
// alone needed — the DuckDuckGo hosts, the optional access to every site that
// quiet capture asked for, the offscreen document Chrome parsed sources in,
// and the Firefox declaration that the question typed into it left the
// browser. What remains declares no data collection at all.

const fs = require('fs');
const path = require('path');

const EXT = path.join(__dirname, '../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const popupHtml = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
const buildScript = fs.readFileSync(path.join(__dirname, '../scripts/build.sh'), 'utf8');

describe('no research', () => {
  it('asks for no host but the token counter\'s', () => {
    expect(manifest.host_permissions).toEqual(['https://tiktoken.pages.dev/*']);
    expect(manifest.optional_host_permissions).toBeUndefined();
  });

  it('has no offscreen document', () => {
    expect(manifest.permissions).not.toContain('offscreen');
    expect(fs.existsSync(path.join(EXT, 'offscreen.html'))).toBe(false);
    expect(fs.existsSync(path.join(EXT, 'offscreen.js'))).toBe(false);
  });

  it('tells Firefox it collects no data', () => {
    expect(manifest.browser_specific_settings.gecko.data_collection_permissions).toEqual({ required: ['none'] });
  });

  it('ships none of the research engine', () => {
    for (const file of ['research.js', 'search.js', 'quiet-capture.js', 'source-quality.js']) {
      expect([file, fs.existsSync(path.join(EXT, file))]).toEqual([file, false]);
      expect([file, buildScript.includes(file)]).toEqual([file, false]);
    }
  });

  it('has no research bar or sheet in the popup', () => {
    expect(popupHtml).not.toMatch(/id="research/);
    expect(popupHtml).not.toMatch(/name="researchCapture"/);
  });
});
