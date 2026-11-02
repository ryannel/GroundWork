import { describe, expect, it, vi } from 'vitest';

import { csharpProgramInputs, resolvedCsharpProgramInputs } from './scan-csharp-program';

vi.mock(import('server-only'), () => ({}));

describe('explicit C# program aggregation manifest', () => {
  const input = {
    format: 'scan-csharp-program-inputs/v1',
    cloneRoot: '/clones',
    cacheDirectory: '/cache',
    shards: ['source-a/generation', 'source-b/generation'],
  };
  it('retains explicit shard selections and compiler/source cache roots', () => {
    expect(csharpProgramInputs(input)).toEqual(input);
  });
  it('rejects unknown fields, empty selections, invalid paths and unbounded shard counts', () => {
    expect(() => csharpProgramInputs({ ...input, queue: 'all' })).toThrow(/Unknown/u);
    expect(() => csharpProgramInputs({ ...input, shards: [] })).toThrow(/one to sixteen/u);
    expect(() => csharpProgramInputs({ ...input, shards: [''] })).toThrow(/paths/u);
    expect(() => csharpProgramInputs({ ...input, shards: [17] })).toThrow(/paths/u);
    expect(() =>
      csharpProgramInputs({ ...input, shards: Array.from({ length: 17 }, () => '/source') }),
    ).toThrow(/one to sixteen/u);
  });
  it('emits self-contained input paths that replay from a different publication folder', () => {
    const original = csharpProgramInputs({
      ...input,
      cloneRoot: '../clones',
      cacheDirectory: '../cache',
      shards: ['source-a/generation', 'source-b/generation'],
    });
    const resolved = resolvedCsharpProgramInputs(original, '/capture');
    expect(resolved).toEqual({
      ...input,
      cloneRoot: '/clones',
      cacheDirectory: '/cache',
      shards: ['/capture/source-a/generation', '/capture/source-b/generation'],
    });
    const serialised = JSON.stringify(resolved);
    const parsed: unknown = JSON.parse(serialised);
    expect(resolvedCsharpProgramInputs(csharpProgramInputs(parsed), '/different/output')).toEqual(
      resolved,
    );
  });
});
