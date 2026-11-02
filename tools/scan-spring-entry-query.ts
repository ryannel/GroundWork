import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { scanValidator } from '@/infrastructure/scan/scan-format';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import { bindingReviewPages } from './scan-bindings-pages';
import { entryArgument, verifyEntryArtifact, writeEntryJson } from './scan-entry-artifacts';
import { entryCliDigest } from './scan-entry-fingerprint';
import {
  entryQueryEvidence,
  prepareEntryQuery,
  projectEntrySources,
  type EntryQueryInput,
} from './scan-entry-query-input';
import { entryRecordClosure } from './scan-entry-record-closure';

/** Native facts are projected for the planned files only, then returned through bounded public record pages. */
export async function querySpringEntry(options: EntryQueryInput): Promise<void> {
  const started = performance.now();
  const { artifact, scopes, selected, metadata, sourceIDs, paths } =
    await prepareEntryQuery(options);
  const projection = await projectEntrySources({
    scopes,
    sources: sourceIDs,
    paths,
    options,
    maxSourceBytes: artifact.sourcePolicy.maxSourceBytes,
  });
  const { document, seeds } = entryQueryEvidence(metadata, projection, selected);
  const validate = await scanValidator();
  validate(document);
  const closure = entryRecordClosure(document, seeds, { maxRecords: 2048, maxBytes: 8_388_608 });
  const pages = bindingReviewPages(document, closure.ids);
  await verifyEntryArtifact(artifact, await entryCliDigest());
  await mkdir(options.output);
  await writeEntryJson(path.join(options.output, 'pages.json'), pages);
  await writeEntryJson(path.join(options.output, 'plan.json'), selected.plan);
  await writeEntryJson(path.join(options.output, 'receipt.json'), {
    format: 'spring-entry-query/v1',
    entry: options.entry,
    sourceCapture: artifact.capture,
    analysisFingerprint: artifact.analysisFingerprint,
    metadataChecksum: artifact.metadataChecksum,
    pagesChecksum: sourceDigest(JSON.stringify(pages)),
    planChecksum: sourceDigest(JSON.stringify(selected.plan)),
    scope: 'selected-entry-source-only',
    completeness: 'partial',
    validatedWithPublicValidator: true,
    recordClosure: {
      selected: closure.ids.length,
      missing: closure.missing,
      oversized: closure.oversized,
      omitted: closure.omitted,
      rawBytes: closure.bytes,
    },
    pages: pages.length,
    limits: {
      idsPerRequest: 32,
      recordsPerPage: 4,
      maxPageBytes: 65_536,
      maxTotalRecords: 2048,
      maxRawRecordBytes: 8_388_608,
    },
    frontiers: selected.plan.frontiers,
    omittedFrontiers: selected.plan.omitted_frontiers,
    statistics: projection.statistics,
    semanticDiagnostics: projection.semanticDiagnostics,
    sourcePolicy: artifact.sourcePolicy,
    elapsedMs: performance.now() - started,
    execution: 'source_reachability_runtime_unverified',
  });
}

function argumentsOf(args: readonly string[]): EntryQueryInput {
  if (args.length !== 5) {
    throw new Error(
      'Usage: scan-spring-entry-query <catalogue-dir> <entry-id> <clone-root> <cache> <NEW-output>',
    );
  }
  return {
    catalogue: entryArgument(args, 0),
    entry: entryArgument(args, 1),
    cloneRoot: entryArgument(args, 2),
    cache: entryArgument(args, 3),
    output: entryArgument(args, 4),
  };
}
if (process.argv[1] === import.meta.filename) {
  await querySpringEntry(argumentsOf(process.argv.slice(2)));
}
