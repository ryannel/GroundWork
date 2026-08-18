'use strict';

// `index.html` — the page the owner opens — and `critique.md`, the file they
// write back into.
//
// Constraints that shaped this, all learned in the Phase-0 spike:
//   - One file, no server, no fetch. Cards are embedded as `<iframe srcdoc>`,
//     which renders correctly from `file://`. A card loaded by src would hit
//     opaque-origin rules the moment anyone opened the page by double-click.
//   - No JavaScript. A theme toggle would need same-origin access into those
//     iframes, which `file://` denies. Rendering light and dark SIDE BY SIDE
//     sidesteps it and is better for critique anyway — the owner compares
//     instead of remembering.
//   - Every card shows its critique id in monospace, because the owner has to be
//     able to key their notes to something the agent can find again without
//     guessing.

const { esc } = require('./foundations');
const { cardDocument } = require('./bundle');

const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;padding:32px 28px 64px;background:#f6f6f7;color:#111;
  font:14px/1.55 system-ui,-apple-system,sans-serif}
header{max-width:1180px;margin:0 auto 26px}
h1{font-size:22px;margin:0 0 6px}
.sub{opacity:.62;font-size:13px;margin:0}
.warn{margin-top:14px;padding:10px 13px;border-radius:8px;background:#fff5d6;
  border:1px solid #e8d38a;font-size:13px}
main{max-width:1180px;margin:0 auto}
h2.grp{font-size:12px;letter-spacing:.09em;text-transform:uppercase;opacity:.5;
  margin:34px 0 12px;border-bottom:1px solid #dededf;padding-bottom:7px}
section{margin-bottom:26px}
.hd{display:flex;align-items:baseline;gap:10px;margin-bottom:9px;flex-wrap:wrap}
.hd h3{font-size:14px;font-weight:600;margin:0}
.hd .st{font-size:12px;opacity:.55}
code{font:11.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:#e9e9ec;
  padding:2px 6px;border-radius:4px;color:#333}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
figure{margin:0;min-width:0}
figcaption{font-size:11px;opacity:.5;margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase}
iframe{width:100%;border:1px solid #dcdce0;border-radius:9px;background:#fff;display:block}
footer{max-width:1180px;margin:44px auto 0;padding-top:18px;border-top:1px solid #dededf;
  font-size:13px;opacity:.7}
@media (max-width:900px){.pair{grid-template-columns:1fr}}
`;

/** Render the whole sheet. `warning` is shown at the top when the token file was
 *  absent or thin, so a neutral-fallback sheet never reads as a finished one. */
function renderIndex(cards, tokensCss, { appName, warning, critiqueRelPath }) {
  const groups = [];
  for (const c of cards) {
    let g = groups.find((x) => x.name === c.group);
    if (!g) groups.push((g = { name: c.group, cards: [] }));
    g.cards.push(c);
  }

  const frame = (card, theme) => {
    const doc = cardDocument(card, tokensCss, theme, { marker: false });
    return `<iframe title="${esc(card.title)} (${theme})" height="${card.viewport.height}" srcdoc="${esc(doc)}"></iframe>`;
  };

  const body = groups.map((g) => `
  <h2 class="grp">${esc(g.name)}</h2>
  ${g.cards.map((c) => `
  <section>
    <div class="hd">
      <h3>${esc(c.title)}</h3>
      ${c.subtitle ? `<span class="st">${esc(c.subtitle)}</span>` : ''}
      <code>${esc(c.id)}</code>
    </div>
    <div class="pair">
      <figure><figcaption>light</figcaption>${frame(c, 'light')}</figure>
      <figure><figcaption>dark</figcaption>${frame(c, 'dark')}</figure>
    </div>
  </section>`).join('')}`).join('');

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(appName || 'Design sheet')} — design sheet</title>
<style>${PAGE_CSS}</style>
<header>
  <h1>${esc(appName || 'Design sheet')}</h1>
  <p class="sub">Rendered from <code>.groundwork/config/brand-tokens.json</code> and the repo's own components. Every value on this page is a projection of that file — nothing here was drawn by hand.</p>
  ${warning ? `<div class="warn">${esc(warning)}</div>` : ''}
</header>
<main>${body}</main>
<footer>
  To critique: write under the matching heading in <code>${esc(critiqueRelPath)}</code>, using the id shown beside each card. Rebuild with <code>groundwork design build</code> after any token change.
</footer>
</html>
`;
}

/** Seed the critique file — one heading per card, in the page's own order.
 *  Never overwrites: a rebuild must not eat notes the owner already wrote. */
function renderCritique(cards, { appName }) {
  return [
    `# Design critique — ${appName || 'this product'}`,
    '',
    'Write under the heading for the card you are talking about. Keep the headings;',
    'the agent reads this file and matches your notes to cards by id.',
    '',
    ...cards.map((c) => `## ${c.id}\n\n- \n`),
  ].join('\n');
}

module.exports = { renderIndex, renderCritique, PAGE_CSS };
