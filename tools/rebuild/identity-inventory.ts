// The enforced runtime inventory is distinct from literal examples and references to the shared helpers.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { isRecord } from '@/application/plan/ids';

export interface IdentitySite {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}
function sitesIn(result: unknown): readonly IdentitySite[] {
  if (!isRecord(result) || typeof result.filePath !== 'string' || !Array.isArray(result.messages)) {
    return [];
  }
  const file = path.relative(process.cwd(), result.filePath);
  return result.messages.flatMap((value: unknown) => {
    if (!isRecord(value) || value.ruleId !== 'groundwork/identity-boundary') return [];
    if (typeof value.line !== 'number' || typeof value.message !== 'string') {
      throw new TypeError('Invalid identity diagnostic.');
    }
    return [{ file, line: value.line, message: value.message }];
  });
}
export function identitySites(): readonly IdentitySite[] {
  const result = spawnSync(
    process.execPath,
    ['node_modules/eslint/bin/eslint.js', 'src', 'tools', '--format', 'json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status === 2) throw new Error(result.stderr);
  const value: unknown = JSON.parse(result.stdout);
  if (!Array.isArray(value)) throw new Error('Invalid identity inventory.');
  return value.flatMap(sitesIn);
}
