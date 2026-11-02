import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ExplorerCatalogue } from '@/domain/service-explorer';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import {
  readCorpusCatalogue,
  readCorpusRepository,
} from '@/infrastructure/scan-explorer/corpus-catalogue';
import { parseExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';

import { repairCorpusEntryPages } from './repair-corpus-entry-pages';

const [corpusFile, output] = process.argv.slice(2);
if (corpusFile === undefined || output === undefined) {
  throw new Error('Usage: explorer:repair-entries <catalogue/index.json> <raw publication>');
}
const corpus = await readCorpusCatalogue(corpusFile);
const catalogue = parseExplorerCatalogue(
  JSON.parse(await readFile(path.join(output, 'catalogue.json'), 'utf8')),
);
const selections: ExplorerCatalogue['selections'][number][] = [];
for (const selection of catalogue.selections) {
  const row = corpus.repositories.find((candidate) => candidate.repo === selection.service.repo);
  if (row === undefined) throw new Error('Repository selection changed');
  const detail = await readCorpusRepository(corpus.root, row);
  selections.push(
    await repairCorpusEntryPages(detail, selection, {
      root: corpus.root,
      output,
      snapshot: catalogue.snapshot,
    }),
  );
}
const updated = parseExplorerCatalogue({ ...catalogue, selections });
await writeFile(path.join(output, 'catalogue.json'), JSON.stringify(updated));
const receipt = JSON.parse(await readFile(path.join(output, 'refinement.json'), 'utf8'));
if (receipt === null || typeof receipt !== 'object') throw new Error('Missing refinement receipt');
await writeFile(
  path.join(output, 'refinement.json'),
  JSON.stringify({ ...receipt, catalogueSha256: sourceDigest(JSON.stringify(updated)) }),
);
