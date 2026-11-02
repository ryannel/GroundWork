import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';

import { runtimeProofInput } from './runtime-proof-fixture';

function lockEntry(value: unknown): readonly [string, string] {
  if (value === null || typeof value !== 'object') throw new Error('Expected evidence lock object');
  if (!('evidence' in value) || !('sha256' in value)) throw new Error('Incomplete evidence lock');
  if (typeof value.evidence !== 'string' || typeof value.sha256 !== 'string') {
    throw new TypeError('Invalid evidence lock');
  }
  return [value.evidence, value.sha256];
}
const name = process.argv[2];
const root = process.argv[3];
if ((name !== 'capture' && name !== 'soft-offer') || root === undefined) {
  throw new Error('Pass capture|soft-offer and clone root');
}
const document: unknown = JSON.parse(
  await readFile(`docs/scan-trials/${name}-proof/runtime/source-lock.json`, 'utf8'),
);
if (!Array.isArray(document)) throw new Error('Expected evidence lock array');
const locks = new Map(document.map(lockEntry));
const { bundle } = await runtimeProofInput(name);
const issues: string[] = [];
const evidence = bundle.records.filter((record) => record.kind === 'evidence');
for (const record of evidence) {
  const source = spawnSync(
    'git',
    ['-C', path.resolve(root, record.repo), 'show', `${record.commit}:${record.path}`],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (source.status !== 0) {
    issues.push(`${record.id}: pinned source unavailable`);
    continue;
  }
  const lines = source.stdout.split(/\r?\n/u);
  const excerpt = `${lines.slice(record.lines[0] - 1, record.lines[1]).join('\n')}\n`;
  const digest = createHash('sha256').update(excerpt).digest('hex');
  if (record.lines[1] > lines.length || digest !== locks.get(record.id)) {
    issues.push(`${record.id}: range digest mismatch`);
  }
  if (evidenceAnchor(record) === null) issues.push(`${record.id}: GitHub anchor missing`);
}
console.log(
  JSON.stringify(
    {
      proof: name,
      checked: evidence.length,
      issues,
      note: 'Pinned file ranges and derived GitHub anchors checked locally; no Volvo runtime was contacted.',
    },
    null,
    2,
  ),
);
if (issues.length > 0) process.exitCode = 1;
