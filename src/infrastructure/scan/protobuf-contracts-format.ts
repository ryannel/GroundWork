import 'server-only';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import Ajv2020 from 'ajv/dist/2020.js';

import { safeProtobufPath, type ProtobufSource } from '@/domain/scan/protobuf-contracts';
import type { CanonicalProtobufContracts, File } from '@/domain/scan/protobuf-contracts.generated';

export function protobufDigest(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function protobufInventoryDigest(sources: readonly ProtobufSource[]): string {
  return protobufDigest(
    JSON.stringify(
      sources.map((source) => ({ path: source.path, sha256: protobufDigest(source.bytes) })),
    ),
  );
}

export async function protobufContractParsers(): Promise<{
  readonly document: (value: unknown) => CanonicalProtobufContracts;
  readonly file: (value: unknown) => File;
}> {
  const schema: unknown = JSON.parse(
    await readFile('schema/protobuf-contracts.schema.json', 'utf8'),
  );
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Expected protobuf contract schema');
  }
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile<CanonicalProtobufContracts>(schema);
  const file = ajv.compile<File>({
    $ref: 'https://groundwork.local/schema/canonical-protobuf-contracts#/$defs/File',
  });
  return {
    document: (value) => {
      if (!validate(value)) {
        throw new Error(`ProtobufContracts: ${ajv.errorsText(validate.errors)}`);
      }
      return value;
    },
    file: (value) => {
      if (!file(value)) throw new Error(`ProtobufContracts: ${ajv.errorsText(file.errors)}`);
      return value;
    },
  };
}

export async function validateProtobufContracts(
  value: unknown,
  sources: readonly ProtobufSource[],
): Promise<CanonicalProtobufContracts> {
  const parsers = await protobufContractParsers();
  const document = parsers.document(value);
  const paths = document.files.map((file) => file.path);
  if (
    new Set(paths).size !== paths.length ||
    paths.length !== sources.length ||
    sources.some((source) => !paths.includes(source.path))
  ) {
    throw new Error('Protobuf contract source denominator changed');
  }
  if (document.source_inventory_sha256 !== protobufInventoryDigest(sources)) {
    throw new Error('Protobuf source inventory digest changed');
  }
  for (const file of document.files) {
    const source = sources.find((item) => item.path === file.path);
    if (!source || !safeProtobufPath(file.path) || file.sha256 !== protobufDigest(source.bytes)) {
      throw new Error('Protobuf source body or path changed');
    }
    validateAnchors(file, {
      path: file.path,
      sha256: file.sha256,
      lines: source.bytes.split('\n').length,
    });
    if (
      file.status !== 'extracted' &&
      (file.messages.length + file.enums.length + file.services.length > 0 ||
        file.descriptor_sha256 !== null)
    ) {
      throw new Error('Failed protobuf source cannot claim extracted declarations');
    }
  }
  return document;
}

function validateAnchors(
  value: unknown,
  source: { readonly path: string; readonly sha256: string; readonly lines: number },
): void {
  if (typeof value !== 'object' || value === null) return;
  if ('descriptor_path' in value) validateAnchor(value, source);
  const children: readonly unknown[] = Object.values(value);
  for (const child of children) validateAnchors(child, source);
}
function validateAnchor(
  value: object,
  source: { readonly path: string; readonly sha256: string; readonly lines: number },
): void {
  const error = 'Protobuf source anchor changed or is out of bounds';
  if (!('path' in value) || value.path !== source.path) throw new Error(error);
  if (!('sha256' in value) || value.sha256 !== source.sha256) throw new Error(error);
  if (!('lines' in value) || !Array.isArray(value.lines)) throw new Error(error);
  const [start, end] = value.lines;
  if (typeof start !== 'number' || typeof end !== 'number') throw new Error(error);
  if (start < 1 || end < start || end > source.lines) throw new Error(error);
}
