import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import {
  promoteEngineerSkill,
  deployStackDocs,
  ensureOptionalInfra,
} from '../shared/scaffold-helpers';

export interface PythonMicroserviceGeneratorSchema {
  name: string;
  rest: boolean;
  postgres: boolean;
  messaging: 'none' | 'redis' | 'kafka' | 'gcp-pubsub';
  websockets: boolean;
  runpod: boolean;
  llm: boolean;
}

export default async function (tree: Tree, options: PythonMicroserviceGeneratorSchema) {
  const serviceNames = names(options.name);
  const projectRoot = `services/${serviceNames.fileName}`;

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

  const templateOptions = {
    ...options,
    ...serviceNames,
    assignedPort,
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
      const servicesMap = composeDoc.get('services');
      if (servicesMap && !servicesMap.has(serviceNames.fileName)) {
        // Only wire the infrastructure this service actually uses. Redis is
        // needed for the WebSocket backplane or Redis pub/sub; the Pub/Sub
        // emulator only for GCP Pub/Sub messaging. A plain --rest --postgres
        // --llm service provisions neither.
        const usesRedis = options.websockets || options.messaging === 'redis';
        const usesPubSub = options.messaging === 'gcp-pubsub';

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
        ensureOptionalInfra(composeDoc, servicesMap, { usesRedis, usesPubSub });
        tree.write('docker-compose.yml', composeDoc.toString());
      }
    } catch (e) {
      console.warn('Failed to update docker-compose.yml:', e);
    }
  }

  if (!options.rest) {
    tree.delete(`${projectRoot}/src/entrypoints/api`);
  }

  if (!options.postgres) {
    tree.delete(`${projectRoot}/src/provider/database.py`);
    tree.delete(`${projectRoot}/src/provider/database_repository.py`);
    tree.delete(`${projectRoot}/schema.sql`);
  }

  if (!options.websockets) {
    tree.delete(`${projectRoot}/src/entrypoints/api/websocket_handler.py`);
    tree.delete(`${projectRoot}/src/provider/websocket_hub.py`);
  }

  if (options.messaging === 'none') {
    tree.delete(`${projectRoot}/src/provider/message_queue.py`);
  }

  if (!options.runpod) {
    tree.delete(`${projectRoot}/src/entrypoints/worker`);
    tree.delete(`${projectRoot}/src/provider/comfyui_gateway.py`);
  }

  if (!options.llm) {
    tree.delete(`${projectRoot}/src/provider/llm_gateway.py`);
  }

  promoteEngineerSkill(tree, 'groundwork-python-engineer');

  await formatFiles(tree);
}
