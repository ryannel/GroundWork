import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type {
  Gap,
  GraphqlDocumentBinding,
  LocalSummary,
  SemanticRecord,
  Source,
  SourceBaseline,
} from '@/domain/scan/scan.generated';
import { javaDeclarations, type JavaUnit } from '@/infrastructure/scan/java-declarations';
import { readScanScope, type ScanScope } from '@/infrastructure/scan/scan-scope';
import { runScopedSources, type ScopedSources } from '@/infrastructure/scan/scoped-source-store';
import type { SourceIndex } from '@/infrastructure/scan/source-index-types';
import type { ConfigurationBinding } from '@/infrastructure/scan/spring-configuration-types';

import { bindingEvidence, missingEvidenceSelectors } from './scan-binding-evidence';
import { springConfigurationResources, springGraphqlResources } from './scan-spring-resources';

interface BindingInputs {
  readonly resourceBindings?: readonly (GraphqlDocumentBinding | ConfigurationBinding)[];
  readonly resourceStatistics?: {
    readonly metadataSizeReads: number;
    readonly blobReads: number;
    readonly retainedCacheHits: number;
  };
  readonly indexes: readonly SourceIndex[];
  readonly semantic: readonly SemanticRecord[];
  readonly summaries: readonly LocalSummary[];
  readonly gaps: readonly Gap[];
  readonly units: readonly JavaUnit[];
  readonly sources: readonly Source[];
  readonly baselines: readonly SourceBaseline[];
  readonly statistics: readonly {
    readonly scope: string;
    readonly stats: ScopedSources['stats'];
  }[];
}
interface BindingOptions {
  readonly capture: string;
  readonly cloneRoot: string;
  readonly cache: string;
  readonly evidenceMethods?: readonly string[];
  readonly maxSourceBytes?: number;
}

async function bindingScopes(capture: string): Promise<readonly ScanScope[]> {
  const entries = await readdir(capture);
  const directories = entries
    .filter((name) => /^repository-\d+$/u.test(name))
    .toSorted((left, right) => left.localeCompare(right));
  if (directories.length === 0) throw new Error('No repository scopes found.');
  const scopes = await Promise.all(
    directories.map(async (directory) =>
      readScanScope(path.join(capture, directory, 'scope.json')),
    ),
  );
  const first = scopes[0];
  if (first === undefined) throw new Error('No repository scopes found.');
  if (scopes.some((scope) => scope.repo !== first.repo || scope.commit !== first.commit)) {
    throw new Error('Spring binding scopes must share one repository and commit.');
  }
  return scopes;
}

async function scopeInputs(scope: ScanScope, options: BindingOptions): Promise<BindingInputs> {
  const result = await runScopedSources(scope, {
    authority: scope.workspace,
    cloneRoot: options.cloneRoot,
    cacheDirectory: options.cache,
    ...(options.maxSourceBytes === undefined ? {} : { maxSourceBytes: options.maxSourceBytes }),
  });
  const production = result.sources.filter((entry) => `/${entry.file.path}`.includes('/src/main/'));
  const evidence = bindingEvidence(
    { ...result, sources: production },
    options.evidenceMethods ?? [],
  );
  return {
    indexes: production.map((entry) => entry.index),
    units: production.flatMap((entry) => {
      const unit = javaDeclarations(entry.index);
      return unit === null ? [] : [unit];
    }),
    ...evidence,
    sources: production.flatMap((entry) => entry.facts.sources),
    baselines: [result.baseline],
    statistics: [{ scope: scope.id, stats: result.stats }],
  };
}

function combineInputs(parts: readonly BindingInputs[]): BindingInputs {
  return {
    units: parts.flatMap((part) => part.units),
    indexes: parts.flatMap((part) => part.indexes),
    semantic: parts.flatMap((part) => part.semantic),
    summaries: parts.flatMap((part) => part.summaries),
    gaps: parts.flatMap((part) => part.gaps),
    sources: [
      ...new Map(
        parts.flatMap((part) => part.sources.map((source) => [source.id, source] as const)),
      ).values(),
    ],
    baselines: parts.flatMap((part) => part.baselines),
    statistics: parts.flatMap((part) => part.statistics),
  };
}

/** Validate every pinned scope before reading or parsing any repository source. */
export async function springBindingInputs(options: BindingOptions): Promise<BindingInputs> {
  const scopes = await bindingScopes(options.capture);
  const parts: BindingInputs[] = [];
  for (const scope of scopes) parts.push(await scopeInputs(scope, options));
  const combined = combineInputs(parts);
  const missing = missingEvidenceSelectors(combined.indexes, options.evidenceMethods ?? []);
  if (missing.length > 0) throw new Error(`Unmatched evidence selectors: ${missing.join(', ')}`);
  const baseline = combined.baselines[0];
  if (baseline === undefined) throw new Error('Missing source baseline for resource selection.');
  const resources = await springGraphqlResources({ ...options, baseline });
  const configuration = await springConfigurationResources({ ...options, baseline });
  return {
    ...combined,
    resourceBindings: [...resources.bindings, ...configuration.bindings],
    resourceStatistics: {
      metadataSizeReads:
        resources.statistics.metadataSizeReads + configuration.statistics.metadataSizeReads,
      blobReads: resources.statistics.blobReads + configuration.statistics.blobReads,
      retainedCacheHits:
        resources.statistics.retainedCacheHits + configuration.statistics.retainedCacheHits,
    },
    sources: [...combined.sources, ...resources.sources, ...configuration.sources],
    gaps: [...combined.gaps, ...resources.gaps, ...configuration.gaps],
  };
}
