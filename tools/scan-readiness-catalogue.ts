import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type {
  RepositoryReadinessInput,
  ReadinessQuery,
} from '@/domain/scan/repository-readiness-types';
import { scanRecords } from '@/domain/scan/scan-records';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import { repositoryPassJson } from '@/infrastructure/scan/repository-pass-files';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import type { EntryArtifact } from '@/infrastructure/scan/spring-entry-artifact-format';

import { readEntryArtifact, verifyEntryArtifact } from './scan-entry-artifacts';
import { entryCliDigest } from './scan-entry-fingerprint';
import { readinessQueryPages, type ReadinessPageSet } from './scan-readiness-query-pages';
import {
  readinessArray,
  readinessNumber,
  readinessObject,
  readinessString,
} from './scan-readiness-value';

function directoryFor(input: string, filename: string): string {
  if (path.basename(input) === filename) return path.dirname(input);
  if (path.extname(input) === '.json') throw new Error(`Expected ${filename} or its directory.`);
  return input;
}
function nonnegative(value: unknown): number {
  const number = readinessNumber(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error('Entry query counts must be non-negative integers.');
  }
  return number;
}
function bounded(value: unknown, maximum: number): number {
  const number = nonnegative(value);
  if (number === 0 || number > maximum) {
    throw new Error('Entry query declared limits exceed readiness caps.');
  }
  return number;
}
function queryLimits(receipt: Readonly<Record<string, unknown>>): ReadinessQuery['limits'] {
  const limits = readinessObject(receipt.limits);
  bounded(limits.maxRawRecordBytes, 8_388_608);
  return {
    maxRecords: bounded(limits.maxTotalRecords, 2048),
    maxBytes: 16_777_216,
    maxRecordsPerPage: bounded(limits.recordsPerPage, 4),
    maxPageBytes: bounded(limits.maxPageBytes, 65_536),
    idsPerRequest: bounded(limits.idsPerRequest, 32),
  };
}
function family(
  metadata: readonly { readonly id: string }[],
  records: ReadinessPageSet['records'],
  kind: string,
): readonly unknown[] {
  const values = new Map<string, unknown>(
    metadata.map((record): readonly [string, unknown] => [record.id, record]),
  );
  for (const record of records) if (record.kind === kind) values.set(record.id, record.value);
  return [...values.values()];
}
async function verifyRecords(
  metadata: ScanDocument,
  pages: ReadinessPageSet,
  artifact: EntryArtifact,
): Promise<void> {
  const known = new Map(scanRecords(metadata).map((record) => [record.id, record]));
  for (const record of pages.records) {
    const existing = known.get(record.id);
    if (existing !== undefined && !isDeepStrictEqual(existing, record.value)) {
      throw new Error('Entry query changed a current metadata record.');
    }
  }
  const parse = await scanValidator();
  const combined = parse({
    ...metadata,
    sources: family(metadata.sources, pages.records, 'source'),
    semantic: pages.records
      .filter((record) => record.kind === 'semantic_node' || record.kind === 'semantic_edge')
      .map((record) => record.value),
    summaries: family(metadata.summaries, pages.records, 'summary'),
    gaps: family(metadata.gaps, pages.records, 'gap'),
  });
  const published = new Map(scanRecords(combined).map((record) => [record.id, record]));
  if (pages.records.some((record) => !isDeepStrictEqual(published.get(record.id), record.value))) {
    throw new Error('Entry query includes records outside its public source projection.');
  }
  const scope = artifact.scopes[0]?.scope;
  if (
    scope === undefined ||
    combined.sources.some((source) => source.repo !== scope.repo || source.commit !== scope.commit)
  ) {
    throw new Error('Entry query records cross the pinned repository or commit.');
  }
}
function verifyReceipt(
  receipt: Readonly<Record<string, unknown>>,
  artifact: EntryArtifact,
): EntryArtifact['plans'][number] {
  const entry = readinessString(receipt.entry);
  const selected = artifact.plans.find((candidate) => candidate.plan.entry_id === entry);
  const matches = [
    receipt.format === 'spring-entry-query/v1',
    receipt.sourceCapture === artifact.capture,
    receipt.analysisFingerprint === artifact.analysisFingerprint,
    receipt.metadataChecksum === artifact.metadataChecksum,
    receipt.validatedWithPublicValidator === true,
    receipt.scope === 'selected-entry-source-only',
    receipt.completeness === 'partial',
    receipt.execution === 'source_reachability_runtime_unverified',
    isDeepStrictEqual(receipt.sourcePolicy, artifact.sourcePolicy),
  ];
  if (selected === undefined || !matches.every(Boolean)) {
    throw new Error('Entry query provenance does not match the current catalogue.');
  }
  if (
    !isDeepStrictEqual(receipt.frontiers, selected.plan.frontiers) ||
    nonnegative(receipt.omittedFrontiers) !== selected.plan.omitted_frontiers
  ) {
    throw new Error('Entry query frontiers differ from its current native plan.');
  }
  return selected;
}
async function queryOf(
  directory: string,
  artifact: EntryArtifact,
  metadata: ScanDocument,
): Promise<ReadinessQuery> {
  const receipt = readinessObject(await repositoryPassJson(path.join(directory, 'receipt.json')));
  const selected = verifyReceipt(receipt, artifact);
  const rawPages = await repositoryPassJson(path.join(directory, 'pages.json'));
  const plan = await repositoryPassJson(path.join(directory, 'plan.json'));
  if (
    sourceDigest(JSON.stringify(rawPages)) !== receipt.pagesChecksum ||
    sourceDigest(JSON.stringify(plan)) !== receipt.planChecksum ||
    !isDeepStrictEqual(plan, selected.plan)
  ) {
    throw new Error('Entry query pages or plan changed after publication.');
  }
  const limits = queryLimits(receipt);
  const pages = readinessQueryPages(rawPages, limits);
  const closure = readinessObject(receipt.recordClosure);
  if (
    nonnegative(closure.selected) !== pages.ids.length ||
    nonnegative(receipt.pages) !== pages.pages ||
    nonnegative(closure.rawBytes) !== pages.rawBytes
  ) {
    throw new Error(
      'Entry query selected records or measured sizes do not match actual responses.',
    );
  }
  const declared = readinessObject(receipt.limits);
  if (pages.rawBytes > readinessNumber(declared.maxRawRecordBytes)) {
    throw new Error('Entry query raw record bytes exceed its declared cap.');
  }
  await verifyRecords(metadata, pages, artifact);
  return {
    entryId: selected.plan.entry_id,
    artifactVerified: true,
    selectedRecords: pages.ids.length,
    returnedRecordIds: pages.ids,
    pages: pages.pages,
    bytes: pages.bytes,
    limits,
    missing: readinessArray(closure.missing).length,
    oversized: readinessArray(closure.oversized).length,
    omitted: nonnegative(closure.omitted) + nonnegative(receipt.omittedFrontiers),
  };
}

/** Read actual current catalogue/query publications; metrics never replace verified bounded responses. */
export async function readReadinessCatalogue(
  directory: string,
  queryDirectories: readonly string[],
): Promise<RepositoryReadinessInput['catalogue']> {
  const root = directoryFor(directory, 'catalogue.json');
  const artifact = await readEntryArtifact(root);
  await verifyEntryArtifact(artifact, await entryCliDigest());
  const parse = await scanValidator();
  const metadata = parse(await repositoryPassJson(path.join(root, 'metadata.json')));
  if (sourceDigest(JSON.stringify(metadata)) !== artifact.metadataChecksum) {
    throw new Error('Readiness catalogue metadata changed.');
  }
  const queries: ReadinessQuery[] = [];
  for (const query of queryDirectories) {
    queries.push(await queryOf(directoryFor(query, 'receipt.json'), artifact, metadata));
  }
  return {
    entries: artifact.catalogue.entries.map((entry) => ({
      id: entry.id,
      planEntryId:
        artifact.plans.find(
          (plan) => plan.plan.entry_id === entry.id && plan.binding_id === entry.binding_id,
        )?.plan.entry_id ?? '',
    })),
    queries,
  };
}
