import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ExplorerCatalogue } from '@/domain/service-explorer';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import { parseExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';

import { packExplorerRepository } from './pack-explorer-repository';

const [source, output] = process.argv.slice(2);
if (source === undefined || output === undefined) {
  throw new Error('Usage: explorer:pack <refined publication> <packed output>');
}
await mkdir(output, { recursive: true });
const catalogue = parseExplorerCatalogue(
  JSON.parse(await readFile(path.join(source, 'catalogue.json'), 'utf8')),
);
const selections: ExplorerCatalogue['selections'][number][] = [];
for (const selection of catalogue.selections) {
  const marker = path.join(
    output,
    `packed-${sourceDigest(selection.service.repo).slice(0, 24)}.json`,
  );
  const previous = await readFile(marker, 'utf8').catch(() => null);
  const cached = readCheckpoint(previous, catalogue, selection.manifest.sha256);
  if (cached === null) {
    const packed = await packExplorerRepository(selection, { source, output });
    selections.push(packed);
    await writeFile(
      marker,
      JSON.stringify({ sourceManifest: selection.manifest.sha256, selection: packed }),
    );
  } else {
    selections.push(cached);
  }
}
const publication = sourceDigest(
  JSON.stringify({
    format: 'groundwork-ui-publication/v1',
    workspace: catalogue.workspace,
    snapshot: catalogue.snapshot,
    manifests: selections.map((item) => item.manifest.sha256),
  }),
);
const sealed = parseExplorerCatalogue({
  ...catalogue,
  selections,
  publication,
  assetBase: `/explorer-data/${catalogue.workspace}/${publication}/`,
});
await writeFile(path.join(output, 'catalogue.json'), JSON.stringify(sealed));
await writeFile(
  path.join(output, 'refinement.json'),
  JSON.stringify({
    format: 'service-explorer-refinement/v1',
    snapshot: sealed.snapshot,
    repositories: sealed.selections.length,
    sourceCatalogue: catalogue.snapshot,
    catalogueSha256: sourceDigest(JSON.stringify(sealed)),
  }),
);
process.stdout.write(
  `Sealed ${String(selections.length)} repositories as immutable publication ${publication}\n`,
);
function readCheckpoint(
  raw: string | null,
  selectedCatalogue: ExplorerCatalogue,
  digest: string,
): ExplorerCatalogue['selections'][number] | null {
  const value: unknown = raw === null ? null : JSON.parse(raw);
  if (value === null || typeof value !== 'object') return null;
  if (!('sourceManifest' in value) || !('selection' in value)) return null;
  if (value.sourceManifest !== digest) return null;
  return (
    parseExplorerCatalogue({ ...selectedCatalogue, selections: [value.selection] }).selections[0] ??
    null
  );
}
