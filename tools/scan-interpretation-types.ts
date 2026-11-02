import { readFile, writeFile } from 'node:fs/promises';

import { compile } from 'json-schema-to-typescript';

export async function generateInterpretationTypes(): Promise<string> {
  const schema: unknown = JSON.parse(
    await readFile('schema/scan-interpretation.schema.json', 'utf8'),
  );
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Expected interpretation schema');
  }
  return compile(schema, 'ScanInterpretation', {
    bannerComment:
      '/* Generated from schema/scan-interpretation.schema.json. Run node tools/scan-interpretation-types.ts. */',
    additionalProperties: false,
    unknownAny: true,
    strictIndexSignatures: true,
    unreachableDefinitions: true,
    style: { singleQuote: true, printWidth: 100, trailingComma: 'all' },
  });
}
if (process.argv[1] === import.meta.filename) {
  await writeFile(
    'src/domain/scan/interpretation.generated.ts',
    await generateInterpretationTypes(),
  );
}
