import 'server-only';

import { createHash } from 'node:crypto';
import path from 'node:path';

import { z } from 'zod';

import type { ArchiveScope, InterpretationArchive } from '@/application/interpretation-archive';
import { kindOf } from '@/domain/ids';

import { pathIn, readBoundedBytes, realPathOf } from './disk';
import { workspaceFolder } from './workspace-folders';

const FORMAT = 'groundwork-interpretation-archive/v1';
const MAX_MANIFEST = 256 * 1024;
const MAX_ARTIFACT = 4 * 1024 * 1024;
const sha = z.string().regex(/^[a-f0-9]{64}$/u);
const pin = z.string().regex(/^[a-f0-9]{40}$/u);
const repo = z.string().regex(/^[\w.-]+\/[\w.-]+$/u);
const name = z.string().regex(/^[\w-][\w.-]*$/u);
const file = z.strictObject({ bytes: z.int().min(1).max(MAX_ARTIFACT), sha256: sha });
const selection = file.extend({ name, repo, commit: pin });
const index = z.strictObject({
  format: z.literal(FORMAT),
  repositories: z.array(selection).max(1000),
});
const manifest = z.strictObject({
  format: z.literal(FORMAT),
  repo,
  commit: pin,
  artifacts: z.strictObject({
    interpretation: file,
    review: file,
    inputs: file,
    independentReview: file.optional(),
    seal: file.optional(),
  }),
  contexts: z.array(file.extend({ id: z.string().min(1) })),
  claims: z.array(
    z.strictObject({
      id: z.string().min(1),
      canonicalId: z
        .string()
        .refine((id) => kindOf(id) === 'evidence')
        .nullable(),
    }),
  ),
});
const original = z.object({
  claims: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      statement: z.string(),
      confidence: z.enum(['low', 'medium', 'high']),
      reasoning: z.string(),
      limitations: z.array(z.string()),
    }),
  ),
});
type File = z.infer<typeof file>;
type Manifest = z.infer<typeof manifest>;
type Selection = z.infer<typeof selection>;

async function within(workspace: string, ...parts: readonly string[]): Promise<string | null> {
  const real = await realPathOf(pathIn(workspace, 'evidence-archive', 'explorer', ...parts));
  if (real === null) return null;
  if (!real.startsWith(workspace + path.sep)) {
    throw new Error('Archive path is outside the workspace.');
  }
  return real;
}

async function folderOf(workspace: string, root?: string): Promise<string | null> {
  const folder = await workspaceFolder(workspace, root);
  return folder === null ? null : realPathOf(folder);
}

async function selectionsOf(folder: string): Promise<readonly Selection[]> {
  const target = await within(folder, 'index.json');
  if (target === null) return [];
  const bytes = await readBoundedBytes(target, MAX_MANIFEST);
  if (bytes === null) return [];
  const { repositories } = index.parse(JSON.parse(bytes.toString('utf8')));
  if (
    new Set(repositories.map((row) => row.name)).size !== repositories.length ||
    new Set(repositories.map((row) => `${row.repo}@${row.commit}`)).size !== repositories.length
  ) {
    throw new Error('Duplicate interpretation archive repository selection.');
  }
  return repositories;
}

async function checkedBytes(
  folder: string,
  parts: readonly string[],
  expected: File,
): Promise<Buffer> {
  const target = await within(folder, ...parts);
  const bytes = target === null ? null : await readBoundedBytes(target, expected.bytes);
  if (
    bytes?.length !== expected.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== expected.sha256
  ) {
    throw new Error('Interpretation archive checksum changed.');
  }
  return bytes;
}

async function selectedArchive(
  folder: string,
  scope: ArchiveScope,
): Promise<{ readonly name: string; readonly data: Manifest } | null> {
  const repositories = await selectionsOf(folder);
  const selected = repositories.find(
    (entry) => entry.repo === scope.repo && entry.commit === scope.commit,
  );
  if (selected === undefined) return null;
  const bytes = await checkedBytes(folder, [selected.name, 'manifest.json'], selected);
  const data = manifest.parse(JSON.parse(bytes.toString('utf8')));
  if (data.repo !== selected.repo || data.commit !== selected.commit) {
    throw new Error('Interpretation archive repository or pin changed.');
  }
  return { name: selected.name, data };
}

export async function archiveRepositories(
  workspace: string,
  root?: string,
): Promise<readonly ArchiveScope[] | null> {
  const folder = await folderOf(workspace, root);
  if (folder === null) return null;
  const repositories = await selectionsOf(folder);
  return repositories.map(({ repo: repository, commit }) => ({
    repo: repository,
    commit,
  }));
}

export async function readArchive(
  workspace: string,
  scope: ArchiveScope,
  root?: string,
): Promise<InterpretationArchive | null> {
  const folder = await folderOf(workspace, root);
  if (folder === null) return null;
  const archive = await selectedArchive(folder, scope);
  if (archive === null) return null;
  const { name: directory, data } = archive;
  const bytes = await checkedBytes(
    folder,
    [directory, 'interpretation.json'],
    data.artifacts.interpretation,
  );
  const { claims } = original.parse(JSON.parse(bytes.toString('utf8')));
  const canonical = new Map(data.claims.map((claim) => [claim.id, claim.canonicalId]));
  if (canonical.size !== claims.length || data.claims.length !== claims.length) {
    throw new Error('Interpretation archive claim coverage changed.');
  }
  return {
    claims: claims.map((claim) => {
      const canonicalId = canonical.get(claim.id);
      if (canonicalId === undefined) {
        throw new Error('Missing interpretation archive claim identity.');
      }
      canonical.delete(claim.id);
      return { ...claim, canonicalId };
    }),
    contexts: data.contexts,
    independentReview: data.artifacts.independentReview !== undefined,
    seal: data.artifacts.seal !== undefined,
  };
}

export async function readArchiveArtifact(
  workspace: string,
  scope: ArchiveScope,
  key: string,
  root?: string,
): Promise<Buffer | null> {
  const folder = await folderOf(workspace, root);
  if (folder === null) return null;
  const archive = await selectedArchive(folder, scope);
  if (archive === null) return null;
  const { name: directory, data } = archive;
  if (key === 'interpretation' || key === 'review' || key === 'inputs') {
    return checkedBytes(folder, [directory, `${key}.json`], data.artifacts[key]);
  }
  if (key === 'independent-review' && data.artifacts.independentReview !== undefined) {
    return checkedBytes(
      folder,
      [directory, 'independent-review.json'],
      data.artifacts.independentReview,
    );
  }
  if (key === 'seal' && data.artifacts.seal !== undefined) {
    return checkedBytes(folder, [directory, 'seal.json'], data.artifacts.seal);
  }
  const context = data.contexts.find((entry) => key === entry.sha256);
  return context === undefined
    ? null
    : checkedBytes(folder, [directory, 'contexts', `${context.sha256}.txt`], context);
}
