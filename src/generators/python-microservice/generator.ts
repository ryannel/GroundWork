import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';

function promoteEngineerSkill(tree: Tree, skillName: string) {
  const sourcePath = path.join(__dirname, '..', '..', '..', '..', 'src', 'hidden-skills', skillName);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`Engineer skill ${skillName} not found at ${sourcePath}`);
    return;
  }

  function copyDir(src: string, dest: string) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcFile = path.join(src, entry.name);
      const destFile = dest + '/' + entry.name;
      if (entry.isDirectory()) {
        copyDir(srcFile, destFile);
      } else {
        tree.write(destFile, fs.readFileSync(srcFile));
      }
    }
  }

  // Engineer skills live in hidden-skills/ until a service is scaffolded, then
  // they are promoted to .agents/skills/ so engineers have them immediately available.
  copyDir(sourcePath, `.agents/skills/${skillName}`);
}

function deployStackDocs(tree: Tree, docsRoot: string) {
  if (!fs.existsSync(docsRoot)) return;

  function walk(src: string, relPath: string) {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(srcPath, destPath);
      } else if (!tree.exists(destPath)) {
        tree.write(destPath, fs.readFileSync(srcPath));
      }
    }
  }
  walk(docsRoot, 'docs');
}

/**
 * Inject the optional infrastructure a service needs into the shared
 * docker-compose. redis and the pubsub emulator are not in the base compose;
 * they are added here on demand and only once, so a project provisions only the
 * infrastructure some service actually uses.
 */
function ensureOptionalInfra(
  composeDoc: any,
  servicesMap: any,
  opts: { usesRedis: boolean; usesPubSub: boolean }
) {
  if (opts.usesRedis && !servicesMap.has('redis')) {
    servicesMap.set('redis', {
      image: 'redis:7-alpine',
      restart: 'unless-stopped',
      ports: ['6379:6379'],
      networks: ['groundwork-net'],
      volumes: ['redis_data:/data'],
      healthcheck: {
        test: ['CMD', 'redis-cli', 'ping'],
        interval: '5s',
        timeout: '3s',
        retries: 5
      }
    });
    let volumesMap = composeDoc.get('volumes');
    if (!volumesMap) {
      composeDoc.set('volumes', {});
      volumesMap = composeDoc.get('volumes');
    }
    if (!volumesMap.has('redis_data')) {
      volumesMap.set('redis_data', null);
    }
  }

  if (opts.usesPubSub && !servicesMap.has('pubsub')) {
    servicesMap.set('pubsub', {
      image: 'gcr.io/google.com/cloudsdktool/cloud-sdk:emulators',
      restart: 'unless-stopped',
      ports: ['8085:8085'],
      networks: ['groundwork-net'],
      command: 'gcloud beta emulators pubsub start --host-port=0.0.0.0:8085',
      healthcheck: {
        test: ['CMD', 'curl', '-f', 'http://localhost:8085'],
        interval: '5s',
        timeout: '5s',
        retries: 5
      }
    });
  }
}

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
