import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import { queryRules, versionFormats } from '@/domain/knowledge/knowledge-versions';
import type { QueryRequest, QueryResponse } from '@/domain/knowledge/knowledge.generated';

import { supportingPage } from './query-support';

export function emptyResult(request: QueryRequest): QueryResponse {
  return {
    format: versionFormats(queryRules(request)).result,
    snapshot: request.snapshot,
    queryVersion: queryRules(request),
    request,
    nodes: [],
    edges: [],
    claims: [],
    evidence: [],
    coverage: [],
    frontiers: [],
    limitsHit: [],
    feasibility: 'not_checked',
    exhaustive: false,
    records: [],
    traversalComplete: true,
    findings: [],
  };
}

/** Preserve supporting records, including the link from each assertion to its evidence. */
export function completeResult(reader: KnowledgeReader, result: QueryResponse): QueryResponse {
  return supportingPage(reader, result);
}

export function attachCoverage(reader: KnowledgeReader, result: QueryResponse): QueryResponse {
  const entry = reader.get(result.request.entry);
  const owner = entry?.kind === 'subscription' ? entry.owner : result.request.entry;
  const coverage = reader
    .select('owner', owner)
    .filter((record) => record.kind === 'coverage')
    .map((record) => record.id);
  return { ...result, coverage };
}
