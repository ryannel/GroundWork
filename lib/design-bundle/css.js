'use strict';

// Resolved tokens → `tokens.css`. This file is the reason the sheet cannot lie.
//
// Every value here is a projection of `.groundwork/config/brand-tokens.json`.
// Nothing is authored, nothing is rounded, nothing is "close enough". That is
// what makes the propagation test meaningful: change one token, rebuild, and
// exactly one variable moves. A sheet with a hand-written value in it would
// still look right and would no longer prove anything.
//
// Theme model: `:root` carries light, `[data-theme="dark"]` overrides only the
// values that differ. Per-theme are palette, surface treatments AND elevation —
// elevation because a shadow is a lighting model, so a stack tuned for a white
// surface disappears on a dark one. Type, shape, blur and motion are genuinely
// theme-agnostic in this token model and are emitted once.

const { resolveVisual } = require('./resolve');

/** Palette + surface tints for one theme. */
function themeVars(v, mode) {
  const lines = [];
  for (const [role, val] of Object.entries(v.palette)) {
    lines.push(`  --color-${role}: ${val[mode]};`);
  }
  for (const [name, s] of Object.entries(v.surfaces)) {
    if (s.tint) lines.push(`  --surface-${name}-tint: ${s.tint[mode]};`);
    if (s.border) lines.push(`  --surface-${name}-border: ${s.border[mode]};`);
  }
  for (const [level, pair] of Object.entries(v.shadow)) {
    lines.push(`  --shadow-${level}: ${pair[mode]};`);
  }
  return lines;
}

/** Everything that does not vary by theme. */
function staticVars(v) {
  const lines = [];
  for (const [role, r] of Object.entries(v.typeRoles)) {
    lines.push(`  --type-${role}-size: ${r.size};`);
    lines.push(`  --type-${role}-lh: ${r.line};`);
    lines.push(`  --type-${role}-weight: ${r.weight};`);
    lines.push(`  --type-${role}-tracking: ${r.tracking};`);
  }
  lines.push(`  --radius-base: ${v.radius};`);
  for (const [name, len] of Object.entries(v.blur)) {
    lines.push(`  --blur-${name}: ${len};`);
  }
  lines.push(`  --ease-standard: ${v.easeStandard};`);
  lines.push(`  --duration-base: ${v.durationBase};`);
  for (const [name, m] of Object.entries(v.motion)) {
    lines.push(`  --motion-${name}-duration: ${m.duration};`);
    lines.push(`  --motion-${name}-ease: ${m.ease};`);
    lines.push(`  --motion-${name}-transform: ${m.transform};`);
  }
  for (const [name, s] of Object.entries(v.surfaces)) {
    if (s.blur) lines.push(`  --surface-${name}-blur: ${s.blur};`);
  }
  const stack = (family) => `${family}, system-ui, -apple-system, sans-serif`;
  lines.push(`  --font-body: ${v.fontBody ? stack(v.fontBody) : 'system-ui, -apple-system, sans-serif'};`);
  lines.push(`  --font-display: ${v.fontDisplay ? stack(v.fontDisplay) : 'var(--font-body)'};`);
  if (v.numeric) lines.push(`  --numeric: ${v.numeric};`);
  return lines;
}

/** Render `tokens.css` from a resolved visual. */
function renderTokensCss(v) {
  const root = [...staticVars(v), ...themeVars(v, 'light')];
  const dark = themeVars(v, 'dark');
  return [
    '/* Generated from .groundwork/config/brand-tokens.json by `groundwork design`.',
    '   Do not edit. Edit the token file and rebuild. */',
    ':root {',
    ...root,
    '}',
    '',
    '[data-theme="dark"] {',
    ...dark,
    '}',
    '',
  ].join('\n');
}

/** Convenience: resolve `cwd` and render in one step. */
function tokensCssFor(cwd) {
  return renderTokensCss(resolveVisual(cwd));
}

module.exports = { renderTokensCss, tokensCssFor, themeVars, staticVars };
