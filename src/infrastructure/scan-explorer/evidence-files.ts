import 'server-only';

import { once } from 'node:events';
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { finished } from 'node:stream/promises';

import type { DiscoverySummary } from '@/application/evidence/evidence-discovery';
import {
  type EvidenceRecord,
  type EvidenceRepository,
  isEvidenceRecord,
} from '@/domain/evidence/evidence';
import { inTurn } from '@/shared/in-turn';

// The files of a workspace's scan evidence. evidence/<name>/ is committed: repository.json, discovery.json and one
// <family>.jsonl per record family, a record per line in id order, so a rescan's diff shows what changed.
// .groundwork/analysis/<name>/ (call-level analysis) and .groundwork/syntax/<name>/ (the syntax graph) are
// git-ignored caches in the same form.

export interface RepositoryEvidence {
  readonly name: string;
  readonly repository: EvidenceRepository;
  readonly discovery: DiscoverySummary | null;
  readonly families: ReadonlyMap<string, readonly EvidenceRecord[]>;
  readonly analysis: ReadonlyMap<string, readonly EvidenceRecord[]>;
}

const evidenceFolder = (workspace: string): string => path.join(workspace, 'evidence');
const syntaxFolder = (workspace: string): string => path.join(workspace, '.groundwork', 'syntax');
export const analysisFolder = (workspace: string): string =>
  path.join(workspace, '.groundwork', 'analysis');

// one write per batch, so a large family does not wait on the stream once per record
const BATCH = 2000;

async function writeTo(stream: WriteStream, records: readonly EvidenceRecord[]): Promise<void> {
  const batches = Array.from({ length: Math.ceil(records.length / BATCH) }, (_, index) =>
    records.slice(index * BATCH, (index + 1) * BATCH),
  );
  await inTurn(batches, async (batch) => {
    const text = batch.map((record) => `${JSON.stringify(record)}\n`).join('');
    if (!stream.write(text)) await once(stream, 'drain');
  });
}

async function endStream(stream: WriteStream): Promise<void> {
  stream.end();
  await finished(stream);
}

async function writeLines(file: string, records: readonly EvidenceRecord[]): Promise<void> {
  const stream = createWriteStream(file, 'utf8');
  await writeTo(stream, records);
  await endStream(stream);
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Replaces a folder whole, through a staging folder, so nothing from an earlier scan survives in it. */
async function replaceFolder(
  folder: string,
  fill: (staging: string) => Promise<void>,
): Promise<void> {
  const staging = `${folder}.writing`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await fill(staging);
  await rm(folder, { recursive: true, force: true });
  await rename(staging, folder);
}

async function writeFamilies(
  folder: string,
  families: ReadonlyMap<string, readonly EvidenceRecord[]>,
): Promise<void> {
  await Promise.all(
    [...families].map(async ([family, records]) =>
      writeLines(path.join(folder, `${family}.jsonl`), records),
    ),
  );
}

export async function writeRepositoryEvidence(
  workspace: string,
  evidence: RepositoryEvidence,
): Promise<void> {
  await replaceFolder(path.join(analysisFolder(workspace), evidence.name), async (staging) =>
    writeFamilies(staging, evidence.analysis),
  );
  await replaceFolder(path.join(evidenceFolder(workspace), evidence.name), async (staging) => {
    await writeFile(path.join(staging, 'repository.json'), json(evidence.repository));
    if (evidence.discovery !== null) {
      await writeFile(path.join(staging, 'discovery.json'), json(evidence.discovery));
    }
    await writeFamilies(staging, evidence.families);
  });
}

/** Writes a repository's syntax cache a batch at a time; nothing replaces the old cache until it is closed. */
export interface SyntaxCacheWriter {
  readonly write: (family: string, records: readonly EvidenceRecord[]) => Promise<void>;
  readonly close: () => Promise<void>;
}

export async function openSyntaxCache(workspace: string, name: string): Promise<SyntaxCacheWriter> {
  const folder = path.join(syntaxFolder(workspace), name);
  const staging = `${folder}.writing`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const streams = new Map<string, WriteStream>();
  const streamFor = (family: string): WriteStream => {
    const open =
      streams.get(family) ?? createWriteStream(path.join(staging, `${family}.jsonl`), 'utf8');
    streams.set(family, open);
    return open;
  };
  return {
    write: async (family, records) => writeTo(streamFor(family), records),
    close: async () => {
      await Promise.all([...streams.values()].map(async (stream) => endStream(stream)));
      await rm(folder, { recursive: true, force: true });
      await rename(staging, folder);
    },
  };
}

/** Removes evidence for repositories the current scan set no longer holds. */
export async function pruneEvidence(
  workspace: string,
  kept: ReadonlySet<string>,
): Promise<string[]> {
  const listed = await Promise.all(
    [evidenceFolder(workspace), analysisFolder(workspace), syntaxFolder(workspace)].map(
      async (folder) => {
        const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
        return entries
          .filter((entry) => entry.isDirectory() && !kept.has(entry.name))
          .map((entry) => path.join(folder, entry.name));
      },
    ),
  );
  const removed = listed.flat();
  await Promise.all(removed.map(async (folder) => rm(folder, { recursive: true, force: true })));
  return removed;
}

/** The repositories with evidence: folder name and folder. */
export async function evidenceRepositories(
  workspace: string,
): Promise<readonly { readonly name: string; readonly folder: string }[]> {
  const entries = await readdir(evidenceFolder(workspace), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.endsWith('.writing'))
    .map((entry) => ({
      name: entry.name,
      folder: path.join(evidenceFolder(workspace), entry.name),
    }))
    .toSorted((left, right) => left.name.localeCompare(right.name, 'en'));
}

/** The record files in a repository's folder, by family. */
export async function recordFiles(folder: string): Promise<ReadonlyMap<string, string>> {
  const names = await readdir(folder).catch(() => []);
  return new Map(
    names
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => [name.slice(0, -'.jsonl'.length), path.join(folder, name)]),
  );
}

export async function* readRecords(file: string): AsyncGenerator<EvidenceRecord> {
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.length === 0) continue;
    const record: unknown = JSON.parse(line);
    if (!isEvidenceRecord(record)) {
      throw new Error(`Not an evidence record in ${file}: ${line.slice(0, 80)}`);
    }
    yield record;
  }
}
