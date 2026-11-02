import { Buffer } from 'node:buffer';

import { createScanRecordReader } from '@/infrastructure/scan/record-pages';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import { scopedDocument } from '@/infrastructure/scan/scoped-document';
import { publishScopedScan } from '@/infrastructure/scan/scoped-publication';
import {
  runScopedSources,
  type ScopedSourceOptions,
} from '@/infrastructure/scan/scoped-source-store';

import { evaluateBenchmarkDepth } from './scan-benchmark-depth';
import { benchmarkEvidence } from './scan-benchmark-evidence';
import { evaluateDepthMutations } from './scan-depth-mutations';

interface TrialInput {
  readonly scope: ScanScope;
  readonly options: ScopedSourceOptions;
  readonly output: string;
  readonly publish: boolean;
}

function retrieval(document: ReturnType<typeof scopedDocument>) {
  const reader = createScanRecordReader(document);
  const ids = document.summaries
    .flatMap((summary) => summary.operations.map((operation) => operation.id))
    .slice(0, 16);
  const input = { ids, maxRecords: 4, maxBytes: 4096 };
  let page = reader.page(input);
  let bytes = Buffer.byteLength(JSON.stringify(page));
  let pages = 1;
  let deliveredRecords = page.records.length;
  while (page.nextCursor !== null && pages < 16) {
    page = reader.page({ ...input, cursor: page.nextCursor });
    bytes += Buffer.byteLength(JSON.stringify(page));
    pages += 1;
    deliveredRecords += page.records.length;
  }
  return {
    pages,
    bytes,
    selectedRecords: ids.length,
    deliveredRecords,
    limit: page.limit,
    complete: deliveredRecords === new Set(ids).size && page.limit !== 'oversized-record',
    continued: page.nextCursor !== null,
    scope: page.scope,
  };
}

interface BenchmarkTrial {
  readonly extractionMs: number;
  readonly elapsedMs: number;
  readonly cpuMicros: NodeJS.CpuUsage;
  readonly stats: Awaited<ReturnType<typeof runScopedSources>>['stats'];
  readonly baseline: Awaited<ReturnType<typeof runScopedSources>>['baseline'];
  readonly generation: string | null;
  readonly documentBytes: number;
  readonly parserDiagnostics: readonly { readonly path: string; readonly message: string }[];
  readonly summaries: number;
  readonly candidateCount: number;
  readonly semanticRecords: number;
  readonly validationMs: number;
  readonly mutationsMs: number;
  readonly mutations: ReturnType<typeof evaluateDepthMutations>;
  readonly evidenceRetrieval: ReturnType<typeof benchmarkEvidence>;
  readonly depth: ReturnType<typeof evaluateBenchmarkDepth>;
  readonly retrieval: ReturnType<typeof retrieval>;
  readonly runtimeModelCalls: number;
  readonly runtimeModelTokens: number;
}

export async function benchmarkTrial(input: TrialInput): Promise<BenchmarkTrial> {
  const started = performance.now();
  const cpu = process.cpuUsage();
  const result = await runScopedSources(input.scope, input.options);
  const extractedMs = performance.now() - started;
  const validationStarted = performance.now();
  const parse = await scanValidator();
  const document = parse(scopedDocument(input.scope, result));
  const validationMs = performance.now() - validationStarted;
  const depth = evaluateBenchmarkDepth(
    input.scope,
    document,
    result.sources.map((source) => source.index),
  );
  const mutationStarted = performance.now();
  const mutations = input.publish ? evaluateDepthMutations(input.scope, document) : [];
  const mutationsMs = input.publish ? performance.now() - mutationStarted : 0;
  const publication = input.publish
    ? await publishScopedScan(input.output, { scope: input.scope, result })
    : null;
  return {
    extractionMs: extractedMs,
    elapsedMs: performance.now() - started,
    cpuMicros: process.cpuUsage(cpu),
    stats: result.stats,
    baseline: result.baseline,
    generation: publication?.generation ?? null,
    documentBytes: Buffer.byteLength(JSON.stringify(document)),
    parserDiagnostics: result.sources.flatMap((source) =>
      source.index.diagnostics.map((message) => ({ path: source.file.path, message })),
    ),
    summaries: document.summaries.length,
    semanticRecords: document.semantic?.length ?? 0,
    validationMs,
    mutationsMs,
    mutations,
    evidenceRetrieval: benchmarkEvidence(document, depth),
    candidateCount: result.sources.reduce(
      (count, source) => count + source.facts.candidates.length,
      0,
    ),
    depth,
    retrieval: retrieval(document),
    runtimeModelCalls: 0,
    runtimeModelTokens: 0,
  };
}
