import { isRecord } from '@/application/plan/ids';

import type { Difference } from './snapshots';

interface Allowance extends Difference {
  readonly workspace: string;
  readonly reason: string;
}

/** Only exact reviewed changes are allowed; malformed approvals fail closed. */
export function allowancesOf(value: unknown): readonly Allowance[] {
  if (!isRecord(value) || value.format !== 1 || !Array.isArray(value.differences)) {
    throw new Error('Expected allowed-diffs format: 1 and differences: [].');
  }
  return value.differences.map((row) => {
    if (!isRecord(row)) throw new Error('An allowed difference must be a record.');
    const { workspace, file, path, before, after, reason } = row;
    const strings: readonly unknown[] = [workspace, file, path, before, after, reason];
    if (!strings.every((part) => typeof part === 'string')) {
      throw new Error(
        'An allowed difference needs workspace, file, path, before, after and reason.',
      );
    }
    if (typeof workspace !== 'string' || typeof file !== 'string' || typeof path !== 'string') {
      throw new TypeError('Invalid difference location.');
    }
    if (typeof before !== 'string' || typeof after !== 'string' || typeof reason !== 'string') {
      throw new TypeError('Invalid difference proof.');
    }
    if (reason.trim() === '') throw new Error('An allowed difference needs a reason.');
    return { workspace, file, path, before, after, reason };
  });
}

export function unexplained(
  workspace: string,
  changes: readonly Difference[],
  allowances: ReturnType<typeof allowancesOf>,
): readonly Difference[] {
  const key = (difference: Difference): string =>
    JSON.stringify([difference.file, difference.path, difference.before, difference.after]);
  const approved = new Set(
    allowances.filter((allowed) => allowed.workspace === workspace).map(key),
  );
  return changes.filter((change) => !approved.has(key(change)));
}
