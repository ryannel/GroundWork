import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import { recordGeneratorProvenance } from '../shared/provenance';
import { registerRunner, readProjectPrefix } from '../shared/scaffold-helpers';
import {
  BRAND_TOKENS_PATH,
  ResolvedVisual,
  resolveVisual,
  validColor,
} from '../shared/brand-tokens';

export interface DocsSiteGeneratorSchema {
  name: string;
}

/** "magpie-app" → "Magpie App". Used to title the docs nav from the workspace prefix. */
function toTitle(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Brand projection onto Fumadocs (F1, F2)
// ---------------------------------------------------------------------------
//
// The scaffold runs Fumadocs UI v14 with Tailwind v3 (`createPreset()` +
// `fumadocs-ui/style.css`). v14 themes through `--fd-*` CSS variables whose
// values are HSL CHANNEL TRIPLETS in whitespace form (e.g.
// `--fd-background: 0 0% 100%`) — Fumadocs consumes them internally as
// `hsl(var(--fd-...))`. So the projection must convert the brand palette
// (OKLCH or #rrggbb) to an `H S% L%` triplet, not emit a full colour function.

/** Parse `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa` into 0–255 RGB (alpha dropped —
 *  Fumadocs theme channels are opaque). Returns null on anything else. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) {
    h = h.split('').slice(0, 3).map((c) => c + c).join('');
  } else if (h.length === 8) {
    h = h.slice(0, 6);
  } else if (h.length !== 6) {
    return null;
  }
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** OKLCH string → 0–255 sRGB. Implements the OKLab→linear-sRGB→sRGB pipeline
 *  (Björn Ottosson's reference matrices). Handles `oklch(L C H)` with L as a
 *  fraction or percentage; alpha is ignored. Returns null if it cannot parse. */
function oklchToRgb(value: string): { r: number; g: number; b: number } | null {
  const m = value
    .trim()
    .match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)$/i);
  if (!m) return null;
  let L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = parseFloat(m[2]);
  const Hdeg = parseFloat(m[3]);
  if (![L, C, Hdeg].every(Number.isFinite)) return null;
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);

  // OKLab → LMS (cube of the l'/m'/s' terms)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;

  // LMS → linear sRGB
  let lr = +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
  let lg = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
  let lb = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;

  const toSrgb = (c: number) => {
    const x = Math.min(Math.max(c, 0), 1);
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return {
    r: Math.round(toSrgb(lr) * 255),
    g: Math.round(toSrgb(lg) * 255),
    b: Math.round(toSrgb(lb) * 255),
  };
}

/** Any validated brand colour (hex or OKLCH) → an `H S% L%` channel triplet
 *  for a Fumadocs `--fd-*` variable. Returns null when conversion is not
 *  possible, so the caller keeps the stock Fumadocs default for that slot. */
function colorToHslChannels(value: string | null): string | null {
  if (!value) return null;
  const rgb = value.startsWith('#') ? hexToRgb(value) : oklchToRgb(value);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (max + min) / 2;
  let hue = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      default:
        hue = (r - g) / d + 4;
    }
    hue /= 6;
  }
  const H = Math.round(hue * 360);
  const S = Math.round(sat * 100);
  const Lp = Math.round(lum * 100);
  return `${H} ${S}% ${Lp}%`;
}

/** Resolve a palette role's light/dark to HSL channel triplets. */
function paletteChannels(
  v: ResolvedVisual,
  role: string,
): { light: string | null; dark: string | null } {
  // resolveVisual maps palette roles onto shadcn slots; read them back so the
  // docs theme tracks the same projection the app uses (one brand, one palette).
  const SLOT: Record<string, string> = {
    surface: 'background',
    surfaceAlt: 'secondary',
    textBody: 'foreground',
    primary: 'primary',
    border: 'border',
  };
  const slot = SLOT[role];
  const ld = slot ? v.shadcn[slot] : undefined;
  return {
    light: colorToHslChannels(ld?.light ?? null),
    dark: colorToHslChannels(ld?.dark ?? null),
  };
}

interface DocsBrandInputs {
  v: ResolvedVisual;
  displayFamily: string | null;
  bodyFamily: string | null;
  wordmark: string | null;
}

/** Read the brand identity bits the docs site wires beyond the palette: the
 *  display/body font families (Google-font names) and the wordmark glyph. */
function readDocsBrandInputs(tree: Tree, v: ResolvedVisual): DocsBrandInputs {
  let displayFamily: string | null = null;
  let bodyFamily: string | null = null;
  let wordmark: string | null = null;
  if (tree.exists(BRAND_TOKENS_PATH)) {
    try {
      const raw = JSON.parse(tree.read(BRAND_TOKENS_PATH, 'utf-8') || '{}');
      const fam = (x: unknown): string | null =>
        typeof x === 'string' && /^[\w][\w .'-]{0,48}$/.test(x.trim()) ? x.trim() : null;
      displayFamily = fam(raw?.visual?.typography?.display?.family);
      bodyFamily = fam(raw?.visual?.typography?.body?.family);
      const wm = raw?.identity?.wordmark;
      wordmark = typeof wm === 'string' && wm.trim() && wm.trim().length <= 4 ? wm.trim() : null;
    } catch {
      /* fall back to nulls — stock appearance */
    }
  }
  return { v, displayFamily, bodyFamily, wordmark };
}

/** Render app/brand.css for the docs site: map the resolved brand palette onto
 *  Fumadocs v14 `--fd-*` theme variables (HSL channel triplets). Only slots the
 *  palette actually drives are overridden; every other Fumadocs default is left
 *  untouched. The reading measure + h1–h4 scale (F2) ship separately in the
 *  static app/docs.css so they apply even when a slot keeps its Fumadocs default. */
function renderDocsBrandCss(inp: DocsBrandInputs): string {
  const { v } = inp;
  const out: string[] = [];
  out.push('/* GENERATED by the GroundWork docs-site generator from');
  out.push(' * .groundwork/config/brand-tokens.json — do not hand-edit this file.');
  out.push(' * Re-run the design system to evolve the brand, then regenerate.');
  out.push(' * Maps the brand palette onto Fumadocs v14 --fd-* theme variables');
  out.push(' * (HSL channel triplets). The reading measure + scale live in docs.css.');
  out.push(` * Projection source: ${v.source}. */`);
  out.push('');

  const surface = paletteChannels(v, 'surface');
  const surfaceAlt = paletteChannels(v, 'surfaceAlt');
  const text = paletteChannels(v, 'textBody');
  const primary = paletteChannels(v, 'primary');
  const border = paletteChannels(v, 'border');

  // Which --fd-* slot each palette role drives. Foregrounds-on-colour
  // (primary-foreground) keep the Fumadocs default for contrast safety.
  const lightMap: [string, string | null][] = [
    ['--fd-background', surface.light],
    ['--fd-card', surface.light],
    ['--fd-popover', surface.light],
    ['--fd-secondary', surfaceAlt.light],
    ['--fd-muted', surfaceAlt.light],
    ['--fd-accent', surfaceAlt.light],
    ['--fd-foreground', text.light],
    ['--fd-card-foreground', text.light],
    ['--fd-popover-foreground', text.light],
    ['--fd-secondary-foreground', text.light],
    ['--fd-accent-foreground', text.light],
    ['--fd-primary', primary.light],
    ['--fd-ring', primary.light],
    ['--fd-border', border.light],
  ];
  const darkMap: [string, string | null][] = [
    ['--fd-background', surface.dark],
    ['--fd-card', surface.dark],
    ['--fd-popover', surface.dark],
    ['--fd-secondary', surfaceAlt.dark],
    ['--fd-muted', surfaceAlt.dark],
    ['--fd-accent', surfaceAlt.dark],
    ['--fd-foreground', text.dark],
    ['--fd-card-foreground', text.dark],
    ['--fd-popover-foreground', text.dark],
    ['--fd-secondary-foreground', text.dark],
    ['--fd-accent-foreground', text.dark],
    ['--fd-primary', primary.dark],
    ['--fd-ring', primary.dark],
    ['--fd-border', border.dark],
  ];

  const block = (selector: string, entries: [string, string | null][]) => {
    const present = entries.filter(([, val]) => val);
    if (present.length === 0) return;
    out.push(`${selector} {`);
    for (const [name, val] of present) out.push(`  ${name}: ${val};`);
    out.push('}');
    out.push('');
  };

  block(':root', lightMap);
  block('.dark', darkMap);

  return out.join('\n');
}

export default async function (tree: Tree, options: DocsSiteGeneratorSchema) {
  const serviceNames = names(options.name);
  const projectRoot = `services/${serviceNames.fileName}`;

  // The docs site is a NATIVE RUNNER, not a docker-compose service. It compiles
  // the repo-root docs/ tree at build time (source.config.ts reads ../../docs),
  // which only resolves when Next runs from the service directory — that path is
  // outside any per-service Docker build context, so a containerized build can
  // never see the docs. Running it natively (`pnpm dev`) also gives live reload
  // as the delivery loop writes docs. Fixed local port; never joins compose.
  const assignedPort = 4000;

  const prefix = readProjectPrefix(tree);
  const navTitle = prefix && prefix !== 'workspace' ? `${toTitle(prefix)} Docs` : 'Documentation';
  const projectName = prefix && prefix !== 'workspace' ? toTitle(prefix) : 'Project';

  // Resolve the brand projection once. `source` distinguishes a real brand
  // (visual-block / identity-only) from the unbranded fallback (default): when
  // there is no brand-tokens.json the docs site keeps the stock Fumadocs
  // appearance — no brand.css is emitted and layout.tsx imports nothing extra.
  const visual = resolveVisual(tree);
  const brand = readDocsBrandInputs(tree, visual);
  const branded = visual.source !== 'default';

  // The brand body font, when the design system named a Google font family —
  // it sets the whole site's type. Falls back to Inter (the stock default) when
  // absent. (A distinct display/heading font can be wired later from the same
  // tokens; body family is the highest-leverage single choice.)
  const bodyFont = brand.bodyFamily ?? null;

  const templateOptions = {
    ...options,
    ...serviceNames,
    assignedPort,
    navTitle,
    projectName,
    branded,
    bodyFont,
    wordmark: brand.wordmark ?? '',
    tagline: `Reference documentation for ${projectName}.`,
    tmpl: '', // required by generateFiles
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'docs-site', 'files'),
    projectRoot,
    templateOptions
  );

  // Nx's generateFiles treats __var__ as template substitution.
  // Rename the dynamic catch-all route directory to Next's [[...slug]].
  const oldDir = `${projectRoot}/app/docs/__slug__`;
  const newDir = `${projectRoot}/app/docs/[[...slug]]`;
  for (const child of tree.children(oldDir)) {
    const content = tree.read(`${oldDir}/${child}`);
    if (content) {
      tree.write(`${newDir}/${child}`, content);
      tree.delete(`${oldDir}/${child}`);
    }
  }

  // Brand the docs site (WS-F). Project the brand palette onto Fumadocs --fd-*
  // theme variables (app/brand.css); the reading measure + h1–h4 scale ship in
  // the static app/docs.css. app/layout.tsx imports both. Unbranded projects
  // (no brand-tokens.json) skip this entirely and keep today's stock Fumadocs
  // appearance — brand.css is not written and docs.css is dropped.
  if (branded) {
    tree.write(`${projectRoot}/app/brand.css`, renderDocsBrandCss(brand));
  } else {
    // Unbranded fallback: no brand.css, and the typography sheet is dropped so
    // the emitted tree is the stock Fumadocs starter (layout.tsx imports neither).
    tree.delete(`${projectRoot}/app/docs.css`);
  }

  // Seed the sidebar ordering as declarative Fumadocs meta.json (WS-G / E1).
  // This lands in the project's content tree (Tier-2 content seeded into docs/),
  // ordering the canonical doc set and collapsing the large principles tree so
  // it no longer dominates the rail. Retires the betsFirst() JS hack. Only seed
  // it once — never clobber a meta.json the project has since hand-tuned.
  seedDocsMeta(tree);

  // Register with `./dev` as a native runner so start/stop/status/logs manage it
  // like any other surface (electron/flutter/cli do the same). Not autostarted —
  // a docs site is a developer affordance, not part of the boot topology; it is
  // launched on demand (`pnpm dev` in the service dir, or via the runner).
  registerRunner(tree, {
    name: serviceNames.fileName,
    kind: 'surface',
    cmd: 'pnpm dev',
    cwd: projectRoot,
    env: { PORT: String(assignedPort) },
    autostart: false,
  });

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'docs-site', options as unknown as Record<string, unknown>);

  return () => {
    const { execSync } = require('child_process');
    const fs = require('fs');
    try {
      execSync('pnpm install', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      // pnpm 10+ exits non-zero on ERR_PNPM_IGNORED_BUILDS — the build scripts of
      // gated dependencies (esbuild/sharp) are skipped by default — even when the
      // install itself succeeded. Treat a populated node_modules as success (pnpm
      // already printed its own approve-builds notice); only warn if deps are
      // genuinely missing, so we never report a false failure over a good install.
      if (!fs.existsSync(path.join(projectRoot, 'node_modules'))) {
        console.warn(`Failed to run pnpm install in ${projectRoot}. Run it manually.`);
      }
    }
  };
}

/** The canonical top-level doc order for the sidebar (E1). The rail reads as a
 *  product-learning journey: the brief (what the system is) → the design system
 *  (how it looks and behaves) → the nested architecture section (how it is
 *  built) → ways of working → getting started (how to run it) → bets (delivery
 *  work). `...` keeps any doc/folder not named here in its natural position
 *  after the named set, and `principles` is pushed last and collapsed so its
 *  large tree never dominates the rail. Lands at docs/meta.json — Fumadocs
 *  sidebar config, ignored by GitHub and agents, so the docs/ tree stays
 *  effectively content-pristine. */
function seedDocsMeta(tree: Tree): void {
  const metaPath = 'docs/meta.json';
  if (tree.exists(metaPath)) return; // never clobber a project-tuned ordering
  // Fumadocs reads `pages` as the sidebar order. Explicit names come first in
  // the listed order; `...` expands to every remaining page/folder not named;
  // `principles` is named LAST (after `...`) so the large principles tree sinks
  // to the bottom of the rail instead of leading it. `architecture` and
  // `getting-started` are folders here — their own meta.json (below) orders
  // their children.
  const meta = {
    pages: [
      'product-brief',
      'design-system',
      'architecture',
      'ways-of-working',
      'getting-started',
      'bets',
      '...',
      'principles',
    ],
  };
  tree.write(metaPath, JSON.stringify(meta, null, 2) + '\n');

  // Order the nested architecture section: the overview (index, was the flat
  // architecture.md) first, then infrastructure → domain → services → api →
  // decisions, with `...` catching anything else. Seeded only when the folder
  // exists and lacks its own meta — never write a meta.json into an empty folder
  // (Fumadocs renders a content-less folder as a broken nav node and the build
  // trips over it), and never clobber a project's own grouping. The architecture
  // skill seeds this when it first creates the folder, so a fresh scaffold gets
  // the order; this backfills it on regeneration over an older project.
  const architectureMeta = 'docs/architecture/meta.json';
  if (tree.exists('docs/architecture') && !tree.exists(architectureMeta)) {
    tree.write(
      architectureMeta,
      JSON.stringify(
        {
          pages: [
            'index',
            'infrastructure',
            'domain',
            'services',
            'api',
            'decisions',
            '...',
          ],
        },
        null,
        2,
      ) + '\n',
    );
  }

  // Order the getting-started on-ramp: the overview (index) first, then the
  // setup walkthrough and the ./dev command reference. Same folder-must-exist
  // guard as architecture above.
  const gettingStartedMeta = 'docs/getting-started/meta.json';
  if (tree.exists('docs/getting-started') && !tree.exists(gettingStartedMeta)) {
    tree.write(
      gettingStartedMeta,
      JSON.stringify(
        { pages: ['index', 'setup', 'dev-cli-reference', '...'] },
        null,
        2,
      ) + '\n',
    );
  }

  // Order the principles subtree last + collapsed via its own meta.json. Seeded
  // only if absent so a project's own grouping is preserved.
  const principlesMeta = 'docs/principles/meta.json';
  if (!tree.exists(principlesMeta) && tree.exists('docs/principles')) {
    tree.write(
      principlesMeta,
      JSON.stringify({ defaultOpen: false, pages: ['...'] }, null, 2) + '\n',
    );
  }
}
