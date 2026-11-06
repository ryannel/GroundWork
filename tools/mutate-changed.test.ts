import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  mutationBatches,
  mutationPassed,
  mutationReportScore,
  mutationTargets,
} from './mutate-changed';

const file = 'src/domain/ids.ts';
const other = 'src/domain/code-links.ts';
function report(statuses: readonly string[] = ['Killed', 'Survived']) {
  return {
    schemaVersion: '1.0',
    config: { mutate: [file], thresholds: { break: 75 } },
    files: {
      [file]: {
        source: readFileSync(file, 'utf8'),
        mutants: statuses.map((status, index) => ({ id: String(index), status })),
      },
    },
  };
}
describe('whole-file mutation scope', () => {
  it('maps changed tests to the complete source file and removes duplicates and irrelevant paths', () => {
    expect(
      mutationTargets([
        file,
        'src/domain/ids.test.ts',
        'src/ui/no.ts',
        'src/domain/missing.ts',
        'src/domain/foo.generated.ts',
      ]),
    ).toEqual([file]);
  });
  it('partitions each whole file exactly once and balances deterministically', () => {
    const files = [file, other, 'src/application/plan/ids.ts'];
    const batches = mutationBatches(files, 2);
    expect(batches).toHaveLength(2);
    expect(
      batches.flatMap((batch) => batch.files).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(files.toSorted((left, right) => left.localeCompare(right)));
    expect(mutationBatches(files.toReversed(), 2)).toEqual(batches);
    expect(mutationBatches([])).toEqual([]);
  });
  it('fails when Git cannot establish the scope', () => {
    const result = spawnSync(
      process.execPath,
      [path.join(import.meta.dirname, 'mutate-changed.ts'), '--matrix'],
      { cwd: tmpdir(), encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr.toLowerCase()).toContain('not a git repository');
  });
});
describe('complete weighted mutation reports', () => {
  it('uses Stryker status semantics, including uncovered code as undetected', () => {
    expect(
      mutationReportScore(
        report([
          'Killed',
          'Timeout',
          'Survived',
          'NoCoverage',
          'CompileError',
          'RuntimeError',
          'Ignored',
        ]),
        [file],
        75,
      ),
    ).toEqual({ detected: 2, undetected: 2 });
  });
  it('weights mutant counts rather than averaging batch percentages', () => {
    expect(
      mutationPassed(
        [
          { detected: 1, undetected: 0 },
          { detected: 0, undetected: 9 },
        ],
        75,
      ),
    ).toBe(false);
    expect(mutationPassed([{ detected: 75, undetected: 25 }], 75)).toBe(true);
    expect(mutationPassed([{ detected: 74, undetected: 26 }], 75)).toBe(false);
    expect(mutationPassed([], 75)).toBe(true);
  });
  it('allows completed zero-mutant scopes recorded by Stryker', () => {
    expect(mutationReportScore({ ...report(), files: {} }, [file], 75)).toEqual({
      detected: 0,
      undetected: 0,
    });
  });
  it.each(['Pending', 'NewStatus'])('rejects unfinished or unknown status %s', (status) => {
    expect(() => mutationReportScore(report([status]), [file], 75)).toThrow('Incomplete');
  });
  it('rejects duplicate mutants', () => {
    const value = report();
    value.files[file].mutants[1]!.id = '0';
    expect(() => mutationReportScore(value, [file], 75)).toThrow('duplicated');
  });
  it('rejects partial, stale, additional or differently scoped results and weakened thresholds', () => {
    expect(() => mutationReportScore({}, [file], 75)).toThrow('completed');
    expect(() => mutationReportScore(report(), [other], 75)).toThrow('whole-file scope');
    expect(() => mutationReportScore(report(), [file], 80)).toThrow('threshold');
    const stale = report();
    stale.files[file].source = 'different revision';
    expect(() => mutationReportScore(stale, [file], 75)).toThrow('Stale');
    const extra = { ...report(), files: { [other]: { source: '', mutants: [] } } };
    expect(() => mutationReportScore(extra, [file], 75)).toThrow('Unexpected');
    expect(() =>
      mutationReportScore(
        { ...report(), config: { mutate: [file, file], thresholds: { break: 75 } } },
        [file],
        75,
      ),
    ).toThrow('whole-file scope');
  });
  it('rejects a missing batch or report in the native aggregate command', () => {
    const result = spawnSync(
      process.execPath,
      [
        path.join(import.meta.dirname, 'mutate-changed.ts'),
        '--aggregate',
        path.join(tmpdir(), 'missing-mutation-reports'),
        '--base',
        'origin/main',
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
  });
});
