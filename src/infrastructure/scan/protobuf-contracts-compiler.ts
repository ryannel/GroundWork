import 'server-only';

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { safeProtobufPath, type ProtobufSource } from '@/domain/scan/protobuf-contracts';
import type { Compiler, File } from '@/domain/scan/protobuf-contracts.generated';

import { protobufContractParsers, protobufDigest } from './protobuf-contracts-format';

const processLimits = { timeout: 20_000, maxBuffer: 16_777_216 };
export async function executeProtobufCommand(
  command: string,
  args: readonly string[],
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, [...args], processLimits, (error, stdout, stderr) => {
      if (error) reject(new Error(error.message));
      else resolve({ stdout, stderr });
    });
  });
}
export async function sequentialProtobufMap<T, R>(
  items: readonly T[],
  apply: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  return items.reduce<Promise<R[]>>(
    async (pending, item, index) => [...(await pending), await apply(item, index)],
    Promise.resolve([]),
  );
}
const result = z
  .object({ file: z.record(z.string(), z.unknown()), dependencies: z.array(z.string()) })
  .strict();
export interface ProtobufCompilerOptions {
  readonly protoc: string;
  readonly python: string;
  readonly standardIncludeRoot: string;
}
export interface ProtobufCompileInput {
  readonly repo: string;
  readonly source: ProtobufSource;
  readonly sourceRoot: string;
  readonly descriptorPath: string;
  readonly compiler: ProtobufCompilerOptions;
}
export interface ProtobufDescriptorResult {
  readonly file: File;
  readonly dependencies: readonly string[];
  readonly bytes: Uint8Array | null;
}

export async function probeProtobufCompiler(options: ProtobufCompilerOptions): Promise<Compiler> {
  const base = { standard_include_root: options.standardIncludeRoot, standard_includes: [] };
  try {
    const protoc = await executeProtobufCommand(options.protoc, ['--version']);
    const python = await executeProtobufCommand(options.python, [
      '-c',
      'import google.protobuf; print(google.protobuf.__version__)',
    ]);
    return {
      ...base,
      status: 'available',
      protoc_version: protoc.stdout.trim(),
      python_protobuf_version: python.stdout.trim(),
      reason: 'Installed local declaration compiler and official descriptor reader available.',
    };
  } catch (error) {
    return {
      ...base,
      status: 'unavailable',
      protoc_version: null,
      python_protobuf_version: null,
      reason: `Local compiler or descriptor reader unavailable: ${String(error)}`,
    };
  }
}

export function unextractedProtobufFile(
  source: ProtobufSource,
  status: 'compiler_failed' | 'compiler_unavailable',
  diagnostics: string,
): File {
  const sha256 = protobufDigest(source.bytes);
  return {
    path: source.path,
    sha256,
    anchor: {
      path: source.path,
      sha256,
      lines: [1, source.bytes.split('\n').length],
      columns: [0, 0],
      descriptor_path: [],
    },
    status,
    diagnostics,
    descriptor_sha256: null,
    package: null,
    syntax: null,
    imports: [],
    messages: [],
    enums: [],
    services: [],
    unsupported: [
      'Declarations are unavailable for this source; the source denominator is preserved.',
    ],
  };
}

export async function readProtobufDescriptor(
  input: ProtobufCompileInput,
): Promise<ProtobufDescriptorResult> {
  const request = {
    descriptor: input.descriptorPath,
    path: input.source.path,
    repo: input.repo,
    sha256: protobufDigest(input.source.bytes),
  };
  const script = fileURLToPath(new URL('protobuf-descriptor-reader.py', import.meta.url));
  const output = await executeProtobufCommand(input.compiler.python, [
    script,
    JSON.stringify(request),
  ]);
  const parsed = result.parse(JSON.parse(output.stdout));
  const bytes = await readFile(input.descriptorPath);
  const base = unextractedProtobufFile(input.source, 'compiler_failed', '');
  const parsers = await protobufContractParsers();
  const file = parsers.file({
    ...base,
    ...parsed.file,
    status: 'extracted',
    descriptor_sha256: protobufDigest(bytes),
  });
  return { file, dependencies: parsed.dependencies, bytes };
}

export async function compileProtobufFile(
  input: ProtobufCompileInput,
): Promise<ProtobufDescriptorResult> {
  if (!safeProtobufPath(input.source.path)) throw new Error('Unsafe protobuf source path');
  try {
    const compiled = await executeProtobufCommand(input.compiler.protoc, [
      `-I${path.resolve(input.sourceRoot)}`,
      `-I${input.compiler.standardIncludeRoot}`,
      '--include_source_info',
      '--include_imports',
      `--descriptor_set_out=${input.descriptorPath}`,
      input.source.path,
    ]);
    const descriptor = await readProtobufDescriptor(input);
    return { ...descriptor, file: { ...descriptor.file, diagnostics: compiled.stderr } };
  } catch (error) {
    return {
      file: unextractedProtobufFile(
        input.source,
        'compiler_failed',
        String(error)
          .replaceAll(input.sourceRoot, '<pinned-source>')
          .replaceAll(input.descriptorPath, '<descriptor>'),
      ),
      dependencies: [],
      bytes: null,
    };
  }
}
