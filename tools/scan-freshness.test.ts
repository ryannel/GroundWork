import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { fixtureCommit, fixtureRepository } from '@/infrastructure/scan/freshness-git-fixture';

vi.mock(import('server-only'), () => ({}));

const command = [
  '--import',
  './tools/register.ts',
  '--conditions=react-server',
  'tools/scan-freshness.ts',
];

describe('scan freshness command', () => {
  it('reports missing arguments with an error exit', () => {
    const result = spawnSync(process.execPath, command, { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: scan:freshness');
  });

  it('checks pinned source offline and labels the analysis provenance limitation', () => {
    const repository = fixtureRepository();
    try {
      const baseline = fixtureCommit(repository, { 'source.ts': 'original' });
      const baselinePath = path.join(repository, 'baseline.json');
      writeFileSync(baselinePath, JSON.stringify(baseline));
      const result = spawnSync(process.execPath, [...command, baselinePath, repository], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        verification: 'source-only',
        sourceUnchanged: true,
        freshness: {
          sourceCurrent: false,
          deploymentCurrent: 'unknown',
          observation: { source: 'local' },
        },
      });
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});
