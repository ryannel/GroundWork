import 'server-only';

import { createHash } from 'node:crypto';

import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';

import { versionFormats } from '@/domain/knowledge/knowledge-versions';
import type {
  KnowledgeBundle,
  KnowledgeDocument,
  KnowledgeRecord,
  KnowledgeSnapshot,
  QueryRequest,
  QueryResponse,
} from '@/domain/knowledge/knowledge.generated';
import { readText } from '@/infrastructure/disk';

interface KnowledgeParsers {
  readonly bundle: (input: unknown) => KnowledgeBundle;
  readonly record: (input: unknown) => KnowledgeRecord;
  readonly snapshot: (input: unknown) => KnowledgeSnapshot;
  readonly request: (input: unknown) => QueryRequest;
  readonly response: (input: unknown) => QueryResponse;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    const fields = Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b, 'en'));
    const encoded = fields
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',');
    return `{${encoded}}`;
  }
  if (value === undefined) throw new Error('Canonical data cannot contain undefined');
  return JSON.stringify(value);
}

export function knowledgeDigest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function snapshotFor(
  bundles: readonly KnowledgeBundle[],
  rules: KnowledgeSnapshot['rules'] = 'knowledge-query/v1',
): KnowledgeSnapshot {
  const format = versionFormats(rules).snapshot;
  const selection = {
    format,
    bundles: bundles.map(knowledgeDigest).toSorted((a, b) => a.localeCompare(b)),
    interpretations: [],
    rules,
  };
  return {
    ...selection,
    format,
    id: knowledgeDigest(selection),
  };
}

function parser<T extends KnowledgeDocument | KnowledgeRecord>(
  check: ValidateFunction<T> | undefined,
  name: string,
): (input: unknown) => T {
  if (check === undefined) throw new Error(`Missing schema ${name}`);
  return (input: unknown): T => {
    if (!check(input)) {
      const errors = check.errors
        ?.map((error) => `${error.instancePath}: ${error.message ?? error.keyword}`)
        .join('; ');
      throw new Error(`${name}: ${errors ?? 'invalid document'}`);
    }
    return input;
  };
}

function versioned<T extends KnowledgeDocument>(
  checks: readonly (ValidateFunction<T> | undefined)[],
  name: string,
): (input: unknown) => T {
  const parsers = checks.map((check) => parser(check, name));
  return (input) => {
    const format = isObject(input) && typeof input.format === 'string' ? input.format : '';
    let index = 2;
    if (format.endsWith('/v1')) index = 0;
    if (format.endsWith('/v2')) index = 1;
    const parse = parsers[index];
    if (parse === undefined) throw new Error(`Missing parser ${name}`);
    return parse(input);
  };
}

export async function knowledgeValidators(): Promise<KnowledgeParsers> {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const contents = await Promise.all(
    [
      'schema/knowledge-v1.schema.json',
      'schema/knowledge-v2.schema.json',
      'schema/knowledge.schema.json',
    ].map(async (file) => readText(file)),
  );
  for (const content of contents) {
    const schema: unknown = JSON.parse(content);
    if (!isObject(schema)) throw new Error('Expected schema object');
    ajv.addSchema(schema);
  }
  const legacy = 'https://groundwork.local/schema/knowledge-v1#/$defs/';
  const previous = 'https://groundwork.local/schema/knowledge-v2#/$defs/';
  const current = 'https://groundwork.local/schema/knowledge-v3#/$defs/';
  return {
    bundle: versioned(
      [
        ajv.getSchema<KnowledgeBundle>(`${legacy}KnowledgeBundle`),
        ajv.getSchema<KnowledgeBundle>(`${previous}KnowledgeBundle`),
        ajv.getSchema<KnowledgeBundle>(`${current}KnowledgeBundle`),
      ],
      'KnowledgeBundle',
    ),
    record: parser(
      ajv.getSchema<KnowledgeRecord>(
        'https://groundwork.local/schema/knowledge-v3#/$defs/KnowledgeRecord',
      ),
      'KnowledgeRecord',
    ),
    snapshot: versioned(
      [
        ajv.getSchema<KnowledgeSnapshot>(`${legacy}KnowledgeSnapshot`),
        ajv.getSchema<KnowledgeSnapshot>(`${previous}KnowledgeSnapshot`),
        ajv.getSchema<KnowledgeSnapshot>(`${current}KnowledgeSnapshot`),
      ],
      'KnowledgeSnapshot',
    ),
    request: versioned(
      [
        ajv.getSchema<QueryRequest>(`${legacy}QueryRequest`),
        ajv.getSchema<QueryRequest>(`${previous}QueryRequest`),
        ajv.getSchema<QueryRequest>(`${current}QueryRequest`),
      ],
      'QueryRequest',
    ),
    response: versioned(
      [
        ajv.getSchema<QueryResponse>(`${legacy}QueryResponse`),
        ajv.getSchema<QueryResponse>(`${previous}QueryResponse`),
        ajv.getSchema<QueryResponse>(`${current}QueryResponse`),
      ],
      'QueryResponse',
    ),
  };
}
