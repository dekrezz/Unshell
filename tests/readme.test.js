// The README's version badge is a plain shields.io badge: the repository is
// private, so a badge that reads extension/manifest.json from GitHub cannot
// reach it and shows "repo not found". A plain badge can drift instead, so the
// version it names has to be the manifest's.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));

describe('README', () => {
  it('names the manifest version in its version badge', () => {
    expect(readme).toContain(`https://img.shields.io/badge/version-${version}-blue.svg`);
  });

  it('does not ask GitHub for the manifest, which a private repository will not hand out', () => {
    expect(readme).not.toContain('img.shields.io/github/manifest-json');
  });
});
