import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  readCacheJson,
  readCachedIndex,
  readCachedSource,
  validateSourceIndex,
  writeCacheJson,
} from './scoped-source-cache';
import { indexSource } from './source-index';

vi.mock(import('server-only'), () => ({}));

const index = () =>
  indexSource({
    path: 'source.ts',
    content: 'function entry(input: string) { return input; }',
    language: 'typescript',
  });

describe('persistent source cache validation', () => {
  it('accepts compiler nodes including optional symbol, binding and exact field ranges', () => {
    const source = index();
    expect(validateSourceIndex(source)).toEqual(source);
    expect(source.nodes.some((node) => node.symbol === 'entry')).toBe(true);
  });

  it('rejects unknown fields, forged content digests and malformed nested offsets', () => {
    const source = index();
    const node = source.nodes[0];
    if (node === undefined) throw new Error('Expected syntax fixture.');
    expect(validateSourceIndex({ ...source, invented: true })).toBeNull();
    expect(validateSourceIndex({ ...source, content: 'forged' })).toBeNull();
    expect(validateSourceIndex({ ...source, nodes: [{ ...node, start: -1 }] })).toBeNull();
    expect(
      validateSourceIndex({ ...source, nodes: [{ ...node, end: source.content.length + 1 }] }),
    ).toBeNull();
    expect(validateSourceIndex({ ...source, nodes: [{ ...node, parent: 0 }] })).toBeNull();
    expect(
      validateSourceIndex({ ...source, nodes: [{ ...node, fields: { arguments: [[0, 999]] } }] }),
    ).toBeNull();
    expect(validateSourceIndex({ ...source, nodes: [{ ...node, binding: 999 }] })).toBeNull();
    expect(validateSourceIndex({ ...source, nodes: [{ ...node, lines: [2, 1] }] })).toBeNull();
  });

  it('preserves the prior cache when serialisation fails and rejects corrupted cache JSON', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'source-cache-'));
    try {
      const filename = path.join(directory, 'entry.json');
      await writeCacheJson(filename, { version: 1 });
      const circular: { self?: unknown } = {};
      circular.self = circular;
      await expect(writeCacheJson(filename, circular)).rejects.toThrow('circular');
      await expect(readCacheJson(filename)).resolves.toEqual({ version: 1 });
      await expect(readCacheJson(path.join(directory, 'absent.json'))).resolves.toBeNull();
      await expect(readCachedSource(filename, 'a'.repeat(40))).resolves.toBeNull();
      await expect(
        readCachedIndex(filename, {
          blob: 'a'.repeat(40),
          parser: 'parser',
          language: 'typescript',
        }),
      ).resolves.toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
