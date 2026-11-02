import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import type { ExplorerCatalogue } from '@/domain/service-explorer';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import {
  readCorpusCatalogue,
  readCorpusRepository,
} from '@/infrastructure/scan-explorer/corpus-catalogue';
import { readCorpusClaims } from '@/infrastructure/scan-explorer/corpus-purpose';
import { parseExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { parseExplorerManifest } from '@/infrastructure/service-explorer-format';

import { writeExplorerJson } from './publish-explorer-pages';
import { refineSourceFiles } from './refine-explorer-files';
import { refineInterpretation } from './refine-explorer-interpretation';
import { refineSourceReferences } from './refine-explorer-references';
import { refinementStore } from './refine-explorer-store';

const [corpusFile, output, workspace] = process.argv.slice(2);
if (corpusFile === undefined || output === undefined || workspace === undefined) {
  throw new Error(
    'Usage: explorer:refine <catalogue/index.json> <publication directory> <workspace>',
  );
}
const corpus = await readCorpusCatalogue(corpusFile);
const catalogue = {
  format: 'service-explorer-catalogue/v1' as const,
  workspace,
  snapshot: path.basename(path.resolve(output)),
  assetBase: `/explorer-data/${workspace}/${path.basename(path.resolve(output))}/`,
  selections: [],
};
const selections: ExplorerCatalogue['selections'][number][] = [];
for (const row of corpus.repositories) {
  const checkpoint = path.join(output, `selection-${sourceDigest(row.repo).slice(0, 24)}.json`);
  const raw = await waitForPublication(checkpoint);
  const selection = parseExplorerCatalogue({ ...catalogue, selections: [JSON.parse(raw)] })
    .selections[0];
  if (selection?.service.repo !== row.repo || selection.service.commit !== row.commit) {
    throw new Error('Published selection does not match captured repository revision');
  }
  const marker = path.join(
    output,
    `refined-${sourceDigest(selection.service.repo).slice(0, 24)}.json`,
  );
  const cached = await readFile(marker, 'utf8').catch(() => null);
  if (cached === null) {
    const detail = await readCorpusRepository(corpus.root, row);
    const manifest = parseExplorerManifest(
      JSON.parse(await readFile(path.join(output, selection.manifest.file), 'utf8')),
    );
    const store = await refinementStore(output, manifest);
    const identity = { service: selection.service, snapshot: catalogue.snapshot };
    const references = await refineSourceReferences(store, identity);
    const files = await refineSourceFiles(store, detail, identity);
    const service = await refineInterpretation(
      store,
      await readCorpusClaims(corpus.root, detail),
      identity,
    );
    const refined = await store.finish();
    const updated = parseExplorerManifest({
      ...refined,
      services: refined.services.map((item) =>
        item.id === service.id
          ? { ...item, interpretationIndex: service.interpretationIndex }
          : item,
      ),
    });
    const reference = await writeExplorerJson(output, selection.manifest.file, updated);
    const result = { ...selection, service, manifest: reference };
    selections.push(result);
    await writeFile(marker, JSON.stringify(result));
    await writeFile(
      path.join(output, `selection-${sourceDigest(selection.service.repo).slice(0, 24)}.json`),
      JSON.stringify(result),
    );
    process.stdout.write(
      `${selection.service.repo} · ${String(files)} files · ${String(references)} referenced frames\n`,
    );
  } else {
    selections.push(
      ...parseExplorerCatalogue({ ...catalogue, selections: [JSON.parse(cached)] }).selections,
    );
  }
}
const completed = parseExplorerCatalogue(
  JSON.parse(await waitForPublication(path.join(output, 'catalogue.json'))),
);
if (completed.selections.length !== corpus.repositories.length) {
  throw new Error('Raw publication has not completed the selected corpus');
}
const result = parseExplorerCatalogue({ ...catalogue, selections });
await writeFile(path.join(output, 'catalogue.json'), JSON.stringify(result));
await writeFile(
  path.join(output, 'refinement.json'),
  JSON.stringify({
    format: 'service-explorer-refinement/v1',
    snapshot: result.snapshot,
    repositories: result.selections.length,
    sourceCatalogue: corpus.snapshot,
    catalogueSha256: sourceDigest(JSON.stringify(result)),
  }),
);
process.stdout.write(`Refined ${String(selections.length)} captured repositories\n`);

async function waitForPublication(file: string): Promise<string> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const bytes = await readFile(file, 'utf8').catch(() => null);
    if (bytes !== null) return bytes;
    await setTimeout(10_000);
  }
  throw new Error(`Publication checkpoint not available: ${file}`);
}
