import 'server-only';

import path from 'node:path';

import type { SourceBaseline } from '@/domain/scan/scan.generated';

import { extractLocalFacts, type LocalFacts } from './local-facts';
import type { ScanScope, ScopeFile } from './scan-scope';
import {
  readCachedIndex,
  readCachedSource,
  validateSourceIndex,
  writeCacheJson,
} from './scoped-source-cache';
import { pinnedMetadata, readPinnedSource } from './scoped-source-git';
import { scopedFingerprint, type ScopedProvenanceOptions } from './scoped-source-provenance';
import { assertSourceBudget, sourceByteLimit } from './source-budget';
import { indexSource, sourceDigest } from './source-index';
import type { SourceIndex, SourceInput } from './source-index-types';

export interface ScopedSourceOptions extends ScopedProvenanceOptions {
  readonly cloneRoot: string;
  readonly cacheDirectory: string;
}
export interface ScopedSourceStats {
  readonly blobReads: number;
  readonly parsedFiles: number;
  readonly indexHits: number;
  readonly reusedFiles: number;
  readonly sourceBytes: number;
}
interface ScopedSource {
  readonly file: ScopeFile;
  readonly index: SourceIndex;
  readonly facts: LocalFacts;
  readonly blob: string;
}
export interface ScopedSources {
  readonly sources: readonly ScopedSource[];
  readonly stats: ScopedSourceStats;
  readonly baseline: SourceBaseline;
}
interface StoreContext {
  readonly scope: ScanScope;
  readonly options: ScopedSourceOptions;
  readonly repository: string;
  readonly directory: string;
  readonly ruleDigest: string;
  readonly parsers: ReadonlyMap<SourceInput['language'], string>;
}

function sourceInput(file: ScopeFile, options: ScopedSourceOptions): SourceInput {
  return {
    path: file.path,
    language: file.language,
    content: '',
    ...(options.java === undefined ? {} : { java: options.java }),
    ...(options.go === undefined ? {} : { go: options.go }),
  };
}

async function persistIndex(
  index: SourceIndex,
  cache: {
    readonly filename: string;
    readonly sourceFile: string;
    readonly parser: string;
    readonly blob: string;
  },
): Promise<void> {
  if (validateSourceIndex(index) === null) {
    throw new Error('Parser returned an invalid source index.');
  }
  if (!index.parser.endsWith('/unavailable')) {
    await writeCacheJson(cache.filename, {
      format: 'scoped-source/v1',
      parser: cache.parser,
      index,
    });
  }
  await writeCacheJson(cache.sourceFile, { blob: cache.blob, content: index.content });
}

async function sourceAt(
  context: StoreContext,
  file: ScopeFile,
  blob: string,
): Promise<{
  readonly source: ScopedSource;
  readonly stats: ScopedSourceStats;
  readonly parser: string;
}> {
  const input = sourceInput(file, context.options);
  const parser = context.parsers.get(file.language) ?? 'unavailable';
  const key = sourceDigest(JSON.stringify([blob, input.language, path.extname(file.path), parser]));
  const filename = path.join(context.directory, 'indexes', `${key}.json`);
  const cached = await readCachedIndex(filename, { parser, blob, language: file.language });
  let index = cached;
  let blobReads = 0;
  if (index === null) {
    const sourceFile = path.join(context.directory, 'sources', `${blob}.json`);
    let content = await readCachedSource(sourceFile, blob);
    if (content === null) {
      content = readPinnedSource(context.repository, blob);
      blobReads = 1;
    }
    index = indexSource({ ...input, content });
    await persistIndex(index, { filename, sourceFile, parser, blob });
  }
  const rebased = { ...index, path: file.path };
  const hostDigest = sourceDigest([context.scope.repo, file.environment].join(':')).slice(0, 16);
  const facts = extractLocalFacts(rebased, {
    host: `host:${hostDigest}`,
    repo: context.scope.repo,
    commit: context.scope.commit,
    blob,
    ruleVersion: context.ruleDigest,
  });
  return {
    source: {
      file,
      blob,
      index: rebased,
      facts,
    },
    parser,
    stats: {
      blobReads,
      sourceBytes: blobReads === 0 ? 0 : Buffer.byteLength(index.content),
      parsedFiles: cached === null ? 1 : 0,
      indexHits: cached === null ? 0 : 1,
      reusedFiles: blobReads === 0 ? 1 : 0,
    },
  };
}

function totalStats(entries: readonly ScopedSourceStats[]): ScopedSourceStats {
  return entries.reduce(
    (total, entry) => ({
      blobReads: total.blobReads + entry.blobReads,
      parsedFiles: total.parsedFiles + entry.parsedFiles,
      indexHits: total.indexHits + entry.indexHits,
      reusedFiles: total.reusedFiles + entry.reusedFiles,
      sourceBytes: total.sourceBytes + entry.sourceBytes,
    }),
    { blobReads: 0, parsedFiles: 0, indexHits: 0, reusedFiles: 0, sourceBytes: 0 },
  );
}

/** Reads only the manifest's pinned files. Warm runs never ask Git for source bytes. */
export async function runScopedSources(
  scope: ScanScope,
  options: ScopedSourceOptions,
): Promise<ScopedSources> {
  if (scope.repo.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Repository must stay within the clone root.');
  }
  const repository = path.join(options.cloneRoot, scope.repo);
  const limit = sourceByteLimit(options.maxSourceBytes);
  const metadata = pinnedMetadata(repository, scope);
  for (const file of scope.files) {
    const blob = metadata.blobs.get(file.path);
    const bytes = metadata.sizes.get(file.path);
    if (blob === undefined || bytes === undefined) {
      throw new Error('Selected source metadata is missing.');
    }
    assertSourceBudget({ path: file.path, blob, bytes }, limit);
  }
  const fingerprint = scopedFingerprint(scope, options);
  const context = {
    scope,
    options,
    repository,
    directory: path.join(
      options.cacheDirectory,
      sourceDigest(JSON.stringify([options.authority, scope.repo, scope.id])),
    ),
    ruleDigest: fingerprint.provenance.ruleDigest,
    parsers: fingerprint.parsers,
  };
  const entries = await Promise.all(
    scope.files.map(async (file) => {
      const blob = metadata.blobs.get(file.path);
      if (blob === undefined) throw new Error('Selected blob metadata is missing.');
      return sourceAt(context, file, blob);
    }),
  );
  return {
    sources: entries.map((entry) => entry.source),
    stats: totalStats(entries.map((entry) => entry.stats)),
    baseline: {
      repo: scope.repo,
      commit: scope.commit,
      tree: metadata.tree,
      ref: scope.ref,
      ...fingerprint.provenance,
    },
  };
}
