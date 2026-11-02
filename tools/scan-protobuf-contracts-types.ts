import { readFile, writeFile } from 'node:fs/promises';

import { compile } from 'json-schema-to-typescript';

export async function generateProtobufContractsTypes(): Promise<string> {
  const schema: unknown = JSON.parse(
    await readFile('schema/protobuf-contracts.schema.json', 'utf8'),
  );
  if (typeof schema !== 'object' || schema === null) throw new Error('Expected protobuf schema');
  return compile(schema, 'CanonicalProtobufContracts', {
    bannerComment: '/* Generated from schema/protobuf-contracts.schema.json. */',
    additionalProperties: false,
    unknownAny: true,
    unreachableDefinitions: true,
    style: { singleQuote: true, printWidth: 100, trailingComma: 'all' },
  });
}
if (process.argv[1] === import.meta.filename) {
  await writeFile(
    'src/domain/scan/protobuf-contracts.generated.ts',
    await generateProtobufContractsTypes(),
  );
}
