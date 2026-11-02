import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { installJavaPackage, javaPackageOf } from './scan-java-package';

function platformOf() {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    throw new Error(
      'Managed Java 25 supports macOS and Linux; supply --java /path/to/java25 to the scanner.',
    );
  }
  if (process.arch !== 'arm64' && process.arch !== 'x64') {
    throw new Error(
      'Managed Java 25 supports arm64 and x64; supply --java /path/to/java25 to the scanner.',
    );
  }
  return {
    platform: process.platform,
    os: process.platform === 'darwin' ? 'mac' : 'linux',
    architecture: process.arch === 'arm64' ? 'aarch64' : 'x64',
  };
}

function executableOf(manifest: unknown, directory: string): string | undefined {
  if (typeof manifest !== 'object' || manifest === null) return undefined;
  if (!('format' in manifest) || manifest.format !== 'scan-java-runtime/v1') return undefined;
  if (!('executable' in manifest) || typeof manifest.executable !== 'string') return undefined;
  if (!trustedManifest(manifest)) return undefined;
  return managedExecutable(manifest.executable, directory);
}

function trustedManifest(manifest: object): boolean {
  if (!('archiveSha256' in manifest) || typeof manifest.archiveSha256 !== 'string') return false;
  if (!/^[a-f\d]{64}$/u.test(manifest.archiveSha256)) return false;
  if (!('source' in manifest) || typeof manifest.source !== 'string') return false;
  const source = new URL(manifest.source);
  if (source.origin !== 'https://github.com') return false;
  if (!source.pathname.startsWith('/adoptium/temurin25-binaries/releases/download/')) return false;
  return true;
}

function managedExecutable(executable: string, directory: string): string | undefined {
  if (!path.isAbsolute(executable)) return undefined;
  return executable.startsWith(`${directory}${path.sep}`) ? executable : undefined;
}

async function existingRuntime(directory: string): Promise<string | undefined> {
  try {
    const manifest: unknown = JSON.parse(
      await readFile(path.join(directory, 'runtime.json'), 'utf8'),
    );
    const executable = executableOf(manifest, directory);
    if (executable === undefined) return undefined;
    const version = spawnSync(executable, ['-version'], { encoding: 'utf8' });
    return version.status === 0 && /version "25[."]/u.test(version.stderr) ? executable : undefined;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function fetchBytes(source: string, maximum: number): Promise<Uint8Array> {
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || response.body === null) {
    throw new Error(`Download failed: ${String(response.status)}`);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maximum) {
      throw new Error('Download exceeds its permitted size.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Installs only the scanner's isolated compiler runtime, never a system-wide JDK. */
export async function setupScanJava(args: readonly string[]): Promise<void> {
  const { values } = parseArgs({ args: [...args], options: { directory: { type: 'string' } } });
  const directory = path.resolve(values.directory ?? 'node_modules/.cache/groundwork/java25');
  const target = platformOf();
  const existing = await existingRuntime(directory);
  if (existing !== undefined) {
    console.log(existing);
    return;
  }
  const query = new URLSearchParams({
    architecture: target.architecture,
    image_type: 'jdk',
    os: target.os,
    vendor: 'eclipse',
  });
  const metadata = await fetchBytes(
    `https://api.adoptium.net/v3/assets/latest/25/hotspot?${query}`,
    1_048_576,
  );
  const asset = javaPackageOf(JSON.parse(Buffer.from(metadata).toString('utf8')));
  const archive = await fetchBytes(asset.source, asset.size);
  const executable = await installJavaPackage({
    archive,
    asset,
    directory,
    platform: target.platform,
  });
  console.log(executable);
}

if (process.argv[1] === import.meta.filename) {
  await setupScanJava(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
