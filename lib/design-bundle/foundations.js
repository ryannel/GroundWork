'use strict';

// The foundation cards — palette, type, elevation, shape, motion, surfaces.
//
// Every card here is a pure function of the resolved token file, so they cost
// nothing to produce and cannot drift. This is the half of the sheet that needs
// no agent at all: the owner gets it the moment a token file exists.
//
// Each card declares its own `viewport`, because a fixed card height clips the
// type card the moment someone adds a display role — found the hard way in the
// Phase-0 spike. The viewport also travels in `_ds_manifest.json`, which is the
// shape the hosted Design System pane reads.
//
// Cards show the token VALUE next to the rendered result on purpose. The owner
// is being asked to approve a look, but they also need to be able to point at
// the thing they want changed, and role names are what the critique file keys on.

/** Cheap HTML-text escape — card bodies are built from token values, which the
 *  resolver has already validated, but role names come from the file verbatim. */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function paletteCard(v) {
  const roles = Object.entries(v.palette);
  const chips = roles.map(([role, val]) => `
    <div class="sw">
      <div class="chip" style="background:var(--color-${esc(role)})"></div>
      <div class="nm">${esc(role)}</div>
      <div class="val"><span class="lt">${esc(val.light)}</span><span class="dk">${esc(val.dark)}</span></div>
    </div>`).join('');
  return {
    id: 'foundations/palette',
    group: 'Foundations',
    title: 'Semantic palette',
    subtitle: `${roles.length} roles, light and dark`,
    viewport: { width: 520, height: 36 + Math.ceil(roles.length / 4) * 100 },
    body: `<div class="row">${chips}</div>`,
  };
}

function typeCard(v) {
  const roles = Object.entries(v.typeRoles);
  const rows = roles.map(([role, r]) => `
    <div class="tr">
      <div class="tl" style="font-size:var(--type-${esc(role)}-size);line-height:var(--type-${esc(role)}-lh);font-weight:var(--type-${esc(role)}-weight);letter-spacing:var(--type-${esc(role)}-tracking);font-family:${role === 'display' || role === 'title' ? 'var(--font-display)' : 'var(--font-body)'}">Grumpy wizards make toxic brew</div>
      <div class="nm">${esc(role)} · ${esc(r.size)}/${esc(r.line)} · ${esc(r.weight)} · ${esc(r.tracking)}</div>
    </div>`).join('');
  // Real-size type is the whole point, so height is summed from the roles rather
  // than guessed — a display role at 3rem must not be cropped.
  const est = roles.reduce((n, [, r]) => n + Math.max(48, parseFloat(r.size) * (r.size.includes('rem') ? 16 : 1) * parseFloat(r.line) + 30), 0);
  return {
    id: 'foundations/type',
    group: 'Foundations',
    title: 'Type roles',
    subtitle: `${roles.length} roles at real size`,
    viewport: { width: 520, height: Math.round(est) + 40 },
    body: rows,
  };
}

function elevationCard(v) {
  const levels = Object.entries(v.shadow);
  // Chips sit on surfaceAlt because that is what an elevated element actually
  // sits on. A shadow that disappears here disappears in the app too — the sheet
  // is meant to surface that, not flatter the token set.
  const chips = levels.map(([level]) => `
    <div class="el" style="box-shadow:var(--shadow-${esc(level)})">shadow-${esc(level)}</div>`).join('');
  return {
    id: 'foundations/elevation',
    group: 'Foundations',
    title: 'Elevation',
    subtitle: `${levels.length} levels on the raised surface`,
    viewport: { width: 520, height: 118 },
    body: `<div class="row elrow">${chips}</div>`,
  };
}

function shapeCard(v) {
  return {
    id: 'foundations/shape',
    group: 'Foundations',
    title: 'Shape',
    subtitle: `radius ${v.radius}`,
    viewport: { width: 520, height: 104 },
    body: `<div class="row">
      <div class="el" style="border-radius:var(--radius-base)">radius-base</div>
      <div class="el" style="border-radius:calc(var(--radius-base) * 2)">×2 nested</div>
      <div class="el" style="border-radius:999px">pill</div>
    </div>`,
  };
}

function motionCard(v) {
  const names = Object.entries(v.motion);
  // Motion is demonstrated as a looping animation using the token's own easing
  // and duration. It reads as motion in the browser and freezes in a screenshot,
  // which is the honest limit of a static seal — say so rather than imply cover.
  const rows = names.map(([name, m], i) => `
    <div class="mr">
      <div class="track"><div class="dot" style="animation:slide var(--motion-${esc(name)}-duration) var(--motion-${esc(name)}-ease) ${i * 0.12}s infinite alternate"></div></div>
      <div class="nm">${esc(name)} · ${esc(m.duration)} · ${esc(m.ease)}${m.transform !== 'none' ? ` · ${esc(m.transform)}` : ''}</div>
    </div>`).join('');
  return {
    id: 'foundations/motion',
    group: 'Foundations',
    title: 'Motion profiles',
    subtitle: `${names.length} interactions — animated live, frozen in the seal`,
    viewport: { width: 520, height: 52 + names.length * 58 },
    body: rows,
  };
}

function surfaceCard(v) {
  const names = Object.entries(v.surfaces);
  if (!names.length) return null;
  const tiles = names.map(([name, s]) => `
    <div class="surf" style="${s.tint ? `background:var(--surface-${esc(name)}-tint);` : ''}${s.border ? `border:1px solid var(--surface-${esc(name)}-border);` : ''}${s.blur ? `backdrop-filter:blur(var(--surface-${esc(name)}-blur));` : ''}${s.elevation ? `box-shadow:var(--shadow-${esc(s.elevation)});` : ''}">
      <span>${esc(name)}</span>
    </div>`).join('');
  return {
    id: 'foundations/surface',
    group: 'Foundations',
    title: 'Surface treatments',
    subtitle: names.map(([n]) => n).join(' · '),
    viewport: { width: 520, height: 168 },
    body: `<div class="row surfrow">${tiles}</div>`,
  };
}

/** Card-body CSS. Shared by every foundation card and inlined into each one so
 *  the card stands alone — a hosted pane and a `file://` page both need that. */
const CARD_CSS = `
*{box-sizing:border-box}
body{margin:0;padding:18px;font-family:var(--font-body);
  background:var(--color-surface,#fff);color:var(--color-textBody,#111)}
.row{display:flex;gap:12px;flex-wrap:wrap}
.sw{width:108px}
.chip{height:52px;border-radius:var(--radius-base);box-shadow:var(--shadow-low)}
.nm{font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:6px;opacity:.75}
.val{font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.5;margin-top:3px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.val .dk{display:none}
[data-theme="dark"] .val .lt{display:none}
[data-theme="dark"] .val .dk{display:inline}
.tr{margin-bottom:14px}
.tl{font-family:var(--font-body)}
.elrow,.surfrow{padding:6px 0}
.el{padding:18px 14px;border-radius:var(--radius-base);background:var(--color-surfaceAlt,#f4f4f5);
  min-width:112px;text-align:center;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.surf{width:150px;height:96px;border-radius:var(--radius-base);display:flex;align-items:center;
  justify-content:center;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.surfrow{background:linear-gradient(120deg,var(--color-primary),var(--color-accent,var(--color-primary)));
  padding:16px;border-radius:var(--radius-base)}
.mr{margin-bottom:12px}
.track{height:26px;background:var(--color-surfaceAlt,#f4f4f5);border-radius:999px;position:relative;
  overflow:hidden;margin-bottom:4px}
.dot{position:absolute;top:5px;left:5px;width:16px;height:16px;border-radius:999px;
  background:var(--color-primary)}
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(calc(100% + 420px))}}
@media (prefers-reduced-motion:reduce){.dot{animation:none!important}}
`;

/** Build every foundation card for a resolved visual, in reading order. */
function foundationCards(v) {
  return [
    paletteCard(v),
    typeCard(v),
    elevationCard(v),
    shapeCard(v),
    motionCard(v),
    surfaceCard(v),
  ].filter(Boolean);
}

module.exports = { foundationCards, CARD_CSS, esc };
