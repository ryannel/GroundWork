import { formatFiles, Tree } from '@nx/devkit';
import { recordGeneratorProvenance } from '../shared/provenance';
import { applyCapability, loadCapability } from '../shared/capabilities';

export interface AddCapabilityGeneratorSchema {
  service: string;
  capability: string;
  provider?: string;
  stack?: string;
}

/** Locate the service root in the tree. Accepts a bare name (resolved under
 *  services/) or an explicit path. */
function resolveServiceRoot(tree: Tree, service: string): string {
  const candidates = service.includes('/') ? [service] : [`services/${service}`, service];
  for (const c of candidates) {
    if (tree.exists(`${c}/pyproject.toml`) || tree.exists(`${c}/go.mod`) || tree.exists(`${c}/package.json`)) {
      return c;
    }
  }
  throw new Error(
    `Could not find service "${service}" (looked for ${candidates.join(', ')} with a pyproject.toml / go.mod / package.json).`,
  );
}

/** Infer the stack from the marker file present in the service root. */
function detectStack(tree: Tree, serviceRoot: string): string {
  if (tree.exists(`${serviceRoot}/pyproject.toml`)) return 'python';
  if (tree.exists(`${serviceRoot}/go.mod`)) return 'go';
  if (tree.exists(`${serviceRoot}/package.json`)) return 'typescript';
  throw new Error(`Could not detect the stack for ${serviceRoot}.`);
}

export default async function (tree: Tree, options: AddCapabilityGeneratorSchema) {
  const capability = options.capability || 'llm';
  const cap = loadCapability(capability);
  const provider = options.provider || cap.default;
  const serviceRoot = resolveServiceRoot(tree, options.service);
  const stack = options.stack || detectStack(tree, serviceRoot);

  const result = applyCapability(tree, { capability, provider, stack, serviceRoot });

  await formatFiles(tree);
  recordGeneratorProvenance(tree, 'add-capability', options as unknown as Record<string, unknown>);

  // Guidance — the injector writes the port, adapter, contract test, deps and
  // env, but composition-root wiring is service-specific and a compose/runner
  // footprint is workspace-level, so we surface what the engineer must finish.
  console.log(`\nAdded capability "${capability}" (provider: ${provider}, footprint: ${result.footprint}) to ${serviceRoot}`);
  console.log(`  port:          ${result.files.port}`);
  console.log(`  adapter:       ${result.files.adapter}`);
  console.log(`  contract test: ${result.files.contractTest}`);
  if (result.wiring) console.log(`  wiring:        ${result.wiring}`);
  if (provider === 'none') {
    console.log(`  bet:           the contract test is strict-xfail — implement the adapter to cash it.`);
  }
  if (result.footprint === 'compose-service') {
    console.log(
      result.materialized
        ? `  footprint:     injected its container into docker-compose.yml — run \`./dev start\` to boot it.`
        : `  footprint:     needs a docker-compose service, but no docker-compose.yml was found — run workspace-dev-cli first.`,
    );
  } else if (result.footprint === 'runner') {
    console.log(
      result.materialized
        ? `  footprint:     registered as a native runner in .dev/dev.config.json — \`./dev start\` will launch it.`
        : `  footprint:     runs as a process, but no .dev/dev.config.json was found — run workspace-dev-cli first.`,
    );
  }
}
