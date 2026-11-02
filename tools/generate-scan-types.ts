import { readFile, writeFile } from 'node:fs/promises';

import { compile } from 'json-schema-to-typescript';

// Conditional schema rules stay authoritative at runtime; TypeScript cannot express them.
function unconditionalTyping(definition: unknown): unknown {
  if (typeof definition === 'object' && definition !== null && 'allOf' in definition) {
    const copy = { ...definition };
    delete copy.allOf;
    return copy;
  }
  return definition;
}

export async function generateScanTypes(): Promise<string> {
  const schema: unknown = JSON.parse(await readFile('schema/scan.schema.json', 'utf8'));
  if (typeof schema !== 'object' || schema === null) throw new Error('Expected schema object');
  if (
    '$defs' in schema &&
    typeof schema.$defs === 'object' &&
    schema.$defs !== null &&
    'SemanticNode' in schema.$defs
  ) {
    schema.$defs.SemanticNode = unconditionalTyping(schema.$defs.SemanticNode);
  }
  const generated = await compile(schema, 'ScanDocument', {
    bannerComment:
      '/* Generated from schema/scan.schema.json. Run node tools/generate-scan-types.ts. */',
    additionalProperties: false,
    unknownAny: true,
    strictIndexSignatures: true,
    unreachableDefinitions: true,
    style: { singleQuote: true, printWidth: 100, trailingComma: 'all' },
  });
  return generated.replaceAll(/\{\n\s+\[k: string\]: ([^\n;]+);\n\s+\}/gu, 'Record<string, $1>');
}

if (process.argv[1] === import.meta.filename) {
  await writeFile('src/domain/scan/scan.generated.ts', await generateScanTypes());
}
