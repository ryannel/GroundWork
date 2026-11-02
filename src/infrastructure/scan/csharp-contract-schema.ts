import 'server-only';

import { z } from 'zod';

import type { Contract, Shape } from '@/domain/scan/scan.generated';

import { csharpSource } from './csharp-declarations';
import type { SourceIndex } from './source-index-types';

const location = z
  .object({
    path: z.string(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .strict();
type Location = z.infer<typeof location>;
type Description =
  | {
      readonly kind: 'scalar';
      readonly name: 'string' | 'number' | 'integer' | 'boolean' | 'null';
      readonly spelling: string;
    }
  | { readonly kind: 'tuple'; readonly items: readonly Description[]; readonly spelling: string }
  | {
      readonly kind: 'union';
      readonly alternatives: readonly Description[];
      readonly spelling: string;
    }
  | { readonly kind: 'array'; readonly item: Description; readonly spelling: string }
  | {
      readonly kind: 'map';
      readonly key: Description;
      readonly value: Description;
      readonly spelling: string;
    }
  | { readonly kind: 'reference'; readonly target: Location; readonly spelling: string }
  | {
      readonly kind: 'unresolved';
      readonly spelling: string;
      readonly reason: 'missing_dependency' | 'unsupported';
    };
const description: z.ZodType<Description> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('scalar'),
        name: z.enum(['string', 'number', 'integer', 'boolean', 'null']),
        spelling: z.string(),
      })
      .strict(),
    z
      .object({ kind: z.literal('tuple'), items: z.array(description), spelling: z.string() })
      .strict(),
    z
      .object({
        kind: z.literal('union'),
        alternatives: z.array(description).min(2),
        spelling: z.string(),
      })
      .strict(),
    z.object({ kind: z.literal('array'), item: description, spelling: z.string() }).strict(),
    z
      .object({
        kind: z.literal('map'),
        key: description,
        value: description,
        spelling: z.string(),
      })
      .strict(),
    z.object({ kind: z.literal('reference'), target: location, spelling: z.string() }).strict(),
    z
      .object({
        kind: z.literal('unresolved'),
        spelling: z.string(),
        reason: z.enum(['missing_dependency', 'unsupported']),
      })
      .strict(),
  ]),
);
export const csharpContractsSchema = z.array(
  z
    .object({
      source: location,
      name: z.string(),
      fields: z.array(
        z
          .object({
            name: z.string(),
            nullable: z.boolean(),
            required: z.boolean(),
            shape: description,
          })
          .strict(),
      ),
      enumValues: z.array(z.number()).nullable(),
      enumDeclaration: z.boolean(),
    })
    .strict(),
);
type Declaration = z.infer<typeof csharpContractsSchema>[number];

function contractId(indexes: readonly SourceIndex[], anchor: Location): string | null {
  const index = indexes.find((entry) => entry.path === anchor.path);
  const node = index?.nodes.find(
    (entry) => entry.start === anchor.start && entry.end === anchor.end,
  );
  return index && node ? `contract:csharp:${csharpSource(index, node)}` : null;
}

function sourceShape(indexes: readonly SourceIndex[], shape: Description): Shape {
  switch (shape.kind) {
    case 'scalar': {
      return { ...shape, spelling: spellingOf(shape) };
    }
    case 'tuple': {
      return { ...shape, items: shape.items.map((item) => sourceShape(indexes, item)) };
    }
    case 'union': {
      return unionShape(indexes, shape);
    }
    case 'array': {
      return { ...shape, item: sourceShape(indexes, shape.item) };
    }
    case 'map': {
      return {
        ...shape,
        key: sourceShape(indexes, shape.key),
        value: sourceShape(indexes, shape.value),
      };
    }
    case 'reference': {
      const target = contractId(indexes, shape.target);
      return target === null
        ? {
            kind: 'unresolved',
            reason: 'missing_dependency',
            spelling: spellingOf(shape),
          }
        : { ...shape, target };
    }
    case 'unresolved': {
      return {
        ...shape,
        spelling: spellingOf(shape),
        reason: 'missing_dependency',
      };
    }
  }
}

function declarationShape(indexes: readonly SourceIndex[], declaration: Declaration): Shape {
  if (declaration.enumDeclaration) {
    const [first, ...rest] = declaration.enumValues ?? [];
    return first === undefined
      ? { kind: 'unresolved', reason: 'unsupported', spelling: declaration.name }
      : { kind: 'enum', values: [first, ...rest], spelling: declaration.name };
  }
  return {
    kind: 'object',
    spelling: declaration.name,
    enforcement: 'source',
    additionalProperties: true,
    fields: declaration.fields.map((field) => ({
      name: field.name,
      nullable: field.nullable,
      presence: field.required ? 'required' : 'optional',
      shape: sourceShape(indexes, field.shape),
    })),
  };
}

export function declaredCsharpContracts(
  indexes: readonly SourceIndex[],
  declarations: readonly Declaration[],
): readonly Contract[] {
  return declarations.flatMap((declaration) => {
    const id = contractId(indexes, declaration.source);
    return id === null
      ? []
      : [
          {
            kind: 'contract',
            id,
            support: [id.slice('contract:csharp:'.length)],
            shape: declarationShape(indexes, declaration),
          },
        ];
  });
}

export const csharpSignaturesSchema = z.array(
  z
    .object({
      source: location,
      result: description,
      parameters: z.array(
        z.object({ source: location, name: z.string(), shape: description }).strict(),
      ),
    })
    .strict(),
);
export interface CsharpMethodContracts {
  readonly source: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
}

export function declaredCsharpSignatures(
  indexes: readonly SourceIndex[],
  signatures: readonly z.infer<typeof csharpSignaturesSchema>[number][],
): {
  readonly contracts: readonly Contract[];
  readonly signatures: readonly CsharpMethodContracts[];
} {
  const contracts: Contract[] = [];
  const methods: CsharpMethodContracts[] = [];
  for (const signature of signatures) {
    const method = contractId(indexes, signature.source)?.slice('contract:csharp:'.length);
    if (method === undefined) continue;
    const inputs = signature.parameters.flatMap((parameter) => {
      const source = contractId(indexes, parameter.source)?.slice('contract:csharp:'.length);
      if (source === undefined) return [];
      const id = `contract:csharp:input:${source}`;
      contracts.push({
        kind: 'contract',
        id,
        support: [source],
        shape: sourceShape(indexes, parameter.shape),
      });
      return [id];
    });
    const output = `contract:csharp:output:${method}`;
    contracts.push({
      kind: 'contract',
      id: output,
      support: [method],
      shape: sourceShape(indexes, signature.result),
    });
    methods.push({ source: method, inputs, outputs: [output] });
  }
  return { contracts, signatures: methods };
}

function spellingOf(shape: Description): string {
  return shape.spelling.length > 0 ? shape.spelling : 'unknown';
}
function unionShape(
  indexes: readonly SourceIndex[],
  shape: Extract<Description, { readonly kind: 'union' }>,
): Shape {
  const [first, second, ...rest] = shape.alternatives;
  if (first === undefined || second === undefined) {
    return { kind: 'unresolved', reason: 'unsupported', spelling: spellingOf(shape) };
  }
  return {
    kind: 'union',
    spelling: spellingOf(shape),
    alternatives: [
      sourceShape(indexes, first),
      sourceShape(indexes, second),
      ...rest.map((item) => sourceShape(indexes, item)),
    ],
  };
}
