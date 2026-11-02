import 'server-only';

import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { recordIndexes, type KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';
import { verifyKnowledgeSelection } from '@/infrastructure/knowledge/knowledge-selection';

/** Read retained immutable captures only. This performs no repository scan or network observation. */
export async function retainedExplorerReader(input: {
  readonly bundlePath: string;
  readonly snapshotPath: string;
}): Promise<KnowledgeReader> {
  const [compressed, manifestBytes, parse] = await Promise.all([
    readFile(input.bundlePath),
    readFile(input.snapshotPath, 'utf8'),
    knowledgeValidators(),
  ]);
  const bundle = parse.bundle(JSON.parse(gunzipSync(compressed).toString('utf8')));
  const manifest = parse.snapshot(JSON.parse(manifestBytes));
  verifyKnowledgeSelection({ manifest, bundles: [bundle] });
  const records = new Map(bundle.records.map((record) => [record.id, record]));
  const indexes = new Map<string, KnowledgeRecord[]>();
  for (const record of bundle.records) {
    for (const [field, values] of recordIndexes(record)) {
      for (const value of values) {
        const key = `${field}\u0000${value}`;
        indexes.set(key, [...(indexes.get(key) ?? []), record]);
      }
    }
  }
  return {
    snapshot: manifest.id,
    rules: manifest.rules,
    get: (id) => {
      const record = records.get(id);
      return record === undefined ? undefined : structuredClone(record);
    },
    select: (field, value) => structuredClone(indexes.get(`${field}\u0000${value}`) ?? []),
  };
}
