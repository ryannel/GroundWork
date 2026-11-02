import 'server-only';

import type { Host, ScanDocument } from '@/domain/scan/scan.generated';

import { collectAspNetRoutes } from './aspnet-bindings';
import { csharpDiagnosticGaps } from './csharp-diagnostics';
import { collectCsharpSymbols } from './csharp-symbol-bindings';
import { sourceDigest } from './source-index';
import type { SourceIndex } from './source-index-types';

function unique<T extends { readonly id: string }>(values: readonly T[]): T[] {
  const records = new Map<string, T>();
  for (const value of values) {
    const existing = records.get(value.id);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new Error(`Conflicting shard record ${value.id}`);
    }
    records.set(value.id, value);
  }
  return [...records.values()];
}

/** Rebinds a bounded source program across published shards; never claims repository completeness. */
export function csharpProgramDocument(
  documents: readonly ScanDocument[],
  indexes: readonly SourceIndex[],
): ScanDocument {
  if (documents.length === 0 || indexes.length > 512) {
    throw new Error('C# program metadata needs published shards and at most 512 selected indexes.');
  }
  const sources = unique(documents.flatMap((document) => document.sources));
  const pins = new Set(sources.map((source) => `${source.repo}:${source.commit}`));
  if (pins.size !== 1) {
    throw new Error('C# program shards must share one pinned repository revision.');
  }
  const program = collectCsharpSymbols(indexes);
  const document: ScanDocument = {
    format: 'scan/v1',
    id: 'scan:csharp-program',
    sources,
    hosts: mergedHosts(documents),
    semantic: unique(documents.flatMap((entry) => entry.semantic ?? [])),
    framework: [...collectAspNetRoutes(indexes, program.signatures)],
    bindings: [...program.bindings],
    contracts: [...program.contracts],
    summaries: unique(documents.flatMap((entry) => entry.summaries)),
    gaps: unique([
      ...documents.flatMap((entry) =>
        entry.gaps.filter((gap) => !gap.id.startsWith('gap:csharp:compiler:')),
      ),
      ...csharpDiagnosticGaps(program.diagnostics, firstSource(sources)),
    ]),
    rules: unique(documents.flatMap((entry) => entry.rules)),
    derivations: unique(documents.flatMap((entry) => entry.derivations)),
    obligations: unique(documents.flatMap((entry) => entry.obligations)),
    receipts: unique(documents.flatMap((entry) => entry.receipts)),
    effects: unique(documents.flatMap((entry) => entry.effects)),
    actors: unique(documents.flatMap((entry) => entry.actors)),
    surfaces: unique(documents.flatMap((entry) => entry.surfaces)),
    controls: unique(documents.flatMap((entry) => entry.controls)),
    actions: unique(documents.flatMap((entry) => entry.actions)),
    outcomes: unique(documents.flatMap((entry) => entry.outcomes)),
    executions: unique(documents.flatMap((entry) => entry.executions)),
    journeys: unique(documents.flatMap((entry) => entry.journeys)),
    dependencies: unique(documents.flatMap((entry) => entry.dependencies)),
    closures: unique(documents.flatMap((entry) => entry.closures)),
  };
  return { ...document, id: `scan:csharp-program:${sourceDigest(JSON.stringify(document))}` };
}

function mergedHosts(documents: readonly ScanDocument[]): Host[] {
  const hosts = documents.flatMap((document) => document.hosts);
  return unique(
    hosts.map((host) => {
      const support = [
        ...new Set(
          hosts
            .filter((candidate) => candidate.id === host.id)
            .flatMap((candidate) => candidate.support),
        ),
      ];
      const [first, ...rest] = support;
      if (first === undefined) throw new Error('C# shard host needs source support.');
      return { ...host, support: [first, ...rest] };
    }),
  );
}

function firstSource(sources: ScanDocument['sources']): ScanDocument['sources'][number] {
  const source = sources[0];
  if (source === undefined) throw new Error('C# program needs pinned source evidence.');
  return source;
}
