import {
  formatFiles,
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { recordGeneratorProvenance } from '../shared/provenance';

/** One surface from the registry (`.groundwork/surfaces.json`). The slug is the
 *  join key everywhere — ledger cells, fixture map keys, generated fixture
 *  names. `medium` is the registry's `testMedium`; `reach` is an optional
 *  static base URL (playwright / protocol-client), launch command
 *  (subprocess-cli), or test-harness command (flutter-integration /
 *  playwright-electron) — omitted, URL mediums are discovered at test time
 *  from the docker-compose service named after the slug, and harness mediums
 *  resolve to `npx nx run <slug>:<target>` when services/<slug> exists. */
export interface SurfaceSpec {
  slug: string;
  medium: string;
  reach?: string;
}

export interface SystemTestRunnerGeneratorSchema {
  projectPrefix?: string;
  /** Deprecated single-surface alias — `surfaces` supersedes it. */
  interfaceMedium?: 'graphical-ui' | 'cli' | 'agentic-protocol';
  /** JSON array of SurfaceSpec (string form when invoked from the CLI). */
  surfaces?: string | SurfaceSpec[];
}

/** Parsed spec plus the python-identifier form of the slug, for fixture names. */
interface SurfaceTemplateSpec extends SurfaceSpec {
  ident: string;
}

function parseSurfaces(
  raw: string | SurfaceSpec[] | undefined
): SurfaceTemplateSpec[] | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  let specs: unknown;
  if (typeof raw === 'string') {
    try {
      specs = JSON.parse(raw);
    } catch (e) {
      throw new Error(`--surfaces is not valid JSON: ${(e as Error).message}`);
    }
  } else {
    specs = raw;
  }
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new Error(
      '--surfaces must be a non-empty JSON array of {slug, medium, reach?} objects'
    );
  }
  for (const spec of specs as SurfaceSpec[]) {
    if (
      !spec ||
      typeof spec.slug !== 'string' ||
      spec.slug.length === 0 ||
      typeof spec.medium !== 'string' ||
      spec.medium.length === 0
    ) {
      throw new Error(
        `every --surfaces entry needs a slug and a medium: ${JSON.stringify(spec)}`
      );
    }
  }
  return (specs as SurfaceSpec[]).map((s) => ({
    ...s,
    ident: s.slug.replace(/-/g, '_'),
  }));
}

export async function systemTestRunnerGenerator(
  tree: Tree,
  options: SystemTestRunnerGeneratorSchema
) {
  const projectPrefix = options.projectPrefix || 'groundwork';
  const interfaceMedium = options.interfaceMedium || 'graphical-ui';
  // Registry mode: `surfaces` carries the full set of test mediums and wins
  // over the deprecated single-medium alias when both are given.
  const surfaces = parseSurfaces(options.surfaces);

  const graphicalSurfaces = (surfaces ?? []).filter((s) => s.medium === 'playwright');
  const cliSurfaces = (surfaces ?? []).filter((s) => s.medium === 'subprocess-cli');
  const protocolSurfaces = (surfaces ?? []).filter((s) => s.medium === 'protocol-client');
  // App-harness mediums: the surface ships its own test harness (Flutter
  // integration_test / Playwright _electron smoke); the runner fixture drives
  // it as a subprocess through the app's Nx target.
  const flutterSurfaces = (surfaces ?? []).filter((s) => s.medium === 'flutter-integration');
  const electronSurfaces = (surfaces ?? []).filter((s) => s.medium === 'playwright-electron');

  // Playwright structure follows graphical surfaces: any playwright surface in
  // registry mode, the graphical-ui value in single-medium mode. pexpect ships
  // alongside the subprocess runners so interactive (REPL) CLI flows are testable.
  const includePlaywright = surfaces
    ? graphicalSurfaces.length > 0
    : interfaceMedium === 'graphical-ui';
  const includePexpect = cliSurfaces.length > 0;

  // Generate files into the workspace root
  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'system-test-runner', 'files'),
    '.',
    {
      ...options,
      projectPrefix,
      interfaceMedium,
      surfaces,
      graphicalSurfaces,
      cliSurfaces,
      protocolSurfaces,
      flutterSurfaces,
      electronSurfaces,
      includePlaywright,
      includePexpect,
      tmpl: ''
    }
  );

  // Playwright structure ships only with a graphical surface: the page-object
  // package and the axe-core a11y smoke depend on pytest-playwright, which
  // the pyproject template declares only when includePlaywright is set.
  if (!includePlaywright) {
    tree.delete('tests/system/pages');
    tree.delete('tests/system/test_a11y_smoke.py');
  }

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'system-test-runner', options as unknown as Record<string, unknown>);
}

export default systemTestRunnerGenerator;
