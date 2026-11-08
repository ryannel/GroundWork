// Writes the consolidated workspace, plan and evidence contracts.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { compile } from 'json-schema-to-typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
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

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(file: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!isObject(value)) throw new TypeError(`${file} must hold a JSON object`);
  return value;
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

function schemaReferences(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(schemaReferences);
  if (!isObject(value)) return [];
  const own = typeof value.$ref === 'string' ? [value.$ref.split('/').at(-1) ?? ''] : [];
  return [...own, ...Object.values(value).flatMap(schemaReferences)];
}

function citedDefinitions(definitions: JsonObject): ReadonlySet<string> {
  const names = new Set(['AuthoredCites']);
  let previous = -1;
  while (previous !== names.size) {
    previous = names.size;
    for (const [name, definition] of Object.entries(definitions)) {
      if (schemaReferences(definition).some((reference) => names.has(reference))) names.add(name);
    }
  }
  return names;
}

function citationShape(value: unknown, cited: ReadonlySet<string>): JsonObject | null {
  if (!isObject(value)) return null;
  const reference = typeof value.$ref === 'string' ? value.$ref.split('/').at(-1) : undefined;
  if (reference !== undefined) return cited.has(reference) ? { ref: reference } : null;
  const props = isObject(value.properties)
    ? Object.entries(value.properties).flatMap(([key, child]) => {
        const shape = citationShape(child, cited);
        return shape === null ? [] : [[key, shape]];
      })
    : [];
  const items = citationShape(value.items, cited);
  const choices = ['anyOf', 'oneOf', 'allOf'].flatMap((key) => {
    const variants = value[key];
    if (!Array.isArray(variants)) return [];
    return variants.flatMap((variant: unknown) => {
      const shape = citationShape(variant, cited);
      return shape === null ? [] : [shape];
    });
  });
  if (props.length === 0 && items === null && choices.length === 0) return null;
  return {
    ...(props.length === 0 ? {} : { props }),
    ...(items === null ? {} : { items }),
    ...(choices.length === 0 ? {} : { choices }),
  };
}

function generateCitationShapes(schemas: ReadonlyMap<string, JsonObject>): string {
  const contract = CONTRACTS[0];
  const registry = typeRegistry(schemas, contract);
  const definitions = registry.$defs;
  if (!isObject(definitions)) throw new Error('Missing citation definitions.');
  const cited = citedDefinitions(definitions);
  const authored = definitions.AuthoredCites;
  const minimum =
    isObject(authored) && typeof authored.minItems === 'number' ? authored.minItems : 0;
  const shapes = Object.fromEntries(
    [...cited].map((name) => [
      name,
      name === 'AuthoredCites' ? { cites: true, minimum } : citationShape(definitions[name], cited),
    ]),
  );
  return `/* Generated from canonical schemas by tools/generate-plan-types.ts. Do not edit: run npm run generate. */
export interface CitationShape {
  readonly cites?: true;
  readonly minimum?: number;
  readonly ref?: string;
  readonly props?: readonly (readonly [string, CitationShape])[];
  readonly items?: CitationShape;
  readonly choices?: readonly CitationShape[];
}
export const CITATION_SHAPES: Readonly<Record<string, CitationShape>> = ${JSON.stringify(shapes, null, 2)};
`;
}

// Apply every existing rule in one formatter process per batch, rather than reloading the project per file.
function formatGenerated(args: readonly string[]): void {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Generated type formatting failed: ${result.stderr}\n${result.stdout}`);
  }
}

async function normaliseGenerated(
  contracts: readonly GeneratedContract[],
): Promise<readonly GeneratedContract[]> {
  // Keep the same src/**/*.generated.ts rules and project context as the final files.
  const folder = await mkdtemp(path.join(ROOT, 'src/domain/model/generate-'));
  try {
    const entries = contracts.map((contract) => ({
      contract,
      file: path.join(folder, path.basename(contract.file)),
    }));
    const files = entries.map((entry) => entry.file);
    await Promise.all(
      entries.map(async ({ contract, file }) => {
        await writeFile(file, contract.source);
      }),
    );
    formatGenerated(['node_modules/eslint/bin/eslint.js', '--fix', ...files]);
    formatGenerated(['node_modules/prettier/bin/prettier.cjs', '--write', ...files]);
    return await Promise.all(
      entries.map(async ({ contract, file }) => ({
        file: contract.file,
        source: await readFile(file, 'utf8'),
      })),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
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
    generated.push({ file, source });
  }
  generated.push(
    {
      file: 'src/domain/model/citations.generated.ts',
      source: generateCitationShapes(schemas),
    },
    {
      file: 'src/domain/model/contracts.generated.ts',
      source:
        "/* Generated by tools/generate-plan-types.ts. Do not edit: run npm run generate. */\nimport type { CanonicalEvidenceTypes } from '@/domain/model/evidence.generated';\nimport type { CanonicalPlanTypes } from '@/domain/model/plan.generated';\nimport type { WorkspaceDocumentTypes } from '@/domain/model/workspace.generated';\n\n/** Schema-generated data is exposed as immutable values throughout the model. */\nexport type ReadonlyData<T> = T extends object\n  ? { readonly [Key in keyof T]: ReadonlyData<T[Key]> }\n  : T;\n\nexport interface ContractTypes {\n  readonly workspace: WorkspaceDocumentTypes;\n  readonly plan: CanonicalPlanTypes;\n  readonly evidence: CanonicalEvidenceTypes;\n}\nexport type ContractFamily = keyof ContractTypes;\nexport type ContractDefinition<Family extends ContractFamily> = Extract<\n  keyof ContractTypes[Family],\n  string\n>;\nexport type ContractData<\n  Family extends ContractFamily,\n  Definition extends ContractDefinition<Family>,\n> = ReadonlyData<ContractTypes[Family][Definition]>;\n",
    },
  );
  return normaliseGenerated(generated);
}

if (process.argv[1] === import.meta.filename) {
  for (const contract of await generateModelTypes()) {
    await writeFile(path.join(ROOT, contract.file), contract.source);
    console.log(`Wrote ${contract.file}`);
  }
}
