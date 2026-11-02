import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readAncillaryBlob, writeAncillaryBlob } from './ancillary-blob-cache';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture(algorithm: 'sha1' | 'sha256' = 'sha1') {
  const cacheDirectory = mkdtempSync(path.join(tmpdir(), 'ancillary-cache-'));
  folders.push(cacheDirectory);
  const content = Buffer.from([0, 255, 20, 30]);
  const blob =
    algorithm === 'sha256'
      ? createHash('sha256')
          .update(`blob ${String(content.length)}\0`)
          .update(content)
          .digest('hex')
      : execFileSync('/usr/bin/git', ['--no-optional-locks', 'hash-object', '--stdin'], {
          cwd: cacheDirectory,
          input: content,
          encoding: 'utf8',
          env: {
            NODE_ENV: 'test',
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_CONFIG_GLOBAL: '/dev/null',
            GIT_NO_LAZY_FETCH: '1',
            GIT_TERMINAL_PROMPT: '0',
          },
        }).trim();
  return { cacheDirectory, content, blob, bytes: content.length };
}

describe('verified ancillary raw-byte cache', () => {
  it('round-trips binary bytes with SHA-1 and SHA-256 Git blob verification', async () => {
    for (const algorithm of ['sha1', 'sha256'] as const) {
      const input = fixture(algorithm);
      await writeAncillaryBlob(input);
      await expect(readAncillaryBlob(input)).resolves.toEqual(input.content);
      await expect(readAncillaryBlob({ ...input, bytes: input.bytes + 1 })).resolves.toBeNull();
    }
  });
  it('rejects modified bytes, malformed envelopes and non-canonical base64', async () => {
    const input = fixture();
    const filename = path.join(input.cacheDirectory, `${input.blob}.json`);
    const invalid = [
      {
        format: 'ancillary-blob/v1',
        blob: input.blob,
        base64: Buffer.from([1, 2, 3, 4]).toString('base64'),
      },
      {
        format: 'ancillary-blob/v1',
        blob: input.blob,
        base64: `${input.content.toString('base64')}\n`,
      },
      {
        format: 'ancillary-blob/v1',
        blob: input.blob,
        base64: input.content.toString('base64'),
        extra: true,
      },
    ];
    for (const value of invalid) {
      writeFileSync(filename, JSON.stringify(value));
      await expect(readAncillaryBlob(input)).resolves.toBeNull();
    }
  });
  it('does not follow symlinks or trust oversized cache files', async () => {
    const input = fixture();
    const target = path.join(input.cacheDirectory, 'target.json');
    writeFileSync(
      target,
      JSON.stringify({
        format: 'ancillary-blob/v1',
        blob: input.blob,
        base64: input.content.toString('base64'),
      }),
    );
    const filename = path.join(input.cacheDirectory, `${input.blob}.json`);
    symlinkSync(target, filename);
    await expect(readAncillaryBlob(input)).resolves.toBeNull();
    rmSync(filename);
    writeFileSync(filename, ' '.repeat(2_097_153));
    await expect(readAncillaryBlob(input)).resolves.toBeNull();
  });
  it('refuses invalid blob names, mismatched writes and oversized raw data', async () => {
    const input = fixture();
    await expect(readAncillaryBlob({ ...input, blob: '../outside' })).resolves.toBeNull();
    await expect(readAncillaryBlob({ ...input, bytes: 1_048_577 })).resolves.toBeNull();
    await expect(
      writeAncillaryBlob({ ...input, content: Buffer.from('different') }),
    ).rejects.toThrow('mismatched');
    await expect(
      writeAncillaryBlob({ ...input, content: Buffer.alloc(1_048_577) }),
    ).rejects.toThrow('oversized');
  });
});
