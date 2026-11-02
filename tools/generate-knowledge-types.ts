import { readFile, writeFile } from 'node:fs/promises';

import { compile } from 'json-schema-to-typescript';

function unconditionalTyping(definition: unknown): unknown {
  if (typeof definition === 'object' && definition !== null && 'allOf' in definition) {
    const copy = { ...definition };
    delete copy.allOf;
    return copy;
  }
  return definition;
}

export async function generateKnowledgeTypes(): Promise<string> {
  const schema: unknown = JSON.parse(await readFile('schema/knowledge.schema.json', 'utf8'));
  if (typeof schema !== 'object' || schema === null) throw new Error('Expected schema object');
  if ('$defs' in schema && typeof schema.$defs === 'object' && schema.$defs !== null) {
    if ('QueryRequest' in schema.$defs) {
      schema.$defs.QueryRequest = unconditionalTyping(schema.$defs.QueryRequest);
    }
    if ('StorageWrite' in schema.$defs) {
      schema.$defs.StorageWrite = unconditionalTyping(schema.$defs.StorageWrite);
    }
  }
  return compile(schema, 'KnowledgeDocument', {
    bannerComment:
      '/* Generated from schema/knowledge.schema.json. Run npm run generate:knowledge. */',
    additionalProperties: false,
    unknownAny: true,
    strictIndexSignatures: true,
    style: { singleQuote: true, printWidth: 100 },
  });
}

if (process.argv[1] === import.meta.filename) {
  await writeFile('src/domain/knowledge/knowledge.generated.ts', await generateKnowledgeTypes());
}
