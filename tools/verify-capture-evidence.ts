import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { captureProofInput } from './capture-proof-fixture';

const root = process.argv[2];
if (root === undefined) {
  throw new Error('Pass the local clone root containing volvo-cars/<repository>');
}
const { bundle } = await captureProofInput();
const evidence = bundle.records.filter((record) => record.kind === 'evidence');
const issues: string[] = [];
for (const record of evidence) {
  const repo = path.resolve(root, record.repo);
  const result = spawnSync('git', ['-C', repo, 'show', `${record.commit}:${record.path}`], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) issues.push(`${record.id}: pinned source unavailable`);
  else if (result.stdout.trimEnd().split('\n').length < record.lines[1]) {
    issues.push(`${record.id}: range outside source`);
  }
}
console.log(
  JSON.stringify(
    {
      checked: evidence.length,
      issues,
      note: 'Checks source existence and ranges; does not prove extraction semantics or execute Java tests.',
    },
    null,
    2,
  ),
);
if (issues.length > 0) process.exitCode = 1;
