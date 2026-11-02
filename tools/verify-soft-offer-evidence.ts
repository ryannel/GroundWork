import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { softOfferInput } from './soft-offer-proof-fixture';

function isObject(input: unknown): input is Readonly<Record<string, unknown>> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}
function sourceLocks(input: unknown): ReadonlyMap<string, string> {
  if (!Array.isArray(input)) throw new Error('Expected source-lock array');
  const result = new Map<string, string>();
  for (const item of input) {
    if (!isObject(item) || typeof item.evidence !== 'string' || typeof item.sha256 !== 'string') {
      throw new Error('Invalid evidence lock');
    }
    result.set(item.evidence, item.sha256);
  }
  return result;
}
const root = process.argv[2];
if (root === undefined) throw new Error('Pass clone root containing volvo-cars/<repository>');
const locks = sourceLocks(
  JSON.parse(await readFile('docs/scan-trials/soft-offer-proof/source-lock.json', 'utf8')),
);
const { bundle } = await softOfferInput();
const evidence = bundle.records.filter((record) => record.kind === 'evidence');
const issues: string[] = [];
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
  const hash = createHash('sha256').update(excerpt).digest('hex');
  if (record.lines[1] > lines.length || hash !== locks.get(record.id)) {
    issues.push(`${record.id}: source range or digest mismatch`);
  }
}
console.log(
  JSON.stringify(
    {
      checked: evidence.length,
      issues,
      note: 'Pinned source and range digests checked; no API, database, broker or C# test was executed.',
    },
    null,
    2,
  ),
);
if (issues.length > 0) process.exitCode = 1;
