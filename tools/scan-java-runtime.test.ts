import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { javaExecutable } from '@/infrastructure/scan/java-runtime';

vi.mock(import('server-only'), () => ({}));

const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'groundwork-java-runtime-test-'));
  directories.push(directory);
  const executable = path.join(directory, 'java');
  writeFileSync(executable, 'fixture executable', { mode: 0o700 });
  const manifest = path.join(directory, 'runtime.json');
  const runtime = {
    format: 'scan-java-runtime/v1',
    executable,
    version: '25.0.5+8-LTS',
    archiveSha256: 'a'.repeat(64),
    source:
      'https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25/runtime.tar.gz',
    installedAt: '2026-10-24T00:00:00.000Z',
  };
  writeFileSync(manifest, JSON.stringify(runtime));
  return { directory, executable, manifest, runtime };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('scanner Java runtime selection', () => {
  it('prefers explicit commands even when the managed manifest is broken', () => {
    const selected = fixture();
    writeFileSync(selected.manifest, '{');
    expect(javaExecutable('/legacy/java17', selected.manifest)).toBe('/legacy/java17');
    expect(javaExecutable('java25', selected.manifest)).toBe('java25');
    expect(() => javaExecutable(' ', selected.manifest)).toThrow('Expected a Java executable');
    expect(() => javaExecutable('java\0bad', selected.manifest)).toThrow(
      'Expected a Java executable',
    );
  });

  it('selects the managed executable and retains the portable fallback only for a missing manifest', () => {
    const selected = fixture();
    expect(javaExecutable(undefined, selected.manifest)).toBe(selected.executable);
    expect(javaExecutable(undefined, path.join(selected.directory, 'absent.json'))).toBe('java');
  });

  it.each([
    ['invalid JSON', '{'],
    ['wrong major', { version: '17.0.18' }],
    ['relative executable', { executable: 'java' }],
    ['untrusted source', { source: 'https://example.com/runtime.tar.gz' }],
    ['invalid checksum', { archiveSha256: 'invalid' }],
    ['unknown field', { unchecked: true }],
  ])('fails closed for %s rather than silently choosing PATH', (_name, replacement) => {
    const selected = fixture();
    writeFileSync(
      selected.manifest,
      typeof replacement === 'string'
        ? replacement
        : JSON.stringify({ ...selected.runtime, ...replacement }),
    );
    expect(() => javaExecutable(undefined, selected.manifest)).toThrow(
      'Managed Java runtime is invalid',
    );
  });

  it('rejects stale, non-executable and directory targets', () => {
    const selected = fixture();
    chmodSync(selected.executable, 0o600);
    expect(() => javaExecutable(undefined, selected.manifest)).toThrow(
      'Managed Java runtime is invalid',
    );
    rmSync(selected.executable);
    expect(() => javaExecutable(undefined, selected.manifest)).toThrow(
      'Managed Java runtime is invalid',
    );
    writeFileSync(
      selected.manifest,
      JSON.stringify({ ...selected.runtime, executable: selected.directory }),
    );
    expect(() => javaExecutable(undefined, selected.manifest)).toThrow(
      'Managed Java runtime is invalid',
    );
  });
});
