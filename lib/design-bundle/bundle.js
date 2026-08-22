'use strict';

// Assemble the bundle: one self-contained HTML file per card plus
// `_ds_manifest.json`.
//
// The layout deliberately matches what a hosted design canvas expects — a
// per-component static HTML file whose FIRST line is a `<!-- @dsCard group="…" -->`
// marker, indexed by a manifest. Adopting that shape costs nothing locally and
// means the optional canvas push is an upload of a directory that already
// exists, with no transformation step to drift.
//
// Card sources, in strict precedence:
//   generated   foundations — pure functions of the token file, rebuilt every run
//   owned       .groundwork/design/previews/<Name>.html — authored once, committed,
//               never overwritten
//   mockups     docs/bets/<slug>/technical-design/mockups/*.html — the page designs
//               that get sealed
//
// Owned previews and mockups are authored as FRAGMENTS, not whole documents. The
// wrapper — doctype, token variables, card CSS — is supplied here, so an author
// cannot accidentally hardcode a colour into a <style> block the tokens do not
// reach. That is the difference between a preview that proves wiring and a
// picture of a component.

const fs = require('fs');
const path = require('path');
const { CARD_CSS, esc } = require('./foundations');

const PREVIEW_DIR = path.join('.groundwork', 'design', 'previews');

/** Wrap a card body into a standalone document. `marker` puts the @dsCard
 *  comment on line 1, which is what the manifest builder and the hosted pane read. */
function cardDocument(card, tokensCss, theme, { marker = true } = {}) {
  const head = marker ? `<!-- @dsCard group="${esc(card.group)}" -->\n` : '';
  return `${head}<!doctype html>
<html lang="en"${theme === 'dark' ? ' data-theme="dark"' : ''}>
<meta charset="utf-8">
<title>${esc(card.title)}</title>
<style>
${tokensCss}${CARD_CSS}</style>
<body>
${card.body}
</body>
</html>
`;
}

/** Read fragment cards out of a directory. Missing directory is not an error —
 *  a project with no component previews yet still gets a foundations sheet. */
function readFragmentCards(dir, { group, idPrefix, viewport }) {
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
  } catch {
    return [];
  }
  return names.map((file) => {
    const name = file.replace(/\.html$/, '');
    return {
      id: `${idPrefix}/${name}`,
      group,
      title: name,
      subtitle: '',
      viewport: { ...viewport },
      body: fs.readFileSync(path.join(dir, file), 'utf8'),
      owned: true,
      sourcePath: path.relative(process.cwd(), path.join(dir, file)),
    };
  });
}

/** Component previews the agent authored once and committed. */
function componentCards(cwd) {
  return readFragmentCards(path.join(cwd, PREVIEW_DIR), {
    group: 'Components',
    idPrefix: 'components',
    viewport: { width: 520, height: 240 },
  });
}

/** Page mockups for one bet, or for every bet when `slug` is absent. */
function mockupCards(cwd, slug) {
  const betsRoot = path.join(cwd, 'docs', 'bets');
  let slugs = [];
  if (slug) {
    slugs = [slug];
  } else {
    try {
      slugs = fs.readdirSync(betsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
        .map((d) => d.name).sort();
    } catch {
      return [];
    }
  }
  const out = [];
  for (const s of slugs) {
    const dir = path.join(betsRoot, s, 'technical-design', 'mockups');
    for (const c of readFragmentCards(dir, {
      group: 'Mockups',
      idPrefix: `mockups/${s}`,
      // Page mockups are pages: seal them at a real screen size, not a card size.
      viewport: { width: 1280, height: 800 },
    })) out.push(c);
  }
  return out;
}

/** Write every card plus the manifest into `outDir`. Returns the manifest. */
function writeBundle(outDir, cards, tokensCss) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'tokens.css'), tokensCss);
  const manifest = [];
  for (const card of cards) {
    const rel = `${card.id.replace(/\//g, '__')}.html`;
    fs.writeFileSync(path.join(outDir, rel), cardDocument(card, tokensCss, 'light'));
    manifest.push({
      id: card.id,
      name: card.title,
      path: rel,
      group: card.group,
      subtitle: card.subtitle || undefined,
      viewport: card.viewport,
      owned: card.owned || undefined,
      source: card.sourcePath || undefined,
    });
  }
  fs.writeFileSync(path.join(outDir, '_ds_manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

module.exports = {
  PREVIEW_DIR,
  cardDocument,
  componentCards,
  mockupCards,
  writeBundle,
};
