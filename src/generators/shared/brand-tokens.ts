import { Tree } from '@nx/devkit';

/**
 * Shared brand-token projection.
 *
 * `resolveVisual(tree)` reads `.groundwork/config/brand-tokens.json` and resolves
 * the per-app palette + atmosphere layer into a single `ResolvedVisual` shape that
 * surface generators project onto their own theming model:
 *   - `nextjs-app` → Tailwind-v4/shadcn `app/brand.css` (`renderBrandCss`, kept in
 *     that generator because the variable names + utilities are shadcn-specific).
 *   - `docs-site` → Fumadocs `--fd-*` theme variables (`renderDocsBrandCss`).
 *
 * The resolver itself is theme-system-agnostic: it validates and normalises the
 * token values, falling back to a neutral starter so generation always emits valid
 * CSS even when no brand-tokens.json exists or the file is malformed.
 */

export const BRAND_TOKENS_PATH = '.groundwork/config/brand-tokens.json';

/** shadcn structural CSS variables with their neutral defaults (light/dark) —
 *  the palette app/globals.css carried before brand projection. The generator
 *  overrides the brand-mappable subset from brand-tokens.json's visual block;
 *  the rest stay these tuned neutrals so component contrast stays safe. */
export const SHADCN_VARS: Record<string, { light: string; dark: string }> = {
  background: { light: 'oklch(1 0 0)', dark: 'oklch(0.145 0 0)' },
  foreground: { light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
  card: { light: 'oklch(1 0 0)', dark: 'oklch(0.145 0 0)' },
  'card-foreground': { light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
  popover: { light: 'oklch(1 0 0)', dark: 'oklch(0.145 0 0)' },
  'popover-foreground': { light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
  primary: { light: 'oklch(0.205 0 0)', dark: 'oklch(0.985 0 0)' },
  'primary-foreground': { light: 'oklch(0.985 0 0)', dark: 'oklch(0.205 0 0)' },
  secondary: { light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)' },
  'secondary-foreground': { light: 'oklch(0.205 0 0)', dark: 'oklch(0.985 0 0)' },
  muted: { light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)' },
  'muted-foreground': { light: 'oklch(0.556 0 0)', dark: 'oklch(0.708 0 0)' },
  accent: { light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)' },
  'accent-foreground': { light: 'oklch(0.205 0 0)', dark: 'oklch(0.985 0 0)' },
  destructive: { light: 'oklch(0.577 0.245 27.325)', dark: 'oklch(0.396 0.141 25.723)' },
  success: { light: 'oklch(0.6 0.13 160)', dark: 'oklch(0.7 0.12 160)' },
  warning: { light: 'oklch(0.7 0.14 85)', dark: 'oklch(0.78 0.13 85)' },
  info: { light: 'oklch(0.6 0.14 250)', dark: 'oklch(0.72 0.12 250)' },
  border: { light: 'oklch(0.922 0 0)', dark: 'oklch(0.269 0 0)' },
  input: { light: 'oklch(0.922 0 0)', dark: 'oklch(0.269 0 0)' },
  ring: { light: 'oklch(0.708 0 0)', dark: 'oklch(0.556 0 0)' },
  'chart-1': { light: 'oklch(0.646 0.222 41.116)', dark: 'oklch(0.488 0.243 264.376)' },
  'chart-2': { light: 'oklch(0.6 0.118 184.714)', dark: 'oklch(0.696 0.17 162.48)' },
  'chart-3': { light: 'oklch(0.398 0.07 227.392)', dark: 'oklch(0.769 0.188 70.08)' },
  'chart-4': { light: 'oklch(0.828 0.189 84.429)', dark: 'oklch(0.627 0.265 303.9)' },
  'chart-5': { light: 'oklch(0.769 0.188 70.08)', dark: 'oklch(0.645 0.246 16.439)' },
  sidebar: { light: 'oklch(0.985 0 0)', dark: 'oklch(0.145 0 0)' },
  'sidebar-foreground': { light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
  'sidebar-primary': { light: 'oklch(0.205 0 0)', dark: 'oklch(0.488 0.243 264.376)' },
  'sidebar-primary-foreground': { light: 'oklch(0.985 0 0)', dark: 'oklch(0.985 0 0)' },
  'sidebar-accent': { light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)' },
  'sidebar-accent-foreground': { light: 'oklch(0.205 0 0)', dark: 'oklch(0.985 0 0)' },
  'sidebar-border': { light: 'oklch(0.922 0 0)', dark: 'oklch(0.269 0 0)' },
  'sidebar-ring': { light: 'oklch(0.708 0 0)', dark: 'oklch(0.556 0 0)' },
};

/** Which shadcn vars each visual.palette role drives. Only the contrast-safe
 *  slots are mapped: a surface role onto surfaces, the text role onto
 *  foregrounds, brand hues onto primary/ring/charts. Contrast-sensitive
 *  foregrounds-on-colour keep their tuned neutral defaults. */
export const PALETTE_TO_SHADCN: Record<string, string[]> = {
  surface: ['background', 'card', 'popover', 'sidebar'],
  surfaceAlt: ['secondary', 'muted', 'accent', 'sidebar-accent'],
  textBody: ['foreground', 'card-foreground', 'popover-foreground', 'sidebar-foreground'],
  primary: ['primary', 'ring', 'sidebar-primary', 'sidebar-ring', 'chart-1'],
  accent: ['chart-2'],
  info: ['info', 'chart-3'],
  success: ['success', 'chart-4'],
  warning: ['warning', 'chart-5'],
  error: ['destructive'],
};

export type LD = { light: string; dark: string };

/** CSS colour — hex (3/4/6/8) or OKLCH with optional alpha. */
export function validColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v.toLowerCase();
  if (/^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.test(v)) return v;
  return null;
}

/** CSS length: px/rem/em/% or a bare number treated as px. */
export function validLen(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const m = String(value).trim().match(/^([\d.]+)\s*(px|rem|em|%)?$/i);
  if (!m || !Number.isFinite(parseFloat(m[1]))) return null;
  return `${m[1]}${(m[2] || 'px').toLowerCase()}`;
}

/** A guarded passthrough for composite CSS values (shadow stacks, gradients,
 *  transforms, easing). Rejects anything that could break out of a declaration
 *  so a malformed token degrades to the neutral default instead of corrupting
 *  the stylesheet. */
export function safeCss(value: unknown, maxLen = 240): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > maxLen) return null;
  if (/[;{}@<>]/.test(v) || v.includes('//') || v.includes('/*')) return null;
  return v;
}

/** Compose an elevation layer array into a box-shadow string (x is always 0).
 *  Returns null if any layer is malformed, so the level falls back to neutral. */
export function composeShadow(layers: unknown): string | null {
  if (!Array.isArray(layers) || layers.length === 0) return null;
  const parts: string[] = [];
  for (const l of layers) {
    const y = validLen((l as any)?.y);
    const blur = validLen((l as any)?.blur);
    const color = validColor((l as any)?.color);
    if (!y || !blur || !color) return null;
    const spread = (l as any)?.spread != null ? validLen((l as any).spread) : null;
    parts.push(`0 ${y} ${blur}${spread ? ` ${spread}` : ''} ${color}`);
  }
  return parts.join(', ');
}

export const NEUTRAL_BLUR = { subtle: '8px', standard: '12px', heavy: '20px' };
export const NEUTRAL_SHADOW: Record<'low' | 'mid' | 'high', LD> = {
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
export const NEUTRAL_SURFACE: Record<'glass' | 'elevated' | 'hero', { tint: LD; border: LD }> = {
  glass: {
    tint: { light: 'oklch(98% 0.005 250 / 0.72)', dark: 'oklch(22% 0.01 250 / 0.6)' },
    border: { light: 'oklch(0% 0 0 / 0.08)', dark: 'oklch(100% 0 0 / 0.08)' },
  },
  elevated: {
    tint: { light: 'oklch(98% 0.005 250 / 0.85)', dark: 'oklch(24% 0.01 250 / 0.75)' },
    border: { light: 'oklch(0% 0 0 / 0.1)', dark: 'oklch(100% 0 0 / 0.12)' },
  },
  hero: {
    tint: { light: 'oklch(98% 0.005 250 / 0.65)', dark: 'oklch(20% 0.01 250 / 0.55)' },
    border: { light: 'oklch(0% 0 0 / 0.08)', dark: 'oklch(100% 0 0 / 0.1)' },
  },
};
export const NEUTRAL_TYPE_ROLES: Record<string, { size: string; line: string; weight: string; tracking: string }> = {
  display: { size: '2.5rem', line: '1.1', weight: '600', tracking: '-0.02em' },
  title: { size: '1.5rem', line: '1.25', weight: '600', tracking: '-0.01em' },
  body: { size: '1rem', line: '1.6', weight: '400', tracking: '0' },
  caption: { size: '0.875rem', line: '1.5', weight: '400', tracking: '0.01em' },
};
export const NEUTRAL_MOTION: Record<string, { duration: string; ease: string; transform: string }> = {
  hover: { duration: '150ms', ease: 'cubic-bezier(0, 0, 0.2, 1)', transform: 'translateY(-1px)' },
  press: { duration: '100ms', ease: 'cubic-bezier(0.4, 0, 1, 1)', transform: 'scale(0.97)' },
  enter: { duration: '200ms', ease: 'cubic-bezier(0, 0, 0.2, 1)', transform: 'scale(0.98)' },
  stagger: { duration: '30ms', ease: 'linear', transform: 'none' },
};

export interface ResolvedVisual {
  shadcn: Record<string, LD>;
  radius: string;
  blur: { subtle: string; standard: string; heavy: string };
  shadow: Record<'low' | 'mid' | 'high', LD>;
  gradientHero: LD;
  surfaces: Record<'glass' | 'elevated' | 'hero', { tint: LD; border: LD }>;
  typeRoles: typeof NEUTRAL_TYPE_ROLES;
  motion: typeof NEUTRAL_MOTION;
  source: 'visual-block' | 'identity-only' | 'default';
}

/** Read brand-tokens.json and resolve the per-app palette + atmosphere layer.
 *  Mirrors electron-app/flutter-app token handling: a visual block projects in
 *  full; Tier-1-only seeds the brand hue from identity; absent/malformed tokens
 *  fall back to the neutral starter so generation always emits valid CSS. */
export function resolveVisual(tree: Tree): ResolvedVisual {
  const shadcn: Record<string, LD> = {};
  for (const [k, v] of Object.entries(SHADCN_VARS)) shadcn[k] = { ...v };
  const resolved: ResolvedVisual = {
    shadcn,
    radius: '0.625rem',
    blur: { ...NEUTRAL_BLUR },
    shadow: { low: { ...NEUTRAL_SHADOW.low }, mid: { ...NEUTRAL_SHADOW.mid }, high: { ...NEUTRAL_SHADOW.high } },
    gradientHero: { light: 'none', dark: 'none' },
    surfaces: JSON.parse(JSON.stringify(NEUTRAL_SURFACE)),
    typeRoles: JSON.parse(JSON.stringify(NEUTRAL_TYPE_ROLES)),
    motion: JSON.parse(JSON.stringify(NEUTRAL_MOTION)),
    source: 'default',
  };

  if (!tree.exists(BRAND_TOKENS_PATH)) return resolved;
  let raw: any = null;
  try {
    raw = JSON.parse(tree.read(BRAND_TOKENS_PATH, 'utf-8') || '{}');
  } catch {
    return resolved;
  }

  const visual = raw?.visual;
  if (!visual || typeof visual !== 'object') {
    // Tier-1-only: seed the brand hue from identity onto primary/ring/charts.
    const primary = validColor(raw?.identity?.primary);
    const accent = validColor(raw?.identity?.accent);
    if (primary) {
      for (const v of PALETTE_TO_SHADCN.primary) shadcn[v] = { light: primary, dark: primary };
      resolved.source = 'identity-only';
    }
    if (accent) for (const v of PALETTE_TO_SHADCN.accent) shadcn[v] = { light: accent, dark: accent };
    return resolved;
  }

  resolved.source = 'visual-block';

  // Palette → shadcn structural vars (safe subset).
  for (const [role, targets] of Object.entries(PALETTE_TO_SHADCN)) {
    const entry = visual.palette?.[role];
    const light = validColor(entry?.light);
    const dark = validColor(entry?.dark);
    if (!light && !dark) continue;
    for (const v of targets) {
      shadcn[v] = {
        light: light ?? shadcn[v].light,
        dark: dark ?? shadcn[v].dark,
      };
    }
  }

  // Shape → radius.
  const radius = validLen(visual.shape?.radiusBase);
  if (radius) resolved.radius = radius;

  // Blur levels.
  for (const lvl of ['subtle', 'standard', 'heavy'] as const) {
    const b = validLen(visual.blur?.[lvl]);
    if (b) resolved.blur[lvl] = b;
  }

  // Elevation stacks → box-shadow strings (one geometry serves both themes).
  for (const lvl of ['low', 'mid', 'high'] as const) {
    const composed = composeShadow(visual.elevation?.[lvl]);
    if (composed) resolved.shadow[lvl] = { light: composed, dark: composed };
  }

  // Surface treatments: tint/border per named treatment.
  for (const name of ['glass', 'elevated', 'hero'] as const) {
    const s = visual.surface?.[name];
    if (!s || typeof s !== 'object') continue;
    const tint = validColor(s.tint);
    const border = validColor(s.border);
    if (tint) resolved.surfaces[name].tint = { light: tint, dark: tint };
    if (border) resolved.surfaces[name].border = { light: border, dark: border };
  }

  // Hero gradient: the hero surface names a gradient → resolve from visual.gradients.
  const heroGradientKey = visual.surface?.hero?.gradient;
  if (typeof heroGradientKey === 'string') {
    const g = visual.gradients?.[heroGradientKey];
    if (typeof g === 'string') {
      const v = safeCss(g);
      if (v) resolved.gradientHero = { light: v, dark: v };
    } else if (g && typeof g === 'object') {
      const l = safeCss(g.light);
      const d = safeCss(g.dark);
      if (l || d) resolved.gradientHero = { light: l ?? 'none', dark: d ?? l ?? 'none' };
    }
  }

  // Typography roles.
  for (const role of Object.keys(NEUTRAL_TYPE_ROLES)) {
    const r = visual.typography?.roles?.[role];
    if (!r || typeof r !== 'object') continue;
    const size = validLen(r.size);
    const line = typeof r.lineHeight === 'number' || typeof r.lineHeight === 'string' ? String(r.lineHeight) : null;
    const weight = r.weight != null ? String(Number(r.weight) || resolved.typeRoles[role].weight) : null;
    const tracking = safeCss(r.tracking, 16);
    if (size) resolved.typeRoles[role].size = size;
    if (line && /^[\d.]+$/.test(line)) resolved.typeRoles[role].line = line;
    if (weight) resolved.typeRoles[role].weight = weight;
    if (tracking) resolved.typeRoles[role].tracking = tracking;
  }

  // Motion interaction profiles.
  for (const ctx of Object.keys(NEUTRAL_MOTION)) {
    const m = visual.motion?.interactions?.[ctx];
    if (!m || typeof m !== 'object') continue;
    const duration = Number.isFinite(Number(m.durationMs)) ? `${Number(m.durationMs)}ms` : null;
    const ease = safeCss(m.ease, 48);
    const transform = safeCss(m.transform, 48);
    if (duration) resolved.motion[ctx].duration = duration;
    if (ease) resolved.motion[ctx].ease = ease;
    if (transform) resolved.motion[ctx].transform = transform;
  }

  return resolved;
}
