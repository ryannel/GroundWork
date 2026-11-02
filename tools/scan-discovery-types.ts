import { readFile, writeFile } from 'node:fs/promises';

import { compile } from 'json-schema-to-typescript';

export async function generateDiscoveryTypes(): Promise<string> {
  const schema: unknown = JSON.parse(await readFile('schema/scan-discovery.schema.json', 'utf8'));
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Expected discovery schema');
  }
  return compile(schema, 'ScanDiscovery', {
    bannerComment:
      '/* Generated from schema/scan-discovery.schema.json. Run node tools/scan-discovery-types.ts. */',
    additionalProperties: false,
    unknownAny: true,
    strictIndexSignatures: true,
    unreachableDefinitions: true,
    style: { singleQuote: true, printWidth: 100, trailingComma: 'all' },
  });
}
if (process.argv[1] === import.meta.filename) {
  await writeFile('src/domain/scan/discovery.generated.ts', await generateDiscoveryTypes());
}
