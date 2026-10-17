import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import type { z } from 'zod';

import type { Domain, System, Workspace } from '@/domain/workspace';
import { checkWorkspace } from '@/domain/workspace-check';

import { workspaceFolders } from './workspace-folders';
import { domainFile, systemFile, workspaceFile } from './workspace-schema';

// <workspace>/workspace.yaml          the workspace's own repo; see workspace-folders for where it is
//   domains/<domain>/domain.yaml
//     systems/<system>/system.yaml
export async function readWorkspaces(root?: string): Promise<readonly Workspace[]> {
  const found = await workspaceFolders(root);
  return Promise.all([...found.values()].map(async (folder) => readWorkspace(folder)));
}

async function readWorkspace(folder: string): Promise<Workspace> {
  const file = await readYaml(path.join(folder, 'workspace.yaml'), workspaceFile);
  const domainsFolder = path.join(folder, 'domains');
  const domainIds = await folders(domainsFolder);
  const domains = await Promise.all(
    domainIds.map(async (id) => readDomain(path.join(domainsFolder, id))),
  );
  const workspace: Workspace = {
    id: file.id,
    name: file.name,
    description: file.description ?? null,
    isPrivate: file.private,
    teams: file.teams.map(({ id, name, colour, channel }) => ({
      id,
      name,
      colour: colour ?? null,
      channel: channel ?? null,
    })),
    actors: file.actors.map(({ id, name, summary, uses, customer }) => ({
      id,
      name,
      summary: summary ?? null,
      uses,
      customer,
    })),
    domains,
    keyJourneys: file.key_journeys,
  };
  const { errors } = checkWorkspace(workspace);
  if (errors.length > 0) throw new Error(`${folder}:\n${errors.join('\n')}`);
  return workspace;
}

async function readDomain(folder: string): Promise<Domain> {
  const file = await readYaml(path.join(folder, 'domain.yaml'), domainFile);
  const systemsFolder = path.join(folder, 'systems');
  const systemIds = await folders(systemsFolder);
  const systems = await Promise.all(
    systemIds.map(async (id) => readSystem(path.join(systemsFolder, id))),
  );
  return { id: file.id, name: file.name, purpose: file.purpose ?? null, systems };
}

async function readSystem(folder: string): Promise<System> {
  const file = await readYaml(path.join(folder, 'system.yaml'), systemFile);
  return {
    id: file.id,
    name: file.name,
    purpose: file.purpose ?? null,
    team: file.team ?? null,
    repos: file.repos,
    components: file.components.map((component) => ({
      id: component.id,
      name: component.name,
      type: component.type,
      tech: component.tech ?? null,
      does: component.does ?? null,
      talksTo: component.talks_to,
    })),
  };
}

async function readYaml<Schema extends z.ZodType>(
  file: string,
  schema: Schema,
): Promise<z.output<Schema>> {
  const result = schema.safeParse(parse(await readFile(file, 'utf8')));
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  return result.data;
}

async function folders(folder: string): Promise<readonly string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b));
}
