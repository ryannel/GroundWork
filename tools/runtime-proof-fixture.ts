import { readFile } from 'node:fs/promises';

import type {
  KnowledgeBundle,
  KnowledgeSnapshot,
  QueryRequest,
} from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

export async function runtimeProofInput(
  name: 'capture' | 'soft-offer',
): Promise<{ readonly bundle: KnowledgeBundle; readonly manifest: KnowledgeSnapshot }> {
  const parse = await knowledgeValidators();
  const directory = `docs/scan-trials/${name}-proof/runtime`;
  return {
    bundle: parse.bundle(JSON.parse(await readFile(`${directory}/bundle.json`, 'utf8'))),
    manifest: parse.snapshot(JSON.parse(await readFile(`${directory}/snapshot.json`, 'utf8'))),
  };
}

export function runtimeRequest(
  name: 'capture' | 'soft-offer',
  snapshot: string,
  options: Partial<QueryRequest> = {},
): QueryRequest {
  return {
    format: 'groundwork-query/v3',
    snapshot,
    query: 'interactions',
    entry: name === 'capture' ? 'r1/endpoint' : 's2/endpoint',
    value: null,
    context: [],
    outcome: null,
    changed: [],
    representation: 'constructed',
    candidates: 'exclude',
    maxNodes: 200,
    maxRecords: 3000,
    environment: name === 'capture' ? 'source-profile' : 'production-profile',
    ids: [],
    ...options,
  };
}
