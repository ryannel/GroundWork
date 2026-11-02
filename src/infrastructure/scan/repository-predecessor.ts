import 'server-only';

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { repositoryPassJson } from './repository-pass-files';
import { parseScanScope, type ScanScope } from './scan-scope';

const file = z
  .object({
    path: z.string(),
    mode: z.string(),
    kind: z.string(),
    blob: z.string(),
    category: z.enum(['source', 'test', 'ancillary', 'binary', 'non-regular']),
    language: z
      .enum(['typescript', 'javascript', 'java', 'go', 'csharp', 'python', 'rust'])
      .nullable(),
    selectedForParsing: z.boolean(),
    reason: z.string(),
    canonicalData: z
      .object({
        classification: z.literal('canonical_data_fixture'),
        canonicalTextLimitBytes: z
          .number()
          .int()
          .positive()
          .max(8 * 1024 * 1024),
        commit: z.string(),
        sha256: z.string(),
        lines: z.tuple([z.number().int().positive(), z.number().int().positive()]),
        parser: z.string(),
        literalNodes: z.number().int().positive(),
        storybookConfig: z.object({ path: z.string(), blob: z.string() }).strict(),
        contractObligation: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();
const report = z
  .object({
    format: z.enum(['scan-repository/v1', 'scan-repository/v2']),
    repo: z.string(),
    commit: z.string(),
    tree: z.string(),
    inventory: z.literal('inventory.json'),
    cacheDirectory: z.string().optional(),
  })
  .loose();
const inventory = z
  .object({ repo: z.string(), commit: z.string(), tree: z.string(), files: z.array(file) })
  .loose();

export interface RepositoryPredecessor {
  readonly repo: string;
  readonly commit: string;
  readonly tree: string;
  readonly files: readonly z.infer<typeof file>[];
  readonly scopes: readonly ScanScope[];
  readonly cacheDirectory: string | undefined;
}

/** A predecessor is a pinned inventory, never a promise of previous semantic completeness. */
export async function readRepositoryPredecessor(filename: string): Promise<RepositoryPredecessor> {
  const previous = report.parse(await repositoryPassJson(filename));
  const directory = path.dirname(filename);
  const listing = inventory.parse(
    await repositoryPassJson(path.join(directory, previous.inventory)),
  );
  if (
    listing.repo !== previous.repo ||
    listing.commit !== previous.commit ||
    listing.tree !== previous.tree
  ) {
    throw new Error('Previous inventory and repository publication have different pins.');
  }
  const entries = await readdir(directory);
  const names = entries
    .filter((name) => /^repository-\d+$/u.test(name))
    .toSorted((left, right) => left.localeCompare(right));
  const scopes = await Promise.all(
    names.map(async (name) =>
      repositoryPassJson(path.join(directory, name, 'scope.json')).then(parseScanScope),
    ),
  );
  if (scopes.some((scope) => scope.repo !== previous.repo || scope.commit !== previous.commit)) {
    throw new Error('Previous scopes do not belong to the previous repository publication.');
  }
  return {
    repo: previous.repo,
    commit: previous.commit,
    tree: previous.tree,
    files: listing.files,
    scopes,
    cacheDirectory: previous.cacheDirectory,
  };
}
