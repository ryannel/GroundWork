import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { javaExecutable } from '@/infrastructure/scan/java-runtime';
import { parserIdentity } from '@/infrastructure/scan/source-cache';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('node:child_process'));
vi.mock(import('@/infrastructure/scan/java-runtime'), () => ({
  javaExecutable: vi.fn<typeof javaExecutable>(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(javaExecutable).mockImplementation((explicit) => explicit ?? '/managed/java25');
  vi.mocked(execFileSync).mockImplementation((_file, arguments_) =>
    arguments_?.includes('--version') === true
      ? 'openjdk 25.0.5'
      : JSON.stringify({ parser: 'javac/25.0.5', nodes: [], diagnostics: [] }),
  );
});

describe('effective Java executable provenance', () => {
  it.each([undefined, '/explicit/java17'])(
    'uses the same resolved executable for parsing and identity: %s',
    (java) => {
      const input = {
        content: 'class A {}',
        language: 'java' as const,
        path: 'A.java',
        ...(java === undefined ? {} : { java }),
      };
      expect(parserIdentity(input)).toContain(`${java ?? '/managed/java25'}:openjdk 25.0.5`);
      expect(indexSource(input).diagnostics).toEqual([]);
      expect(vi.mocked(execFileSync).mock.calls.map(([executable]) => executable)).toEqual([
        java ?? '/managed/java25',
        java ?? '/managed/java25',
      ]);
      expect(javaExecutable).toHaveBeenNthCalledWith(1, java);
      expect(javaExecutable).toHaveBeenNthCalledWith(2, java);
    },
  );

  it('changes parser identity when the adapter changes under the same runtime', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'groundwork-java-adapter-test-'));
    try {
      const adapter = path.join(directory, 'SourceIndex.java');
      writeFileSync(adapter, 'class SourceIndex {}');
      const input = {
        content: '',
        language: 'java' as const,
        path: 'A.java',
        adapterDirectory: directory,
      };
      const first = parserIdentity(input);
      writeFileSync(adapter, 'class SourceIndex { int changed; }');
      expect(parserIdentity(input)).not.toBe(first);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('changes parser identity when the actual runtime version changes', () => {
    const input = { content: '', language: 'java' as const, path: 'A.java' };
    const first = parserIdentity(input);
    vi.mocked(execFileSync).mockReturnValue('openjdk 25.0.6');
    expect(parserIdentity(input)).not.toBe(first);
  });
});
