import 'server-only';

import { extractLocalFacts, type ExtractionContext, type LocalFacts } from './local-facts';
import { createIndexCache, type IndexStats } from './source-cache';
import { sourceDigest } from './source-index';
import type { SourceIndex, SourceInput } from './source-index-types';

interface PipelineStats extends IndexStats {
  readonly extractions: number;
  readonly summaryHits: number;
}
interface SourcePipeline {
  readonly run: (
    input: SourceInput,
    context: ExtractionContext,
  ) => {
    readonly index: SourceIndex;
    readonly facts: LocalFacts;
  };
  readonly stats: () => PipelineStats;
}

/** Semantic cache includes rule and context versions; parse reuse remains independent. */
export function createSourcePipeline(scope: string): SourcePipeline {
  const cache = createIndexCache(scope);
  const summaries = new Map<string, LocalFacts>();
  const counters = { extractions: 0, summaryHits: 0 };
  return {
    run(input, context) {
      const index = cache.index(input);
      const key = sourceDigest(
        JSON.stringify([
          scope,
          index.digest,
          index.parser,
          index.path,
          index.options,
          context,
          'local-facts/v2/framework-v1',
        ]),
      );
      const previous = summaries.get(key);
      if (previous) {
        counters.summaryHits += 1;
        return { index, facts: structuredClone(previous) };
      }
      const facts = extractLocalFacts(index, context);
      counters.extractions += 1;
      if (index.nodes.length > 0) summaries.set(key, facts);
      return { index, facts: structuredClone(facts) };
    },
    stats: () => ({ ...cache.stats(), ...counters }),
  };
}
