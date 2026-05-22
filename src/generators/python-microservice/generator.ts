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

      const servicesMap = composeDoc.get('services');
      if (servicesMap && servicesMap.items) {
        const usedPorts = new Set<number>();
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
        while (usedPorts.has(assignedPort)) {
          assignedPort++;
        }
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

  // Auto-inject into docker-compose.yml if it exists
  if (composeDoc) {
    try {
      const servicesMap = composeDoc.get('services');
      if (servicesMap && !servicesMap.has(serviceNames.fileName)) {
        const newService = {
          build: {
            context: `./${projectRoot}`,
            dockerfile: 'Dockerfile'
          },
          container_name: serviceNames.fileName,
          restart: 'unless-stopped',
          ports: [
            `${assignedPort}:${assignedPort}`
          ],
          environment: [
            `SERVER_PORT=${assignedPort}`,
            'DB_HOST=db',
            'DB_PORT=5432',
            'DB_USER=${DB_USER:-postgres}',
            'DB_PASSWORD=${DB_PASSWORD:-postgres}',
            `DB_NAME=\${DB_NAME:-${serviceNames.fileName}}`,
            'REDIS_URL=redis:6379',
            'PUBSUB_EMULATOR_HOST=pubsub:${PUBSUB_PORT:-8085}',
            'OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317',
            'OTEL_EXPORTER_OTLP_PROTOCOL=grpc'
          ],
          depends_on: {
            db: { condition: 'service_healthy' },
            redis: { condition: 'service_healthy' }
          },
          networks: [
            'groundwork-net'
          ]
        };

        servicesMap.set(serviceNames.fileName, newService);
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
