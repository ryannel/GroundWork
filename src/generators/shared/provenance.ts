import { Tree } from '@nx/devkit';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Generator provenance (upgrade-path plan A2): every generator records what it
// produced — name, package version, resolved options, file hashes — into the
// install manifest. The upgrade path reads this to regenerate with the recorded
// options and reconcile the diff when a generator improves after deploy.
//
// Call AFTER formatFiles, as the generator's last tree operation, so the recorded
// hashes match what lands on disk.

const MANIFEST_PATH = '.groundwork/config/manifest.json';

function packageVersion(): string {
  // Compiled location: <pkg>/dist/src/generators/shared/provenance.js → 4 up.
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf-8'),
    ).version;
  } catch {
    return 'unknown';
  }
}

export function recordGeneratorProvenance(
  tree: Tree,
  generator: string,
  options: Record<string, unknown>,
): void {
  const files: Record<string, string> = {};
  for (const change of tree.listChanges()) {
    if (change.type === 'DELETE' || change.path === MANIFEST_PATH || !change.content) continue;
    files[change.path] = crypto.createHash('sha256').update(change.content).digest('hex');
  }

  let manifest: {
    manifest_version?: number;
    files?: Record<string, unknown>;
    generated?: Record<string, unknown>;
  } = { manifest_version: 1, files: {}, generated: {} };
  if (tree.exists(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(tree.read(MANIFEST_PATH, 'utf-8') || '{}');
    } catch {
      /* corrupt manifest — rebuild the generated section, keep nothing */
    }
  }
  if (!manifest.generated) manifest.generated = {};

  // Key by instance: three go-microservices are three artifacts, not one.
  const name = typeof options.name === 'string' && options.name ? `:${options.name}` : '';
  manifest.generated[`${generator}${name}`] = {
    generator,
    version: packageVersion(),
    options,
    files,
  };
  tree.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}
