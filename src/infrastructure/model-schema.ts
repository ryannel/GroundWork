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

async function compile(root: string, resolved: boolean): Promise<Ajv2020> {
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
    ajv.addSchema(schema);
  }
  return ajv;
}

async function schemaValidator<Data>(
  family: ContractFamily,
  definition: string,
  root: string,
  resolved: boolean,
): Promise<ValidateFunction<Data>> {
  const key = `${root}\n${String(resolved)}`;
  let pending = compiled.get(key);
  if (pending === undefined) {
    pending = compile(root, resolved);
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
  return schemaValidator(family, definition, root, false);
}

/** The same authority after source citations have been resolved; unresolved references live in gaps. */
export async function resolvedModelValidator<
  Definition extends Exclude<ContractDefinition<'workspace'>, 'AuthoredCites'>,
>(definition: Definition, root = process.cwd()): Promise<ValidateFunction<ModelData<Definition>>> {
  return schemaValidator('workspace', definition, root, true);
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
