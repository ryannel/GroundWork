'use strict';

// Semantic projection of `.groundwork/config/brand-tokens.json` for the design
// sheet — the rendered page the owner opens, looks at, and seals.
//
// This is the SIBLING of `src/generators/shared/brand-tokens.ts`'s
// `resolveVisual()`, not a copy of it. That resolver projects the same token
// file onto shadcn's structural variable names because its consumers are app
// generators. The sheet needs the opposite: the design system's OWN role names,
// because the whole point is that the owner recognises what they approved.
//
// What is genuinely shared is the validation floor — the four guards and the
// neutral fallbacks below are ported verbatim and held in lockstep by
// `sync-anchor.md`. Divergence there is a bug; divergence in the projection
// shape is the design.
//
// The resolver never throws and never returns a partial. A missing file, a
// malformed file, or a single bad token degrades to the neutral starter for
// that slot, so the sheet always renders. A sheet that fails to open teaches
// the owner nothing.

const fs = require('fs');
const path = require('path');

const BRAND_TOKENS_PATH = '.groundwork/config/brand-tokens.json';

// ─── validation floor (sync-anchored to src/generators/shared/brand-tokens.ts) ──

/** Hex (3/4/6/8) or oklch(), with optional alpha. Anything else is not a color. */
function validColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v.toLowerCase();
  if (/^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.test(v)) return v;
  return null;
}

/** CSS length: px/rem/em/% or a bare number treated as px. */
function validLen(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const m = String(value).trim().match(/^([\d.]+)\s*(px|rem|em|%)?$/i);
  if (!m || !Number.isFinite(parseFloat(m[1]))) return null;
  return `${m[1]}${(m[2] || 'px').toLowerCase()}`;
}

/** Guarded passthrough for composite values (easing, transforms, gradients).
 *  Rejects anything that could break out of the declaration it lands in. */
function safeCss(value, maxLen = 240) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > maxLen) return null;
  if (/[;{}@<>]/.test(v) || v.includes('//') || v.includes('/*')) return null;
  return v;
}

/** Compose an elevation layer array into a box-shadow string (x is always 0).
 *  Null if ANY layer is malformed — a half-applied shadow stack is worse than
 *  the neutral one, because it looks deliberate. */
function composeShadow(layers) {
  if (!Array.isArray(layers) || layers.length === 0) return null;
  const parts = [];
  for (const l of layers) {
    const y = validLen(l && l.y);
    const blur = validLen(l && l.blur);
    const color = validColor(l && l.color);
    if (!y || !blur || !color) return null;
    const spread = l && l.spread != null ? validLen(l.spread) : null;
    parts.push(`0 ${y} ${blur}${spread ? ` ${spread}` : ''} ${color}`);
  }
  return parts.join(', ');
}

// ─── neutral starter ───────────────────────────────────────────────────────────

const NEUTRAL_PALETTE = {
  primary: { light: 'oklch(55% 0.16 250)', dark: 'oklch(70% 0.13 250)' },
  surface: { light: 'oklch(99% 0.002 250)', dark: 'oklch(16% 0.006 250)' },
  surfaceAlt: { light: 'oklch(96% 0.004 250)', dark: 'oklch(21% 0.008 250)' },
  textBody: { light: 'oklch(22% 0.01 250)', dark: 'oklch(92% 0.004 250)' },
};
// Per theme, because a shadow is a lighting model rather than a geometry: the
// same black-at-4% stack that reads as depth on white is invisible on a dark
// surface. Held in lockstep with the generator's NEUTRAL_SHADOW.
const NEUTRAL_SHADOW = {
  low: {
    light: '0 1px 2px oklch(0% 0 0 / 0.06)',
    dark: '0 1px 2px oklch(0% 0 0 / 0.3)',
  },
  mid: {
    light: '0 1px 2px oklch(0% 0 0 / 0.06), 0 4px 8px oklch(0% 0 0 / 0.04)',
    dark: '0 1px 2px oklch(0% 0 0 / 0.3), 0 4px 8px oklch(0% 0 0 / 0.25)',
  },
  high: {
    light: '0 1px 2px oklch(0% 0 0 / 0.06), 0 4px 8px oklch(0% 0 0 / 0.04), 0 12px 24px oklch(0% 0 0 / 0.03)',
    dark: '0 1px 2px oklch(0% 0 0 / 0.3), 0 4px 8px oklch(0% 0 0 / 0.25), 0 12px 24px oklch(0% 0 0 / 0.2)',
  },
};

/** Resolve one elevation level into a per-theme pair. Accepts a flat layer array
 *  (one geometry serving both themes) or `{ light: [...], dark: [...] }`.
 *
 *  A flat array used to be the only shape, which made supplying your own
 *  elevation strictly WORSE than supplying none: the neutral is per-theme, and a
 *  flat array overwrote both halves with the light-tuned value, so every custom
 *  token set silently lost its dark elevation. The design sheet is what surfaced
 *  it — the dark elevation card rendered visibly empty.
 *
 *  A partial per-theme object keeps the fallback for the half it omits. */
function resolveElevationLevel(raw, fallback) {
  if (Array.isArray(raw)) {
    const composed = composeShadow(raw);
    return composed ? { light: composed, dark: composed } : null;
  }
  if (raw && typeof raw === 'object') {
    const light = composeShadow(raw.light);
    const dark = composeShadow(raw.dark);
    if (!light && !dark) return null;
    return { light: light || fallback.light, dark: dark || fallback.dark };
  }
  return null;
}
const NEUTRAL_TYPE_ROLES = {
  display: { size: '2.5rem', line: '1.1', weight: '600', tracking: '-0.02em' },
  title: { size: '1.5rem', line: '1.25', weight: '600', tracking: '-0.01em' },
  body: { size: '1rem', line: '1.6', weight: '400', tracking: '0' },
  caption: { size: '0.875rem', line: '1.5', weight: '400', tracking: '0.01em' },
};
const NEUTRAL_MOTION = {
  hover: { duration: '150ms', ease: 'cubic-bezier(0, 0, 0.2, 1)', transform: 'translateY(-1px)' },
  press: { duration: '100ms', ease: 'cubic-bezier(0.4, 0, 1, 1)', transform: 'scale(0.97)' },
  enter: { duration: '200ms', ease: 'cubic-bezier(0, 0, 0.2, 1)', transform: 'scale(0.98)' },
};

function neutral() {
  return {
    appName: '',
    palette: JSON.parse(JSON.stringify(NEUTRAL_PALETTE)),
    typeRoles: JSON.parse(JSON.stringify(NEUTRAL_TYPE_ROLES)),
    fontBody: null,
    fontDisplay: null,
    numeric: null,
    shadow: JSON.parse(JSON.stringify(NEUTRAL_SHADOW)),
    radius: '10px',
    blur: {},
    motion: JSON.parse(JSON.stringify(NEUTRAL_MOTION)),
    easeStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    durationBase: '150ms',
    surfaces: {},
    references: [],
    // Per-slot record of what came from the token file vs the neutral starter.
    // `check` reports this so a sheet built from a half-empty token file is
    // legible as such instead of quietly looking finished.
    fromTokens: {},
    source: 'default',
  };
}

// ─── resolve ───────────────────────────────────────────────────────────────────

/** Read and resolve the token file under `cwd`. Never throws.
 *  `source`: 'visual-block' (a graphical-ui type is active), 'identity-only'
 *  (Tier 1 only — nothing to render a sheet from), 'default' (absent/malformed). */
function resolveVisual(cwd) {
  const out = neutral();
  const file = path.join(cwd || process.cwd(), BRAND_TOKENS_PATH);

  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return out;
  }

  if (raw && raw.identity && typeof raw.identity.appName === 'string') {
    out.appName = raw.identity.appName;
  }

  const v = raw && raw.visual;
  if (!v || typeof v !== 'object') {
    out.source = raw && raw.identity ? 'identity-only' : 'default';
    return out;
  }
  out.source = 'visual-block';

  // palette — the design system's own role names, whatever they are.
  if (v.palette && typeof v.palette === 'object') {
    const palette = {};
    for (const [role, val] of Object.entries(v.palette)) {
      if (!val || typeof val !== 'object') continue;
      const light = validColor(val.light);
      const dark = validColor(val.dark);
      if (light && dark) palette[role] = { light, dark };
    }
    if (Object.keys(palette).length) {
      out.palette = palette;
      out.fromTokens.palette = true;
    }
  }

  // typography
  const typo = v.typography;
  if (typo && typeof typo === 'object') {
    if (typo.roles && typeof typo.roles === 'object') {
      const roles = {};
      for (const [name, r] of Object.entries(typo.roles)) {
        if (!r || typeof r !== 'object') continue;
        const size = validLen(r.size);
        if (!size) continue;
        roles[name] = {
          size,
          line: String(r.lineHeight != null ? r.lineHeight : 1.5),
          weight: String(r.weight != null ? r.weight : 400),
          tracking: safeCss(String(r.tracking != null ? r.tracking : '0'), 24) || '0',
        };
      }
      if (Object.keys(roles).length) {
        out.typeRoles = roles;
        out.fromTokens.typography = true;
      }
    }
    out.fontBody = safeCss(typo.body && typo.body.family, 80);
    out.fontDisplay = safeCss(typo.display && typo.display.family, 80);
    out.numeric = safeCss(typo.numeric, 40);
  }

  // Elevation — the token file's stacks are theme-agnostic arrays.
  //
  // A file with an elevation block REPLACES the neutral set rather than merging
  // into it. Merging would invent levels: a design system that defines only low
  // and mid would sprout a `high` from the starter, and the sheet would show the
  // owner an elevation they never chose. A block that is present but composes to
  // nothing keeps the neutral set, so the sheet still renders.
  if (v.elevation && typeof v.elevation === 'object') {
    const shadow = {};
    for (const [level, layers] of Object.entries(v.elevation)) {
      const pair = resolveElevationLevel(layers, NEUTRAL_SHADOW[level] || NEUTRAL_SHADOW.mid);
      if (pair) shadow[level] = pair;
    }
    if (Object.keys(shadow).length) {
      out.shadow = shadow;
      out.fromTokens.elevation = true;
    }
  }

  if (v.shape) {
    const r = validLen(v.shape.radiusBase);
    if (r) {
      out.radius = r;
      out.fromTokens.shape = true;
    }
  }

  if (v.blur && typeof v.blur === 'object') {
    for (const [name, val] of Object.entries(v.blur)) {
      const len = validLen(val);
      if (len) out.blur[name] = len;
    }
    if (Object.keys(out.blur).length) out.fromTokens.blur = true;
  }

  // motion
  if (v.motion && typeof v.motion === 'object') {
    const ease = safeCss(v.motion.easeStandard, 80);
    if (ease) out.easeStandard = ease;
    if (Number.isFinite(v.motion.durationBaseMs)) out.durationBase = `${v.motion.durationBaseMs}ms`;
    if (v.motion.interactions && typeof v.motion.interactions === 'object') {
      const motion = {};
      for (const [name, m] of Object.entries(v.motion.interactions)) {
        if (!m || typeof m !== 'object') continue;
        motion[name] = {
          duration: Number.isFinite(m.durationMs) ? `${m.durationMs}ms` : out.durationBase,
          ease: safeCss(m.ease, 80) || out.easeStandard,
          transform: safeCss(m.transform, 80) || 'none',
        };
      }
      if (Object.keys(motion).length) out.motion = motion;
    }
    out.fromTokens.motion = true;
  }

  // surface treatments — composed, so only the parts that validate survive.
  if (v.surface && typeof v.surface === 'object') {
    for (const [name, s] of Object.entries(v.surface)) {
      if (!s || typeof s !== 'object') continue;
      const treatment = {};
      const tint = s.tint && typeof s.tint === 'object'
        ? { light: validColor(s.tint.light), dark: validColor(s.tint.dark) }
        : null;
      if (tint && tint.light && tint.dark) treatment.tint = tint;
      const border = s.border && typeof s.border === 'object'
        ? { light: validColor(s.border.light), dark: validColor(s.border.dark) }
        : null;
      if (border && border.light && border.dark) treatment.border = border;
      const b = validLen(s.blur);
      if (b) treatment.blur = b;
      if (typeof s.elevation === 'string') treatment.elevation = s.elevation;
      if (Object.keys(treatment).length) out.surfaces[name] = treatment;
    }
    if (Object.keys(out.surfaces).length) out.fromTokens.surface = true;
  }

  if (Array.isArray(v.references)) {
    out.references = v.references
      .filter((r) => r && typeof r.name === 'string')
      .map((r) => ({ name: r.name, admired: typeof r.admired === 'string' ? r.admired : '' }));
  }

  return out;
}

module.exports = {
  BRAND_TOKENS_PATH,
  resolveVisual,
  resolveElevationLevel,
  validColor,
  validLen,
  safeCss,
  composeShadow,
  NEUTRAL_PALETTE,
  NEUTRAL_SHADOW,
  NEUTRAL_TYPE_ROLES,
  NEUTRAL_MOTION,
};
