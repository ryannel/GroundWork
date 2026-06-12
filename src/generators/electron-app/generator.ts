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

export interface ElectronAppGeneratorSchema {
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

/** camelCase palette role → kebab-case CSS custom property suffix. */
function cssRoleName(role: string): string {
  return role.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/** Neutral defaults used when no visual block (or no tokens at all) exists.
 *  Mirrors how cli-app and flutter-app degrade: the app still themes
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

const NEUTRAL_RADIUS = '8px';

/** The renderer is CSS, so colour values pass through verbatim — the browser
 *  resolves OKLCH natively (unlike the Dart projection, which converts at
 *  generation time). Validation still gates what enters the file: a value the
 *  regexes cannot recognise falls back to the neutral default instead of
 *  emitting broken CSS. */
function validCssColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return v.toLowerCase();
  if (/^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:deg)?\s*\)$/i.test(v)) return v;
  return null;
}

/** Validate a radius descriptor like "8px" / "0.5rem" / "12"; bare numbers are
 *  treated as logical pixels. */
function validCssRadius(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const m = String(value)
    .trim()
    .match(/^([\d.]+)\s*(px|rem)?$/i);
  if (!m || !Number.isFinite(parseFloat(m[1]))) return null;
  return `${m[1]}${(m[2] || 'px').toLowerCase()}`;
}

interface ResolvedBrand {
  palette: Record<string, { light: string; dark: string }>; // CSS color values
  typography: {
    display: { family: string; weight: number };
    body: { family: string; weight: number };
  };
  radius: string;
  source: 'visual-block' | 'identity-only' | 'default';
}

/** Project the design system's brand tokens into theme inputs. Three cases,
 *  mirroring the cli-app/flutter-app token handling:
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
  let radius = NEUTRAL_RADIUS;
  let source: ResolvedBrand['source'] = 'default';

  if (!tree.exists(BRAND_TOKENS_PATH)) {
    return { palette, typography, radius, source };
  }

  let raw: any = null;
  try {
    raw = JSON.parse(tree.read(BRAND_TOKENS_PATH, 'utf-8') || '{}');
  } catch {
    return { palette, typography, radius, source }; // malformed — neutral
  }

  const visual = raw?.visual;
  if (visual && typeof visual === 'object') {
    source = 'visual-block';
    for (const role of PALETTE_ROLES) {
      const entry = visual.palette?.[role];
      const light = validCssColor(entry?.light);
      const dark = validCssColor(entry?.dark);
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
    radius = validCssRadius(visual.shape?.radiusBase) ?? NEUTRAL_RADIUS;
    return { palette, typography, radius, source };
  }

  // Tier-1-only tokens: derive the brand colours from identity, keep the
  // neutral chrome. This is the mechanical Tier-1 projection the brand-tokens
  // contract requires of every consumer.
  const identity = raw?.identity;
  if (identity && typeof identity === 'object') {
    source = 'identity-only';
    const primary = validCssColor(identity.primary);
    const accent = validCssColor(identity.accent);
    if (primary) {
      palette.primary = { light: primary, dark: primary };
      palette.info = { light: primary, dark: primary };
    }
    if (accent) palette.accent = { light: accent, dark: accent };
  }

  return { palette, typography, radius, source };
}

/** Render the generated brand stylesheet. The CSS custom properties are the
 *  projection artifact (regenerate, never hand-edit); the static main.css maps
 *  them into Tailwind theme tokens via `@theme inline`, so components consume
 *  utilities, never these variables directly. */
function renderBrandCss(brand: ResolvedBrand): string {
  const lines: string[] = [];
  lines.push('/* GENERATED by the GroundWork electron-app generator from');
  lines.push(
    ' * .groundwork/config/brand-tokens.json — do not hand-edit this file.',
  );
  lines.push(' *');
  lines.push(
    ' * Re-run the design system to evolve the brand, then regenerate (or update',
  );
  lines.push(
    ' * this file to match brand-tokens.json). Components never read these',
  );
  lines.push(
    ' * variables directly: main.css maps them into Tailwind theme tokens, and',
  );
  lines.push(
    ' * components consume the utilities (docs/principles/stack/typescript/frontend.md).',
  );
  lines.push(` * Projection source: ${brand.source}.`);
  lines.push(' */');
  lines.push('');
  lines.push('/* Palette roles — light theme. */');
  lines.push(':root {');
  for (const role of PALETTE_ROLES) {
    lines.push(`  --gw-${cssRoleName(role)}: ${brand.palette[role].light};`);
  }
  lines.push('');
  lines.push('  /* Typography (bundle or system-load the families to take effect). */');
  lines.push(
    `  --gw-font-display: '${brand.typography.display.family.replace(/'/g, '')}';`,
  );
  lines.push(`  --gw-font-display-weight: ${brand.typography.display.weight};`);
  lines.push(
    `  --gw-font-body: '${brand.typography.body.family.replace(/'/g, '')}';`,
  );
  lines.push(`  --gw-font-body-weight: ${brand.typography.body.weight};`);
  lines.push('');
  lines.push('  /* Shape. */');
  lines.push(`  --gw-radius-base: ${brand.radius};`);
  lines.push('}');
  lines.push('');
  lines.push('/* Palette roles — dark theme. The attribute is set from the');
  lines.push(' * nativeTheme broadcast (src/renderer/src/main.tsx). */');
  lines.push(":root[data-theme='dark'] {");
  for (const role of PALETTE_ROLES) {
    lines.push(`  --gw-${cssRoleName(role)}: ${brand.palette[role].dark};`);
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

export default async function (tree: Tree, options: ElectronAppGeneratorSchema) {
  const serviceNames = names(options.name);
  const projectRoot = `services/${serviceNames.fileName}`;
  const org = options.org || 'com.example';
  // Reverse-domain application id (macOS bundle id, Windows AppUserModelID).
  const appId = `${org}.${serviceNames.fileName.replace(/-/g, '')}`;

  const templateOptions = {
    ...options,
    ...serviceNames,
    org,
    appId,
    tmpl: '', // required by generateFiles
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'electron-app', 'files'),
    projectRoot,
    templateOptions,
  );

  // Project brand-tokens.json's visual block into the renderer's CSS custom
  // properties — the same Tailwind path nextjs-app uses, generated instead of
  // hand-authored.
  tree.write(
    `${projectRoot}/src/renderer/src/assets/brand.css`,
    renderBrandCss(resolveBrand(tree)),
  );

  deployStackDocs(tree, path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'electron-app', 'docs'));

  // An Electron app has no Docker boot: it joins the Nx workspace through
  // project.json run-commands targets and is deliberately NOT added to
  // docker-compose.yml or any package.json workspaces list. Its verification
  // tiers are defined by the multi-surface contract: generation (snapshot),
  // compilation (tsc + lint), boot (Playwright _electron under xvfb).

  promoteEngineerSkill(tree, 'groundwork-electron-engineer');

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'electron-app', options as unknown as Record<string, unknown>);

  return () => {
    // Deliberate deviation from the nextjs-app callback (which runs an install
    // immediately): `npm install` here would pull the ~100 MB Electron binary
    // into every scaffold run and every generation-test sandbox. Bootstrap is
    // an explicit, guarded target instead — the same shape flutter-app uses
    // for its SDK-dependent steps.
    console.log(
      `Scaffolded ${projectRoot}. Next steps:\n` +
        `  npx nx run ${serviceNames.fileName}:bootstrap   # npm install (downloads the Electron binary)\n` +
        `  npx nx run ${serviceNames.fileName}:smoke       # build + Playwright _electron boot smoke`,
    );
  };
}
