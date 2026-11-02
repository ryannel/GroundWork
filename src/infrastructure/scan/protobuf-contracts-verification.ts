import 'server-only';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ProtobufSource } from '@/domain/scan/protobuf-contracts';
import type { CanonicalProtobufContracts } from '@/domain/scan/protobuf-contracts.generated';

import {
  readProtobufDescriptor,
  sequentialProtobufMap,
  type ProtobufCompilerOptions,
} from './protobuf-contracts-compiler';
import { protobufDigest, validateProtobufContracts } from './protobuf-contracts-format';

export interface ProtobufVerificationInput {
  readonly sources: readonly ProtobufSource[];
  readonly descriptors: readonly { readonly sourcePath: string; readonly bytes: Uint8Array }[];
  readonly compiler: ProtobufCompilerOptions;
}

/** Rebuild structured declarations and their exact anchors from retained official descriptor bytes. */
export async function verifyProtobufContractDescriptors(
  value: unknown,
  input: ProtobufVerificationInput,
): Promise<CanonicalProtobufContracts> {
  const document = await validateProtobufContracts(value, input.sources);
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-protobuf-verify-'));
  try {
    await sequentialProtobufMap(document.files, async (file, index) => {
      if (file.status !== 'extracted') return;
      const source = input.sources.find((item) => item.path === file.path);
      const descriptors = input.descriptors.filter((item) => item.sourcePath === file.path);
      const descriptor = descriptors[0];
      if (
        !source ||
        descriptors.length !== 1 ||
        !descriptor ||
        protobufDigest(descriptor.bytes) !== file.descriptor_sha256
      ) {
        throw new Error('Retained protobuf descriptor bytes changed or are missing');
      }
      const descriptorPath = path.join(root, `${String(index)}.pb`);
      await writeFile(descriptorPath, descriptor.bytes);
      const expected = await readProtobufDescriptor({
        repo: document.repo,
        source,
        descriptorPath,
        sourceRoot: root,
        compiler: input.compiler,
      });
      if (
        JSON.stringify({ ...file, diagnostics: '' }) !==
        JSON.stringify({ ...expected.file, diagnostics: '' })
      ) {
        throw new Error('Protobuf declarations or exact SourceCodeInfo anchors changed');
      }
    });
    return document;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
