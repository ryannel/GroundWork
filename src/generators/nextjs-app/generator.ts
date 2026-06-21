import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import { recordGeneratorProvenance } from '../shared/provenance';
import {
  promoteEngineerSkill,
  deployStackDocs,
  ensureOptionalInfra,
  readProjectPrefix,
} from '../shared/scaffold-helpers';

export interface NextjsAppGeneratorSchema {
  name: string;
  auth: 'none' | 'clerk';
  apiProxy: boolean;
  websockets: boolean;
}

const BRAND_TOKENS_PATH = '.groundwork/config/brand-tokens.json';

/** shadcn structural CSS variables with their neutral defaults (light/dark) —
 *  the palette app/globals.css carried before brand projection. The generator
 *  overrides the brand-mappable subset from brand-tokens.json's visual block;
 *  the rest stay these tuned neutrals so component contrast stays safe. */
const SHADCN_VARS: Record<string, { light: string; dark: string }> = {
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
const PALETTE_TO_SHADCN: Record<string, string[]> = {
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

type LD = { light: string; dark: string };

/** CSS colour — hex (3/4/6/8) or OKLCH with optional alpha. */
function validColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v.toLowerCase();
  if (/^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.test(v)) return v;
  return null;
}

/** CSS length: px/rem/em/% or a bare number treated as px. */
function validLen(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const m = String(value).trim().match(/^([\d.]+)\s*(px|rem|em|%)?$/i);
  if (!m || !Number.isFinite(parseFloat(m[1]))) return null;
  return `${m[1]}${(m[2] || 'px').toLowerCase()}`;
}

/** A guarded passthrough for composite CSS values (shadow stacks, gradients,
 *  transforms, easing). Rejects anything that could break out of a declaration
 *  so a malformed token degrades to the neutral default instead of corrupting
 *  the stylesheet. */
function safeCss(value: unknown, maxLen = 240): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > maxLen) return null;
  if (/[;{}@<>]/.test(v) || v.includes('//') || v.includes('/*')) return null;
  return v;
}

/** Compose an elevation layer array into a box-shadow string (x is always 0).
 *  Returns null if any layer is malformed, so the level falls back to neutral. */
function composeShadow(layers: unknown): string | null {
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

const NEUTRAL_BLUR = { subtle: '8px', standard: '12px', heavy: '20px' };
const NEUTRAL_SHADOW: Record<'low' | 'mid' | 'high', LD> = {
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
const NEUTRAL_SURFACE: Record<'glass' | 'elevated' | 'hero', { tint: LD; border: LD }> = {
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
const NEUTRAL_TYPE_ROLES: Record<string, { size: string; line: string; weight: string; tracking: string }> = {
  display: { size: '2.5rem', line: '1.1', weight: '600', tracking: '-0.02em' },
  title: { size: '1.5rem', line: '1.25', weight: '600', tracking: '-0.01em' },
  body: { size: '1rem', line: '1.6', weight: '400', tracking: '0' },
  caption: { size: '0.875rem', line: '1.5', weight: '400', tracking: '0.01em' },
};
const NEUTRAL_MOTION: Record<string, { duration: string; ease: string; transform: string }> = {
  hover: { duration: '150ms', ease: 'cubic-bezier(0, 0, 0.2, 1)', transform: 'translateY(-1px)' },
  press: { duration: '100ms', ease: 'cubic-bezier(0.4, 0, 1, 1)', transform: 'scale(0.97)' },
  enter: { duration: '200ms', ease: 'cubic-bezier(0, 0, 0.2, 1)', transform: 'scale(0.98)' },
  stagger: { duration: '30ms', ease: 'linear', transform: 'none' },
};

interface ResolvedVisual {
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
function resolveVisual(tree: Tree): ResolvedVisual {
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

/** Render app/brand.css from the resolved visual tokens. globals.css imports
 *  this file and owns the structure (token mappings + surface utilities); this
 *  file is pure values and is regenerated, never hand-edited. */
function renderBrandCss(v: ResolvedVisual): string {
  const out: string[] = [];
  out.push('/* GENERATED by the GroundWork nextjs-app generator from');
  out.push(' * .groundwork/config/brand-tokens.json — do not hand-edit this file.');
  out.push(' * Re-run the design system to evolve the brand, then regenerate.');
  out.push(' * app/globals.css imports this file and maps these values into Tailwind');
  out.push(' * token utilities and surface classes; components consume those, never');
  out.push(` * these variables directly. Projection source: ${v.source}. */`);
  out.push('');
  out.push(':root {');
  out.push(`  --radius: ${v.radius};`);
  for (const name of Object.keys(SHADCN_VARS)) {
    out.push(`  --${name}: ${v.shadcn[name].light};`);
  }
  out.push('');
  out.push('  /* Atmosphere — blur radii, elevation stacks, hero gradient. */');
  out.push(`  --gw-blur-subtle: ${v.blur.subtle};`);
  out.push(`  --gw-blur-standard: ${v.blur.standard};`);
  out.push(`  --gw-blur-heavy: ${v.blur.heavy};`);
  out.push(`  --gw-shadow-low: ${v.shadow.low.light};`);
  out.push(`  --gw-shadow-mid: ${v.shadow.mid.light};`);
  out.push(`  --gw-shadow-high: ${v.shadow.high.light};`);
  out.push(`  --gw-gradient-hero: ${v.gradientHero.light};`);
  out.push('');
  out.push('  /* Surface treatments — tint + border per named treatment. */');
  for (const name of ['glass', 'elevated', 'hero'] as const) {
    out.push(`  --gw-surface-${name}-tint: ${v.surfaces[name].tint.light};`);
    out.push(`  --gw-surface-${name}-border: ${v.surfaces[name].border.light};`);
  }
  out.push('');
  out.push('  /* Typography roles — size, line-height, weight, tracking. */');
  for (const [role, r] of Object.entries(v.typeRoles)) {
    out.push(`  --gw-text-${role}-size: ${r.size};`);
    out.push(`  --gw-text-${role}-line: ${r.line};`);
    out.push(`  --gw-text-${role}-weight: ${r.weight};`);
    out.push(`  --gw-text-${role}-tracking: ${r.tracking};`);
  }
  out.push('');
  out.push('  /* Motion interaction profiles — duration, easing, transform. */');
  for (const [ctx, m] of Object.entries(v.motion)) {
    out.push(`  --gw-motion-${ctx}-duration: ${m.duration};`);
    out.push(`  --gw-motion-${ctx}-ease: ${m.ease};`);
    out.push(`  --gw-motion-${ctx}-transform: ${m.transform};`);
  }
  out.push('}');
  out.push('');
  out.push('.dark {');
  for (const name of Object.keys(SHADCN_VARS)) {
    out.push(`  --${name}: ${v.shadcn[name].dark};`);
  }
  out.push('');
  out.push('  /* Atmosphere — dark-theme variants. */');
  out.push(`  --gw-shadow-low: ${v.shadow.low.dark};`);
  out.push(`  --gw-shadow-mid: ${v.shadow.mid.dark};`);
  out.push(`  --gw-shadow-high: ${v.shadow.high.dark};`);
  out.push(`  --gw-gradient-hero: ${v.gradientHero.dark};`);
  for (const name of ['glass', 'elevated', 'hero'] as const) {
    out.push(`  --gw-surface-${name}-tint: ${v.surfaces[name].tint.dark};`);
    out.push(`  --gw-surface-${name}-border: ${v.surfaces[name].border.dark};`);
  }
  out.push('}');
  out.push('');
  return out.join('\n');
}

export default async function (tree: Tree, options: NextjsAppGeneratorSchema) {
  const serviceNames = names(options.name);
  const projectRoot = `services/${serviceNames.fileName}`;

  // Calculate assignedPort from docker-compose.yml (base 4000, sequential)
  let assignedPort = 4000;
  let composeDoc: any = null;
  if (tree.exists('docker-compose.yml')) {
    try {
      const yaml = require('yaml');
      const composeContent = tree.read('docker-compose.yml', 'utf-8');
      composeDoc = yaml.parseDocument(composeContent);

      const usedPorts = new Set<number>();

      // Collect ports from docker-compose.yml
      const servicesMap = composeDoc.get('services');
      if (servicesMap && servicesMap.items) {
        for (const item of servicesMap.items) {
          const service = item.value;
          if (service && service.get) {
            const ports = service.get('ports');
            if (ports && ports.items) {
              for (const pItem of ports.items) {
                const portStr = String(pItem.value || pItem);
                const match = portStr.match(/^(\d+):/);
                if (match) {
                  usedPorts.add(parseInt(match[1], 10));
                }
              }
            }
          }
        }
      }

      // Also collect ports from .env files of natively-run services (not in docker-compose)
      if (tree.exists('services')) {
        for (const svcName of tree.children('services') ?? []) {
          const envPath = `services/${svcName}/.env`;
          if (tree.exists(envPath)) {
            const envContent = tree.read(envPath, 'utf-8') ?? '';
            for (const line of envContent.split('\n')) {
              const m = line.match(/^(?:PORT|SERVER_PORT)=(\d+)/);
              if (m) usedPorts.add(parseInt(m[1], 10));
            }
          }
        }
      }

      while (usedPorts.has(assignedPort)) {
        assignedPort++;
      }
    } catch (e) {
      console.warn('Failed to parse docker-compose.yml for port calculation:', e);
    }
  }

  const templateOptions = {
    ...options,
    ...serviceNames,
    assignedPort,
    tmpl: '' // required by generateFiles
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'nextjs-app', 'files'),
    projectRoot,
    templateOptions
  );

  deployStackDocs(tree, path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'nextjs-app', 'docs'));

  // Nx's generateFiles treats __var__ as template substitution, which
  // conflicts with Next.js dynamic route segments like [...path] and
  // [[...sign-in]]. We use placeholder dir names and rename post-generation.
  const renames: [string, string][] = [
    [`${projectRoot}/app/api/proxy/__path__`, `${projectRoot}/app/api/proxy/[...path]`],
    [`${projectRoot}/app/(auth)/sign-in/__sign-in__`, `${projectRoot}/app/(auth)/sign-in/[[...sign-in]]`],
    [`${projectRoot}/app/(auth)/sign-up/__sign-up__`, `${projectRoot}/app/(auth)/sign-up/[[...sign-up]]`],
  ];

  for (const [oldDir, newDir] of renames) {
    // Find all files under the old directory and move them
    const children = tree.children(oldDir);
    if (children && children.length > 0) {
      for (const child of children) {
        const content = tree.read(`${oldDir}/${child}`);
        if (content) {
          tree.write(`${newDir}/${child}`, content);
          tree.delete(`${oldDir}/${child}`);
        }
      }
    }
  }

  // Project brand-tokens.json's visual block into app/brand.css — the per-app
  // palette + atmosphere layer (elevation, blur, gradients, surface treatments,
  // type-role micro, motion profiles). Parity with electron-app/flutter-app:
  // globals.css imports this file and owns the structure, this file owns the
  // values, and no engineer skill carries a fixed aesthetic catalogue.
  tree.write(
    `${projectRoot}/app/brand.css`,
    renderBrandCss(resolveVisual(tree)),
  );

  // Auto-inject into docker-compose.yml if it exists
  if (composeDoc) {
    try {
      if (!composeDoc.get('services')) {
        // createNode so the result is a YAMLMap with .has/.set (a plain {} is not).
        composeDoc.set('services', composeDoc.createNode({}));
      }
      const servicesMap = composeDoc.get('services');
      if (!servicesMap.has(serviceNames.fileName)) {
        const envVars = [
          `PORT=${assignedPort}`,
          `OTEL_SERVICE_NAME=${serviceNames.fileName}`,
          'OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318',
        ];

        if (options.apiProxy) {
          envVars.push('API_URL=http://core:4000');
        }

        if (options.auth === 'clerk') {
          envVars.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}');
          envVars.push('CLERK_SECRET_KEY=${CLERK_SECRET_KEY}');
        }

        const newService: Record<string, unknown> = {
          build: {
            context: `./${projectRoot}`,
            dockerfile: 'Dockerfile'
          },
          container_name: serviceNames.fileName,
          restart: 'unless-stopped',
          ports: [
            `${assignedPort}:${assignedPort}`
          ],
          environment: envVars,
          // The node:alpine runtime image has no curl, but ships busybox wget,
          // which probes the health route without an extra binary.
          healthcheck: {
            test: [
              'CMD',
              'wget',
              '-q',
              '--spider',
              `http://localhost:${assignedPort}/api/healthz`
            ],
            interval: '10s',
            timeout: '5s',
            retries: 5,
            start_period: '20s'
          },
          networks: [
            'groundwork-net'
          ]
        };

        servicesMap.set(serviceNames.fileName, newService);
        // A Next.js app exports OTLP telemetry but uses no database, so it
        // provisions jaeger only (no longer in the base compose).
        ensureOptionalInfra(composeDoc, servicesMap, {
          usesRedis: false,
          usesPubSub: false,
          usesTelemetry: true,
          projectPrefix: readProjectPrefix(tree),
        });
        tree.write('docker-compose.yml', composeDoc.toString());
      }
    } catch (e) {
      console.warn('Failed to update docker-compose.yml:', e);
    }
  }

  // Conditionally remove auth files
  if (options.auth !== 'clerk') {
    tree.delete(`${projectRoot}/app/(auth)`);
    tree.delete(`${projectRoot}/proxy.ts`);
    tree.delete(`${projectRoot}/components/providers/production.tsx`);
  }

  // Conditionally remove API proxy files
  if (!options.apiProxy) {
    tree.delete(`${projectRoot}/app/api/proxy`);
    tree.delete(`${projectRoot}/lib/api`);
    tree.delete(`${projectRoot}/lib/config.ts`);
  }

  // Conditionally remove websocket files
  if (!options.websockets) {
    tree.delete(`${projectRoot}/app/api/config`);
  }

  promoteEngineerSkill(tree, 'groundwork-nextjs-engineer');

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'nextjs-app', options as unknown as Record<string, unknown>);

  return () => {
    const { execSync } = require('child_process');
    try {
      execSync('pnpm install', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn(`Failed to run pnpm install in ${projectRoot}. Run it manually.`);
    }
  };
}
