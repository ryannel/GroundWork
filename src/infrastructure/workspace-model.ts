import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import type { z } from 'zod';

import type { Flow, Interaction, UserJourney } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';
import type {
  DomainLanguage,
  KeyTerms,
  Scan,
  Story,
  SystemContracts,
  TargetArchitecture,
  WorkspaceModel,
} from '@/domain/workspace-model';

import { workspaceFolder } from './workspace-folders';
import { type Reading, readingOf } from './workspace-model-facts';
import {
  contractsFile,
  handlersFile,
  journeyFile,
  keyTermsFile,
  languageFile,
  scanFile,
  storyFile,
  targetFile,
} from './workspace-model-schema';

// workspaces/<workspace>/story.yaml                 summary, stages (and concepts that belong to no domain)
//   language.yaml                                   the key terms the whole business agrees on
//   domains/<domain>/language.yaml                  the domain's summary and concepts
//   domains/<domain>/target.yaml                    where the domain is heading
//   flows/<flow>.yaml                               one flow per file
//   journeys/<journey>.yaml                         a user journey and its interactions
//   domains/<domain>/systems/<system>/contracts.yaml what the system's components offer and keep
//   domains/<domain>/systems/<system>/handlers.yaml  what runs when they are called
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
  const keyTerms = await readKeyTerms(folder);
  const flows = await readEach(path.join(folder, 'flows'), async (raw, file) =>
    reading.in(file).fact<Flow>('flow', raw),
  );
  const journeys = await readEach(path.join(folder, 'journeys'), async (raw, file) =>
    readJourney(raw, file, reading),
  );
  const languageFiles = workspace.domains.map((domain) => ({
    domain: domain.id,
    file: path.join(folder, 'domains', domain.id, 'language.yaml'),
  }));
  const systemFiles = workspace.domains.flatMap((domain) =>
    domain.systems.map((system) => ({
      system: system.id,
      file: path.join(folder, 'domains', domain.id, 'systems', system.id, 'contracts.yaml'),
    })),
  );
  // Files are read side by side, then checked in a fixed order so ids are claimed the same way every time.
  const [languageTexts, contractsRaw, handlersRaw] = await Promise.all([
    Promise.all(languageFiles.map(async ({ file }) => readFile(file, 'utf8').catch(() => null))),
    Promise.all(systemFiles.map(async ({ file }) => readOptional(file))),
    Promise.all(systemFiles.map(async ({ file }) => readOptional(handlersBeside(file)))),
  ]);
  const readLanguages = await Promise.all(
    languageFiles.map(async ({ domain, file }, i) =>
      readLanguage({ domain, file, raw: languageTexts[i] ?? null }, reading),
    ),
  );
  const languages = readLanguages.flatMap((language) => (language === null ? [] : [language]));
  const contracts = await Promise.all(
    systemFiles.map(async ({ system, file }, i) =>
      readContracts({ system, file, raw: contractsRaw[i], handlers: handlersRaw[i] }, reading),
    ),
  );
  const scans = await readEach(path.join(folder, 'scans'), scanOf);
  const targets = await Promise.all(
    workspace.domains.map(async (domain) =>
      readTarget(domain.id, path.join(folder, 'domains', domain.id, 'target.yaml')),
    ),
  );
  return {
    story,
    languages,
    targets: targets.flatMap((target) => (target === null ? [] : [target])),
    keyTerms,
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

async function readKeyTerms(folder: string): Promise<KeyTerms> {
  const file = path.join(folder, 'language.yaml');
  const data = parsed(file, keyTermsFile, await readOptional(file));
  return {
    summary: data.summary ?? null,
    source:
      data.source === undefined
        ? null
        : {
            title: data.source.title,
            url: data.source.url ?? null,
            status: data.source.status ?? null,
          },
    groups: data.groups,
    terms: data.terms.map((term) => ({
      id: term.id,
      name: term.name,
      group: term.group ?? null,
      aliases: term.aliases,
      means: term.means,
      examples: term.examples.map((each) => ({
        context: each.context,
        analogy: each.analogy ?? null,
        sentence: each.sentence ?? null,
      })),
      relates: term.relates,
      anchors: term.anchors.map((anchor) => ({
        to: anchor.to,
        fit: anchor.fit,
        note: anchor.note ?? null,
      })),
    })),
  };
}

async function readLanguage(
  {
    domain,
    file,
    raw,
  }: { readonly domain: string; readonly file: string; readonly raw: string | null },
  reading: Reading,
): Promise<DomainLanguage | null> {
  if (raw === null) return null;
  const data = parsed(file, languageFile, parse(raw) ?? {});
  return {
    domain,
    summary: data.summary ?? null,
    concepts: await reading.in(file).facts('concept', data.concepts),
  };
}

async function readTarget(domain: string, file: string): Promise<TargetArchitecture | null> {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) return null;
  const data = parsed(file, targetFile, parse(raw) ?? {});
  return {
    domain,
    summary: data.summary ?? null,
    stages: data.stages.map((stage) => ({
      ...stage,
      term: stage.term ?? null,
      summary: stage.summary ?? null,
    })),
    shifts: data.shifts,
  };
}

async function readJourney(
  raw: unknown,
  file: string,
  reading: Reading,
): Promise<{ readonly journey?: UserJourney; readonly interactions: readonly Interaction[] }> {
  const data = parsed(file, journeyFile, raw);
  const here = reading.in(file);
  const interactions = await here.facts<Interaction>('interaction', data.interactions);
  if (data.journey === undefined) return { interactions };
  const journey = await here.fact<UserJourney>('userJourney', data.journey);
  return { journey, interactions };
}

function handlersBeside(contracts: string): string {
  return path.join(path.dirname(contracts), 'handlers.yaml');
}

async function readContracts(
  {
    system,
    file,
    raw,
    handlers,
  }: {
    readonly system: string;
    readonly file: string;
    readonly raw: unknown;
    readonly handlers: unknown;
  },
  reading: Reading,
): Promise<SystemContracts> {
  const data = parsed(file, contractsFile, raw);
  const handlersAt = handlersBeside(file);
  const ran = parsed(handlersAt, handlersFile, handlers);
  const here = reading.in(file);
  const all = async <T>(entries: readonly unknown[], def: string) => here.facts<T>(def, entries);
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
    handlers: await reading.in(handlersAt).facts('handler', ran.handlers),
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
    checked:
      data.checked === undefined
        ? null
        : {
            at: data.checked.at,
            tip: data.checked.tip,
            behind: data.checked.behind ?? null,
            folders: data.checked.folders,
          },
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
  const texts = await Promise.all(files.map(async (file) => readFile(file, 'utf8')));
  return Promise.all(files.map(async (file, i) => read(parse(texts[i] ?? ''), file)));
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
