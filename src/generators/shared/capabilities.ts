import { Tree, generateFiles } from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Composable capability ports & providers (plan WS-F).
 *
 * GroundWork preaches hexagonal architecture: a domain port, swappable adapters
 * at the edge. This module turns that into scaffold mechanics. A *capability*
 * (e.g. `llm`) is a port plus a catalog of *providers*; choosing a provider is
 * choosing an adapter, and each provider declares an operational *footprint* —
 * `env` (just config), `compose-service`, `runner`, or `none` (the raw gateway).
 *
 * The registry is data, not code (src/generators/capabilities/<cap>/...), so
 * adding a provider is a folder, not a generator change. Both the service
 * generators (scaffold time) and the standalone `add-capability` generator
 * (Day 2 / inside a bet) call applyCapability() — one injector, no drift.
 */

export type FootprintKind = 'env' | 'compose-service' | 'runner' | 'none';

export interface EnvVar {
  name: string;
  required?: boolean;
  default?: string;
}

export interface ProviderFootprint {
  kind: FootprintKind;
  summary?: string;
  env?: EnvVar[];
  stacks?: Record<string, { dependencies?: string[] }>;
}

export interface CapabilityStack {
  port: string;
  portSymbol: string;
  adapter: string;
  adapterSymbol: string;
  contractTest: string;
  /** The example env file to record the provider's env footprint in
   *  (`.env.example` for python, `.env` for go). Defaults to `.env.example`. */
  envFile?: string;
  /** When true, the stack's templates need the service's module/import path
   *  (Go: the `module` line in go.mod) substituted as `moduleName`. */
  module?: boolean;
  wiring?: string;
}

export interface Capability {
  id: string;
  title: string;
  description?: string;
  default: string;
  providers: string[];
  stacks: Record<string, CapabilityStack>;
}

/** Repo-root-relative registry dir. Compiled location:
 *  dist/src/generators/shared/capabilities.js → 4 up = package root. */
function capabilitiesRoot(): string {
  return path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'capabilities');
}

export function loadCapability(capability: string): Capability {
  const file = path.join(capabilitiesRoot(), capability, 'capability.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown capability "${capability}" (no ${file}).`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function loadFootprint(capability: string, provider: string): ProviderFootprint {
  const file = path.join(capabilitiesRoot(), capability, 'providers', provider, 'footprint.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown provider "${provider}" for capability "${capability}" (no ${file}).`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/** Add dependency lines to the [project].dependencies array of a pyproject.toml,
 *  skipping any whose package name is already declared. Idempotent. */
function injectPyprojectDeps(tree: Tree, pyprojectPath: string, deps: string[]): void {
  if (!deps.length || !tree.exists(pyprojectPath)) return;
  let content = tree.read(pyprojectPath, 'utf-8') || '';
  // Target the [project].dependencies array — the first `dependencies = [` in the
  // file (optional-dependencies uses `dev = [`, so this match is unambiguous).
  const open = content.indexOf('dependencies = [');
  if (open === -1) return;
  // Scan for the array's matching `]`, tracking bracket depth — a naive
  // indexOf(']') would land inside a spec like "uvicorn[standard]>=0.29.0".
  const arrayStart = content.indexOf('[', open);
  let depth = 0;
  let close = -1;
  for (let i = arrayStart; i < content.length; i++) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return;
  const block = content.slice(open, close);
  const pkgName = (spec: string) => spec.split(/[<>=!~ ]/)[0].trim().toLowerCase();
  const toAdd = deps.filter((d) => !block.toLowerCase().includes(pkgName(d)));
  if (!toAdd.length) return;
  const insertion = toAdd.map((d) => `    "${d}",\n`).join('');
  content = content.slice(0, close) + insertion + content.slice(close);
  tree.write(pyprojectPath, content);
}

/** Add module requires to the first `require ( ... )` block of a go.mod,
 *  skipping any whose module path is already present. Idempotent. */
function injectGoModRequires(tree: Tree, goModPath: string, deps: string[]): void {
  if (!deps.length || !tree.exists(goModPath)) return;
  let content = tree.read(goModPath, 'utf-8') || '';
  const open = content.indexOf('require (');
  if (open === -1) return;
  const close = content.indexOf(')', open);
  if (close === -1) return;
  const block = content.slice(open, close);
  const modPath = (spec: string) => spec.split(/\s+/)[0].trim();
  const toAdd = deps.filter((d) => !block.includes(modPath(d)));
  if (!toAdd.length) return;
  const insertion = toAdd.map((d) => `\t${d}\n`).join('');
  content = content.slice(0, close) + insertion + content.slice(close);
  tree.write(goModPath, content);
}

/** The module/import path of a Go service, read from go.mod's `module` line. */
function readGoModule(tree: Tree, serviceRoot: string): string {
  const goMod = `${serviceRoot}/go.mod`;
  if (!tree.exists(goMod)) return '';
  const m = (tree.read(goMod, 'utf-8') || '').match(/^module\s+(\S+)/m);
  return m ? m[1] : '';
}

/** Append env vars (by name, idempotent) to a service's env-example file. */
function appendEnvExample(
  tree: Tree,
  envPath: string,
  capability: string,
  env: EnvVar[],
): void {
  if (!env.length) return;
  let content = tree.exists(envPath) ? tree.read(envPath, 'utf-8') || '' : '';
  const missing = env.filter((v) => !new RegExp(`^${v.name}=`, 'm').test(content));
  if (!missing.length) return;
  const lines = [`# ${capability} capability`, ...missing.map((v) => `${v.name}=${v.default ?? ''}`)];
  content = content.replace(/\s*$/, '') + '\n' + lines.join('\n') + '\n';
  tree.write(envPath, content);
}

export interface ApplyCapabilityResult {
  capability: string;
  provider: string;
  stack: string;
  footprint: FootprintKind;
  wiring?: string;
  files: { port: string; adapter: string; contractTest: string };
}

/**
 * Materialize a capability+provider into a service: the port, the chosen
 * adapter (or the `none` stub), the contract test, the provider's stack
 * dependencies, and its env footprint. Compose-service / runner footprints are
 * handled by the caller (they need the workspace-level docker-compose / dev
 * config, which this service-scoped injector deliberately does not touch) — this
 * function returns the footprint kind so the caller can wire those.
 *
 * Idempotent: capability-owned files are overwritten with identical content on
 * re-run; deps and env are added only if absent.
 */
export function applyCapability(
  tree: Tree,
  opts: { capability: string; provider: string; stack: string; serviceRoot: string },
): ApplyCapabilityResult {
  const { capability, provider, stack, serviceRoot } = opts;
  const cap = loadCapability(capability);
  const stackSpec = cap.stacks[stack];
  if (!stackSpec) {
    throw new Error(
      `Capability "${capability}" has no support for stack "${stack}" yet (stacks: ${Object.keys(cap.stacks).join(', ')}).`,
    );
  }
  if (!cap.providers.includes(provider)) {
    throw new Error(
      `Unknown provider "${provider}" for capability "${capability}" (providers: ${cap.providers.join(', ')}).`,
    );
  }
  const footprint = loadFootprint(capability, provider);

  const root = capabilitiesRoot();
  // Go templates import the service's module path; resolve it from go.mod.
  const moduleName = stackSpec.module ? readGoModule(tree, serviceRoot) : '';
  const subs = { provider, capability, stack, moduleName, tmpl: '' };

  // Port + contract test (capability-owned, provider-agnostic except the test's
  // `none` branch). generateFiles renders the templated subtree into serviceRoot.
  generateFiles(tree, path.join(root, capability, 'stacks', stack), serviceRoot, subs);
  // Adapter (provider-owned).
  generateFiles(
    tree,
    path.join(root, capability, 'providers', provider, 'stacks', stack),
    serviceRoot,
    subs,
  );

  // Footprint: deps + env are service-local and handled here. compose/runner are
  // workspace-level and left to the caller via the returned footprint kind.
  if (stack === 'python') {
    injectPyprojectDeps(
      tree,
      `${serviceRoot}/pyproject.toml`,
      footprint.stacks?.python?.dependencies ?? [],
    );
  } else if (stack === 'go') {
    injectGoModRequires(tree, `${serviceRoot}/go.mod`, footprint.stacks?.go?.dependencies ?? []);
  }
  appendEnvExample(
    tree,
    `${serviceRoot}/${stackSpec.envFile || '.env.example'}`,
    capability,
    footprint.env ?? [],
  );

  return {
    capability,
    provider,
    stack,
    footprint: footprint.kind,
    wiring: stackSpec.wiring,
    files: {
      port: `${serviceRoot}/${stackSpec.port}`,
      adapter: `${serviceRoot}/${stackSpec.adapter}`,
      contractTest: `${serviceRoot}/${stackSpec.contractTest}`,
    },
  };
}
