import 'server-only';

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { safeProtobufPath, type ProtobufSource } from '@/domain/scan/protobuf-contracts';
import type { CanonicalProtobufContracts } from '@/domain/scan/protobuf-contracts.generated';

import {
  compileProtobufFile,
  sequentialProtobufMap,
  probeProtobufCompiler,
  unextractedProtobufFile,
  type ProtobufCompilerOptions,
  type ProtobufDescriptorResult,
} from './protobuf-contracts-compiler';
import {
  protobufDigest,
  protobufInventoryDigest,
  validateProtobufContracts,
} from './protobuf-contracts-format';

export interface ProtobufCaptureInput {
  readonly repo: string;
  readonly commit: string;
  readonly sources: readonly ProtobufSource[];
  readonly compiler: ProtobufCompilerOptions;
  readonly analysisSha256: string;
}
export interface ProtobufCapture {
  readonly document: CanonicalProtobufContracts;
  readonly descriptors: readonly { readonly sourcePath: string; readonly bytes: Uint8Array }[];
  readonly standardIncludes: readonly ProtobufSource[];
}

async function materialiseSources(root: string, sources: readonly ProtobufSource[]): Promise<void> {
  await sequentialProtobufMap(sources, async (source) => {
    if (!safeProtobufPath(source.path)) throw new Error('Unsafe protobuf source path');
    const destination = path.join(root, source.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, source.bytes);
  });
}

async function standardIncludes(
  input: ProtobufCaptureInput,
  results: readonly ProtobufDescriptorResult[],
): Promise<readonly ProtobufSource[]> {
  const names = [...new Set(results.flatMap((item) => item.dependencies))].filter(
    (name) => !input.sources.some((source) => source.path === name),
  );
  return sequentialProtobufMap(names, async (name) => {
    if (!safeProtobufPath(name) || !name.startsWith('google/protobuf/')) {
      throw new Error('Unexpected non-standard external protobuf dependency');
    }
    return {
      path: name,
      bytes: await readFile(path.join(input.compiler.standardIncludeRoot, name), 'utf8'),
    };
  });
}

async function captureInTemporaryRoot(
  input: ProtobufCaptureInput,
  root: string,
): Promise<ProtobufCapture> {
  const compiler = await probeProtobufCompiler(input.compiler);
  const sourceRoot = path.join(root, 'source');
  await materialiseSources(sourceRoot, input.sources);
  const results = await sequentialProtobufMap(
    input.sources,
    async (source, index): Promise<ProtobufDescriptorResult> =>
      compiler.status === 'available'
        ? compileProtobufFile({
            repo: input.repo,
            source,
            sourceRoot,
            descriptorPath: path.join(root, `${String(index)}.pb`),
            compiler: input.compiler,
          })
        : {
            file: unextractedProtobufFile(source, 'compiler_unavailable', compiler.reason),
            dependencies: [],
            bytes: null,
          },
  );
  const includes = await standardIncludes(input, results);
  const document: CanonicalProtobufContracts = {
    format: 'canonical-protobuf-contracts/v1',
    repo: input.repo,
    commit: input.commit,
    analysis_sha256: input.analysisSha256,
    source_inventory_sha256: protobufInventoryDigest(input.sources),
    compiler: {
      ...compiler,
      standard_includes: includes.map((source) => ({
        path: source.path,
        sha256: protobufDigest(source.bytes),
        lines: source.bytes.split('\n').length,
      })),
    },
    files: results.map((result) => result.file),
    limitations: [
      'Canonical source declarations only; effective wire behaviour, deployed producers/consumers and delivery are unknown.',
      'No target build, code generation, dependency installation, remote lookup or native source pass was performed.',
      'Import roots are the pinned repository root and the explicitly supplied local compiler standard includes; aliases and flattened imports are not guessed.',
      'Custom options/extensions and absent SourceCodeInfo declarations remain explicit unsupported data; full descriptor sets are retained.',
    ],
  };
  return {
    document: await validateProtobufContracts(document, input.sources),
    descriptors: results.flatMap((result) =>
      result.bytes === null ? [] : [{ sourcePath: result.file.path, bytes: result.bytes }],
    ),
    standardIncludes: includes,
  };
}

export async function captureProtobufContracts(
  input: ProtobufCaptureInput,
): Promise<ProtobufCapture> {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-protobuf-'));
  try {
    return await captureInTemporaryRoot(input, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
