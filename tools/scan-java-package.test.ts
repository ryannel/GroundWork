import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { installJavaPackage, javaPackageOf, verifyJavaArchive } from './scan-java-package';

vi.mock(import('node:child_process'));

const archive = Buffer.from('bounded test archive');
const checksum = createHash('sha256').update(archive).digest('hex');
const official =
  'https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25/test.tar.gz';
const metadata = [
  {
    binary: { image_type: 'jdk', package: { checksum, size: archive.length, link: official } },
    version: { major: 25, openjdk_version: '25+36' },
  },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe('managed Java package', () => {
  it('accepts official bounded JDK 25 metadata and the exact archive bytes', () => {
    const asset = javaPackageOf(metadata);
    expect(asset).toEqual({ source: official, checksum, size: archive.length, version: '25+36' });
    expect(() => {
      verifyJavaArchive(archive, asset);
    }).not.toThrow();
  });

  it.each([
    'https://github.com/another/temurin25-binaries/releases/download/jdk-25/test.tar.gz',
    'https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25/test.zip',
    'https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25/test.tar.gz?redirect=1',
  ])('rejects an untrusted archive URL: %s', (link) => {
    expect(() =>
      javaPackageOf([
        {
          binary: { image_type: 'jdk', package: { checksum, size: archive.length, link } },
          version: { major: 25, openjdk_version: '25+36' },
        },
      ]),
    ).toThrow(/Temurin|tar.gz/u);
  });

  it.each([0, -1, 1.5, 268_435_457])('rejects an unsafe archive size: %s', (size) => {
    expect(() =>
      javaPackageOf([
        {
          binary: { image_type: 'jdk', package: { checksum, size, link: official } },
          version: { major: 25, openjdk_version: '25+36' },
        },
      ]),
    ).toThrow(/Temurin|tar.gz/u);
  });

  it('rejects changed bytes before creating a directory or invoking tar or Java', async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'scan-java-test-'));
    const directory = path.join(temporary, 'runtime');
    try {
      const changed = Buffer.from(archive);
      changed[0] = 0;
      await expect(
        installJavaPackage({
          archive: changed,
          asset: javaPackageOf(metadata),
          directory,
          platform: 'linux',
        }),
      ).rejects.toThrow('SHA-256 mismatch');
      expect(execFileSync).not.toHaveBeenCalled();
      await expect(access(directory)).rejects.toThrow(/ENOENT/u);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it('rejects truncated archives before checksum comparison', () => {
    expect(() => {
      verifyJavaArchive(archive.subarray(1), javaPackageOf(metadata));
    }).toThrow('size mismatch');
  });
});
