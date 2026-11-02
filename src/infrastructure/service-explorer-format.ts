import 'server-only';

import { z } from 'zod';

import { explorerArtifactIndex } from '@/domain/explorer-artifact-index';
import type { ExplorerManifest } from '@/domain/service-explorer';

export const explorerFilename = z.string().regex(/^[a-z0-9][a-z0-9-]*\.json$/u);
const pack = z
  .object({
    file: explorerFilename,
    bytes: z.number().int().positive().max(2_097_152),
    sha256: z.string().regex(/^[a-f\d]{64}$/u),
  })
  .strict();
const artifact = z
  .object({
    file: explorerFilename,
    bytes: z.number().int().positive().max(65_536),
    sha256: z.string().regex(/^[a-f\d]{64}$/u),
    pack: pack.optional(),
  })
  .strict();
const entry = z
  .object({ id: z.string().min(1), label: z.string().min(1), file: explorerFilename })
  .strict();
export const explorerServiceShape = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    repo: z.string().min(1),
    commit: z.string().regex(/^[a-f\d]{40,64}$/u),
    purpose: z
      .object({
        label: z.literal('Inferred'),
        statement: z.string().min(1),
        confidence: z.enum(['low', 'medium', 'high']),
        claim: z.string().min(1),
      })
      .strict(),
    overview: explorerFilename,
    callers: explorerFilename,
    scope: z.literal('repository').optional(),
    sourceIndex: explorerFilename.optional(),
    interpretationIndex: explorerFilename.optional(),
    entryCount: z.number().int().nonnegative().optional(),
    entries: z.array(entry).max(500),
  })
  .strict();
const manifest = z
  .object({
    format: z.literal('service-explorer/v1'),
    workspace: z.string().min(1),
    snapshot: z.string().min(1),
    services: z.array(explorerServiceShape).max(200),
    artifacts: z.array(artifact).max(10_000),
    artifactIndexes: z
      .array(
        z
          .object({
            bucket: z.string().regex(/^[a-f\d]{2}$/u),
            file: explorerFilename,
            bytes: z.number().int().positive().max(2_097_152),
            sha256: z.string().regex(/^[a-f\d]{64}$/u),
            pack: pack.optional(),
          })
          .strict(),
      )
      .max(256)
      .optional(),
  })
  .strict();

export function parseExplorerManifest(input: unknown): ExplorerManifest {
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 262_144) {
    throw new Error('Explorer manifest exceeds its byte bound; export a smaller selected scope');
  }
  const parsed = manifest.parse(input);
  const files = new Set(parsed.artifacts.map((item) => item.file));
  const refs = parsed.services.flatMap((item) => [
    item.overview,
    item.callers,
    ...item.entries.map((route) => route.file),
  ]);
  if (
    files.size !== parsed.artifacts.length ||
    refs.some((file) => !files.has(file) && explorerArtifactIndex(parsed, file) === undefined)
  ) {
    throw new Error('Explorer manifest has duplicate or missing page references');
  }
  if (new Set(parsed.services.map((item) => item.id)).size !== parsed.services.length) {
    throw new Error('Duplicate explorer component');
  }
  return parsed;
}
