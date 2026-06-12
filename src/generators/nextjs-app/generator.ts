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
} from '../shared/scaffold-helpers';

export interface NextjsAppGeneratorSchema {
  name: string;
  auth: 'none' | 'clerk';
  apiProxy: boolean;
  websockets: boolean;
}

export default async function (tree: Tree, options: NextjsAppGeneratorSchema) {
  const serviceNames = names(options.name);
  const projectRoot = `services/${serviceNames.fileName}`;

  // Calculate assignedPort from docker-compose.yml (base 4000, sequential)
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

  const templateOptions = {
    ...options,
    ...serviceNames,
    assignedPort,
    tmpl: '' // required by generateFiles
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'nextjs-app', 'files'),
    projectRoot,
    templateOptions
  );

  deployStackDocs(tree, path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'nextjs-app', 'docs'));

  // Nx's generateFiles treats __var__ as template substitution, which
  // conflicts with Next.js dynamic route segments like [...path] and
  // [[...sign-in]]. We use placeholder dir names and rename post-generation.
  const renames: [string, string][] = [
    [`${projectRoot}/app/api/proxy/__path__`, `${projectRoot}/app/api/proxy/[...path]`],
    [`${projectRoot}/app/(auth)/sign-in/__sign-in__`, `${projectRoot}/app/(auth)/sign-in/[[...sign-in]]`],
    [`${projectRoot}/app/(auth)/sign-up/__sign-up__`, `${projectRoot}/app/(auth)/sign-up/[[...sign-up]]`],
  ];

  for (const [oldDir, newDir] of renames) {
    // Find all files under the old directory and move them
    const children = tree.children(oldDir);
    if (children && children.length > 0) {
      for (const child of children) {
        const content = tree.read(`${oldDir}/${child}`);
        if (content) {
          tree.write(`${newDir}/${child}`, content);
          tree.delete(`${oldDir}/${child}`);
        }
      }
    }
  }

  // Auto-inject into docker-compose.yml if it exists
  if (composeDoc) {
    try {
      const servicesMap = composeDoc.get('services');
      if (servicesMap && !servicesMap.has(serviceNames.fileName)) {
        const envVars = [
          `PORT=${assignedPort}`,
          `OTEL_SERVICE_NAME=${serviceNames.fileName}`,
          'OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318',
        ];

        if (options.apiProxy) {
          envVars.push('API_URL=http://core:4000');
        }

        if (options.auth === 'clerk') {
          envVars.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}');
          envVars.push('CLERK_SECRET_KEY=${CLERK_SECRET_KEY}');
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
          environment: envVars,
          // The node:alpine runtime image has no curl, but ships busybox wget,
          // which probes the health route without an extra binary.
          healthcheck: {
            test: [
              'CMD',
              'wget',
              '-q',
              '--spider',
              `http://localhost:${assignedPort}/api/healthz`
            ],
            interval: '10s',
            timeout: '5s',
            retries: 5,
            start_period: '20s'
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

  // Conditionally remove auth files
  if (options.auth !== 'clerk') {
    tree.delete(`${projectRoot}/app/(auth)`);
    tree.delete(`${projectRoot}/proxy.ts`);
    tree.delete(`${projectRoot}/components/providers/production.tsx`);
  }

  // Conditionally remove API proxy files
  if (!options.apiProxy) {
    tree.delete(`${projectRoot}/app/api/proxy`);
    tree.delete(`${projectRoot}/lib/api`);
    tree.delete(`${projectRoot}/lib/config.ts`);
  }

  // Conditionally remove websocket files
  if (!options.websockets) {
    tree.delete(`${projectRoot}/app/api/config`);
  }

  promoteEngineerSkill(tree, 'groundwork-nextjs-engineer');

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'nextjs-app', options as unknown as Record<string, unknown>);

  return () => {
    const { execSync } = require('child_process');
    try {
      execSync('pnpm install', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn(`Failed to run pnpm install in ${projectRoot}. Run it manually.`);
    }
  };
}
