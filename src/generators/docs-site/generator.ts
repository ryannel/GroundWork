import {
  formatFiles,
  generateFiles,
  Tree,
  names,
} from '@nx/devkit';
import * as path from 'path';
import { recordGeneratorProvenance } from '../shared/provenance';

export interface DocsSiteGeneratorSchema {
  name: string;
}

export default async function (tree: Tree, options: DocsSiteGeneratorSchema) {
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
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'docs-site', 'files'),
    projectRoot,
    templateOptions
  );

  // Nx's generateFiles treats __var__ as template substitution.
  // Rename the dynamic catch-all route directory.
  const renames: [string, string][] = [
    [`${projectRoot}/app/docs/__slug__`, `${projectRoot}/app/docs/[[...slug]]`],
  ];

  for (const [oldDir, newDir] of renames) {
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
      if (!composeDoc.get('services')) {
        // createNode so the result is a YAMLMap with .has/.set (a plain {} is not).
        composeDoc.set('services', composeDoc.createNode({}));
      }
      const servicesMap = composeDoc.get('services');
      if (!servicesMap.has(serviceNames.fileName)) {
        const envVars = [
          `PORT=3000`,
        ];

        const newService: Record<string, unknown> = {
          build: {
            context: `./${projectRoot}`,
            dockerfile: 'Dockerfile'
          },
          container_name: serviceNames.fileName,
          restart: 'unless-stopped',
          ports: [
            `${assignedPort}:3000`
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

  await formatFiles(tree);

  recordGeneratorProvenance(tree, 'docs-site', options as unknown as Record<string, unknown>);

  return () => {
    const { execSync } = require('child_process');
    try {
      execSync('pnpm install', { cwd: projectRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn(`Failed to run pnpm install in ${projectRoot}. Run it manually.`);
    }
  };
}
