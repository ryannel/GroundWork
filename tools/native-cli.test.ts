// Direct Node commands must keep working without the app loader, including from another folder.
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

it.each(['permalink', 'sources'])('runs the standalone %s command outside the checkout', (name) => {
  const result = spawnSync(process.execPath, [path.join(import.meta.dirname, `${name}.ts`)], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(2);
  expect(result.stderr).toContain('usage:');
  expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
});

function sourceIndex(fixture: string, ...flags: readonly string[]): unknown {
  const tools = import.meta.dirname;
  const result = spawnSync(
    process.execPath,
    [
      path.join(tools, 'sources.ts'),
      path.join(tools, '..', 'test', 'fixtures', fixture),
      '--index',
      ...flags,
    ],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  expect(result.status, result.stderr).toBe(0);
  const facts: unknown = JSON.parse(result.stdout);
  return facts;
}

it('reports the real consolidated Acme source pins and keeps uncited records visible', () => {
  const facts = sourceIndex('acme-model');
  expect(facts).toHaveLength(96);
  expect(facts).toContainEqual({
    id: 'svc:products',
    cites: [
      {
        kind: 'code',
        repo: 'acme/products',
        path: 'cmd/products/main.go',
        commit: '4f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c',
        lines: [12, 80],
        symbol: 'main',
      },
    ],
    sources: [
      {
        repo: 'acme/products',
        path: 'cmd/products/main.go',
        commit: '4f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c',
        lines: [12, 80],
        symbol: 'main',
      },
    ],
    gaps: [],
  });
  expect(facts).toContainEqual({
    id: 'con:order',
    cites: [],
    sources: [],
    gaps: [
      {
        id: 'con:order',
        kind: 'no_code_source',
        message: 'No source citation is recorded.',
      },
    ],
  });
});

it('filters by repository while preserving evidence ids and qualified step spans', () => {
  const facts = sourceIndex('model', '--repo', 'example/orders');
  const pin = {
    repo: 'example/orders',
    path: 'apps/ordering/src/Confirm.ts',
    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
  expect(facts).toHaveLength(39);
  expect(facts).toContainEqual({
    id: 'con:order',
    cites: [{ kind: 'evidence', id: 'ev:source' }],
    sources: [{ ...pin, lines: [1, 80], symbol: 'Confirm' }],
    gaps: [],
  });
  expect(facts).toContainEqual({
    id: 'h:confirm#load',
    cites: [{ kind: 'code', ...pin, lines: [5, 7] }],
    sources: [{ ...pin, lines: [5, 7] }],
    gaps: [],
  });
});
