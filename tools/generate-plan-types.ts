// Writes src/domain/plan/plan.generated.ts from schema/legacy-plan.schema.json. Run with `npm run generate`.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { compile } from 'json-schema-to-typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCHEMA = path.join(ROOT, 'schema/legacy-plan.schema.json');
const PRETTIER = path.join(ROOT, '.prettierrc.json');
const CONTRACTS = [
  {
    schema: 'workspace.schema.json',
    name: 'WorkspaceDocument',
    prefix: 'Workspace',
    file: 'workspace.generated.ts',
  },
  { schema: 'plan.schema.json', name: 'CanonicalPlan', prefix: 'Plan', file: 'plan.generated.ts' },
  {
    schema: 'evidence.schema.json',
    name: 'CanonicalEvidence',
    prefix: 'Evidence',
    file: 'evidence.generated.ts',
  },
] as const;

const OUTPUT = path.join(ROOT, 'src/domain/plan/plan.generated.ts');

const BANNER =
  '/* Generated from schema/legacy-plan.schema.json by tools/generate-plan-types.ts. Do not edit: run `npm run generate`. */';

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
    unreachableDefinitions: true,
    style,
  });
  return inlineStringAliases(source);
}

export interface GeneratedContract {
  readonly file: string;
  readonly source: string;
}

// JSON Schema remains the authority for constraints that TypeScript cannot express.
function typingConstraint(key: string, type: unknown): boolean {
  if (key === 'allOf') return true;
  if (type !== 'object' && type !== 'string') return false;
  return key === 'anyOf' || key === 'oneOf';
}

function typeShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(typeShape);
  if (!isObject(value)) return value;
  const entries = Object.entries(value).filter(([key]) => !typingConstraint(key, value.type));
  return Object.fromEntries(entries.map(([key, child]) => [key, typeShape(child)]));
}

function definitionKey(file: string, name: string, target: string): string {
  if (file === target) return name;
  const contract = CONTRACTS.find((item) => item.schema === file);
  if (contract === undefined) throw new Error(`Unknown schema reference: ${file}`);
  return `${contract.prefix}${name}`;
}

function localReference(value: string, origin: string, target: string): string {
  const marker = '#/$defs/';
  const [file, name] = value.split(marker);
  if (name === undefined) throw new Error(`Unsupported schema reference: ${value}`);
  return `${marker}${definitionKey(file === '' ? origin : (file ?? origin), name, target)}`;
}

function localDefinitions(value: unknown, origin: string, target: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => localDefinitions(item, origin, target));
  }
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === '$ref' && typeof child === 'string'
        ? localReference(child, origin, target)
        : localDefinitions(child, origin, target),
    ]),
  );
}

function plainString(
  type: unknown,
  alias: string | undefined,
  names: ReadonlySet<string>,
): boolean {
  return type === 'string' || (alias !== undefined && names.has(alias));
}

function primitiveNames(definitions: JsonObject): ReadonlySet<string> {
  const names = new Set<string>();
  let previous = -1;
  while (previous !== names.size) {
    previous = names.size;
    for (const [name, definition] of Object.entries(definitions)) {
      if (!isObject(definition) || 'enum' in definition || 'const' in definition) continue;
      const alias =
        typeof definition.$ref === 'string' ? definition.$ref.split('/').at(-1) : undefined;
      if (plainString(definition.type, alias, names)) {
        names.add(name);
      }
    }
  }
  return names;
}

function primitiveReferences(value: unknown, names: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((child: unknown) => primitiveReferences(child, names));
  if (!isObject(value)) return value;
  const name = typeof value.$ref === 'string' ? value.$ref.split('/').at(-1) : undefined;
  const inline = name !== undefined && names.has(name);
  const entries = Object.entries(value).filter(([key]) => !inline || key !== '$ref');
  const properties = Object.fromEntries(
    entries.map(([key, child]) => [key, primitiveReferences(child, names)]),
  );
  return inline ? { type: 'string', ...properties } : properties;
}

function typeRegistry(
  schemas: ReadonlyMap<string, JsonObject>,
  contract: (typeof CONTRACTS)[number],
): JsonObject {
  const schema = schemas.get(contract.schema);
  if (schema === undefined || !isObject(schema.$defs)) {
    throw new Error('Missing schema definitions.');
  }
  const definitions: JsonObject = {};
  for (const [file, document] of schemas) {
    if (!isObject(document.$defs)) throw new Error(`Missing definitions in ${file}`);
    for (const [name, definition] of Object.entries(document.$defs)) {
      definitions[definitionKey(file, name, contract.schema)] = typeShape(
        localDefinitions(definition, file, contract.schema),
      );
    }
  }
  const root = Object.fromEntries(
    Object.entries(schema).filter(([key]) => !['$schema', '$id', '$defs', 'title'].includes(key)),
  );
  const rootKey = `${contract.name}Document`;
  definitions[rootKey] = typeShape(localDefinitions(root, contract.schema, contract.schema));
  const properties = Object.fromEntries(
    Object.keys(schema.$defs).map((name) => [name, { $ref: `#/$defs/${name}` }]),
  );
  const registry = {
    title: `${contract.name}Types`,
    description: 'Schema definition lookup used by the validator’s typed API.',
    type: 'object',
    additionalProperties: false,
    properties: { ...properties, document: { $ref: `#/$defs/${rootKey}` } },
    required: [...Object.keys(properties), 'document'],
    $defs: definitions,
  };
  const inlined = primitiveReferences(registry, primitiveNames(definitions));
  if (!isObject(inlined)) throw new TypeError('A generated type registry must be an object.');
  return inlined;
}

// Apply the repository's existing formatting rules without adding another type declaration path.
function formattingOutput(source: string, args: readonly string[]): string {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    input: source,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Generated type formatting failed: ${result.stderr}\n${result.stdout}`);
  }
  return result.stdout;
}

function normaliseGenerated(source: string, file: string): string {
  const report: unknown = JSON.parse(
    formattingOutput(source, [
      'node_modules/eslint/bin/eslint.js',
      '--stdin',
      '--stdin-filename',
      file,
      '--fix-dry-run',
      '--format',
      'json',
    ]),
  );
  const first: unknown = Array.isArray(report) ? report[0] : undefined;
  if (!isObject(first)) throw new Error('Missing generated type lint report.');
  const fixed = typeof first.output === 'string' ? first.output : source;
  return formattingOutput(fixed, [
    'node_modules/prettier/bin/prettier.cjs',
    '--stdin-filepath',
    file,
  ]);
}

export async function generateModelTypes(): Promise<readonly GeneratedContract[]> {
  const style = await readJson(PRETTIER);
  const schemas = new Map<string, JsonObject>();
  for (const contract of CONTRACTS) {
    schemas.set(contract.schema, await readJson(path.join(ROOT, 'schema', contract.schema)));
  }
  const generated: GeneratedContract[] = [];
  for (const contract of CONTRACTS) {
    const schema = typeRegistry(schemas, contract);
    const source = await compile(schema, `${contract.name}Types`, {
      bannerComment: `/* Generated from schema/${contract.schema} by tools/generate-plan-types.ts. Do not edit: run npm run generate. */`,
      additionalProperties: false,
      unknownAny: true,
      strictIndexSignatures: true,
      unreachableDefinitions: false,
      style,
    });
    const file = `src/domain/model/${contract.file}`;
    generated.push({ file, source: normaliseGenerated(source, file) });
  }
  generated.push({
    file: 'src/domain/model/contracts.generated.ts',
    source:
      "/* Generated by tools/generate-plan-types.ts. Do not edit: run npm run generate. */\nimport type { CanonicalEvidenceTypes } from '@/domain/model/evidence.generated';\nimport type { CanonicalPlanTypes } from '@/domain/model/plan.generated';\nimport type { WorkspaceDocumentTypes } from '@/domain/model/workspace.generated';\n\n/** Schema-generated data is exposed as immutable values throughout the model. */\nexport type ReadonlyData<T> = T extends object\n  ? { readonly [Key in keyof T]: ReadonlyData<T[Key]> }\n  : T;\n\nexport interface ContractTypes {\n  readonly workspace: WorkspaceDocumentTypes;\n  readonly plan: CanonicalPlanTypes;\n  readonly evidence: CanonicalEvidenceTypes;\n}\nexport type ContractFamily = keyof ContractTypes;\nexport type ContractDefinition<Family extends ContractFamily> = Extract<\n  keyof ContractTypes[Family],\n  string\n>;\nexport type ContractData<\n  Family extends ContractFamily,\n  Definition extends ContractDefinition<Family>,\n> = ReadonlyData<ContractTypes[Family][Definition]>;\n",
  });
  return generated;
}

if (process.argv[1] === import.meta.filename) {
  await writeFile(OUTPUT, await generatePlanTypes());
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
  for (const contract of await generateModelTypes()) {
    await writeFile(path.join(ROOT, contract.file), contract.source);
    console.log(`Wrote ${contract.file}`);
  }
}
