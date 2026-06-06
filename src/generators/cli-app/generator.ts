import { formatFiles, generateFiles, Tree } from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';

export interface CliAppGeneratorSchema {
  name: string;
  repl?: boolean;
}

const BRAND_TOKENS_PATH = '.groundwork/config/brand-tokens.json';

/** The shared CLI render layer lives with the ./dev CLI source and is the single
 *  source of truth. The product gets an owned copy so it can evolve independently. */
const THEME_SRC = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'src',
  'generators',
  'workspace-dev-cli',
  'cli-src',
  'src',
);

function kebab(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Project the design system's brand tokens (identity + terminal) for the product, or
 *  a minimal Tier-1 identity derived from the name when no tokens exist. */
function buildBrand(tree: Tree, name: string): Record<string, unknown> {
  if (tree.exists(BRAND_TOKENS_PATH)) {
    try {
      const raw = JSON.parse(tree.read(BRAND_TOKENS_PATH, 'utf-8') || '{}');
      return { identity: raw.identity, terminal: raw.terminal };
    } catch {
      /* malformed — fall through */
    }
  }
  return {
    identity: { appName: name, wordmark: '◢◤', primary: '#5fafff', accent: '#d7afff', voice: 'clear, modern' },
  };
}

function copyShared(tree: Tree, fromRel: string, toRel: string): void {
  const content = fs.readFileSync(path.join(THEME_SRC, fromRel), 'utf-8');
  tree.write(toRel, content);
}

export default async function (tree: Tree, options: CliAppGeneratorSchema) {
  const name = options.name;
  const binName = kebab(name) || 'cli';
  const repl = Boolean(options.repl);
  const projectRoot = path.join('services', binName);

  const filesDir = path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'cli-app', 'files');
  generateFiles(tree, filesDir, projectRoot, {
    name,
    binName,
    repl,
    tmpl: '',
  });

  // Copy the shared render layer as owned product source.
  copyShared(tree, 'theme/tokens.ts', path.join(projectRoot, 'src/theme/tokens.ts'));
  copyShared(tree, 'theme/color.ts', path.join(projectRoot, 'src/theme/color.ts'));
  copyShared(tree, 'theme/render.ts', path.join(projectRoot, 'src/theme/render.ts'));

  // Project brand tokens into the product (baked into the build via import).
  tree.write(path.join(projectRoot, 'src/brand.json'), JSON.stringify(buildBrand(tree, name), null, 2) + '\n');

  // Interactive layer: reuse the same prompt utilities the ./dev wizard uses.
  if (repl) {
    copyShared(tree, 'util/prompt.ts', path.join(projectRoot, 'src/util/prompt.ts'));
    tree.write(
      path.join(projectRoot, 'src/commands/repl.ts'),
      `import type { Ctx } from '../registry';
import { isInteractive, textPrompt } from '../util/prompt';

/** A minimal interactive session on top of the composable spine. Extend it into a
 *  full REPL — slash commands, streaming, autocomplete — per your design system. */
export async function repl(ctx: Ctx): Promise<number> {
  if (!isInteractive()) {
    ctx.r.error('repl requires an interactive terminal.');
    return 2;
  }
  ctx.r.logo('interactive session');
  ctx.r.info("Type a name to greet, or 'exit' to quit.");
  for (;;) {
    const line = await textPrompt(ctx.r.painter, '>');
    if (line === 'exit' || line === 'quit') break;
    if (line) ctx.r.success(\`Hello, \${line}!\`);
  }
  return 0;
}
`,
    );
  }

  await formatFiles(tree);
}
