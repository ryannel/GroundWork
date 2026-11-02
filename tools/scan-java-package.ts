import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;

export interface JavaPackage {
  readonly source: string;
  readonly checksum: string;
  readonly size: number;
  readonly version: string;
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid Temurin package metadata.');
  }
  return Object.fromEntries(Object.entries(value));
}

function officialSource(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Missing Temurin package URL.');
  const source = new URL(value);
  if (
    source.origin !== 'https://github.com' ||
    !source.pathname.startsWith('/adoptium/temurin25-binaries/releases/download/')
  ) {
    throw new Error('Temurin package must come from the official HTTPS release.');
  }
  if ([source.username, source.password, source.search, source.hash].some((part) => part !== '')) {
    throw new Error('Unexpected Temurin package URL credentials or parameters.');
  }
  if (!source.pathname.endsWith('.tar.gz')) throw new Error('Expected a tar.gz package.');
  return value;
}

/** The API is an untrusted edge; only official bounded JDK archives are accepted. */
export function javaPackageOf(metadata: unknown): JavaPackage {
  if (!Array.isArray(metadata) || metadata.length !== 1) {
    throw new Error('Expected exactly one Temurin 25 package.');
  }
  const release = recordOf(metadata[0]);
  const binary = recordOf(release.binary);
  const archive = recordOf(binary.package);
  const version = recordOf(release.version);
  if (version.major !== 25 || binary.image_type !== 'jdk') {
    throw new Error('Expected a Temurin 25 JDK package.');
  }
  if (typeof archive.checksum !== 'string' || !/^[a-f\d]{64}$/u.test(archive.checksum)) {
    throw new Error('Invalid Temurin SHA-256 checksum.');
  }
  if (typeof archive.size !== 'number' || !Number.isSafeInteger(archive.size)) {
    throw new TypeError('Invalid Temurin archive size.');
  }
  if (archive.size <= 0 || archive.size > MAX_ARCHIVE_BYTES) {
    throw new Error('Temurin archive exceeds the permitted size.');
  }
  if (typeof version.openjdk_version !== 'string') throw new Error('Missing JDK version.');
  return {
    source: officialSource(archive.link),
    checksum: archive.checksum,
    size: archive.size,
    version: version.openjdk_version,
  };
}

export function verifyJavaArchive(archive: Uint8Array, asset: JavaPackage): void {
  if (archive.byteLength !== asset.size) throw new Error('Temurin archive size mismatch.');
  const checksum = createHash('sha256').update(archive).digest('hex');
  if (checksum !== asset.checksum) throw new Error('Temurin archive SHA-256 mismatch.');
}

function archiveRoot(archive: string): string {
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const roots = new Set(entries.map((entry) => entry.split('/')[0]));
  if (entries.some((entry) => entry.startsWith('/') || entry.split('/').includes('..'))) {
    throw new Error('Unsafe path in Temurin archive.');
  }
  const root = entries[0]?.split('/')[0];
  if (roots.size !== 1 || root === undefined || root === '' || root === '.') {
    throw new Error('Invalid JDK archive root.');
  }
  return root;
}

interface Installation {
  readonly archive: Uint8Array;
  readonly asset: JavaPackage;
  readonly directory: string;
  readonly platform: 'darwin' | 'linux';
}

async function publishManifest(details: {
  readonly executable: string;
  readonly destination: string;
  readonly input: Installation;
}): Promise<void> {
  const { executable, destination, input } = details;
  const manifest = path.join(input.directory, `${path.basename(destination)}.json`);
  await writeFile(
    manifest,
    `${JSON.stringify(
      {
        format: 'scan-java-runtime/v1',
        executable,
        version: input.asset.version,
        archiveSha256: input.asset.checksum,
        source: input.asset.source,
        installedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
  await rename(manifest, path.join(input.directory, 'runtime.json'));
}

/** Verification precedes tar and Java execution; publication leaves the previous runtime intact. */
export async function installJavaPackage(input: Installation): Promise<string> {
  verifyJavaArchive(input.archive, input.asset);
  await mkdir(input.directory, { recursive: true });
  const staging = await mkdtemp(path.join(input.directory, '.install-'));
  const archive = path.join(staging, 'jdk.tar.gz');
  try {
    await writeFile(archive, input.archive, { flag: 'wx' });
    const root = archiveRoot(archive);
    execFileSync('tar', ['-xzf', archive, '-C', staging]);
    await rm(archive);
    const home = input.platform === 'darwin' ? path.join(root, 'Contents', 'Home') : root;
    const stagedExecutable = path.join(staging, home, 'bin', 'java');
    const version = spawnSync(stagedExecutable, ['-version'], { encoding: 'utf8' });
    if (version.status !== 0 || !/version "25[."]/u.test(version.stderr)) {
      throw new Error('Extracted Java runtime did not report Java 25.');
    }
    const destination = path.join(
      input.directory,
      path.basename(staging).replace('.install-', 'jdk-'),
    );
    await rename(staging, destination);
    const executable = path.resolve(destination, home, 'bin', 'java');
    await publishManifest({ executable, destination, input });
    return executable;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
