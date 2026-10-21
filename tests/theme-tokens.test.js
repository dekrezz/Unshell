// The dark theme is a class on <body> that re-declares the colour tokens. A
// custom property whose value refers to another one is resolved where it is
// declared, so a :root alias such as `--label-primary: var(--text-color)`
// keeps the light value inside .dark-theme unless it is declared there too —
// which is how selected Telegram segments and the settings hints came out as
// ink on the dark field.

const fs = require('fs');
const path = require('path');

const css = fs
  .readFileSync(path.join(__dirname, '../extension/styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Innermost rules only: a rule nested in @media is matched on its own.
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selectors: match[1].split(',').map((selector) => selector.trim()),
  declarations: [...match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((decl) => ({
    name: decl[1],
    value: decl[2]
  }))
}));

const declaredOn = (selector) => new Set(
  rules
    .filter((rule) => rule.selectors.includes(selector))
    .flatMap((rule) => rule.declarations.map((decl) => decl.name))
);

describe('theme tokens', () => {
  it('finds the root and dark-theme token blocks', () => {
    expect(declaredOn(':root').has('--text-color')).toBe(true);
    expect(declaredOn('.dark-theme').has('--text-color')).toBe(true);
  });

  it('re-declares on .dark-theme every :root token that refers to a token the dark theme overrides', () => {
    const darkTokens = declaredOn('.dark-theme');
    const stale = rules
      .filter((rule) => rule.selectors.includes(':root'))
      .flatMap((rule) => rule.declarations)
      .filter((decl) => [...decl.value.matchAll(/var\((--[\w-]+)/g)].some((ref) => darkTokens.has(ref[1])))
      .filter((decl) => !darkTokens.has(decl.name))
      .map((decl) => decl.name);
    expect([...new Set(stale)]).toEqual([]);
  });
});
