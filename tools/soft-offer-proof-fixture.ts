import { readFile } from 'node:fs/promises';

import type {
  KnowledgeBundle,
  KnowledgeSnapshot,
  QueryRequest,
} from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

export async function softOfferInput(): Promise<{
  readonly bundle: KnowledgeBundle;
  readonly manifest: KnowledgeSnapshot;
}> {
  const parse = await knowledgeValidators();
  const directory = 'docs/scan-trials/soft-offer-proof';
  return {
    bundle: parse.bundle(JSON.parse(await readFile(`${directory}/bundle.json`, 'utf8'))),
    manifest: parse.snapshot(JSON.parse(await readFile(`${directory}/snapshot.json`, 'utf8'))),
  };
}

export function softOfferRequest(
  snapshot: string,
  options: Partial<QueryRequest> = {},
): QueryRequest {
  return {
    format: 'groundwork-query/v2',
    snapshot,
    query: 'continuations',
    entry: 's2/endpoint',
    value: null,
    context: [],
    outcome: null,
    changed: [],
    representation: 'constructed',
    candidates: 'exclude',
    maxNodes: 200,
    maxRecords: 2000,
    environment: 'production-profile',
    ids: [],
    ...options,
  };
}
