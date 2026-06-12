import { formatFiles, generateFiles, Tree } from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';
import { recordGeneratorProvenance } from '../shared/provenance';

export interface WorkspaceDevCliGeneratorSchema {
  appName?: string;
  primaryColor?: string;
  hexColor?: string;
}

const BRAND_TOKENS_PATH = '.groundwork/config/brand-tokens.json';

/** Project the design system's brand tokens (or sensible defaults) into the runtime
 *  config the ./dev bundle reads. Self-discovers brand-tokens.json if the design
 *  system has run; otherwise builds a minimal Tier-1 identity from the options. */
function buildDevConfig(
  tree: Tree,
  projectPrefix: string,
  appName: string,
  hexColor: string,
): Record<string, unknown> {
  if (tree.exists(BRAND_TOKENS_PATH)) {
    try {
      const raw = JSON.parse(tree.read(BRAND_TOKENS_PATH, 'utf-8') || '{}');
      return {
        projectPrefix,
        identity: raw.identity,
        terminal: raw.terminal,
      };
    } catch {
      /* malformed tokens — fall through to defaults */
    }
  }
  return {
    projectPrefix,
    identity: {
      appName,
      wordmark: '◢◤',
      primary: hexColor || '#5fafff',
      accent: '#d7afff',
      voice: 'clear, modern',
    },
  };
}

export default async function (tree: Tree, options: WorkspaceDevCliGeneratorSchema) {
  const projectRoot = '.';
  const appName = options.appName || 'Workspace';
  const projectPrefix = appName.toLowerCase().replace(/\s+/g, '-');

  const templateOptions = {
    ...options,
    appName,
    primaryColor: options.primaryColor || 'BLUE',
    hexColor: options.hexColor || '',
    projectPrefix,
    tmpl: '',
  };

  // docker-compose.yml accretes service registrations from every service
  // generator after this one runs. A re-run of this generator (e.g. to pick
  // up a newer CLI bundle) must never reset the workspace topology to the
  // base infra — preserve the existing file verbatim.
  const existingCompose = tree.exists('docker-compose.yml')
    ? tree.read('docker-compose.yml', 'utf-8')
    : null;

  // EJS-templated files: the launcher, docker-compose, bet stub templates, and the
  // workspace-cli skill. The prebuilt bundle is deliberately NOT among these — EJS
  // would corrupt `<%` sequences inside bundled code.
  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'workspace-dev-cli', 'files'),
    projectRoot,
    templateOptions,
  );

  if (existingCompose !== null) {
    tree.write('docker-compose.yml', existingCompose);
  }

  // Copy the prebuilt CLI bundle verbatim (raw write — never through EJS).
  const bundlePath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'src',
    'generators',
    'workspace-dev-cli',
    'cli-src',
    'dist',
    'dev-bundle.js',
  );
  const bundle = fs.readFileSync(bundlePath, 'utf-8');
  tree.write('.dev/dev-bundle.js', bundle);

  // Project brand tokens into the runtime config the bundle reads.
  const devConfig = buildDevConfig(tree, projectPrefix, appName, templateOptions.hexColor);
  tree.write('.dev/dev.config.json', JSON.stringify(devConfig, null, 2) + '\n');

  // Ensure the launcher is executable (generateFiles preserves the template's mode,
  // but set it explicitly so the bit survives any environment that strips it).
  if (tree.exists('dev')) {
    tree.changePermissions('dev', '755');
  }

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'workspace-dev-cli', {
    appName,
    primaryColor: templateOptions.primaryColor,
    hexColor: templateOptions.hexColor,
  });
}
