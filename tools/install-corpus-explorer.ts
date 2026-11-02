import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { copyExplorerAssets } from '@/infrastructure/scan-explorer/corpus-assets';
import { readInstallCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { workspaceFolder } from '@/infrastructure/workspace-folders';

const [source] = process.argv.slice(2);
if (source === undefined) {
  throw new Error('Usage: explorer:install <refined publication directory>');
}
const catalogue = await readInstallCatalogue(source);
const folder = await workspaceFolder(catalogue.workspace);
if (folder === null) throw new Error('Workspace not registered');
await copyExplorerAssets(
  path.resolve(source),
  path.join(folder, 'explorer', 'corpus', catalogue.publication ?? catalogue.snapshot),
);
const pointer = path.join(folder, 'explorer', 'catalogue.json');
await writeFile(`${pointer}.pending`, JSON.stringify(catalogue));
await rename(`${pointer}.pending`, pointer);
process.stdout.write(
  `Installed ${String(catalogue.selections.length)} captured repositories for ${catalogue.workspace}\n`,
);
