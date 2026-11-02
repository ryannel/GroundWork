import { readFile } from 'node:fs/promises';

import type {
  KnowledgeBundle,
  KnowledgeSnapshot,
  QueryRequest,
} from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

export async function captureProofInput(): Promise<{
  readonly bundle: KnowledgeBundle;
  readonly manifest: KnowledgeSnapshot;
}> {
  const parse = await knowledgeValidators();
  const bundle = parse.bundle(
    JSON.parse(await readFile('docs/scan-trials/capture-proof/bundle.json', 'utf8')),
  );
  const manifest = parse.snapshot(
    JSON.parse(await readFile('docs/scan-trials/capture-proof/snapshot.json', 'utf8')),
  );
  return { bundle, manifest };
}

export function captureRequest(
  snapshot: string,
  options: Partial<QueryRequest> = {},
): QueryRequest {
  return {
    format: 'groundwork-query/v1',
    snapshot,
    query: 'trace',
    entry: 'r1/endpoint',
    value: null,
    context: [],
    outcome: null,
    changed: [],
    representation: 'constructed',
    candidates: 'exclude',
    maxNodes: 200,
    ...options,
  };
}
