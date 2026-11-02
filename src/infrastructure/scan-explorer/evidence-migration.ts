import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  discoveryClaims,
  discoverySummary,
  schemaRecords,
  targetedClaims,
} from '@/application/evidence/evidence-discovery';
import {
  type EvidenceMerge,
  evidenceMerge,
  splitEvidence,
} from '@/application/evidence/evidence-records';
import {
  EVIDENCE_FORMAT,
  type EvidenceFields,
  type EvidencePass,
  type EvidenceRecord,
  fieldsOf,
  listOf,
  textOf,
} from '@/domain/evidence/evidence';
import { readFramedScanJson } from '@/infrastructure/scan/framed-scan-document';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { inTurn } from '@/shared/in-turn';

import {
  corpusDocuments,
  readCorpusCatalogue,
  readCorpusDocument,
  readCorpusRepository,
} from './corpus-catalogue';
import type { RepositoryEvidence, SyntaxCacheWriter } from './evidence-files';

// Reads the October 2026 capture and discovery runs into current evidence: the last selected document per scope,
// merged; attempts, digests, model runs and other process records are left behind.

const readJson = async (file: string): Promise<EvidenceFields> =>
  fieldsOf(JSON.parse(await readFile(file, 'utf8')));

export interface MigrationSource {
  readonly repo: string;
  readonly commit: string;
  readonly checkedAt: string;
  readonly language: string | null;
  /** The capture's inventory.json, when the source pass ran. */
  readonly inventory: string | null;
  /** Visits the scan documents one at a time: a repository can hold thousands. */
  readonly eachDocument: (visit: Visit) => Promise<void>;
  readonly discovery: EvidenceFields | null;
  readonly targeted: EvidenceFields | null;
  readonly schemas: EvidenceFields | null;
}

type Visit = (document: EvidenceFields) => Promise<void>;
const noDocuments = async (visit: Visit): Promise<void> => inTurn([], visit);

const unscanned = (repo: string, commit: string, checkedAt: string): MigrationSource => ({
  repo,
  commit,
  checkedAt,
  language: null,
  inventory: null,
  eachDocument: noDocuments,
  discovery: null,
  targeted: null,
  schemas: null,
});

export async function captureSources(catalogueFile: string): Promise<MigrationSource[]> {
  const catalogue = await readCorpusCatalogue(catalogueFile);
  return Promise.all(
    catalogue.repositories.map(async (row) => {
      const raw = await readJson(path.join(catalogue.root, row.detail));
      const language = textOf(raw.batch);
      return {
        ...unscanned(row.repo, row.commit, textOf(fieldsOf(raw.remoteObservation).checkedAt)),
        language: language === '' ? null : language,
        inventory: path.join(catalogue.root, textOf(fieldsOf(raw.inventory).path)),
        eachDocument: async (visit: Visit) => {
          const detail = await readCorpusRepository(catalogue.root, row);
          await inTurn(corpusDocuments(catalogue.root, detail), async (ref) => {
            await visit(fieldsOf(await readCorpusDocument(ref)));
          });
        },
      };
    }),
  );
}

/** The last trial's document for each live scope of a source capture that has no catalogue of its own. */
async function eachTrialDocument(sourceDirectory: string, visit: Visit): Promise<void> {
  const metadata = await readJson(path.join(sourceDirectory, 'repository.json'));
  const retired = new Set(Array.isArray(metadata.retiredScopeIds) ? metadata.retiredScopeIds : []);
  const latest = new Map<string, string>();
  for (const trial of listOf(metadata.trials)) {
    const document = textOf(trial.document);
    if (document !== '' && !retired.has(trial.scope)) latest.set(textOf(trial.scope), document);
  }
  const validate = await scanValidator();
  await inTurn([...latest.values()], async (document) => {
    const raw = await readFramedScanJson(path.join(sourceDirectory, document), { kind: 'source' });
    await visit(fieldsOf(validate(raw)));
  });
}

function capturedOnlyByDiscovery(row: EvidenceFields, detail: EvidenceFields): MigrationSource {
  const capture = textOf(row.sourceCapture);
  const source = unscanned(
    textOf(row.repo),
    textOf(row.commit),
    textOf(fieldsOf(row.freshness).checkedAt),
  );
  if (capture === '') return { ...source, discovery: detail };
  return {
    ...source,
    inventory: path.join(capture, 'inventory.json'),
    eachDocument: async (visit: Visit) => eachTrialDocument(capture, visit),
    discovery: detail,
  };
}

const detailFile = (folder: string, kind: string, row: EvidenceFields): string =>
  path.join(folder, kind, path.basename(textOf(fieldsOf(row.detail).path)));

async function discoveryDetails(
  folder: string,
  kind: string,
  rows: readonly EvidenceFields[],
): Promise<readonly (readonly [EvidenceFields, EvidenceFields])[]> {
  return Promise.all(
    rows.map(async (row) => [row, await readJson(detailFile(folder, kind, row))] as const),
  );
}

/** Discovery details joined onto the capture sources, and the repositories only discovery read. */
export async function withDiscovery(
  sources: readonly MigrationSource[],
  catalogueFile: string,
): Promise<MigrationSource[]> {
  const folder = path.dirname(catalogueFile);
  const byRepo = new Map(sources.map((source) => [source.repo, source]));
  const index = await readJson(catalogueFile);
  for (const [row, detail] of await discoveryDetails(
    folder,
    'repositories',
    listOf(index.repositories),
  )) {
    const known = byRepo.get(textOf(row.repo));
    const joined =
      known === undefined ? capturedOnlyByDiscovery(row, detail) : { ...known, discovery: detail };
    byRepo.set(joined.repo, joined);
  }
  const targeted = await readJson(path.join(folder, 'targeted-index.json'));
  for (const [row, detail] of await discoveryDetails(
    folder,
    'targeted',
    listOf(targeted.repositories),
  )) {
    const repo = textOf(row.repo);
    const known =
      byRepo.get(repo) ??
      unscanned(repo, textOf(row.commit), textOf(fieldsOf(row.freshness).checkedAt));
    byRepo.set(repo, { ...known, targeted: detail });
  }
  const schemas = await readJson(path.join(folder, 'schemas', 'pop-pb-contracts.json'));
  const owner = byRepo.get(textOf(schemas.repo));
  if (owner !== undefined) byRepo.set(owner.repo, { ...owner, schemas });
  return [...byRepo.values()];
}

async function inventoryFiles(file: string | null): Promise<EvidenceRecord[]> {
  if (file === null) return [];
  const inventory = await readJson(file);
  return listOf(inventory.files).map((entry) => ({
    kind: 'file',
    id: `file:${textOf(entry.path)}`,
    path: textOf(entry.path),
    blob: textOf(entry.blob),
    category: textOf(entry.category),
    language: entry.language ?? null,
    selectedForParsing: entry.selectedForParsing === true,
  }));
}

const claimsOf = (source: MigrationSource): EvidenceRecord[] => [
  ...(source.discovery === null ? [] : discoveryClaims(source.discovery)),
  ...(source.targeted === null ? [] : targetedClaims(source.targeted)),
];

export const evidenceName = (repo: string): string => repo.slice(repo.indexOf('/') + 1);

async function mergedDocuments(
  source: MigrationSource,
  syntax: SyntaxCacheWriter,
): Promise<EvidenceMerge> {
  const merge = evidenceMerge();
  await source.eachDocument(async (document) => syntax.write('semantic', merge.add(document)));
  return merge;
}

function repositoryOf(
  source: MigrationSource,
  families: ReadonlyMap<string, readonly EvidenceRecord[]>,
  passes: readonly EvidencePass[],
): RepositoryEvidence['repository'] {
  const files = families.get('files') ?? [];
  return {
    format: EVIDENCE_FORMAT,
    repo: source.repo,
    commit: source.commit,
    scannedAt: source.checkedAt,
    language: source.language,
    trackedFiles: files.length,
    selectedFiles: files.filter((file) => file.selectedForParsing === true).length,
    passes,
  };
}

/** A repository's evidence; its syntax graph goes to the cache as it is read. */
export async function migrateRepository(
  source: MigrationSource,
  syntax: SyntaxCacheWriter,
): Promise<RepositoryEvidence> {
  const merge = await mergedDocuments(source, syntax);
  const split = splitEvidence(merge.merged);
  await syntax.write('sources', split.syntaxSources);
  const extra: [string, readonly EvidenceRecord[]][] = [
    ['files', await inventoryFiles(source.inventory)],
    ['claims', claimsOf(source)],
    ['schemas', source.schemas === null ? [] : schemaRecords(source.schemas)],
  ];
  const families = new Map<string, readonly EvidenceRecord[]>([
    ...split.evidence,
    ...extra.filter(([, records]) => records.length > 0),
  ]);
  const passes: EvidencePass[] = [];
  if (split.evidence.size > 0) passes.push('source');
  if (families.has('claims')) passes.push('discovery');
  return {
    name: evidenceName(source.repo),
    repository: repositoryOf(source, families, passes),
    discovery: source.discovery === null ? null : discoverySummary(source.discovery),
    families: new Map([...families].toSorted(([left], [right]) => left.localeCompare(right, 'en'))),
    analysis: split.analysis,
  };
}
