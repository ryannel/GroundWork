import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { Gap, GraphqlDocumentBinding, Source } from '@/domain/scan/scan.generated';
import { graphqlDocumentBindings } from '@/infrastructure/scan/graphql-document-bindings';
import { configurationResourceBindings } from '@/infrastructure/scan/spring-configuration-resources';
import type { ConfigurationBinding } from '@/infrastructure/scan/spring-configuration-types';

import {
  repositoryGit,
  repositoryInventory,
  type RepositoryFile,
} from './scan-repository-inventory';

const LIMIT = 1_048_576;
export interface ResourceOptions {
  readonly capture: string;
  readonly cloneRoot: string;
  readonly baseline: { readonly repo: string; readonly commit: string };
}
interface ResourceStatistics {
  readonly metadataSizeReads: number;
  readonly blobReads: number;
  readonly retainedCacheHits: number;
}

async function resourceBytes(
  repository: string,
  cache: string,
  file: RepositoryFile,
): Promise<{ readonly bytes: Buffer; readonly cached: boolean }> {
  try {
    const metadata = await stat(cache);
    if (!metadata.isFile() || metadata.size > LIMIT) {
      throw new Error('Invalid retained Spring resource.');
    }
    const bytes = await readFile(cache);
    const digest = createHash(file.blob.length === 64 ? 'sha256' : 'sha1')
      .update(`blob ${String(bytes.length)}\0`)
      .update(bytes)
      .digest('hex');
    if (digest !== file.blob) {
      throw new Error('Retained Spring resource does not match pinned Git blob.');
    }
    return { bytes, cached: true };
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    return { bytes: repositoryGit(repository, ['cat-file', 'blob', file.blob]), cached: false };
  }
}

interface ResourceResult<T = GraphqlDocumentBinding> {
  readonly bindings: readonly T[];
  readonly sources: readonly Source[];
  readonly gaps: readonly Gap[];
  readonly statistics: ResourceStatistics;
}

async function loadResource(
  options: ResourceOptions,
  repository: string,
  context: {
    readonly file: RepositoryFile;
    readonly project: typeof graphqlDocumentBindings | typeof configurationResourceBindings;
  },
): Promise<ResourceResult<GraphqlDocumentBinding | ConfigurationBinding>> {
  const { file, project } = context;
  const size = Number(
    repositoryGit(repository, ['cat-file', '-s', file.blob]).toString('utf8').trim(),
  );
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Invalid Spring Git object size.');
  if (size > LIMIT) {
    return {
      bindings: [],
      sources: [],
      gaps: [
        {
          kind: 'gap',
          id: `gap:spring-resource-size:${file.blob}:${createHash('sha256').update(file.path).digest('hex').slice(0, 16)}`,
          reason: 'unsupported',
          description: `${file.path} exceeds the one MiB Spring resource limit; bytes were not read.`,
        },
      ],
      statistics: { metadataSizeReads: 1, blobReads: 0, retainedCacheHits: 0 },
    };
  }
  const resource = await resourceBytes(
    repository,
    path.join(options.capture, 'ancillary', `${file.blob}.txt`),
    file,
  );
  const content = resource.bytes.toString('utf8');
  if (
    resource.bytes.length !== size ||
    resource.bytes.includes(0) ||
    !Buffer.from(content).equals(resource.bytes)
  ) {
    throw new Error('Spring resource is not pinned UTF-8 text.');
  }
  const projected = project({
    ...options.baseline,
    blob: file.blob,
    path: file.path,
    content,
  });
  return {
    ...projected,
    statistics: {
      metadataSizeReads: 1,
      blobReads: Number(!resource.cached),
      retainedCacheHits: Number(resource.cached),
    },
  };
}

/** Inventory the pinned Git tree; capture manifests cannot add or substitute resource evidence. */
async function springResources(
  options: ResourceOptions,
  configuration: boolean,
): Promise<ResourceResult<GraphqlDocumentBinding | ConfigurationBinding>> {
  if (!/^[a-f\d]{40,64}$/u.test(options.baseline.commit)) {
    throw new Error('Expected pinned resource commit.');
  }
  if (!/^[\w.-]+\/[\w.-]+$/u.test(options.baseline.repo)) {
    throw new Error('Expected organisation/repository resource identity.');
  }
  if (options.baseline.repo.split('/').some((segment) => ['.', '..'].includes(segment))) {
    throw new Error('Resource repository must stay within the clone root.');
  }
  if (options.baseline.repo.split('/').some((part) => ['.', '..'].includes(part))) {
    throw new Error('Expected organisation/repository resource identity.');
  }
  const repository = path.join(options.cloneRoot, options.baseline.repo);
  const inventory = repositoryInventory(repository, options.baseline.commit);
  const files = inventory.files.filter(
    (file) =>
      file.category !== 'non-regular' &&
      (configuration
        ? /(?:^|\/)src\/main\/resources\/application(?:-[^/]+)?\.ya?ml$/u
        : /(?:^|\/)src\/main\/resources\/graphql-documents\/[^/]+\.graphql$/u
      ).test(file.path),
  );
  const parts: ResourceResult<GraphqlDocumentBinding | ConfigurationBinding>[] = [];
  for (const file of files) {
    parts.push(
      await loadResource(options, repository, {
        file,
        project: configuration ? configurationResourceBindings : graphqlDocumentBindings,
      }),
    );
  }
  return {
    bindings: parts.flatMap((part) => part.bindings),
    sources: parts.flatMap((part) => part.sources),
    gaps: parts.flatMap((part) => part.gaps),
    statistics: {
      metadataSizeReads: parts.reduce(
        (total, part) => total + part.statistics.metadataSizeReads,
        0,
      ),
      blobReads: parts.reduce((total, part) => total + part.statistics.blobReads, 0),
      retainedCacheHits: parts.reduce(
        (total, part) => total + part.statistics.retainedCacheHits,
        0,
      ),
    },
  };
}

export async function springGraphqlResources(options: ResourceOptions): Promise<ResourceResult> {
  const result = await springResources(options, false);
  return {
    ...result,
    bindings: result.bindings.filter(
      (binding): binding is GraphqlDocumentBinding => binding.kind === 'graphql_document_binding',
    ),
  };
}

/** Read only selected application YAML resources from the pinned Git tree. */
export async function springConfigurationResources(
  options: ResourceOptions,
): Promise<ResourceResult<ConfigurationBinding>> {
  const result = await springResources(options, true);
  return {
    ...result,
    bindings: result.bindings.filter(
      (binding): binding is ConfigurationBinding => binding.kind === 'configuration_binding',
    ),
  };
}
