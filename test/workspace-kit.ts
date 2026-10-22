// Workspaces for tests: Acme in memory, and Acme (or any workspace) written to disk in the format the store reads.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { stringify } from 'yaml';

import { type SystemModel, systemModelOf } from '@/application/workspace-model';
import type { Source } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';
import {
  type CodeSource,
  permalinkOf,
  type SystemContracts,
  type WorkspaceModel,
} from '@/domain/workspace-model';

import { acmeModel } from './fixtures/acme/model';
import { acmeWorkspace } from './fixtures/acme/workspace';

export interface Acme {
  readonly workspace: Workspace;
  readonly model: WorkspaceModel;
  readonly today: SystemModel;
}

/** Acme as the app sees it: the workspace, its model of today, and the two drawn together. */
export function acme(): Acme {
  const workspace = acmeWorkspace();
  const model = acmeModel();
  return { workspace, model, today: systemModelOf(workspace, model) };
}

/** A fresh folder under the system's temporary folder. */
export async function tempDir(prefix = 'groundwork-'): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

/** Writes each file under `dir`, making folders as needed. Objects are written as YAML, strings as they are. */
export async function writeWorkspace(
  dir: string,
  files: Readonly<Record<string, unknown>>,
): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([relative, content]) => {
      const file = path.join(dir, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, typeof content === 'string' ? content : stringify(content));
    }),
  );
}

type Entry = Readonly<Record<string, unknown>>;

const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Keeps only the keys whose value is set: the files leave out what the store reads back as null. */
const set = (entry: object): Entry =>
  Object.fromEntries(
    Object.entries(entry).filter(([, value]) => value !== null && value !== undefined),
  );

const slugOf = (id: string): string => id.slice(id.indexOf(':') + 1);

/**
 * Acme's files, relative to its workspace folder. Write them into `<root>/acme` and read `root`:
 * `await writeWorkspace(path.join(root, 'acme'), acmeFiles())`, then `readWorkspaces(root)`.
 */
export function acmeFiles(): Record<string, unknown> {
  return filesOf(acmeWorkspace(), acmeModel());
}

/** Any workspace and model as the files the store reads back to the same workspace and model. */
function filesOf(workspace: Workspace, model: WorkspaceModel): Record<string, unknown> {
  const fact = factOf(model);
  return {
    ...structureFiles(workspace),
    'story.yaml': {
      ...(model.story.summary === null ? {} : { summary: model.story.summary }),
      concepts: model.story.concepts.map(fact),
      stages: model.story.stages.map(fact),
    },
    'language.yaml': keyTermsFile(model),
    ...Object.fromEntries(
      model.languages.map((language) => [
        `domains/${language.domain}/language.yaml`,
        {
          ...(language.summary === null ? {} : { summary: language.summary }),
          concepts: language.concepts.map(fact),
        },
      ]),
    ),
    ...Object.fromEntries(model.flows.map((flow) => [`flows/${slugOf(flow.id)}.yaml`, fact(flow)])),
    ...Object.fromEntries(
      model.targets.map((target) => [
        `domains/${target.domain}/target.yaml`,
        set({
          summary: target.summary,
          stages: target.stages.map(set),
          shifts: target.shifts.map(set),
        }),
      ]),
    ),
    ...journeyFiles(model, fact),
    ...contractsFiles(workspace, model, fact),
    ...Object.fromEntries(
      model.scans.map((scan) => [
        `scans/${scan.repo}.yaml`,
        {
          repo: scan.repo,
          branch: scan.branch,
          head: scan.head,
          scanned_at: scan.scannedAt,
          scanner: scan.scanner,
          files: scan.files,
          facts: scan.facts,
        },
      ]),
    ),
  };
}

function structureFiles(workspace: Workspace): Record<string, unknown> {
  const files: Record<string, unknown> = {
    'workspace.yaml': set({
      format: 1,
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      private: workspace.isPrivate,
      teams: workspace.teams.map(set),
      actors: workspace.actors.map(set),
      key_journeys: workspace.keyJourneys,
    }),
  };
  for (const domain of workspace.domains) {
    files[`domains/${domain.id}/domain.yaml`] = set({
      id: domain.id,
      name: domain.name,
      purpose: domain.purpose,
    });
    for (const system of domain.systems) {
      files[`domains/${domain.id}/systems/${system.id}/system.yaml`] = set({
        id: system.id,
        name: system.name,
        purpose: system.purpose,
        team: system.team,
        repos: system.repos.map((home) => (home.path === null ? home.repo : home)),
        components: system.components.map(({ talksTo, ...component }) =>
          set({ ...component, talks_to: talksTo }),
        ),
      });
    }
  }
  return files;
}

function keyTermsFile({ keyTerms }: WorkspaceModel): Entry {
  return set({
    summary: keyTerms.summary,
    source: keyTerms.source === null ? null : set(keyTerms.source),
    groups: keyTerms.groups,
    terms: keyTerms.terms.map((term) =>
      set({
        ...term,
        examples: term.examples.map(set),
        anchors: term.anchors.map(set),
      }),
    ),
  });
}

const isSource = (value: unknown): value is Source =>
  isEntry(value) && typeof value.url === 'string';

type Fact = (entry: { readonly id: string }) => Entry;

/** A fact as written: who said it, and its sources as the code they came from. */
function factOf(model: WorkspaceModel): Fact {
  const code = new Map<string, CodeSource>(
    Object.values(model.attribution).flatMap(({ sources }) =>
      sources.map((source): [string, CodeSource] => [permalinkOf(source), source]),
    ),
  );
  const asCode = (source: Source): CodeSource | Source => code.get(source.url) ?? source;
  const written = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(written);
    }
    if (!isEntry(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === 'sources' && Array.isArray(child)
          ? child.filter(isSource).map(asCode)
          : written(child),
      ]),
    );
  };
  return (entry) => {
    const origin = model.attribution[entry.id]?.origin ?? 'curated';
    const value = written(entry);
    return { ...(isEntry(value) ? value : {}), origin };
  };
}

/** Each journey with the interactions it lists; any interaction no journey lists goes in a file of its own. */
function journeyFiles(model: WorkspaceModel, fact: Fact): Record<string, unknown> {
  const claimed = new Set<string>();
  const files: Record<string, unknown> = {};
  for (const journey of model.journeys) {
    const mine = model.interactions.filter(
      (each) => journey.interactions.includes(each.id) && !claimed.has(each.id),
    );
    for (const each of mine) {
      claimed.add(each.id);
    }
    files[`journeys/${slugOf(journey.id)}.yaml`] = {
      journey: fact(journey),
      interactions: mine.map(fact),
    };
  }
  const loose = model.interactions.filter((each) => !claimed.has(each.id));
  if (loose.length > 0) {
    files['journeys/~interactions.yaml'] = { interactions: loose.map(fact) };
  }
  return files;
}

const FACT_LISTS = [
  'stores',
  'interfaces',
  'schemas',
  'messages',
  'screens',
  'graphs',
  'subgraphs',
  'operations',
] as const satisfies readonly (keyof SystemContracts)[];

function contractsFiles(
  workspace: Workspace,
  model: WorkspaceModel,
  fact: Fact,
): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  for (const domain of workspace.domains) {
    for (const system of domain.systems) {
      const contracts = model.contracts.find((each) => each.system === system.id);
      if (contracts === undefined) {
        continue;
      }
      const lists = Object.fromEntries(
        FACT_LISTS.filter((key) => contracts[key].length > 0).map((key) => [
          key,
          contracts[key].map(fact),
        ]),
      );
      const components = contracts.components.map(fact);
      if (components.length === 0 && Object.keys(lists).length === 0) {
        continue;
      }
      files[`domains/${domain.id}/systems/${system.id}/contracts.yaml`] = {
        ...(components.length === 0 ? {} : { components }),
        ...lists,
      };
    }
  }
  return files;
}
