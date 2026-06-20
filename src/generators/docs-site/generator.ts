import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import { recordGeneratorProvenance } from '../shared/provenance';
import { registerRunner, readProjectPrefix } from '../shared/scaffold-helpers';

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

  const templateOptions = {
    ...options,
    ...serviceNames,
    assignedPort,
    navTitle,
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
