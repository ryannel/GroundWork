'use strict';

// `groundwork design` — generate the sheet the owner opens, looks at, and seals.
//
// This replaces a step that used to be an INSTRUCTION: two skill files told the
// agent to hand-author `.groundwork/cache/visual/token-sheet.html` from the token
// file. That produced a different page every run, with no schema and no way to
// fail, which is why it could not be relied on. The sheet is now generated, so it
// is the same every run and a contract test can break it.
//
// Outputs, both under `.groundwork/cache/visual/`:
//   token-sheet.html   the self-contained page — the path both existing skill
//                      call sites already name, so they keep working
//   design-sheet/      one card file each plus `_ds_manifest.json`, in the shape
//                      an optional hosted canvas push consumes unchanged
//   critique.md        seeded once, never overwritten — the owner writes here and
//                      the agent reads it back
//
// Everything is derived from `.groundwork/config/brand-tokens.json`. When that
// file is absent, thin, or has no `visual` block, the sheet still renders from the
// neutral starter and says so at the top — a project with a `cli`-only design
// system has nothing to render and should be told, not handed a blank page.

const fs = require('fs');
const path = require('path');

const { resolveVisual, BRAND_TOKENS_PATH } = require('./resolve');
const { renderTokensCss } = require('./css');
const { foundationCards } = require('./foundations');
const { componentCards, mockupCards, writeBundle } = require('./bundle');
const { renderIndex, renderCritique } = require('./page');

const VISUAL_DIR = path.join('.groundwork', 'cache', 'visual');
const SHEET_FILE = path.join(VISUAL_DIR, 'token-sheet.html');
const BUNDLE_DIR = path.join(VISUAL_DIR, 'design-sheet');
const CRITIQUE_FILE = path.join(VISUAL_DIR, 'critique.md');

function warningFor(visual) {
  if (visual.source === 'default') {
    return `No readable ${BRAND_TOKENS_PATH} — this sheet is the neutral starter, not your design system. Nothing here has been approved by anyone.`;
  }
  if (visual.source === 'identity-only') {
    return `${BRAND_TOKENS_PATH} carries Tier-1 identity but no "visual" block, so there is no graphical design system to render. This sheet is the neutral starter.`;
  }
  const missing = ['palette', 'typography', 'elevation', 'motion'].filter((k) => !visual.fromTokens[k]);
  if (missing.length) {
    return `Rendered from your token file, but ${missing.join(', ')} fell back to the neutral starter — those slots are not yours yet.`;
  }
  return null;
}

/** Build the sheet. Returns a summary the CLI prints. */
function build({ cwd = process.cwd(), slug = null } = {}) {
  const visual = resolveVisual(cwd);
  const tokensCss = renderTokensCss(visual);

  const cards = [
    ...foundationCards(visual),
    ...componentCards(cwd),
    ...mockupCards(cwd, slug),
  ];

  const bundleDir = path.join(cwd, BUNDLE_DIR);
  const manifest = writeBundle(bundleDir, cards, tokensCss);

  const warning = warningFor(visual);
  fs.mkdirSync(path.join(cwd, VISUAL_DIR), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, SHEET_FILE),
    renderIndex(cards, tokensCss, {
      appName: visual.appName,
      warning,
      critiqueRelPath: CRITIQUE_FILE,
    })
  );

  // Seeded once. A rebuild after a token change must not discard notes the owner
  // has already written against the previous build.
  const critiquePath = path.join(cwd, CRITIQUE_FILE);
  let critiqueSeeded = false;
  if (!fs.existsSync(critiquePath)) {
    fs.writeFileSync(critiquePath, renderCritique(cards, { appName: visual.appName }));
    critiqueSeeded = true;
  }

  return {
    source: visual.source,
    warning,
    sheet: SHEET_FILE,
    bundle: BUNDLE_DIR,
    critique: CRITIQUE_FILE,
    critiqueSeeded,
    counts: manifest.reduce((acc, m) => {
      acc[m.group] = (acc[m.group] || 0) + 1;
      return acc;
    }, {}),
    cards: manifest.length,
  };
}

/** Every literal value emitted into tokens.css, paired with its variable. */
function tokenCssValues(tokensCss) {
  const out = [];
  for (const line of tokensCss.split('\n')) {
    const m = line.match(/^\s*--([\w-]+):\s*(.+);\s*$/);
    if (m) out.push({ name: m[1], value: m[2].trim() });
  }
  return out;
}

/** Assert the sheet is a projection, not a painting.
 *
 *  Every colour, length and duration in tokens.css must be traceable to the token
 *  file — either present in it verbatim, or a declared neutral fallback for a slot
 *  the file does not fill. A value that is neither is a literal someone typed, and
 *  that is exactly the drift the sheet exists to prevent. */
function check({ cwd = process.cwd() } = {}) {
  const visual = resolveVisual(cwd);
  const tokensCss = renderTokensCss(visual);
  let rawTokens = '';
  try {
    rawTokens = fs.readFileSync(path.join(cwd, BRAND_TOKENS_PATH), 'utf8');
  } catch {
    rawTokens = '';
  }

  const untraceable = [];
  for (const { name, value } of tokenCssValues(tokensCss)) {
    // Composed values (shadow stacks) are checked by their parts; font stacks and
    // var() indirections carry no literal of their own.
    if (value.startsWith('var(') || value.includes('system-ui')) continue;
    const atoms = value.match(/#[0-9a-fA-F]{3,8}|oklch\([^)]*\)|[\d.]+(?:px|rem|em|ms|%)/g) || [];
    for (const atom of atoms) {
      if (rawTokens.includes(atom)) continue;
      // A bare number in the token file (durationBaseMs: 150) becomes "150ms" here.
      const bare = atom.replace(/(ms|px|rem|em|%)$/, '');
      if (bare !== atom && new RegExp(`[:\\s]${bare}\\b`).test(rawTokens)) continue;
      untraceable.push({ name, value, atom });
    }
  }

  return {
    source: visual.source,
    fromTokens: visual.fromTokens,
    variables: tokenCssValues(tokensCss).length,
    untraceable,
    ok: untraceable.length === 0,
  };
}

module.exports = {
  build,
  check,
  VISUAL_DIR,
  SHEET_FILE,
  BUNDLE_DIR,
  CRITIQUE_FILE,
};
