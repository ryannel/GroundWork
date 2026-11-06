import 'server-only';

import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

import type {
  ContractData,
  ContractDefinition,
  ContractFamily,
} from '@/domain/model/contracts.generated';
import type { ModelData } from '@/domain/workspace-model';
import { pathIn, readText } from '@/infrastructure/disk';

const SCHEMA_BASE = 'https://groundwork.local/schema';
const FAMILIES = ['workspace', 'plan', 'evidence'] as const;
type ValidationProfile = 'current' | 'plan';
const compiled = new Map<string, Promise<Ajv2020>>();

const object = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

function uniqueIds(required: boolean, items: readonly unknown[]): boolean {
  if (!required) return true;
  const ids = items.flatMap((item) =>
    object(item) && typeof item.id === 'string' ? [item.id] : [],
  );
  return new Set(ids).size === ids.length;
}

function uniqueChildIds(required: boolean, value: Readonly<Record<string, unknown>>): boolean {
  const direct = ['steps', 'then', 'else', 'try', 'catch', 'finally'].flatMap((key) =>
    list(value[key]),
  );
  const lanes = list(value.parallel).flatMap((lane) => (object(lane) ? list(lane.steps) : []));
  const exhausted = object(value.retry) ? list(value.retry.exhausted) : [];
  return uniqueIds(required, [...direct, ...lanes, ...exhausted]);
}

/** The shared Ajv configuration for direct schema checks and file loading. */
export function modelAjv(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addKeyword({
    keyword: 'uniqueIds',
    type: 'array',
    schemaType: 'boolean',
    errors: false,
    validate: uniqueIds,
  });
  ajv.addKeyword({
    keyword: 'uniqueChildIds',
    type: 'object',
    schemaType: 'boolean',
    errors: false,
    validate: uniqueChildIds,
  });
  return ajv;
}

function schemaProfile(value: unknown, profile: ValidationProfile): unknown {
  if (Array.isArray(value)) return value.map((item) => schemaProfile(item, profile));
  if (!object(value)) return value;
  if (profile === 'plan' && value.implementationEvidence === true) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, schemaProfile(item, profile)]),
  );
}
async function compile(
  root: string,
  resolved: boolean,
  profile: ValidationProfile,
): Promise<Ajv2020> {
  const schemas = await Promise.all(
    FAMILIES.map(async (family): Promise<unknown> =>
      JSON.parse(await readText(pathIn(root, 'schema', `${family}.schema.json`))),
    ),
  );
  const ajv = modelAjv();
  for (const schema of schemas) {
    if (!object(schema) || typeof schema.$id !== 'string') {
      throw new TypeError('A canonical schema needs an $id.');
    }
    if (resolved && object(schema.$defs) && object(schema.$defs.AuthoredCites)) {
      Object.assign(schema.$defs.AuthoredCites, { items: { $ref: '#/$defs/Cite' }, minItems: 0 });
    }
    const selected = schemaProfile(schema, profile);
    if (!object(selected)) throw new TypeError('A schema profile must remain an object.');
    ajv.addSchema(selected);
  }
  return ajv;
}

async function schemaValidator<Data>(
  family: ContractFamily,
  definition: string,
  root: string,
  resolved: boolean,
  profile: ValidationProfile,
): Promise<ValidateFunction<Data>> {
  const key = `${root}\n${String(resolved)}\n${profile}`;
  let pending = compiled.get(key);
  if (pending === undefined) {
    pending = compile(root, resolved, profile);
    compiled.set(key, pending);
  }
  const ajv = await pending;
  const suffix = definition === 'document' ? '' : `#/$defs/${definition}`;
  const validator = ajv.getSchema<Data>(`${SCHEMA_BASE}/${family}.schema.json${suffix}`);
  if (validator === undefined) {
    throw new Error(`Unknown ${family} schema definition: ${definition}`);
  }
  return validator;
}

/** A schema definition's typed predicate; no model fields are declared again in this layer. */
export async function modelValidator<
  Family extends ContractFamily,
  Definition extends ContractDefinition<Family>,
>(
  family: Family,
  definition: Definition,
  root = process.cwd(),
): Promise<ValidateFunction<ContractData<Family, Definition>>> {
  return schemaValidator(family, definition, root, false, family === 'plan' ? 'plan' : 'current');
}

/** The same authority after source citations have been resolved; unresolved references live in gaps. */
export async function resolvedModelValidator<
  Definition extends Exclude<ContractDefinition<'workspace'>, 'AuthoredCites'>,
>(definition: Definition, root = process.cwd()): Promise<ValidateFunction<ModelData<Definition>>> {
  return schemaValidator('workspace', definition, root, true, 'current');
}

/** Only the projection boundary uses the annotated implementation-evidence exception. */
export async function projectionModelValidator<
  Definition extends Exclude<ContractDefinition<'workspace'>, 'AuthoredCites'>,
>(definition: Definition): Promise<ValidateFunction<ModelData<Definition>>> {
  return schemaValidator('workspace', definition, process.cwd(), true, 'plan');
}

export interface ContractProblem {
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
}
export interface ContractCheck<Data> {
  readonly data: Data | null;
  readonly errors: readonly ContractProblem[];
}

/** Report heterogeneous file failures without expanding their recursive data types in a caller. */
export async function modelProblems<Family extends ContractFamily>(
  family: Family,
  definition: ContractDefinition<Family>,
  value: unknown,
  root = process.cwd(),
): Promise<
  readonly (ContractProblem & {
    readonly schemaPath: string;
    readonly params: Readonly<Record<string, unknown>>;
  })[]
> {
  const check = await schemaValidator<unknown>(
    family,
    definition,
    root,
    false,
    family === 'plan' ? 'plan' : 'current',
  );
  if (check(value)) return [];
  return (check.errors ?? []).map((error) => ({
    path: error.instancePath,
    schemaPath: error.schemaPath,
    params: error.params,
    keyword: error.keyword,
    message: error.message ?? 'Schema validation failed',
  }));
}

export async function checkModelData<
  Family extends ContractFamily,
  Definition extends ContractDefinition<Family>,
>(
  family: Family,
  definition: Definition,
  value: unknown,
  root?: string,
): Promise<ContractCheck<ContractData<Family, Definition>>> {
  const check = await modelValidator(family, definition, root);
  if (check(value)) return { data: value, errors: [] };
  return {
    data: null,
    errors: (check.errors ?? []).map((error) => ({
      path: error.instancePath,
      keyword: error.keyword,
      message: error.message ?? 'Schema validation failed',
    })),
  };
}

/** Parsed YAML or JSON enters through the same schema predicate used by direct checks. */
export async function readModelFile<
  Family extends ContractFamily,
  Definition extends ContractDefinition<Family>,
>(
  family: Family,
  definition: Definition,
  file: string,
  root?: string,
): Promise<ContractCheck<ContractData<Family, Definition>>> {
  const value: unknown = parse(await readText(file));
  return checkModelData(family, definition, value, root);
}
