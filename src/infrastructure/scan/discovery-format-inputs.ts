import 'server-only';

import { z } from 'zod';

import type { DiscoveryInventory } from '@/domain/scan/discovery-types';

function safePath(path: string): boolean {
  return (
    path !== '' &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path.split('/').every((part) => !['', '.', '..'].includes(part))
  );
}
const identity = z.string().min(1);
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const commit = z.string().regex(/^[a-f0-9]{40}$/u);
const basis = z.enum(['boundary', 'entry', 'implementation', 'root_name']);
const observed = z
  .object({
    kind: z.literal('observed_record'),
    context_id: identity,
    record_id: identity,
    source_id: identity,
    basis,
  })
  .strict();
const canonical = z
  .object({
    kind: z.literal('context_snapshot'),
    context_id: identity,
    path: identity.refine(safePath),
    commit,
    sha256: digest,
    lines: z
      .tuple([z.number().int().positive(), z.number().int().positive()])
      .refine(([start, end]) => start <= end),
    basis,
  })
  .strict();
const candidate = z
  .object({
    id: identity,
    kind: z.enum(['boundary', 'entry', 'support']),
    root: identity.refine((path) => path === '.' || safePath(path)),
    evidence: z.array(z.discriminatedUnion('kind', [observed, canonical])),
  })
  .strict();
const inventory = z
  .object({
    repo: identity,
    commit,
    analysis_version: identity,
    snapshot_sha256: digest,
    sha256: digest,
    candidates: z.array(candidate),
  })
  .strict();

/** Parse independently frozen inventory bytes before any assessment or digest comparison. */
export function parseDiscoveryInventory(value: unknown): DiscoveryInventory {
  return inventory.parse(value);
}
