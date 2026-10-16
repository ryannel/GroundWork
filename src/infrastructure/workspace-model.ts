import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import type { z } from 'zod';

import type { Flow, Interaction, UserJourney } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';
import type {
  DomainLanguage,
  Scan,
  Story,
  SystemContracts,
  WorkspaceModel,
} from '@/domain/workspace-model';

import { workspaceFolder } from './workspace-folders';
import { type Reading, readingOf } from './workspace-model-facts';
import {
  contractsFile,
  journeyFile,
  languageFile,
  scanFile,
  storyFile,
} from './workspace-model-schema';

// workspaces/<workspace>/story.yaml                 summary, stages (and concepts that belong to no domain)
//   domains/<domain>/language.yaml                  the domain's summary and concepts
//   flows/<flow>.yaml                               one flow per file
//   journeys/<journey>.yaml                         a user journey and its interactions
//   domains/<domain>/systems/<system>/contracts.yaml what the system's components offer and keep
//   scans/<org>/<name>.yaml                         the commit each repo was last read at
// Every file is optional; a workspace with none has an empty model.
export async function readWorkspaceModel(
  workspace: Workspace,
  root?: string,
): Promise<WorkspaceModel> {
  const folder = await workspaceFolder(workspace.id, root);
  if (folder === null) throw new Error(`workspace ${workspace.id}: no folder holds it`);
  const reading = readingOf();
  const story = await readStory(folder, reading);
  const flows = await readEach(path.join(folder, 'flows'), async (raw, file) =>
    reading.in(file).fact<Flow>('flow', raw),
  );
  const journeys = await readEach(path.join(folder, 'journeys'), async (raw, file) =>
    readJourney(raw, file, reading),
  );
  const languages: DomainLanguage[] = [];
  for (const domain of workspace.domains) {
    const file = path.join(folder, 'domains', domain.id, 'language.yaml');
    const language = await readLanguage(domain.id, file, reading);
    if (language !== null) languages.push(language);
  }
  const contracts: SystemContracts[] = [];
  for (const domain of workspace.domains) {
    for (const system of domain.systems) {
      const file = path.join(folder, 'domains', domain.id, 'systems', system.id, 'contracts.yaml');
      contracts.push(await readContracts(system.id, file, reading));
    }
  }
  const scans = await readEach(path.join(folder, 'scans'), scanOf);
  return {
    story,
    languages,
    flows,
    journeys: journeys.flatMap(({ journey }) => (journey === undefined ? [] : [journey])),
    interactions: journeys.flatMap(({ interactions }) => interactions),
    contracts,
    attribution: reading.attribution,
    scans,
  };
}

async function readStory(folder: string, reading: Reading): Promise<Story> {
  const file = path.join(folder, 'story.yaml');
  const data = parsed(file, storyFile, await readOptional(file));
  return {
    summary: data.summary ?? null,
    concepts: await reading.in(file).facts('concept', data.concepts),
    stages: await reading.in(file).facts('stage', data.stages),
  };
}

async function readLanguage(
  domain: string,
  file: string,
  reading: Reading,
): Promise<DomainLanguage | null> {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) return null;
  const data = parsed(file, languageFile, parse(raw) ?? {});
  return {
    domain,
    summary: data.summary ?? null,
    concepts: await reading.in(file).facts('concept', data.concepts),
  };
}

async function readJourney(
  raw: unknown,
  file: string,
  reading: Reading,
): Promise<{ journey?: UserJourney; interactions: Interaction[] }> {
  const data = parsed(file, journeyFile, raw);
  const here = reading.in(file);
  const interactions = await here.facts<Interaction>('interaction', data.interactions);
  if (data.journey === undefined) return { interactions };
  const journey = await here.fact<UserJourney>('userJourney', data.journey);
  return { journey, interactions };
}

async function readContracts(
  system: string,
  file: string,
  reading: Reading,
): Promise<SystemContracts> {
  const data = parsed(file, contractsFile, await readOptional(file));
  const here = reading.in(file);
  const all = async <T>(entries: unknown[], def: string) => here.facts<T>(def, entries);
  return {
    system,
    components: data.components.map((detail) => here.detail(detail)),
    stores: await all(data.stores, 'store'),
    interfaces: await all(data.interfaces, 'interface'),
    schemas: await all(data.schemas, 'schema'),
    messages: await all(data.messages, 'message'),
    screens: await all(data.screens, 'screen'),
    graphs: await all(data.graphs, 'graph'),
    subgraphs: await all(data.subgraphs, 'subgraph'),
    operations: await all(data.operations, 'operation'),
  };
}

function scanOf(raw: unknown, file: string): Scan {
  const data = parsed(file, scanFile, raw);
  return {
    repo: data.repo,
    branch: data.branch,
    head: data.head,
    scannedAt: data.scanned_at,
    scanner: data.scanner,
    files: data.files,
    facts: data.facts,
  };
}

async function readEach<T>(
  folder: string,
  read: (raw: unknown, file: string) => Promise<T> | T,
): Promise<T[]> {
  const entries = await readdir(folder, { withFileTypes: true, recursive: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .toSorted((a, b) => a.localeCompare(b));
  const out: T[] = [];
  for (const file of files) out.push(await read(parse(await readFile(file, 'utf8')), file));
  return out;
}

async function readOptional(file: string): Promise<unknown> {
  const text = await readFile(file, 'utf8').catch(() => null);
  const data: unknown = text === null ? null : parse(text);
  return data ?? {};
}

function parsed<Schema extends z.ZodType>(
  file: string,
  schema: Schema,
  raw: unknown,
): z.output<Schema> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  return result.data;
}
