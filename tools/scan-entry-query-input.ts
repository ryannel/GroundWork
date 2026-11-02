import path from 'node:path';

import type { ScanDocument } from '@/domain/scan/scan.generated';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { parseScanScope, type ScanScope } from '@/infrastructure/scan/scan-scope';
import { runScopedSources, type ScopedSources } from '@/infrastructure/scan/scoped-source-store';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import type { EntryArtifact } from '@/infrastructure/scan/spring-entry-artifact-format';

import { bindingEvidence, missingEvidenceSourceIDs } from './scan-binding-evidence';
import { jsonFile, readEntryArtifact, verifyEntryArtifact } from './scan-entry-artifacts';
import { entryCliDigest } from './scan-entry-fingerprint';

export interface EntryQueryInput {
  readonly catalogue: string;
  readonly entry: string;
  readonly cloneRoot: string;
  readonly cache: string;
  readonly output: string;
  readonly maxSourceBytes?: number;
}
interface ProjectionInput {
  readonly scopes: readonly ScanScope[];
  readonly sources: readonly string[];
  readonly paths: ReadonlySet<string>;
  readonly options: EntryQueryInput;
  readonly maxSourceBytes: number;
}

interface ProjectedEntrySources {
  readonly evidence: ReturnType<typeof bindingEvidence>;
  readonly statistics: readonly {
    readonly scope: string;
    readonly selectedPaths: readonly string[];
    readonly stats: ScopedSources['stats'];
  }[];
  readonly sources: ScanDocument['sources'];
  readonly semanticDiagnostics: readonly {
    readonly path: string;
    readonly exactDuplicateEdges: number;
  }[];
}

/** Preserve the original scope id/cache namespace while selecting only the planned files and questions. */
export async function projectEntrySources(input: ProjectionInput): Promise<ProjectedEntrySources> {
  const parts: ScopedSources[] = [];
  const statistics: {
    readonly scope: string;
    readonly selectedPaths: readonly string[];
    readonly stats: ScopedSources['stats'];
  }[] = [];
  for (const original of input.scopes) {
    const files = original.files.filter((file) => input.paths.has(file.path));
    if (files.length === 0) continue;
    const scope = parseScanScope({
      ...original,
      files,
      questions: original.questions.filter((question) => input.paths.has(question.path)),
    });
    const part = await runScopedSources(scope, {
      authority: original.workspace,
      cloneRoot: input.options.cloneRoot,
      cacheDirectory: input.options.cache,
      maxSourceBytes: input.maxSourceBytes,
    });
    parts.push(part);
    statistics.push({
      scope: original.id,
      selectedPaths: files.map((file) => file.path),
      stats: part.stats,
    });
  }
  const sources = parts.flatMap((part) => part.sources);
  const missing = missingEvidenceSourceIDs(
    sources.map((source) => source.index),
    input.sources,
  );
  if (missing.length > 0) {
    throw new Error(`Missing native source identities: ${missing.join(', ')}`);
  }
  return {
    evidence: bindingEvidence({ sources }, [], input.sources),
    statistics,
    sources: sources.flatMap((source) => source.facts.sources),
    semanticDiagnostics: sources.flatMap((source) =>
      source.facts.semanticDiagnostics === undefined
        ? []
        : [
            {
              path: source.file.path,
              exactDuplicateEdges: source.facts.semanticDiagnostics.exactDuplicateEdges,
            },
          ],
    ),
  };
}

async function entryMetadata(directory: string, artifact: EntryArtifact): Promise<ScanDocument> {
  const parse = await scanValidator();
  const document = parse(await jsonFile(path.join(directory, 'metadata.json')));
  if (sourceDigest(JSON.stringify(document)) !== artifact.metadataChecksum) {
    throw new Error('Entry catalogue metadata checksum changed.');
  }
  return document;
}

interface PreparedEntryQuery {
  readonly artifact: EntryArtifact;
  readonly scopes: readonly ScanScope[];
  readonly selected: EntryArtifact['plans'][number];
  readonly metadata: ScanDocument;
  readonly sourceIDs: readonly string[];
  readonly paths: ReadonlySet<string>;
}
export async function prepareEntryQuery(options: EntryQueryInput): Promise<PreparedEntryQuery> {
  const artifact = await readEntryArtifact(options.catalogue);
  if (
    options.maxSourceBytes !== undefined &&
    options.maxSourceBytes !== artifact.sourcePolicy.maxSourceBytes
  ) {
    throw new Error('Query source policy conflicts with its catalogue.');
  }
  const scopes = await verifyEntryArtifact(artifact, await entryCliDigest());
  const selected = artifact.plans.find((entry) => entry.plan.entry_id === options.entry);
  if (!selected) throw new Error(`Unknown source entry ${options.entry}`);
  const metadata = await entryMetadata(options.catalogue, artifact);
  const sourceIDs = [...selected.plan.owner_source_ids, ...selected.plan.field_source_ids];
  const locations = new Map(
    artifact.source_locations.map((location) => [location.source_id, location.path]),
  );
  if (sourceIDs.some((source) => !locations.has(source))) {
    throw new Error('Native query plan has an unknown source location.');
  }
  const paths = new Set(
    sourceIDs.flatMap((source) => {
      const location = locations.get(source);
      return location === undefined ? [] : [location];
    }),
  );
  return { artifact, scopes, selected, metadata, sourceIDs, paths };
}

export function entryQueryEvidence(
  metadata: ScanDocument,
  projection: Awaited<ReturnType<typeof projectEntrySources>>,
  selected: EntryArtifact['plans'][number],
): { readonly document: ScanDocument; readonly seeds: readonly string[] } {
  const document = {
    ...metadata,
    id: `scan:entry:${sourceDigest(JSON.stringify([metadata.id, selected.plan]))}`,
    semantic: [...projection.evidence.semantic],
    summaries: [...projection.evidence.summaries],
    sources: [
      ...new Map(
        [...metadata.sources, ...projection.sources].map((source) => [source.id, source]),
      ).values(),
    ],
    gaps: [
      ...new Map(
        [...metadata.gaps, ...projection.evidence.gaps].map((gap) => [gap.id, gap]),
      ).values(),
    ],
  };
  const nativeSources = new Set(projection.evidence.semantic.map((record) => record.source));
  const selectedCalls = new Set(selected.plan.call_binding_ids);
  const callSources = new Set(
    (metadata.bindings ?? []).flatMap((record) =>
      record.kind === 'java_call_binding' && selectedCalls.has(record.id) ? [record.call] : [],
    ),
  );
  const values = (metadata.bindings ?? [])
    .filter((record) => record.kind === 'java_value_binding')
    .filter(
      (record) =>
        (record.call === null || callSources.has(record.call)) &&
        (nativeSources.has(record.from) || nativeSources.has(record.to)),
    );
  const seeds = [
    selected.binding_id,
    ...selected.plan.call_binding_ids,
    ...selected.plan.boundary_binding_ids,
    ...values.map((record) => record.id),
    ...projection.evidence.semantic.map((record) => record.id),
    ...projection.evidence.summaries.map((record) => record.id),
  ];
  return { document, seeds };
}
