import { execFileSync } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const METADATA = 'https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json';
const ROOT = 'node_modules/.cache/groundwork/dotnet';
interface Package {
  readonly version: string;
  readonly source: string;
  readonly hash: string;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function records(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter(record) : [];
}
export function dotnetPackage(metadata: unknown, rid: string): Package {
  if (!record(metadata) || typeof metadata['latest-sdk'] !== 'string') {
    throw new Error('Missing official SDK metadata.');
  }
  const version = metadata['latest-sdk'];
  if (!/^10\.\d+\.\d+$/u.test(version)) throw new Error('Expected a stable .NET 10 SDK version.');
  const sdks = records(metadata.releases).flatMap((release) => [
    ...records(release.sdks),
    ...records([release.sdk]),
  ]);
  const files = sdks.filter((sdk) => sdk.version === version).flatMap((sdk) => records(sdk.files));
  const file = files.find(
    (entry) =>
      entry.rid === rid && typeof entry.name === 'string' && entry.name.endsWith('.tar.gz'),
  );
  if (file === undefined || typeof file.url !== 'string' || typeof file.hash !== 'string') {
    throw new Error('Official SDK archive metadata is unavailable for this platform.');
  }
  const source = new URL(file.url);
  if (
    source.origin !== 'https://builds.dotnet.microsoft.com' ||
    !source.pathname.startsWith(`/dotnet/Sdk/${version}/`) ||
    !/^[a-f\d]{128}$/iu.test(file.hash)
  ) {
    throw new Error('Untrusted SDK archive metadata.');
  }
  return { version, source: source.href, hash: file.hash.toLowerCase() };
}
async function download(source: string, maximum: number): Promise<Buffer> {
  const response = await fetch(source, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok || response.body === null) {
    throw new Error(`SDK download failed: ${String(response.status)}`);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maximum) throw new Error('SDK download exceeds its byte bound.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function platform(): string {
  if (!['darwin', 'linux'].includes(process.platform) || !['arm64', 'x64'].includes(process.arch)) {
    throw new Error('Managed .NET supports macOS/Linux arm64/x64.');
  }
  return `${process.platform === 'darwin' ? 'osx' : 'linux'}-${process.arch}`;
}
export async function setupScanDotnet(args: readonly string[]): Promise<void> {
  const { values } = parseArgs({
    args: [...args],
    options: { metadata: { type: 'string' }, archive: { type: 'string' } },
  });
  const metadata = await readMetadata(values.metadata);
  const selected = dotnetPackage(metadata, platform());
  const root = path.resolve(ROOT);
  const destination = path.join(root, selected.version);
  const executable = path.join(destination, 'dotnet');
  if (!existsSync(executable)) {
    await install(selected, { root, destination, archive: values.archive });
  }
  const output = execFileSync(executable, ['--list-sdks'], { encoding: 'utf8', timeout: 10_000 });
  if (!output.split('\n').some((line) => line.startsWith(`${selected.version} [`))) {
    throw new Error('Installed SDK verification failed.');
  }
  const manifest = {
    format: 'scan-dotnet-runtime/v1',
    version: selected.version,
    source: selected.source,
    archiveSha512: selected.hash,
  };
  const temporary = path.join(root, 'runtime.next.json');
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, path.join(root, 'runtime.json'));
  console.log(
    JSON.stringify(
      {
        status: 'ready',
        ...manifest,
        executable,
        scope: 'Groundwork compiler only; no target build, restore or execution',
      },
      null,
      2,
    ),
  );
}
async function install(
  selected: Package,
  options: {
    readonly root: string;
    readonly destination: string;
    readonly archive: string | undefined;
  },
): Promise<void> {
  const archive =
    options.archive === undefined
      ? await download(selected.source, 512 * 1024 * 1024)
      : await readFile(options.archive);
  const actual = createHash('sha512').update(archive).digest();
  if (!timingSafeEqual(actual, Buffer.from(selected.hash, 'hex'))) {
    throw new Error('SDK archive SHA-512 does not match official metadata.');
  }
  await mkdir(options.root, { recursive: true });
  const staging = await mkdtemp(path.join(options.root, '.sdk-'));
  const archiveFile = path.join(staging, 'sdk.tar.gz');
  await writeFile(archiveFile, archive);
  const listing = execFileSync('/usr/bin/tar', ['-tzf', archiveFile], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
  });
  if (
    listing.split('\n').some((entry) => entry.startsWith('/') || entry.split('/').includes('..'))
  ) {
    throw new Error('SDK archive path escapes installation.');
  }
  execFileSync('/usr/bin/tar', ['-xzf', archiveFile, '-C', staging], { timeout: 60_000 });
  await unlink(archiveFile);
  await rename(staging, options.destination);
}
if (process.argv[1] === import.meta.filename) await setupScanDotnet(process.argv.slice(2));

async function readMetadata(filename: string | undefined): Promise<unknown> {
  if (filename !== undefined) return JSON.parse(await readFile(filename, 'utf8'));
  const bytes = await download(METADATA, 4 * 1024 * 1024);
  return JSON.parse(bytes.toString('utf8'));
}
