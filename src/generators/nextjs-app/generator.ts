import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';

function installHiddenSkill(tree: Tree, skillName: string) {
  const sourcePath = path.join(__dirname, '..', '..', '..', '..', 'src', 'hidden-skills', skillName);
  
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Hidden skill ${skillName} not found at ${sourcePath}`);
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

  copyDir(sourcePath, `.agents/skills/${skillName}`);
}

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
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'nextjs-app', 'files'),
    projectRoot,
    templateOptions
  );

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
          'OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318',
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

  installHiddenSkill(tree, 'groundwork-nextjs-engineer');

  await formatFiles(tree);

  return () => {
    const { execSync } = require('child_process');
    try {
      execSync('pnpm install --frozen-lockfile', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn(`Failed to run pnpm install in ${projectRoot}. Run it manually.`);
    }
  };
}
