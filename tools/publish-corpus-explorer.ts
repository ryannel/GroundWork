import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ExplorerCatalogue } from '@/domain/service-explorer';
import { componentsOf } from '@/domain/workspace';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import {
  readCorpusCatalogue,
  readCorpusRepository,
} from '@/infrastructure/scan-explorer/corpus-catalogue';
import { parseExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { readWorkspaces } from '@/infrastructure/workspace-store';

import { publishCorpusRepository } from './publish-corpus-repository';

const [catalogueFile, workspaceId, outputRoot, selectedRepo] = process.argv.slice(2);
if (catalogueFile === undefined || workspaceId === undefined || outputRoot === undefined) {
  throw new Error(
    'Usage: explorer:publish <catalogue/index.json> <workspace> <output> [repository]',
  );
}
const catalogue = await readCorpusCatalogue(catalogueFile);
const snapshot = sourceDigest(`${catalogue.snapshot}:explorer-corpus-v2`);
const output = path.resolve(outputRoot, snapshot);
await mkdir(output, { recursive: true });
const workspaces = await readWorkspaces();
const workspace = workspaces.find((item) => item.id === workspaceId);
if (workspace === undefined) throw new Error('Workspace not registered');
const components = componentsOf(workspace);
const selections: ExplorerCatalogue['selections'][number][] = [];
for (const row of catalogue.repositories) {
  const slug = row.repo.split('/').at(-1) ?? row.repo;
  const checkpoint = path.join(output, `selection-${sourceDigest(row.repo).slice(0, 24)}.json`);
  const cached = await readFile(checkpoint, 'utf8').catch(() => null);
  if (cached !== null) {
    const parsed = parseExplorerCatalogue({
      format: 'service-explorer-catalogue/v1',
      workspace: workspaceId,
      snapshot,
      assetBase: `/explorer-data/${workspaceId}/${snapshot}/`,
      selections: [JSON.parse(cached)],
    });
    selections.push(...parsed.selections);
  } else if (selectedRepo === undefined || slug === selectedRepo) {
    const detail = await readCorpusRepository(catalogue.root, row);
    const component = components.find((item) => item.id === `svc:${slug}` || item.id === slug);
    const selection = await publishCorpusRepository(detail, {
      root: catalogue.root,
      output,
      workspace: workspaceId,
      snapshot,
      name: component?.name ?? slug,
    });
    selections.push(selection);
    await writeFile(checkpoint, JSON.stringify(selection));
  }
}
const published = parseExplorerCatalogue({
  format: 'service-explorer-catalogue/v1',
  workspace: workspaceId,
  snapshot,
  assetBase: `/explorer-data/${workspaceId}/${snapshot}/`,
  selections,
});
await writeFile(path.join(output, 'catalogue.json'), JSON.stringify(published));
process.stdout.write(`${String(selections.length)} repository selections · ${output}\n`);
