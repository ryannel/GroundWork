import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { sourceDigest } from './source-index';
import type { SourceIndex } from './source-index-types';

const offset = z.number().int().nonnegative();
const range = z.tuple([offset, offset]);
const node = z
  .object({
    kind: z.string(),
    text: z.string(),
    start: offset,
    end: offset,
    lines: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    parent: offset.nullable(),
    binding: offset.optional(),
    symbol: z.string().optional(),
    modifiers: z.array(z.string()).optional(),
    literalValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    optionalAccess: z.boolean().optional(),
    operator: z.string().optional(),
    fields: z.record(z.string(), z.array(range)).optional(),
  })
  .strict()
  .transform((item) => {
    const {
      fields,
      binding,
      symbol,
      literalValue,
      optionalAccess,
      modifiers,
      operator,
      ...common
    } = item;
    return {
      ...common,
      ...(modifiers === undefined ? {} : { modifiers }),
      ...(literalValue === undefined ? {} : { literalValue }),
      ...(optionalAccess === undefined ? {} : { optionalAccess }),
      ...(operator === undefined ? {} : { operator }),
      ...(fields === undefined ? {} : { fields }),
      ...(binding === undefined ? {} : { binding }),
      ...(symbol === undefined ? {} : { symbol }),
    };
  });
const indexSchema = z
  .object({
    path: z.string(),
    language: z.enum(['typescript', 'javascript', 'java', 'go', 'csharp', 'python', 'rust']),
    digest: z.string(),
    content: z.string(),
    parser: z.string(),
    attribution: z.enum(['parse_only', 'local_symbols']),
    options: z.string(),
    nodes: z.array(node),
    diagnostics: z.array(z.string()),
  })
  .strict();
const sourceSchema = z.object({ blob: z.string(), content: z.string() }).strict();

function validRange(bounds: readonly [number, number], length: number): boolean {
  return bounds[0] <= bounds[1] && bounds[1] <= length;
}

function validNode(input: {
  readonly item: z.infer<typeof node>;
  readonly position: number;
  readonly index: SourceIndex;
}): boolean {
  const { item, position, index } = input;
  if (!validRange([item.start, item.end], index.content.length)) return false;
  if (item.lines[0] > item.lines[1]) return false;
  if (item.parent !== null && item.parent >= position) {
    return false;
  }
  if (item.binding !== undefined && item.binding > index.content.length) return false;
  return Object.values(item.fields ?? {}).every((ranges) =>
    ranges.every((bounds) => validRange(bounds, index.content.length)),
  );
}

/** Cache JSON is untrusted; every nested node and byte-derived digest is checked. */
export function validateSourceIndex(value: unknown): SourceIndex | null {
  const result = indexSchema.safeParse(value);
  if (!result.success) return null;
  const index = result.data;
  if (sourceDigest(index.content) !== index.digest) return null;
  const valid = index.nodes.every((item, position) => validNode({ item, position, index }));
  return valid ? index : null;
}

function blobDigest(content: string, blob: string): string {
  const bytes = Buffer.from(content);
  return createHash(blob.length === 64 ? 'sha256' : 'sha1')
    .update(`blob ${String(bytes.length)}\0`)
    .update(bytes)
    .digest('hex');
}

export async function readCachedSource(filename: string, blob: string): Promise<string | null> {
  const result = sourceSchema.safeParse(await readCacheJson(filename));
  if (!result.success || result.data.blob !== blob) return null;
  return blobDigest(result.data.content, blob) === blob ? result.data.content : null;
}

export async function readCacheJson(filename: string): Promise<unknown> {
  try {
    const value: unknown = JSON.parse(await readFile(filename, 'utf8'));
    return value;
  } catch {
    return null;
  }
}

/** The prior entry survives parse failures and interrupted writes. */
export async function writeCacheJson(filename: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filename), { recursive: true });
  const pending = `${filename}.${randomUUID()}.pending`;
  await writeFile(pending, JSON.stringify(value), { flag: 'wx' });
  await rename(pending, filename);
}

interface IndexIdentity {
  readonly parser: string;
  readonly blob: string;
  readonly language: SourceIndex['language'];
}
const cachedIndexSchema = z
  .object({ format: z.literal('scoped-source/v1'), parser: z.string(), index: z.unknown() })
  .strict();

export async function readCachedIndex(
  filename: string,
  identity: IndexIdentity,
): Promise<SourceIndex | null> {
  const result = cachedIndexSchema.safeParse(await readCacheJson(filename));
  if (!result.success || result.data.parser !== identity.parser) return null;
  const index = validateSourceIndex(result.data.index);
  if (index?.language !== identity.language) return null;
  return blobDigest(index.content, identity.blob) === identity.blob ? index : null;
}
