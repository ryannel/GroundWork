import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import { execSync } from 'child_process';

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
            'DB_NAME=${DB_NAME:-wordloop}',
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

  await formatFiles(tree);

  return () => {
    try {
      execSync('go mod tidy', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn(`Failed to run go mod tidy in ${projectRoot}:`, e);
    }
  };
}
