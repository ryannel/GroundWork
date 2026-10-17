// Ask the system map from a terminal or an agent. Prints JSON, except `md`, which writes MAP.md.
//   npm run map -- find <words>     facts whose id, name or summary hold the words
//   npm run map -- show <id>        the fact, its sources, what it calls and what calls it, and when
//   npm run map -- callers <id>     who reaches it, up to --depth hops (3)
//   npm run map -- calls <id>       the call tree under an endpoint, message or handler, --depth hops (8)
//   npm run map -- owns <path>      the facts read from a file (--repo org/name to narrow)
//   npm run map -- repos            the commit each repo was last read at; never-scanned repos say so
//   npm run map -- md               write <workspace>/MAP.md
// Options: --workspace <id> (the first workspace when not given); --checkouts <dir> adds a local path to every
// source whose repo is checked out as <dir>/<name>.
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { type Cited, findIn, ownedBy, type SystemMap, systemMapOf } from '@/application/system-map';
import { callersOf, shownIn } from '@/application/system-map-links';
import { mapMarkdownOf } from '@/application/system-map-md';
import { systemModelOf } from '@/application/workspace-model';
import { workspaceFolder } from '@/infrastructure/workspace-folders';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    workspace: { type: 'string' },
    checkouts: { type: 'string' },
    repo: { type: 'string' },
    depth: { type: 'string' },
  },
});

async function loaded(): Promise<SystemMap> {
  const all = await readWorkspaces();
  const workspace = all.find(({ id }) => values.workspace === undefined || id === values.workspace);
  if (workspace === undefined) throw new Error(`no workspace ${values.workspace ?? ''}`);
  const model = await readWorkspaceModel(workspace);
  return systemMapOf(workspace, systemModelOf(workspace, model));
}

// Where a cited file sits on this machine, when its repo is checked out under --checkouts.
function local(source: Cited): Cited & { readonly local?: string } {
  if (values.checkouts === undefined) return source;
  const name = source.repo.split('/').at(-1) ?? source.repo;
  const file = path.join(values.checkouts, name, source.path);
  return existsSync(file) ? { ...source, local: file } : source;
}

function isCited(value: unknown): value is Cited {
  if (typeof value !== 'object' || value === null) return false;
  if (!('repo' in value) || !('path' in value)) return false;
  return typeof value.repo === 'string' && typeof value.path === 'string';
}

function withLocal(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withLocal);
  if (typeof value !== 'object' || value === null) return value;
  const pairs: readonly (readonly [string, unknown])[] = Object.entries(value);
  const entries = pairs.map(([key, inner]): [string, unknown] =>
    key === 'sources' && Array.isArray(inner)
      ? [key, inner.map((source) => (isCited(source) ? local(source) : source))]
      : [key, withLocal(inner)],
  );
  return Object.fromEntries(entries);
}

function depthOr(fallback: number): number {
  const depth = Number(values.depth ?? fallback);
  return Number.isInteger(depth) && depth > 0 ? depth : fallback;
}

async function answer(map: SystemMap, command: string, arg: string): Promise<unknown> {
  switch (command) {
    case 'find': {
      return findIn(map, arg);
    }
    case 'show': {
      return (
        shownIn(map, arg) ?? { error: `no fact ${arg}; try: find ${arg.replace(/^[a-z]+:/u, '')}` }
      );
    }
    case 'callers': {
      return callersOf(map, arg, depthOr(3));
    }
    case 'calls': {
      return map.system.model.callTree(arg, { depth: depthOr(8), mode: 'asIs' });
    }
    case 'owns': {
      return ownedBy(map, arg, values.repo);
    }
    case 'repos': {
      return map.repos;
    }
    case 'md': {
      const folder = await workspaceFolder(map.workspace.id);
      if (folder === null) throw new Error(`no workspace ${map.workspace.id}`);
      const file = path.join(folder, 'MAP.md');
      await writeFile(file, mapMarkdownOf(map));
      return { wrote: path.relative(process.cwd(), file) };
    }
    default: {
      return { error: `unknown command ${command}; see the head of tools/map.ts` };
    }
  }
}

const [command = 'repos', ...rest] = positionals;
const map = await loaded();
const result = await answer(map, command, rest.join(' '));
process.stdout.write(`${JSON.stringify(withLocal(result), null, 2)}\n`);
