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

/** A fail-closed pytest stub for a graphical surface with no runnable UI check.
 *  It fails (never skips) so the surface's UI proof is an honest red until a
 *  platform check is implemented per NATIVE-CHECK-CONTRACT.md. Deleting it to go
 *  green is the silent-skip this exists to prevent. */
function uiCheckPlaceholder(s: SurfaceTemplateSpec): string {
  return `import pytest

# AUTO-GENERATED fail-closed placeholder — do not delete to go green.
# Surface "${s.slug}" (test medium "${s.medium}") is a surface GroundWork has no
# UI check runner for. A milestone cannot be proven on a surface nothing checks,
# so this placeholder FAILS until a platform UI check is implemented for it per
# src/generators/system-test-runner/NATIVE-CHECK-CONTRACT.md (render,
# navigation / no dead ends, the named states, design-system token match).


def test_${s.ident}_ui_check_not_implemented():
    pytest.fail(
        "No UI check runner for surface '${s.slug}' (medium '${s.medium}'). "
        "Implement a platform UI check per "
        "system-test-runner/NATIVE-CHECK-CONTRACT.md, then replace this "
        "fail-closed placeholder. A graphical surface must not ship unverified."
    )
`;
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

  // Every test medium GroundWork knows how to run a check for. A graphical
  // surface registered with a medium outside this set has no UI check runner —
  // and a milestone cannot be proven on a surface nothing checks. We refuse to
  // silently leave it unverified: each such surface gets a fail-closed
  // placeholder check (below) naming the gap, never a silent no-op.
  const KNOWN_MEDIA = new Set([
    'playwright',
    'subprocess-cli',
    'protocol-client',
    'flutter-integration',
    'playwright-electron',
  ]);
  const unsupportedSurfaces = (surfaces ?? []).filter((s) => !KNOWN_MEDIA.has(s.medium));

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

  // Playwright structure ships only with a graphical web surface: the
  // page-object package, the axe-core a11y smoke, and the render-smoke gate
  // depend on pytest-playwright, which the pyproject template declares only when
  // includePlaywright is set. Removing the web-specific gates here is correct —
  // they genuinely cannot run without a web surface. What must never happen is a
  // graphical surface left with no check at all; the placeholder below closes
  // that gap fail-closed instead of silently.
  if (!includePlaywright) {
    tree.delete('tests/system/pages');
    tree.delete('tests/system/test_a11y_smoke.py');
    tree.delete('tests/system/test_render_smoke.py');
    tree.delete('tests/system/test_layout_geometry.py');
    tree.delete('tests/system/test_visual_regression.py');
    tree.delete('tests/system/test_token_conformance.py');
  }

  // Fail-closed: a graphical surface whose test medium GroundWork cannot run a
  // check for gets a placeholder that FAILS naming the gap, never a silent skip.
  // The scaffold still generates and its other tests run; this surface's UI
  // proof is an honest red until a platform check is implemented per
  // NATIVE-CHECK-CONTRACT.md — the follow-on that turns it green.
  for (const s of unsupportedSurfaces) {
    tree.write(
      `tests/system/test_${s.ident}_ui_check_missing.py`,
      uiCheckPlaceholder(s)
    );
  }

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'system-test-runner', options as unknown as Record<string, unknown>);
}

export default systemTestRunnerGenerator;
