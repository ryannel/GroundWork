import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import { execSync } from 'child_process';
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

export interface GoMicroserviceGeneratorSchema {
  name: string;
  messaging: 'none' | 'kafka' | 'gcp-pubsub';
  auth: 'none' | 'service' | 'clerk';
  websockets: boolean;
}

export default async function (tree: Tree, options: GoMicroserviceGeneratorSchema) {
  // Derive naming variants
  const serviceNames = names(options.name);
  // Using the workspace root, or you might want to place it in `services/`
  // We'll scaffold it in `services/${serviceNames.fileName}` by default.
  const projectRoot = `services/${serviceNames.fileName}`;

  // Calculate assignedPort based on docker-compose.yml (if it exists)
  let assignedPort = 4000;
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

  // Read EJS templates
  const templateOptions = {
    ...options,
    ...serviceNames,
    assignedPort,
    tmpl: '' // required by generateFiles
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'go-microservice', 'files'),
    projectRoot,
    templateOptions
  );

  deployStackDocs(tree, path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'go-microservice', 'docs'));

  // Auto-inject into docker-compose.yml if it exists
  if (composeDoc) {
    try {
      const yaml = require('yaml');
      const services = composeDoc.get('services');
      if (!services) {
        composeDoc.set('services', {});
      }
      const servicesMap = composeDoc.get('services');

      if (!servicesMap.has(serviceNames.fileName)) {
        // Only wire the infrastructure this service actually uses. Redis backs
        // the WebSocket hub; the Pub/Sub emulator backs GCP Pub/Sub messaging.
        // A service using neither should declare neither.
        const usesRedis = options.websockets;
        const usesPubSub = options.messaging === 'gcp-pubsub';

        const environment: string[] = [
          `SERVER_PORT=${assignedPort}`,
          `DATABASE_URL=postgres://\${DB_USER:-postgres}:\${DB_PASSWORD:-postgres}@db:5432/\${DB_NAME:-${serviceNames.fileName}}?sslmode=disable`,
          'DB_HOST=db',
          'DB_PORT=5432',
          'DB_USER=${DB_USER:-postgres}',
          'DB_PASSWORD=${DB_PASSWORD:-postgres}',
          `DB_NAME=\${DB_NAME:-${serviceNames.fileName}}`
        ];
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

        const dependsOn: Record<string, { condition: string }> = {
          db: { condition: 'service_healthy' }
        };
        if (usesRedis) {
          dependsOn.redis = { condition: 'service_healthy' };
        }

        const newService: Record<string, unknown> = {
          build: {
            context: `./${projectRoot}`,
            dockerfile: 'Dockerfile.dev'
          },
          container_name: serviceNames.fileName,
          restart: 'unless-stopped',
          ports: [
            `${assignedPort}:${assignedPort}`
          ],
          environment,
          depends_on: dependsOn,
          networks: [
            'groundwork-net'
          ]
        };

        servicesMap.set(serviceNames.fileName, newService);
        ensureOptionalInfra(composeDoc, servicesMap, { usesRedis, usesPubSub });
        tree.write('docker-compose.yml', composeDoc.toString());
      }
    } catch (e) {
      console.warn('Failed to update docker-compose.yml:', e);
    }
  }

  if (!options.websockets) {
    tree.delete(`${projectRoot}/internal/provider/websocket`);
    tree.delete(`${projectRoot}/internal/entrypoints/api/websocket_handler.go`);
    tree.delete(`${projectRoot}/asyncapi-ws.yaml`);
  }

  if (options.messaging === 'none') {
    tree.delete(`${projectRoot}/asyncapi-pubsub.yaml`);
    tree.delete(`${projectRoot}/internal/core/gateway/message_queue.go`);
    tree.delete(`${projectRoot}/internal/core/gateway/outbox_repository.go`);
  }
  
  if (options.messaging !== 'kafka') {
    tree.delete(`${projectRoot}/internal/provider/kafka.go`);
  }
  
  if (options.messaging !== 'gcp-pubsub') {
    tree.delete(`${projectRoot}/internal/provider/gcp_pubsub.go`);
  }
  
  if (options.auth !== 'clerk') {
    tree.delete(`${projectRoot}/internal/entrypoints/api/middleware_auth.go`);
    tree.delete(`${projectRoot}/internal/entrypoints/api/clerk_webhook.go`);
    tree.delete(`${projectRoot}/internal/core/domain/user.go`);
    tree.delete(`${projectRoot}/internal/core/gateway/user_repository.go`);
    tree.delete(`${projectRoot}/internal/core/service/user_service.go`);
    tree.delete(`${projectRoot}/internal/provider/user_repository.go`);
  }

  promoteEngineerSkill(tree, 'groundwork-go-engineer');

  await formatFiles(tree);

  return () => {
    try {
      execSync('go mod tidy', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn(`Failed to run go mod tidy in ${projectRoot}:`, e);
    }
  };
}
