// Writes src/domain/plan/plan.generated.ts from schema/plan.schema.json. Run with `npm run generate`.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { compile } from 'json-schema-to-typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCHEMA = path.join(ROOT, 'schema/plan.schema.json');
const PRETTIER = path.join(ROOT, '.prettierrc.json');
const OUTPUT = path.join(ROOT, 'src/domain/plan/plan.generated.ts');

const BANNER =
  '/* Generated from schema/plan.schema.json by tools/generate-plan-types.ts. Do not edit: run `npm run generate`. */';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(file: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!isObject(value)) throw new TypeError(`${file} must hold a JSON object`);
  return value;
}

// The generator cannot express these constraints; ajv still enforces them against the schema itself.
function simplify(defs: JsonObject): void {
  const { op_modify: modify, schema } = defs;
  if (isObject(schema)) delete schema.allOf;
  if (!isObject(modify) || !isObject(modify.properties)) return;
  delete modify.anyOf;
  for (const [key, tsType] of [
    ['set', 'Record<string, unknown>'],
    ['append', 'Record<string, unknown[]>'],
    ['drop', 'Record<string, unknown[]>'],
  ] as const) {
    const property = modify.properties[key];
    if (isObject(property)) property.tsType = tsType;
  }
}

function prepare(schema: JsonObject): JsonObject {
  const defs = schema.$defs;
  if (isObject(defs)) simplify(defs);
  return { ...schema, title: 'Plan' };
}

// `type IdTeam = string` only adds a name; the lint rules ask for `string`
function inlineStringAliases(source: string): string {
  const alias = /^(?:\/\*\*(?:(?!\*\/)[\s\S])*\*\/\n)?export type (\w+) = string;\n/gmu;
  const names = new Set([...source.matchAll(alias)].map((match) => match[1] ?? ''));
  return source
    .replaceAll(alias, '')
    .replaceAll(/\b\w+\b/gu, (word) => (names.has(word) ? 'string' : word));
}

export async function generatePlanTypes(): Promise<string> {
  const schema = prepare(await readJson(SCHEMA));
  const style = await readJson(PRETTIER);
  const source = await compile(schema, 'Plan', {
    bannerComment: BANNER,
    additionalProperties: false,
    unknownAny: true,
    strictIndexSignatures: true,
    style,
  });
  return inlineStringAliases(source);
}

if (process.argv[1] === import.meta.filename) {
  await writeFile(OUTPUT, await generatePlanTypes());
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
}
