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
  ensureOptionalInfra,
  readProjectPrefix,
  registerRunner,
} from '../shared/scaffold-helpers';
import { applyCapability } from '../shared/capabilities';

export interface PythonMicroserviceGeneratorSchema {
  name: string;
  rest: boolean;
  postgres: boolean;
  messaging: 'none' | 'redis' | 'kafka' | 'gcp-pubsub';
  websockets: boolean;
  runpod: boolean;
  llm: boolean;
  llmProvider: 'openai' | 'anthropic' | 'local' | 'none';
  native?: boolean;
}

export default async function (tree: Tree, options: PythonMicroserviceGeneratorSchema) {
  const serviceNames = names(options.name);
  const projectRoot = `services/${serviceNames.fileName}`;
  // src-layout: the importable package is `src/<packageName>` (PEP src-layout),
  // so the package name is the service name in snake_case (a valid Python
  // identifier). It names the `src/__packageName__/` template dir, every
  // `from <pkg>.…` import, the hatch wheel package, and the import-linter root.
  // Derive it from the kebab fileName (hyphens → underscores), NOT constantName:
  // nx's constantName collapses single-char segments (`a-b1` → `AB1`), which would
  // make the package name diverge from the intuitive `a_b1` a developer expects.
  const packageName = serviceNames.fileName.replace(/-/g, '_');

  let assignedPort = 8000;
  let composeDoc: any = null;
  if (tree.exists('docker-compose.yml')) {
    try {
      const yaml = require('yaml');
      const composeContent = tree.read('docker-compose.yml', 'utf-8');
      composeDoc = yaml.parseDocument(composeContent);

      const usedPorts = new Set<number>();

      // Collect ports from docker-compose.yml
      const servicesMap = composeDoc.get('services');
      if (servicesMap && servicesMap.items) {
        for (const item of servicesMap.items) {
          const service = item.value;
          if (service && service.get) {
            const ports = service.get('ports');
            if (ports && ports.items) {
              for (const pItem of ports.items) {
                const portStr = String(pItem.value || pItem);
                const match = portStr.match(/^(\d+):/);
                if (match) {
                  usedPorts.add(parseInt(match[1], 10));
                }
              }
            }
          }
        }
      }

      // Also collect ports from .env files of natively-run services (not in docker-compose)
      if (tree.exists('services')) {
        for (const svcName of tree.children('services') ?? []) {
          const envPath = `services/${svcName}/.env`;
          if (tree.exists(envPath)) {
            const envContent = tree.read(envPath, 'utf-8') ?? '';
            for (const line of envContent.split('\n')) {
              const m = line.match(/^(?:PORT|SERVER_PORT)=(\d+)/);
              if (m) usedPorts.add(parseInt(m[1], 10));
            }
          }
        }
      }

      while (usedPorts.has(assignedPort)) {
        assignedPort++;
      }
    } catch (e) {
      console.warn('Failed to parse docker-compose.yml for port calculation:', e);
    }
  }

  // Default the provider so programmatic callers (e.g. tests) that omit it get
  // today's OpenAI behaviour unchanged. Only consumed inside `--llm` templates.
  const llmProvider = options.llmProvider ?? 'openai';

  const templateOptions = {
    ...options,
    ...serviceNames,
    packageName,
    assignedPort,
    llmProvider,
    tmpl: '' // required by generateFiles
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'python-microservice', 'files'),
    projectRoot,
    templateOptions
  );

  deployStackDocs(tree, path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'python-microservice', 'docs'));

  // Auto-inject into docker-compose.yml if it exists
  if (composeDoc) {
    try {
      if (!composeDoc.get('services')) {
        // createNode so the result is a YAMLMap with .has/.set (a plain {} is not).
        composeDoc.set('services', composeDoc.createNode({}));
      }
      const servicesMap = composeDoc.get('services');
      // Only wire the infrastructure this service actually uses. Redis is needed
      // for the WebSocket backplane or Redis pub/sub; the Pub/Sub emulator only
      // for GCP Pub/Sub messaging. A plain --rest --postgres --llm service
      // provisions neither.
      const usesRedis = options.websockets || options.messaging === 'redis';
      const usesPubSub = options.messaging === 'gcp-pubsub';
      if (!options.native && !servicesMap.has(serviceNames.fileName)) {
        const environment: string[] = [`SERVER_PORT=${assignedPort}`];
        if (options.postgres) {
          environment.push(
            'DB_HOST=db',
            'DB_PORT=5432',
            'DB_USER=${DB_USER:-postgres}',
            'DB_PASSWORD=${DB_PASSWORD:-postgres}',
            `DB_NAME=\${DB_NAME:-${serviceNames.fileName}}`
          );
        }
        if (usesRedis) {
          environment.push('REDIS_URL=redis:6379');
        }
        if (usesPubSub) {
          environment.push('PUBSUB_EMULATOR_HOST=pubsub:${PUBSUB_PORT:-8085}');
        }
        environment.push(
          'OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317',
          'OTEL_EXPORTER_OTLP_PROTOCOL=grpc'
        );

        const dependsOn: Record<string, { condition: string }> = {};
        if (options.postgres) {
          dependsOn.db = { condition: 'service_healthy' };
        }
        if (usesRedis) {
          dependsOn.redis = { condition: 'service_healthy' };
        }

        const newService: Record<string, unknown> = {
          build: {
            context: `./${projectRoot}`,
            dockerfile: 'Dockerfile'
          },
          container_name: serviceNames.fileName,
          restart: 'unless-stopped',
          ports: [
            `${assignedPort}:${assignedPort}`
          ],
          environment
        };
        // Only the REST entrypoint serves /healthz; the runpod worker image
        // runs a background worker with no HTTP server, so it gets no probe.
        if (options.rest && !options.runpod) {
          // The python:slim runtime image has no curl, so probe the health
          // endpoint with the interpreter that is guaranteed to be present.
          newService.healthcheck = {
            test: [
              'CMD-SHELL',
              `python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:${assignedPort}/healthz').status==200 else 1)"`
            ],
            interval: '10s',
            timeout: '5s',
            retries: 5,
            start_period: '20s'
          };
        }
        if (Object.keys(dependsOn).length > 0) {
          newService.depends_on = dependsOn;
        }
        newService.networks = ['groundwork-net'];

        servicesMap.set(serviceNames.fileName, newService);
        // db only when this service uses Postgres; jaeger always for a
        // containerized service (it exports OTLP). Neither is in the base compose.
        ensureOptionalInfra(composeDoc, servicesMap, {
          usesRedis,
          usesPubSub,
          usesDb: !!options.postgres,
          usesTelemetry: true,
          projectPrefix: readProjectPrefix(tree),
        });
        tree.write('docker-compose.yml', composeDoc.toString());
      } else if (options.native && (options.postgres || usesRedis || usesPubSub)) {
        // Native sidecar: no app container in compose, but provision the backing
        // infra it connects to. A host process gets no forced tracing backend —
        // telemetry is wired only if the project explicitly runs jaeger.
        ensureOptionalInfra(composeDoc, servicesMap, {
          usesRedis,
          usesPubSub,
          usesDb: !!options.postgres,
          usesTelemetry: false,
          projectPrefix: readProjectPrefix(tree),
        });
        tree.write('docker-compose.yml', composeDoc.toString());
      }
    } catch (e) {
      console.warn('Failed to update docker-compose.yml:', e);
    }
  }

  // Native mode: the service runs as a host process (e.g. it needs Metal/MPS that
  // Docker on macOS can't provide), so register it as a sidecar runner instead of
  // a compose service. `./dev start` launches it via `uv run`.
  if (options.native) {
    registerRunner(tree, {
      name: serviceNames.fileName,
      kind: 'sidecar',
      cmd: `uv run python -m ${packageName}.main`,
      cwd: projectRoot,
      autostart: true,
    });
  }

  const pkgRoot = `${projectRoot}/src/${packageName}`;

  if (!options.rest) {
    tree.delete(`${pkgRoot}/entrypoints/api`);
    // Middleware tests import the API entrypoint, which only exists with --rest.
    tree.delete(`${projectRoot}/tests/test_middleware.py`);
  }

  if (!options.postgres) {
    tree.delete(`${pkgRoot}/adapters/database.py`);
    tree.delete(`${pkgRoot}/adapters/repository.py`);
    // Schema lives in db/ (parity with Go); migrate runs scripts/apply-schema.sh.
    tree.delete(`${projectRoot}/db`);
    tree.delete(`${projectRoot}/scripts/apply-schema.sh`);
  }

  if (!options.websockets) {
    tree.delete(`${pkgRoot}/entrypoints/api/websocket_handler.py`);
    tree.delete(`${pkgRoot}/adapters/websocket_hub.py`);
  }

  if (options.messaging === 'none') {
    tree.delete(`${pkgRoot}/adapters/message_queue.py`);
  }

  if (!options.runpod) {
    tree.delete(`${pkgRoot}/entrypoints/worker`);
    tree.delete(`${pkgRoot}/adapters/comfyui.py`);
    // Worker test imports the runpod worker handler, deleted above.
    tree.delete(`${projectRoot}/tests/test_worker.py`);
  }

  // LLM is a composable capability port (plan WS-F). The chosen provider —
  // anthropic | openai | local | none — selects the adapter; the port, the
  // contract test, the provider dependency and its env footprint all come from
  // the capability registry via one shared injector (no inline per-provider
  // template here). `none` ships the bare port: the interface + a stub + a red bet.
  if (options.llm) {
    applyCapability(tree, {
      capability: 'llm',
      provider: llmProvider,
      stack: 'python',
      serviceRoot: projectRoot,
    });
  }

  promoteEngineerSkill(tree, 'groundwork-python-engineer');

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'python-microservice', options as unknown as Record<string, unknown>);
}
