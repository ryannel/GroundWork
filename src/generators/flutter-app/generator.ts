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
} from '../shared/scaffold-helpers';

export interface FlutterAppGeneratorSchema {
  name: string;
  org?: string;
}

const BRAND_TOKENS_PATH = '.groundwork/config/brand-tokens.json';

/** Palette roles the visual block commits to (templates/brand-tokens.md). */
const PALETTE_ROLES = [
  'primary',
  'accent',
  'surface',
  'surfaceAlt',
  'textBody',
  'success',
  'error',
  'warning',
  'info',
] as const;

/** Neutral defaults used when no visual block (or no tokens at all) exists.
 *  Mirrors how cli-app degrades to a Tier-1 identity: the app still themes
 *  coherently, it just wears a restrained default brand. */
const NEUTRAL_PALETTE: Record<string, { light: string; dark: string }> = {
  primary: { light: '#3b6fd4', dark: '#7da7ef' },
  accent: { light: '#7a5fd4', dark: '#b3a1f0' },
  surface: { light: '#fafafa', dark: '#17181c' },
  surfaceAlt: { light: '#f0f1f4', dark: '#1f2127' },
  textBody: { light: '#26282e', dark: '#e4e6eb' },
  success: { light: '#2f9e6e', dark: '#5fc398' },
  error: { light: '#cf4444', dark: '#ef7f7f' },
  warning: { light: '#c08a1f', dark: '#e0b35f' },
  info: { light: '#3b6fd4', dark: '#7da7ef' },
};

const NEUTRAL_TYPOGRAPHY = {
  display: { family: 'Inter', weight: 600 },
  body: { family: 'Inter', weight: 400 },
};

const NEUTRAL_RADIUS_PX = 8;

/** Convert an OKLCH colour to sRGB hex. The visual block allows palette values
 *  in OKLCH or #rrggbb (templates/brand-tokens.md); Dart's Color needs ARGB, so
 *  the projection resolves OKLCH at generation time rather than shipping a
 *  colour-math dependency into the app. Standard OKLab → linear sRGB → gamma. */
function oklchToHex(l: number, c: number, hDeg: number): string {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];

  const toByte = (x: number): number => {
    const clamped = Math.min(1, Math.max(0, x));
    const srgb =
      clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255);
  };

  return lin
    .map((x) => toByte(x).toString(16).padStart(2, '0'))
    .join('');
}

/** Resolve a CSS colour string (#rgb, #rrggbb, or oklch(...)) to rrggbb hex.
 *  Returns null when the value cannot be resolved, so callers fall back to the
 *  neutral default instead of emitting broken Dart. */
function cssColorToHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();

  const hex6 = v.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) return hex6[1].toLowerCase();

  const hex3 = v.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    return hex3[1]
      .toLowerCase()
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }

  const oklch = v.match(
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i,
  );
  if (oklch) {
    const l = parseFloat(oklch[1]) / (oklch[2] === '%' ? 100 : 1);
    const c = parseFloat(oklch[3]);
    const h = parseFloat(oklch[4]);
    if ([l, c, h].every((n) => Number.isFinite(n))) return oklchToHex(l, c, h);
  }

  return null;
}

/** Dart Color literal from an rrggbb hex string. Tolerates a leading `#`
 *  (the neutral-default palette carries CSS-style values) so no path can
 *  emit a malformed literal like `Color(0xFF#3B6FD4)`. */
function dartColor(hex: string): string {
  return `Color(0xFF${hex.replace(/^#/, '').toUpperCase()})`;
}

/** Parse a radius descriptor like "8px" / "0.5rem" / "12" into logical pixels. */
function radiusToLogicalPx(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return NEUTRAL_RADIUS_PX;
  }
  const m = String(value)
    .trim()
    .match(/^([\d.]+)\s*(px|rem)?$/i);
  if (!m) return NEUTRAL_RADIUS_PX;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return NEUTRAL_RADIUS_PX;
  return (m[2] || 'px').toLowerCase() === 'rem' ? n * 16 : n;
}

interface ResolvedBrand {
  palette: Record<string, { light: string; dark: string }>; // rrggbb hex
  typography: {
    display: { family: string; weight: number };
    body: { family: string; weight: number };
  };
  radiusPx: number;
  source: 'visual-block' | 'identity-only' | 'default';
}

/** Project the design system's brand tokens into theme inputs. Three cases,
 *  mirroring the cli-app's token handling:
 *   - a Tier 2 `visual` block → full projection (palette roles, typography, shape)
 *   - Tier-1-only tokens → palette seeded from identity.primary/accent
 *   - no tokens → the neutral default */
function resolveBrand(tree: Tree): ResolvedBrand {
  const palette: Record<string, { light: string; dark: string }> = {};
  for (const role of PALETTE_ROLES) {
    palette[role] = { ...NEUTRAL_PALETTE[role] };
  }
  const typography = {
    display: { ...NEUTRAL_TYPOGRAPHY.display },
    body: { ...NEUTRAL_TYPOGRAPHY.body },
  };
  let radiusPx = NEUTRAL_RADIUS_PX;
  let source: ResolvedBrand['source'] = 'default';

  if (!tree.exists(BRAND_TOKENS_PATH)) {
    return { palette, typography, radiusPx, source };
  }

  let raw: any = null;
  try {
    raw = JSON.parse(tree.read(BRAND_TOKENS_PATH, 'utf-8') || '{}');
  } catch {
    return { palette, typography, radiusPx, source }; // malformed — neutral
  }

  const visual = raw?.visual;
  if (visual && typeof visual === 'object') {
    source = 'visual-block';
    for (const role of PALETTE_ROLES) {
      const entry = visual.palette?.[role];
      const light = cssColorToHex(entry?.light);
      const dark = cssColorToHex(entry?.dark);
      if (light) palette[role].light = light;
      if (dark) palette[role].dark = dark;
    }
    if (visual.typography?.display?.family) {
      typography.display.family = String(visual.typography.display.family);
      typography.display.weight =
        Number(visual.typography.display.weight) || typography.display.weight;
    }
    if (visual.typography?.body?.family) {
      typography.body.family = String(visual.typography.body.family);
      typography.body.weight =
        Number(visual.typography.body.weight) || typography.body.weight;
    }
    radiusPx = radiusToLogicalPx(visual.shape?.radiusBase);
    return { palette, typography, radiusPx, source };
  }

  // Tier-1-only tokens: derive the brand colours from identity, keep the
  // neutral chrome. This is the mechanical Tier-1 projection the brand-tokens
  // contract requires of every consumer.
  const identity = raw?.identity;
  if (identity && typeof identity === 'object') {
    source = 'identity-only';
    const primary = cssColorToHex(identity.primary);
    const accent = cssColorToHex(identity.accent);
    if (primary) {
      palette.primary = { light: primary, dark: primary };
      palette.info = { light: primary, dark: primary };
    }
    if (accent) palette.accent = { light: accent, dark: accent };
  }

  return { palette, typography, radiusPx, source };
}

/** Render the generated Dart theme module. The palette file is the projection
 *  artifact (regenerate, never hand-edit); app_theme.dart (a static template)
 *  builds ThemeData from it. */
function renderBrandPalette(brand: ResolvedBrand): string {
  const lines: string[] = [];
  lines.push('// GENERATED by the GroundWork flutter-app generator from');
  lines.push(
    '// .groundwork/config/brand-tokens.json — do not hand-edit this file.',
  );
  lines.push('//');
  lines.push(
    '// Re-run the design system to evolve the brand, then regenerate (or update',
  );
  lines.push(
    '// this file to match brand-tokens.json). Widgets never read these constants',
  );
  lines.push(
    '// directly: they consume Theme.of(context), built in app_theme.dart.',
  );
  lines.push(
    '// See docs/principles/stack/flutter/widgets-and-composition.md — theming is',
  );
  lines.push('// a projection, not an authoring surface.');
  lines.push(`// Projection source: ${brand.source}.`);
  lines.push("import 'package:flutter/material.dart';");
  lines.push('');
  lines.push("/// The design system's visual block, projected into Dart.");
  lines.push('abstract final class BrandPalette {');
  lines.push('  // Palette roles — light theme.');
  for (const role of PALETTE_ROLES) {
    lines.push(
      `  static const Color ${role}Light = ${dartColor(brand.palette[role].light)};`,
    );
  }
  lines.push('');
  lines.push('  // Palette roles — dark theme.');
  for (const role of PALETTE_ROLES) {
    lines.push(
      `  static const Color ${role}Dark = ${dartColor(brand.palette[role].dark)};`,
    );
  }
  lines.push('');
  lines.push('  // Typography families (bundle the font assets to take effect).');
  lines.push(
    `  static const String displayFontFamily = '${brand.typography.display.family.replace(/'/g, '')}';`,
  );
  lines.push(
    `  static const int displayFontWeight = ${brand.typography.display.weight};`,
  );
  lines.push(
    `  static const String bodyFontFamily = '${brand.typography.body.family.replace(/'/g, '')}';`,
  );
  lines.push(
    `  static const int bodyFontWeight = ${brand.typography.body.weight};`,
  );
  lines.push('');
  lines.push('  // Shape.');
  lines.push(`  static const double radiusBase = ${brand.radiusPx.toFixed(1)};`);
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

export default async function (tree: Tree, options: FlutterAppGeneratorSchema) {
  const serviceNames = names(options.name);
  const projectRoot = `services/${serviceNames.fileName}`;
  // Dart package names are lower_snake_case; the workspace slug is kebab-case.
  const pubspecName = serviceNames.fileName.replace(/-/g, '_');
  const org = options.org || 'com.example';

  const templateOptions = {
    ...options,
    ...serviceNames,
    pubspecName,
    org,
    tmpl: '', // required by generateFiles
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'flutter-app', 'files'),
    projectRoot,
    templateOptions,
  );

  // Project brand-tokens.json's visual block into the Dart theme module.
  tree.write(
    `${projectRoot}/lib/ui/core/theme/brand_palette.dart`,
    renderBrandPalette(resolveBrand(tree)),
  );

  deployStackDocs(tree, path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'flutter-app', 'docs'));

  // A Flutter app lives on pubspec and the Dart toolchain, not npm, and it has
  // no Docker boot: it joins the Nx workspace through project.json run-commands
  // targets (O7) and is deliberately NOT added to docker-compose.yml or any
  // package.json workspaces list.

  promoteEngineerSkill(tree, 'groundwork-flutter-engineer');

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'flutter-app', options as unknown as Record<string, unknown>);

  return () => {
    const { execSync } = require('child_process');
    try {
      execSync('command -v flutter', { stdio: 'ignore', shell: '/bin/bash' });
    } catch {
      console.warn(
        `flutter SDK not found — generation is complete, but the toolchain tiers are skipped.\n` +
          `Install the Flutter SDK, then run: npx nx run ${serviceNames.fileName}:bootstrap`,
      );
      return;
    }
    try {
      execSync(`bash tool/flutter_exec.sh bootstrap`, {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } catch (e) {
      console.warn(
        `Failed to bootstrap ${projectRoot}. Run 'npx nx run ${serviceNames.fileName}:bootstrap' manually.`,
      );
    }
  };
}
