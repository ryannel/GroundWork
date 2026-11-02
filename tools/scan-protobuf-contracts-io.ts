import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { safeProtobufPath, type ProtobufSource } from '@/domain/scan/protobuf-contracts';
import type { ProtobufCapture } from '@/infrastructure/scan/protobuf-contracts-capture';
import { executeProtobufCommand as execute } from '@/infrastructure/scan/protobuf-contracts-compiler';
import { protobufDigest } from '@/infrastructure/scan/protobuf-contracts-format';

export interface GitProtobufSource extends ProtobufSource {
  readonly blob: string;
}
export interface GitProtobufInput {
  readonly clone: string;
  readonly commit: string;
}
export async function readGitProtobufSources(input: GitProtobufInput): Promise<{
  readonly sources: readonly GitProtobufSource[];
  readonly trackedFiles: number;
  readonly tree: string;
}> {
  if (!/^[a-f0-9]{40}$/u.test(input.commit)) throw new Error('An exact Git commit is required');
  const listing = await execute('git', ['-C', input.clone, 'ls-tree', '-rz', input.commit]);
  const entries = listing.stdout.split('\0').filter(Boolean);
  const sources: GitProtobufSource[] = [];
  for (const entry of entries) {
    const separator = entry.indexOf('\t');
    const sourcePath = entry.slice(separator + 1);
    if (!sourcePath.endsWith('.proto')) continue;
    if (separator < 0 || !safeProtobufPath(sourcePath)) {
      throw new Error('Unsafe pinned protobuf path');
    }
    const blob = entry.slice(0, separator).split(' ')[2];
    if (blob === undefined) throw new Error('Missing pinned protobuf blob');
    const content = await execute('git', [
      '-C',
      input.clone,
      'show',
      `${input.commit}:${sourcePath}`,
    ]);
    sources.push({ path: sourcePath, bytes: content.stdout, blob });
  }
  const tree = await execute('git', ['-C', input.clone, 'rev-parse', `${input.commit}^{tree}`]);
  return { sources, trackedFiles: entries.length, tree: tree.stdout.trim() };
}

export async function protobufAnalysisDigest(): Promise<string> {
  const paths = [
    'schema/protobuf-contracts.schema.json',
    'src/domain/scan/protobuf-contracts.ts',
    'src/infrastructure/scan/protobuf-contracts-format.ts',
    'src/infrastructure/scan/protobuf-contracts-compiler.ts',
    'src/infrastructure/scan/protobuf-contracts-capture.ts',
    'src/infrastructure/scan/protobuf-contracts-verification.ts',
    'src/infrastructure/scan/protobuf-descriptor-reader.py',
    'tools/scan-protobuf-contracts-io.ts',
    'tools/scan-protobuf-contracts.ts',
  ];
  const hashes: { readonly path: string; readonly sha256: string }[] = [];
  for (const sourcePath of paths) {
    hashes.push({ path: sourcePath, sha256: protobufDigest(await readFile(sourcePath)) });
  }
  return protobufDigest(JSON.stringify(hashes));
}

export async function writeProtobufCapture(
  output: string,
  capture: ProtobufCapture,
  sources: readonly GitProtobufSource[],
): Promise<void> {
  for (const folder of ['contexts', 'descriptors', 'standard-includes']) {
    await mkdir(path.join(output, folder), { recursive: true });
  }
  for (const source of sources) {
    await writeFile(
      path.join(output, 'contexts', `${protobufDigest(source.bytes)}.proto`),
      source.bytes,
    );
  }
  for (const descriptor of capture.descriptors) {
    await writeFile(
      path.join(output, 'descriptors', `${protobufDigest(descriptor.bytes)}.pb`),
      descriptor.bytes,
    );
  }
  for (const source of capture.standardIncludes) {
    await writeFile(
      path.join(output, 'standard-includes', `${protobufDigest(source.bytes)}.proto`),
      source.bytes,
    );
  }
  await writeFile(
    path.join(output, 'contracts.json'),
    `${JSON.stringify(capture.document, null, 2)}\n`,
  );
  await writeFile(
    path.join(output, 'source-manifest.json'),
    `${JSON.stringify(
      sources.map((source) => ({
        path: source.path,
        blob: source.blob,
        sha256: protobufDigest(source.bytes),
        context: `contexts/${protobufDigest(source.bytes)}.proto`,
      })),
      null,
      2,
    )}\n`,
  );
}
