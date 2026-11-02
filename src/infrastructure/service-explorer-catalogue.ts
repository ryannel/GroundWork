import 'server-only';

import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { ExplorerCatalogue } from '@/domain/service-explorer';
import { pathIn, readBoundedBytes } from '@/infrastructure/disk';

import { explorerFilename, explorerServiceShape } from './service-explorer-format';
import { workspaceFolder } from './workspace-folders';

const catalogue = z
  .object({
    format: z.literal('service-explorer-catalogue/v1'),
    workspace: z.string().regex(/^[a-z0-9][a-z0-9-]*$/u),
    snapshot: z.string().regex(/^[a-f\d]{64}$/u),
    publication: z
      .string()
      .regex(/^[a-f\d]{64}$/u)
      .optional(),
    assetBase: z.string().regex(/^\/explorer-data\/[a-z0-9-]+\/[a-f\d]{64}\/$/u),
    selections: z
      .array(
        z
          .object({
            service: explorerServiceShape,
            manifest: z
              .object({
                file: explorerFilename,
                bytes: z.number().int().positive().max(262_144),
                sha256: z.string().regex(/^[a-f\d]{64}$/u),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export function parseExplorerCatalogue(value: unknown): ExplorerCatalogue {
  const result = catalogue.parse(value);
  if (
    result.assetBase !==
    `/explorer-data/${result.workspace}/${result.publication ?? result.snapshot}/`
  ) {
    throw new Error('Explorer asset path does not match its workspace and snapshot');
  }
  if (new Set(result.selections.map((item) => item.service.id)).size !== result.selections.length) {
    throw new Error('Duplicate explorer selection');
  }
  return result;
}
export async function readExplorerCatalogue(workspace: string): Promise<ExplorerCatalogue | null> {
  const folder = await workspaceFolder(workspace);
  if (folder === null) return null;
  const bytes = await readBoundedBytes(pathIn(folder, 'explorer', 'catalogue.json'), 262_144);
  if (bytes === null) return null;
  if (bytes.length > 262_144) throw new Error('Explorer catalogue exceeds its byte bound');
  const result = parseExplorerCatalogue(JSON.parse(bytes.toString('utf8')));
  if (result.workspace !== workspace) throw new Error('Explorer catalogue workspace mismatch');
  return result;
}

export async function readInstallCatalogue(folder: string): Promise<ExplorerCatalogue> {
  const bytes = await readBoundedBytes(pathIn(folder, 'catalogue.json'), 262_144);
  const receiptBytes = await readBoundedBytes(pathIn(folder, 'refinement.json'), 16_384);
  if (bytes === null || receiptBytes === null) {
    throw new Error('Completed explorer refinement is required before installation');
  }
  const selected = parseExplorerCatalogue(JSON.parse(bytes.toString('utf8')));
  const receipt = z
    .object({
      format: z.literal('service-explorer-refinement/v1'),
      snapshot: z.string(),
      repositories: z.number().int(),
      sourceCatalogue: z.string(),
      catalogueSha256: z.string(),
    })
    .strict()
    .parse(JSON.parse(receiptBytes.toString('utf8')));
  if (
    receipt.snapshot !== selected.snapshot ||
    receipt.repositories !== selected.selections.length ||
    receipt.catalogueSha256 !== createHash('sha256').update(JSON.stringify(selected)).digest('hex')
  ) {
    throw new Error('Explorer completion receipt changed');
  }
  return selected;
}
