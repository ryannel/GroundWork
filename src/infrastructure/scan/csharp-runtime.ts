import 'server-only';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  renameSync,
  rmSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ADAPTER_ASSEMBLY = 'source-index.dll';
const ROSLYN_ASSEMBLIES = ['Microsoft.CodeAnalysis.dll', 'Microsoft.CodeAnalysis.CSharp.dll'];

interface CsharpRuntime {
  readonly executable: string;
  readonly sdk: string;
  readonly version: string;
}

function runtime(): CsharpRuntime {
  const managed = managedExecutable();
  const executable = [
    ...(managed === undefined ? [] : [managed]),
    '/usr/local/share/dotnet/dotnet',
    '/opt/homebrew/share/dotnet/dotnet',
    '/usr/share/dotnet/dotnet',
  ].find((candidate) => existsSync(candidate));
  if (executable === undefined) throw new Error('C# indexing needs an installed .NET SDK.');
  const output = execFileSync(executable, ['--list-sdks'], { encoding: 'utf8', timeout: 10_000 });
  const candidates = output
    .trim()
    .split('\n')
    .flatMap((line) => {
      const match = /^(\S+) \[([^\]]+)\]$/u.exec(line.trim());
      return match?.[1] !== undefined && match[2] !== undefined
        ? [{ executable, sdk: path.join(match[2], match[1]), version: match[1] }]
        : [];
    });
  const selected = candidates.at(-1);
  if (!selected) {
    throw new Error('C# indexing needs an installed .NET SDK; no project restore is attempted.');
  }
  return selected;
}

function digest(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function csharpParserIdentity(directory: string): string {
  const selected = runtime();
  return [
    selected.sdk,
    ...['source-index.cs', 'compiler-bindings.cs', 'compiler-contracts.cs'].map((file) =>
      digest(readFileSync(path.join(directory, file))),
    ),
    ...ROSLYN_ASSEMBLIES.map((file) =>
      digest(readFileSync(path.join(selected.sdk, 'Roslyn/bincore', file))),
    ),
    execFileSync(selected.executable, ['--list-runtimes'], {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim(),
  ].join(':');
}

/** Builds Groundwork's parser only, using SDK assemblies without NuGet or target projects. */
export function csharpAdapter(directory: string): readonly string[] {
  const selected = runtime();
  const key = digest(csharpParserIdentity(directory));
  const destination = path.join(tmpdir(), `groundwork-roslyn-${key}`);
  if (existsSync(path.join(destination, 'READY'))) {
    return [selected.executable, path.join(destination, ADAPTER_ASSEMBLY)];
  }
  const output = mkdtempSync(path.join(tmpdir(), 'groundwork-roslyn-build-'));
  const assembly = path.join(output, ADAPTER_ASSEMBLY);
  const { pack, framework, references } = referencePack(selected);
  const roslyn = path.join(selected.sdk, 'Roslyn/bincore');
  const response = path.join(output, 'compile.rsp');
  const args = [
    '-nologo',
    '-nullable:enable',
    '-target:exe',
    `-out:${assembly}`,
    ...readdirSync(references)
      .filter((file) => file.endsWith('.dll'))
      .map((file) => `-r:${path.join(references, file)}`),
    ...ROSLYN_ASSEMBLIES.map((file) => `-r:${path.join(roslyn, file)}`),
    path.resolve(directory, 'source-index.cs'),
    path.resolve(directory, 'compiler-bindings.cs'),
    path.resolve(directory, 'compiler-contracts.cs'),
  ];
  writeFileSync(response, args.map((argument) => `"${argument}"`).join('\n'));
  execFileSync(selected.executable, [path.join(roslyn, 'csc.dll'), `@${response}`], {
    timeout: 60_000,
  });
  for (const file of ROSLYN_ASSEMBLIES) {
    copyFileSync(path.join(roslyn, file), path.join(output, file));
  }
  writeFileSync(
    path.join(output, 'source-index.runtimeconfig.json'),
    JSON.stringify({
      runtimeOptions: {
        tfm: framework,
        framework: { name: 'Microsoft.NETCore.App', version: pack },
      },
    }),
  );
  return publishAdapter(selected.executable, output, destination);
}

function publishAdapter(
  executable: string,
  output: string,
  destination: string,
): readonly string[] {
  writeFileSync(path.join(output, 'READY'), 'complete');
  try {
    renameSync(output, destination);
  } catch (error) {
    if (!existsSync(path.join(destination, 'READY'))) throw error;
    rmSync(output, { recursive: true });
  }
  return [executable, path.join(destination, ADAPTER_ASSEMBLY)];
}

function referencePack(selected: CsharpRuntime): {
  readonly pack: string;
  readonly framework: string;
  readonly references: string;
} {
  const dotnetRoot = path.dirname(path.dirname(selected.sdk));
  const packs = path.join(dotnetRoot, 'packs/Microsoft.NETCore.App.Ref');
  const pack = readdirSync(packs)
    .filter((entry) => entry.startsWith(`${selected.version.split('.')[0] ?? ''}.`))
    .toSorted((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .at(-1);
  if (pack === undefined) throw new Error('Installed SDK reference assemblies are unavailable.');
  const referenceRoot = path.join(packs, pack, 'ref');
  const framework = readdirSync(referenceRoot)
    .toSorted((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .at(-1);
  if (framework === undefined) throw new Error('Installed SDK target framework is unavailable.');
  const references = path.join(referenceRoot, framework);
  return { pack, framework, references };
}

function managedExecutable(): string | undefined {
  const directory = path.resolve('node_modules/.cache/groundwork/dotnet');
  const filename = path.join(directory, 'runtime.json');
  if (!existsSync(filename)) return undefined;
  const manifest: unknown = JSON.parse(readFileSync(filename, 'utf8'));
  const executable = path.join(directory, managedVersion(manifest), 'dotnet');
  if (!existsSync(executable)) {
    throw new Error('Managed SDK executable is missing; run tools/scan-dotnet-setup.ts.');
  }
  return executable;
}
function managedVersion(manifest: unknown): string {
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error('Invalid managed .NET runtime manifest.');
  }
  if (!('format' in manifest) || manifest.format !== 'scan-dotnet-runtime/v1') {
    throw new Error('Invalid managed SDK format.');
  }
  const version = 'version' in manifest ? manifest.version : undefined;
  if (typeof version !== 'string' || !/^10\.\d+\.\d+$/u.test(version)) {
    throw new Error('Invalid managed SDK version.');
  }
  if (!trustedArchive(manifest)) throw new Error('Invalid managed SDK archive provenance.');
  return version;
}
function trustedArchive(manifest: object): boolean {
  if (
    !('archiveSha512' in manifest) ||
    typeof manifest.archiveSha512 !== 'string' ||
    !/^[a-f\d]{128}$/u.test(manifest.archiveSha512)
  ) {
    return false;
  }
  if (!('source' in manifest) || typeof manifest.source !== 'string') return false;
  const source = new URL(manifest.source);
  return (
    source.origin === 'https://builds.dotnet.microsoft.com' &&
    source.pathname.startsWith('/dotnet/Sdk/')
  );
}
